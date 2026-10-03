#!/usr/bin/env node
// native_rn_check.mjs —— 验 `MOBILE_HOST.native`（平台替代物）的 RN 侧实现。
//
// ## 为什么需要它
//
// `npm/moobile-host/native-rn.js` 里有 `import { AppState } from 'react-native'`，
// 而 `react-native` 在本仓库**没有装**（它是 optional peerDependency）。后果：
//   · `moon check` 碰不到它（那是 MoonBit 侧的门）；
//   · 离线门禁也编译不到它；
//   · 于是它是一个**纯盲区**：写错了要等真机跑起来才知道。
//
// ## 它验什么、不验什么（别读大）
//
// ✅ 验：这个文件**自身的逻辑** —— 订阅有没有真的订上、载荷映射对不对、
//    退订有没有真的摘掉、覆盖语义对不对。做法是真 import、真调、真断言。
// ❌ 不验：RN 的 `AppState` 在真机上到底什么时候发 `change`、
//    以及它发出来的 state 字符串是不是这三个 —— **那必须真机验**
//    （`tools/verify_android.py` 的形状，按 Home 键 / 回前台）。
//    本脚本用 stub 就是承认这一点，而不是假装覆盖了它。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'npm', 'moobile-host', 'native-rn.js');

let pass = 0;
let fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

// ── 搭一个临时目录：stub 的 react-native + 被检文件的一份拷贝 ──
//
// 为什么是拷贝而不是直接 import 原文件：裸模块名 `react-native` 是按
// **导入方所在目录**向上找 `node_modules` 的，仓库里没有它 —— 所以只能在
// 临时目录里造一个能被它找到的 stub。
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'native-rn-check-'));
fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ type: 'module' }));

const rnDir = path.join(tmp, 'node_modules', 'react-native');
fs.mkdirSync(rnDir, { recursive: true });
fs.writeFileSync(
  path.join(rnDir, 'package.json'),
  JSON.stringify({ name: 'react-native', version: '0.0.0-stub', type: 'module', main: 'index.js' }),
);
fs.writeFileSync(
  path.join(rnDir, 'index.js'),
  [
    'const listeners = [];',
    'export const AppState = {',
    '  addEventListener(type, handler) {',
    '    const entry = { type, handler };',
    '    listeners.push(entry);',
    '    return { remove() { const i = listeners.indexOf(entry); if (i >= 0) listeners.splice(i, 1); } };',
    '  },',
    '};',
    'const dimListeners = [];',
    // ⚠️ stub 要能改尺寸：`geometry.read()` 的判据是"读的是**当前**值"（不是启动时缓存的）
    'let winSize = { width: 390, height: 844 };',
    'export const Dimensions = {',
    '  get(dim) { return dim === "window" ? { ...winSize } : { ...winSize }; },',
    '  addEventListener(type, handler) {',
    '    const entry = { type, handler };',
    '    dimListeners.push(entry);',
    '    return { remove() { const i = dimListeners.indexOf(entry); if (i >= 0) dimListeners.splice(i, 1); } };',
    '  },',
    '};',
    'globalThis.__rnStub = {',
    '  listeners,',
    '  dimListeners,',
    '  emit(state) { listeners.slice().forEach((l) => l.handler(state)); },',
    '  emitDimension(width, height) { winSize = { width, height }; dimListeners.slice().forEach((l) => l.handler({ window: { width, height } })); },',
    '  setWindowSize(width, height) { winSize = { width, height }; },',
    '};',
    '',
  ].join('\n'),
);
fs.copyFileSync(SRC, path.join(tmp, 'native-rn.js'));

const mod = await import(url.pathToFileURL(path.join(tmp, 'native-rn.js')).href);
const { RN_NATIVE, withNative } = mod;
const stub = globalThis.__rnStub;

console.log('native-rn.js —— RN 平台替代物（stub react-native，非真机）');

// ① 形状：库侧的 `subscribe_bool` 适配器要的是一个 `subscribe(cb) -> unsubscribe`
ok('visibility.subscribe 是函数', typeof RN_NATIVE.visibility?.subscribe === 'function');

// ② 订阅真的订上了 AppState 的 change
let seen = [];
const un = RN_NATIVE.visibility.subscribe((hidden) => seen.push(hidden));
ok('订阅后 AppState 上恰好一个 change 监听', stub.listeners.length === 1, `实得 ${stub.listeners.length}`);
ok('监听的事件名是 change', stub.listeners[0]?.type === 'change', `实得 ${stub.listeners[0]?.type}`);
ok('subscribe 返回了退订函数', typeof un === 'function');

// ③ 载荷映射：与 DOM `document.hidden` 同义（true = 不可见）
stub.emit('active');
stub.emit('background');
stub.emit('inactive');
ok(
  'active → false（可见），background/inactive → true（不可见）',
  JSON.stringify(seen) === JSON.stringify([false, true, true]),
  `实得 ${JSON.stringify(seen)}`,
);

// ④ 退订真的摘掉，且不再推进
seen = [];
un();
ok('退订后监听被摘掉', stub.listeners.length === 0, `实得 ${stub.listeners.length}`);
stub.emit('background');
ok('退订后不再收到推送', seen.length === 0, `实得 ${JSON.stringify(seen)}`);

// ⑤ 覆盖语义：应用的 native 覆盖 RN 默认（测试与特例都要靠它）
ok('withNative() 保留 RN 默认', withNative().visibility === RN_NATIVE.visibility);
const custom = { subscribe: () => () => {} };
ok('withNative({visibility}) 覆盖默认', withNative({ visibility: custom }).visibility === custom);
ok('withNative(undefined) 不炸', typeof withNative(undefined).visibility.subscribe === 'function');

// ⑥ geometry ← @sub.on_resize（N5b：原来在 RN 上"静默给 0"的那一条）
ok('geometry.subscribe 是函数', typeof RN_NATIVE.geometry?.subscribe === 'function');
let dims = [];
const unGeo = RN_NATIVE.geometry.subscribe((v) => dims.push(v));
ok('geometry 订阅挂在 Dimensions 的 change 上', stub.dimListeners.length === 1, `实得 ${stub.dimListeners.length}`);
ok('geometry 的订阅不补发初始值（与 DOM 一致）', dims.length === 0, `实得 ${JSON.stringify(dims)}`);
stub.emitDimension(320.4, 640.6);
ok(
  'geometry 载荷取整（与 DOM 的整数语义对齐）',
  JSON.stringify(dims) === JSON.stringify([{ width: 320, height: 641 }]),
  `实得 ${JSON.stringify(dims)}`,
);
unGeo();
ok('geometry 退订摘掉监听', stub.dimListeners.length === 0, `实得 ${stub.dimListeners.length}`);

// ⑥b geometry.**read()** ← `@sub.current_viewport()`（第十一轮补的"读一次"那一半）
//
// 为什么单列一组：订阅与读一次是**两个形状**（`subscribe(cb)` / `read()`），
// 而"只实现了 subscribe 的宿主"必须能让库侧回退（`read_json` 给 `null` → 走 DOM），
// 所以"read 存在"与"read 的形状对不对"要分开断言。
ok('geometry.read 是函数（读一次当前视口）', typeof RN_NATIVE.geometry?.read === 'function');
const vp = RN_NATIVE.geometry.read();
ok(
  'geometry.read() 给出取整后的 {width, height}',
  Boolean(vp) && Number.isInteger(vp.width) && Number.isInteger(vp.height) && vp.width > 0 && vp.height > 0,
  JSON.stringify(vp),
);
stub.setWindowSize(412.7, 915.2);
const vp2 = RN_NATIVE.geometry.read();
ok(
  'geometry.read() 读的是**当前**尺寸（不是启动时缓存的）',
  JSON.stringify(vp2) === JSON.stringify({ width: 413, height: 915 }),
  JSON.stringify(vp2),
);
ok(
  'geometry 两个形状都在（变化走 subscribe、当前值走 read）',
  typeof RN_NATIVE.geometry.subscribe === 'function' && typeof RN_NATIVE.geometry.read === 'function',
);

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n通过 ${pass}  失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
