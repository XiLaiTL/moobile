// device_check.mjs —— gesture-edges 的**真机**验证：只有 Android 能回答的那几条手势边界。
//
//   cd examples/apps/gesture-edges && node device_check.mjs
//
// 前置：模拟器在跑、APK 已装（见 README），Metro 在跑（debug 包现拉 bundle）
//       且 `adb reverse tcp:8081 tcp:8081`。
//
// ## 它回答什么（web 那半回答不了的）
//
// `examples/apps/gesture-spike/` 在 RNW 上把边界验到 40/40，但下面这四条在浏览器里
// **压根不成立**，而它们恰好是最可能在真机上翻车的：
//
//   ① **嵌套归属**：内外都挂 `on_pan` 时谁收事件？web 上验的是 RNW 的 responder 协商，
//      原生走的是另一套（Android 触摸分发 + RN responder），结论不能平移。
//   ② **深层子元素的参照系**：RNW 给的是"挂手势那个元素"的局部坐标（契约要的正是这个），
//      而 Android 的 `locationX` 语义是"最深的被触摸 view" —— 若真机如此，
//      契约里"`x`/`y` 是元素内坐标"这句话在**最重要的平台上就是假的**。
//   ③ **可拖元素在滚动容器里**：web 上鼠标拖动**不滚** `overflow` 容器，问题不存在。
//   ④ **只挂 `on_tap` 的元素不该锁死滚动**：同上，只有真机有真滚动。
//
// ## 判据（每条都压一件具体的事）
//
//   ① 从**内盒**上滑 → `内 n` 涨、`内 c=0`、**`外 n` 一直是 0**（更具体的元素赢）
//   ② 从**子元素**上滑 → `深 起` ≈ `130,50`（相对**盒**）而不是 `70,26`（相对子元素）；
//      且 `末 − 起` ≈ 40（整条拖动在**同一个参照系**里 —— 这正是 `dx=155` 那次事故的病根）
//   ③ 在 `on_pan` 的块上竖滑 → 手势被它接住（`拖A n` 涨、`c=0`），**内容不滚**
//      （哨兵 `底A 见` 不出现）
//   ④ 在只挂 `on_tap` 的块上竖滑 → **内容滚了**（`底B 见` 出现）且 `点B` 不涨
//   ⑤ 证伪：在没有任何手势的元素上滑 → 三个计数器全都不许变
//
// ## 两条自己踩过、所以写下来的规矩
//
// 1. **`uiautomator dump` 失败时不会清掉上一次的 xml**，读到陈旧界面就会得出完全错误的结论
//    （`canvas-demo` 的 FINDINGS 记过）。所以这里**每次 dump 前先删掉旧文件**，
//    并把 dump 失败当**空**处理，由断言去暴露，而不是悄悄沿用上次的界面。
// 2. **跨度只看数字不看截图**：所有判据都从 token 文本里读整数，或者读节点 bounds。
//    截图只能证明"有东西"，证明不了"数字对"。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.EDGES_PKG || 'com.anonymous.gestureedges';
const APK = process.env.EDGES_APK || path.join(HERE, 'android/app/build/outputs/apk/debug/app-debug.apk');

/** 与 `app.mbt` 里算过的几何**逐字一致**（改布局就必须改这里，否则判据变成假红）。 */
const DEEP_IN_BOX = { x: 130, y: 50 }; // 子元素中心，相对**盒**
const DEEP_IN_CHILD = { x: 70, y: 26 }; // 子元素中心，相对**子元素**
const TOL = 16; // bounds 与 swipe 起点之间有取整差，16px 足够分开上面那两对数字（相差 60/24）

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  <- ' + detail : ''}`);
  return ok;
}
function section(t) {
  console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);
}
function skipOut(why) {
  console.log(`SKIP  ${why}`);
  process.exit(0);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** adb：**关掉 MSYS 的路径改写**（`/sdcard/x` 会被改成 `Files/Git/sdcard/x`，实测踩过）。 */
function adb(...args) {
  return execFileSync('adb', args, {
    encoding: 'utf8',
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });
}

// ── 0) 设备 ───────────────────────────────────────────────────────────────────
section('设备');
try {
  const dev = adb('devices');
  if (!dev.split('\n').some((l) => l.includes('\tdevice'))) skipOut('没有在线设备（先起模拟器）');
  check('有在线 Android 设备', true, dev.split('\n').find((l) => l.includes('\tdevice')).trim());
} catch (e) {
  skipOut(`adb 不可用：${String(e.message).split('\n')[0]}`);
}

// ── 1) 装 + 起 ────────────────────────────────────────────────────────────────
section('安装与启动');
if (!fs.existsSync(APK)) skipOut(`APK 不存在：${APK}（先 prebuild + gradlew assembleDebug）`);
console.log(`     APK: ${(fs.statSync(APK).size / 1024 / 1024).toFixed(1)} MB`);
adb('install', '-r', APK);
adb('shell', 'am', 'force-stop', PKG);
adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');

const UI = '/sdcard/edges-ui.xml';

/**
 * 取当前界面的 XML。
 *
 * ⚠️ **先删旧文件**：`uiautomator dump` 失败时会留下上一次的 xml，`cat` 拿到的就是
 * **上一次的界面**，然后一切断言都在一个不存在的界面上做（本仓库记过一次这种假结论）。
 * 删掉之后，dump 失败 → 文件不在 → 这里返回空串 → 断言红，而不是静默沿用旧界面。
 */
function uiXml() {
  try {
    adb('shell', 'rm', '-f', UI);
  } catch { /* 删不掉也要往下走，靠下面的 hasFile 兜底 */ }
  try {
    adb('shell', 'uiautomator', 'dump', UI, '>/dev/null', '2>&1');
  } catch { /* 偶发失败：按空处理 */ }
  try {
    return adb('shell', 'cat', UI);
  } catch {
    return '';
  }
}

/** 取所有带文字的节点：`{text, cx, cy, x1, y1, x2, y2}`。 */
function nodes() {
  const xml = uiXml();
  const out = [];
  for (const m of xml.matchAll(
    /<node[^>]*text="([^"]*)"[^>]*bounds="\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]"/g,
  )) {
    const [, text, x1, y1, x2, y2] = m;
    if (!text) continue;
    out.push({
      text,
      x1: +x1, y1: +y1, x2: +x2, y2: +y2,
      cx: Math.round((+x1 + +x2) / 2),
      cy: Math.round((+y1 + +y2) / 2),
    });
  }
  return out;
}

/** 按正则找一个 token 节点；找不到给 `null`（**不要**抛，找不到本身就是要断言的事）。 */
function find(re) {
  return nodes().find((n) => re.test(n.text)) || null;
}
function hasText(re) {
  return nodes().some((n) => re.test(n.text));
}

function swipe(x1, y1, x2, y2, ms = 400) {
  adb('shell', 'input', 'swipe', String(Math.round(x1)), String(Math.round(y1)),
    String(Math.round(x2)), String(Math.round(y2)), String(ms));
  return sleep(700);
}

/** 从某个 token 上滑：起点是那个 token 的**中心**（token 就是留给脚本的抓手）。 */
async function swipeFromToken(re, dx, dy, label) {
  const n = find(re);
  if (!n) throw new Error(`找不到抓手 token：${label || re}（界面没起来？）`);
  await swipe(n.cx, n.cy, n.cx + dx, n.cy + dy);
  return n;
}

// ── 2) 等界面真的起来（轮询，不用固定 sleep）──────────────────────────────────
section('① 挂载：三个边界块都渲染出来了');
{
  let ok = false;
  for (let i = 0; i < 30 && !ok; i++) {
    await sleep(1000);
    ok = hasText(/内 n=\d+ c=\d+/) && hasText(/深 n=\d+ 起=/) && hasText(/滚A n=/);
  }
  check('token 齐全（嵌套 / 深层 / 滚动三块都在）', ok, ok ? '' : '30 秒内没等到；看 Metro 是否在跑、adb reverse 是否做了');
  if (!ok) {
    console.log('\n（界面没起来，后面的断言没有意义。）');
    console.log(`\n================ 汇总 ================\n通过 ${results.filter((r) => r.ok).length}  失败 ${results.filter((r) => !r.ok).length}`);
    process.exit(1);
  }
}

const num = (re, text, group = 1) => {
  const m = re.exec(text || '');
  return m ? Number(m[group]) : NaN;
};

// ── 3) 基线：哨兵必须在视口**外** ─────────────────────────────────────────────
//
// 这一条是③④两节的前提：如果哨兵一开始就可见，"它出现了"证明不了任何滚动。
// 前提不成立时后面的绿灯全是假的 —— 所以它自己也是一条断言。
section('② 基线（③④的前提）');
{
  check('哨兵 `底A 见` 初始**不在**界面上（在滚动视口之外）', !hasText(/底A 见/), '它在的话"出现"就证明不了滚动');
  check('哨兵 `底B 见` 初始**不在**界面上', !hasText(/底B 见/), '同上');
  const n = find(/内 n=0 c=0/);
  check('计数器初始为 0（没有残留状态）', Boolean(n) && hasText(/外 n=0/) && hasText(/拖A n=0 c=0/), n ? n.text : '找不到 内 n=0 c=0');
}

// ── 4) ① 嵌套 ─────────────────────────────────────────────────────────────────
section('③ 嵌套：内外都挂 on_pan，谁收？');
{
  await swipeFromToken(/内 n=\d+/, 40, 0, '内盒 token');
  const innerTok = find(/内 n=\d+ c=\d+/);
  const outerTok = find(/外 n=\d+/);
  const inN = num(/内 n=(\d+)/, innerTok?.text);
  const inC = num(/c=(\d+)/, innerTok?.text);
  const outN = num(/外 n=(\d+)/, outerTok?.text);
  console.log(`     内盒：${innerTok?.text} · 外盒：${outerTok?.text}`);
  check('①-1 内盒拿到了手势（n ≥ 3，说明是连续拖动不是一次抖动）', inN >= 3, `内 n=${inN}`);
  check('①-2 内盒没有被中途抢走（c = 0，没有 cancel）', inC === 0, `内 c=${inC}`);
  check('①-3 ★ 外盒**一条事件都没收**（`外 n=0`）—— 更具体的元素赢，父不抢子',
    outN === 0, `外 n=${outN}`);
}

// ── 5) ② 深层子元素的参照系 ───────────────────────────────────────────────────
section('④ 深层子元素：`x`/`y` 相对谁？');
{
  const token = await swipeFromToken(/^子$/, 40, 0, '子元素 token');
  const tok = find(/深 n=\d+ 起=/);
  const text = tok?.text || '';
  const x0 = num(/起=(-?\d+),/, text);
  const y0 = num(/起=-?\d+,(-?\d+)/, text);
  const x1 = num(/末=(-?\d+),/, text);
  const y1 = num(/末=-?\d+,(-?\d+)/, text);
  console.log(`     ${text}`);
  console.log(`     抓手「子」中心 = (${token.cx},${token.cy}) · 期望 起=(${DEEP_IN_BOX.x},${DEEP_IN_BOX.y})［相对盒］ 或 (${DEEP_IN_CHILD.x},${DEEP_IN_CHILD.y})［相对子元素］`);
  check('②-0 抓到了一次拖动（`深 n` ≥ 3）', num(/深 n=(\d+)/, text) >= 3, `深 n=${num(/深 n=(\d+)/, text)}`);
  // ⚠️ 字符串里**不要**再嵌反引号：模板串里的 `` ` `` 会把它自己截断（本文件第一次就踩了）。
  check(
    '②-1 ★ 起点 x/y 相对**挂手势的盒**（≈' + DEEP_IN_BOX.x + ',' + DEEP_IN_BOX.y + '），' +
      '不是相对被触摸的子元素（那会是 ' + DEEP_IN_CHILD.x + ',' + DEEP_IN_CHILD.y + '）',
    Math.abs(x0 - DEEP_IN_BOX.x) <= TOL && Math.abs(y0 - DEEP_IN_BOX.y) <= TOL,
    `起=(${x0},${y0})`,
  );
  check(
    '②-2 ★ 整条拖动都在**同一个参照系**里（末 − 起 ≈ 40）' +
      ' —— dx=155 那次事故的病根就是这里会跳',
    Math.abs(x1 - x0 - 40) <= TOL && Math.abs(y1 - y0) <= TOL,
    `起=(${x0},${y0}) 末=(${x1},${y1})，差 (${x1 - x0},${y1 - y0})`,
  );
}

// ── 6) ③ 可拖元素在滚动容器里 ─────────────────────────────────────────────────
section('⑤ 滚动容器里有 `on_pan` 的块：竖滑谁赢？');
{
  // 竖滑要**从块内往上**滑：起点取 token 中心，往上 120px。
  await swipeFromToken(/拖A n=\d+ c=\d+/, 0, -120, '拖A token');
  const ta = find(/拖A n=\d+ c=\d+/);
  const nA = num(/拖A n=(\d+)/, ta?.text);
  const cA = num(/c=(\d+)/, ta?.text);
  const scrolledA = hasText(/底A 见/);
  console.log(`     ${ta?.text} · 哨兵 底A 见 ${scrolledA ? '出现了（=内容滚了）' : '没出现（=内容没滚）'}`);
  check('③-1 `on_pan` 的块接住了手势（n ≥ 3）', nA >= 3, `拖A n=${nA}`);
  check('③-2 ★ 它**吞掉了外层滚动**（内容没滚：`底A 见` 没出现）—— ' +
    '按下那一刻它就判定"这次是拖动"，不让别人抢',
  !scrolledA, `底A 见 = ${scrolledA}`);
  check('③-3 既然没被抢，就不该有 `cancel`（c = 0）', cA === 0, `拖A c=${cA}`);
}

// ── 7) ④ 只挂 on_tap 的块不该锁死滚动 ─────────────────────────────────────────
section('⑥ 滚动容器里只挂 `on_tap` 的块：竖滑该滚');
{
  // ★ **先跑正对照**：同一个滚动容器里、**没有任何手势**的垫高块。
  //   它必须能滚 —— 否则"可点元素那块没滚"分不清是"手势挡住了滚动"
  //   还是"这个容器本来就滚不动 / 我的滑动姿势不对"。
  //   （这条对照是 ④-1 第一次红之后加的：当时**分不清**是哪个原因。）
  await swipeFromToken(/^垫B$/, 0, -120, '垫高块 token（正对照）');
  const control = hasText(/底B 见/);
  console.log(`     正对照（无手势的垫高块）：底B 见 = ${control}`);
  check('④-0 正对照：同一容器里**没有手势**的块滑得动（否则下面的结论不成立）',
    control, `底B 见 = ${control}`);

  // 正对照已经把内容滚到底了 → 把它拨回顶部，再测可点元素那块。
  if (control) {
    await swipeFromToken(/^垫B$/, 0, 120, '拨回顶部');
    await sleep(500);
  }
  const backAtTop = !hasText(/底B 见/);
  console.log(`     拨回顶部：底B 见 = ${!backAtTop}`);

  await swipeFromToken(/点B n=\d+/, 0, -120, '点B token');
  const tb = find(/点B n=\d+/);
  const nB = num(/点B n=(\d+)/, tb?.text);
  const scrolledB = hasText(/底B 见/);
  console.log(`     ${tb?.text} · 哨兵 底B 见 ${scrolledB ? '出现了（=内容滚了）' : '没出现（=内容没滚）'}`);
  check('④-1 ★ 只挂 `on_tap` 的元素**把滚动让了出去**（内容滚了：`底B 见` 出现）—— ' +
    '否则列表里放一个可点行就把滚动锁死了',
  scrolledB, `底B 见 = ${scrolledB}（正对照 = ${control}，拨回顶部 = ${backAtTop}）`);
  check('④-2 大幅竖滑**不算点按**（`点B n` = 0）', nB === 0, `点B n=${nB}`);
}

// ── 8) ⑤ 证伪：没有任何手势的元素上滑 ─────────────────────────────────────────
section('⑦ 证伪：在没有任何手势的元素上滑，计数器不该变');
{
  const before = nodes().map((n) => n.text).filter((t) => /^(内|外|深|拖A|点B)/.test(t)).join(' | ');
  // 抓手：界面底部那行诊断 token —— 它是纯 `span`，上下左右都没有手势。
  const diag = find(/滚A n=\d+ c=\d+ · 点B n=\d+/);
  if (!diag) {
    check('⑦-0 找到无手势的抓手 token', false, '找不到底部诊断行');
  } else {
    await swipe(diag.cx, diag.cy, diag.cx + 60, diag.cy, 300);
    const after = nodes().map((n) => n.text).filter((t) => /^(内|外|深|拖A|点B)/.test(t)).join(' | ');
    check('⑤ 无手势元素上滑 → 五个计数器**全都不变**（证明上面那些数字确实来自手势元素）',
      before === after && before.length > 0,
      before === after ? before : `前：${before} / 后：${after}`);
  }
}

// ── 汇总 ─────────────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.ok).length;
console.log(`\n================ 汇总 ================`);
console.log(`通过 ${pass}  失败 ${results.length - pass}`);
if (results.some((r) => !r.ok)) process.exit(1);
