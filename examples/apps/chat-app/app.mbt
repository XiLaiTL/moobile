///|
/// # chat-app —— 一个真能用的 LLM 聊天应用
///
/// 它是"**真实应用**"这条轨道的样本：不是演示某个能力，而是把几件事**同时**用起来 ——
/// 长列表、输入、网络、**流式**、本地历史、设置。它压到的东西以前没有一条判据同时压过。
///
/// ## 用户看到的三件事
///
/// 1. **设置页**：`Base URL` / `API Key` / `Model`，存本地（sqlite），下次不用重填；
/// 2. **聊天页**：消息列表 + 输入框 + 发送 —— 助手的回复**逐字长出来**（流式），
///    另有「停止生成」；
/// 3. **历史**：落本地库，关掉再开还在（见 `chat_db.mbt` 顶部那条取舍：流到一半被杀就没了）。
///
/// ## 三层，各自可测
///
/// | 文件 | 管什么 | 判据 |
/// |---|---|---|
/// | `llm.mbt` | 拼请求 / 取增量（**纯函数**） | 无头判据直接断言 |
/// | `chat_db.mbt` | 历史与设置（`@sqlite`） | 无头判据：写进去、重开还在 |
/// | `app.mbt`（本文件） | 状态机与视图 | 无头 + 真机：点发送 → 界面逐字长出来 |
///
/// **流式**走 `@http.stream`（`http/stream.mbt`）—— 它的传输在 web 与 RN 上是**两份代码**，
/// 所以这个应用的真机判据不是"顺带跑一下"，而是**那半条通道唯一能验的地方**。
///
/// ## 一条约定：只认**当前这一次**流
///
/// 用户在流没结束时又按了一次发送（或者点了停止又立刻重发），旧流可能还会吐出几帧。
/// 那些帧必须**丢掉**，否则会把新回复搅乱。所以 `Model` 里存着 `streaming : Int?`，
/// 每一帧都带着它属于哪一次（`Stream(id, ev)`），`update` 里第一件事就是比对。

///|
/// 一条消息的角色。存库时写成 `"u"` / `"a"`。
pub enum Role {
  User
  Assistant
} derive(Eq)

///|
/// 界面上的一"泡"。单会话，所以不需要会话 id。
pub struct Bubble {
  role : Role
  text : String
} derive(Eq)

///|
/// 会话相位。`Failed` 带原因 —— **错误要看得见**，不能白屏（这是判据里的一条）。
pub enum Phase {
  Idle
  Sending
  Failed(String)
} derive(Eq)

///|
pub enum Screen {
  Chat
  Settings
} derive(Eq)

///|
struct Model {
  /// 本次会话（含正在生成的那条）
  bubbles : Array[Bubble]
  draft : String
  next_id : Int
  /// 当前流的句柄；`None` = 没有在跑
  streaming : Int?
  phase : Phase
  screen : Screen
  /// 已保存的设置（发请求用它）
  saved : Fields
  /// 设置页正在编辑的副本（改到一半退出去不该污染已保存的）
  editing : Fields
  /// 本地库读完了没（没读完不许发）
  ready : Bool
} derive(Eq)

///|
pub enum Msg {
  /// 库读完了：历史 + 设置
  Ready(Array[Bubble], Fields)
  DbFailed(String)
  SetDraft(String)
  Send
  Stop
  /// 流里的一帧 —— 带着"它属于哪一次"
  Stream(Int, @http.StreamEvent)
  /// 写完库了
  Persisted
  Clear
  OpenSettings
  CloseSettings
  EditBase(String)
  EditKey(String)
  EditModel(String)
  SaveSettings
}

///|
fn initial() -> Model {
  {
    bubbles: [],
    draft: "",
    next_id: 1,
    streaming: None,
    phase: Idle,
    screen: Chat,
    saved: default_fields(),
    editing: default_fields(),
    ready: false,
  }
}

///|
/// 启动：**先读库再出首帧**（`handlers_with_init`）——
/// 否则会先闪一下空对话再补上，而"启动时到底发生了什么"就说不清了。
fn init_app(emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  (initial(), load_cmd(emit))
}

///|
fn to_bubble(r : BubbleRow) -> Bubble {
  { role: if r.role == "u" { User } else { Assistant }, text: r.text }
}

// ── Cmd 三件（读库 / 写库 / 落一条助手回复）────────────────────────────────────

///|
/// 把"一段 async 活儿"包成 `Cmd`：成功发 `Persisted`，失败发 `DbFailed`。
///
/// ⚠️ `@cmd.perform` 要求 `noraise`，所以自己 `try/catch` —— 这也是**唯一**能保证
/// "库炸了不会静默空白"的地方（与 todo-app 的同名注释同一个理由）。
fn db_cmd(emit : @cmd.Emit[Msg], work : async () -> Unit) -> @cmd.Cmd {
  @cmd.perform(
    (r : Result[Unit, String]) =>
      emit(
        match r {
          Ok(_) => Persisted
          Err(e) => DbFailed("本地库出错：\{e}")
        },
      ),
    async fn() -> Result[Unit, String] noraise {
      try {
        work()
        Ok(())
      } catch {
        e => Err("\{e}")
      }
    },
  )
}

///|
fn load_cmd(emit : @cmd.Emit[Msg]) -> @cmd.Cmd {
  @cmd.perform(
    (r : Result[(Array[Bubble], Fields), String]) =>
      emit(
        match r {
          Ok(pair) => Ready(pair.0, pair.1)
          Err(e) => DbFailed("本地库出错：\{e}")
        },
      ),
    async fn() -> Result[(Array[Bubble], Fields), String] noraise {
      try {
        setup()
        let rows = history()
        let f = load_settings()
        Ok((rows.map(to_bubble), f))
      } catch {
        e => Err("\{e}")
      }
    },
  )
}

///|
/// 把**最后一条助手回复**落库（收尾 / 停止 / 出错三条路都走这里）。
///
/// 为什么不"每帧写一次"：聊天里一帧常常是一个字 —— 那是每字一次 INSERT。
/// 边界写一次就够，代价是"流到一半被杀"那半条会丢（见 `chat_db.mbt` 顶部的取舍）。
fn persist_last_cmd(model : Model, emit : @cmd.Emit[Msg]) -> @cmd.Cmd {
  let bs = model.bubbles
  let n = bs.length()
  if n == 0 {
    @cmd.none
  } else {
    let b = bs[n - 1]
    if b.role == Assistant && b.text != "" {
      db_cmd(emit, async fn() {
        append("a", b.text)
      })
    } else {
      @cmd.none
    }
  }
}

// ── 状态机 ────────────────────────────────────────────────────────────────────

///|
/// 把增量追加到**最后一条**气泡上（那条就是这一轮的助手占位）。
fn push_delta(bs : Array[Bubble], t : String) -> Array[Bubble] {
  let n = bs.length()
  if n == 0 {
    bs
  } else {
    bs.mapi((i, b) => if i == n - 1 { { ..b, text: b.text + t } } else { b })
  }
}

///|
fn update(model : Model, msg : Msg, emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  match msg {
    Ready(bs, f) =>
      (
        {
          ..model,
          bubbles: bs,
          saved: f,
          editing: f,
          ready: true,
          phase: Idle,
          // 没有 key = 这个应用什么也做不了：直接送到设置页，别让他先撞一次 401
          screen: if f.key.trim().to_owned() == "" { Settings } else { Chat },
        },
        @cmd.none,
      )
    DbFailed(e) => ({ ..model, phase: Failed(e) }, @cmd.none)
    SetDraft(s) => ({ ..model, draft: s }, @cmd.none)
    Send => {
      let text = model.draft.trim().to_owned()
      if not(model.ready) || text == "" || model.streaming is Some(_) {
        (model, @cmd.none)
      } else if model.saved.key.trim().to_owned() == "" {
        (
          { ..model, screen: Settings, phase: Failed("还没填 API Key —— 在设置里填一个") },
          @cmd.none,
        )
      } else {
        let id = model.next_id
        // ⚠️ 发给模型的消息里**不含**那条空的助手占位（它是给界面用的）
        let sent : Array[Bubble] = model.bubbles + [{ role: User, text }]
        let body = request_body(model.saved.model, sent)
        let url = endpoint(model.saved.base)
        (
          {
            ..model,
            bubbles: sent + [{ role: Assistant, text: "" }],
            draft: "",
            next_id: id + 1,
            streaming: Some(id),
            phase: Sending,
          },
          @cmd.batch([
            db_cmd(emit, async fn() {
              append("u", text)
            }),
            @http.stream(
              id=id,
              url=url,
              headers=[
                ("Content-Type", "application/json"),
                ("Accept", "text/event-stream"),
                (
                  "Authorization",
                  "Bearer \{model.saved.key.trim().to_owned()}",
                ),
              ],
              body=body,
              on_event=ev => emit(Stream(id, ev)),
            ),
          ]),
        )
      }
    }
    // ★ 只认当前这一次（旧流的尾巴一律丢掉）
    Stream(id, ev) =>
      if model.streaming != Some(id) {
        (model, @cmd.none)
      } else {
        match ev {
          @http.Delta(t) =>
            match error_text(t) {
              // 有些网关在**状态码 200** 的流里塞一条错误帧：没有 content、只有 error.message。
              // 不在这里接住，用户看到的就是"AI 一个字没说，也没报错"。
              Some(e) => (
                { ..model, phase: Failed(e), streaming: None },
                persist_last_cmd(model, emit),
              )
              None =>
                match delta_text(t) {
                  Some(s) => ({ ..model, bubbles: push_delta(model.bubbles, s) }, @cmd.none)
                  // 没有文本的帧是**正常**的（role 帧 / finish_reason 帧 / 服务商自加字段）
                  None => (model, @cmd.none)
                }
            }
          @http.Done => (
            { ..model, phase: Idle, streaming: None },
            persist_last_cmd(model, emit),
          )
          @http.Fail(reason) => (
            { ..model, phase: Failed(reason), streaming: None },
            persist_last_cmd(model, emit),
          )
        }
      }
    Stop =>
      match model.streaming {
        Some(id) => (
          { ..model, phase: Idle, streaming: None },
          @cmd.batch([@http.abort(id), persist_last_cmd(model, emit)]),
        )
        None => (model, @cmd.none)
      }
    Persisted => (model, @cmd.none)
    Clear => (
      { ..model, bubbles: [], phase: Idle },
      db_cmd(emit, async fn() {
        wipe()
      }),
    )
    OpenSettings => ({ ..model, screen: Settings, editing: model.saved }, @cmd.none)
    CloseSettings => ({ ..model, screen: Chat, phase: Idle }, @cmd.none)
    EditBase(s) => ({ ..model, editing: { ..model.editing, base: s } }, @cmd.none)
    EditKey(s) => ({ ..model, editing: { ..model.editing, key: s } }, @cmd.none)
    EditModel(s) => ({ ..model, editing: { ..model.editing, model: s } }, @cmd.none)
    SaveSettings => {
      let f = model.editing
      (
        { ..model, saved: f, screen: Chat, phase: Idle },
        db_cmd(emit, async fn() {
          save_settings(f)
        }),
      )
    }
  }
}

// ── 视图 ──────────────────────────────────────────────────────────────────────

///|
let c_bg : String = "#0f1117"

///|
let c_card : String = "#1a1d26"

///|
let c_user : String = "#2b3a55"

///|
let c_ink : String = "#e9e9ec"

///|
let c_dim : String = "#8b93a7"

///|
let c_accent : String = "#4c8dff"

///|
let c_warn : String = "#ff6b6b"

///|
fn attrs(s : @style.Style) -> @html.Attrs {
  @html.Attrs::build().styles(s)
}

///|
fn pill(label : String, bg : String, on_click : @cmd.Cmd) -> @html.Html {
  @html.button(
    attrs=attrs(
      @style.Style::new()
      .background_color(bg)
      .border_radius(9.0)
      .padding_horizontal(@style.px(13.0))
      .padding_vertical(@style.px(8.0))
      .margin_left(@style.px(8.0)),
    ),
    on_click=on_click,
    [
      @html.span(
        attrs=attrs(
          @style.Style::new().font_size(14.0).color("#ffffff").font_weight(
            @style.FontWeight::W600,
          ),
        ),
        label,
      ),
    ],
  )
}

///|
fn bubble_row(b : Bubble, streaming_tail : Bool) -> @html.Html {
  let mine = b.role == User
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex_direction(@style.FlexDirection::Column)
      .background_color(if mine { c_user } else { c_card })
      .border_radius(12.0)
      .padding(@style.px(12.0))
      .margin_bottom(@style.px(8.0)),
    ),
    [
      @html.span(
        attrs=attrs(@style.Style::new().font_size(12.0).color(c_dim).margin_bottom(@style.px(4.0))),
        if mine { "你" } else { "AI" },
      ),
      @html.span(
        attrs=attrs(@style.Style::new().font_size(15.0).color(c_ink)),
        // 正在生成时挂个光标 —— **"还在长"与"卡住了"要看得出来**
        if streaming_tail { b.text + "▍" } else { b.text },
      ),
    ],
  )
}

///|
fn chat_view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  let sending = model.streaming is Some(_)
  let n = model.bubbles.length()
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex(1.0)
      .flex_direction(@style.FlexDirection::Column)
      .background_color(c_bg)
      .padding(@style.px(16.0)),
    ),
    [
      @html.div(
        attrs=attrs(
          @style.Style::new()
          .flex_direction(@style.FlexDirection::Row)
          .align_items(@style.Align::Center),
        ),
        [
          @html.span(
            attrs=attrs(
              @style.Style::new().flex(1.0).font_size(19.0).color(c_ink).font_weight(
                @style.FontWeight::W700,
              ),
            ),
            "对话",
          ),
          pill("清空", "#33384a", emit(Clear)),
          pill("设置", "#33384a", emit(OpenSettings)),
        ],
      ),
      // ⚠️ 伪标签：`@html` 里**没有** `scroll` 助手（HTML 靠 overflow 滚动），
      //    得写 `@html.node("scroll", …)`，由 moible 的标签表映射到 RN 的 `ScrollView`。
      //    不套它的后果很具体：手机上只能看到第一屏（todo-app 的 R1 屏踩过）。
      @html.node(
        "scroll",
        attrs(@style.Style::new().flex(1.0).margin_vertical(@style.px(10.0))),
        model.bubbles.mapi((i, b) => bubble_row(b, sending && i == n - 1)),
      ),
      @html.div(
        attrs=attrs(@style.Style::new().margin_bottom(@style.px(6.0))),
        match model.phase {
          Failed(e) =>
            @html.span(
              attrs=attrs(@style.Style::new().font_size(13.0).color(c_warn)),
              "出错：\{e}",
            )
          _ =>
            @html.span(
              attrs=attrs(@style.Style::new().font_size(13.0).color(c_dim)),
              if sending {
                "生成中…"
              } else if not(model.ready) {
                "正在读本地历史…"
              } else {
                ""
              },
            )
        },
      ),
      @html.div(
        attrs=attrs(
          @style.Style::new()
          .flex_direction(@style.FlexDirection::Row)
          .align_items(@style.Align::Center)
          .background_color(c_card)
          .border_radius(13.0)
          .padding_horizontal(@style.px(12.0)),
        ),
        [
          @html.input(
            value=model.draft,
            placeholder="说点什么…",
            on_input=emit.map(s => SetDraft(s)),
            attrs=attrs(
              @style.Style::new().flex(1.0).font_size(16.0).color(c_ink).padding_vertical(
                @style.px(11.0),
              ),
            ),
          ),
          if sending {
            pill("停止", c_warn, emit(Stop))
          } else {
            pill("发送", c_accent, emit(Send))
          },
        ],
      ),
    ],
  )
}

///|
fn field(
  label : String,
  value : String,
  hint : String,
  make_msg : (String) -> Msg,
  emit : @cmd.Emit[Msg],
) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new().flex_direction(@style.FlexDirection::Column).margin_bottom(
        @style.px(12.0),
      ),
    ),
    [
      @html.span(
        attrs=attrs(@style.Style::new().font_size(13.0).color(c_dim).margin_bottom(@style.px(4.0))),
        label,
      ),
      @html.input(
        value=value,
        // ⚠️ 这里必须真的把输入接回 update（`on_input`）—— 只给 `value=` 是"受控但没人管"，
        //    键盘敲了字界面不动。I1 那条事件载荷通道就是为了这个。
        on_input=emit.map(make_msg),
        attrs=attrs(
          @style.Style::new()
          .background_color(c_card)
          .border_radius(10.0)
          .padding(@style.px(11.0))
          .font_size(15.0)
          .color(c_ink),
        ),
      ),
      @html.span(
        attrs=attrs(@style.Style::new().font_size(12.0).color(c_dim).margin_top(@style.px(3.0))),
        hint,
      ),
    ],
  )
}

///|
fn settings_view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex(1.0)
      .flex_direction(@style.FlexDirection::Column)
      .background_color(c_bg)
      .padding(@style.px(16.0)),
    ),
    [
      @html.span(
        attrs=attrs(
          @style.Style::new().font_size(19.0).color(c_ink).font_weight(
            @style.FontWeight::W700,
          ).margin_bottom(@style.px(4.0)),
        ),
        "设置",
      ),
      @html.span(
        attrs=attrs(
          @style.Style::new().font_size(12.0).color(c_dim).margin_bottom(@style.px(14.0)),
        ),
        "任何 OpenAI 兼容端点都行（官方 / 国内各家 / 局域网里的 Ollama）。Key 只存在这台机器上。",
      ),
      field(
        "Base URL",
        model.editing.base,
        "例：https://api.deepseek.com/v1 · http://192.168.1.5:11434/v1",
        s => EditBase(s),
        emit,
      ),
      field("API Key", model.editing.key, "存本地（sqlite），不经过任何第三方", s => EditKey(s), emit),
      field(
        "Model",
        model.editing.model,
        "例：deepseek-chat · gpt-4o-mini · qwen2.5",
        s => EditModel(s),
        emit,
      ),
      @html.div(
        attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Row)),
        [pill("保存", c_accent, emit(SaveSettings)), pill("返回", "#33384a", emit(CloseSettings))],
      ),
    ],
  )
}

///|
fn view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  match model.screen {
    Settings => settings_view(model, emit)
    Chat => chat_view(model, emit)
  }
}

///|
/// **应用交给宿主的全部东西：一行。**
///
/// 用 `handlers_with_init`（不是 `handlers`）：这个应用首帧之前要先读本地库（历史 + 设置）。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers_with_init(init=init_app, update~, view~)
}
