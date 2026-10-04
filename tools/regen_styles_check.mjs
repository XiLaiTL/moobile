#!/usr/bin/env node
// regen_styles_check.mjs —— **样式层再生成的判据门**（`verify_all.sh` 里的离线一项）。
//
//   node tools/regen_styles_check.mjs
//
// ## 它判什么
//
// 对**每一个由 `create --from-rabbita` 生成的迁移应用**（判据：有
// `migration.generated.json`）重算样式模块，与磁盘上的 `styles/styles.mbt`
// **逐函数**比对：
//
//   · 全部一致                 → 通过
//   · 有差异 / 新增 / **孤儿** → 失败，并逐条点名
//   · 源项目不在本机           → **SKIP**（退出码 2），不是失败也不是通过
//
// 第三条为什么必须有（2026-10-23 实测）：源项目 `interest/yi/zhouyi_reader` 在**仓库外面**，
// 所以新鲜克隆（含 CI）上必然找不到它。这条门原先一律记失败 ⇒ **一提交就会让 CI 红**，
// 而本机（有那个源项目）全绿 —— 正是本仓库栽过好几次的"本机绿、CI 红"。
// 判据不成立就不许说通过：`verify_all.sh` 会把退出码 2 记成 SKIP（与上面 F1 对账那条同一个规矩）。
//
// 为什么"有差异"也算失败（而不是只报信息）：`styles.mbt` 头上写着"不要手改"，
// 但人就是会改。**只有"必须同步"才能保证"生成器改了 → 产物一定跟着走"这条链不断**；
// 一旦允许沉默地不一致，下次谁都不敢重生成（2026-10-23 就是这么卡的，见
// `npm/moobile-host/lib/migrate/regen-diff.js` 的文件头）。
// 同步是**有意识的一步**：先 `--diff` 看清楚，再 `--sync`。
//
// ## 证伪（本仓库的规矩：判据必须证明自己能红）
//
// 门里带一个**故意做坏的样本**：把真实应用的 `styles.mbt` 复制一份，人工改一格 +
// 加一格，然后断言 `diffApp` **必须**报出"有差异 ≥1 + 孤儿 ≥1"。这条不通过 ⇒ 门红。
// 只跑"真实应用全绿"是不够的 —— 那也可能是"比对根本没生效"。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// `regen-diff.js` 是 CommonJS（宿主包那一层都是），在 ESM 里用 createRequire 拿它。
const require = createRequire(import.meta.url);
const { diffApp } = require(path.join(ROOT, 'npm/moobile-host/lib/migrate/regen-diff.js'));

/** 真实应用解析出来的源目录（证伪夹具要用同一个源）。 */
function r0SrcRoot(appDir) {
  const r = diffApp({ appDir });
  if (!r.ok) throw new Error('无法解析源目录：' + r.reason);
  return r.srcRoot;
}

let pass = 0;
let fail = 0;
const say = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  ok ? pass++ : fail++;
};

// ── ① 找出所有迁移生成的应用 ────────────────────────────────────────────────
const appsDir = path.join(ROOT, 'examples/apps');
const apps = [];
for (const name of fs.readdirSync(appsDir)) {
  const dir = path.join(appsDir, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (fs.existsSync(path.join(dir, 'migration.generated.json'))) apps.push({ name, dir });
}
say(apps.length > 0, `找到 ${apps.length} 个迁移生成的应用：${apps.map((a) => a.name).join(', ') || '(无)'}`);

// ── ② 逐个比对 ──────────────────────────────────────────────────────────────
//
// ⚠️ 两种"没比成"必须分开（2026-10-23 实测）：
//   · **源项目不在本机**（`../yi/zhouyi_reader` 在仓库**外面** ⇒ 新鲜克隆 / CI 上必然如此）
//     —— 那是"环境不够，没验"，记 **SKIP**；
//   · 产物与重算**真的不一致** —— 那才是红。
//   原先一律 `say(false)` ⇒ 这条门**一提交就会让 CI 红**，而本机全绿（本机有那个源项目）。
//   这与上面 `verify_all.sh` 里 F1 对账那条门是同一个规矩：**判据不成立就不许说通过**。
let compared = 0;
let skippedNoSrc = 0;
const okApps = [];
for (const a of apps) {
  const r = diffApp({ appDir: a.dir });
  if (!r.ok) {
    if (r.missingSource) {
      console.log(`SKIP  ${a.name}：${r.reason}`);
      skippedNoSrc++;
      continue;
    }
    say(false, `${a.name}：${r.reason}`);
    continue;
  }
  compared++;
  okApps.push(a);
  const c = r.counts;
  const clean = c.changed === 0 && c.added === 0 && c.orphan === 0;
  if (clean) {
    say(true, `${a.name}：${c.same} 个函数逐字一致（生成器与产物同步）`);
  } else {
    say(
      false,
      `${a.name}：与生成器不一致 —— 一致 ${c.same} / 有差异 ${c.changed} / 新增 ${c.added} / 孤儿 ${c.orphan}` +
        `\n      → 先看：cd ${path.relative(ROOT, a.dir).replace(/\\/g, '/')} && npx moobile-host regen --styles --diff` +
        (c.changed ? `\n      → 有差异：${c.changed ? r.groups.changed.map((x) => x.name).slice(0, 8).join(', ') : ''}` : '') +
        (c.added ? `\n      → 新增：${r.groups.added.map((x) => x.name).join(', ')}` : '') +
        (c.orphan ? `\n      → **孤儿**：${r.groups.orphan.map((x) => x.name).join(', ')}` : ''),
    );
  }
}

// ── ③ 证伪：做坏的样本必须被抓住 ────────────────────────────────────────────
//
// 夹具是从**真实产物**复制出来的，所以它也要有可用的源项目 —— 源不在本机时这条做不了，
// 记 SKIP（与上面同一个规矩），不许假绿、也不许假红。
const sample = okApps[0];
if (sample) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'regen-styles-falsify-'));
  const dir = path.join(tmp, sample.name);
  fs.mkdirSync(path.join(dir, 'styles'), { recursive: true });
  fs.copyFileSync(
    path.join(sample.dir, 'migration.generated.json'),
    path.join(dir, 'migration.generated.json'),
  );
  let src = fs.readFileSync(path.join(sample.dir, 'styles', 'styles.mbt'), 'utf8');
  // ① 改一格（人工修正）
  const before = src;
  src = src.replace(/\n    \.font_size\(13\.0\)/, '\n    .font_size(17.0)');
  const mutated = src !== before;
  // ② 加一格（人工新增）
  src = src.replace(
    '\npub fn att(',
    '\n///|\n/// 【证伪夹具】人工新增的一格。\npub fn falsify_manual() -> @style.Style {\n  @style.Style::new().font_size(9.0)\n}\n\n///|\npub fn att(',
  );
  fs.writeFileSync(path.join(dir, 'styles', 'styles.mbt'), src);
  // ⚠️ 夹具必须**自洽**：`migration.generated.json` 里的 `from` 是"相对仓库根"写的，
  //    直接搬到临时目录会解析不到源项目（第一版就这么假红了 —— 报的是"源找不到"，
  //    而不是"没抓住人工改动"）。所以显式把源目录也指过去。
  const srcRoot = r0SrcRoot(sample.dir);
  const r = diffApp({ appDir: dir, srcRoot });
  const caught = r.ok && r.counts.orphan >= 1 && (r.counts.changed >= 1 || !mutated);
  say(
    caught,
    `证伪：人工改一格 + 加一格 ⇒ 必须报出来（实测 差异 ${r.ok ? r.counts.changed : '?'} / 孤儿 ${r.ok ? r.counts.orphan : '?'}）`,
  );
  if (!mutated) console.log('      ⚠️ 夹具没能改到任何一格（正则没命中）—— 这条证伪的说服力是打折的');
  fs.rmSync(tmp, { recursive: true, force: true });
} else {
  console.log('SKIP  证伪（人工改一格 + 加一格）：没有可比对的应用（源项目不在本机）');
}

// ── ④ 结论 ──────────────────────────────────────────────────────────────────
//
// 一个应用都没比成（源项目不在本机）⇒ **没有任何判据成立** ⇒ 退出码 2：
// `verify_all.sh` 会把它记成 **SKIP**（不是 PASS）。这也是"本机绿 ≠ CI 绿"那条：
// 本机有那个源项目，所以这条永远绿；CI 上没有，所以它必须是 SKIP 而不是红。
if (fail === 0 && compared === 0) {
  console.log(
    `\nregen_styles_check: 一个应用都没能比对（${skippedNoSrc} 个的源项目不在本机：新鲜克隆 / CI 上正常）`,
  );
  console.log('  ⇒ 记 SKIP（退出码 2）：判据不成立就不许说通过。');
  process.exit(2);
}

console.log(
  `\nregen_styles_check: 通过 ${pass} 失败 ${fail}` +
    (skippedNoSrc ? `（另有 ${skippedNoSrc} 个应用的源项目不在本机，已跳过）` : ''),
);
process.exit(fail === 0 ? 0 : 1);
