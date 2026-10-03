///|
/// # 最小 Todo —— 你要改的就是这个文件
///
/// 一个 moobile 应用的全貌就是 **TEA 四件套 + 一个导出**：
/// `Model` / `Msg` / `update` / `view`（可选 `subscriptions`），
/// 最后由 `app()` 把整张句柄表交给宿主。宿主侧不需要知道 `Model` 是什么。
///
/// 这里刻意只留"一条链路"：**内存里的清单**（加 / 勾 / 删）。没有本地库、没有网络、
/// 没有多页面 —— 那些是能力，要的时候再加（见 README 的"加能力"）。
///
/// 想动手改的第一处：`view` 里的 `title`。

///|
/// 一条待办。
struct Todo {
  id : Int
  text : String
  done : Bool
} derive(Eq)

///|
/// 应用状态。**纯数据，对渲染后端一无所知** —— 它不知道自己是跑在 Web 还是 Android。
struct Model {
  items : Array[Todo]
  draft : String
  next_id : Int
  /// 会话计时（`subscriptions` 那半条 TEA 的样本，见文件末尾）。
  ticks : Int
} derive(Eq)

///|
/// 用户动作。**每个 Msg 都要在 `update` 里有一条分发臂**，没有默认分支。
///
/// `pub` 是跟着 demo 的写法：`Msg` 会被 `@cmd.Emit[Msg]` 与 `@html` 的处理器闭包带着跑，
/// 标 `priv` 编译器会抱怨"它没出现在公开签名里"。
pub enum Msg {
  SetDraft(String)
  Add
  Toggle(Int)
  Remove(Int)
  Tick
}

///|
/// 初始状态：清单是空的。
fn initial() -> Model {
  { items: [], draft: "", next_id: 1, ticks: 0 }
}

///|
/// TEA 的 `update`：`(Model, Msg) -> (Model, Cmd)`。
///
/// 模板里所有分支都返回 `@cmd.none` —— 因为清单就在内存里。
/// 要写本地库 / 发网络请求时，在这里返回一个命令（见 README 的"加能力"）。
fn update(
  model : Model,
  msg : Msg,
  _emit : @cmd.Emit[Msg],
) -> (Model, @cmd.Cmd) {
  match msg {
    SetDraft(s) => ({ ..model, draft: s }, @cmd.none)
    Add =>
      if model.draft == "" {
        (model, @cmd.none)
      } else {
        let item : Todo = { id: model.next_id, text: model.draft, done: false }
        (
          { ..model, items: model.items + [item], draft: "", next_id: model.next_id + 1 },
          @cmd.none,
        )
      }
    Toggle(id) =>
      (
        {
          ..model,
          items: model.items.map(t => if t.id == id { { ..t, done: !t.done } } else { t }),
        },
        @cmd.none,
      )
    Remove(id) =>
      ({ ..model, items: model.items.filter(t => t.id != id) }, @cmd.none)
    Tick => ({ ..model, ticks: model.ticks + 1 }, @cmd.none)
  }
}

// ── 视图 ──────────────────────────────────────────────────────────────────────
//
// 用的是 `@html` DSL（与 rabbita 同一份血统），处理器就是 `emit(Msg)`。
// 与浏览器里写 rabbita 唯一的区别：**样式不是 `class=`，而是类型化的 `Style`**
// （`@html.Attrs::build().styles(...)`）—— 因为宿主是 React Native，没有 CSS 文件。

///|
let c_bg : String = "#f6efe0"

///|
let c_card : String = "#fffaf0"

///|
let c_ink : String = "#1a1410"

///|
let c_ink3 : String = "#7a6851"

///|
let c_accent : String = "#8a2518"

///|
let c_line : String = "#e0d5c0"

///|
fn attrs(s : @style.Style) -> @html.Attrs {
  @html.Attrs::build().styles(s)
}

///|
/// **这一行的记忆化键**（给 `@moobile.memo_list` 用）。
///
/// `memo` 的契约是：**键相同必须蕴含"这一行的 HTML 与 handler 等价"**。所以这里把
/// `item_row` 用到的**每一个**会变的东西都装进去：
///
/// | 字段 | 少了它的症状 |
/// |---|---|
/// | `text` | 改文案**画不出来** |
/// | `done` | 勾选状态、颜色、对钩**停在旧值** |
/// | `id` | **最隐蔽的一个**：行里的 `emit(Toggle(t.id))` 是**被复用**的那份闭包 —— 列表重排/插入之后，同一位置换成另一条同文案同状态的待办，点下去会**切换错的那一条** |
///
/// 用"哈希 + 位"拼成一个 `Int`（不是字符串拼接）：键**每帧每行**都要算。
fn item_key(t : Todo) -> Int {
  let done_bit = if t.done {
    1
  } else {
    0
  }
  (t.text.hash() * 31 + t.id) * 2 + done_bit
}

///|
fn item_row(t : Todo, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex_direction(@style.FlexDirection::Row)
      .align_items(@style.Align::Center)
      .background_color(c_card)
      .border_radius(12.0)
      .border_width(1.0)
      .border_color(c_line)
      .padding_horizontal(@style.px(14.0))
      .padding_vertical(@style.px(12.0))
      .margin_bottom(@style.px(8.0)),
    ),
    [
      @html.button(
        attrs=attrs(
          @style.Style::new()
          .width(@style.px(22.0))
          .height(@style.px(22.0))
          .border_radius(6.0)
          .border_width(1.5)
          .align_items(@style.Align::Center)
          .justify_content(@style.Justify::Center)
          .margin_right(@style.px(12.0))
          .background_color(if t.done { c_accent } else { "transparent" })
          .border_color(if t.done { c_accent } else { c_line }),
        ),
        on_click=emit(Toggle(t.id)),
        [
          @html.span(
            attrs=attrs(
              @style.Style::new().font_size(13.0).color(c_card).font_weight(
                @style.FontWeight::W700,
              ),
            ),
            if t.done { "✓" } else { "" },
          ),
        ],
      ),
      @html.span(
        attrs=attrs(
          @style.Style::new()
          .flex(1.0)
          .font_size(15.0)
          .color(if t.done { c_ink3 } else { c_ink })
          .text_decoration_line(
            if t.done {
              @style.TextDecorationLine::LineThrough
            } else {
              @style.TextDecorationLine::None
            },
          ),
        ),
        t.text,
      ),
      @html.button(
        attrs=attrs(
          @style.Style::new().padding_horizontal(@style.px(8.0)).padding_vertical(
            @style.px(4.0),
          ),
        ),
        on_click=emit(Remove(t.id)),
        [
          @html.span(
            attrs=attrs(@style.Style::new().font_size(13.0).color(c_ink3)),
            "删",
          ),
        ],
      ),
    ],
  )
}

///|
fn input_row(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex_direction(@style.FlexDirection::Row)
      .align_items(@style.Align::Center)
      .background_color(c_card)
      .border_radius(14.0)
      .border_width(1.0)
      .border_color(c_line)
      .padding_horizontal(@style.px(14.0)),
    ),
    [
      @html.input(
        value=model.draft,
        placeholder="要做点什么？",
        // `on_input` 收的是 `Emit[String]`，而我们的 emit 是 `Emit[Msg]` —— 所以 `map` 一下。
        on_input=emit.map(s => SetDraft(s)),
        attrs=attrs(
          @style.Style::new()
          .flex(1.0)
          .font_size(16.0)
          .color(c_ink)
          .padding_vertical(@style.px(10.0)),
        ),
      ),
      @html.button(
        attrs=attrs(
          @style.Style::new()
          .background_color(c_accent)
          .border_radius(10.0)
          .padding_horizontal(@style.px(16.0))
          .padding_vertical(@style.px(9.0))
          .margin_left(@style.px(10.0)),
        ),
        on_click=emit(Add),
        [
          @html.span(
            attrs=attrs(
              @style.Style::new().font_size(15.0).color(c_card).font_weight(
                @style.FontWeight::W600,
              ),
            ),
            "添加",
          ),
        ],
      ),
    ],
  )
}

///|
/// 视图：**一整个界面就是一棵 `@html.Html` 树**，每次重绘重新构造它。
fn view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  let left = model.items.filter(t => !t.done).length()
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
      @html.div(
        attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Row)),
        [
          @html.span(
            attrs=attrs(
              @style.Style::new().font_size(22.0).color(c_ink).font_weight(
                @style.FontWeight::W700,
              ),
            ),
            "待办",
          ),
          @html.span(
            attrs=attrs(
              @style.Style::new().font_size(13.0).color(c_ink3).margin_left(
                @style.px(10.0),
              ),
            ),
            "还有 \{left} 件",
          ),
        ],
      ),
      input_row(model, emit),
      // ★ 列表走 `memo_list`（一行包对）：键没变的那几行**整棵子树都不重建**，
      //   React 拿到的是同一个元素引用 ⇒ 整片跳过。列表越长越划算；**键必须完备**
      //   （见 `item_key` 的注释 —— 少一个字段就有一个看得见的坏症状）。
      //   配方与自查判据：`docs/PERF-RECIPES.md`。
      @html.div(
        attrs=attrs(@style.Style::new()),
        @moobile.memo_list(model.items, by=item_key, f=t => item_row(t, emit)),
      ),
      @html.span(
        attrs=attrs(@style.Style::new().font_size(12.0).color(c_ink3)),
        "本次会话 \{model.ticks * 5} 秒（`subscriptions` 那半条 TEA 的样本，不用就直接删）",
      ),
    ],
  )
}

///|
/// **订阅**：运行时主动推消息回来（用户没点任何东西）。
///
/// 这里每 5 秒推一个 `Tick` 只为证明这条线是通的。
/// ⚠️ 间隔用 `@sub.every(5000, …)` 而不是 1 秒：**1 秒一跳会让 `uiautomator dump`
/// 永远等不到 idle**（真机上表现为 `could not get idle state.`，而且它失败时会留下
/// 上一次的 xml，读到陈旧界面）。手机上的持续流（AppState / 传感器）走 `@sub.custom_sub`。
fn subscriptions(_model : Model, emit : @cmd.Emit[Msg]) -> @sub.Sub {
  @sub.every(5000, emit(Tick))
}

///|
/// **应用交给宿主的全部东西：一行。**
///
/// 交出的是整张句柄表（`contract` / `start` / `snapshot` / `subscribe` / `element` / 诊断），
/// 宿主（`moobile-host` 的 `mountApp`）拿到它就能把应用挂起来 ——
/// 它不需要知道 `Model` / `Msg` 是什么。
///
/// ⚠️ 导出名 `app` 必须与 `moon.pkg` 里 `link.exports` 和 `App.js` 的 import 一致。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~, subscriptions~)
}
