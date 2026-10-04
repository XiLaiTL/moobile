#!/usr/bin/env node
// border_fold_check.mjs —— **分边 `border-*-style` 自动折叠的判据门**
//
//   node tools/border_fold_check.mjs
//
// ## 为什么必须有这条门
//
// 原生 RN **只有四边共用的 `borderStyle`**，没有 `borderTopStyle` / `borderLeftStyle`
// （`tools/style_platform_check.mjs` 那张"原生不认的键"表里登记的 6 个之一）。
// 源 CSS 里 `.m-yao { border-bottom: 1px dashed }` 这种写法迁过来之后，真机上按默认的
// **`solid` 画** —— 而 web 是对的（RNW 当 CSS 照单全收）⇒ 又一处"**web 绿、真机红**"。
//
// 正解是**等价折叠**：几条"有宽度的边"共用同一个 style 时，发一次四边共用的 `borderStyle`
// 是等价的（没宽度的边画不出线，它的 style 是什么都不影响）。
// 本轮实现放在 `style-map.js` 的 `planBorderStyleFold`（生成器侧），这条门守它。
//
// ⚠️★ **"能折"与"不许折"是同一件事的两半**：
//   · 折得动却不折 ⇒ 真机上还是实线（外观错），**这正是本轮修的那个 bug**；
//   · 折不动却折了 ⇒ 把"左实线 + 上虚线"这种**本来能画出一半**的样式**画错**（比不折更糟）。
//   所以夹具里**两种都要有**，而且两组证伪都要做（只跑"折对了"那一半，等于只验了一半）。
//
// 判据（每一条都能单独红）：
//   ① 单边虚线（`border-top: 1px dashed`）⇒ 折成 `.border_style(Dashed)`，**不再有**分边 style 调用；
//   ② 单边实线（`border-left: 2px solid`）⇒ 折成 `.border_style(Solid)`；
//   ③ 两条边**同一个 style**（上/下都 dashed）⇒ 只发**一次** `.border_style(Dashed)`；
//   ④ **两条边 style 不同**（左 solid + 上 dashed，都带宽度）⇒ **一条都不许折**：
//      分边调用原样留着，且说明里要写清"折不成"（人看得懂为什么）；
//   ⑤ 四边共用已经是同一个值时的**冗余分边**（`border-style: solid` + `border-top-style: solid`）
//      ⇒ 分边那条**删掉**、`.border_style` 只出现一次（纯去冗余，不是新增调用）；
//   ⑥ 分边 style **没有宽度**（`border-top-style: dashed` 单独出现）⇒ **不许**报"真机上不生效"
//      那种吓人的假话（明明什么都没画）—— 说明要写"外观一样 / 画不出线"；
//   ⑦ 折完之后**账本不能破**：`silentEmpty`（"算成已映射却零调用零说明"）必须是 0
//      —— 折叠会让一条声明**少掉一个调用**，所以它必须**说明自己去哪了**（否则就是新的静默丢键）；
//   ⑧ 折成功的那些格子里，`mapDeclaration` 原本挂的那句"原生不生效"**必须被去掉**
//      （否则产物里会同时出现"折成了四边共用"与"这条真机不生效"两句自相矛盾的话）。
//
// 两组证伪（把错形状喂给同一套判据 ⇒ 必须判红）：
//   · **关掉折叠**（`MOBILE_NO_BORDER_FOLD=1`）⇒ ①②③⑤ 应当红；
//   · **无脑全折**（`MOBILE_BORDER_FOLD_ALL=1`）⇒ ④（反例控制）应当红。
//   ⚠️ 这两个开关**只为这条门存在**（默认关），别在产物里用。

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const MT = require(path.join(ROOT, 'npm/moobile-host/lib/migrate/style-emit.js'));

let pass = 0;
let fail = 0;
const say = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  ok ? pass++ : fail++;
};

/** 跑一次生成器（证伪开关只在这个夹具期间打开，用完还原 —— 免得多算了后面的读数）。 */
function generate(files, sites, env = {}) {
  const saved = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    return MT.generate(files, { appName: 'border-fold-fixture', sites });
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** 取 `pub fn <name>()` 那一格的**函数体**。 */
function fnBody(src, name) {
  const i = src.indexOf(`pub fn ${name}()`);
  if (i < 0) return '';
  const open = src.indexOf('{', i);
  const close = src.indexOf('\n}', open);
  return src.slice(open + 1, close < 0 ? src.length : close);
}
/** 取函数头上那串 `///` 注释（说明都在那里）。 */
function fnDoc(src, name) {
  const i = src.indexOf(`pub fn ${name}()`);
  if (i < 0) return '';
  const lines = src.slice(0, i).split('\n');
  // ⚠️ `slice(0, i)` 正好切在 `pub fn` 那里 ⇒ 最后一个元素是**空串**。第一版没管它，
  //    于是 `''.trim().startsWith('///')` 为假 ⇒ 说明一条都没取到 ⇒ 五条"说明写清了没有"
  //    的判据**全假红**（它们本该红的是"真没写"）。**判据自己的读数不可信 = 判据不可信。**
  let k = lines.length - 1;
  if (lines[k].trim() === '') k--;
  const doc = [];
  for (; k >= 0 && lines[k].trim().startsWith('///'); k--) doc.unshift(lines[k]);
  return doc.join('\n');
}
/** 链上的 `.方法(参数)`（先抹掉 `@style.` 这类限定名的点，见 press_order_check 的注释）。 */
function callsOf(text) {
  const noComments = text
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  const s = noComments.replace(/@[A-Za-z_][A-Za-z0-9_]*\./g, '@');
  const out = [];
  for (const m of s.matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)\(((?:[^()]|\([^()]*\))*)\)/g)) {
    out.push({ name: m[1], arg: m[2].trim() });
  }
  return out;
}
const countOf = (calls, name) => calls.filter((c) => c.name === name).length;
const sideStyleCalls = (calls) =>
  calls.filter((c) => /^border_(top|right|bottom|left)_style$/.test(c.name));

// ── 夹具 ─────────────────────────────────────────────────────────────────────
const FILES = [
  {
    rel: 'fixture.html',
    text: `<style>
      .one-dashed-top   { border-top: 1px dashed #d9c69f; padding: 4px 0 }
      .one-solid-left   { border-left: 2px solid #b8902f; padding: 6px 10px }
      .two-same-style   { border-top: 1px dashed #d9c69f; border-bottom: 1px dashed #d9c69f }
      .two-diff-style   { border-left: 2px solid #b8902f; border-top: 1px dashed #d9c69f }
      .redundant-solid  { border-width: 1px; border-style: solid; border-top-style: solid }
      .nowidth-dashed   { border-top-style: dashed }
    </style>`,
  },
];
const KEYS = [
  ['div.one-dashed-top', 'one-dashed-top'],
  ['div.one-solid-left', 'one-solid-left'],
  ['div.two-same-style', 'two-same-style'],
  ['div.two-diff-style', 'two-diff-style'],
  ['div.redundant-solid', 'redundant-solid'],
  ['div.nowidth-dashed', 'nowidth-dashed'],
];
const SITES = KEYS.map(([key, cls]) => ({
  key,
  own: { tag: 'div', classes: [cls] },
  chain: [],
  inLoop: false,
}));
const FN = Object.fromEntries(KEYS.map(([key, cls]) => [cls, `div_${cls.replace(/-/g, '_')}`]));

const g = generate(FILES, SITES);
const body = (cls) => fnBody(g.source, FN[cls]);
const doc = (cls) => fnDoc(g.source, FN[cls]);
const calls = (cls) => callsOf(body(cls));

// ① 单边虚线
{
  const c = calls('one-dashed-top');
  say(
    countOf(c, 'border_style') === 1 && c.find((x) => x.name === 'border_style').arg === '@BorderStyle::Dashed',
    `① 单边虚线 ⇒ 折成一次 border_style(Dashed)（实测：${JSON.stringify(c.map((x) => x.name))}）`,
  );
  say(
    sideStyleCalls(c).length === 0,
    `① 折完不再有分边 style 调用（实测 ${sideStyleCalls(c).length} 条）`,
  );
  say(
    c.some((x) => x.name === 'border_top_width') && c.some((x) => x.name === 'border_top_color'),
    '① 同一条简写里的**宽度与颜色照旧发**（只折 style 那一条）',
  );
  say(/折成四边共用/.test(doc('one-dashed-top')), '① 函数头写明"折成四边共用"（人去产物里能看明白）');
}

// ② 单边实线
{
  const c = calls('one-solid-left');
  say(
    countOf(c, 'border_style') === 1 && c.find((x) => x.name === 'border_style').arg === '@BorderStyle::Solid',
    `② 单边实线 ⇒ 折成一次 border_style(Solid)（实测：${JSON.stringify(c.map((x) => x.name))}）`,
  );
  say(sideStyleCalls(c).length === 0, '② 折完不再有分边 style 调用');
}

// ③ 两条边同一个 style ⇒ 只发一次
{
  const c = calls('two-same-style');
  say(
    countOf(c, 'border_style') === 1 && sideStyleCalls(c).length === 0,
    `③ 上/下都 dashed ⇒ **只发一次** border_style（实测 border_style=${countOf(c, 'border_style')} 分边=${sideStyleCalls(c).length}）`,
  );
}

// ④ 两条边 style 不同 ⇒ 一条都不许折（**反例控制**）
{
  const c = calls('two-diff-style');
  say(
    countOf(c, 'border_style') === 0,
    `④★ 左 solid + 上 dashed（都带宽度）⇒ **不许折**（实测 border_style=${countOf(c, 'border_style')} 次）`,
  );
  say(
    sideStyleCalls(c).length === 2,
    `④ 分边调用**原样留着**（实测 ${sideStyleCalls(c).length} 条：${sideStyleCalls(c).map((x) => x.name).join(',')}）`,
  );
  say(/折不成/.test(doc('two-diff-style')), '④ 说明里写清"折不成"（人看得懂为什么）');
  say(
    /top=Dashed\s*\/\s*left=Solid/.test(doc('two-diff-style')),
    '④ 说明里带**实测读数**（哪条边是什么 style），不是一句空话',
  );
}

// ⑤ 冗余分边（四边共用已经是同一个值）⇒ 删掉、只留一次
{
  const c = calls('redundant-solid');
  say(
    countOf(c, 'border_style') === 1 && sideStyleCalls(c).length === 0,
    `⑤ 冗余分边 ⇒ 删掉（实测 border_style=${countOf(c, 'border_style')} 分边=${sideStyleCalls(c).length}）`,
  );
  say(/纯冗余/.test(doc('redundant-solid')), '⑤ 说明里写明"纯冗余、删掉不丢东西"');
}

// ⑥ 没有宽度的分边 style ⇒ 不许吓人（"真机上不生效"是假话：什么都没画）
{
  const c = calls('nowidth-dashed');
  const d = doc('nowidth-dashed');
  say(!/真机上这一条不生效/.test(d), '⑥★ 没有宽度时**不许**说"真机上不生效"（画不出线，外观一样）');
  say(/都没有宽度|画不出线/.test(d), '⑥ 说明要指出"都没有宽度 ⇒ 画不出线"');
  say(c.length >= 0, '⑥ （该格仍能生成，不因这条说明而崩）');
}

// ⑦ 账本不破：折叠让声明**少掉一个调用** ⇒ 必须说明自己去哪了
{
  say(
    (g.silentEmpty || []).length === 0,
    `⑦ 折完 silentEmpty = 0（实测 ${(g.silentEmpty || []).length} 条：${JSON.stringify((g.silentEmpty || []).slice(0, 3))}）`,
  );
}

// ⑧ 折成功的格子不许同时留着"原生不生效"那句过期说明
{
  const bad = ['one-dashed-top', 'one-solid-left', 'two-same-style', 'redundant-solid'].filter((cls) =>
    /真机上这一条不生效/.test(doc(cls)),
  );
  say(bad.length === 0, `⑧★ 折成功的格子不许留"原生不生效"的过期说明（实测：${bad.join(',') || '无'}）`);
}

// ── 证伪一：关掉折叠 ⇒ ①②③⑤ 必须红 ─────────────────────────────────────────
{
  const g2 = generate(FILES, SITES, { MOBILE_NO_BORDER_FOLD: '1' });
  const c2 = (cls) => callsOf(fnBody(g2.source, FN[cls]));
  const folded = (cls) => countOf(c2(cls), 'border_style') === 1 && sideStyleCalls(c2(cls)).length === 0;
  const reds = ['one-dashed-top', 'one-solid-left', 'two-same-style', 'redundant-solid'].filter((cls) => !folded(cls));
  say(
    reds.length === 4,
    `证伪①：关掉折叠 ⇒ 四条"该折"的判据应当全红（实测红 ${reds.length}/4：${reds.join(',') || '一条都没红'}）`,
  );
  // 反例控制这时**不该**红（它本来就不折）
  say(
    countOf(c2('two-diff-style'), 'border_style') === 0 && sideStyleCalls(c2('two-diff-style')).length === 2,
    '证伪①：反例控制（折不动那条）在关掉折叠时**照旧不动**',
  );
}

// ── 证伪二：无脑全折 ⇒ ④（反例控制）必须红 ───────────────────────────────────
{
  /** ④ 那条控制的**同一条判据**抽成函数 —— 证伪时拿它去打"被改坏"的产物。 */
  const controlHolds = (src) => {
    const c = callsOf(fnBody(src, FN['two-diff-style']));
    return countOf(c, 'border_style') === 0 && sideStyleCalls(c).length === 2;
  };
  say(controlHolds(g.source), '证伪②前置：原始产物上这条控制判据**是绿的**（不然"变红"没有意义）');
  const g3 = generate(FILES, SITES, { MOBILE_BORDER_FOLD_ALL: '1' });
  const c3 = callsOf(fnBody(g3.source, FN['two-diff-style']));
  const holds = controlHolds(g3.source);
  say(
    !holds,
    `证伪②：把"无脑全折"喂进去 ⇒ **同一条控制判据变红**（实测 border_style=${countOf(c3, 'border_style')} 次、` +
      `分边 style ${sideStyleCalls(c3).length} 条 ⇒ ${holds ? '⚠️ 居然还是绿的：控制判据抓不住这种假修' : '抓住了 ✓'}）`,
  );
}

console.log(`\n边框折叠：通过 ${pass}  失败 ${fail}`);
process.exit(fail ? 1 : 0);
