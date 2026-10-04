#!/usr/bin/env node
// migrate_ledger_check.mjs —— **样式源侧账本**的判据门（"每一条源声明都要有名字"）
//
//   node tools/migrate_ledger_check.mjs
//
// ## 它守的是什么
//
// 第十八轮做过一次**人工只读清点**：源 `<style>` 里的声明逐条对账，结论"无痕消失 0"（656 条）。
// 那次清点**没变成判据** ⇒ 下次动生成器会不会又漏、漏多少，没人知道。这条门把那次清点
// 变成**每次都能跑一遍**的东西，并加一条第十八轮没有的兜底：
//
//   ① **每条源声明都必须落进一个"有名字的桶"**（`ledger.buckets`），桶里的条目带 `file:line`；
//   ② **算成"已映射"就必须给出调用、或者给出说明** —— 两者都没有的，记进 `silentEmpty`，
//      真实应用上必须是 **0**（这就是"`emitted++` 与'真的产出了调用'是两件事"那条）。
//
// ## ⚠️ 判据的边界（写清楚，别读大）
//
// · **"独立数一遍"只独立在遍历，不独立在解析器**：门这一侧自己走
//   `css.extractSheets` → `css.parse` 数声明，用的**还是同一个 `css.js`**。
//   所以它能抓的是"**生成器遍历时漏了/没分类**"（例如某处 `continue` 之前忘了记账），
//   **抓不到**"`css.parse` 本身把某条声明读丢了"。后者的账在 `generate().parseLosses` 上，
//   这里只把它**打印出来**（`parseLosses` 也必须是 0 才算干净 —— 见判据表）。
// · **三种计数口径互不相等**（写在 `style-emit.js` 的账本注释里）：
//   源侧桶（每条声明一次） / `applications`（逐规则 × 命中数） / `accounting.decls`
//   （条目侧、按属性去重）。**别拿它们互相对账** —— 第一版就是把前两个加在一起，
//   于是真实应用上 Σ桶 = 1026 而源声明只有 660（两个不同单位相加）。
//
// ## 证伪
//
// 门里带两组：
//   · **模型级**：把本轮修掉的那条旧公式（`lost = usedOwn && parts.length > 1`）套在同一个诱饵上，
//     必须判成"**不是损失**" —— 否则说明这条判据抓不住它。
//   · **负例**：一个**真用不上**的选择器（`input{}` 而源码里没有 `input`）必须留在
//     `unmatchedUnused` —— 防"把 `lost` 一律改成 true"这种把门骗绿的改法。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const MT = require(path.join(ROOT, 'npm/moobile-host/lib/migrate/style-emit.js'));
const map = require(path.join(ROOT, 'npm/moobile-host/lib/migrate/style-map.js'));
const css = require(path.join(ROOT, 'npm/moobile-host/lib/migrate/css.js'));
const rw = require(path.join(ROOT, 'npm/moobile-host/lib/migrate/class-rewrite.js'));

let pass = 0;
let fail = 0;
const say = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  ok ? pass++ : fail++;
};
const sumBuckets = (ledger) => Object.values(ledger.buckets).reduce((a, x) => a + x, 0);

/**
 * 门**自己**逐条重跑映射，独立找出"零调用、零说明、又不算有损"的声明。
 *
 * ⚠️★ 为什么不让生成器代劳（它明明有 `silentEmpty` 计数）：**判据不能建在"被检查者的自述"上。**
 * 实测过这个坑：把生成器里那段兜底改成 `if (false)`，`silentEmpty` 就恒为空，
 * 那条判据**照样 PASS**（空转）。所以这里拿生成器吐出来的**原始声明**
 * （`gen.classes[].decls`）自己跑一遍 `mapDeclaration`。
 */
function independentZeroCall(gen) {
  const found = [];
  for (const c of gen.classes) {
    if (!c.decls) continue;
    const hasFontSize = c.decls.has('font-size');
    for (const [prop, d] of c.decls) {
      if (c.losses && c.losses.some((l) => l.prop === prop)) continue; // 有损的另算
      // 生成器侧**已知**的例外：网格容器的 `grid-template-columns` 把列宽交给子项
      // （子项上补 min_width + flex_grow），容器自身本来就没有调用。
      if (prop === 'grid-template-columns' && (c.gridBasis !== undefined || c.gridCellBasis !== undefined)) {
        continue;
      }
      const r = map.mapDeclaration(prop, d.value, { emWithoutFontSize: !hasFontSize });
      if (!r.loss && (r.calls || []).length === 0 && (r.notes || []).length === 0) {
        found.push(`${c.key} · ${prop}:${d.value}（${d.file}:${d.line}）`);
      }
    }
  }
  return found;
}

/** 门这一侧**自己**数一遍源声明（独立遍历，见文件头的边界说明）。 */
function countSourceDecls(files) {
  const { sheets, losses } = css.extractSheets(files);
  let rules = 0;
  let style = 0;
  let custom = 0;
  for (const s of sheets) {
    // `css.parse` 返回 `{ rules, vars, losses }`（不是数组 —— 第一版就写错了这一行）。
    for (const r of css.parse(s.text, s.file, s.line).rules) {
      rules++;
      for (const d of r.decls) {
        if (d.prop.startsWith('--')) custom++;
        else style++;
      }
    }
  }
  return { rules, style, custom, extractLosses: losses.length };
}

// ── ① 夹具：把六个桶都撞一遍 ──────────────────────────────────────────────────
//
// 形状取自 `interest/yi/zhouyi_reader` 的真实结构（`@media` / 同元素 `:hover` / 后代 `:hover` /
// 后代选择器 / 单段带标签 / 纯标签 / 认不出的写法），只是缩到能一眼看完。
const FIXTURE = {
  files: [
    {
      rel: 'ledger.html',
      text: [
        '<style>',
        '.c{color:red}', // 命中
        '.norm{letter-spacing:normal}', // ★ 零调用兜底：这一条以前走 `mapped([])`（零调用、零说明、却算"已映射"）
        '@media (max-width:600px){.c{color:blue}}', // media 桶
        '.c:hover{color:#0f0}', // 同元素 hover（默认不产出 ⇒ hoverSameElementOff 桶）
        '.c:hover .k{color:#00f}', // 后代 hover（表达不了 ⇒ hoverDescendant 桶）
        '.c .k{color:#333}', // 后代选择器，源码里没有 .k ⇒ unmatchedUnused
        'button.primary{background:#f00}', // ★ 类用到了、**标签不一样** ⇒ unmatchedLost（本轮修的）
        'input{border:0}', // 负例：源码里没有 input ⇒ unmatchedUnused（不许报成损失）
        '.5px{x:1}', // 认不出的写法 ⇒ unparsable 或 unused
        '</style>',
      ].join('\n'),
    },
  ],
  sites: [
    { key: 'div.c', own: { tag: 'div', classes: ['c'] }, chain: [], inLoop: false },
    { key: 'div.norm', own: { tag: 'div', classes: ['norm'] }, chain: [], inLoop: false },
    { key: 'div.primary', own: { tag: 'div', classes: ['primary'] }, chain: [], inLoop: false },
  ],
};

const gen = MT.generate(FIXTURE.files, { appName: 'ledger-fixture', sites: FIXTURE.sites });
const led = gen.ledger;
const mine = countSourceDecls(FIXTURE.files);

say(
  led && led.buckets && typeof led.sourceDecls === 'number',
  '前提自查：`generate()` 真的吐出了账本（没有它，下面几条没有判据对象）',
);
say(
  sumBuckets(led) === led.sourceDecls,
  `夹具：每条源声明都落进了一个桶（Σ桶 ${sumBuckets(led)} / 源声明 ${led.sourceDecls}）`,
);
say(
  led.sourceDecls === mine.style && led.rules === mine.rules,
  `夹具：生成器的账本与门**自己数的那一遍**一致（声明 ${led.sourceDecls}=${mine.style}，规则 ${led.rules}=${mine.rules}）`,
);

const B = led.buckets;
say(B.matched >= 1, `夹具：命中桶非空（matched=${B.matched}）`);
say(B.media === 1, `夹具：\`@media\` 进了 media 桶（实测 ${B.media}）`);
say(B.hoverSameElementOff === 1, `夹具：同元素 \`:hover\` 进了"已实现但默认不产出"桶（实测 ${B.hoverSameElementOff}）`);
say(B.hoverDescendant === 1, `夹具：后代 \`:hover\` 进了"表达不了"桶（实测 ${B.hoverDescendant}）`);

// ★ 本轮修的那条：单段 + 带标签，类用到了、标签不一样 ⇒ 必须是**损失**
const lostSel = gen.unmatchedRules.filter((u) => u.lost).map((u) => u.selector);
say(
  lostSel.includes('button.primary'),
  `★ 夹具："\`button.primary\` 而源码写的是 \`div.primary\`"必须算**损失**（实测 lost 里是 ${JSON.stringify(lostSel)}）`,
);
// 负例：真用不上的不许被算成损失
const unusedSel = gen.unmatchedRules.filter((u) => !u.lost).map((u) => u.selector);
say(
  unusedSel.includes('input'),
  `负例：源码里没有 \`input\` ⇒ 那条必须留在"用不上、不是损失"（实测 ${JSON.stringify(unusedSel)}）`,
);
say(
  B.unmatchedLost === 1,
  `夹具：损失桶与负例分得开（unmatchedLost=${B.unmatchedLost}，恰好是那一条诱饵）`,
);
// 桶里的条目必须能追到源码位置
const noPos = [...gen.unmatchedRules, ...gen.ruleLosses].filter((x) => !x.file || !x.line);
say(noPos.length === 0, `夹具：桶里的条目都带 \`file:line\`（缺位置的 ${noPos.length} 条）`);

// ── ② 零调用兜底："算成已映射 ⇒ 有调用、或有说明" ─────────────────────────────
// ⚠️ 夹具里那一条 `.norm{letter-spacing:normal}` 就是**核弹引信**：把它改回 `mapped([])`，
//    这一条判据立刻红（真证伪做过 —— 见 FINDINGS 第二十轮）。没有它，这条判据就是空转的。
say(
  gen.silentEmpty.length === 0,
  `★ 夹具：生成器**自报**的"算成已映射却零调用零说明"是 0 条（实测 ${gen.silentEmpty.length} 条）` +
    (gen.silentEmpty.length ? `：${gen.silentEmpty.map((s) => `${s.prop}:${s.value}`).join('、')}` : ''),
);
// ⚠️ 上面那条建在生成器的自述上（删掉它的兜底就会空转），所以下面这条**自己再跑一遍**。
const indepFixture = independentZeroCall(gen);
say(
  indepFixture.length === 0,
  `★ 夹具：门**自己重跑映射**也找不出"零调用零说明"的声明（独立判据，实测 ${indepFixture.length} 条` +
    (indepFixture.length ? `：${indepFixture.slice(0, 4).join('、')}` : '') +
    '）',
);

const KEYWORD_VALUES = [
  ['letter-spacing', 'normal'],
  ['font-weight', 'normal'],
  ['color', 'red'],
  ['display', 'flex'],
  ['border', 'none'],
];
const bare = [];
for (const [prop, value] of KEYWORD_VALUES) {
  const r = map.mapDeclaration(prop, value, { emWithoutFontSize: false });
  const calls = (r.calls || []).length;
  const notes = (r.notes || []).length;
  if (!r.loss && calls === 0 && notes === 0) bare.push(`${prop}:${value}`);
}
say(
  bare.length === 0,
  '★ 已知的关键字取值里没有"零调用、零说明、却不算有损"的：至少给调用，或者给理由' +
    `（实测 ${bare.length ? bare.join('、') : '0 条'}）`,
);

// ── ③ 证伪 ────────────────────────────────────────────────────────────────────
// ① 旧公式（本轮修掉的那条）套在同一个诱饵上 ⇒ 必须判成"不是损失"
const oldLost = (usedOwn, partsLen) => usedOwn && partsLen > 1;
say(
  oldLost(true, 1) === false,
  '证伪①：修之前那条公式（只看祖先链长度）会把这条诱饵判成"**不是损失**" ⇒ 这条判据确实能红',
);
// ② 负例反向证伪：如果谁把 lost 一律改成 true，上面那条负例判据会红（这里把它写出来当"这条路走不通"的证据）
say(
  gen.unmatchedRules.some((u) => !u.lost),
  '证伪②：确实存在"用不上、不是损失"的条目 ⇒ "把 lost 一律改成 true"那种改法会被负例判据抓住',
);

// ── ④ 真实应用（源项目在仓库外 ⇒ 不在本机就 SKIP，不是 PASS）──────────────────
const srcRoot = path.resolve(ROOT, '..', 'yi', 'zhouyi_reader');
if (!fs.existsSync(srcRoot)) {
  console.log(`SKIP  真实应用的账本读数（${srcRoot} 不在本机 —— 新鲜克隆 / CI 上正常）`);
} else {
  const walk = (d, out = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '_build', '.git', '.mooncakes'].includes(e.name) || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, out);
      else out.push(p);
    }
    return out;
  };
  const files = walk(srcRoot)
    .filter((f) => /\.(html|mbt|css)$/.test(f))
    .map((f) => ({ rel: path.relative(srcRoot, f).split(path.sep).join('/'), text: fs.readFileSync(f, 'utf8') }));
  const { sites } = rw.extractSites(files.filter((f) => f.rel.endsWith('.mbt')));
  const g = MT.generate(files, { appName: 'zhouyi-reader', sites });
  const m = countSourceDecls(files);
  const l = g.ledger;
  const ruleLevel =
    l.buckets.media +
    l.buckets.hoverDescendant +
    l.buckets.hoverSameElementOff +
    l.buckets.unparsable +
    l.buckets.unmatchedLost +
    l.buckets.unmatchedUnused;

  say(
    sumBuckets(l) === l.sourceDecls,
    `真实应用：账本自己闭合（Σ桶 ${sumBuckets(l)} / 源声明 ${l.sourceDecls}）`,
  );
  say(
    l.sourceDecls === m.style,
    `★ 真实应用：账本与门**自己数的那一遍**一致（${l.sourceDecls} = ${m.style}，规则 ${l.rules} = ${m.rules}）`,
  );
  say(
    g.silentEmpty.length === 0,
    `★ 真实应用：生成器自报的"算成已映射却零调用零说明"是 0 条（实测 ${g.silentEmpty.length} 条）` +
      (g.silentEmpty.length ? `\n      ${g.silentEmpty.slice(0, 5).map((s) => `${s.cls} · ${s.prop}:${s.value}（${s.file}:${s.line}）`).join('\n      ')}` : ''),
  );
  const indepReal = independentZeroCall(g);
  say(
    indepReal.length === 0,
    `★ 真实应用：门**自己重跑映射**也找不出"零调用零说明"的声明（独立判据，实测 ${indepReal.length} 条` +
      (indepReal.length ? `\n      ${indepReal.slice(0, 6).join('\n      ')}` : '') +
      '）',
  );
  say(
    g.parseLosses.length === 0,
    `真实应用：解析阶段没有读不出来的声明（\`parseLosses\` = ${g.parseLosses.length}）`,
  );
  console.log(
    `      · 读数：规则 ${l.rules} · 源声明 ${l.sourceDecls}（自定义属性 ${l.customProps}）· ` +
      `命中 ${l.buckets.matched} · 根样式 ${l.buckets.pageRoot} · 规则级理由 ${ruleLevel}` +
      `（media ${l.buckets.media} / 后代 hover ${l.buckets.hoverDescendant} / 同元素 hover 未接线 ${l.buckets.hoverSameElementOff} / 认不出 ${l.buckets.unparsable} / 上下文损失 ${l.buckets.unmatchedLost} / 用不上 ${l.buckets.unmatchedUnused}）`,
  );
  console.log(
    `      · 另两种口径（**别相加**）：applications（逐规则×命中数）= ${l.applications}；` +
      `accounting（条目侧去重）= 声明 ${g.accounting.decls} = 已映射 ${g.accounting.emitted} + 有损 ${g.accounting.lost}`,
  );
}

console.log(`\nmigrate_ledger_check: 通过 ${pass} 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
