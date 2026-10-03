// canvas-web.js —— 画布通道的 **Web 后端**：把同一份 draw-op 重放到 DOM 的 2D 上下文上。
//
// ## 为什么需要它（以及它为什么不违反"不自己实现渲染"）
//
// 画布在库侧只是一段 **draw-op 载荷**（`canvas/canvas.mbt`，18 条词汇表），
// 对面用什么画是**宿主**的事。原来的宿主只有一条注册：`canvas-skia.js` → `@shopify/react-native-skia`，
// 而 Skia 只跑原生（`platforms: ['android','ios']`）。于是**Web 上没有任何后端** ——
// 视图里出现 `moobile:Canvas` 时，`render.mbt` 会 fail-fast 抛
// 「宿主没有注册组件 "moobile:Canvas"」，而 React 收到渲染期异常会把**整棵树卸掉**：
// 现象是**整页空白**、控制台里还看不出是本页的问题（实测踩到，见下）。
//
// 补这一条不违反"不实现渲染"（DESIGN 原则 1）：这里没有新画什么 —— 18 条 op 逐条对应
// `CanvasRenderingContext2D` 的同名方法，是**翻译**，不是渲染器。同理 `canvas-skia.js`
// 也不是在实现 Skia。
//
// 与 CanvasKit 那条路的取舍：CanvasKit 是**真 Skia**（与 RN 侧同一个引擎，逐像素可对账），
// 但要 wasm 依赖 + 异步初始化；这条**零依赖、同步、浏览器原生 2D**，
// 适合"Web 上要先看到东西"的场景。两条不冲突，`platforms` 闸门各管各的。
//
// ## 实测症状（写给下一个撞上的人）
//
// 注册缺失时：`<div id="root"></div>` 是**空的**、`document.body.innerText` 是空串、
// 控制台**没有**报错、Metro 照常 200。唯一能定位的办法是去看 DOM 里 root 有没有内容 ——
// 我是在"整页断言全红但没有任何异常"之后才发现是画布注册缺失。

import React from 'react';
import { registerLibrary } from './core.js';

/** 默认的组件键：与库侧 `canvas_tag`（`moobile:Canvas`）的后半段一致。 */
export const DEFAULT_NAMESPACE = 'moobile';
export const DEFAULT_COMPONENT = 'Canvas';

/**
 * 把一串 draw-op 重放到一个 2D 上下文上。
 *
 * ⚠️ **基础变换先设 `dpr`**：库侧画的是"逻辑坐标"（720 那一套，再乘它自己的 `k`），
 * 而位图分辨率要乘设备像素比，否则高分屏上字与线都是糊的。
 * 原来这件事由应用自己写 `prepare_canvas`（读 `devicePixelRatio` 去重设位图尺寸）——
 * 现在收进后端，应用一个字都不用写。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {any[]} ops 已解码的指令数组（`[tag, ...args]`）
 * @param {number} width 逻辑宽（CSS 像素）
 * @param {number} height 逻辑高
 * @param {number} dpr 设备像素比
 */
export function replay(ctx, ops, width, height, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  for (const o of ops) {
    const [tag, ...a] = o;
    switch (tag) {
      case 'begin_path':
        ctx.beginPath();
        break;
      case 'move_to':
        ctx.moveTo(a[0], a[1]);
        break;
      case 'line_to':
        ctx.lineTo(a[0], a[1]);
        break;
      // `anticlockwise` 是布尔：CSS/Canvas 的第六个参数就是它，直接透传
      case 'arc':
        ctx.arc(a[0], a[1], a[2], a[3], a[4], Boolean(a[5]));
        break;
      case 'close_path':
        ctx.closePath();
        break;
      case 'fill_rect':
        ctx.fillRect(a[0], a[1], a[2], a[3]);
        break;
      case 'fill':
        ctx.fill();
        break;
      case 'stroke':
        ctx.stroke();
        break;
      case 'set_line_width':
        ctx.lineWidth = a[0];
        break;
      case 'set_fill_style':
        ctx.fillStyle = a[0];
        break;
      case 'set_stroke_style':
        ctx.strokeStyle = a[0];
        break;
      case 'set_font':
        ctx.font = a[0];
        break;
      case 'fill_text':
        ctx.fillText(a[0], a[1], a[2]);
        break;
      case 'save':
        ctx.save();
        break;
      case 'restore':
        ctx.restore();
        break;
      case 'translate':
        ctx.translate(a[0], a[1]);
        break;
      case 'rotate':
        ctx.rotate(a[0]);
        break;
      case 'scale':
        ctx.scale(a[0], a[1]);
        break;
      default:
        // 词汇表里没有的 tag：**当场炸**。静默跳过会表现成"画了但少一块"，
        // 而报错点在离出错很远的地方（`canvas-ops.js` 的解码器也持同样态度）。
        throw new Error(`moobile-host/canvas-web: 未知 op \`${tag}\`（词汇表只有 ${18} 条）`);
    }
  }
}

/**
 * 造一个"能画"的 React 组件（与 `canvas-skia.js` 的 `makeSkiaCanvas` 同形）。
 *
 * @param {{quiet?: boolean}} [options]
 */
export function makeWebCanvas(options = {}) {
  function WebCanvas(props) {
    const { ops, width, height, style, ...rest } = props;
    if (!Array.isArray(ops)) {
      throw new Error(
        `moobile-host/canvas-web: \`ops\` 不是数组（拿到 ${typeof ops}）。` +
          '最常见的原因是宿主注册时忘了把 `ops` 列进 `jsonProps` —— 那样传进来的是一段字符串。',
      );
    }
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    const ref = React.useRef(null);
    React.useEffect(() => {
      const cv = ref.current;
      if (!cv) return;
      const dpr = (globalThis.devicePixelRatio || 1);
      const ctx = cv.getContext('2d');
      if (ctx) replay(ctx, ops, w, h, dpr);
      // 依赖里带上 ops：模型一变就重画（TEA 的重绘语义在 Web 上就落在这里）
    }, [ops, w, h]);

    const dpr = (globalThis.devicePixelRatio || 1);
    return React.createElement('canvas', {
      ref,
      width: Math.round(w * dpr),
      height: Math.round(h * dpr),
      // 位图尺寸乘了 dpr，显示尺寸要回到逻辑尺寸 —— 否则画布在页面上被放大 dpr 倍
      style: { width: `${w}px`, height: `${h}px`, display: 'block', ...style },
      ...rest,
    });
  }
  WebCanvas.displayName = options.name || 'MoobileWebCanvas';
  return WebCanvas;
}

/**
 * 一次把"组件 + JSON prop 白名单 + 平台闸门"登记好。
 *
 * @param {{namespace?: string, component?: string, platforms?: string[], quiet?: boolean}} [spec]
 * @returns {string[]} 注册的组件键（便于启动日志与验证脚本断言）
 */
export function registerWebCanvas(spec = {}) {
  const {
    namespace = DEFAULT_NAMESPACE,
    component = DEFAULT_COMPONENT,
    platforms = ['web'],
    quiet = false,
  } = spec;
  return registerLibrary({
    namespace,
    components: { [component]: makeWebCanvas({}) },
    // ⚠️ 少了这一行，组件拿到的 `ops` 是一段**字符串** —— 会当场抛（见 makeWebCanvas）
    jsonProps: { [component]: ['ops'] },
    platforms,
    quiet,
  });
}
