// canvas-skia.js —— 把库侧发来的绘制指令接到 **React Native 的 Skia** 上。
//
// ```js
// // 应用侧（app/host/index.js）
// import * as Skia from '@shopify/react-native-skia';
// import { registerSkiaCanvas } from 'moobile-host/canvas-skia';
//
// registerSkiaCanvas({ skia: Skia });   // 之后 @canvas.canvas(ops, w, h) 就能渲染了
// ```
//
// ## 为什么 Skia 要**应用自己传进来**
//
// `moobile-host` 不给 Skia 挂依赖。理由与"库本体不加依赖"是同一条：
// 一个只用 antd 的 Web 项目不该被拖着装 Skia（它带 **reanimated + worklets 两个原生依赖**，
// 实测 `npm view @shopify/react-native-skia@2.12.0 peerDependencies`）。
// 传进来是显式的：装没装、装哪个版本，应用自己知道。
//
// ⚠️ **平台闸门刻意不设默认值**：`registerLibrary` 的默认是 `platforms: ['web']`，
// 而那对 Skia 是**反的**（它只跑原生）。所以这里默认 `['android', 'ios']`，
// 而不是把 web 也放进来 —— 放进来只会让"Web 上也注册了 Skia"变成一个装不上的包。
// 要在 Web 上看同样的画面，走 CanvasKit（见 `examples/apps/canvas-spike/`），
// 那是另一条注册（`platforms: ['web']`）。
//
// ## 还没验的部分（别当已验证）
//
// **真机上的组件挂载没跑过**（要 `expo prebuild` + 重建 APK）。已验证到的是：
// 指令 → 元素树的翻译（逐条断言）+ 用**真 Skia 引擎**（CanvasKit）回放出图并逐像素对账，
// 见 `examples/apps/canvas-spike/`。React 那一层（`<Canvas>` 挂载、reconciler、
// `transform` prop 的接受形状）与**文字**是待验的两块。

import React, { useMemo } from 'react';
import { opsToTree } from './canvas-ops.js';
import { registerLibrary } from './core.js';

/** 默认的组件名：与库侧 `canvas_tag`（`moobile:Canvas`）的后半段一致。 */
export const DEFAULT_NAMESPACE = 'moobile';
export const DEFAULT_COMPONENT = 'Canvas';

/**
 * 元素树 → React 元素（用应用传进来的 Skia 组件）。
 *
 * ⚠️ 文字要**字体**：RN Skia 的 `<Text>` 需要一个 `SkFont`。这里要求应用给
 * `makeFont({ size, family })`（例如 `(f) => Skia.Font(Skia.Typeface(0), f.size)`）。
 * 没给而指令里又有文字 → **当场抛**，不静默跳过：静默跳过会让"标签不见了"
 * 变成上线很久之后才发现的事（这个仓库里同类教训已经记过好几条）。
 */
export function treeToReact(tree, skia, options = {}) {
  const { Canvas, Path, Rect, Text } = skia;
  const makeFont = options.makeFont;

  const toElement = (node, i) => {
    const p = node.props || {};
    switch (node.type) {
      case 'Path': {
        const props = { key: i, path: p.path, color: p.color };
        if (p.style === 'stroke') {
          props.style = 'stroke';
          props.strokeWidth = p.strokeWidth;
        }
        if (p.transform) props.transform = p.transform;
        return React.createElement(Path, props);
      }
      case 'Rect': {
        const props = { key: i, x: p.x, y: p.y, width: p.width, height: p.height, color: p.color };
        if (p.transform) props.transform = p.transform;
        return React.createElement(Rect, props);
      }
      case 'Text': {
        if (typeof makeFont !== 'function') {
          throw new Error(
            'moobile-host/canvas-skia: 指令里有文字（`fill_text`），但没给 `makeFont`。\n' +
              '  RN Skia 的 <Text> 需要一个 SkFont，而「用哪个字体」是应用的资源决定，宿主不该替你猜。\n' +
              '  传法：registerSkiaCanvas({ skia, makeFont: (f) => Skia.Font(Skia.Typeface(0), f.size) })\n' +
              '  或者在应用里给字体系统（useFont / matchFamilyStyle）后再注册。',
          );
        }
        const text = String(p.text);
        const props = { key: i, text, x: p.x, y: p.y, color: p.color };
        if (p.transform) props.transform = p.transform;
        // ★ 字体选择：应用给的优先；**画不出才用回退字体**（应用注册进来的那份）。
        //   再画不出就报 warning（……不静默丢一段文字，也不静默画空白）。
        const font = pickTextFont({ makeFont, parsed: p.font, text });
        props.font = font;
        noteIfUnrenderable(font, text, p.font);
        return React.createElement(Text, props);
      }
      default:
        throw new Error(`moobile-host/canvas-skia: 不认识的元素类型 \`${node.type}\``);
    }
  };

  return React.createElement(
    Canvas,
    { style: tree.props.style },
    (tree.children || []).map(toElement),
  );
}

// ── 画布文字的字体选择（回退字体那条路）──────────────────────────────
//
// ⚠️ 逻辑**抽到 `canvas-font.js`**（那份不依赖 React）—— 因为判据跑在 node 里（没有 react），
//    而这条路上最容易错的几件事（回退有没有生效 / 注册有没有通知重渲染 / 没注册时会不会静默照旧）
//    **必须有离线判据钉着**。背景与契约写在那份文件头。
//    （实测教训：这一轮"改了代码 ≠ 改动生效"已经踩过一次。）
export {
  fontCoversText,
  setFallbackTypeface,
  currentFallbackTypeface,
  subscribeFallback,
  unrenderableTextCount,
  resetUnrenderableTextCount,
  pickTextFont,
} from './canvas-font.js';
import { pickTextFont, noteIfUnrenderable, setSkiaApi } from './canvas-font.js';

/** 造出那个注册进组件通道的 React 组件（**只造一次** —— 每次渲染换类型会整棵子树重挂）。 */
export function makeSkiaCanvas(skia, options = {}) {
  // 回退字体要用**真 API 对象**造 `Font`（命名空间上没有 `Font`）—— 注册时一起给。
  if (options.skiaApi) setSkiaApi(options.skiaApi);
  function SkiaCanvas(props) {
    const { ops, width, height, ...rest } = props;
    // ⚠️★ 回退字体是**异步**加载的（`Data.fromURI` 是 Promise）⇒ 它可能在首帧之后才就绪。
    //    没有这一句，第一屏**永远没有字**（而后面重开页面又有了 —— 那种"偶发"最难查）。
    const [, bumpFallback] = React.useState(0);
    React.useEffect(() => subscribeFallback(() => bumpFallback((n) => n + 1)), []);
    // `jsonProps` 已经把 ops 解析成数组了；这里只做形状兜底（解出非数组时点名，不静默画空白）
    const list = useMemo(() => {
      if (!Array.isArray(ops)) {
        throw new Error(
          `moobile-host/canvas-skia: \`ops\` 不是数组（拿到 ${typeof ops}）。` +
            '最常见的原因是宿主注册时忘了把 `ops` 列进 `jsonProps` —— 那样传进来的是一段字符串。',
        );
      }
      return ops;
    }, [ops]);
    const tree = useMemo(
      () => opsToTree(list, { width: Number(width) || 0, height: Number(height) || 0 }),
      [list, width, height],
    );
    return treeToReact(tree, skia, { ...options, ...rest });
  }
  SkiaCanvas.displayName = 'MoobileCanvas';
  return SkiaCanvas;
}

/**
 * 一次把"组件 + JSON prop 白名单 + 平台闸门"登记好。
 *
 * @param {object} spec
 * @param {object} spec.skia            应用 `import * as Skia from '@shopify/react-native-skia'`
 * @param {string} [spec.namespace]     默认 `moobile`（与库侧 `canvas_tag` 对齐）
 * @param {string} [spec.component]     默认 `Canvas`
 * @param {string[]} [spec.platforms]   默认 `['android','ios']`（Skia 只跑原生）
 * @param {Function} [spec.makeFont]    有文字指令时**必须**给（见前文）
 * @param {object} [spec.skiaApi]       真 API 对象（`import { Skia as SkiaApi } from '@shopify/react-native-skia'`）。
 *   只有"回退字体"那条路需要它：`makeFont` 造出来的字体**画不出这些字**时，宿主用
 *   `skiaApi.Font(回退 typeface, size)` 顶上去。**命名空间不够**（上面没有 `Font`/`FontMgr`，
 *   实测 `Skia.FontMgr` 是 undefined）。不给也不会崩：退化成"报一句 warning"。
 * @returns {string[]} 注册的组件键（便于启动日志与验证脚本断言）
 */
export function registerSkiaCanvas(spec = {}) {
  const {
    skia,
    namespace = DEFAULT_NAMESPACE,
    component = DEFAULT_COMPONENT,
    platforms = ['android', 'ios'],
    makeFont,
    quiet = false,
  } = spec;
  if (!skia || !skia.Canvas) {
    throw new Error(
      'moobile-host/canvas-skia: 需要传入 Skia 模块（`import * as Skia from "@shopify/react-native-skia"`）。\n' +
        '  宿主包不替应用装 Skia —— 它带 reanimated + worklets 两个原生依赖，装不装是应用的决定。',
    );
  }
  return registerLibrary({
    namespace,
    // ⚠️ `skiaApi` 只在"回退字体"那条路上需要（造 `Font`）—— 不给也不会崩，只是回退用不了。
    components: { [component]: makeSkiaCanvas(skia, { makeFont, skiaApi: spec.skiaApi, quiet }) },
    // ⚠️ 少了这一行，组件拿到的 `ops` 是一段**字符串** —— 会当场抛（见 makeSkiaCanvas）
    jsonProps: { [component]: ['ops'] },
    platforms,
    quiet,
  });
}
