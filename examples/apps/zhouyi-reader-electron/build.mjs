#!/usr/bin/env node
// build.mjs —— 与 `../zhouyi-reader-webview/build.mjs` **同一条流水线**（这里只是那份的副本，
// 因为桌面壳要的就是"一个能装静态站点的壳"）：把同一份 MoonBit 产物打进 `dist/`，
// 既可以扔进静态服务器，也可以被 Electron 的 `loadFile` 直接装进窗口。
//
//   node build.mjs            # 需要先有 ../zhouyi-reader/moobile.js（npm run build 生成）
//   npm run serve             # 然后起静态服务（零依赖）
//
// ## 这条流水线里"宿主"是哪几步
//
//   ① 编译产物（应用自己的事）：`cd ../zhouyi-reader && npm run build`
//   ② 打包：esbuild —— **一行 `alias` 把 `react-native` 指到 `react-native-web`**
//      （Metro / Expo 在 web 平台干的也是这件事，只是藏在预设里）
//   ③ 外壳：一份静态 `index.html` + `#root`
//
// 没有 Metro、没有 Expo、没有 dev server —— 打出来的东西扔进任何静态服务器就能跑
// （PWA / Tauri / Electron 那一类外壳要的正是这个形态）。
//
// ⚠️ **必须钉住 `absWorkingDir`**：esbuild 的 `alias` 值是**按 cwd 解析**的（不是按 import
//    它的那个文件）。不写这一行，从仓库根跑就会红在 `Could not resolve "react-native-web"`，
//    而 cd 进这个目录跑却是绿的 —— 门必须与 cwd 无关。

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', 'zhouyi-reader');
const ARTIFACT = path.join(APP, 'moobile.js');
const DIST = path.join(HERE, 'dist');

if (!fs.existsSync(ARTIFACT)) {
  console.error(
    `build.mjs: 找不到产物 ${ARTIFACT}\n` +
      `  先编一次：cd ${path.relative(process.cwd(), APP) || '.'} && npm run build`,
  );
  process.exit(2);
}

const esbuild = await import('esbuild').catch(() => null);
if (!esbuild) {
  console.error('build.mjs: esbuild 没装 —— 在本目录跑一次 `npm install`');
  process.exit(2);
}

const artifactBytes = fs.readFileSync(ARTIFACT);
const sha = crypto.createHash('sha256').update(artifactBytes).digest('hex');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.copyFileSync(path.join(HERE, 'index.html'), path.join(DIST, 'index.html'));

let built;
try {
  built = await esbuild.build({
    entryPoints: [path.join(HERE, 'index.js')],
    bundle: true,
    outfile: path.join(DIST, 'bundle.js'),
    platform: 'browser',
    format: 'iife',
    metafile: true,
    logLevel: 'silent',
    absWorkingDir: HERE,
    alias: { 'react-native': 'react-native-web' },
    define: {
      'process.env.NODE_ENV': '"development"',
      __ARTIFACT_SHA__: JSON.stringify(sha),
    },
    loader: { '.js': 'jsx' },
  });
} catch (err) {
  console.error('build.mjs: esbuild 打包失败\n' + err.message);
  process.exit(1);
}

// 依赖图存下来给 verify.mjs 用（"包里有没有 Expo"最硬的证据是输入清单，不是产物文本）
fs.writeFileSync(
  path.join(DIST, 'metafile.json'),
  JSON.stringify({ inputs: Object.keys(built.metafile.inputs), outputs: Object.keys(built.metafile.outputs) }, null, 2),
);
// 产物指纹：verify.mjs 拿**服务端这一份**与磁盘上的产物比对（"跑的是不是这一次编的"）
fs.writeFileSync(
  path.join(DIST, 'artifact.json'),
  JSON.stringify({ sha, bytes: artifactBytes.length, builtAt: new Date().toISOString(), host: 'webview' }, null, 2),
);

const size = fs.statSync(path.join(DIST, 'bundle.js')).size;
console.log(`build.mjs: dist/bundle.js ${(size / 1024).toFixed(0)} KB · moobile.js ${(artifactBytes.length / 1024).toFixed(0)} KB · sha256 ${sha.slice(0, 16)}…`);
console.log(`  依赖图：${Object.keys(built.metafile.inputs).length} 个输入（expo/metro 一个都不该有）`);