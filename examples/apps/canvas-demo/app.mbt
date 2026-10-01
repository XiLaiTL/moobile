///|
/// # canvas-demo —— 画布通道 + 手势通道的示例
///
/// 两件事在这一个文件里闭环：
///
/// ```
/// 手指拖动（手势通道）→ Msg → Model.angle → view 算出新的绘制指令（画布通道）→ Skia 重画
/// ```
///
/// 为什么把示例单独立起来（而不是继续拿别的 demo 做实验）：
/// 画布是**可选特性**（要原生依赖、要 prebuild），而 `examples/apps/todo-app` 与
/// `examples/apps/template` 是 **T1 锁步**的一对（模板是真源、demo 是它的产物）——
/// 往 demo 里塞可选特性会直接把 T1 门弄红，而模板是**每个使用者拿到的东西**，
/// 不该背这个依赖。所以可选特性各自有自己的示例（先例：`examples/apps/antd-demo`）。
///
/// 这个工程本身是 `npx moobile-host init` 生成的（脚手架真源是 `examples/apps/template`）；
/// 宿主侧的两条通道里，**手势是默认装好的**（`PanResponder`，零依赖），
/// **画布要显式注册**（`registerSkiaCanvas` —— Skia 是应用自己的依赖，宿主包不替你装）。

///|
/// 应用状态。**纯数据** —— 它不知道画布是谁画的、手势是谁给的。
struct Model {
  /// 指针角度（弧度）。拖动累加、点按归零 —— 只为让"手势 → Model → 画布"这条线看得见。
  angle : Double
  /// 最近一次拖动的位移（显示在界面上，供真机断言读）。
  dx : Double
  dy : Double
  /// 收到过几次拖动 / 几次点按（真机断言的稳定 token）。
  moves : Int
  taps : Int
} derive(Eq)

///|
/// 用户动作。每个 `Msg` 在 `update` 里都有一条分发臂，没有默认分支。
pub enum Msg {
  /// 拖动中的一步（位移 + 阶段）。只有 `move` 会改角度。
  Drag(Double, Double, @gesture.Phase)
  /// 点按：把角度归零（"回正"）。
  Tap
}

///|
fn initial() -> Model {
  { angle: 0.0, dx: 0.0, dy: 0.0, moves: 0, taps: 0 }
}

///|
fn update(model : Model, msg : Msg, _emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  match msg {
    Drag(dx, dy, phase) =>
      // 只在 `move` 阶段改角度：`start`/`end` 带的位移是 0 或与最后一步重复的值，
      // 都算进去会让角度在同一帧里加两次（真机上表现为"拖一下转两倍"）。
      if phase == Move {
        ({ ..model, angle: model.angle + dx * 0.02, dx, dy, moves: model.moves + 1 }, @cmd.none)
      } else {
        ({ ..model, dx, dy }, @cmd.none)
      }
    Tap => ({ ..model, angle: 0.0, taps: model.taps + 1 }, @cmd.none)
  }
}

///|
/// 画布边长（正方形）。宿主用它定 Skia `<Canvas>` 的样式 —— 两处必须是同一个值。
let canvas_size : Double = 200.0

///|
/// 圆心 / 半径。
let cx : Double = 100.0

///|
let cy : Double = 100.0

///|
let r_ring : Double = 70.0

///|
/// **按 Model 算出绘制指令**（纯函数：同样输入必得同样指令）。
///
/// 三个颜色是**刻意挑的**：它们在这张界面上别处一个都没用到 —— 于是"截图里有没有这些颜色"
/// 就是"Skia 有没有真的画"的判据（而不是"组件挂上了没有"）。
/// 其中**蓝点会随 `angle` 移动**，所以"拖动之后它动没动"这一条判据同时压住了
/// **手势 → Model → 画布** 整条链（见 `verify.mjs` / `device_check.mjs`）。
fn dial_ops(model : Model) -> Array[@canvas.DrawOp] {
  let ctx = @canvas.OpCtx::new()
  // 纸底
  ctx.set_fill_style("#f6efe0")
  ctx.fill_rect(0.0, 0.0, canvas_size, canvas_size)
  // 品红圆环（整圆 —— 顺带压住"整圆要拆两段 SVG 弧"那条坑）
  ctx.set_stroke_style("#ff00aa")
  ctx.set_line_width(10.0)
  ctx.begin_path()
  ctx.arc(cx, cy, r_ring, 0.0, 6.283185307179586)
  ctx.stroke()
  // 绿色方块（固定位置：证明"画布确实在画"，与角度无关）
  ctx.set_fill_style("#00aa66")
  ctx.fill_rect(16.0, 16.0, 18.0, 18.0)
  // 蓝色指针（位置随 angle 走）
  let px = cx + r_ring * @math.cos(model.angle)
  let py = cy + r_ring * @math.sin(model.angle)
  ctx.set_fill_style("#0044ff")
  ctx.begin_path()
  ctx.arc(px, py, 12.0, 0.0, 6.283185307179586)
  ctx.fill()
  ctx.take()
}

///|
fn attrs(s : @style.Style) -> @html.Attrs {
  @html.Attrs::build().styles(s)
}

///|
/// 界面。三块：画布 / 拖动区 / 诊断 token。
fn view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  let ops = dial_ops(model)
  let n_ops = ops.length()
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex(1.0)
      .background_color("#f6efe0")
      .align_items(@style.Align::Center)
      .padding(@style.px(12.0)),
    ),
    [
      @html.h1(
        attrs=attrs(@style.Style::new().font_size(20.0).color("#1a1410")),
        "canvas-demo",
      ),
      // ① 画布：走**组件通道**（`moobile:Canvas` + JSON 载荷），宿主把它接到 Skia 上
      @canvas.canvas(ops, canvas_size, canvas_size),
      @html.span(
        attrs=attrs(@style.Style::new().font_size(11.0).color("#7a6851")),
        "画布 ops=\{n_ops} 边长 \{canvas_size.to_int()}",
      ),
      // ② 拖动区：走**手势通道**。里面那行 token 是真机脚本的抓手 ——
      //    `uiautomator` 读它的 bounds 就知道"该往哪儿滑"，不用猜坐标。
      @html.div(
        attrs=@gesture.attrs(
          on_pan=p => emit(Drag(p.dx, p.dy, p.phase)),
          on_tap=_ => emit(Tap),
        ).styles(
          @style.Style::new()
          .margin_top(@style.px(12.0))
          .width(@style.px(280.0))
          .height(@style.px(120.0))
          .background_color("#2f7d5f")
          .border_radius(12.0)
          .align_items(@style.Align::Center)
          .justify_content(@style.Justify::Center),
        ),
        [
          @html.span(
            attrs=attrs(@style.Style::new().font_size(13.0).color("#ffffff")),
            "拖动区 · dx=\{model.dx.to_int()} dy=\{model.dy.to_int()} n=\{model.moves}",
          ),
        ],
      ),
      // ③ 诊断 token：真机断言读的就是这一行
      @html.span(
        attrs=attrs(
          @style.Style::new().font_size(12.0).color("#8a2518").margin_top(@style.px(8.0)),
        ),
        "角度 \{model.angle.to_int()}#\{model.moves} · 点按 \{model.taps}",
      ),
    ],
  )
}

///|
/// **应用交给宿主的全部东西：一行。**
///
/// ⚠️ 导出名 `app` 必须与 `moon.pkg` 里 `link.exports` 和 `App.js` 的 import 一致。
/// 这个示例没有订阅，所以不给 `subscriptions?`。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~)
}
