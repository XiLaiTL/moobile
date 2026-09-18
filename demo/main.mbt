///|
/// 惰性持有 `Mount`。
///
/// 为什么不能在模块初始化时构造：`mount` 会立刻求值 duplix 图并排队初始命令，
/// 那时宿主还没把 `MOBILE_HOST`（React、组件表、调度钩子）装上。
/// 所以由 `demo_start()` 显式触发。
priv struct Holder {
  mut m : @moobile.Mount?
}

///|
let g : Holder = { m: None }

///|
/// 挂载 + 同步画出首帧。宿主在设好 `MOBILE_HOST` 之后调用一次。
pub fn demo_start() -> Unit {
  let m = @moobile.mount(initial(), update, view)
  m.start()
  g.m = Some(m)
}

///|
/// 给 `useSyncExternalStore` 的快照。
pub fn demo_snapshot() -> Int {
  match g.m {
    Some(m) => m.snapshot()
    None => 0
  }
}

///|
/// 给 `useSyncExternalStore` 的订阅。返回退订闭包。
pub fn demo_subscribe(f : (Int) -> Unit) -> () -> Unit {
  match g.m {
    Some(m) => m.subscribe(f)
    None => () => ()
  }
}

///|
/// 当前帧的 React 元素（还没画过时是 JS `null`）。
pub fn demo_element() -> @moobile.JsValue {
  match g.m {
    Some(m) => m.element()
    None => @moobile.js_null()
  }
}

///|
/// 不可移植节点（`Children::RawHtml`）的计数。
/// 验证脚本断言它是 0 —— 让"可移植性缺口"变成可测量的东西。
pub fn demo_unsupported() -> Int {
  @moobile.unsupported_count()
}

///|
/// 诊断：标签表**未收录**的标签数。断言为 0 才算标签表覆盖住这棵树。
pub fn demo_unmapped() -> Int {
  @moobile.unmapped_tag_count()
}

///|
/// 诊断：未收录标签的名字（便于修表）。
pub fn demo_unmapped_names() -> String {
  @moobile.unmapped_tag_names()
}
