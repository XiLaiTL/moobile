///|
/// # SSE 试金石 —— 验"边收边显示"这条通道
///
/// 它刻意**小到只说一件事**：点「连接」→ 服务端分帧推 → 每收到一帧界面就多一行 →
/// 最后落到「完成」。判据在 `verify.mjs`（无头，node + 本地 SSE 服务）与
/// `device_check.mjs`（真机，验的是另一条传输 —— 见 `sse/sse.mbt` 的平台表）。
///
/// ## 这个应用存在的理由
///
/// 库里原来只有一问一答（`@http` 会把整个响应读完才交回来）。"边生成边显示"要的是
/// **一个请求、很多条消息**，而这条路以前没有任何判据。它与 `gesture-spike` /
/// `canvas-spike` 同类：**先写期望，再让探针去证伪**。
///
/// ## 界面上那几处是**判据的落点**（别随手改文案）
///
/// | 界面元素 | 判据在验什么 |
/// |---|---|
/// | `状态：…` | 状态机的**每个相位**（空闲 / 接收中 / 完成 / 已停止 / 失败：…）都看得出来 |
/// | `#N <文本>` | 每帧一行**且带序号** —— 一次蹦出来 vs 边收边长，只有序号能分辨 |
/// | 「停止」 | `abort` 之后**一条都不再发**（不是"发了但应用忽略"） |

///|
/// 应用状态。纯数据，对"底下是 fetch 还是 XHR"一无所知 —— 那正是这条通道要藏起来的东西。
struct Model {
  /// 人看的相位，也是判据读的那一行
  status : String
  /// 收到的每一帧（带序号渲染）
  chunks : Array[String]
  next_id : Int
  /// 当前这次流的句柄（`None` = 没有在跑）
  active : Int?
} derive(Eq)

///|
/// 用户动作 + 流事件。
///
/// ⚠️ `Stream` 带着**它属于哪一次**（`id`）：用户在流没结束时又点一次「连接」，
/// 旧流可能还会吐出几帧 —— 那些必须**丢掉**，否则会把新会话的内容搅进来。
pub enum Msg {
  Connect
  Stream(Int, @sse.Event)
  Stop
}

///|
fn initial() -> Model {
  { status: "空闲", chunks: [], next_id: 1, active: None }
}

///|
/// 服务端地址由**判据**给（无头探针会在点之前设好它）。
///
/// 真机上没有"同源"这回事，地址必须由宿主/判据提供 —— 与 todo-app 的
/// `MOBILE_HOST.apiBase` 是同一个道理，这里用全局变量只是为了让探针能逐场景切换。
extern "js" fn sse_url() -> String =
  #| () => globalThis.__SSE_SPIKE_URL || "http://127.0.0.1:8799/stream"

///|
fn update(
  model : Model,
  msg : Msg,
  emit : @cmd.Emit[Msg],
) -> (Model, @cmd.Cmd) {
  match msg {
    Connect => {
      let id = model.next_id
      (
        { ..model, status: "接收中", chunks: [], next_id: id + 1, active: Some(id) },
        @sse.stream(
          id=id,
          url=sse_url(),
          headers=[("Content-Type", "application/json"), ("Accept", "text/event-stream")],
          body="{\"probe\":true}",
          on_event=ev => emit(Stream(id, ev)),
        ),
      )
    }
    // 只认**当前这一次**的事件（旧流的尾巴一律丢掉）
    Stream(id, ev) =>
      if model.active != Some(id) {
        (model, @cmd.none)
      } else {
        match ev {
          @sse.Delta(text) => ({ ..model, chunks: model.chunks + [text] }, @cmd.none)
          @sse.Done => ({ ..model, status: "完成", active: None }, @cmd.none)
          @sse.Fail(reason) => (
            { ..model, status: "失败：\{reason}", active: None },
            @cmd.none,
          )
        }
      }
    Stop =>
      match model.active {
        Some(id) => ({ ..model, status: "已停止", active: None }, @sse.abort(id))
        None => (model, @cmd.none)
      }
  }
}

// ── 视图 ──────────────────────────────────────────────────────────────────────

///|
let c_bg : String = "#0f1115"

///|
let c_card : String = "#171a21"

///|
let c_ink : String = "#e8e6e3"

///|
let c_dim : String = "#8b93a7"

///|
let c_accent : String = "#3d7dff"

///|
fn attrs(s : @style.Style) -> @html.Attrs {
  @html.Attrs::build().styles(s)
}

///|
fn button(label : String, on_click : @cmd.Cmd) -> @html.Html {
  @html.button(
    attrs=attrs(
      @style.Style::new()
      .background_color(c_accent)
      .border_radius(10.0)
      .padding_horizontal(@style.px(16.0))
      .padding_vertical(@style.px(9.0))
      .margin_right(@style.px(10.0)),
    ),
    on_click=on_click,
    [
      @html.span(
        attrs=attrs(
          @style.Style::new().font_size(15.0).color("#ffffff").font_weight(
            @style.FontWeight::W600,
          ),
        ),
        label,
      ),
    ],
  )
}

///|
fn view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex(1.0)
      .flex_direction(@style.FlexDirection::Column)
      .gap(12.0)
      .padding(@style.px(20.0))
      .background_color(c_bg),
    ),
    [
      @html.span(
        attrs=attrs(
          @style.Style::new().font_size(20.0).color(c_ink).font_weight(
            @style.FontWeight::W700,
          ),
        ),
        "SSE 试金石",
      ),
      // 状态行：判据读它判断相位
      @html.span(
        attrs=attrs(@style.Style::new().font_size(14.0).color(c_dim)),
        "状态：\{model.status}（\{model.chunks.length()} 帧）",
      ),
      @html.div(
        attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Row)),
        [button("连接", emit(Connect)), button("停止", emit(Stop))],
      ),
      @html.div(
        attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Column).gap(6.0)),
        model.chunks.mapi((i, t) => {
          @html.span(
            attrs=attrs(@style.Style::new().font_size(15.0).color(c_ink)),
            "#\{i + 1} \{t}",
          )
        }),
      ),
    ],
  )
}

///|
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~)
}
