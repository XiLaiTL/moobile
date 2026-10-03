// migrate/scan.js —— F1「迁移动检」的**纯 JS 版**（宿主 npm 包侧）。
//
//   const { scanProject } = require('./migrate/scan');
//   const report = scanProject({ root: '/path/to/rabbita-project' });
//   // report 与 `bash tools/mb.sh migrate-scan --root … --json` 的 JSON **逐项等价**
//
// ── 为什么会有第二份实现（而不是让 CLI 去调仓库里的工具） ─────────────────────
//
// F1 的真源是 MoonBit 版 `tools/mbtools/src/migrate_scan.mbt`（PLAN §5.1 / SCAFFOLD §3.7）。
// 这一份存在的唯一理由：**使用者的机器上没有 MoonBit 工具链**，而 `npx moobile-host`
// 要能就地给用户的 rabbita 项目做动检。`tools/` 那套是仓库自己的开发工具，不随 npm 包发布。
// 所以这里是一条硬规矩：**规则照抄，一条都不许少、也不许加** ——
// 判据是 `node tools/migrate_scan_reconcile.mjs` 两边逐 finding / 逐 hit 一致，不是"我觉得该加"。
//
// 第二条第规矩：**零 npm 依赖**。这个文件跑在别人的机器上，装不上东西也得能用，
// 所以只用 node 内置模块；形态是 CommonJS（包里其它文件都是 CJS，`files` 白名单已含 `lib/`）。
//
// ── 三处刻意"不顺手改好"的地方（改了就会与 MoonBit 版对不上账） ──────────────
//
//   ① `excerpt` 的 120 是 **UTF-16 码元**（MoonBit 的 `String::length` 就这个口径，实测
//      `"😀abc".length() == 5`），不是字节、也不是码点；
//   ② 空白裁剪自己写（`moonTrim`）：MoonBit 的 `trim` 只削 空格/\t/\n/\r 四个，
//      JS 内建的 `trim` 会把 BOM、NBSP、\v、\f、全角空格一起削掉 —— 差额直接进 `text`；
//   ③ 命中判定用的是**未裁剪的原始行**（`excerpt` 只影响打印出来的文本，不参与匹配）。
//
// ── 标签表的来源：解析真源，不抄一份 ────────────────────────────────────────
//
// "映射 44 条 / 排除 12 条"的真源是 moobile 库的 `<lib>/render.mbt`。MoonBit 版**在运行时解析它**
// 而不是把清单抄进源码（抄一份就会漂一份），这一份照做：`opts.lib` 与 CLI 的 `--lib` 同一含义。
// 读不到就**直接抛错**，绝不回落成 "0 条" —— 静默地少掉一半分类，正是这个工具要消灭的那种失败
// （MoonBit 版此时也会 `IOError` 收场，行为一致：响，而不是静默）。
//
// ⚠️ 已知的**有意不覆盖**项写在文件末尾，读之前先看那一段。

'use strict';

const fs = require('fs');
const path = require('path');
// 「挂在不会响的标签上的 `on_click`」那条判据的**唯一实现**（`create.js` 也 require 这一份）。
const { scanClickOnView, clickHitNote } = require('./click-on-view.js');

// ── 目录剪枝（**本工具自己一张表**，刻意不与仓库里 `cr-scan` 的共用）──────────
//
// 为什么不共用：两者的活不同 —— `cr-scan` 管的是**我们自己仓库**的行尾，而这里扫的是
// **别人的项目**，会撞见我们仓库里不存在的东西。
// `.repos` 是实测加上的：`interest/yi` 里有一份 MoonBit 标准库的源码检出，
// 第一版报告因此数出 881 个文件 / 219886 行，其中 700+ 来自 `.repos/moonbitlang/core/…`
// —— 那不是"要迁移的项目代码"，会把报告淹没。这条只有拿真项目跑一次才看得见。
const PRUNE = [
  '.git',
  '_build',
  'target',
  '.mooncakes',
  'node_modules',
  '.repos',
  'dist',
  '.expo',
  '.cache',
];

// 扫描的扩展名。`.html` **必须在**：真实项目常把 CSS 内联在 HTML 的 `<style>` 里
// （`interest/yi` 就是这样：476 行 CSS 全在 `backend/index.html`）。
// 只扫 `.css` 会得出"这个项目没有样式问题"的错误结论。
const SCAN_EXTS = ['mbt', 'mod', 'css', 'html', 'htm'];

// 命中判定里"调用点前面算分隔符"的那组字符（见 `hasDslCall`）。
const CALL_SEPARATORS = [' ', '\t', '(', ',', '[', '=', '>'];

// 空白裁剪的字符集：**只有**这四个（实测：BOM/NBSP/\v/\f/全角空格/U+2028 都不削）。
const TRIM_CHARS = [' ', '\t', '\n', '\r'];

// 自动化程度四档（SCAFFOLD §3.7.3 的同一套口径）。顺序即报告顺序：**越早越该先处理**。
//
// 它不进 JSON（JSON 里每条 finding 自带宽 `auto`），导出它是给**报告层**用的：
// 汇总表要按这个顺序分组，另抄一份就等于给"口径"造第二个真源。
const AUTO_ORDER = ['必须改', '自动', '半自动', '不自动', '人决定'];

// ── 规则 1：按行子串匹配的 14 条 ────────────────────────────────────────────
//
// 顺序即输出顺序，`id`/`auto`/`why`/`next` 与 MoonBit 版**逐字相同**（对账门会逐条比 why/next）。
// 每条**必须**有 `next`（判据 S9-5：报告里没有"未知"这一类）。
const RULES = [
  // ── 样式（分母最大的一块）────────────────────────────────────────────────
  {
    id: 'style.class',
    auto: '半自动',
    why: 'CSS 类名在 moobile 里没有对应物：样式是**类型化**的 `Attrs::styles(Style)`，属性集封闭。',
    next: 'F2 样式层半自动（CSS → Style 调用）；`:hover`/媒体查询那部分见各自那条。',
    needle: 'class=',
    exts: ['mbt'],
  },
  {
    id: 'style.inline',
    auto: '半自动',
    why: '`Attrs::style(String)` 这个字符串通道**已被删除**（实测零调用点），结构化样式只能走 `Style`。',
    next: 'F2：把字符串样式改写成 `@style.Style::new()…`；数值/颜色可直接搬。',
    needle: 'style=',
    exts: ['mbt'],
  },
  {
    id: 'css.hover',
    auto: '人决定',
    why: 'RN 没有伪类。`:hover` 在触屏上本来也不存在（没有 hover 状态）。',
    next: 'F3 指南：改成「由状态驱动的条件样式」（把 hover 的那组属性在 Model 里表达）。',
    needle: ':hover',
    exts: ['css', 'html'],
  },
  {
    id: 'css.media',
    auto: '半自动',
    why: 'RN 没有媒体查询；响应式靠 `Dimensions` / `useWindowDimensions` 在 JS 里算。',
    next: 'F2/F3：断点转成「按尺寸选样式」的函数（宿主侧已能拿到窗口尺寸，见 N5b 的 `geometry`）。',
    needle: '@media',
    exts: ['css', 'html'],
  },
  {
    id: 'css.grid',
    auto: '半自动',
    why: 'RN 没有 grid 布局，只有 flex。',
    next: 'F3 指南：`display:grid` → flex 容器 + 显式换行（`flexWrap`）。',
    needle: 'display: grid',
    exts: ['css', 'html'],
  },
  {
    id: 'css.sticky',
    auto: '人决定',
    why: 'RN 没有 `position: sticky`。',
    next: '三方补齐（`nandorojo/sticky` 一类的库）或改成固定头 + 滚动容器。',
    needle: 'sticky',
    exts: ['css', 'html'],
  },
  {
    id: 'css.var',
    auto: '自动',
    why: 'CSS 自定义属性（`var(--x)`）在类型化样式里没有对应物。',
    next: 'F2：在迁移时**展开成字面量**（值从 `:root` 块里读）。',
    needle: 'var(--',
    exts: ['css', 'html'],
  },
  // ── 浏览器能力直连 ───────────────────────────────────────────────────────
  {
    id: 'dom.direct',
    auto: '半自动',
    why: '`@dom.*` 是浏览器 API 直连；RN 上 `document` 根本不存在（`window` 存在但里面是空的）。',
    next: 'N 轨道能力包（`MOBILE_HOST` 注册表）；canvas 那部分已有一条现成通道，见 `canvas.api`。',
    needle: '@dom.',
    exts: ['mbt'],
  },
  // ── 手势与坐标（yi 的罗盘就在这一档）────────────────────────────────────
  {
    id: 'gesture.mouse',
    auto: '不自动',
    why:
      '**读坐标的处理器在 RN 上拿到的是零值** —— 全库普查后整表换成 `passthrough_decoders()`，它的 `Mouse`/`Keyboard`/`Scroll` 三个载荷**无条件返回 0**（`vendor/rabbita/html/event_decoders.mbt` 明写「已知降级，不是等价替换」）。',
    // ⚠️ 这条原本写的是「手势通道**尚未实现**（T3.4）」—— 2026-10-01 手势通道落地后**过时了**。
    //    报告的说辞也是产物：说错了会把人引到"先去做一条已有的通道"上（F1 的价值全在"下一步"准不准）。
    next: '**手势通道已落地**（`@gesture.attrs(on_pan=…)` / `@gesture.pan(attrs, msg)`，宿主默认装载、零新依赖）：`on_mousedown/move/up` 换成**一个** `pan` 处理器，坐标从 `Gesture` 的 `x/y`（**元素内**）取。判据：web 40/40 + 真机 18/18。⚠️ 多指（pinch/rotate）真机未验。',
    needle: 'on_mouse',
    exts: ['mbt'],
  },
  {
    id: 'gesture.coord',
    auto: '不自动',
    why: '坐标换算依赖 DOM 的布局信息（`getBoundingClientRect` / `devicePixelRatio`），RN 上没有这些。',
    next: '量原点这件事**已经收进手势通道**了（`Gesture` 的 `x/y` 就是元素内坐标，真机验过 `深 起=130,50`）；剩下的是**画布侧**的 `devicePixelRatio` 换算（T3.5，未验）。',
    needle: 'getBoundingClientRect',
    exts: ['mbt'],
  },
  {
    id: 'gesture.dpr',
    auto: '半自动',
    why: '`devicePixelRatio` 是浏览器概念；RN 用 `PixelRatio.get()`。',
    next: 'T3.5：换算收进画布/手势通道内部，应用侧不用自己算。',
    needle: 'devicePixelRatio',
    exts: ['mbt'],
  },
  // ── 输入 / 网络 / 画布 ───────────────────────────────────────────────────
  {
    id: 'input.controlled',
    auto: '半自动',
    why: '受控输入的**事件载荷通道已落地**（I1：`Attrs::on_raw` + `Payload::text/json/num/bool/field`）。',
    next: '把 `on_input=emit.map(f)` 换成 `on_raw("change", e => …)`，值从 `e.text()` 取。',
    needle: 'on_input',
    exts: ['mbt'],
  },
  {
    id: 'net.http',
    auto: '半自动',
    why: 'rabita 的 `@rhttp` 依赖 DOM/浏览器的 fetch 语义；moobile 有 `XiLaiTL/moobile/http` 转发包。',
    next: '换成 `XiLaiTL/moobile/http`；⚠️ 它在 RN 上的传输层**未验过**（见 STATUS §4）。',
    needle: '@rhttp.',
    exts: ['mbt'],
  },
  {
    id: 'canvas.api',
    auto: '半自动',
    why: 'canvas 在标签表里是**明确排除**的（RN 无 canvas）。',
    next: '**画布通道已落地**（`@canvas.OpCtx`，32 项判据）：方法名与 `CanvasRenderingContext2D` 逐字相同，迁移是换类型；真机也验过（`canvas-spike` 7/7、`canvas-demo` 12/12）。⚠️ 仍差**文字字形**（`makeFont`）与 **`devicePixelRatio` 换算**（T3.5）。',
    needle: 'CanvasRenderingContext2D',
    exts: ['mbt'],
  },
];

// ── 规则 2：两条"按真源两张表分类"的标签 finding ─────────────────────────────
//
// 计数口径：**命中行数**（一行里同一个标签出现两次算一次）。为什么不按"去重后的标签名"计数：
// 迁移时人要改的是**位置**，不是"有哪些标签"。去重后的标签名另附在 `why` 末尾 ——
// 两个口径都有用，别混。
const TAG_IDS = ['tag.excluded', 'tag.outside'];
const TAG_AUTO = ['人决定', '人决定'];
const TAG_WHY = [
  '这 12 个标签是**明确排除**的（`render.mbt` 的 `excluded_tags()`）：RN 没有对应物，所以不映射 —— 用它们等于「看起来能跑」。',
  '标签表之外的标签一律**回落 `View`** 并计进 `unmapped_tag_count`（迁移诊断的支点，但**运行时不会提醒你**）。',
];
const TAG_NEXT = [
  '接第三方组件库（I 轨道）或改写成真实组件。**已有的替代物**：`canvas`（画布通道）。',
  '人决定：改写成表内标签，或走组件通道（`库名:组件名`）。',
];
// 命中的标签**去重清单**附在 `why` 后面：计数口径是"行"，而"涉及哪些标签"是另一个问题
// （两个都要，别让读者自己去明细里数）。这条后缀与 MoonBit 版逐字相同。
const TAG_NAMES_NOTE = '\n\n**命中的标签**（去重）：';

// ── 规则 3：依赖与构建目标（读 `moon.mod`，不是子串扫源码）──────────────────
const DEP_RABBITA = {
  id: 'dep.rabbita',
  auto: '必须改',
  why: '两个 rabbita 的 `Html` / `VNode` / `Attrs` 是**不同包的不同类型**，混用编不过；也不能同时 import 两个 `@html`（SCAFFOLD §3.7.2）。',
  next: '换成 `XiLaiTL/moobile`；判据：`moon.mod` 里只剩一条 rabbita 来源、`moon tree` 不出现 `moonbit-community/rabbita`。',
};
const TARGET_BUILD = {
  id: 'target.build',
  auto: '自动',
  why: 'moobile 的库**只支持 js 目标**（传递性 js 锁）；既有项目常见 `wasm-gc` / `native`。',
  next: '改 `preferred_target` / `supported_targets`（机械改动，无风险）。',
};

// ── HTML 标签候选名单（判定"这个 token 是不是标签"用）──────────────────────
//
// ⚠️ 它是**候选**，不是"moobile 支持的标签"：支持与否由 `<lib>/render.mbt` 的两张表决定，
// 这里只负责把"看起来像标签的 token"挑出来，再交给那两张表分类。
// 顺序有意义：一行里有多个标签时，`tagCandidates` 按**本名单的顺序**产出，命中明细的顺序、
// 以及 `why` 里去重清单的顺序都由它决定。
const HTML_TAGS = [
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo',
  'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col',
  'colgroup', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
  'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins',
  'kbd', 'label', 'legend', 'li', 'link', 'main', 'map', 'mark', 'menu', 'meta', 'meter',
  'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre',
  'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'slot',
  'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup', 'svg', 'table',
  'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr',
  'track', 'u', 'ul', 'var', 'video', 'wbr',
];

// ── 小工具：与 MoonBit 版同口径的字符串/路径操作 ─────────────────────────────
//
// 为什么路径工具自己写：`path.basename`/`path.extname` 是**宿主平台**语义
// （Windows 下 `path.extname('a/b.CSS')` 之类的细节，以及 `path.basename('a\\b')` 认反斜杠），
// 而 MoonBit 版对**相对路径字符串**做的是"找最后一个 `/` / 最后一个 `.`"。
// 两边必须同口径，否则同一棵树在 Windows 上会数出不同的文件集。

/** 路径里任一**段**命中剪枝表就整支跳过（文件也一样，不只是目录）。 */
function pruneHit(rel) {
  return rel.split('/').some((seg) => PRUNE.indexOf(seg) >= 0);
}

/** `a/b/c.mbt` → `c.mbt`。只认正斜杠（`collectScanned` 产出的相对路径一律正斜杠）。 */
function basename(rel) {
  const i = rel.lastIndexOf('/');
  return i < 0 ? rel : rel.slice(i + 1);
}

/** 有多个点号取最后一段（`.gitignore` → `gitignore`，与 MoonBit 版一致）。 */
function extname(base) {
  const i = base.lastIndexOf('.');
  return i < 0 ? '' : base.slice(i + 1);
}

/** 这个相对路径是不是"要扫的文件"（扩展名白名单，大小写敏感）。 */
function isScanned(rel) {
  return SCAN_EXTS.indexOf(extname(basename(rel))) >= 0;
}

/**
 * MoonBit 的 `String::trim`：**只**削 空格 / \t / \n / \r。
 *
 * 为什么不能用 JS 内建的 `trim()`：它会连 BOM、NBSP、\v、\f、全角空格、U+2028 一起削，
 * 而 MoonBit 实测一个都不削（`"\u{FEFF}x".trim()` 仍是带 BOM 的）。差额会直接进 `text` 字段。
 */
function moonTrim(s) {
  let a = 0;
  let b = s.length;
  while (a < b && TRIM_CHARS.indexOf(s[a]) >= 0) a++;
  while (b > a && TRIM_CHARS.indexOf(s[b - 1]) >= 0) b--;
  return s.slice(a, b);
}

/**
 * 行摘录：压掉两端空白并截断，免得报告被一行超长代码撑爆。
 *
 * 120 是 **UTF-16 码元**（MoonBit 的 `String::length` 口径，实测 `"😀abc"` 是 5）。
 *
 * ⚠️ 返回值必须**拉平**（`split('').join('')`），这不是洁癖：
 * V8 的 `slice` 返回的是 SlicedString —— 它**引用父串**，而这里的父串一路指到**整份文件文本**。
 * 于是每条命中的 `text` 都会把**整份文件**吊在内存里（哪怕只摘了 120 个字符）。
 * 实测（100 份 × 460 KB 的文件，只保留每份 50 个字符的切片）：不拉平 RSS `55.9 → 87.2 MB`
 * （差额 = 整棵树）；拉平后回到 `55.9 MB`。为什么非要在这里管：MoonBit 版一次只留一份文件文本，
 * 不拉平的话"命中多的项目"会比 MoonBit 版**更吃内存** —— 而"大文件整份进内存"正是要防的事。
 * 为什么不用 `Buffer.from(…).toString()` 那条路：utf8 编解码会把**孤立代理项**换成 U+FFFD
 * （那是顺手改数据），而 `split('')`/`join('')` 只搬 UTF-16 码元，一个都不改。
 */
function excerpt(line) {
  const t = moonTrim(line);
  const cut = t.length <= 120 ? t : t.slice(0, 120) + '…';
  return cut.split('').join('');
}

/**
 * 一行里有没有一次**像 DSL 调用**的 `name(`。
 *
 * 为什么要看**前一个字符**（第一版只看 `name(` 子串，结果假阳性一堆）：
 * `arr.map(…)` / `x.time(…)` / `data.slot(…)` 里的 `map` / `time` / `slot`
 * 也都是 `name(` 形状，而它们**都是 HTML 标签名**（`<map>` `<time>` `<slot>`）——
 * 于是 `Array::map(` 被数成了"用了 `<map>` 标签"。
 * 判据：调用点前面必须是**分隔符位置**（行首 / 空白 / `(` / `,` / `[` / `=` / `>`），
 * 或者它是 `@html.name(` 这种显式前缀。`x.map(` 前面是 `.` → 排除。
 */
function hasDslCall(line, name) {
  const needle = name + '(';
  const n = line.length;
  let from = 0;
  while (from <= n) {
    const at = line.indexOf(needle, from);
    if (at < 0) return false;
    const prevOk =
      at === 0
        ? true
        : at >= 6 && line.slice(at - 6, at) === '@html.'
          ? true
          : CALL_SEPARATORS.indexOf(line.slice(at - 1, at)) >= 0;
    if (prevOk) return true;
    from = at + 1;
  }
  return false;
}

/**
 * 从一行里挑出可能的**标签名**：像 DSL 调用的 `name(`，且 name 在 HTML 标签候选名单里。
 *
 * 为什么要有"候选"这一层：`ring_draw(` / `push(` / `println(` 也都是 `name(` 形状，
 * 没有候选名单就会把普通函数调用当成标签 —— 报告里全是噪声，人就不看了。
 */
function tagCandidates(line) {
  const out = [];
  for (const name of HTML_TAGS) {
    if (hasDslCall(line, name)) out.push(name);
  }
  return out;
}

/** 标签名分类：先用**映射表**接（`classify_tag` 的顺序就是这个先后）。 */
function classifyTag(name, mapped, excluded) {
  if (mapped.indexOf(name) >= 0) return 'mapped';
  if (excluded.indexOf(name) >= 0) return 'excluded';
  return 'outside';
}

/**
 * 从一行里取出 `("tag", …)` 的第一个字符串。取不到返回 `null`。
 *
 * 形状： `("div", "View"),` —— 只看开头两个字符：`(` 和 `"`。
 */
function parseTagEntry(line) {
  const t = moonTrim(line);
  if (t.length < 3 || t[0] !== '(' || t[1] !== '"') return null;
  const body = t.slice(2);
  const i = body.indexOf('"');
  return i < 0 ? null : body.slice(0, i);
}

/**
 * 从 `<lib>/render.mbt` 里解析两张表（映射表 / 排除表）。
 *
 * 解析方式刻意**朴素**（按行的 `("tag", …)` 形状）而不是写一个 MoonBit 语法树 ——
 * 目的是"读真源"，不是"做一个解析器"。真源换了写法，这里会**数出 0 条**，
 * 而报告里会写"表来源 + 条数"，于是 0 条一眼可见（不许静默）。
 */
function parseRenderTables(lib) {
  const file = lib + '/render.mbt';
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    // 读不到就**抛**，不回落成空表：空表会把每个标签都判成 outside，
    // 于是报告看起来"更严重"，而实际是分类彻底失效 —— 那是最坏的一种错。
    throw new Error(
      `读不到标签表真源 ${file}（${err.message}）：` +
        '请把 moobile 库根目录用 `lib` 传进来（对应 CLI 的 `--lib`）。'
    );
  }
  const mapped = [];
  const excluded = [];
  let section = '';
  for (const raw of text.split('\n')) {
    // 分段：先找到两段的开头。⚠️ `pub fn ` 的判定只看**行首**（不 trim），与 MoonBit 版一致。
    if (raw.indexOf('fn tag_table(') >= 0) section = 'mapped';
    else if (raw.indexOf('fn excluded_tags(') >= 0) section = 'excluded';
    else if (raw.startsWith('pub fn ') && section !== '') section = '';
    if (section === '') continue;
    const name = parseTagEntry(raw);
    if (name === null) continue;
    if (section === 'mapped') mapped.push(name);
    else excluded.push(name);
  }
  return { mapped, excluded };
}

/**
 * 递归收集候选文件的**相对路径**（正斜杠，便于跨平台比对与输出）。
 *
 * ⚠️ 与 MoonBit 版同样的两点：① 用 `statSync`（**跟随符号链接**）判目录，
 * 因此指向目录的链接会被递归进去；② 剪枝在 `stat` **之前**（剪掉的目录不会被 stat）。
 * ③ 顺序**不排序**：直接照 `readdirSync` 的返回序（MoonBit 侧同样是 `readdirSync`）。
 * 排序看着更"稳"，但它会让两侧的命中明细顺序对不上账 —— 对账比"稳"重要。
 */
function collectScanned(root, rel, out) {
  const dir = rel === '' ? root : root + '/' + rel;
  for (const name of fs.readdirSync(dir)) {
    const child = rel === '' ? name : rel + '/' + name;
    if (pruneHit(child)) continue;
    if (fs.statSync(root + '/' + child).isDirectory()) collectScanned(root, child, out);
    else if (isScanned(child)) out.push(child);
  }
}

const IS_WIN = process.platform === 'win32';

/** git bash 形态的盘符路径（`/` + 一个盘符字母 + `/` + 剩余路径）。 */
const MSYS_DRIVE = /^\/([a-zA-Z])\/(.*)$/;

/**
 * 统一成"正斜杠绝对路径"：JSON 的 `root` 字段要能在 Windows 与 POSIX 上读成同一个东西。
 *
 * ⚠️ Windows 上必须先认一下 git bash 形态的盘符路径（`/` + 一个字母 + `/` + 剩余）：
 * node 会把它当成**当前盘的根相对路径**解析，于是那个盘符字母被当成一级目录名、整条路径错位一级，
 * 而且错得**静默** —— 报出来只是"目录不存在"，看着像路径打错了。
 * 本仓库的文档与命令示例都用这种写法，所以在 Node 里跑很容易踩到；认出来就好。
 * 这是**路径形态的容忍**，不动任何扫描规则（MoonBit 版靠 shell 转 argv 达到同样效果）。
 */
function toPosixAbs(p) {
  let s = String(p);
  if (IS_WIN) {
    const m = MSYS_DRIVE.exec(s);
    if (m) s = m[1].toUpperCase() + ':/' + m[2];
  }
  return path.resolve(s).split(path.sep).join('/');
}

/**
 * F1 迁移动检：扫一个**既有的 rabbita 项目**，列出迁移到 moobile 后会**静默失效**的东西。
 *
 * 返回值与 `bash tools/mb.sh migrate-scan --root … --json` 的 JSON **结构等价**：
 * `{ root, files, lines, table: { mapped, excluded }, findings: [{ id, auto, why, next, count, hits: [{ file, line, text }] }] }`
 * —— 字段名、字段含义、findings 顺序、hits 顺序全部一致（判据见 `tools/migrate_scan_reconcile.mjs`）。
 *
 * @param {object} opts
 * @param {string} opts.root 既有 rabbita 项目目录（相对路径按**本进程 cwd** 解析，与 CLI 同规矩）。
 * @param {string} [opts.lib] moobile 库根目录（里面有 `render.mbt`）—— 标签表真源。
 *   不给则用 `process.cwd()`（CLI 的默认是"调用者的 cwd"，同口径）。
 * @param {number} [opts.top] 报告里每类最多列几条明细。**对返回值没有任何影响**：
 *   JSON 是全量的，`--top` 只管人读的那份报告。留着它只为了与 CLI 的参数面一一对应
 *   （CLI 的默认是 8，这里默认 10）；将来接报告层时拿它去截断。
 * @returns {{root: string, files: number, lines: number, table: {mapped: number, excluded: number}, findings: Array<object>}}
 */
function scanProject(opts) {
  const o = opts || {};
  if (!o.root) {
    throw new Error('scanProject 需要 root —— 既有 rabbita 项目目录（对应 CLI 的 --root）');
  }
  const root = toPosixAbs(o.root);
  const lib = o.lib ? toPosixAbs(o.lib) : toPosixAbs(process.cwd());

  const { mapped, excluded } = parseRenderTables(lib);

  const files = [];
  collectScanned(root, '', files);

  // ── 一趟扫完（每条规则、标签分类、moon.mod 两项、总行数）──────────────────
  //
  // 为什么是"每个文件只读一次、一趟里算完所有规则"，而不是 MoonBit 版那样"按规则重读文件"：
  // MoonBit 版的形状是「规则在外层、文件在内层、行在最里层」，所以同一份文件会被读 18 次；
  // 这里把最外层换成文件，产出的命中顺序**完全一样**（每条规则内部仍是"先文件序、后行序"，
  // 而标签/依赖两类的文件序也没变），却只读一遍 —— 内存里同时只有**一份**文件的内容，
  // 与 MoonBit 版的内存画像相同（都是"一次一个文件"，都不会把整棵树的文本攒起来）。
  // ⚠️ 唯一的可观察差别：文件在扫描**中途**被改写时，MoonBit 版可能读到半新半旧的两份。
  const results = RULES.map(() => []);
  const tagHits = [[], []];
  const tagNames = [[], []];
  const depHits = [];
  const targetHits = [];
  // 「标签 + 事件」那条结构规则的命中（不是按行子串，所以要单独攒 —— 见下面的 finding）
  const clickHits = [];
  let scannedLines = 0;

  for (const rel of files) {
    const ext = extname(basename(rel));
    const base = basename(rel);
    const text = fs.readFileSync(root + '/' + rel, 'utf8');
    const lines = text.split('\n');
    // 行数口径与 MoonBit 版一致：`split("\n")` 的长度（所以"末行无换行"不会少算，
    // 而"末尾空行"会多算一行 —— 这是它的口径，不是 bug，别在这里"修正"）。
    scannedLines += lines.length;

    for (let r = 0; r < RULES.length; r++) {
      const rule = RULES[r];
      if (rule.exts.indexOf(ext) < 0) continue;
      for (let i = 0; i < lines.length; i++) {
        // 命中判定用**未裁剪的原始行**（缩进、\r 都还在）—— 与 MoonBit 版一致。
        if (lines[i].indexOf(rule.needle) >= 0) {
          results[r].push({ file: rel, line: i + 1, text: excerpt(lines[i]) });
        }
      }
    }

    if (ext === 'mbt') {
      // ── 结构规则：`on_click` 挂在非 `Pressable` 的标签上（单行子串判不出来）──
      // 命中判定与 `excerpt` 都用**同一份原始文本**：与那 14 条规则的口径一致（注释里的代码同样算）。
      for (const h of scanClickOnView(text)) {
        clickHits.push({
          file: rel,
          line: h.line,
          text: excerpt(lines[h.line - 1] === undefined ? '' : lines[h.line - 1]) + clickHitNote(h.tag),
        });
      }
      for (let i = 0; i < lines.length; i++) {
        for (const name of tagCandidates(lines[i])) {
          const cls = classifyTag(name, mapped, excluded);
          const slot = cls === 'excluded' ? 0 : cls === 'outside' ? 1 : -1;
          if (slot < 0) continue;
          if (tagNames[slot].indexOf(name) < 0) tagNames[slot].push(name);
          tagHits[slot].push({
            file: rel,
            line: i + 1,
            text: excerpt(lines[i]) + '   ← 标签 `' + name + '`',
          });
        }
      }
    }

    if (base === 'moon.mod') {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.indexOf('moonbit-community/rabbita') >= 0 || line.indexOf('tiye/rabbita') >= 0) {
          depHits.push({ file: rel, line: i + 1, text: excerpt(line) });
        }
        if (line.indexOf('preferred_target') >= 0 || line.indexOf('supported_targets') >= 0) {
          if (line.indexOf('wasm') >= 0 || line.indexOf('native') >= 0 || line.indexOf('js') >= 0) {
            targetHits.push({ file: rel, line: i + 1, text: excerpt(line) });
          }
        }
      }
    }
  }

  const findings = [];
  for (let r = 0; r < RULES.length; r++) {
    const rule = RULES[r];
    findings.push({
      id: rule.id,
      auto: rule.auto,
      count: results[r].length,
      why: rule.why,
      next: rule.next,
      hits: results[r],
    });
  }

  // ── 结构规则：`on_click` 挂在**不会响的标签**上（`div` / `span` / `p` …）────────
  //
  // 放在这里（而不是当成第 15 条 `RULES` 项）：`RULES` 的契约是**按行子串匹配**，
  // 这一条要的是"标签 + 事件"的结构关系 —— 塞进去会让那条契约名不副实，
  // 也会让"为什么它不在规则表里"这件事失去记录（`click-on-view.js` 的文件头写了）。
  // ⚠️ 位置参与对账（finding 顺序即报告顺序），所以 MoonBit 侧也必须插在同一处。
  findings.push({
    id: 'click.on-view',
    auto: '人决定',
    why:
      '`on_click` 在 moobile 里映射成 RN 的 `onPress`，而标签表里**只有 `button` / `a` 落到 `Pressable`**；' +
      '`div` / `span` / `p` 落到 `View` / `Text`，那两个组件没有 `onPress` —— 点击被**丢掉**，不报错、不警告。',
    next:
      '把标签换成 `button`（要语义就用 `a`）—— **换标签，不是加样式**；换完这个块才有真的点击。',
    count: clickHits.length,
    hits: clickHits,
  });

  // ── 标签分类（要"真源两张表"，不是模式匹配）──
  for (let t = 0; t < TAG_IDS.length; t++) {
    const namesNote = tagNames[t].length > 0 ? TAG_NAMES_NOTE + tagNames[t].join('、') : '';
    findings.push({
      id: TAG_IDS[t],
      auto: TAG_AUTO[t],
      count: tagHits[t].length,
      why: TAG_WHY[t] + namesNote,
      next: TAG_NEXT[t],
      hits: tagHits[t],
    });
  }

  // ── 依赖与构建目标 ──
  findings.push({
    id: DEP_RABBITA.id,
    auto: DEP_RABBITA.auto,
    count: depHits.length,
    why: DEP_RABBITA.why,
    next: DEP_RABBITA.next,
    hits: depHits,
  });
  findings.push({
    id: TARGET_BUILD.id,
    auto: TARGET_BUILD.auto,
    count: targetHits.length,
    why: TARGET_BUILD.why,
    next: TARGET_BUILD.next,
    hits: targetHits,
  });

  // ⚠️ 字段名与**字段顺序**都照 CLI 那份 JSON（`root/files/lines/table/findings`；
  // 每条 finding 是 `id/auto/count/why/next/hits`）：`JSON.stringify` 的键序就是插入序，
  // 于是"把两侧结果存下来 diff"能直接对得上，不用先排序重建。
  return {
    root,
    files: files.length,
    lines: scannedLines,
    table: { mapped: mapped.length, excluded: excluded.length },
    findings,
  };
}

module.exports = { scanProject, AUTO_ORDER };

// ── 已知的**有意不覆盖**（诚实清单，与对账门的判据边界一致；两条已实测）────────
//
//   ① **截断点切开代理对**（astral 字符正好跨第 120 个码元）：MoonBit 的 `String::sub`
//      遇到半个 surrogate 会 **panic** —— 实测 `bash tools/mb.sh migrate-scan --root <含该行的项目>`
//      以 `$PanicError at excerpt (migrate_scan.mbt:299)` 收场、退出码 1（CLI 的 try/catch 抓不住它），
//      而这里会切出一个孤立代理项。对账门此时报**"对账无法进行"（exit 2）**而不是"不一致"（exit 1），
//      因为红的是 MoonBit 侧、这边无可比。**不修**：修它等于把"我们的切片要不要也 panic"写进规则。
//   ② **非法 UTF-8 字节**：MoonBit 侧走 `@unicode.to_utf8_string`（朴素的按首字节长度吃字节），
//      这里走 node 的 UTF-8 解码。实测（一行 `class="x"` + 0xFF 0xFE + ` end`）：
//      两侧 `count` 与逐 hit 的 `file:line` **完全一致**，只有 `text` 不同 ——
//      node 是 `…"x"<U+FFFD><U+FFFD> end`，MoonBit 把 0xFF 当成 4 字节序列的起始，
//      于是连 ` ` 和 `e` 一起吃掉，得到 `…"x"<U+FFFD><U+FFFD>nd`。
//      也就是说**这种项目会让门红**（红在 `hits(text)`，不会静默）。**不修**：
//      要一致就得在 JS 里照抄那个会把字节吃掉的解码器，而那是在抄一个缺陷。
//   ③ **扫描途中文件被改写**：这里一趟读完（每个文件只读一次），MoonBit 版每个规则重读一遍，
//      所以后者可能看到同一文件"半新半旧"的两次读取结果。
//   ④ 本文件**不含**任何 CLI/打印逻辑（不产出人读的那份 Markdown 报告）：
//      只做 `--json` 那一份数据的等价物。
//   ⑤ `render.mbt` **没有**自动发现：`lib` 不传就用 `process.cwd()`（与 CLI 的默认同口径），
//      而 npm 发布的包里**没有** render.mbt —— 所以真要给使用者用，接 CLI 时得把
//      `lib` 指到使用者工程里的 moobile 库（例如 `.mooncakes/XiLaiTL/moobile`）。
//      读不到就**抛错**，不回落成"0 条"（见 `parseRenderTables` 那段注释）。

