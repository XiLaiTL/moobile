///|
/// 宿主契约版本。
///
/// 宿主（npm 包 `moobile-host`）与库各自声明自己实现的契约版本，宿主在启动时比对，
/// 不等就**直接抛错并同时报出两个版本号** —— 否则"npm 包与 mooncakes 包两条版本线各走各的"
/// 会表现成"某个函数莫名其妙是 undefined"，极难查。**改 `MOBILE_HOST` 的形状时必须 +1。**
///
/// 版本史：
/// - `1` —— 四件套：`react` / `components` / `scheduleTask` / `scheduleFrame`（+ `apiBase` / 能力键）。
/// - `2` —— **组件库接入**：`components` 的键空间允许命名空间名（`antd:Button`），
///   新增可选的 `events`（按标签覆盖事件 prop 名），新增可选的 `wrapRoot`（Provider 包裹）。
///   库侧对应行为：带命名空间的标签**直通**、查不到就点名报错（`render.mbt` / `host.mbt`）。
pub let host_contract_version : Int = 2

///|
/// 把一次挂载打包成**一张句柄表**交给宿主 —— 这是 H2「单导出」的实现（PLAN §3.7）。
///
/// 为什么库能替应用做这件事：**`Mount` 是非泛型的具体类型**，
/// "必须有泛型"的只是构造它的那一刻；构造完就退化成
/// `{contract, start, snapshot, subscribe, element}` 这张表。
/// 于是应用侧的导出名从 4 个降到 1 个，宿主也不必知道 `Model` / `Msg` 是什么。
pub fn Mount::handles(self : Mount) -> JsValue {
  let o = js_obj_new()
  js_obj_set(o, "contract", js_int(host_contract_version))
  js_obj_set(o, "start", js_closure0(() => self.start()))
  js_obj_set(o, "snapshot", js_closure_int(() => self.snapshot()))
  js_obj_set(o, "subscribe", js_closure_sub(f => self.subscribe(f)))
  js_obj_set(o, "element", js_closure_value(() => self.element()))
  // 诊断（只给验证脚本用；把"可移植性缺口"变成可测量的数字）：
  // `unsupported` = 不可移植节点数（应当是 0），
  // `unmapped` / `unmapped_names` = 标签表没收录的标签。
  js_obj_set(o, "unsupported", js_closure_int(() => unsupported_count()))
  js_obj_set(o, "unmapped", js_closure_int(() => unmapped_tag_count()))
  js_obj_set(o, "unmapped_names", js_closure_string(() => unmapped_tag_names()))
  o
}

///|
/// 挂载并直接交出句柄表（应用侧的推荐入口）。
///
/// 应用只需要一个导出：
/// ```moonbit
/// pub fn app() -> @moobile.JsValue { @moobile.handlers(model=initial(), update~, view~) }
/// ```
pub fn[Model : Eq, Msg] handlers(
  model~ : Model,
  update~ : (Model, Msg, @cmd.Emit[Msg]) -> (Model, @cmd.Cmd),
  view~ : (Model, @cmd.Emit[Msg]) -> @html.Html,
  subscriptions? : (Model, @cmd.Emit[Msg]) -> @sub.Sub,
) -> JsValue {
  mount(model~, update~, view~, subscriptions?).handles()
}

///|
/// 带**初始命令**的单导出入口（清单类应用多半要这个：首帧之前先读本地库）。
pub fn[Model : Eq, Msg] handlers_with_init(
  init~ : (@cmd.Emit[Msg]) -> (Model, @cmd.Cmd),
  update~ : (Model, Msg, @cmd.Emit[Msg]) -> (Model, @cmd.Cmd),
  view~ : (Model, @cmd.Emit[Msg]) -> @html.Html,
  subscriptions? : (Model, @cmd.Emit[Msg]) -> @sub.Sub,
) -> JsValue {
  mount_with_init(init~, update~, view~, subscriptions?).handles()
}

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
/// 挂载（无初始命令）。
///
/// **签名与上游 `rabbita.elmish` 对齐**（见 `internal/rabbita/top.mbt`）：
/// - `update` 返回 `(Model, Cmd)` —— "改状态顺便干件事"（读本地库、发请求）可以直接写在 update 里；
/// - `subscriptions?` 透传给运行时 —— 持续数据流（传感器、网络状态、返回键）能挂上来。
///
/// 这两条在 0.1.0 里是**缺的**（`update` 只能返回 `Model`，且没有 `subscriptions`），
/// 0.2.0 补上。缺口的代价很具体：`update` 里发起不了副作用、持续型原生能力一个都接不上
/// —— 见 `PLAN.md` §3.6（N1）。
pub fn[Model : Eq, Msg] mount(
  model~ : Model,
  update~ : (Model, Msg, @cmd.Emit[Msg]) -> (Model, @cmd.Cmd),
  view~ : (Model, @cmd.Emit[Msg]) -> @html.Html,
  subscriptions? : (Model, @cmd.Emit[Msg]) -> @sub.Sub,
) -> Mount {
  mount_impl(_ => (model, @cmd.none), update, view, subscriptions?)
}

///|
/// 挂载（初始就带命令）。
///
/// 对齐上游 `create_state_with_init`：**首帧之前**要做的事（例如"从本地数据库读上一次的清单"）
/// 写在这里，而不是塞进 `view`，也不是塞进模块初始化（那时宿主还没装好 `MOBILE_HOST`）。
pub fn[Model : Eq, Msg] mount_with_init(
  init~ : (@cmd.Emit[Msg]) -> (Model, @cmd.Cmd),
  update~ : (Model, Msg, @cmd.Emit[Msg]) -> (Model, @cmd.Cmd),
  view~ : (Model, @cmd.Emit[Msg]) -> @html.Html,
  subscriptions? : (Model, @cmd.Emit[Msg]) -> @sub.Sub,
) -> Mount {
  mount_impl(init, update, view, subscriptions?)
}

///|
/// 两个入口的公共实现（`mount` / `mount_with_init` 只差 init 的形状）。
fn[Model : Eq, Msg] mount_impl(
  init : (@cmd.Emit[Msg]) -> (Model, @cmd.Cmd),
  update : (Model, Msg, @cmd.Emit[Msg]) -> (Model, @cmd.Cmd),
  view : (Model, @cmd.Emit[Msg]) -> @html.Html,
  subscriptions? : (Model, @cmd.Emit[Msg]) -> @sub.Sub,
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
  //
  // `init` / `update` / `subscriptions` 直接交给它：**命令与订阅都在运行时里跑**，
  // 我们只换最后一跳（VNode → React 元素）。
  let host = @runtime.ReactHost(
    () => {
      let (model_node, emit) = @runtime.create_state_machine(
        init,
        update,
        subscriptions?,
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
