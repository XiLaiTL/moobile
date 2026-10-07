#!/usr/bin/env node
// build-web.mjs —— 把 MoonBit 产物打成一个静态站点（`dist/`）。
//
//   npm run build     # moon build + moobile-host build + 这个脚本
//   npm run serve     # 起静态服务看一眼（零依赖）
//
// ## 这条流水线里"宿主"是哪几步
//
//   ① 编产物：`moon build --target js` + `moobile-host build`（**发现**产物，不写死路径）
//   ② 打包：esbuild —— **一行 `alias` 把 `react-native` 指到 `react-native-web`**
//      （Metro / Expo 在 web 平台干的也是这件事，只是藏在预设里）
//   ③ 外壳：一份静态 `index.html` + `#root`
//
// 打出来的 `dist/` 扔进任何静态服务器就能跑 —— PWA / Tauri / Electron 那一类外壳要的正是这个形态。
//
// ⚠️ **必须钉住 `absWorkingDir`**：esbuild 的 `alias` 值是**按 cwd 解析**的（不是按 import
//    它的那个文件）。不写这一行，从仓库根跑就会红在 `Could not resolve "react-native-web"`，
//    而 cd 进这个目录跑却是绿的 —— 构建脚本该与 cwd 无关。
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT = path.join(HERE, 'moobile.js');
const DIST = path.join(HERE, 'dist');

if (!fs.existsSync(ARTIFACT)) {
  console.error(`build-web.mjs: 找不到产物 ${ARTIFACT}\n  先跑 \`npm run build\`（它会先编 MoonBit 产物）`);
  process.exit(2);
}

const esbuild = await import('esbuild').catch(() => null);
if (!esbuild) {
  console.error('build-web.mjs: esbuild 没装 —— 先 `npm install`');
  process.exit(2);
}

// ── **新鲜度自查**（2026-10-07 加）─────────────────────────────────────────────
//
// 这一步是被一次**假绿**逼出来的：证伪 `img` 的 `src → source` 改写时，改了库源码、
// 跑了 `moon build`、跑了本脚本 —— 图片读数**照样全绿**。真因是 `./moobile.js` 是
// `moobile-host build` 从 `_build/` **拷**过来的那一份，而 `moon build` 只更新 `_build/`；
// 少跑一步拷贝 ⇒ 本脚本**悄悄打的是上一版代码**。更坏的是打印的 sha256 也一起是旧的，
// 于是"两次跑出来一模一样"看着像"改动没影响"。
//
// ⇒ 规则：**打完之前先问一句"我手上这份是不是这次的"**。问法是从 `moobile-host` 拿
//    **真正的**产物路径（`build --print-path`，它自己会做发现），比 mtime。比它旧就中止。
//    ⚠️ 刻意**不自动替你拷贝**：那会把"少跑一步"这个真问题藏起来（本仓库的负面清单第一条）。
//    确实想打旧产物（排查用）⇒ `--allow-stale`。
const CLI = path.join(HERE, 'node_modules', 'moobile-host', 'bin', 'cli.js');
const ALLOW_STALE = process.argv.includes('--allow-stale');
if (!ALLOW_STALE) {
  let real = null;
  try {
    real = execFileSync(process.execPath, [CLI, 'build', '--print-path'], { encoding: 'utf8' }).trim();
  } catch {
    console.error(
      'build-web.mjs: 拿不到真正的产物路径（`moobile-host build --print-path` 失败了）。\n' +
        '  它失败通常意味着 `_build/` 里还没有 JS 产物 —— 先 `moon build --target js`。\n' +
        '  只是想强行打手上这份旧产物：`node build-web.mjs --allow-stale`。',
    );
    process.exit(2);
  }
  const mine = fs.statSync(ARTIFACT).mtimeMs;
  const theirs = fs.existsSync(real) ? fs.statSync(real).mtimeMs : 0;
  if (theirs > mine) {
    console.error(
      'build-web.mjs: **手上这份 `moobile.js` 比 `_build/` 里的旧**，打出来的是上一版代码。\n' +
        `  _build/ 里的：${path.relative(HERE, real)}（${new Date(theirs).toLocaleString()}）\n` +
        `  手上这份：  moobile.js（${new Date(mine).toLocaleString()}）\n` +
        '  ⇒ 跑 `npm run build`（= moon build + moobile-host build + 本脚本），或先 `npx moobile-host build`。\n' +
        '  ⚠️ 别用"再打一次看看"绕过去：那正是这次假绿的成因。',
    );
    process.exit(2);
  }
}

const bytes = fs.readFileSync(ARTIFACT);
const sha = crypto.createHash('sha256').update(bytes).digest('hex');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.copyFileSync(path.join(HERE, 'index.html'), path.join(DIST, 'index.html'));

const built = await esbuild.build({
  entryPoints: [path.join(HERE, 'index.js')],
  bundle: true,
  outfile: path.join(DIST, 'bundle.js'),
  platform: 'browser',
  format: 'iife',
  metafile: true,
  logLevel: 'silent',
  absWorkingDir: HERE,
  alias: { 'react-native': 'react-native-web' },
  define: { 'process.env.NODE_ENV': '"development"', __ARTIFACT_SHA__: JSON.stringify(sha) },
  loader: { '.js': 'jsx' },
});

// 依赖图与产物指纹都落盘：前者是"包里有没有 Expo"最硬的证据（看输入清单，不看产物文本），
// 后者让页面/服务能自证"跑的是**这一次**编的产物"。
fs.writeFileSync(
  path.join(DIST, 'metafile.json'),
  JSON.stringify({ inputs: Object.keys(built.metafile.inputs) }, null, 2),
);
fs.writeFileSync(
  path.join(DIST, 'artifact.json'),
  JSON.stringify({ sha, bytes: bytes.length, builtAt: new Date().toISOString(), host: 'webview' }, null, 2),
);

const size = fs.statSync(path.join(DIST, 'bundle.js')).size;
console.log(
  `build-web.mjs: dist/bundle.js ${(size / 1024).toFixed(0)} KB · moobile.js ${(bytes.length / 1024).toFixed(0)} KB · sha256 ${sha.slice(0, 16)}…`,
);
