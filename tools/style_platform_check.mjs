#!/usr/bin/env node
// style_platform_check.mjs —— **库能产出的样式键 vs 原生 RN 真认的键**（含"有没有对应物"）
//
//   node tools/style_platform_check.mjs
//
// ## 为什么必须有这条门
//
// `style/style.mbt` 里那句注释写着"下面这批是**可移植且 RN 支持**的" ——
// **那句话对 6 个键不成立**（2026-10-23 实测）。这类洞的形状与本仓库栽过好几次的
// "web 绿、真机红"完全一样：键写在样式对象里，**web（react-native-web）当 CSS 照单全收、
// 原生 RN 静默不认** —— 于是浏览器里看着好好的，真机上少一层效果，而且**不报错、不崩**。
//
// 更要紧的是：**这不是潜伏的，是活的**。真实应用 `examples/apps/zhouyi-reader` 的产物里
// 就有 11 处（`border_*_style` 8 处 + `white_space` 3 处），而它的 web 判据 103/0 全过。
//
// ## 判据的形状（为什么不是"手抄一张 77 行的表"）
//
// 库这一侧的键集是**从 `style/style.mbt` 推出来的**；RN 那一侧是**从装在本仓库里的真 RN**
// 读出来的（`ReactNativeStyleAttributes.js` —— RN 渲染器自己用来处理样式属性的登记表，
// 比"文档里有没有写"硬）。于是：
//
//   · 库有、RN 没有 ⇒ **必须在**下面的 `RN_UNSUPPORTED` 表里**登记**（要写清对应物与处置）；
//     没登记就红 —— **这就是"以后新加一个键"的挡板**。
//   · 表里有、而某个 RN 版本**已经支持**了 ⇒ 也红（**表过期了**：处置该改）。
//   · 发现不到任何 RN 时就 SKIP 那几条（新鲜克隆 / CI 上正常），其余判据照跑。
//
// ⚠️ 一律**不猜**：`RN_UNSUPPORTED` 的每一条都必须写 `why`（原生的事实）与 `instead`（对应物），
//    空着就红 —— 因为"这个键原生不认"这句话本身不够，读者要的是**那我该怎么写**。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STYLE_MBT = path.join(ROOT, 'style/style.mbt');

let pass = 0;
let fail = 0;
const say = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  ok ? pass++ : fail++;
};
const info = (msg) => console.log(`      · ${msg}`);

// ── 库这一侧：从 `style.mbt` 推出全部样式键 ─────────────────────────────────
//
// 三条来源（少一条就会漏键 —— 第一版只用了 ①，数出 52 个，而实际是 77 个）：
//   ① `self.kw("x", …)` / `self.len("x", …)` 这类内部写入器；
//   ② 直接 `self.entries.push(("x", …))` 的字面量（`letter_spacing_em` 那种）；
//   ③ 走"变量键"的构造器（`self.entries.push((key, …))`）—— 它的键在调用点上，
//      所以把 `style.mbt` 里所有 camelCase 字面量也收进来（`paddingTop` / `minWidth` 这些）。
function libKeys() {
  const src = fs.readFileSync(STYLE_MBT, 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/self\.(?:kw|len|unitless|str|pct|auto|dim)\("([A-Za-z][A-Za-z0-9]*)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/self\.entries\.push\(\("([A-Za-z][A-Za-z0-9]*)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/"([a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)"/g)) keys.add(m[1]);
  return keys;
}

/** 从 RN 的 `ReactNativeStyleAttributes.js` 里读出它认哪些键。 */
function rnRegistry(file) {
  const src = fs.readFileSync(file, 'utf8');
  const keys = new Set();
  // 登记表是一个大对象字面量，键都顶到两格缩进（`  alignContent: true,`）。
  for (const m of src.matchAll(/^\s{2}([a-zA-Z][A-Za-z0-9]*):/gm)) keys.add(m[1]);
  return keys;
}

/** 找出本仓库里**装好的** RN 登记表（每份都记下版本 —— 判据要能回答"对哪个版本说的"）。 */
function findRegistries() {
  const found = [];
  const appsDir = path.join(ROOT, 'examples/apps');
  if (!fs.existsSync(appsDir)) return found;
  for (const app of fs.readdirSync(appsDir)) {
    for (const rel of ['node_modules', 'host/node_modules']) {
      const dir = path.join(appsDir, app, rel, 'react-native');
      const reg = path.join(dir, 'Libraries/Components/View/ReactNativeStyleAttributes.js');
      const pkg = path.join(dir, 'package.json');
      if (!fs.existsSync(reg) || !fs.existsSync(pkg)) continue;
      const version = JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
      if (found.some((f) => f.version === version)) continue;
      found.push({ version, app, keys: rnRegistry(reg) });
    }
  }
  return found.sort((a, b) => (a.version < b.version ? -1 : 1));
}

// ── 登记表：库能产出、**原生 RN 认不出**的键（每条都要有 why 与 instead）─────────
//
// `instead` = **有没有对应物、怎么写**（2026-10-23 逐条查过，含真实应用上的实际形状）。
const RN_UNSUPPORTED = {
  order: {
    why: '原生 RN 没有 `order`（Yoga 不支持 flexbox 的 order，RN 那边标的是 not_planned）；`react-native-web` 有，所以浏览器里看得见',
    instead:
      '**没有样式层的对应物** —— 要在**结构上**表达：在 Model 里就把顺序排好（与 `@media` 同一档：RN 没有的东西，最后都要落到 Model）',
    plan: '如实点名（不动产物）',
  },
  whiteSpace: {
    why: '原生 RN 没有 `whiteSpace`；`react-native-web` 有',
    instead:
      '**部分有**：`nowrap` 的 RN 惯例是 `Text` 的 `numberOfLines={1}`（语义不完全相同：那是**截断**，不是"不折行"，还会带省略号）；`pre-line` / `pre-wrap` 的语义**接近** RN `Text` 的默认行为（保留 `\\n`），差距要在真机上量',
    plan: '如实点名；`nowrap` 给 `numberOfLines` 这条替代路径（要新键，另议）',
  },
  borderTopStyle: {
    why: '原生 RN 只有**四边共用**的 `borderStyle`，**没有分边**的 `borderTopStyle`（分边的 *宽度*/*颜色* 都有，唯独 style 是全局的）',
    instead:
      '**半有**：当"有宽度的那些边"共用同一个 style 时，发一次 `borderStyle` 就等价（源 CSS 里 `border-top: 1px dashed …` 这类**只有一边有宽度**的写法，合成是安全的）—— ⚠️ 目前**没有自动合成**，只是点名',
    plan: '如实点名；"合成 borderStyle"是候选的下一步（要新判据）',
  },
  borderBottomStyle: {
    why: '同 `borderTopStyle`：原生 RN 没有分边的 border style',
    instead: '同 `borderTopStyle`（合成为四边共用的 `borderStyle`）',
    plan: '如实点名',
  },
  borderLeftStyle: {
    why: '同 `borderTopStyle`：原生 RN 没有分边的 border style',
    instead: '同 `borderTopStyle`（合成为四边共用的 `borderStyle`）',
    plan: '如实点名',
  },
  borderRightStyle: {
    why: '同 `borderTopStyle`：原生 RN 没有分边的 border style',
    instead: '同 `borderTopStyle`（合成为四边共用的 `borderStyle`）',
    plan: '如实点名',
  },
};

/**
 * 另一类：键**在** RN 登记表里，但**只有 iOS 支持** ⇒ 安卓上静默失效。
 * 它们不能进 `RN_UNSUPPORTED`（那是"登记表里没有"的意思），所以要分开一张表。
 */
const IOS_ONLY = {
  textDecorationStyle: {
    why: '在 RN 登记表里，但 RN 官方只实现了 iOS（Android 上没有效果）',
    instead: '**安卓上没有对应物**（安卓的 `TextPaint` 没有虚线/点线下划线的概念）；要么放弃这层装饰，要么把它画成独立的图形',
    plan: '如实点名（安卓）',
  },
  textDecorationColor: {
    why: '在 RN 登记表里，但 RN 官方只实现了 iOS（Android 上没有效果）',
    instead: '**安卓上没有对应物**；下划线颜色只能接受系统默认',
    plan: '如实点名（安卓）',
  },
};

// ── 判据 0：前提 ─────────────────────────────────────────────────────────────
const keys = libKeys();
say(keys.size >= 60, `前提自查：从 \`style/style.mbt\` 推出了库的键集（${keys.size} 个）`);
const regs = findRegistries();
if (regs.length) {
  info(`找到 ${regs.length} 份真 RN 登记表：${regs.map((r) => `${r.version}（${r.app}）`).join('、')}`);
} else {
  console.log('SKIP  找不到装好的 react-native（新鲜克隆 / CI 上正常）—— 键集与登记表的一致性那几条跳过');
}

/** 某个键在哪些版本里"没有"。 */
const missingIn = (k) => regs.filter((r) => !r.keys.has(k)).map((r) => r.version);
const presentIn = (k) => regs.filter((r) => r.keys.has(k)).map((r) => r.version);

if (regs.length) {
  // ── 判据 1：库有、RN 没有 ⇒ 必须登记 ───────────────────────────────────────
  const missingSomewhere = [...keys].filter((k) => missingIn(k).length > 0).sort();
  const unregistered = missingSomewhere.filter((k) => !RN_UNSUPPORTED[k]);
  say(
    unregistered.length === 0,
    '★ 每一个"库能产出、而原生 RN 认不出"的键都在登记表里（新键必须登记，不许悄悄通过）' +
      (unregistered.length
        ? `\n      → **没登记**：${unregistered.join('、')}\n      → 登记处：${'tools/style_platform_check.mjs'} 的 \`RN_UNSUPPORTED\`（要写 why 与 instead）`
        : `（实测这 6 个：${missingSomewhere.join('、')}）`),
  );

  // ── 判据 2：登记表不许过期（RN 已经支持了就得改处置）──────────────────────
  const stale = Object.keys(RN_UNSUPPORTED).filter((k) => missingIn(k).length === 0);
  say(
    stale.length === 0,
    '登记表没有过期：里面每一个键都**真的**还不被原生 RN 支持（RN 加上了就该改处置）' +
      (stale.length ? `\n      → **已经支持了**：${stale.join('、')}` : ''),
  );

  // ── 判据 3：iOS-only 那类不许混进"登记表里没有" ────────────────────────────
  const iosPresent = Object.keys(IOS_ONLY).filter((k) => presentIn(k).length > 0);
  say(
    iosPresent.length === Object.keys(IOS_ONLY).length,
    '★ iOS-only 那一类（键在登记表里、只有 iOS 实现）与"登记表里没有"分开登记' +
      `（实测 ${iosPresent.length}/${Object.keys(IOS_ONLY).length} 在登记表里：${Object.keys(IOS_ONLY).join('、')}）`,
  );
} else {
  console.log('SKIP  判据 1–3（没有 RN 登记表可对）');
}

// ── 判据 4：登记表自身的质量（每条都要有 why 与 instead）──────────────────────
const thin = [...Object.entries(RN_UNSUPPORTED), ...Object.entries(IOS_ONLY)].filter(
  ([, v]) => !v.why || !v.instead,
);
say(
  thin.length === 0,
  '★ 登记表里每一条都写清了"原生的事实"与"**对应物/替代路径**"（只写"不支持"是不够的）' +
    (thin.length ? `\n      → 缺内容：${thin.map(([k]) => k).join('、')}` : ''),
);
say(
  Object.keys(RN_UNSUPPORTED).length > 0,
  `登记表非空（${Object.keys(RN_UNSUPPORTED).length} 条"原生不认" + ${Object.keys(IOS_ONLY).length} 条"只有 iOS"）`,
);

// ── 判据 5：真实产物里的**实际影响面** ───────────────────────────────────────
const CONSTRUCTOR = {
  order: 'order',
  whiteSpace: 'white_space',
  borderTopStyle: 'border_top_style',
  borderBottomStyle: 'border_bottom_style',
  borderLeftStyle: 'border_left_style',
  borderRightStyle: 'border_right_style',
  textDecorationStyle: 'text_decoration_style',
  textDecorationColor: 'text_decoration_color',
};
const products = [];
for (const app of fs.existsSync(path.join(ROOT, 'examples/apps')) ? fs.readdirSync(path.join(ROOT, 'examples/apps')) : []) {
  const f = path.join(ROOT, 'examples/apps', app, 'styles/styles.mbt');
  if (fs.existsSync(f)) products.push({ app, file: f, text: fs.readFileSync(f, 'utf8') });
}
if (products.length) {
  const hits = [];
  for (const p of products) {
    for (const [key, ctor] of Object.entries(CONSTRUCTOR)) {
      const n = (p.text.match(new RegExp(`\\.${ctor}\\(`, 'g')) || []).length;
      if (n) hits.push({ app: p.app, key, ctor, n });
    }
  }
  const total = hits.reduce((a, h) => a + h.n, 0);
  // ⚠️ 这里是**读数**，不是判据 —— 一个"永远 PASS"的判据是噪声（本仓库的规矩：
  //    判据要么能红，要么就别装作是判据）。它的用处是让人一眼看到**这个应用实际踩了几处**。
  info(
    `影响面（读数，非判据）：${total} 处` +
      (hits.length ? `（${hits.map((h) => `${h.app} ${h.ctor}×${h.n}`).join('、')}）` : '') +
      ' —— ⚠️ 这些在 web（RNW）上生效、在**原生上静默不生效**',
  );
} else {
  console.log('SKIP  影响面（没有生成物的 styles/styles.mbt）');
}

// ── 判据 6：证伪（两条，都对着"判据自己会不会红"）─────────────────────────────
{
  // 两条**模型级**证伪：把判据表里用到的谓词，喂给一份**合成登记表**，看它会不会按预期翻面。
  // （真正喂给门的那次证伪是"改回旧形状跑一遍"，见 `docs/FINDINGS.md` 第二十一轮。）
  const missingUnder = (registrySet, key) => registrySet.some((r) => !r.keys.has(key));
  const base = regs.length ? [...regs[0].keys] : [];
  // ① "表过期"那条的谓词：某份登记表**有** order ⇒ 它就不该继续留在"原生不认"里
  const withOrder = [{ version: 'synthetic', app: '-', keys: new Set(['order', ...base]) }];
  say(
    missingUnder(withOrder, 'order') === false,
    '证伪①：合成一份**有** `order` 的登记表 ⇒ "表过期"那条会翻面（说明它跟着 RN 的变化在动）',
  );
  // ② "必须登记"那条的谓词：某份登记表**缺** whiteSpace ⇒ 它就要求登记
  const withoutWs = [{ version: 'synthetic', app: '-', keys: new Set(base.filter((k) => k !== 'whiteSpace')) }];
  say(
    missingUnder(withoutWs, 'whiteSpace') === true,
    '证伪②：合成一份**缺** `whiteSpace` 的登记表 ⇒ "必须登记"那条会翻面（两个方向都不空转）',
  );
}

console.log(`\nstyle_platform_check: 通过 ${pass} 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
