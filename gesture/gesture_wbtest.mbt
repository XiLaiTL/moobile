///|
/// `gesture` 包的白盒测试。
///
/// ⚠️ **这个文件刻意只覆盖"纯逻辑"那部分**，因为另一半（`Gesture::of` 从宿主载荷里读字段）
/// 需要**真的载荷对象** —— 而 `Payload` 是 JS FFI 类型，`moon test` 里没有宿主可问。
/// 那半条由**试金石**覆盖：
///
/// - 宿主侧：`examples/apps/gesture-spike/` 第 ④ 节（真 Chrome 真拖，按契约逐条断言
///   `x/y` 元素内、`dx/dy` 从按下起算、`phase` 有始有终、点按阈值）；
/// - 端到端（MoonBit 读载荷 → `Msg`）：见 `examples/apps/canvas-demo/` 的验证。
///
/// 换句话说：**这里测"我们自己的映射表"，那里测"两边合起来对不对"**。

///|
test "phase 映射：四个合法值 + 认不出来退 Cancel 而不是 End" {
  assert_eq(phase_of("start"), Start)
  assert_eq(phase_of("move"), Move)
  assert_eq(phase_of("end"), End)
  assert_eq(phase_of("cancel"), Cancel)
  // ⚠️ 这条是**取舍**不是随手写的默认值：认不出来时退 `Cancel`，
  // 应用会把这次当作"不算完成"；若退 `End`，一次没走完的手势会被当成完成，写错状态。
  assert_eq(phase_of(""), Cancel)
  assert_eq(phase_of("END"), Cancel) // 大小写敏感：契约里是小写
  assert_eq(phase_of("whatever"), Cancel)
}

///|
/// 事件键必须与宿主认的 prop 名对得上：`render.mbt` 的 `map_event` 把 `pan`/`tap`
/// 兜底成 camelCase（`onPan` / `onTap`），而 `gesture-rn.js` 认的就是这两个名字。
/// 改这里就必须同时改那边 —— 这条测试是那条隐形约定的**锚点**。
test "事件键：pan / tap（宿主会兜底成 onPan / onTap）" {
  assert_eq(pan_event, "pan")
  assert_eq(tap_event, "tap")
}

///|
/// `Gesture` 的字段语义是**契约**（见文件头那张表）。
/// 这里锁住的是"我们承诺了哪些字段"—— 少一个字段，应用就读不到（而 `Payload` 提取器
/// **永不抛错**，所以少字段的表现是**静默给 0**，正是这一整套要消灭的东西）。
test "Gesture 的字段面：契约里承诺的八个字段一个不少" {
  let g : Gesture = {
    x: 1.0,
    y: 2.0,
    dx: 3.0,
    dy: 4.0,
    abs_x: 5.0,
    abs_y: 6.0,
    phase: Start,
    pointers: 1,
  }
  assert_eq(g.x, 1.0)
  assert_eq(g.y, 2.0)
  assert_eq(g.dx, 3.0)
  assert_eq(g.dy, 4.0)
  assert_eq(g.abs_x, 5.0)
  assert_eq(g.abs_y, 6.0)
  assert_eq(g.phase, Start)
  assert_eq(g.pointers, 1)
}
