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

// 视口固定：`getBoundingClientRect` 与 `elementFromPoint` 都是**视口相对**的，
// 窗口大小不确定的话，"按 rect 算出的点"落到哪里就不确定 —— 判据跟着飘。
await send('Emulation.setDeviceMetricsOverride', {
  width: 1000, height: 900, deviceScaleFactor: 1, mobile: false,
});

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

/**
 * ★ **命中自检门**：下面每个"按下点"在浏览器里真的要落在那个元素上。
 *
 * 这条门是**被一次假结果逼出来的**：第二行 7 列挤在一行里互相压住，于是
 * "拖 both-box"实际拖到了压在上面的另一个盒子 —— 日志是空的，而**空日志和"没实现"
 * 长得一模一样**，一次跑出三个假结论（E3/E4/E6 全空、E7 的正对照也是假的）。
 * 所以：**凡是按坐标发事件的地方，先证明坐标命中的是它自己。**
 */
section('①-补 命中自检（按坐标发事件的前提）');
const HIT_POINTS = [
  // [盒子 testID, dx, dy]；dx/dy 为 null 表示取中心
  ['rngh-box', null, null], ['rngh0-box', null, null], ['pan-box', null, null], ['wrapped-box', null, null],
  ['nested-inner', null, null], ['deep-box', 50, 30], ['multi-box', null, null],
  ['both-box', null, null], ['plain-box', null, null], ['scrolldrag-box', null, null], ['scrolltap-box', null, null],
];
{
  const bad = [];
  for (const [id, dx, dy] of HIT_POINTS) {
    const hit = await evalJs(`window.__hitAt ? window.__hitAt(${JSON.stringify(id)}, ${dx}, ${dy}) : '(无 __hitAt)'`);
    if (hit !== 'ok') bad.push(`${id} → ${hit}`);
  }
  check('每个按下点都命中**它自己**（否则后面那些"零事件"全是假的）',
    bad.length === 0, bad.join(' · ') || `${HIT_POINTS.length} 个点全部命中`);
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

// ═══════════════════════════════════════════════════════════════════════════════
// ⑦ 边界（README §7）—— 上面几节问"能不能用"，这一节问"**契约在边缘上怎么表态**"。
//
// 每一条都是**先写期望、再让探针去证伪**：期望来自"应用会怎么用"，
// 不是来自"实现恰好怎么做"。红了才是收获 —— 说明实现与契约对不上，
// 而应用会照着契约写逻辑，然后在那个边界上悄悄写错状态。
// ═══════════════════════════════════════════════════════════════════════════════
section('⑤ 边界：嵌套 / 深层子元素 / 多指 / 同挂 / 无处理器 / 状态机');

const logAll = async () => {
  const raw = await evalJs('JSON.stringify(window.__log || [])');
  return raw ? JSON.parse(raw) : [];
};
const phaseOf = (kind) => kind.slice(kind.lastIndexOf('.') + 1);
const byPrefix = (evs, p) => evs.filter((e) => e.kind.startsWith(p));

/**
 * 相位状态机不变量（契约里承诺的，应用可以照着写状态机）：
 * `start` 恰好一次且在最前；`end`/`cancel` 最多一次且在最后；两者**互斥**。
 */
function checkStateMachine(label, evs) {
  const ph = evs.map((e) => phaseOf(e.kind));
  const starts = ph.filter((p) => p === 'start').length;
  const terms = ph.filter((p) => p === 'end' || p === 'cancel').length;
  const okOrder =
    (ph.length === 0) ||
    (ph[0] === 'start' &&
      starts === 1 &&
      (ph.length === 1 || (terms === 1 && ph[ph.length - 1] !== 'move' && ph[ph.length - 1] !== 'start')));
  check(`${label}：相位状态机（start 恰一次且在最先，end/cancel 恰一次且在最后）`, okOrder, ph.join(' → ') || '(空)');
  if (ph.length && ph[0] === 'start') {
    check(`${label}：起点 \`dx/dy\` 为 0（"从按下起算"在第一个事件上就该成立）`,
      evs[0].dx === 0 && evs[0].dy === 0, `dx=${evs[0].dx} dy=${evs[0].dy}`);
  }
  return ph;
}

/** 把正在滚动的位置读出来（E4/E5 用；观察值，浏览器里鼠标拖不动 `overflow` 容器，见正文）。 */
const scrollY = async () => Number(await evalJs('window.__scroll ? window.__scroll() : 0'));

// ── E1 嵌套：父子都挂 onPan ────────────────────────────────────────────────────
{
  await evalJs('window.__log = []');
  const inner = parsed['nested-inner'];
  await drag(inner.x, inner.y, 30, 0);
  const evs = await logAll();
  const outerEvs = byPrefix(evs, 'edge.nested.outer.');
  const innerEvs = byPrefix(evs, 'edge.nested.inner.');
  check('E1 嵌套：**子**拿走手势（收到完整相位）',
    innerEvs.length >= 3, `子 ${innerEvs.length} 条 / 父 ${outerEvs.length} 条`);
  check('E1 嵌套：**父一个事件都不收**（RN responder 从最深处往上问，子先答 yes；' +
    '父想"也感知"得走别的机制）',
    outerEvs.length === 0, `父收到 ${outerEvs.length} 条：${outerEvs.map((e) => e.kind).join(',') || '(无)'}`);
  checkStateMachine('E1 子', innerEvs);
  const s = innerEvs[0] || {};
  check('E1 子元素自己的 `x/y` 相对**子元素**（48px 见方 → 起点 ≈ 24,24）',
    Math.abs(s.x - 24) <= 3 && Math.abs(s.y - 24) <= 3, `x=${s.x} y=${s.y}`);
}

// ── E2 深层子元素被触摸：x/y 相对谁 ────────────────────────────────────────────
//
// 期望：仍相对**挂手势的元素**。这是"元素内坐标"这句话的全部意义 ——
// 罗盘/滑杆那类交互拿 `x` 直接换算刻度，手指落在里面的文字上就换参照系的话，
// 同一块区域的刻度会给出两个值。
{
  await evalJs('window.__log = []');
  const b = parsed['deep-box'];
  // 按下点选在**子元素内**且**偏移开**（子元素在父元素里的原点是 (20,10)）：
  //   相对父元素 → (50,30)；相对子元素 → (30,20)。两个数不同，才分得出来。
  await drag(b.left + 50, b.top + 30, 30, 0);
  const evs = byPrefix(await logAll(), 'edge.deep.');
  const s = evs.find((e) => e.kind === 'edge.deep.start') || {};
  const moves = evs.filter((e) => e.kind === 'edge.deep.move');
  const last = moves.at(-1) || {};
  check('E2 ★ 深层子元素：`x/y` 相对**挂手势的元素**（起点 ≈ 50,30），' +
    '不是相对被触摸的那个子元素（那会是 30,20）',
    Math.abs(s.x - 50) <= 3 && Math.abs(s.y - 30) <= 3,
    `x=${s.x} y=${s.y}（父参照系 50,30 / 子参照系 30,20）`);
  check('E2 ★ 滑出子元素范围后 `x` 仍在**同一个参照系**里连续增长（≈80，不跳）',
    Math.abs(last.x - 80) <= 4, `最后一条 move 的 x=${last.x}（期望 ≈80；父参照系）`);
  check('E2 `dx` 不受参照系影响（≈30）', Math.abs(last.dx - 30) <= 3, `dx=${last.dx}`);
  checkStateMachine('E2', evs);
}

// ── E4/E5 滚动容器抢响应者 ────────────────────────────────────────────────────
//
// ⚠️ **这一条在浏览器里测不出"滚动抢走"**：鼠标拖动不会滚 `overflow` 容器
//    （滚动是触摸/滚轮行为），所以这里只锁**契约那半**：
//    真被抢走时收到的是 `cancel`、且 `cancel` 是最后一次（不会再有 `end`）——
//    应用据此才能安全地"回滚这次拖动"。**滚动那一半留真机**（见 README §7）。
{
  await evalJs('window.__log = []');
  const b = parsed['scrolldrag-box'];
  const before = await scrollY();
  await drag(b.x, b.y, 0, -60);
  const evs = byPrefix(await logAll(), 'edge.scroll.');
  const ph = evs.map((e) => phaseOf(e.kind));
  const after = await scrollY();
  console.log(`     观察：拖动后 scrollY ${before} → ${after}（浏览器鼠标拖动**不**滚 overflow 容器）`);
  check('E4 滚动容器：`cancel` 若出现，必是最后一次（不会 `cancel` 之后又 `end`）',
    !ph.includes('cancel') || ph.lastIndexOf('cancel') === ph.length - 1, ph.join(' → ') || '(空)');
  checkStateMachine('E4', evs);
}

// ── E6 同挂 onPan + onTap ─────────────────────────────────────────────────────
{
  await evalJs('window.__log = []');
  const b = parsed['both-box'];
  const hit = await evalJs(
    `(() => { const e = document.elementFromPoint(${b.x}, ${b.y});` +
    ` return e ? (e.getAttribute('data-testid') || e.tagName) : '(null)'; })()`,
  );
  console.log(`     诊断：both-box 中心 (${Math.round(b.x)},${Math.round(b.y)}) 命中的元素 = ${hit}`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, button: 'none' });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', buttons: 1, clickCount: 1 });
  // ⚠️ 这一口 `sleep` 不能省：按下与抬起之间不给一帧，responder 的 grant 还没落地，
  //    release 就追上来把本次手势收掉了 —— 日志会是**空的**，而"空"看起来跟"功能没实现"
  //    一模一样（第一次跑就吃到了这个假失败）。判据红的时候先怀疑探针，这条又应验一次。
  await sleep(120);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x + 1, y: b.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(300);
  const evs = await logAll();
  const pans = byPrefix(evs, 'edge.both.pan.');
  const taps = byPrefix(evs, 'edge.both.tap');
  console.log(`     诊断：本次日志 ${evs.length} 条 —— ${evs.map((e) => e.kind).join(', ') || '(空)'}`);
  check('E6 同挂：一次轻点 → `pan` 与 `tap` **各触发一次**（文档已声明"二选一"，行为得与文档一致）',
    pans.length >= 2 && taps.length === 1, `pan ${pans.length} 条 / tap ${taps.length} 条`);
}

// ── E7 无处理器：包装过但没挂手势 ─────────────────────────────────────────────
//
// ⚠️ **这条必须带正对照**：如果整条鼠标管线恰好是死的，"零事件"会**假通过** ——
//    一个永远为空的日志能让任何"不该有事件"的断言都变绿。
//    所以先拖 `both-box`（挂了处理器，必须有事件）证明管线是活的，再拖 `plain-box`。
{
  await evalJs('window.__log = []');
  const live = parsed['both-box'];
  await drag(live.x, live.y, 20, 0);
  const control = (await logAll()).length;
  await evalJs('window.__log = []');
  const b = parsed['plain-box'];
  await drag(b.x, b.y, 30, 0);
  const evs = await logAll();
  check('E7 无处理器：包装过、但一个手势 prop 都没给的元素**不抢响应者**（拖它没有任何事件）',
    evs.length === 0 && control > 0,
    `plain ${evs.length} 条 / 正对照（both-box）${control} 条${control === 0 ? ' ← 正对照也是 0，说明这条是假通过' : ''}`);
}

// ── E3 多指：诚实报手指数，位移锁在第一指 ─────────────────────────────────────
//
// ⚠️ 用 CDP 的**真触摸事件**（不是鼠标）：多指只有触摸能表达。
// ⚠️ 而且**必须放在最后**并**用完就关**：`setTouchEmulationEnabled` 会把后续的鼠标事件
//    也改造成触摸事件，实测开着它跑 E4/E6/E7 时日志**全空**（三节一起假通过/假失败）——
//    "验证脚本要能识别自己拿到的是不是这次的"这条规矩，这里又应验一次。
// 期望：`pointers` 报 2（契约里这个字段就是为多指留的，恒报 1 就是撒谎）；
// 且 `dx/dy` **仍跟第一指** —— 所以这里**两根手指都动**（第二根反向动 40px）：
// 若实现跟错了手指，`dx` 会立刻跳到另一根或两指中间，一眼能看出来。
{
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await evalJs('window.__log = []');
  const b = parsed['multi-box'];
  const y = b.y;
  const t = (id, x) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 });
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [t(1, b.x)] });
  await sleep(60);
  // 第二指落下（与第一指相隔 40px），此后**两根都动**：第一指 +30、第二指 −40
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [t(1, b.x), t(2, b.x + 40)] });
  await sleep(60);
  for (let i = 1; i <= 4; i++) {
    await send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [t(1, b.x + (30 * i) / 4), t(2, b.x + 40 - (40 * i) / 4)],
    });
    await sleep(40);
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  const evs = byPrefix(await logAll(), 'edge.multi.');
  const pointers = evs.map((e) => e.pointers).filter((v) => typeof v === 'number');
  const maxP = pointers.length ? Math.max(...pointers) : 0;
  const lastMove = evs.filter((e) => e.kind === 'edge.multi.move').at(-1) || {};
  console.log(`     ${evs.length} 条事件 · pointers 取值 ${[...new Set(pointers)].join('/') || '(无)'}`);
  check('E3 ★ 多指：`pointers` **诚实报 2**（契约里这个字段就是为多指留的）',
    evs.length > 0 && maxP === 2, `实测最大 pointers=${maxP}`);
  check('E3 ★ 多指：两根手指都动、第一指 +30 第二指 −40 → `dx` 仍跟**第一指**（≈30）',
    Math.abs(lastMove.dx - 30) <= 5,
    `dx=${lastMove.dx}（跟错手指会变成 −40 或 −5）`);
  checkStateMachine('E3', evs);
}

// ── 汇总 ─────────────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.ok).length;
console.log(`\n================ 汇总 ================`);
console.log(`通过 ${pass}  失败 ${results.length - pass}`);
// ⚠️ **全绿也要显式退出**：静态服务与 Chrome 都还活着，事件循环不会自己空 ——
//    第一版就是这样"跑完了但进程不退"，被上层超时杀掉；而**被杀的进程不会执行清理**，
//    于是 8098 端口与一个无头 Chrome 留在了机器上，下一次跑就报
//    `EADDRINUSE: address already in use 127.0.0.1:8098`（看着像端口冲突，其实是上次没收尾）。
killAll();
process.exit(results.some((r) => !r.ok) ? 1 : 0);
