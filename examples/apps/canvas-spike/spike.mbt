///|
/// canvas 通道的**跨语言对账探针**。
///
/// ## 它回答什么问题
///
/// 契约的两端各有一份实现（MoonBit 的 `canvas/` 包编码 + 宿主包的 `canvas-ops.js` 解码与翻译）。
/// **两份实现就是等着漂** —— 这个仓库为此栽过（见 `tools/check_npm_fresh.mjs` 记的那次事故）。
/// 所以这里放一段**两边都要写的绘制程序**，由 JS 侧逐条对账：
///
///   1. MoonBit 编出来的载荷，宿主包的解码器收不收（形状 + 条数 + 逐条数值）；
///   2. 同一段程序用 JS 的同一批原语画出来，两份载荷**语义相等**；
///   3. 两份载荷各自过翻译器 + **真 Skia** 出图，**像素逐点相同**。
///
/// ## 为什么抄的是 `annulus_sector`
///
/// 它是 yi 罗盘的核心图元（`interest/yi/zhouyi_reader/frontend/colorring.mbt:191`），
/// 也是这套映射里最容易画错的东西：**外弧顺时针、内弧逆时针**，
/// 中间夹两条直线，最后 `close_path` + `fill` + `stroke` 同路径两次绘制。
/// 用玩具图形（一个圆、一个矩形）验不出任何东西 —— 那正是"看着能跑"的来源。
///
/// ## 迁移长什么样（这段代码本身就是证据）
///
/// 原代码（yi）：
/// ```moonbit
/// fn annulus_sector(ctx : @dom.CanvasRenderingContext2D, cx : Double, …) -> Unit
/// ```
/// 这里：
/// ```moonbit
/// fn annulus_sector(ctx : @canvas.OpCtx, cx : Double, …) -> Unit
/// ```
/// **函数体一行没动** —— 方法名、参数顺序、早退条件全都一致。这就是"迁移时视图代码基本不动"。

///|
/// yi 的 `annulus_sector` 逐行照抄（唯一改动是 `ctx` 的类型）。
fn annulus_sector(
  ctx : @canvas.OpCtx,
  cx : Double,
  cy : Double,
  start : Double,
  end : Double,
  r_in : Double,
  r_out : Double,
  color : String,
) -> Unit {
  if r_in >= r_out {
    return
  }
  ctx.begin_path()
  let isx = cx + r_in * @math.cos(start)
  let isy = cy + r_in * @math.sin(start)
  let osx = cx + r_out * @math.cos(start)
  let osy = cy + r_out * @math.sin(start)
  let iex = cx + r_in * @math.cos(end)
  let iey = cy + r_in * @math.sin(end)
  ctx.move_to(isx, isy)
  ctx.line_to(osx, osy)
  ctx.arc(cx, cy, r_out, start, end, anticlockwise=false)
  ctx.line_to(iex, iey)
  ctx.arc(cx, cy, r_in, end, start, anticlockwise=true)
  ctx.close_path()
  ctx.set_fill_style(color)
  ctx.fill()
  ctx.set_stroke_style("rgba(184,144,47,0.28)")
  ctx.set_line_width(0.4)
  ctx.stroke()
}

///|
/// yi 的 `ttext`（切向文字）—— 压 `save/translate/rotate/set_font/fill_text/restore` 这一串。
fn ttext(
  ctx : @canvas.OpCtx,
  cx : Double,
  cy : Double,
  deg : Double,
  r : Double,
  text : String,
  size : Int,
  color : String,
) -> Unit {
  let rad = deg * @math.pi / 180.0
  ctx.save()
  ctx.translate(cx + r * @math.cos(rad), cy + r * @math.sin(rad))
  ctx.rotate(rad + @math.pi / 2.0)
  ctx.set_font("\{size}px 'Kaiti TC','STKaiti',serif")
  ctx.set_fill_style(color)
  // yi 用的是估算宽度（`s.length() * size * 1.02`，自述"无 measure_text"）
  let w = text.length().to_double() * size.to_double() * 1.02
  ctx.fill_text(text, -w / 2.0, 4.0)
  ctx.restore()
}

///|
/// **对账用的那段程序**（JS 侧 `probe_program.mjs` 必须写出逐条相同的东西）。
///
/// 三类都在里面：环带扇区（双向弧 + 同路径 fill/stroke）、整圆（`arc(…,0,2π)` 那条坑）、
/// 切向文字（可变变换状态那一串）。
pub fn probe_payload() -> String {
  let ctx = @canvas.OpCtx::new()
  probe_into(ctx)
  @canvas.ops_to_json(ctx.take())
}

///|
/// 探针产出的 op 条数（JS 侧先对条数，再逐条对数值 —— 条数不对时逐条比较没有意义）。
pub fn probe_ops_count() -> Int {
  let ctx = @canvas.OpCtx::new()
  probe_into(ctx)
  ctx.len()
}

///|
/// 内部：把探针程序写进给定的收集器（`probe_payload` 与 `probe_ops_count` 共用一份定义，
/// 免得"条数"和"载荷"哪天对不上）。
fn probe_into(ctx : @canvas.OpCtx) -> Unit {
  let pi = @math.pi
  ctx.set_fill_style("#f6efe0")
  ctx.fill_rect(0.0, 0.0, 200.0, 200.0)
  annulus_sector(ctx, 100.0, 100.0, -pi / 2.0, -pi / 2.0 + 1.0, 20.0, 60.0, "#fdfaf0")
  annulus_sector(ctx, 100.0, 100.0, 0.5, 1.6, 60.0, 90.0, "#1a1410")
  annulus_sector(ctx, 100.0, 100.0, 2.5, 2.5 + 4.5, 10.0, 40.0, "#fdfaf0")
  ctx.set_stroke_style("#b8902f")
  ctx.set_line_width(2.5)
  ctx.begin_path()
  ctx.arc(100.0, 100.0, 92.0, 0.0, 2.0 * pi)
  ctx.stroke()
  ttext(ctx, 100.0, 100.0, -90.0, 108.0, "乾", 14, "#8a2518")
  ttext(ctx, 100.0, 100.0, 90.0, 108.0, "坤", 14, "#8a2518")
}
