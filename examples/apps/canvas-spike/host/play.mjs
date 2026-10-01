// play.mjs —— 把 Skia 元素树**真的画出来**（CanvasKit = Skia 编译成 WASM 的版本）。
//
// ## 为什么这一步必须存在
//
// 只断言"元素树形状对不对"证明不了"画出来对不对"：形状对了而坐标错、
// 弧的方向反了、paint 用错，stub 一条都抓不住。所以这里用**真 Skia**回放，
// 再把像素读回来做断言。
//
// ## 它和 `@shopify/react-native-skia` 是什么关系
//
// 同一个引擎：RN Skia 的依赖里就写着 `canvaskit-wasm@0.41.0`（实测 `npm view`）。
// 所以"在 CanvasKit 上画对"与"在 RN 上画对"共享同一套 path / paint / transform 语义；
// **不共享的部分**是 React 那一层（组件挂载、reconciler）——那部分由 `verify.mjs` 的
// 形状断言 + 将来的真机截图负责，本文件不假装覆盖它。
//
// ## 字体是**尽力而为**，且刻意与几何断言解耦
//
// CanvasKit 是 wasm，没有系统字体管理器，中文标签要自带字体文件才画得出。
// 所以：找得到本机字体就画（并报告），找不到就跳过文字、**记为 SKIP 并说清**——
// 不是"通过"。几何断言采样的点全部在 r ≤ 300 的环带内，而标签在 r ≥ 314，
// 两者不重叠，所以文字是否渲染**不影响**几何判据。

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** CanvasKit 的字体候选：**本机有什么用什么**，没有就 SKIP（见文件头）。
 *  ⚠️ Windows 那一档从 `WINDIR` 拼，**不写盘符字面量** —— 这个仓库有一条门
 *  （`tools/check_public_leaks.py`）专门挡"本机绝对路径"，写死就等于给它送素材。 */
const WIN_FONTS = process.env.WINDIR ? path.join(process.env.WINDIR, 'Fonts') : null;
const FONT_CANDIDATES = [
  process.env.SPIKE_FONT,
  WIN_FONTS && path.join(WIN_FONTS, 'msyh.ttc'),
  WIN_FONTS && path.join(WIN_FONTS, 'simsun.ttc'),
  WIN_FONTS && path.join(WIN_FONTS, 'msyhl.ttc'),
  WIN_FONTS && path.join(WIN_FONTS, 'simhei.ttf'),
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  '/System/Library/Fonts/PingFang.ttc',
].filter(Boolean);

export async function loadCanvasKit() {
  const init = require('canvaskit-wasm');
  const dir = path.dirname(require.resolve('canvaskit-wasm/bin/canvaskit.js'));
  return await init({ locateFile: (f) => path.join(dir, f) });
}

/** CSS 颜色 → CanvasKit Color（走它自己的解析器，rgba()/十六进制都认）。 */
export function cssColor(ck, s) {
  const c = ck.parseColorString(String(s));
  if (!c) throw new Error(`play: 解析不了颜色 \`${s}\``);
  return c;
}

/** 类名不存在时**当场报**，不静默画成黑的。 */
function makePaint(ck, { color, style, strokeWidth }) {
  const p = new ck.Paint();
  p.setAntiAlias(true);
  p.setColor(cssColor(ck, color));
  p.setStyle(style === 'stroke' ? ck.PaintStyle.Stroke : ck.PaintStyle.Fill);
  if (style === 'stroke') p.setStrokeWidth(strokeWidth ?? 1);
  return p;
}

function applyTransform(canvas, transform) {
  for (const t of transform || []) {
    if (t.translateX !== undefined) canvas.translate(t.translateX, t.translateY || 0);
    else if (t.rotate !== undefined) canvas.rotate(t.rotate, 0, 0);
    else if (t.scaleX !== undefined) canvas.scale(t.scaleX, t.scaleY ?? t.scaleX);
    else throw new Error(`play: 不认识的 transform 项 ${JSON.stringify(t)}`);
  }
}

/**
 * 回放一棵 Skia 元素树到 CanvasKit surface。
 *
 * @returns {{surface:any, canvas:any, stats:{drawn:number, byType:Record<string,number>, skipped:Record<string,number>}, fonts:any}}
 */
export function replay(ck, tree, opts = {}) {
  const { width, height } = tree.props.style;
  const surface = ck.MakeSurface(width, height);
  if (!surface) throw new Error('play: 拿不到 surface（这个 CanvasKit 构建没有软件光栅？）');
  const canvas = surface.getCanvas();

  // 纸底：CanvasKit 的 surface 默认透明，先铺一层白，避免"透明当成颜色"读错
  const bg = new ck.Paint();
  bg.setColor(ck.WHITE);
  canvas.drawRect(ck.LTRBRect(0, 0, width, height), bg);

  const stats = { drawn: 0, byType: {}, skipped: {} };
  const bump = (o, k) => (o[k] = (o[k] || 0) + 1);
  const bumpSkip = (k) => bump(stats.skipped, k);

  const typeface = opts.typeface || null;

  const drawNode = (node) => {
    const p = node.props || {};
    canvas.save();
    applyTransform(canvas, p.transform);
    switch (node.type) {
      case 'Path': {
        const pa = ck.Path.MakeFromSVGString(p.path);
        if (!pa) throw new Error(`play: SVG path 字符串解析失败（这说明桥产出的 d 不是合法 SVG）：${String(p.path).slice(0, 80)}…`);
        canvas.drawPath(pa, makePaint(ck, p));
        pa.delete();
        bump(stats.byType, 'Path');
        stats.drawn++;
        break;
      }
      case 'Rect': {
        const pa = makePaint(ck, { color: p.color, style: 'fill' });
        canvas.drawRect(ck.LTRBRect(p.x, p.y, p.x + p.width, p.y + p.height), pa);
        bump(stats.byType, 'Rect');
        stats.drawn++;
        break;
      }
      case 'Text': {
        if (!typeface) {
          bumpSkip('Text（本机没有可用中文字体）');
          break;
        }
        const font = new ck.Font(typeface, p.font?.size ?? 10);
        const paint = new ck.Paint();
        paint.setAntiAlias(true);
        paint.setColor(cssColor(ck, p.color));
        canvas.drawText(String(p.text), p.x, p.y, paint, font);
        bump(stats.byType, 'Text');
        stats.drawn++;
        break;
      }
      default:
        throw new Error(`play: 不认识的元素类型 \`${node.type}\``);
    }
    canvas.restore();
  };

  for (const child of tree.children) drawNode(child);
  return { surface, canvas, stats };
}

/** 从候选表里挑一个能用的字体文件（挑不到返回 null —— 调用方负责记 SKIP）。 */
export function pickTypeface() {
  for (const f of FONT_CANDIDATES) {
    try {
      if (fs.existsSync(f)) return { path: f, data: fs.readFileSync(f) };
    } catch {
      /* 读不了就当没有 */
    }
  }
  return null;
}

/** 读回像素（RGBA8888，Uint8Array，长度 w*h*4）。 */
export function readPixels(ck, surface, width, height) {
  const img = surface.makeImageSnapshot();
  const px = img.readPixels(0, 0, {
    width,
    height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  });
  img.delete();
  return px;
}

/** 取某点颜色 `[r,g,b]`。 */
export function pixelAt(px, width, x, y) {
  const i = (Math.round(y) * width + Math.round(x)) * 4;
  return [px[i], px[i + 1], px[i + 2]];
}

/** 十六进制颜色 → `[r,g,b]`（做像素断言的期望值要用它）。 */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`play: 只支持 #rrggbb，收到 \`${hex}\``);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 存 PNG（视觉证据）。 */
export function savePng(ck, surface, file, width, height) {
  const img = surface.makeImageSnapshot();
  const png = img.encodeToBytes();
  img.delete();
  fs.writeFileSync(file, Buffer.from(png));
  return file;
}
