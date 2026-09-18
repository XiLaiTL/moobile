///|
/// **各事件载荷的解码策略表** —— 这是 moobile 对 rabbita 的第三批实质改造。
///
/// ## 为什么必须做
///
/// rabbita 原本把 DOM 语义写死在每个 `on_*` 处理器里：
///
/// ```moonbit
/// scheduler.add(msg(raw.to_keyboard_event().unwrap()))
/// ```
///
/// 这在浏览器里成立，但 **`unwrap()` 在任何非浏览器宿主上都会 panic**。
/// 第一次踩到的是 `on_mouse_event`：React Native 的 `Pressable` 给的是合成
/// press 事件，`to_mouse_event()` 返回 `None` → 点一下就崩。
///
/// 普查（`_r1/dom_survey.txt`）发现这不是孤例：`html/` + `svg/` 里共 **45 处**
/// `@dom.`，其中**同一形状的 panic 有 13 个**（下表每一栏一个）。
/// 只修 mouse 那一处，等于把同样的雷留给 keyboard / drag / scroll / input …
/// —— 而 **yi 的罗盘拖拽（`on_mousedown/move/up` 读 `Mouse` 坐标）正好踩在里面**。
///
/// ## 设计
///
/// 一张表、一处替换点。DOM 后端保持原样（走浏览器的事件子类型判定），
/// React 后端整表换成"原样透传"。
///
/// **目标要说清楚**：这里换来的是"**不崩、可降级**"，
/// 不是"载荷也等价"。真正**读取载荷**的处理器（罗盘拖拽读坐标）
/// 在 RN 上仍拿不到有意义的值 —— 那是设计文档的 R2，需要接手势系统。
pub struct EventDecoders {
  // 载荷本身就是 DOM 类型（`on_*` 的回调签名里写着 `@dom.XxxEvent`）
  mouse_event : (Event) -> @dom.MouseEvent
  keyboard_event : (Event) -> @dom.KeyboardEvent
  focus_event : (Event) -> @dom.FocusEvent
  drag_event : (Event) -> @dom.DragEvent
  clipboard_event : (Event) -> @dom.ClipboardEvent
  composition_event : (Event) -> @dom.CompositionEvent
  wheel_event : (Event) -> @dom.WheelEvent
  ui_event : (Event) -> @dom.UIEvent
  input_event : (Event) -> @dom.InputEvent
  dom_event : (Event) -> @dom.Event
  // 载荷是 rabbita 自己的类型（签名与 DOM 无关）。
  // 输入仍是**已解码的 DOM 载荷** —— 因为 `Emit[Mouse]` 这类处理器的上游
  // （`on_mouse_event`）已经拿到 `@dom.MouseEvent` 了。
  mouse : (@dom.MouseEvent) -> @common.Mouse
  keyboard : (@dom.KeyboardEvent) -> @common.Keyboard
  scroll : (@dom.UIEvent) -> @common.Scroll
}

///|
/// DOM 默认实现：走浏览器的事件子类型判定。**行为与原实现逐字一致。**
#cfg(target="js")
pub fn dom_decoders() -> EventDecoders {
  {
    mouse_event: e => @vdom.as_dom_event(e).to_mouse_event().unwrap(),
    keyboard_event: e => @vdom.as_dom_event(e).to_keyboard_event().unwrap(),
    focus_event: e => @vdom.as_dom_event(e).to_focus_event().unwrap(),
    drag_event: e => @vdom.as_dom_event(e).to_drag_event().unwrap(),
    clipboard_event: e => @vdom.as_dom_event(e).to_clipboard_event().unwrap(),
    composition_event: e => @vdom.as_dom_event(e).to_composition_event().unwrap(),
    wheel_event: e => @vdom.as_dom_event(e).to_wheel_event().unwrap(),
    ui_event: e => @vdom.as_dom_event(e).to_ui_event().unwrap(),
    input_event: e => @vdom.as_dom_event(e).to_input_event().unwrap(),
    dom_event: e => @vdom.as_dom_event(e),
    mouse: m => mouse_from_dom(m),
    keyboard: k => keyboard_from_dom(k),
    scroll: e => scroll_from_dom(e.target().to_element().unwrap()),
  }
}

///|
/// 全局解码表。后端启动时替换（React 后端见 `moobile/app.mbt`）。
#cfg(target="js")
pub let event_decoders : Ref[EventDecoders] = Ref(dom_decoders())

///|
fn[T, U] cast(v : T) -> U = "%identity"

///|
/// **透传表**：给非 DOM 宿主（React Native）用。
///
/// 前十项一律"把递过来的值当作目标类型"—— 因为 RN 的合成事件不是 DOM 子类型，
/// `to_xxx_event()` 一律返回 `None`，原来的 `unwrap()` 必崩（这是实测过的真 bug）。
///
/// 后三项（`Mouse`/`Keyboard`/`Scroll`，载荷是 rabbita 自己的类型）返回**零值**：
/// 没有 DOM 就拿不到坐标、按键与滚动量。
/// **读取这些值的处理器会拿到 0** —— 这是已知降级，不是等价替换。
/// （设计文档的 R2：要拿到真实手势数据得接 RN 的手势系统。）
///
/// 放在 `html` 里而不是 moobile 里，是因为构造 `Mouse`/`Keyboard`/`Scroll`
/// 与构造结构体字段都需要包内访问权；让本包同时提供两张表代价最小。
pub fn passthrough_decoders() -> EventDecoders {
  {
    mouse_event: e => cast(e),
    keyboard_event: e => cast(e),
    focus_event: e => cast(e),
    drag_event: e => cast(e),
    clipboard_event: e => cast(e),
    composition_event: e => cast(e),
    wheel_event: e => cast(e),
    ui_event: e => cast(e),
    input_event: e => cast(e),
    dom_event: e => cast(e),
    mouse: _ => Mouse::new(
      screen={ x: 0, y: 0 },
      offset={ x: 0, y: 0 },
      client={ x: 0, y: 0 },
    ),
    keyboard: _ =>
      Keyboard::new(
        key="",
        code="",
        alt_key=false,
        ctrl_key=false,
        shift_key=false,
        meta_key=false,
        is_composing=false,
        repeat=false,
        location=0,
      ),
    scroll: _ => Scroll::new(offset={ x: 0, y: 0 }, width=0, height=0),
  }
}
