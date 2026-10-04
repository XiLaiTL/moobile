#!/usr/bin/env node
// press_order_check.mjs —— **按下态（`Style::press`）组装顺序的判据门**
//
//   node tools/press_order_check.mjs
//
// ## 为什么必须有这条门（这是本轮最贵的一课）
//
// 第十七轮"验过生成器"验的是**数量**：`grep -c '.press()'` ⇒ 10 个函数生成了这个块，
// 于是认为按下态这一路没问题。而它产出的**语义是反的** ——
// `emitModule` 把常态调用写在 `.press()` **之前**、把源 CSS 的 `:hover` 写在它**之后**，
// 而 `Style::press` 的语义是"给**它前面**的键加 `press:` 前缀"（`style/style.mbt`），
// 于是常态与按下态**整体互换**：
//
//   · `button.bagua-mode` 的常态只剩 `borderColor` + `color` 两条 ——
//     没内边距、没底色、没边框、没字号，**按住才变成一个按钮**；
//   · `div.hex-card` 的 `min_width(116.0)` / `flex_grow(1.0)`（grid 子项降级补的，
//     是**常态**调用）也被标成按下态 ⇒ **网格只在按住时才是网格**。
//
// ⇒ **数量判据发现不了语义问题**（`docs/FINDINGS.md` 第十八轮的结论）。
//   所以这条门的形状是：拿**真的 `emitModule`** 跑最小夹具，再按 `Style::press` 的语义
//   把生成的链**推一遍**，断言最终常态/按下态各拿到什么值。
//
// ## 关于"推一遍"这件事的诚实说明
//
// 下面的 `splitPlainAndPressed` 是一个 6 行的模型，它对应 `style/style.mbt` 的
// `Style::press`（把它前面的键全部搬进按下态、后面的键留在常态）。
// **它当然是模型，不是库本身** —— 钉住库那一侧的是 `render_wbtest.mbt` 里的
// `press 链：hover 在前、.press() 居中、常态在后 —— 这样才对`（那条验的是
// `Style::press` 本身的语义）。两半合起来才成立：
//   · 那条 MoonBit 判据说"`.press()` 只给前面的键加前缀"；
//   · 这条门说"生成器把 hover 放在前面、常态放在后面"。
// 单看任何一半都会漏，所以**两半都不要删**。
//
// 另外有两组**证伪**（把错形状喂给同一个判据 ⇒ 必须判成"互换"）：
// 只跑"正形状通过"是不够的 —— 那也可能是"判据根本不会红"。

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// `style-emit.js` 是 CommonJS（宿主包那一层都是），在 ESM 里用 createRequire 拿它。
const require = createRequire(import.meta.url);
const MT = require(path.join(ROOT, 'npm/moobile-host/lib/migrate/style-emit.js'));

let pass = 0;
let fail = 0;
const say = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  ok ? pass++ : fail++;
};

/**
 * 跑一次生成器 —— **按下态开关只在这个夹具期间打开**。
 *
 * `DSH_PRESS_FROM_HOVER` 目前默认关（消费侧 `Pressable` 那一刀还没接稳），所以要显式打开
 * 才验得到这条通道。⚠️ 用完必须还原：本进程里再跑别的生成（比如真实应用的比对）时，
 * 拿着开着的开关会算出与磁盘产物不一样的读数，从而**假红**。
 */
function generateWith(files, opts) {
  const prev = process.env.DSH_PRESS_FROM_HOVER;
  process.env.DSH_PRESS_FROM_HOVER = '1';
  try {
    return MT.generate(files, opts).source;
  } finally {
    if (prev === undefined) delete process.env.DSH_PRESS_FROM_HOVER;
    else process.env.DSH_PRESS_FROM_HOVER = prev;
  }
}

/** 取 `pub fn <name>()` 那一格的**函数体**文本（不含头上那串 `///`）。 */
function fnBody(src, name) {
  const head = `pub fn ${name}()`;
  const i = src.indexOf(head);
  if (i < 0) return '';
  const open = src.indexOf('{', i);
  const close = src.indexOf('\n}', open);
  return src.slice(open + 1, close < 0 ? src.length : close);
}

/**
 * 按出现顺序取出链上的 `.方法(参数)`。
 *
 * 两处坑都是第一版实测踩到的（**读数不可信 = 判据不可信**，所以先修这里）：
 *   · **注释里也有 `.press()`** —— 生成器写的那两行注释（"以下在 `.press()` 之前/之后"）
 *     被一起数了进去，于是"`.press()` 出现 3 次"这种假红。先剥掉整行注释。
 *   · **不能用"前导字符不是标识符"来排除限定名**：那样写出来的正则会**吃掉相邻那一格的
 *     边界**，于是 `.a().b().c()` 只数得到 `a` 和 `c`（每两格漏一格）。
 *     改成先把 `@style.` / `@html.` 这类**限定名**的点直接抹掉，再老老实实找 `.name(`。
 */
function callsOf(text) {
  const noComments = text
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  const s = noComments.replace(/@[A-Za-z_][A-Za-z0-9_]*\./g, '@');
  const out = [];
  // 参数里允许**一层**括号（`@style.px(116.0)` 这种），再多就不必了。
  for (const m of s.matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)\(((?:[^()]|\([^()]*\))*)\)/g)) {
    out.push({ name: m[1], arg: m[2].trim(), at: m.index });
  }
  return out;
}

/**
 * `Style::press` 的语义（`style/style.mbt`）：把它**前面**的键全部搬进按下态 ——
 * 新 `Style` 只含带 `press:` 前缀的那些键，原来的键**不再留在常态里**；
 * 它**后面**的键照旧进常态。同键后来者赢（与 `Style` 的构造器一致）。
 */
function splitPlainAndPressed(calls) {
  const plain = new Map();
  const pressed = new Map();
  for (const c of calls) {
    if (c.name === 'press') {
      for (const [k, v] of plain) pressed.set(k, v);
      plain.clear();
      continue;
    }
    plain.set(c.name, c.arg);
  }
  return { plain, pressed };
}

// ── ① 基本夹具：一条常态声明 + 一条 `:hover` 声明 ──────────────────────────────
// 形状取自 `docs/FINDINGS.md` 第十八轮的复现命令（`.c{background:#111}` + `.c:hover{background:#f00}`），
// 只是键名多了一条 `color` —— 为了能断言"常态**不是只剩一条**"（丢键也一起挡住）。
const BASIC = {
  files: [
    {
      rel: 'basic.html',
      text: '<style>.c{background:#111;color:#eee}.c:hover{background:#f00}</style>',
    },
  ],
  sites: [{ key: 'div.c', own: { tag: 'div', classes: ['c'] }, chain: [], inLoop: false }],
};

const basicSrc = generateWith(BASIC.files, { appName: 'press-fixture', sites: BASIC.sites });
const basicBody = fnBody(basicSrc, 'div_c');
const basicCalls = callsOf(basicBody);
const basicPressAt = basicCalls.findIndex((c) => c.name === 'press');

say(
  basicBody !== '' && basicPressAt >= 0,
  '前提自查：基本夹具里真的产出了 `.press()` 块（不然下面几条没有判据对象）',
);
say(
  basicCalls.filter((c) => c.name === 'press').length === 1,
  `前提自查：\`.press()\` 只出现一次（实测 ${basicCalls.filter((c) => c.name === 'press').length} 次）`,
);

const hoverAt = basicCalls.findIndex((c) => c.name === 'background_color' && c.arg === '"#f00"');
const plainAt = basicCalls.findIndex((c) => c.name === 'background_color' && c.arg === '"#111"');
say(
  hoverAt >= 0 && plainAt >= 0 && hoverAt < basicPressAt && basicPressAt < plainAt,
  `源 CSS 的 \`:hover\` 键在 \`.press()\` **之前**、常态键在**之后**` +
    `（实测位置：hover@${hoverAt} press@${basicPressAt} 常态@${plainAt}）`,
);

const basicSplit = splitPlainAndPressed(basicCalls);
say(
  basicSplit.plain.get('background_color') === '"#111"' &&
    basicSplit.pressed.get('background_color') === '"#f00"',
  '按 `Style::press` 的语义推一遍：常态拿到源 CSS 的**常态**值、按下态拿到 `:hover` 的值' +
    `（实测 常态=${basicSplit.plain.get('background_color')} 按下态=${basicSplit.pressed.get('background_color')}）`,
);
say(
  basicSplit.plain.get('color') === '"#eee"',
  `常态侧**不许只剩一条**：\`color\` 也得留在常态里（实测 ${basicSplit.plain.get('color')}）`,
);

// ── ② grid 子项夹具：降级补出来的 `min_width` / `flex_grow` 必须在常态侧 ────────
//
// 为什么单独一组：`min_width` / `flex_grow` 是**生成器自己补的常态调用**
// （`display:grid` 降级成 `flex(row)+wrap` 之后，列宽只能写在子项上），
// 它们被 `.press()` 一起标成按下态 ⇒ 「网格只在按住时才是网格」。
// 这是第十七轮那个"网格塌成单列"的**真正根因**（当时只挪了 `.press()` 的位置，
// 挪到了错的那一侧），所以必须有一条判据专门钉住它。
//
// 形状照 `interest/yi/zhouyi_reader` 的真实结构：容器 `.hex-index-grid{display:grid;
// grid-template-columns:repeat(auto-fill,minmax(116px,1fr))}` + 循环体里生成的子项
// （`sites[].inLoop`、祖先链为空）。
const GRID = {
  files: [
    {
      rel: 'grid.html',
      text:
        '<style>' +
        '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(116px,1fr))}' +
        '.grid-card{background:#111;padding:8px 12px}' +
        '.grid-card:hover{border-color:#f00}' +
        '</style>',
    },
  ],
  sites: [
    { key: 'div.grid', own: { tag: 'div', classes: ['grid'] }, chain: [], inLoop: false },
    { key: 'div.grid-card', own: { tag: 'div', classes: ['grid-card'] }, chain: [], inLoop: true },
  ],
};

const gridSrc = generateWith(GRID.files, { appName: 'press-grid-fixture', sites: GRID.sites });
const gridBody = fnBody(gridSrc, 'div_grid_card');
const gridCalls = callsOf(gridBody);
const gridSplit = splitPlainAndPressed(gridCalls);

say(
  gridSplit.plain.has('min_width') && gridSplit.plain.has('flex_grow'),
  'grid 子项：生成器补的 `min_width` / `flex_grow` 落在**常态**侧' +
    `（实测 常态侧 min_width=${gridSplit.plain.get('min_width') ?? '(无)'} flex_grow=${gridSplit.plain.get('flex_grow') ?? '(无)'}）`,
);
say(
  !gridSplit.pressed.has('min_width') && !gridSplit.pressed.has('flex_grow'),
  'grid 子项：按下态侧**没有** `min_width` / `flex_grow`' +
    `（否则"网格只在按住时才是网格"；实测 按下态侧 ${[...gridSplit.pressed.keys()].join('/') || '(空)'}）`,
);
say(
  gridSplit.pressed.has('border_color') && !gridSplit.plain.has('border_color'),
  'grid 子项：`:hover` 那条（`border_color`）确实落在**按下态**侧，没有跑进常态' +
    `（实测 按下态=${gridSplit.pressed.get('border_color') ?? '(无)'} 常态=${gridSplit.plain.get('border_color') ?? '(无)'}）`,
);

// ── ③ 证伪：把**错的形状**喂给同一个判据 ⇒ 必须判成"互换了" ────────────────────
//
// 两条错的形状都是真发生过的，不是假想的：
//   ① 第十八轮生成器的形状：常态在前、`:hover` 在 `.press()` 之后 ⇒ 两边整体互换；
//   ② 第十七轮修出来的形状：`min_width` 之类插在 `.press()` **之前**（`.press()` 被
//      放到链尾）⇒ 常态被整体标成按下态、常态侧只剩 `:hover` 那一条。
// 判据定义成"常态与按下态**各自**拿到了正确那一侧的值"，所以错的形状必然被判红。
const expectBasicOk = (calls) => {
  const s = splitPlainAndPressed(calls);
  return s.plain.get('background_color') === '"#111"' && s.pressed.get('background_color') === '"#f00"';
};

const shape18 = callsOf('.new().background_color("#111").color("#eee").press().background_color("#f00")');
const shape17 = callsOf('.new().background_color("#f00").padding_horizontal("12").min_width("116").press().border_color("#111")');
const swap18 = splitPlainAndPressed(shape18);
const swap17 = splitPlainAndPressed(shape17);
say(
  !expectBasicOk(shape18),
  '证伪 ①：第十八轮那种形状（常态在前、`:hover` 在 `.press()` 之后）必须判成互换' +
    `（实测 常态=${swap18.plain.get('background_color')} 按下态=${swap18.pressed.get('background_color')}）`,
);
say(
  !expectBasicOk(shape17) && !swap17.plain.has('min_width'),
  '证伪 ②：第十七轮那种形状（`.press()` 在链尾）必须判出"常态被整体标成按下态"' +
    `（实测 常态侧 ${[...swap17.plain.keys()].join('/') || '(空)'}，按下态侧含 min_width=${swap17.pressed.get('min_width') ?? '(无)'}）`,
);

console.log(`\npress_order_check: 通过 ${pass} 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
