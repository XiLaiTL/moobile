#!/usr/bin/env node
// migrate_facts_check.mjs —— **机器可读产物里的"当前事实"必须真的是当前的**
//
//   node tools/migrate_facts_check.mjs          # 判据模式（不一致就非零退出）
//   node tools/migrate_facts_check.mjs --sync   # 重写 facts 块（并刷新 generatedAt）
//
// ## 为什么是这一份（而不是 `MIGRATION.md`）
//
// 迁移会产出**两份报告**：人读的 `MIGRATION.md` 与机器读的 `migration.generated.json`
// （`create` 写的"同一份报告的机器可读形态"）。2026-10-23 实测：**两份都漂了同样的数**
// （`510 = 435 + 75` 而实际 439 + 71；`unmatchedLost: 18` 而实际 0；`18 类 / 357 处` 而实际 19 / 362），
// 因为两份都是"迁移那天"生成的，之后生成器改了、样式层被 `regen --styles` 同步过，而它们没跟。
//
// ⚠️ 但两份的**处置必须不同**：
//   · `MIGRATION.md` 里有**人手补记**（顶部那段 `⚠️ 本地补记（人手写的…）`）⇒ "重新生成"会
//     把人的东西冲掉 ⇒ 它只能当**叙述**（形态问题另议，见 `PLAN.md` §8.2 ④）。
//   · `migration.generated.json` 是**纯生成物**，而且**它的读者是机器/LLM**（会拿它当数据用）
//     ⇒ **它必须说现在的事**。这条门就是钉这一点的。
//
// ## 判据
//
//   ① **每一份机器可读产物都要有事实块与时间戳**（`facts.generatedAt` 能解析、`facts.tool` 在）
//      —— 没有时间戳的"事实"不是事实，读者没法判断它是哪天的。**这条不需要源项目。**
//   ② **`facts` 必须与"从源重算一遍"逐字段一致**（重算配方与 `create` 共用 `facts.js`，
//      所以两边不会漂）。**这条要仓库外的源项目，没有就 SKIP。**
//   ③ **证伪**：把重算结果里的一个数字改掉，比对器必须报出来（不然这条门只是摆设）。
//      这条也**不需要源项目**（用真实读数的一份副本当夹具）。
//
// ⚠️ 边界（别读大）：`facts` 只覆盖**样式层与 F1 动检**那两组数字，因为只有它们能"从源重算"。
//    重写统计 / TODO 清单 / 生成后自查那些，要跑完整条 `create` 才有 —— 它们**不在门里**。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { computeFacts } = require(path.join(ROOT, 'npm/moobile-host/lib/migrate/facts.js'));

const SYNC = process.argv.includes('--sync');

let pass = 0;
let fail = 0;
const say = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  ok ? pass++ : fail++;
};
const info = (msg) => console.log(`      · ${msg}`);
// ⚠️ `--sync` 只做同步：那几条判据是"比对"用的，在同步模式里先跑只会打出
// "还没有 facts 块"的 FAIL 噪声（第一版就那样，看着像同步失败了）。

/** 把两段事实摊成 `字段路径 → 值`，好逐字段报差异（而不是"两份 JSON 不相等"）。 */
function flatten(obj, prefix = '') {
  const out = new Map();
  for (const [k, v] of Object.entries(obj || {})) {
    const q = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of flatten(v, q)) out.set(k2, v2);
    } else {
      out.set(q, v);
    }
  }
  return out;
}

/**
 * 逐字段比"事实"。
 *
 * ⚠️ **只比重算结果里有的那些键**（`styles` / `scan`）—— 时间戳与工具名（`generatedAt` /
 * `tool` / `note`）**不在重算结果里**，拿它们比会永远假红（第一版就是这么红的：
 * 报的三个"字段不同"全是时间戳那一组）。要单纯：**比对的范围 = 事实的形状。**
 */
function diffFacts(recorded, recomputed) {
  const a = flatten(recorded);
  const b = flatten(recomputed);
  const rows = [];
  for (const k of b.keys()) {
    const av = a.get(k);
    const bv = b.get(k);
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      rows.push({ field: k, recorded: av, recomputed: bv });
    }
  }
  // 反过来也看一眼：**记了、但重算结果里根本没有**的键（形状漂了）也点名
  for (const k of a.keys()) {
    if (!b.has(k) && !/^(generatedAt|tool|note)$/.test(k)) {
      rows.push({ field: k, recorded: a.get(k), recomputed: '(重算里没有这个字段)' });
    }
  }
  return rows;
}

/** 找出所有迁移生成的应用（判据：有 `migration.generated.json`）。 */
const appsDir = path.join(ROOT, 'examples/apps');
const apps = [];
for (const name of fs.existsSync(appsDir) ? fs.readdirSync(appsDir) : []) {
  const dir = path.join(appsDir, name);
  const manifest = path.join(dir, 'migration.generated.json');
  if (fs.existsSync(manifest)) apps.push({ name, dir, manifest });
}
say(apps.length > 0, `前提自查：找到 ${apps.length} 个迁移生成的应用（${apps.map((a) => a.name).join('、')}）`);

// ── 判据 ①：事实块与时间戳在不在（不需要源项目）───────────────────────────────
let withFacts = 0;
const missingStamp = [];
for (const a of apps) {
  const j = JSON.parse(fs.readFileSync(a.manifest, 'utf8'));
  const at = j.facts && j.facts.generatedAt;
  const ok = Boolean(at) && !Number.isNaN(Date.parse(at)) && Boolean(j.facts.tool);
  if (ok) withFacts++;
  else missingStamp.push(a.name);
}
if (!SYNC) {
  say(
    missingStamp.length === 0,
    '★ 每一份机器可读产物都有**事实块与时间戳**（`facts.generatedAt` / `facts.tool`）—— ' +
      '没有时间戳的"事实"不是事实，读者没法判断它是哪天的' +
      (missingStamp.length
        ? `\n      → 缺：${missingStamp.join('、')}（跑 \`node tools/migrate_facts_check.mjs --sync\` 补）`
        : `（实测 ${withFacts} 份都有）`),
  );
}

// ── 判据 ②：逐字段与重算一致（要仓库外的源项目）────────────────────────────────
let compared = 0;
let skippedNoSrc = 0;
let liveFacts = null; // 给证伪用的"真实读数"
for (const a of apps) {
  const j = JSON.parse(fs.readFileSync(a.manifest, 'utf8'));
  const srcRoot = resolveSrc(a.dir, j.from);
  if (!srcRoot) {
    console.log(`SKIP  ${a.name}：源项目不在本机（清单里 from=${JSON.stringify(j.from)}）`);
    skippedNoSrc++;
    continue;
  }
  const appName = path.basename(a.dir).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const { facts: recomputed, scanError } = computeFacts({ srcRoot, lib: ROOT, appName });
  if (scanError) info(`${a.name}：动检重算报错（${scanError}）—— 对应的字段会按 null 对待`);
  liveFacts = liveFacts || recomputed;

  if (SYNC) {
    const before = j.facts;
    j.facts = {
      generatedAt: new Date().toISOString(),
      tool: 'moobile-host create --from-rabbita',
      note:
        '这一段是**当前事实**（读数字读这里，generatedAt 是算它的时间）；顶层同名的 styles / scan 是**迁移当天**的记录，保留作历史',
      ...recomputed,
    };
    fs.writeFileSync(a.manifest, JSON.stringify(j, null, 2) + '\n');
    const rows = diffFacts(before || {}, recomputed);
    console.log(`SYNC  ${a.name}：facts 已重写（${rows.length} 个字段与上次不同）`);
    for (const r of rows) info(`${r.field}: ${JSON.stringify(r.recorded)} → ${JSON.stringify(r.recomputed)}`);
    compared++;
    continue;
  }

  compared++;
  if (!j.facts) {
    say(false, `${a.name}：没有 \`facts\` 块 —— 顶层数字是**迁移当天**的，不能当现状用（跑 \`--sync\`）`);
    continue;
  }
  const rows = diffFacts(j.facts, recomputed);
  say(
    rows.length === 0,
    `${a.name}：\`facts\` 与从源重算**逐字段一致**（${rows.length} 个字段不同）`,
  );
  for (const r of rows.slice(0, 12)) {
    console.log(`      → ${r.field}：记的 ${JSON.stringify(r.recorded)} / 实际 ${JSON.stringify(r.recomputed)}`);
  }
  if (rows.length > 12) info(`……还有 ${rows.length - 12} 个字段不同`);
}
if (!apps.length || compared === 0) {
  console.log(`SKIP  判据 ②（没有可比对的应用：源项目不在本机，或没有迁移应用）`);
}
if (SYNC) {
  console.log(`\nmigrate_facts_check: 同步完成（${compared} 个应用）`);
  process.exit(0);
}

// ── 判据 ③：证伪（比对器不是摆设）─────────────────────────────────────────────
{
  // 用**真实读数的一份副本**当夹具：改一个数字 ⇒ 必须被报出来。
  const sample = liveFacts || {
    styles: { classes: 104, accounting: { decls: 510, emitted: 439, lost: 71 }, unmatchedLost: 0, ruleLosses: { media: 19 } },
    scan: { files: 6, lines: 3139, kinds: 19, hits: 362, findings: [{ id: 'style.class', count: 122 }] },
  };
  const mutated = JSON.parse(JSON.stringify(sample));
  mutated.styles.accounting.emitted -= 4; // 就是实测到的那个漂移量
  const caught = diffFacts(mutated, sample);
  say(
    caught.length === 1 && caught[0].field === 'styles.accounting.emitted',
    `证伪：把重算结果里的一个数字改掉（emitted −4，正是实测到的那次漂移）⇒ 比对器必须点名它` +
      `（实测报了 ${caught.length} 处：${caught.map((c) => c.field).join('、') || '无'}）`,
  );
  const mutated2 = JSON.parse(JSON.stringify(sample));
  if (mutated2.scan && mutated2.scan.findings && mutated2.scan.findings[0]) {
    mutated2.scan.findings[0].count += 5; // 就是实测到的 357 → 362 那种漂移
    const caught2 = diffFacts(mutated2, sample);
    say(
      caught2.length >= 1,
      '证伪：改一条动检命中的处数 ⇒ 也必须点名（动检那一组数字同样有反应）',
    );
  }
}

console.log(`\nmigrate_facts_check: 通过 ${pass} 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);

/** 与 `regen-diff.js` 同一套"源项目在哪"的解析（`from` 是相对仓库根写的）。 */
function resolveSrc(appDir, from) {
  if (!from) return null;
  if (path.isAbsolute(from)) return fs.existsSync(from) ? from : null;
  const cands = [path.resolve(appDir, from)];
  let up = appDir;
  for (let i = 0; i < 4; i++) {
    up = path.dirname(up);
    cands.push(path.resolve(up, from));
  }
  for (const c of cands) if (fs.existsSync(c)) return c;
  return null;
}
