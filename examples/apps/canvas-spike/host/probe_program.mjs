// probe_program.mjs —— **对账用的镜像程序**：与 MoonBit 侧 `spike.mbt` 的 `probe_into`
// 必须写出逐条相同的东西。
//
// 为什么要有它：契约的两端各有一份实现（MoonBit 的编码器 + 宿主包的解码器/翻译器），
// **两份实现就是等着漂**。这段程序两边各写一遍，然后由 `verify.mjs` 的第 ⑦ 组逐条对账：
// 条数、每条 tag、每个数值（容差 1e-9）、每段字符串，最后**两份载荷各自出图比像素**。
//
// ⚠️ 这个文件与 `spike.mbt` 是**同一条规格的两个实现**，改一边必须改另一边 ——
// 而这句话不靠自觉：哪边改了，第 ⑦ 组就红。

import { OpCtx, annulusSector, ttext } from './compass.mjs';

/** 与 MoonBit 的 `probe_into` 一一对应（顺序、参数、颜色都一致）。 */
export function probeOps() {
  const ctx = new OpCtx();
  const pi = Math.PI;
  // ① 纸底
  ctx.set_fill_style('#f6efe0');
  ctx.fill_rect(0, 0, 200, 200);
  // ② 三个环带扇区（含一个跨过 2π 的）
  annulusSector(ctx, 100, 100, -pi / 2, -pi / 2 + 1, 20, 60, '#fdfaf0');
  annulusSector(ctx, 100, 100, 0.5, 1.6, 60, 90, '#1a1410');
  annulusSector(ctx, 100, 100, 2.5, 2.5 + 4.5, 10, 40, '#fdfaf0');
  // ③ 整圆描边
  ctx.set_stroke_style('#b8902f');
  ctx.set_line_width(2.5);
  ctx.begin_path();
  ctx.arc(100, 100, 92, 0, 2 * pi);
  ctx.stroke();
  // ④ 切向文字
  ttext(ctx, 100, 100, -90, 108, '乾', 14, '#8a2518');
  ttext(ctx, 100, 100, 90, 108, '坤', 14, '#8a2518');
  return ctx.ops;
}
