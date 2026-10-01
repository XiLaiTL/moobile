#!/usr/bin/env node
// device_check.mjs —— canvas-demo 的**真机验证**：画布通道 + 手势通道在这一个例子里闭环。
//
//   cd examples/apps/canvas-demo && node device_check.mjs
//
// 前置：模拟器在跑、APK 已装（`npx expo prebuild -p android` →
// `bash tools/android_env_setup.sh --app examples/apps/canvas-demo` → `./gradlew assembleDebug`），
// 且 Metro 在跑（debug 包要现拉 bundle）+ `adb reverse tcp:8081 tcp:8081`。
//
// ## 判据（每一层都在压一件具体的事）
//
//   ① **挂载**：`画布 ops=N` 且 `角度 A#M` 两个 token 都在（库侧产出了指令、节点进了 React 树、
//      且没被 fail-fast 拦下 —— `moobile:Canvas` 没注册的话整页都渲染不出来）；
//   ② **真绘制**：截图里数得出**品红圆环**与**绿色方块**（这两个颜色界面别处不用，
//      所以"有它们" = "Skia 真的画了"，而不是"组件挂上了"）；
//   ③ **手势 → Model**：往拖动区里滑一下 → `n` 变大、`|dx|` 有值（手势通道给出了**真实位移**；
//      moobile 以前的 `on_mouse*` 在真机上恒为 0）；
//   ④ **Model → 画布**：同一张截图里，**蓝色指针的质心移动了** ——
//      这一条同时压住"手势 → Msg → Model → 绘制指令 → Skia"整条链（分开测任何一段都测不出它）；
//   ⑤ **点按**：轻点一下 → `点按` 计数 +1（手势通道的第二个形状）；
//   ⑥ **证伪**：在拖动区**外面**滑 → 三个 token 全都不许变。

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.DEMO_PKG || 'com.anonymous.canvasdemo';
const APK = process.env.DEMO_APK || path.join(HERE, 'android/app/build/outputs/apk/debug/app-debug.apk');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'canvasdemo-'));

/** 与 `app.mbt` 的 `dial_ops` 逐字一致（改一处必须改两处 —— 这是刻意的：判据要能被证伪）。 */
const MAGENTA = [255, 0, 170]; // 圆环
const GREEN = [0, 170, 102]; // 固定方块
const BLUE = [0, 68, 255]; // 随角度移动的指针

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

function uiTexts() {
  try {
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml', '>/dev/null', '2>&1');
  } catch {
    /* 偶发失败：下面按空处理，由断言暴露 */
  }
  try {
    return [...adb('shell', 'cat', '/sdcard/ui.xml').matchAll(/text="([^"]*)"/g)]
      .map((m) => m[1])
      .filter(Boolean);
  } catch {
    return [];
  }
}
function uiXml() {
  try {
    return adb('shell', 'cat', '/sdcard/ui.xml');
  } catch {
    return '';
  }
}

/** 截图 → 像素（用 CanvasKit 解 PNG：不引新依赖，而且它本来就是这套的真引擎）。
 *  ⚠️ 复用 canvas-spike 的那份（相对本文件：`examples/apps/canvas-demo` → `examples/apps/canvas-spike`）。 */
const { loadCanvasKit } = await import('../canvas-spike/host/play.mjs');
const ck = await loadCanvasKit();

function screencap() {
  const buf = execFileSync('adb', ['exec-out', 'screencap', '-p'], {
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  });
  const png = path.join(TMP, `shot-${Date.now()}.png`);
  fs.writeFileSync(png, buf);
  const img = ck.MakeImageFromEncoded(buf);
  if (!img) throw new Error('截图不是可解码的 PNG');
  const w = img.width();
  const h = img.height();
  const px = img.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  });
  img.delete();
  return { w, h, px, png };
}

/** 数某个颜色的像素，并给出它们的质心（蓝点要靠质心判断"动没动"）。 */
function colorStats(shot, [r, g, b], tol = 12) {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < shot.w * shot.h; i++) {
    if (
      Math.abs(shot.px[i * 4] - r) <= tol &&
      Math.abs(shot.px[i * 4 + 1] - g) <= tol &&
      Math.abs(shot.px[i * 4 + 2] - b) <= tol
    ) {
      n++;
      sx += i % shot.w;
      sy += Math.floor(i / shot.w);
    }
  }
  return { n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 };
}

// ── 2) ① 挂载（轮询等 bundle —— debug 包要现打，固定 sleep 会误判）────────────────
section('① 挂载：等 bundle 与 token（最多 4 分钟）');
let texts = [];
let canvasTok = null;
let dialTok = null;
for (let i = 1; i <= 24; i++) {
  texts = uiTexts();
  canvasTok = texts.find((t) => t.startsWith('画布 ops='));
  dialTok = texts.find((t) => t.startsWith('角度 '));
  if (canvasTok && dialTok) break;
  const bad = texts.find((t) => t.includes('[runtime not ready]'));
  if (bad) console.log(`     第 ${i} 次轮询：界面在报错 → ${bad.slice(0, 160)}`);
  if (i === 1 || i % 4 === 0) console.log(`     第 ${i} 次轮询：${texts.length} 条文本…`);
  await sleep(10000);
}
const opsN = canvasTok ? Number((/画布 ops=(\d+)/.exec(canvasTok) || [])[1] || NaN) : NaN;
check('①-1 界面有 `画布 ops=N`（N>0）', Number.isFinite(opsN) && opsN > 0, canvasTok || '没找到');
check('①-2 界面有 `角度 A#M`（手势要改的就是它）', Boolean(dialTok), dialTok || '没找到');

// ── 3) ② 真绘制 ───────────────────────────────────────────────────────────────
section('② 真绘制：截图取色（轮询等 Skia 出帧）');
let shot = screencap();
let mag = colorStats(shot, MAGENTA);
let grn = colorStats(shot, GREEN);
let blu0 = colorStats(shot, BLUE);
for (let i = 1; i <= 20 && mag.n <= 500; i++) {
  await sleep(2000);
  shot = screencap();
  mag = colorStats(shot, MAGENTA);
  grn = colorStats(shot, GREEN);
  blu0 = colorStats(shot, BLUE);
}
console.log(`     ${shot.w}×${shot.h}：品红 ${mag.n} · 绿 ${grn.n} · 蓝 ${blu0.n}（质心 ${blu0.cx.toFixed(0)},${blu0.cy.toFixed(0)}）`);
check('②-1 品红圆环画出来了', mag.n > 500, `${mag.n} px（阈值 500）`);
check('②-2 绿色方块画出来了', grn.n > 100, `${grn.n} px（阈值 100）`);
check('②-3 蓝色指针在（它是"手势→Model→画布"那条链的见证者）', blu0.n > 100, `${blu0.n} px`);

// ── 4) ③④ 手势 → Model → 画布 ──────────────────────────────────────────────────
section('③④ 往拖动区滑一下：token 要变 + 蓝点要动');
// 拖动区的位置**从 token 的 bounds 里读**（不猜坐标）
const boxRe = /text="拖动区 · dx=[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/;
const m = boxRe.exec(uiXml());
if (!m) skipOut('找不到拖动区的 bounds —— 界面结构变了？');
const [x1, y1, x2, y2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
const sx = Math.round((x1 + x2) / 2);
const sy = Math.round((y1 + y2) / 2);
console.log(`     拖动区 bounds=[${x1},${y1}][${x2},${y2}]，从中心 (${sx},${sy}) 向右滑 80px`);

const before = uiTexts().find((t) => t.startsWith('拖动区 · '));
await adb('shell', 'input', 'swipe', String(sx), String(sy), String(sx + 80), String(sy), '400');
await sleep(1200);
const afterTok = uiTexts().find((t) => t.startsWith('拖动区 · '));
const dialAfter = uiTexts().find((t) => t.startsWith('角度 '));
console.log(`     拖动前：${before}`);
console.log(`     拖动后：${afterTok}`);
console.log(`     角度：${dialTok} → ${dialAfter}`);

const SWIPE = 80;
const nOf = (t) => {
  const mm = /n=(\d+)/.exec(t || '');
  return mm ? Number(mm[1]) : NaN;
};
const dxOf = (t) => {
  const mm = /dx=(-?\d+)/.exec(t || '');
  return mm ? Number(mm[1]) : NaN;
};
const dyOf = (t) => {
  const mm = /dy=(-?\d+)/.exec(t || '');
  return mm ? Number(mm[1]) : NaN;
};
check('③-1 拖动计数变大（手势真的到了 MoonBit 侧）',
  nOf(afterTok) > nOf(before), `n: ${nOf(before)} → ${nOf(afterTok)}`);

// ⚠️ 这条断言**曾经太松**（`|dx| >= 40` 就算过），而它放过了一个真 bug：
//   第一版宿主用 `locationX` 的差值算位移，而 `locationX` 的参照系是"最深的被触摸 view"
//   （拖动区里那行文字），手指滑出文字后 RN 换了参照系 → 横滑 80px 报出 `dx=155`。
//   松阈值让它"通过"了。现在的判据是**契约本身**：位移要对得上真实滑动距离。
check(`③-2 ★ \`dx\` 对得上真实滑动 ${SWIPE}px（容差 ±15）—— 契约是"从按下起算的真实位移"`,
  Math.abs(dxOf(afterTok) - SWIPE) <= 15, `dx=${dxOf(afterTok)}（期望 ≈ ${SWIPE}）`);
check('③-3 ★ 横向滑动时 `dy` 应当接近 0（容差 ±15）—— 它曾因参照系切换而虚报 51',
  Math.abs(dyOf(afterTok)) <= 15, `dy=${dyOf(afterTok)}（期望 ≈ 0）`);

const shot2 = screencap();
const blu1 = colorStats(shot2, BLUE);
const moved = Math.hypot(blu1.cx - blu0.cx, blu1.cy - blu0.cy);
check('④ ★ 画布上的蓝点**移动了**（手势 → Msg → Model → 绘制指令 → Skia 整条链）',
  blu1.n > 100 && moved >= 8, `质心 (${blu0.cx.toFixed(0)},${blu0.cy.toFixed(0)}) → (${blu1.cx.toFixed(0)},${blu1.cy.toFixed(0)})，位移 ${moved.toFixed(1)}px`);

// ── 5) ⑤ 点按 ─────────────────────────────────────────────────────────────────
section('⑤ 点按');
// ⚠️ 基准必须**在点之前现读**：第一版用的是步骤 ① 那份 `texts`，而 app 中途重载过一次
//    （Metro 重新打包 → 状态归零），于是"1 → 1"被判成失败 —— 那其实是**基线过期**。
const tapBase = uiTexts().find((t) => t.startsWith('角度 '));
const tapsBefore = Number((/(\d+)$/.exec(tapBase || '') || [])[1] || NaN);
await adb('shell', 'input', 'tap', String(sx), String(sy));
await sleep(900);
const tapTok = uiTexts().find((t) => t.startsWith('角度 '));
const tapsAfter = Number((/(\d+)$/.exec(tapTok || '') || [])[1] || NaN);
check('⑤ 轻点一下 → `点按` 计数 +1（手势通道的第二个形状）',
  Number.isFinite(tapsAfter) && tapsAfter === tapsBefore + 1,
  `${tapsBefore} → ${tapsAfter}（${tapTok}）`);

// ── 6) ⑥ 证伪 ─────────────────────────────────────────────────────────────────
section('⑥ 证伪：拖动区外面滑，什么都不该变');
const snapA = uiTexts().filter((t) => t.startsWith('拖动区 · ') || t.startsWith('角度 ')).join(' | ');
await adb('shell', 'input', 'swipe', '20', '20', '100', '20', '400'); // 左上角空白处
await sleep(1000);
const snapB = uiTexts().filter((t) => t.startsWith('拖动区 · ') || t.startsWith('角度 ')).join(' | ');
check('⑥ 界面外的滑动没有改任何状态（说明上面那些变化确实来自拖动区）',
  snapA === snapB && snapA.length > 0, snapA === snapB ? '两处 token 完全一致' : `${snapA} → ${snapB}`);

// ── 汇总 ─────────────────────────────────────────────────────────────────────
console.log(`\n截图证据：${shot2.png}`);
const pass = results.filter((r) => r.ok).length;
console.log(`\n================ 汇总 ================\n通过 ${pass}  失败 ${results.length - pass}`);
if (results.some((r) => !r.ok)) process.exit(1);
