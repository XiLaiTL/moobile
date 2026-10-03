// canvas-svg.js —— 画布通道的 **SVG 后端**：把同一份 draw-op 翻译成 `react-native-svg` 元素。
//
// ## 为什么需要它（第三条后端，前两条各有一块够不着的地方）
//
// | 后端 | 平台 | 为什么不能兼 |
// |---|---|---|
// | `canvas-skia.js` | android / iOS | `@shopify/react-native-skia` **没有 Windows 后端**（`npm pack` 后 `package/windows/` 是 0 个文件；维护者原话"要专门写一个后端"）|
// | `canvas-web.js` | web | 用的是 DOM 的 `CanvasRenderingContext2D`，**RN 里没有** |
// | **`canvas-svg.js`（本文件）** | **web / windows**（可配） | —— |
//
// 也就是说：**桌面端（react-native-windows）那条路要能画出罗盘，靠的就是它**。
// `react-native-svg` 的 tarball 里有 153 个 windows 文件（含 Fabric 实现），是 RNW 上
// 唯一现成的矢量绘制通道。
//
// ## 为什么不违反"不自己实现渲染"（DESIGN 原则 1）
//
// 这里没有新画什么：`canvas-ops.js` 已经把指令翻成一棵**中立的元素树**
// （`Path` / `Rect` / `Text`，与 Skia 那条通道共用同一棵树），本文件只把那棵树映射到
// react-native-svg 的组件上 —— 是**翻译**，和 `canvas-skia.js` 做的事一一对应。
//
// ## 与 CanvasKit / Skia 的差别（写清楚，免得以为画面会逐像素一样）
//
// · **变换**：canvas 的 `rotate` 是**弧度**，SVG 的 `rotate()` 是**度** —— 这里换一次；
// · **文字**：SVG 用系统字体的族名，不需要 `makeFont`（Skia 那条要）；
//   代价是**字形随平台**（与浏览器里看到的可能不同，属于"排版要重新验"那一类）；
// · **抗锯齿/线宽**：由各自的渲染器决定，不承诺逐像素一致。

import React from 'react';
import { opsToTree } from './canvas-ops.js';
import { registerLibrary } from './core.js';

/** 默认的组件键：与库侧 `canvas_tag`（`moobile:Canvas`）的后半段一致。 */
export const DEFAULT_NAMESPACE = 'moobile';
export const DEFAULT_COMPONENT = 'Canvas';

/** 弧度 → 度（canvas 的 `rotate` 与 SVG 的 `rotate()` 单位不同，这是唯一一处会静默画错的地方）。 */
function radToDeg(rad) {
  return (Number(rad) * 180) / Math.PI;
}

/**
 * 把 op 层的变换数组翻成 SVG 的 `transform` 字符串。
 *
 * ⚠️ **形状是 React Native 的样式变换**（`canvas-ops.js` 的 `push({translateX, translateY})` 那一族），
 *    不是 `{type: 'translate'}` —— 第一版就是照后者写的，跑起来报
 *    `不认识的变换 undefined`（每个元素都带一个 `undefined` 的变换项）。写映射前先看**真源**，
 *    别照自己脑子里的形状写。
 *
 * 语义核对：`translate(cx cy) rotate(θ) translate(-cx -cy)` 这种"绕点旋转"在 SVG 里
 * 与 RN/Skia 的数组顺序**一致**（都是从左往右施加），所以直接顺序拼字符串即可。
 */
export function transformToSvg(list) {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  const parts = [];
  for (const t of list) {
    if (!t) continue;
    if ('translateX' in t || 'translateY' in t) {
      parts.push(`translate(${t.translateX || 0} ${t.translateY || 0})`);
    } else if ('rotate' in t) {
      // RN 这边存的是**弧度**（op 直传），SVG 要度
      parts.push(`rotate(${radToDeg(t.rotate)})`);
    } else if ('rotateDeg' in t) {
      parts.push(`rotate(${Number(t.rotateDeg)})`);
    } else if ('scaleX' in t || 'scaleY' in t) {
      parts.push(`scale(${t.scaleX ?? 1} ${t.scaleY ?? 1})`);
    } else if (t.type) {
      // 兼容另一种写法（没在用的那条路，但报错要说得清）
      if (t.type === 'translate') parts.push(`translate(${t.x} ${t.y})`);
      else if (t.type === 'rotate') parts.push(`rotate(${radToDeg(t.rad)})`);
      else if (t.type === 'scale') parts.push(`scale(${t.x} ${t.y})`);
      else throw new Error(`moobile-host/canvas-svg: 不认识的变换 \`${t.type}\``);
    } else {
      throw new Error(`moobile-host/canvas-svg: 不认识的变换 \`${JSON.stringify(t)}\``);
    }
  }
  return parts.length ? parts.join(' ') : undefined;
}

/**
 * 中立的元素树 → react-native-svg 元素。
 *
 * @param {any} tree `opsToTree` 的产物
 * @param {any} svg 应用传入的 `react-native-svg` 模块（只用到 `Svg` / `Path` / `Rect` / `Text`）
 */
export function treeToSvg(tree, svg) {
  const { Svg, Path, Rect, Text } = svg;
  const size = tree.props && tree.props.style ? tree.props.style : {};

  const toElement = (node, i) => {
    const p = node.props || {};
    const transform = transformToSvg(p.transform);
    switch (node.type) {
      case 'Path': {
        // 注意两个后端**同形不同名**：Skia 用 `path/style/strokeWidth/color`，
        // SVG 用 `d/fill/stroke/strokeWidth` —— 填/描是**两个属性**，不是 style 开关。
        const props = {
          key: i,
          d: p.path,
          fill: p.style === 'stroke' ? 'none' : p.color,
          stroke: p.style === 'stroke' ? p.color : 'none',
        };
        if (p.style === 'stroke') props.strokeWidth = p.strokeWidth;
        if (transform) props.transform = transform;
        return React.createElement(Path, props);
      }
      case 'Rect': {
        const props = { key: i, x: p.x, y: p.y, width: p.width, height: p.height, fill: p.color };
        if (transform) props.transform = transform;
        return React.createElement(Rect, props);
      }
      case 'Text': {
        const f = p.font || {};
        const props = {
          key: i,
          x: p.x,
          y: p.y,
          fill: p.color,
          fontSize: f.size || 10,
        };
        if (f.family) props.fontFamily = f.family;
        if (transform) props.transform = transform;
        // 文本当**子节点**传（SVG 的语义），不是 prop
        return React.createElement(Text, props, String(p.text));
      }
      default:
        throw new Error(`moobile-host/canvas-svg: 不认识的元素类型 \`${node.type}\``);
    }
  };

  return React.createElement(
    Svg,
    { width: size.width, height: size.height },
    (tree.children || []).map(toElement),
  );
}

/**
 * 造出那个注册进组件通道的 React 组件（**只造一次** —— 每次渲染换类型会整棵子树重挂）。
 */
export function makeSvgCanvas(svg, options = {}) {
  function SvgCanvas(props) {
    const { ops, width, height, ...rest } = props;
    if (!Array.isArray(ops)) {
      throw new Error(
        `moobile-host/canvas-svg: \`ops\` 不是数组（拿到 ${typeof ops}）。` +
          '最常见的原因是宿主注册时忘了把 `ops` 列进 `jsonProps` —— 那样传进来的是一段字符串。',
      );
    }
    const tree = React.useMemo(
      () => opsToTree(ops, { width: Number(width) || 0, height: Number(height) || 0 }),
      [ops, width, height],
    );
    return treeToSvg(tree, { ...svg, ...options.overrides });
  }
  SvgCanvas.displayName = 'MoobileSvgCanvas';
  return SvgCanvas;
}

/**
 * 一次把"组件 + JSON prop 白名单 + 平台闸门"登记好。
 *
 * @param {object} spec
 * @param {any} spec.svg 应用 `import * as Svg from 'react-native-svg'`（或只传 `{Svg, Path, Rect, Text}`）
 * @param {string} [spec.namespace] 默认 `moobile`
 * @param {string} [spec.component] 默认 `Canvas`
 * @param {string[]} [spec.platforms] 默认 `['web','windows']`
 *        —— ⚠️ 故意**不含** android/iOS：那边有 Skia（同命名空间按平台注册不同实现，
 *        这正是 `registerLibrary` 的 `platforms` 闸门要表达的事）。
 * @returns {string[]} 注册的组件键
 */
export function registerSvgCanvas(spec = {}) {
  const {
    svg,
    namespace = DEFAULT_NAMESPACE,
    component = DEFAULT_COMPONENT,
    platforms = ['web', 'windows'],
    quiet = false,
  } = spec;
  if (!svg || !svg.Svg || !svg.Path) {
    throw new Error(
      'moobile-host/canvas-svg: 需要传入 react-native-svg 模块\n' +
        '  （`import * as Svg from "react-native-svg"`，或 `{ Svg, Path, Rect, Text }`）。\n' +
        '  宿主包不替应用装它 —— 装不装、装哪一版是应用的决定。',
    );
  }
  return registerLibrary({
    namespace,
    components: { [component]: makeSvgCanvas(svg) },
    // ⚠️ 少了这一行，组件拿到的 `ops` 是一段**字符串** —— 会当场抛（见 makeSvgCanvas）
    jsonProps: { [component]: ['ops'] },
    platforms,
    quiet,
  });
}
