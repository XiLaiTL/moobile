///|
/// 一帧的产物。
///
/// `pub` 只是为了让 `Mount` 这个公开类型能持有它 —— 它是一个引用类型，
/// 于是 `on_frame` 的闭包可以写进去，而 `Mount` 之后再读出来。
pub struct Frame {
  mut element : JsValue
  store : Store
}

///|
/// 一个已挂载的应用。
///
/// 关键点：**`Cmd` / `Emit` / 订阅 / 异步 effect 全部由 rabbita 自己的运行时执行**
/// （`@runtime.ReactHost` 是 fork 出来的 React 后端），
/// moobile 只负责最后一跳：`VNode` → React 元素。
///
/// 于是 `on_click=emit(Msg)` 这种**原样照抄 yi 的写法**可以直接跑 ——
/// 这正是"渲染可以整体外包"的含义：连抽干循环都留着，只换挂载层。
pub struct Mount {
  host : @runtime.ReactHost
  frame : Frame
}

///|
/// 挂载。签名与 `rabbita.elmish` 对齐，只是 `view` 收 `Emit[Msg]`。
pub fn[Model : Eq, Msg] mount(
  model : Model,
  update : (Model, Msg) -> Model,
  view : (Model, @cmd.Emit[Msg]) -> @html.Html,
) -> Mount {
  // 把"从输入事件里取表单值"的策略换成 React 语义：
  // RN 的 `onChangeText` 直接给文本，没有 DOM 事件对象可解。
  // 换掉这一个函数，`on_input=emit.map(SetDraft)` 就能原样工作。
  @html.form_value_from_event.val = payload_as_string
  // ★ 把**整张事件解码表**换成 React 语义。
  //
  // 原来是只换 mouse 那一处（因为先撞上它）。普查后发现同一形状的 panic
  // 有 13 个（keyboard / focus / drag / clipboard / composition / wheel /
  // input / submit / Mouse / Keyboard / Scroll …），而 yi 的罗盘拖拽
  // 正好踩在里面 —— 所以改成整表替换，一处生效。
  @html.event_decoders.val = @html.passthrough_decoders()
  let frame : Frame = { element: js_null(), store: Store::new() }
  // 用的是 rabbita **官方**的 `create_state_machine` —— 它给出真实的
  // `Emit[Msg]`（`emit(Msg)` 产出真实的 `Cmd`）。moobile 不重写状态机。
  let host = @runtime.ReactHost(
    () => {
      let (model_node, emit) = @runtime.create_state_machine(
        _e => (model, @cmd.none),
        (m, msg, _e) => (update(m, msg), @cmd.none),
      )
      model_node.map(m => view(m, emit).to_virtual_dom())
    },
    js_microtask,
    js_frame,
  )
  // 翻译发生在 `on_frame` 里 —— 它被 `ambient_host.protect` 包着，
  // 而 `VNode::Thunk` 的闭包可能读 duplix 节点，出了作用域再 force 会失效。
  //
  // 关键：把 **host 自己**当作 scheduler 交给处理器。
  // 用任何 stub 都会让 `scheduler.add(cmd)` 静默变成 no-op（踩过）。
  host.on_frame(v => {
    frame.element = render_node(v, host)
    frame.store.bump()
  })
  { host, frame }
}

///|
/// 同步抽干一次并画出首帧。调用后 `element()` 立刻有内容。
pub fn Mount::start(self : Mount) -> Unit {
  self.host.start()
}

///|
/// 给 `useSyncExternalStore` 的快照。
pub fn Mount::snapshot(self : Mount) -> Int {
  self.frame.store.snapshot()
}

///|
/// 给 `useSyncExternalStore` 的订阅。返回退订闭包。
pub fn Mount::subscribe(self : Mount, f : (Int) -> Unit) -> () -> Unit {
  self.frame.store.subscribe(f)
}

///|
/// 当前帧的 React 元素。还没画过时是 JS `null`（React 能直接渲染）。
pub fn Mount::element(self : Mount) -> JsValue {
  self.frame.element
}
