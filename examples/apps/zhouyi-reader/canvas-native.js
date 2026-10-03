// canvas-native.js —— 原生（Android / iOS）的画布后端注册：`@shopify/react-native-skia`。
//
// ## 为什么单独一个文件（而不是在 `App.js` 里 import）
//
// `@shopify/react-native-skia` 是**原生专用**包：它的入口里 `require('./animation')` 之类
// 在 **web 平台解析不过**，Metro 直接报
//
//     UnableToResolveError: Unable to resolve module ./animation
//       from …/@shopify/react-native-skia/lib/module/index.js
//
// ⚠️ 关键：**`if (Platform.OS !== 'web') require(...)` 挡不住它** ——
//    Metro 是在**打包期**解析所有 `require`/`import` 的，平台判断发生在运行期。
//    实测踩过：加了 `Platform` 判断之后 web 端仍然整包编不出来。
//
// 正确做法是 RN 的**平台文件**惯例：同名 + `.web.js`，Metro 按目标平台挑其中之一。
// 于是 web 端看到的是 `canvas-native.web.js`（空实现），连碰都不会碰 Skia。
//
// 桌面（RNW）两条都不适用：Skia 没有 Windows 后端（见 `docs/design/DESKTOP-RNW.md`）。

import { registerSkiaCanvas } from 'moobile-host/canvas-skia';
import * as Skia from '@shopify/react-native-skia';
// ⚠️ `import * as Skia` 拿到的是**包的命名空间**（`Skia` / `Canvas` / `Path` / `matchFont`…），
//    **不是** native 注入的那个 Skia API 对象 —— 所以 `Skia.FontMgr` 是 `undefined`
//    （实测报 `Cannot read property 'System' of undefined`）。字体要走包导出的 `matchFont`，
//    它内部才去拿 `Skia.FontMgr.System()`。
import { matchFont } from '@shopify/react-native-skia';

/**
 * 注册原生画布后端。返回注册到的组件键（便于启动日志/断言）。
 *
 * ⚠️ **必须给 `makeFont`**：罗盘的绘制指令里有文字（方位「南西北东」、六宫卦名），
 *    而 RN Skia 的 `<Text>` 要一个 `SkFont`；没给就**当场抛**（不静默丢标签）。
 *    这条通道按库自己的 HANDOVER 记着「**文字字形那条路没上过真机**」——
 *    本应用是第一个撞上它的：Android 上启动即红屏，报的就是这句。
 *
 * 做法：用**系统字体管理器**按族名要一个 typeface（`FontMgr.System().matchFamilyStyle`），
 * 再按指令里的字号造 `Font`。绘制指令里的 `font` 形如 `12px Kaiti TC`，
 * 宿主侧的 `parseFont` 已经把它拆成 `{ size, family }`。
 * 系统里没有那个族名时会回落（`matchFamilyStyle` 返回 null 时用默认 typeface）——
 * 中文在 Android 上通常落到 Noto Sans CJK，与桌面/浏览器里的衬线体不同，
 * 这是**排版要重新验**的那一类差异（不是 bug，但别以为三端字形一样）。
 */
export function registerNativeCanvas() {
  const makeFont = (f) => {
    const fontSize = (f && f.size) || 10;
    const fontFamily = (f && f.family) || 'serif';
    // `matchFont` 会按族名去系统字体里找；找不到就回落到默认字体（不抛）。
    return matchFont({ fontFamily, fontSize });
  };
  return registerSkiaCanvas({ skia: Skia, makeFont });
}
