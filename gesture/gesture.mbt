///|
/// 手势通道 —— 给**任意元素**加手势，应用不需要知道底下是什么实现。
///
/// ## 它解决什么问题
///
/// `PLAN.md` §7 的决策点 19。事实是三个（都实测过）：
///
/// 1. **读坐标的处理器在 RN 上拿到的是 0**：`app.mbt` 的 `mount_impl` 会把整张事件解码表
///    换成 `passthrough_decoders()`，而它给 `Mouse`/`Keyboard`/`Scroll` **无条件返回零值**
///    （`vendor/rabbita/html/event_decoders.mbt` 自己写着"已知降级，不是等价替换"）。
///    ⚠️ 这比"RN 上不行"更宽：**连 react-native-web 的 Web 宿主也一样是 0**。
/// 2. `render.mbt` 把 `mousedown` 映射成 `onMouseDown`（**DOM 的 prop 名**），
///    RN 的原生 View 不认 → **静默无效**。
/// 3. `examples/apps/gesture-spike/` 实测：`PanResponder`（RN 内置、**零新依赖**）与
///    `react-native-gesture-handler` 在 **RNW(web) 宿主**上都能给出**元素内坐标**且位置精确跟手；
///    差别是 RNGH 的 `translationX` **不是"按下即起算"**（默认有激活阈值，实测偏 20px）。
///
/// ## 契约（这一段是设计，不是实现细节）
///
/// | 字段 | 语义 |
/// |---|---|
/// | `x` / `y` | **元素内坐标**（与 DOM 的 `offsetX/offsetY` 同义） |
/// | `dx` / `dy` | **从按下那一刻起算**的位移 —— **由宿主算**，不是某个库的 `translationX` |
/// | `abs_x` / `abs_y` | 屏幕坐标 |
/// | `phase` | `start` / `move` / `end` / `cancel` |
/// | `pointers` | 参与的手指数（v1 恒为 1；为多指留位） |
///
/// **`dx`/`dy` 必须由宿主算**这条是刻意的：换成 RNGH 时它的 `translationX` 语义不同
/// （激活阈值），若把它原样漏给应用，罗盘那类"按下即转"的交互会**起步少一截**。
/// 应用读的是我们的契约，**换实现不动应用代码**。
///
/// ## 用法（挂在任意元素上，与内置标签手感一致）
///
/// ```moonbit
/// @html.div(
///   attrs=@gesture.attrs(on_pan=e => emit(Drag(e.dx, e.dy))),
///   children)
///
/// // 元素已经有别的 attrs 时，用合并式：
/// @html.div(
///   attrs=@gesture.pan(@html.Attrs::build().styles(my_style), e => emit(Drag(e.dx, e.dy))),
///   children)
/// ```
///
/// ## 谁实现（宿主侧，零配置）
///
/// `moobile-host` 的 RN 预设**默认**把 5 个内置组件包成"手势可用"的版本
/// （`gesture-rn.js`，`PanResponder` 实现，**不引入新依赖**）。所以应用**什么都不用装**。
/// 要换更强的手势实现（多指 / pinch / RNGH），换宿主那一层即可 —— 契约不变。
///
/// ⚠️ **失败要响**：宿主没装手势支持时，这些 prop 会被**原样传给 RN 组件**，
/// RN 会因为未知 prop 而静默忽略 —— 所以 `gesture-rn.js` 的包装是 `installHost` 的一部分，
/// 而不是"应用可选装"。文档与模板里给了例子（见 `PLAN.md` §7-19 的库优先判据）。

///|
/// 手势的阶段。
///
/// ⚠️ `pub(all)` 不是随手加的：**应用要能写 `phase == Move`**（比如"只在 move 阶段改角度"），
/// 而 MoonBit 里外部包**构造**不了非 `pub(all)` 枚举的变体 —— 报错是
/// `Cannot create values of the read-only type: Move`（实测：示例应用第一次就撞上）。
/// 这条与 `docs/FINDINGS.md` R7 记的"转发来的 struct 构造不了"是同一类边界的另一面。
pub(all) enum Phase {
  Start
  Move
  End
  Cancel
} derive(Debug, Eq)

///|
/// 一次手势事件。字段语义见文件头那张表 —— **别把它当成某个库的事件对象**。
pub struct Gesture {
  x : Double
  y : Double
  dx : Double
  dy : Double
  abs_x : Double
  abs_y : Double
  phase : Phase
  pointers : Int
} derive(Debug, Eq)

///|
/// 从宿主递来的载荷里读出一次手势。
///
/// ⚠️ 两个取舍：
/// - **读不到就给 0 / `Start`**（跟随 `Payload` 提取器"永不抛错"的既有约定）——
///   形状对不上时把界面崩掉，等于把"宿主版本不匹配"变成白屏。
/// - **`phase` 认不出来时退 `Cancel`** 而不是 `End`：宁可让应用当作"这次不算"，
///   也不要让它把一次没走完的手势当成完成（后者会写错状态）。
pub fn Gesture::of(payload : @html.Payload) -> Gesture {
  {
    x: payload.field("x").num(),
    y: payload.field("y").num(),
    dx: payload.field("dx").num(),
    dy: payload.field("dy").num(),
    abs_x: payload.field("ax").num(),
    abs_y: payload.field("ay").num(),
    phase: phase_of(payload.field("phase").text()),
    pointers: payload.field("pointers").num().to_int(),
  }
}

///|
fn phase_of(s : String) -> Phase {
  match s {
    "start" => Start
    "move" => Move
    "end" => End
    _ => Cancel
  }
}

///|
/// 事件键 —— 由 `render.mbt` 的 `map_event` 兜底成 camelCase（`pan` → `onPan`）。
/// 宿主侧认的就是这两个 prop 名（见 `npm/moobile-host/gesture-rn.js`）。
pub let pan_event : String = "pan"

///|
pub let tap_event : String = "tap"

///|
/// 造一份只有手势的 `attrs`（元素不需要别的属性时用它）。
///
/// ⚠️ 两个形态**都给 `Gesture`，不给原始 `Payload`** —— 曾经这里是 `(Payload) -> Cmd`，
/// 与下面的合并式 `pan()`/`tap()` 不一致，于是同一个概念在两处长得不同（示例应用一写就撞上）。
/// 内部细节（载荷字段名）不该漏给应用：那是**宿主与库之间**的约定。
pub fn attrs(
  on_pan? : (Gesture) -> @cmd.Cmd,
  on_tap? : (Gesture) -> @cmd.Cmd,
) -> @html.Attrs {
  let a = @html.Attrs::build()
  let a = match on_pan {
    Some(f) => a.on_raw(pan_event, p => f(Gesture::of(p)))
    None => a
  }
  match on_tap {
    Some(f) => a.on_raw(tap_event, p => f(Gesture::of(p)))
    None => a
  }
}

///|
/// 合并式：给**已有 attrs** 的元素加拖动。
///
/// ⚠️ 这里**不能**写成 `Attrs::pan` 那种方法：`Attrs` 是 vendor 包里的类型，
/// MoonBit 不允许给外部类型定义方法（实测报 `Cannot define method pan for foreign type`）。
/// 所以这里是普通函数、首参收 attrs —— 用法 `@gesture.pan(attrs, handler)`。
pub fn pan(a : @html.Attrs, msg : (Gesture) -> @cmd.Cmd) -> @html.Attrs {
  a.on_raw(pan_event, p => msg(Gesture::of(p)))
}

///|
/// 合并式：给已有 attrs 的元素加点按。
///
/// ⚠️ 与内置的 `on_click` 不是一回事：`on_click` 在 RN 上落 `onPress`（`Pressable` 才有），
/// 而这条**任意组件都能用**（宿主用 responder 实现）。两个都给时，点按会**各触发一次** ——
/// 别在同一个元素上同时挂（设计意图是二选一）。
pub fn tap(a : @html.Attrs, msg : (Gesture) -> @cmd.Cmd) -> @html.Attrs {
  a.on_raw(tap_event, p => msg(Gesture::of(p)))
}
