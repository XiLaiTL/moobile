#!/usr/bin/env node
// verify.mjs —— **静态 Web 宿主**（零 Expo、零 Metro）的判据。
//
//   cd examples/apps/zhouyi-reader-webview
//   npm install
//   node verify.mjs
//
// ## 它验的不是"又一个能打开的网页"，而是**同一套界面判据换宿主仍然全过**
//
// 判据分三层，每层回答一个不同的问题：
//
//   A. **打包面**：这个工程的依赖图里**一个 Expo / Metro 包都没有**（证据是 esbuild 的
//      输入清单，不是产物文本）、原生 `react-native` 本体没被卷进来（只有 `react-native-web`）。
//      ⇒ "它跑起来了"与 Expo 无关，是实测。
//   B. **产物面**：服务端那一份 `artifact.json` 的 sha256 与磁盘上 `../zhouyi-reader/moobile.js`
//      **逐字节一致**，而且 bundle 里真的嵌了这个指纹。
//      ⇒ 浏览器吃的就是**这一次**编的产物（本仓库踩过"两次跑出来一模一样"）。
//   C. **界面面**：把**应用自己那 99 条判据**（`../zhouyi-reader/verify.mjs`）**原样**指向
//      这个静态服务的 URL 跑一遍 —— 首屏 / 罗盘画像素 / 拖拽重绘 / 轻点进卦 / 搜索 → 网格 /
//      点卦卡进详情 / 折叠 21 条 / 无 console 错误。
//      ⇒ 换宿主之后**界面行为一样**，而不是"能渲染出一个壳"。
//
// ⚠️ C 是这条门的重点：**从头写一套断言 = 又一份会漂的实现**。这里是 `spawnSync` 那个脚本，
//    并且**要求它的汇总行是 `通过 45 失败 0`** —— 少一条都算红（不然它悄悄变成 12 条也能过）。
//
// 不进 `verify_all.sh`：要 Chrome + 本目录的 `node_modules`（esbuild / react-native-web），
// 与 `host-swap-spike` 同一档（需要本机资源，手动跑）。

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', 'zhouyi-reader');
const DIST = path.join(HERE, 'dist');
const APP_VERIFY = path.join(APP, 'verify.mjs');
// ⚠️ 这个数字跟着应用那份判据走：`../zhouyi-reader/verify.mjs` 涨到多少，这里就写多少
//    （少了它，"换宿主之后判据条数变少"也会被当成通过 —— 十轮把它从 45 更新到 81）。
const EXPECT_APP_ASSERTIONS = 99;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  <- ' + detail : ''}`);
  return ok;
}
/** 环境不够（没装依赖 / 没编产物）—— 与仓库其它探针同一约定：exit 2 = 没验，不是红。 */
function skipOut(why) {
  console.log(`SKIP  ${why}`);
  process.exit(2);
}

// ── 0) 前置 ──────────────────────────────────────────────────────────────────
if (!fs.existsSync(path.join(HERE, 'node_modules', 'esbuild'))) {
  skipOut('依赖没装 —— `cd examples/apps/zhouyi-reader-webview && npm install`');
}
if (!fs.existsSync(path.join(APP, 'moobile.js'))) {
  skipOut(`产物不在 —— 先编一次：cd examples/apps/zhouyi-reader && npm run build`);
}
if (!fs.existsSync(APP_VERIFY)) {
  skipOut(`找不到应用自己的判据 ${APP_VERIFY}（C 层就是靠它，少了它这条门没有意义）`);
}

// 依赖图里"不该有的东西" —— 用正则表，两项都能单独报
const FORBIDDEN = [
  [/node_modules[\\/]expo(-|$)/, 'expo 包'],
  [/node_modules[\\/](@expo|metro|expo-modules)/, 'Expo / Metro 运行时'],
  [/node_modules[\\/]react-native[\\/]/, '原生 react-native 本体'],
];

// ── 1) 打包 ──────────────────────────────────────────────────────────────────
console.log('── 打包（esbuild：react-native → react-native-web）──');
const build = spawnSync(process.execPath, [path.join(HERE, 'build.mjs')], { cwd: HERE, encoding: 'utf8' });
check('build.mjs 退出码 0', build.status === 0, (build.stdout || '').trim().split('\n').pop() || (build.stderr || '').trim().split('\n').slice(-2).join(' / '));
if (build.status !== 0) {
  console.log((build.stdout || '') + (build.stderr || ''));
  report();
}
console.log('      ' + (build.stdout || '').trim().split('\n').join('\n      '));

const meta = JSON.parse(fs.readFileSync(path.join(DIST, 'metafile.json'), 'utf8'));
const inputs = meta.inputs;
for (const [re, label] of FORBIDDEN) {
  const hit = inputs.filter((p) => re.test(p));
  check(`依赖图里没有${label}`, hit.length === 0, hit.slice(0, 3).join(' ') || `共 ${inputs.length} 个输入`);
}
const rnwInputs = inputs.filter((p) => /node_modules[\\/]react-native-web[\\/]/.test(p));
check('依赖图里有 `react-native-web`（宿主就是靠它顶 `react-native`）', rnwInputs.length > 0, `${rnwInputs.length} 个文件`);
check(
  '打出来的是静态站点（`index.html` + `bundle.js` 都在 dist/ 里）',
  fs.existsSync(path.join(DIST, 'index.html')) && fs.existsSync(path.join(DIST, 'bundle.js')),
);
const bundleSize = fs.statSync(path.join(DIST, 'bundle.js')).size;
check('bundle 大小合理（> 1 MB —— 里面装着 3 MB 的 moobile.js）', bundleSize > 1024 * 1024, `${(bundleSize / 1024).toFixed(0)} KB`);

// ── 2) 产物新鲜度（"跑的是不是这一次编的"）────────────────────────────────────
console.log('\n── 产物新鲜度 ──');
const diskSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, 'moobile.js'))).digest('hex');
const served = JSON.parse(fs.readFileSync(path.join(DIST, 'artifact.json'), 'utf8'));
check('服务端那一份指纹 = 磁盘上 `moobile.js` 的 sha256', served.sha === diskSha, `服务端 ${served.sha.slice(0, 16)}… / 磁盘 ${diskSha.slice(0, 16)}…`);
check('bundle 里嵌了同一个指纹（页面能自证它跑的是哪一份）', fs.readFileSync(path.join(DIST, 'bundle.js'), 'utf8').includes(diskSha), diskSha.slice(0, 16) + '…');

// ── 3) 起静态服务 ────────────────────────────────────────────────────────────
console.log('\n── 静态服务（零依赖，就是 serve.mjs 那 30 行）──');
const { createStaticServer } = await import('./serve.mjs');
// ⚠️ 默认**不要**用 `serve.mjs` 那个给人用的固定端口（8123）：上一次跑剩下的服务、
//    或者人自己开的那个，会让这里 `EADDRINUSE` 直接崩 —— 而崩的位置看起来像"服务起不来"，
//    真因是端口被别人占着（实测踩到：前一次超时被杀，socket 还挂着）。
//    所以这里默认 `0`（让 OS 给一个空闲端口），要固定端口才用 `WEBVIEW_PORT`。
const PORT = Number(process.env.WEBVIEW_PORT || 0);
const server = createStaticServer();
await new Promise((res, rej) => {
  server.once('error', rej);
  server.listen(PORT, '127.0.0.1', res);
});
const URL_ = `http://127.0.0.1:${server.address().port}/`;
check(`静态服务起来了（${URL_}）`, true);
try {
  const html = await (await fetch(URL_)).text();
  check('服务返回的是这个站点的 `index.html`（有 #root 与 bundle.js）', html.includes('id="root"') && html.includes('bundle.js'), `${html.length} 字节`);
  const servedArtifact = await (await fetch(URL_ + 'artifact.json')).json();
  check('HTTP 上那份 artifact.json 与磁盘一致（不是缓存的旧文件）', servedArtifact.sha === diskSha, servedArtifact.sha.slice(0, 16) + '…');
} catch (e) {
  check('静态服务能响应', false, String(e.message));
}

// ── 4) 界面判据：**原样**跑应用自己那 99 条 ──────────────────────────────────
console.log('\n── 界面判据：`../zhouyi-reader/verify.mjs` 指向这个宿主 ──');
// ⚠️★ **必须用异步的 `spawn`，不能用 `spawnSync`** —— 这一条是本轮的真教训：
//    静态服务就**跑在这个进程里**，而 `spawnSync` **阻塞事件循环** ⇒ 服务无法响应
//    ⇒ Chrome 加载不出 bundle ⇒ 子进程里的页面永远渲染不出来。
//    表现极具误导性：门"只是很慢"（8 分钟没输出），而真因是**父进程把自己的服务堵死了**。
//    （单独在前台跑 `node ../zhouyi-reader/verify.mjs <URL>` 却 3 分钟就 45/45 —— 差别就在这里。）
//
// 另外两件防御（不是这次的病因，但都是真坑）：
//  ① CDP 端口可能被**上一轮残留的 Chrome** 占着（它还指着上一轮的地址，早关了），
//     于是子进程连上去一直等 —— 所以先探一个没人应答的端口；
//  ② 子进程要有硬超时（没有上限的等待比红更难查）。
async function freeCdpPort(from = 9246, to = 9270) {
  for (let p = from; p <= to; p++) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 300);
      await fetch(`http://127.0.0.1:${p}/json/version`, { signal: ctl.signal });
      clearTimeout(timer);
      // 有人应答 —— 那是**别人的** Chrome（多半是上一轮的残留），换一个
    } catch {
      return p;
    }
  }
  return from;
}
const CDP_PORT = Number(process.env.PROBE_CDP_PORT || (await freeCdpPort()));
console.log(`      （CDP 端口 ${CDP_PORT}；子进程用异步 spawn 跑，父进程的服务才不会被堵住）`);

const run = await new Promise((resolve) => {
  const child = spawn(process.execPath, [APP_VERIFY, URL_], {
    cwd: APP,
    env: { ...process.env, PROBE_CDP_PORT: String(CDP_PORT) },
  });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  const killer = setTimeout(() => {
    child.kill();
    resolve({ out: out + '\n[TIMEOUT] 子进程超过 10 分钟没结束，已杀掉', error: { message: '超时（10 分钟）' } });
  }, 600000);
  child.on('close', (code) => {
    clearTimeout(killer);
    resolve({ out, status: code, error: null });
  });
});

const out = run.out;
// 先把子进程的尾部原样打出来（现场比结论有用：红在哪一条、页面当时是什么样）
console.log(
  out
    .trim()
    .split('\n')
    .slice(-14)
    .map((l) => '      ' + l)
    .join('\n'),
);
const m = out.match(/通过\s+(\d+)\s+失败\s+(\d+)/);
const passed = m ? Number(m[1]) : -1;
const failed = m ? Number(m[2]) : -1;
check(
  '应用的判据脚本跑完了并打出了汇总行',
  Boolean(m),
  m ? `通过 ${passed} 失败 ${failed}` : run.error ? `没跑完：${run.error.message}` : '（没有汇总行）',
);
check(
  `**同一条链的 ${EXPECT_APP_ASSERTIONS} 条界面判据在这个宿主上全过**`,
  passed === EXPECT_APP_ASSERTIONS && failed === 0,
  `通过 ${passed} 失败 ${failed}（应用那边期望 ${EXPECT_APP_ASSERTIONS}/0）`,
);
check('应用的判据没有 console 错误那条也没有红', failed === 0, failed === 0 ? '' : '有失败项 —— 见上面的明细');

server.close();

// ── 收尾 ─────────────────────────────────────────────────────────────────────
function report() {
  const pass = results.filter((r) => r.ok).length;
  console.log('\n================ 静态 Web 宿主（零 Expo / 零 Metro）汇总 ================');
  console.log(`通过 ${pass}  失败 ${results.length - pass}`);
  for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL  ${r.name}`);
  console.log('⚠️ 这条门验的是"**换宿主之后界面行为一样**"（同一个应用的判据原样复用）。');
  console.log('   本机没有真窗口/真机的部分（PWA 安装、Tauri/Electron 外壳）不在它范围里 —— 见 README。');
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}
report();
