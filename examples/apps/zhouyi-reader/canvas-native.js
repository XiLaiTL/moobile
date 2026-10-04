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

import { registerSkiaCanvas, setFallbackTypeface } from 'moobile-host/canvas-skia';
import * as Skia from '@shopify/react-native-skia';
// ⚠️ `import * as Skia` 拿到的是**包的命名空间**（`Skia` / `Canvas` / `Path` / `matchFont`…），
//    **不是** native 注入的那个 Skia API 对象 —— 所以 `Skia.FontMgr` 是 `undefined`
//    （实测报 `Cannot read property 'System' of undefined`）。字体要走包导出的 `matchFont`，
//    它内部才去拿 `Skia.FontMgr.System()`。
//    ★ 而"回退字体"那条路要**造 Font、读 Data、做 Typeface**，那些都在真 API 对象上
//      ⇒ 所以这里同时要 `import { Skia as SkiaApi }`（它才是有 `Data`/`Typeface`/`Font` 的那个）。
import { matchFont, Skia as SkiaApi } from '@shopify/react-native-skia';

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
 *
 * ⚠️★ **2026-10-23 真机实测：下面原来那句"中文在 Android 上通常落到 Noto Sans CJK"是错的。**
 *    探针读数：`Kaiti TC` / `serif` / `sans-serif` / `Noto Sans CJK SC` / `System` 对「乾」
 *    **全部 glyph=0**；而设备上 33 个字体族里**没有一个**能画中文
 *    （对照：拉丁 `A` 在同一探针下 = 38 ⇒ 探针本身没问题）。
 *    真因：**Android 的中文字形只走系统字体回退链**，而 RN Skia 的 `<Text font=` 用单个
 *    `SkFont`、**不做回退**（`FontMgr` 也只暴露 `matchFamilyStyle`，没有按字符找字体的 API）。
 *    ⇒ 画布上的中文在真机上**一个都画不出来**；而 web 走 DOM `fillText`、浏览器自己会回退，
 *    所以 web/桌面全绿 —— 又一个"web 绿、真机红"。
 *    详见 `docs/FINDINGS.md` 第二十四轮。
 *
 * ✅ **2026-10-23 修法（已落地，见同一轮第六/七节）**：库侧给了"**回退字体**"这条口
 *    （`setFallbackTypeface`），应用负责**把字体找来**。这里找的是**系统自带的 CJK 字体**：
 *    按族名要不到，但**按文件读得到** —— 实测
 *    `await SkiaApi.Data.fromURI('file:///system/fonts/NotoSansCJK-Regular.ttc')`
 *    （⚠️ 它返回 **Promise**，必须 await；不 await 会报 `Expected Data but got different type`）
 *    → `Typeface.MakeFreeTypeFaceFromData` 出来的 typeface 里「乾」= 字形 **9647** ✅。
 *    ⇒ **零新依赖、APK 不增大**。宿主侧在"应用选的字体画不出这些字"时改用它；
 *      注册是异步的，宿主会**通知画布重渲染**，所以第一屏也有字。
 */
export function registerNativeCanvas() {
  const makeFont = (f) => {
    const fontSize = (f && f.size) || 10;
    const fontFamily = (f && f.family) || 'serif';
    // `matchFont` 会按族名去系统字体里找；找不到就回落到默认字体（不抛）。
    // ⚠️ 但"回落到默认"这条在中文上**没用**（默认字体没有中文字形）—— 所以下面要喂回退字体。
    return matchFont({ fontFamily, fontSize });
  };
  // 注册完就去找回退字体（**不等它**：拿到之后宿主会自己重渲染画布）
  loadSystemCjkFallback();
  return registerSkiaCanvas({ skia: Skia, skiaApi: SkiaApi, makeFont });
}

/**
 * 找一份**能画中文**的系统字体，交给宿主当回退。
 *
 * 为什么是"系统字体"而不是"自带一份"：APK 不增大、不用管授权；代价是**路径与文件名依赖
 * Android 版本**，所以按候选列表依次试，全失败就**明说**（画布上的中文标签会画不出来），
 * 而不是安静地留一片空白。
 */
async function loadSystemCjkFallback() {
  const candidates = [
    'file:///system/fonts/NotoSansCJK-Regular.ttc',
    'file:///system/fonts/NotoSerifCJK-Regular.ttc',
  ];
  for (const uri of candidates) {
    try {
      // ⚠️ `Data.fromURI` 是 **Promise**（见类型定义 `DataFactory.d.ts`）
      const data = await SkiaApi.Data.fromURI(uri);
      if (!data) continue;
      const tf = SkiaApi.Typeface.MakeFreeTypeFaceFromData(data);
      if (!tf) continue;
      const probe = SkiaApi.Font(tf, 12);
      const glyph = Array.from(probe.getGlyphIDs('乾'))[0];
      if (!glyph) continue; // 这份字体也画不出中文，换下一个
      setFallbackTypeface(tf);
      console.log(`[zhouyi-reader] 画布回退字体已就绪：${uri}（「乾」= 字形 ${glyph}）`);
      return true;
    } catch (e) {
      // 换下一个候选；全失败时下面会明说
    }
  }
  console.warn(
    '[zhouyi-reader] 系统里没找到能画中文的字体 —— 画布上的方位/卦名标签会**画不出来**。\n' +
      '  候选：' + candidates.join('、'),
  );
  return false;
}
