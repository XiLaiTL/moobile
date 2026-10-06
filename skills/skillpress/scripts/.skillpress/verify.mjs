#!/usr/bin/env node
// verify.mjs —— 本示例的**判据入口**：**委托**给 skillpress 引擎里那份，不在这里重写一套。
//
// 为什么委托（而不是另写一份断言）：这个站点的判据有一半是"**渲染出来的内容与内容源逐字一致**"，
// 那要以 skillpress 的 `skills/**` 为准；在这里重写等于又造一份会漂的实现。
// 这与 `examples/apps/zhouyi-reader-webview/verify.mjs` 的做法一致（它也是 spawn 应用自己那份）。
//
//   node verify.mjs          # = 引擎的 verify-site.mjs（真 Chrome 无头 + 自起静态服务）
//
// 引擎在哪：环境变量 `SKILLPRESS_ENGINE` 优先；否则按**两个项目是兄弟**的布局找
// `../../../skillpress/lib/verify-site.mjs`（程序现在住在 `interest/skillpress/`，
// 与 `interest/moobile/` 平级 —— 见 `skillpress/README.md` 的目录表）。
// 找不到就 **SKIP**（要大声说出来）—— 这个示例可以被单独拿走，但那时它自己没有判据，
// 真门在 skillpress 那边（`npm run verify`）。

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const CANDIDATES = [
  process.env.SKILLPRESS_ENGINE && path.resolve(process.env.SKILLPRESS_ENGINE, 'lib/verify-site.mjs'),
  path.resolve(HERE, '../../../../../skillpress/lib/verify-site.mjs'),
].filter(Boolean);

const engine = CANDIDATES.find((p) => fs.existsSync(p));
if (!engine) {
  console.log('SKIP：找不到 skillpress 引擎（跨项目）—— 站点判据在 skillpress 那边跑：');
  console.log('      node <skillpress>/bin/skillpress.mjs verify --app <本目录>');
  console.log(`      找过：${CANDIDATES.join(' ｜ ')}`);
  process.exit(0);
}

const r = spawnSync(process.execPath, [engine, '--app', HERE, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: HERE,
});
process.exit(r.status ?? 2);
