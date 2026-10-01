#!/usr/bin/env node
// verify.mjs —— 手势通道试金石：在 **RNW(web) 宿主**上真拖一次，比两套实现。
//
//   node examples/apps/gesture-spike/host/verify.mjs
//
// ## 它回答什么（PLAN §7 的决策点 19）
//
// 「手势通道该用 `PanResponder`（RN 内置、零新依赖）还是 `react-native-gesture-handler`（RNGH）」——
// 这件事有**两个未知量**，都不能靠读文档定：
//
//   1. RNGH 在 **react-native-web 宿主**上跑不跑（包里有 275 个 `.web.js` 文件，但
//      "包里有 web 实现" ≠ "在我们的 RNW + esbuild 别名下能挂载并收到事件"）；
//   2. `PanResponder` 在 RNW 上**给不给元素内坐标**（responder 系统 RNW 也实现了；
//      零新依赖这条很吸引人，但"能点"≠"能拖且坐标对"）。
//
// ## 判据（不是"能拖"）
//
//   ① 两套都**挂载成功**（DOM 节点在页面上、没有 console.error / 未捕获异常）；
//   ② 都收到 **begin → 多次 update → end**（次数够，说明是连续拖动不是一次抖动）；
//   ③ 坐标是**元素内**的（落在 0..边长 内），且**位移跟着鼠标走**（`translationX` ≈ 实际 dx）——
//      只断言"回调被调了"抓不住"坐标全 0"，而"坐标全 0"正是 moobile 现在在 RN 上的毛病。
//   ④ 证伪：在**空白处**拖 → 两边的日志都必须**不增加**。
//
// ⚠️ 它只测 **web 宿主**（RNW）。原生侧要 `expo prebuild` + 重建 APK，是另一件事（本脚本不假装覆盖）。

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, 'dist');
const PORT = Number(process.env.SPIKE_PORT || 8098);
const CDP_PORT = Number(process.env.SPIKE_CDP_PORT || 9231);
const URL_ = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  <- ' + detail : ''}`);
  return ok;
}
function section(t) {
  console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 60 - t.length))}`);
}
function skipOut(why) {
  console.log(`SKIP  ${why}`);
  process.exit(0);
}

const CHROME_CANDIDATES = [
  process.env.CHROME,
  process.env['ProgramFiles'] && path.join(process.env['ProgramFiles'], 'Google/Chrome/Application/chrome.exe'),
  process.env['ProgramFiles(x86)'] &&
    path.join(process.env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// ── 1) 打包 ───────────────────────────────────────────────────────────────────
section('打包（esbuild：`react-native` → `react-native-web`）');
const entry = path.join(DIST, '_entry.jsx');
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(entry, fs.readFileSync(path.join(HERE, 'app.jsx'), 'utf8'));
try {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: path.join(DIST, 'app.js'),
    format: 'iife',
    jsx: 'automatic',
    loader: { '.js': 'jsx' },
    alias: { 'react-native': 'react-native-web' },
    // ★ `.web.js` 优先 —— 这条是 RNGH 能不能在 web 上跑的关键：
    //   包里 `lib/module/**/X.web.js` 是它的 **web 实现**，而 `X.js` 是原生实现
    //   （会去摸 NativeModules）。不配这条，esbuild 会挑原生那份 → 装上就炸。
    //   本仓库的宿主是 Metro/Expo（Metro 自己认 `.web.js`），spike 这边得显式告诉 esbuild。
    resolveExtensions: ['.web.js', '.web.jsx', '.web.mjs', '.js', '.jsx', '.mjs', '.json'],
    define: {
      'process.env.NODE_ENV': '"development"',
      // ★ `__DEV__` 必须由**打包器**定义 —— 实测：不定义的话 RNGH 的 web 构建
      //   一装载就 `ReferenceError: __DEV__ is not defined`（它按 RN 的惯例直接用这个全局）。
      //   Metro / Expo 会自动定义，所以**真实宿主不受影响**；受影响的是"裸 esbuild"这类自建打包
      //   （本仓库的 host-swap-spike 就是裸 esbuild —— 这条记在它头上）。
      __DEV__: 'true',
    },
    // ★ 两条**打包器职责**，实测出来的（Metro / Expo 自带，裸 esbuild 得自己补）：
    //   ① `__DEV__`：RNGH 按 RN 惯例直接用这个全局，没定义就 `ReferenceError`；
    //   ② `global`：它的 web 实现里还有 Node 风格的 `global`（浏览器没有这个标识符）。
    //   写在这条 banner 里而不是 `define` 里：`define` 只替换**标识符表达式**，
    //   而这两处是**自由变量查找**（bundle 外层的 `var` 正好能被 IIFE 闭包看见）。
    banner: { js: 'var __DEV__ = true; var global = globalThis;' },
    logLevel: 'silent',
  });
  check('打包成功（含 RNGH —— 它是先决条件，导不进来后面都不用谈）', true);
} catch (e) {
  check('打包成功', false, String(e.message).split('\n').slice(0, 4).join(' / '));
  process.exit(1);
}

fs.writeFileSync(
  path.join(DIST, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>gesture spike</title>
<style>body{margin:0;font-family:system-ui}</style>
<div id="root"></div><script src="./app.js"></script>`,
);

// ── 2) 静态服务 ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const f = path.join(DIST, p);
  if (!fs.existsSync(f)) {
    res.writeHead(404);
    return res.end('nope');
  }
  res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html' });
  res.end(fs.readFileSync(f));
});
await new Promise((res) => server.listen(PORT, '127.0.0.1', res));
check(`静态服务起来了（${URL_}）`, true);

// ── 3) 真 Chrome + CDP ────────────────────────────────────────────────────────
section('开真 Chrome（headless + CDP）');
const chrome = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) skipOut('本机没有 Chrome —— 这条门要真浏览器才算数。设 CHROME=<路径> 再来。');
const profile = path.join(os.tmpdir(), 'chrome_gesture_' + Date.now());
const chromeProc = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + profile,
    'about:blank',
  ],
  { stdio: 'ignore' },
);
const killAll = () => {
  try { server.close(); } catch {}
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${chromeProc.pid} /T /F`, { stdio: 'ignore' });
    else chromeProc.kill('SIGKILL');
  } catch {}
};
process.on('exit', killAll);

let targets = [];
for (let i = 0; i < 80; i++) {
  await sleep(250);
  try {
    targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
    if (targets.length) break;
  } catch {}
}
const page = targets.find((t) => t.type === 'page');
if (!page) skipOut('Chrome 起不来（CDP 连不上）');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
const problems = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    problems.push('console.error: ' + msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    problems.push('exception: ' + (d.exception?.description || d.text || '').split('\n').slice(0, 4).join(' / ').slice(0, 400));
  }
};
const send = (method, params = {}) =>
  new Promise((res) => { const i = ++msgId; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { __error: r.result.exceptionDetails.text };
  return r.result?.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 480, height: 320, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL_ });
await sleep(1200);

// ── 4) 挂载 ───────────────────────────────────────────────────────────────────
section('① 两套实现都挂载成功');
const boxes = await evalJs('JSON.stringify(window.__boxes ? window.__boxes() : null)');
const parsed = boxes ? JSON.parse(boxes) : null;
check(
  '两个方块都在页面上（RNGH 的 GestureDetector 在 RNW 下渲染出了真实 DOM）',
  Boolean(parsed && parsed['rngh-box'] && parsed['pan-box']),
  parsed ? Object.keys(parsed).join(', ') : `__boxes() 返回 ${boxes}`,
);
check('页面没有 console.error / 未捕获异常', problems.length === 0, problems.slice(0, 2).join(' | '));
if (!parsed || !parsed['rngh-box']) {
  console.log('\n（挂载失败就先看上面那条异常 —— 那是"RNGH 能不能用在我们宿主上"的答案。）');
  console.log(`\n================ 汇总 ================\n通过 ${results.filter((r) => r.ok).length}  失败 ${results.filter((r) => !r.ok).length}`);
  process.exit(1);
}

// ── 5) 真拖 ───────────────────────────────────────────────────────────────────
const drag = async (cx, cy, dx, dy, steps = 6) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy, button: 'none' });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= steps; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: cx + (dx * i) / steps,
      y: cy + (dy * i) / steps,
      button: 'left',
      buttons: 1,
    });
    await sleep(30);
  }
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: cx + dx, y: cy + dy, button: 'left', buttons: 0, clickCount: 1,
  });
  await sleep(200);
};

/**
 * 拖一次，然后按**该实现真正提供的位置字段**判断"跟手"。
 *
 * ⚠️ 两条实测出来的差别写在这里，因为它们是**判据该长什么样的依据**：
 *   1. **位移字段不同**：RNGH 给 `absoluteX`（屏幕坐标，精确）；PanResponder 给
 *      `locationX`（元素内）+ `pageX`（屏幕）。所以"跟手"要用各自最强的那一个字段断言，
 *      不能用同一个字段硬套（第一版拿 `translationX` 当判据就误判了，见下条）。
 *   2. **`translationX` 不是"按下即起算"**：默认 Pan 有**激活阈值**，跨过它之前一直是 0
 *      （实测：鼠标走了 20px 时 tx 还是 0，阈值约 13–20px）。所以 `tx` 只能当**观察值**，
 *      不能当"跟手"判据 —— 真正的判据是绝对坐标有没有跟着指针走。
 */
async function tryImpl(key, prefix, mode) {
  section(`② 真拖一次：${prefix}（${mode === 'rngh' ? 'RNGH' : 'PanResponder'}）`);
  await evalJs('window.__log = []');
  const b = parsed[key];
  const DX = 40;
  const DY = 0; // 只走横向：纵轴的断言留一条给"坐标不是常量"这条判据
  const startAbs = { x: b.x, y: b.y };
  await drag(b.x, b.y, DX, DY);
  const raw = await evalJs('JSON.stringify(window.__log || [])');
  const events = raw ? JSON.parse(raw) : [];
  const mine = events.filter((e) => e.kind.startsWith(prefix + '.'));
  const begins = mine.filter((e) => e.kind.endsWith('.begin'));
  const updates = mine.filter((e) => e.kind.endsWith('.update'));
  const ends = mine.filter((e) => e.kind.endsWith('.end'));
  console.log(`     ${mine.length} 条事件：begin ${begins.length} / update ${updates.length} / end ${ends.length}`);

  check(`${prefix}：收到 begin → update×N → end（连续拖动，不是一次抖动）`,
    begins.length >= 1 && updates.length >= 3 && ends.length >= 1,
    `begin ${begins.length} / update ${updates.length} / end ${ends.length}`);

  const b0 = begins[0] || updates[0] || {};
  const inBox = (v) => typeof v === 'number' && v >= -2 && v <= b.w + 2;
  check(`${prefix}：起点是**元素内坐标**（0..${Math.round(b.w)}），不是页面坐标也不是 0`,
    inBox(b0.x) && inBox(b0.y),
    `begin 的 x=${b0.x} y=${b0.y}（方块边长 ${Math.round(b.w)}）`);

  // ③ 跟手：用各自最强的位置字段
  let tracked = null;
  let how = '';
  if (mode === 'rngh') {
    const endEv = ends[ends.length - 1] || {};
    const lastUpd = updates[updates.length - 1] || {};
    const finalAbs = typeof endEv.ax === 'number' && endEv.ax !== 0 ? endEv.ax : lastUpd.ax;
    if (typeof finalAbs === 'number') {
      tracked = finalAbs - b0.ax;
      how = 'end/update 的 absoluteX − begin.absoluteX';
    }
  } else {
    const xs = updates.map((e) => e.pageX).filter((v) => typeof v === 'number');
    if (xs.length && typeof b0.pageX === 'number') {
      tracked = Math.max(...xs) - b0.pageX;
      how = 'update.pageX 最大值 − begin.pageX';
    }
  }
  check(`${prefix}：**位置跟着指针走**（${how || '没有可用的位置字段'} ≈ ${DX}，容差 ±3）`,
    tracked !== null && Math.abs(tracked - DX) <= 3,
    `实测 ${tracked}`);

  // ④ 观察值（不是断言）：translationX 与真实位移的差 —— 它揭示激活阈值
  const endEv2 = ends[ends.length - 1] || {};
  const tx = typeof endEv2.tx === 'number' ? endEv2.tx : null;
  console.log(
    `     观察：end.translationX = ${tx === null ? '(无)' : tx.toFixed(2)}，` +
      `而真实位移 = ${DX}` +
      (tx === null ? '' : `（差 ${(DX - tx).toFixed(2)} = 激活阈值带来的偏移）`),
  );
  return { tx, tracked };
}

const rnghStat = await tryImpl('rngh-box', 'rngh', 'rngh');
const rngh0Stat = await tryImpl('rngh0-box', 'rngh0', 'rngh');
const panStat = await tryImpl('pan-box', 'pan', 'pan');

// ⑤ 可操作性：默认的激活阈值**能不能关掉**（`minDistance(0)`）
check(
  'RNGH：默认 Pan 的 `translationX` 落后于真实位移（激活阈值），而 `minDistance(0)` 之后对得上',
  rnghStat.tx !== null && rngh0Stat.tx !== null && rnghStat.tx < 40 - 5 && Math.abs(rngh0Stat.tx - 40) <= 3,
  `默认 tx=${rnghStat.tx?.toFixed(2)} · minDistance(0) tx=${rngh0Stat.tx?.toFixed(2)}`,
);

// ── 6) 证伪 ───────────────────────────────────────────────────────────────────
section('③ 证伪：在空白处拖，两边都不该有事件');
await evalJs('window.__log = []');
await drag(460, 300, 30, 10);
const blankRaw = await evalJs('JSON.stringify(window.__log || [])');
const blank = blankRaw ? JSON.parse(blankRaw) : [];
check('空白处拖动 → 没有任何手势事件（说明上面那些事件确实来自那两个方块）',
  blank.length === 0, `${blank.length} 条`);

// ── 4) ★ 库自己的实现：契约断言（这一节才是"发出去的东西对不对"）──────────────────
//
// 前三节回答"RN 生态里有什么可用"；这一节回答"**我们发出去的那份实现**给出的载荷
// 是否符合 `gesture/gesture.mbt` 里那张契约表"。判据按契约逐条来，不按实现来：
// `x/y` 元素内、`dx/dy` **从按下起算**、`phase` 有始有终。
// ⚠️ 与 RNGH 那条对比：它的 `translationX` 在 40px 拖动上只给 20（激活阈值），
//    而**契约要求 40** —— 这正是"dx 由宿主算，不把别人的 translationX 漏出去"的意义。
section('④ 库自己的实现（`moobile-host/gesture-rn.js`）：按契约逐条验');
await evalJs('window.__log = []');
{
  const b = parsed['wrapped-box'];
  const DX = 40;
  await drag(b.x, b.y, DX, 0);
  const raw = await evalJs('JSON.stringify(window.__log || [])');
  const evs = (raw ? JSON.parse(raw) : []).filter((e) => e.kind.startsWith('wrapped.'));
  const starts = evs.filter((e) => e.kind === 'wrapped.start');
  const moves = evs.filter((e) => e.kind === 'wrapped.move');
  const ends = evs.filter((e) => e.kind === 'wrapped.end');
  console.log(`     ${evs.length} 条事件：start ${starts.length} / move ${moves.length} / end ${ends.length}`);

  check('④-1 阶段齐全（start → move×N → end）',
    starts.length === 1 && moves.length >= 3 && ends.length === 1,
    `start ${starts.length} / move ${moves.length} / end ${ends.length}`);

  const s0 = starts[0] || {};
  const inBox = (v) => typeof v === 'number' && v >= -2 && v <= b.w + 2;
  check('④-2 起点是**元素内**坐标，且 dx/dy 从 0 开始',
    inBox(s0.x) && inBox(s0.y) && s0.dx === 0 && s0.dy === 0,
    `x=${s0.x} y=${s0.y} dx=${s0.dx} dy=${s0.dy}（边长 ${Math.round(b.w)}）`);

  // ★ 契约的核心一条
  const lastMove = moves.at(-1) || {};
  check(`④-3 ★ \`dx\` **从按下起算**（≈ ${DX}，不是"从激活点起算"）`,
    typeof lastMove.dx === 'number' && Math.abs(lastMove.dx - DX) <= 3,
    `end.dx=${(ends.at(-1) || {}).dx} move.dx=${lastMove.dx}（RNGH 默认在同一条拖动上只给 20）`);

  check('④-4 屏幕坐标与元素内坐标分开给（ax/ay 有值且大于元素内坐标）',
    typeof lastMove.ax === 'number' && lastMove.ax > lastMove.x,
    `x=${lastMove.x} ax=${lastMove.ax}`);

  // 点按：大幅拖动**不该**触发；轻点该触发
  const tapsAfterDrag = evs.filter((e) => e.kind === 'wrapped.tap').length;
  await evalJs('window.__log = []');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, button: 'none' });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x + 2, y: b.y + 1, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(300);
  const tapRaw = await evalJs('JSON.stringify(window.__log || [])');
  const tapEvs = (tapRaw ? JSON.parse(tapRaw) : []).filter((e) => e.kind === 'wrapped.tap');
  check('④-5 大幅拖动**不**误触发点按，轻点**才**触发',
    tapsAfterDrag === 0 && tapEvs.length === 1,
    `拖动后 tap=${tapsAfterDrag}（应为 0）· 轻点后 tap=${tapEvs.length}（应为 1）`);
}

// ── 汇总 ─────────────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.ok).length;
console.log(`\n================ 汇总 ================`);
console.log(`通过 ${pass}  失败 ${results.length - pass}`);
if (results.some((r) => !r.ok)) process.exit(1);
