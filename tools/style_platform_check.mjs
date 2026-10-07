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
// ⚠️ **同日晚些时候这条读数变小了**（第二十九轮）：其中 6 处的分边 style 被
// **自动折叠**掉了（`planBorderStyleFold`，判据在 `tools/border_fold_check.mjs`）
// ⇒ 现在剩 **2 处分边 style**（都在 `div_m_weny_box` 那一格，属于"几条边 style 不同、
// **折不动的反例**"）+ `white_space` 3 处。本条门**不**断言这些数字（那是产物的事），
// 所以它没有跟着红 —— 这也是"注释里的数字会漂"的又一个实例。
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

/** 一份源码里有没有这个键（**词边界**匹配：`numberOfLines` 不该被 `fooNumberOfLinesBar` 命中）。
 *  抽成函数是为了让**判据与它的证伪用同一份逻辑**（不然证伪证的是另一件事）。 */
const sourceMentionsKey = (src, key) => new RegExp(`\\b${key}\\b`).test(src);

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
    plan: '如实点名；`nowrap` 的替代路径已落地为**显式键** `@style.Style::number_of_lines`（见 `PROP_KEYS`）—— ⚠️ 生成器**不自动折**（截断 ≠ 不折行）',
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

/**
 * ★ 第三类（2026-10-23 新增，拍板结论）：**库里的"组件属性键"** —— 它们**不是样式键**，
 * 但 `@style` 这一层故意把它们写成 `Style` 的键（好用、可组合），由**渲染层摘出来挂成 prop**
 * （`render.mbt` 的 `is_prop_key` / `split_prop_keys`）。
 *
 * ⚠️ 为什么必须单独一张表：判据 1 的形状是"库能产出、而 RN 的**样式**登记表里没有 ⇒ 必须登记" ——
 * 而这一类**本来就不该在样式登记表里**。不分开的话，门会把一个**正确**的设计判成"没登记"。
 * 分开之后要断的是**另外两件事**（都在下面判据 7）：
 *   ① 它确实**不在** RN 的样式登记表里（在的话说明我们用错了通道：属性当样式发）；
 *   ② 它确实**在** RN 与 RNW 的 `Text` 实现里（**从装在本仓库里的真源码读**，不是凭记忆）。
 */
const PROP_KEYS = {
  numberOfLines: {
    why: '它不是样式键，是 `Text` 的**组件属性**（`<Text numberOfLines={1}>`）；留在 `style` 里两端都错：原生 RN **静默忽略**、RNW 把它当非法 CSS',
    instead:
      '**怎么用它**：`@style.Style::number_of_lines(1.0)`（库会把它摘出来挂成 prop）。⚠️ 语义与 `white-space: nowrap` **不同**：这是**截断**（超出部分去掉、通常带省略号），不是"不折行"。所以**生成器不自动折**（会自动改变外观），要哪一处用由**人**显式写。',
    plan: '显式键（2026-10-23 拍板："加，但不自动折"）',
    /** 到两端源码里找它的文件名（相对 react-native / react-native-web 的包根）。 */
    sources: ['Libraries/Text/Text.js', 'dist/exports/Text/index.js'],
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
  // ⚠️ **属性键（`PROP_KEYS`）不参与这一条**：它们本来就不该在**样式**登记表里（见那张表的注释）。
  const missingSomewhere = [...keys]
    .filter((k) => !PROP_KEYS[k])
    .filter((k) => missingIn(k).length > 0)
    .sort();
  const unregistered = missingSomewhere.filter((k) => !RN_UNSUPPORTED[k]);
  say(
    unregistered.length === 0,
    '★ 每一个"库能产出、而原生 RN 认不出"的键都在登记表里（新键必须登记，不许悄悄通过）' +
      (unregistered.length
        ? `\n      → **没登记**：${unregistered.join('、')}\n      → 登记处：${'tools/style_platform_check.mjs'} 的 \`RN_UNSUPPORTED\`（要写 why 与 instead）`
        : `（实测这 ${missingSomewhere.length} 个：${missingSomewhere.join('、')}）`),
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

// ── 判据 7：**属性键**（`PROP_KEYS`）—— 通道对不对，从两端真源码里读 ──────────
//
// 为什么单独一条：判据 1 只证明"这个键不在样式登记表里"。而**光不在**还不构成设计正确 ——
// 要证明的是"它走的是属性那条通道、而且**两端都认**"。两件事都能从装在本仓库里的源码读，
// 不需要凭记忆（也**不许**凭记忆：`numberOfLines` 是我"记得"RN 支持，记错了就白写）。
{
  const propKeys = Object.keys(PROP_KEYS);
  say(propKeys.length > 0, `属性键表非空（${propKeys.join('、')}）`);
  for (const k of propKeys) {
    const p = PROP_KEYS[k];
    // ① 它**不该**在样式登记表里（在的话说明我们把一个属性当样式发了）
    const inStyleReg = regs.filter((r) => r.keys.has(k)).map((r) => r.version);
    say(
      inStyleReg.length === 0,
      `属性键 \`${k}\` **不在** RN 的样式登记表里（在的话说明通道用错了：属性不该当样式发）` +
        (inStyleReg.length ? `\n      → 居然在：${inStyleReg.join('、')}` : ''),
    );
    // ② 它**必须**在两端 `Text` 的实现里（一次读源码，两个包都查）
    for (const rel of p.sources) {
      const hits = [];
      const searched = [];
      for (const r of regs) {
        const file = path.join(ROOT, 'examples/apps', r.app, 'node_modules', rel.startsWith('dist/') ? 'react-native-web' : 'react-native', rel);
        if (!fs.existsSync(file)) continue;
        searched.push(r.version);
        const src = fs.readFileSync(file, 'utf8');
        if (new RegExp(`\\b${k}\\b`).test(src)) hits.push(r.version);
      }
      const which = rel.startsWith('dist/') ? 'react-native-web' : 'react-native';
      if (!searched.length) {
        console.log(`SKIP  判据 7-②（${which} 没装：${rel}）`);
        continue;
      }
      say(
        hits.length === searched.length,
        `★ 属性键 \`${k}\` 在 **${which}** 的 \`Text\` 实现里真的有（${rel}）` +
          `（读了 ${searched.length} 份：${searched.join('、')} ⇒ 命中 ${hits.join('、') || '无'}）` +
          (hits.length === searched.length ? '' : '\n      → 没命中：说明我记错了或版本变了 ⇒ **这个键不能这么用**'),
      );
    }
  }
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
  // ③ "属性键真的在 `Text` 实现里"那条的谓词（判据 7-②）：喂一份**没有**它的假源码 ⇒ 必须不命中
  // ⚠️ 假源码里**一个字母都不能提那个键**（第一版我在注释里写了"既没有 xxx" ⇒ 谓词当然命中 ⇒
  //    这条证伪自己假红了一次：**证伪的夹具也要干净**）。
  const fakeText = 'function Text(props) { return null; }';
  say(
    !sourceMentionsKey(fakeText, 'numberOfLines') && sourceMentionsKey('const n = props.numberOfLines;', 'numberOfLines'),
    '证伪③：判据 7-② 用的谓词**两个方向都动**（假源码 ⇒ 不命中；真形态 ⇒ 命中）—— 它不会恒真',
  );
  // ④ 反向：**词边界**是不是真的起作用（`fooNumberOfLinesBar` 不该被当成命中）
  say(
    !sourceMentionsKey('props.fooNumberOfLinesBar = 1;', 'numberOfLines'),
    '证伪④：那个谓词认**词边界**（`fooNumberOfLinesBar` 不算命中）—— 免得把"提到了这个名字"当成"支持这个属性"',
  );
}

console.log(`\nstyle_platform_check: 通过 ${pass} 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
