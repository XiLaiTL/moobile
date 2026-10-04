// canvas-font.js —— **画布文字的字体选择**（回退字体那条路）—— 不依赖 React，好让判据也能测它。
//
// ## 背景（真机实测，2026-10-23）
//
// Android 上"按族名"要不到中文字形：设备 33 个字体族里**没有一个**能画「乾」
// （`serif` / `sans-serif` / `Noto Sans CJK SC` / `System` 全是 `glyph=0`），
// 而**对照拉丁 `A` = 38** ⇒ 不是探针的问题。
// 真因：**Android 的中文字形只走系统字体回退链**（`fonts.xml` 里 `lang="zh-Hans"` 那一族），
// 而 RN Skia 的 `<Text font=>` 用单个 `SkFont`、**不做回退**（`FontMgr` 只暴露
// `matchFamilyStyle`，没有"按字符找字体"的 API）。⇒ 画布上的中文一条都画不出来，而且**不报错**。
//
// ## 出路：**按文件**读得到（零新依赖）
//
// 实测：`await SkiaApi.Data.fromURI('file:///system/fonts/NotoSansCJK-Regular.ttc')`
// （⚠️ 返回 **Promise**，不 await 会报 `Expected Data but got different type`）
// → `Typeface.MakeFreeTypeFaceFromData` → 「乾」= 字形 **9647** ✅。
// 所以：**应用负责把字体找来**（读系统字体、或自带一份），**宿主负责在画不出时用它**。
//
// ## 这个模块的契约
//
//   · `setFallbackTypeface(tf)` —— 应用注册回退字体（**异步**加载完了再调）。
//   · `subscribeFallback(fn)`  —— 注册时**通知订阅者**：画布要重渲染，否则**首屏永远没有字**
//     （而重开页面又有了 —— 那种"偶发"最难查）。
//   · `pickTextFont({makeFont, skiaApi, parsed, text})` —— 宿主每条文字指令调它：
//     先问应用给的那个字体；**画不出**才用回退字体；两样都不行就原样返回（交给调用方报警）。
//
// ⚠️ 为什么单独一个文件、而不是留在 `canvas-skia.js`：那个文件 `import React`，
//    而**判据跑在 node 里（没有 react）**。抽出来之后，这条路上最容易错的几件事
//    （回退有没有生效、注册有没有通知、没注册时会不会静默照旧）都能被离线判据钉住。
//    实测教训：这一轮"改了代码≠改动生效"已经踩过一次（note 挂在 `mapDeclaration`，
//    而真正走的是 `mapBorderShorthand`）。

let fallbackTypeface = null;
let skiaApi = null;
const subs = new Set();

/** ⚠️ 真 API 对象（`import { Skia as SkiaApi }`）—— 只有它上面才有 `Font`/`Data`/`Typeface`。 */
export function setSkiaApi(api) {
  skiaApi = api || null;
}

/**
 * 这个字体能不能画出这段文字？
 *
 * 判据是 `getGlyphIDs`：**任何一个是 0 就是缺字形**（Skia 里 0 = `.notdef`）。
 * ⚠️ 问不出来（旧版本 / 假对象）时返回 `true` —— **不拦**：宁可漏报，也不要因为
 *    一个可选 API 的缺失把正常的字挡住。
 */
export function fontCoversText(font, text) {
  try {
    if (!font || typeof font.getGlyphIDs !== 'function') return true;
    const ids = Array.from(font.getGlyphIDs(String(text)));
    return ids.length > 0 && ids.every((g) => g !== 0);
  } catch {
    return true;
  }
}

/** 注册回退字体；**有值时会通知订阅者**（画布据此重渲染）。 */
export function setFallbackTypeface(typeface) {
  fallbackTypeface = typeface || null;
  if (fallbackTypeface) for (const fn of subs) fn();
}

/** 当前的回退字体（没注册就是 null）。 */
export function currentFallbackTypeface() {
  return fallbackTypeface;
}

/** 订阅"回退字体变了"。返回退订函数。 */
export function subscribeFallback(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

let unrenderable = 0;
const warnedFamilies = new Set();

/** 已发现的"画不出来"的文字条数（给真机判据/启动日志用）。 */
export function unrenderableTextCount() {
  return unrenderable;
}

/** 判据用：把计数清零（真机脚本一件事跑完再看增量时用）。 */
export function resetUnrenderableTextCount() {
  unrenderable = 0;
  warnedFamilies.clear();
}

/**
 * **这一步决定用哪个字体**：应用给的优先；画不出才换回退字体；都不行就原样返回。
 *
 * @param {{makeFont: Function, parsed: {size?: number, family?: string}, text: string}} args
 * @returns {object} 要交给 `<Text font=>` 的那个字体
 */
export function pickTextFont({ makeFont, parsed, text }) {
  const primary = makeFont(parsed);
  if (fontCoversText(primary, text)) return primary;
  const tf = fallbackTypeface;
  if (!tf || !skiaApi || typeof skiaApi.Font !== 'function') return primary;
  try {
    const alt = skiaApi.Font(tf, (parsed && parsed.size) || 10);
    return fontCoversText(alt, text) ? alt : primary;
  } catch {
    return primary;
  }
}

/**
 * 画不出来时**说 loud**（每族一次），并把计数 +1。
 *
 * 为什么必须说：这条路的失败模式是"**画布上什么字都没有，但不报错、不崩、判据全绿**"，
 * 而且 web 那边（DOM `fillText`，浏览器自己回退）**看不见** —— 又一次"web 绿、真机红"。
 */
export function noteIfUnrenderable(font, text, parsed) {
  if (fontCoversText(font, text)) return false;
  unrenderable++;
  const fam = (parsed && parsed.family) || '(默认)';
  if (warnedFamilies.has(fam)) return true;
  warnedFamilies.add(fam);
  console.warn(
    `[moobile-host/canvas-skia] 字体「${fam}」画不出画布上的文字（例如「${String(text).slice(0, 4)}」）` +
      ' —— 这些字**不会**出现在画面上，而且不会报错。\n' +
      '  Android 的中文字形只走**系统字体回退链**，而 Skia 的 <Text font=> 用单个 SkFont、不做回退。\n' +
      '  出路：应用把一份能画中文的 typeface 交给 `setFallbackTypeface()`（读系统字体即可，\n' +
      '  `Data.fromURI(\'file:///system/fonts/NotoSansCJK-Regular.ttc\')` —— ⚠️ 它是 Promise）。\n' +
      '  详见库仓库 `docs/FINDINGS.md` 第二十四轮。',
  );
  return true;
}
