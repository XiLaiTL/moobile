///|
/// ★ moobile 扩展：把 rabbita 运行时的**渲染后端**从 DOM 换成 React。
///
/// 与 `BrowserHost` 的差别只有两处，而且都不是"重写运行时"：
///
/// 1. `request_frame` 不再 `document.update(vnode)`，而是把当前 `VNode`
///    交给 `frame` 回调 —— moobile 在那里翻译成 React 元素。
/// 2. 挂 microtask / frame 的调度方式由外部注入
///    （React Native 里没有 `window`，更没有 `requestAnimationFrame`）。
///
/// 命令队列、微任务抽干、`handle_message`、`SlotMap` stores、duplix scope
/// **全部照搬** —— 因为它们本来就与 DOM 无关。
///
/// 这条正是 DESIGN 的「渲染可以整体外包」：连 rabbita 自己的抽干循环都能留着，
/// 只把最后一跳换掉。接上它之后，`on_click=emit(Msg)` 这种视图代码就能直接跑了。
pub struct ReactHost {
  after_render_queue : Queue[() -> Cmd]
  task_queue : Queue[(@cmd.Op, @cmd.Extension)]
  stores : @slotmap.SlotMap[Store]
  scope : @duplix.ScopeId
  mut graph_output : @duplix.Node[VNode]?
  mut drain_scheduled : Bool
  mut paint_scheduled : Bool
  mut url_request : @cmd.Injector[String]
  mut url_changed : @cmd.Injector[String]
  mut frame : (VNode) -> Unit
  schedule_task : (() -> Unit) -> Unit
  schedule_frame : (() -> Unit) -> Unit
  origin : String
}

///|
pub fn ReactHost::ReactHost(
  builder : GraphBuilder,
  schedule_task : (() -> Unit) -> Unit,
  schedule_frame : (() -> Unit) -> Unit,
  origin? : String = "",
) -> Self {
  let (host, output) = @duplix.with_scope(scope => {
    let host : ReactHost = {
      stores: SlotMap(),
      scope,
      task_queue: Queue([]),
      graph_output: None,
      url_request: _ => @cmd.none,
      url_changed: _ => @cmd.none,
      paint_scheduled: false,
      drain_scheduled: false,
      frame: _ => (),
      schedule_task,
      schedule_frame,
      origin,
      after_render_queue: Queue([]),
    }
    (host, ambient_host.protect(host, builder))
  })
  host.graph_output = Some(output)
  host
}

///|
/// 注册"每次重绘把当前 VNode 交给宿主"的回调。
///
/// **翻译要在回调里做**：它被 `ambient_host.protect` 包着，
/// 而 `VNode::Thunk` 的闭包可能读 duplix 节点 —— 出了作用域再 force 会失效。
pub fn ReactHost::on_frame(self : Self, f : (VNode) -> Unit) -> Unit {
  self.frame = f
}

///|
/// 同步抽干一次命令队列并**同步**画出首帧。
///
/// 为什么需要它：`Host::flush` 走的是 microtask，而首帧还要再等一个
/// animation frame —— React 的首渲染会先看到空，然后闪一下。
/// 同步跑一次，`element()` 立刻就有内容。
pub fn ReactHost::start(self : Self) -> Unit {
  self.drain()
  self.paint()
}

///|
/// 诊断计数器：把"命令有没有真的被执行"变成可读数字。
///
/// 起因是一个**静默失败**：处理器拿到的是 stub Scheduler 而不是真 host，
/// 于是 `scheduler.add(cmd)` 变成 no-op —— 界面照常渲染、点击不报错、
/// 状态永远不变。没有这两个数字，这个问题只能靠猜。
priv struct Counters {
  mut ops : Int
  mut messages : Int
}

///|
let g_counters : Counters = { ops: 0, messages: 0 }

///|
pub fn react_op_count() -> Int {
  g_counters.ops
}

///|
/// 被派发到 store 的消息数（即 `on_update` 实际跑过几次）。
pub fn react_message_count() -> Int {
  g_counters.messages
}

///|
fn ReactHost::drain(self : Self) -> Unit {
  while self.task_queue.pop() is Some((op, extension)) {
    g_counters.ops = g_counters.ops + 1
    if handle_message(self, extension) {
      g_counters.messages = g_counters.messages + 1
      continue
    }
    try @cmd.invoke(@key.key, op, extension, self) catch {
      Unhandled => ()
    } noraise {
      None => ()
      Ready(cmd) => Scheduler::queue_command(self, cmd)
      Async(f) =>
        @js_async.Promise::from_async(() => {
          Scheduler::queue_command(self, f())
        })
        |> ignore
      AfterLayout(f) => self.after_render_queue.push(f)
      LegacyEffect(Immediately, f) => f(self)
      LegacyEffect(AfterRender, f) =>
        self.after_render_queue.push(() => {
          f(self)
          @cmd.none
        })
    }
  }
  self.drain_scheduled = false
  self.request_frame()
}

///|
fn ReactHost::request_task(self : Self) -> Unit {
  guard !self.drain_scheduled else { return }
  self.drain_scheduled = true
  (self.schedule_task)(() => self.drain())
}

///|
/// 画一帧：求值 duplix 图 → 交给 `frame` 回调翻译 → 跑 after-render 队列。
///
/// 求值**和**翻译都必须留在 `ambient_host.protect` 作用域内：
/// `VNode::Thunk` 的闭包会去读 duplix 节点，出了作用域再 force 会失效。
fn ReactHost::paint(self : Self) -> Unit {
  if self.graph_output is Some(output) {
    ambient_host.protect(self, () => {
      (self.frame)(output.read())
    })
  }
  while self.after_render_queue.pop() is Some(f) {
    let cmd = f()
    Scheduler::queue_command(self, cmd)
  }
}

///|
fn ReactHost::request_frame(self : Self) -> Unit {
  guard !self.paint_scheduled else { return }
  self.paint_scheduled = true
  (self.schedule_frame)(() => {
    self.paint_scheduled = false
    self.paint()
  })
}

///|
pub impl Host for ReactHost with fn flush(self) {
  self.request_task()
}

///|
pub impl Host for ReactHost with fn get_stores(self) {
  self.stores
}

///|
pub impl Host for ReactHost with fn cleanup(self) {
  self.scope.cleanup()
}

///|
pub impl Scheduler for ReactHost with fn queue_command(self, cmd) {
  let tasks = @cmd.flatten(@key.key, cmd)
  for task in tasks {
    self.task_queue.push(task)
  }
  self.request_task()
}

///|
pub impl Scheduler for ReactHost with fn set_url_changed_injector(
  self,
  injector,
) {
  self.url_changed = injector
}

///|
pub impl Scheduler for ReactHost with fn set_url_request_injector(
  self,
  injector,
) {
  self.url_request = injector
}

///|
pub impl Context for ReactHost with fn get_origin(self) {
  self.origin
}

///|
pub impl Context for ReactHost with fn inject_url_changed(self, url) {
  (self.url_changed)(url)
}

///|
pub impl Context for ReactHost with fn inject_url_request(self, url) {
  (self.url_request)(url)
}
