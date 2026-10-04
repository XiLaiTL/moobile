// facts.js —— **机器可读产物里那一段"当前事实"**的形状与算法（单一真源）。
//
// ## 为什么要有它（2026-10-23）
//
// `migration.generated.json` 是 `create` 写的"同一份报告的机器可读形态"，而它**从来没人读**：
// 写它的注释说"进得了 `--check` 类的门"，那个门一直没写。于是它安静地漂了 ——
// 实测（zhouyi-reader）：JSON 里记着 `510 = 435 + 75`、`unmatchedLost: 18`、`scan 18 类 / 357 处`，
// 而**今天从同一个源重算**是 `510 = 439 + 71`、`unmatchedLost: 0`、`19 类 / 362 处`。
// 紧挨着的那份 `MIGRATION.md` 漂的是同样的数 —— 因为两份都是"迁移那天"的。
//
// ⚠️ 但两份的**性质不同**，这也是为什么这里只修 JSON 那一份：
//   · `MIGRATION.md` = 迁移当天的生成物 **＋ 人手补记**（顶部那段 `⚠️ 本地补记（人手写的…）`）
//     ⇒ "重新生成"会**冲掉人的补记**，所以它只能当**叙述**，不能当权威数字。
//   · `migration.generated.json` = **纯生成物、没有手写内容** ⇒ 完全可以"重算 + 比对 + 同步"，
//     而且它的读者是**机器/LLM**（会拿它当数据用）⇒ **它必须说现在的事**。
//
// ## 契约（写清楚，免得下一个人又对着两套数字猜）
//
//   · `facts` = **当前事实**（`facts.generatedAt` 是它算出来的时间）。**读数字读这里。**
//   · 顶层的 `styles` / `scan` = **迁移当天**的记录，保留作历史（不要当现状用）。
//   · 判据：`tools/migrate_facts_check.mjs` —— `facts` 必须与"从源重算一遍"逐字段一致；
//     不一致就红（`--sync` 重写它，并刷新 `generatedAt`）。

const path = require('path');

const MT = require('./style-emit.js');
const classRewrite = require('./class-rewrite.js');

/**
 * 事实块的**形状**（纯函数：只从已经算好的东西里挑字段，不自己重算）。
 *
 * ⚠️ 写这一份的（`create.js`）与验这一份的（`tools/migrate_facts_check.mjs`）**共用它** ——
 * 否则"形状"会漂，而漂了的形状比没有形状更坏（门会假装在验）。
 */
function factBlock({ gen, scan }) {
  return {
    styles: {
      classes: gen.classes.length,
      accounting: { ...gen.accounting },
      unmatchedLost: gen.unmatchedRules.filter((u) => u.lost).length,
      ruleLosses: { ...gen.ruleLossSummary },
    },
    scan: scan
      ? {
          files: scan.files,
          lines: scan.lines,
          kinds: scan.findings.length,
          hits: scan.findings.reduce((n, f) => n + f.count, 0),
          findings: scan.findings.map((f) => ({ id: f.id, count: f.count })),
        }
      : null,
  };
}

/**
 * **从源项目重算**那段事实（门那一侧用的就是它）。
 *
 * 重算的**配方必须与 `create` 一致**，否则算出来的数永远对不上：
 *   · 样式：`walkSource` → `pickPackages`（只看 UI 包的 `.mbt` 拿 `class=` 用法）→
 *     `styles.generate(全部源文件, { sites })`。`walkSource` / `pickPackages` 直接从
 *     `create.js` 里拿（它是导出的）—— **不复制一份**，复制的配方一定会漂。
 *   · 动检：`scan.js` 的 `scanProject({ root, lib })`，`lib` 要给**仓库根**（`create` 就是这么传的）。
 *
 * @param {{srcRoot: string, lib: string, appName?: string}} opts
 */
function computeFacts({ srcRoot, lib, appName = 'app' }) {
  const { walkSource, pickPackages } = require('./create.js');
  const srcFiles = walkSource(srcRoot);
  const { packages } = pickPackages(srcFiles);
  const uiFiles = [];
  for (const list of packages.values()) uiFiles.push(...list);
  const { sites } = classRewrite.extractSites(uiFiles.filter((f) => f.rel.endsWith('.mbt')));
  const gen = MT.generate(srcFiles, { appName, sites });

  let scan = null;
  let scanError = null;
  try {
    const { scanProject } = require('./scan.js');
    scan = scanProject({ root: srcRoot, lib });
  } catch (err) {
    scanError = err.message;
  }
  return { gen, scan, scanError, facts: factBlock({ gen, scan }) };
}

module.exports = { factBlock, computeFacts };
