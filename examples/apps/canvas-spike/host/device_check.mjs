#!/usr/bin/env node
// device_check.mjs —— **画布通道的真机验证**（Android 模拟器/真机，经 adb）。
//
//   node examples/apps/canvas-spike/host/device_check.mjs [--apk <路径>] [--pkg <包名>]
//
// ## 它回答什么
//
// `docs/STATUS.md` §4 第 7 条那个未验项：**「`<canvas>` 在真机上到底画不画得出来」**。
// 库侧（`canvas/` 包）与宿主侧（`canvas-ops` / `canvas-skia`）都已落地，
// 本机也用**真 Skia**（CanvasKit）验过 32 项 —— 但**真机上的组件挂载**一直没验。
//
// ## 判据（三层，缺一层都不算过）
//
//   ① **挂载**：界面里出现 `画布 ops=N` 的 token（N>0）—— 说明库侧产出了指令、
//      节点进了 React 树、且**没被 fail-fast 拦下**（`moobile:Canvas` 没注册的话
//      组件解析会当场抛，整页都渲染不出来）；
//   ② **真画出来了**：截图里数得出**品红 `#ff00aa` 与绿 `#00aa66`** 的像素
//      —— 这两个颜色界面别处**一个都没用**，所以"有它们"就等于"Skia 真的绘制了"，
//      而不只是"组件挂上了"；
//   ③ **证伪**：切到另一屏（无画布的 R1 样本页）后，这两种颜色的像素数必须**掉到近 0**
//      —— 否则说明那颜色根本不是画布给的（比如碰巧撞上了别的 UI 配色）。
//
// ⚠️ 只验 **Android**。iOS 仍无验证（`STATUS.md` §2.2 的口径不变）。

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const DEFAULT_APK = path.join(
  ROOT,
  'examples/apps/todo-app/host/android/app/build/outputs/apk/debug/app-debug.apk',
);

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const APK = arg('--apk', DEFAULT_APK);
const PKG = arg('--pkg', 'com.anonymous.host');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'devcheck-'));

/** 画布探针里那两个**界面别处没有**的颜色（见 todo-app 的 `canvas_probe`）。 */
const MAGENTA = [255, 0, 170];
const GREEN = [0, 170, 102];

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

/** adb：**关掉 MSYS 的路径改写** —— 否则 `/sdcard/x.xml` 会被改成 `Files/Git/sdcard/x.xml`（实测踩过）。 */
function adb(...args) {
  return execFileSync('adb', args, {
    encoding: 'utf8',
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });
}

// ── 0) 设备在不在 ─────────────────────────────────────────────────────────────
section('设备');
try {
  const dev = adb('devices');
  const on = dev.split('\n').some((l) => l.includes('\tdevice'));
  if (!on) skipOut('没有在线设备（先起模拟器：emulator -avd moobile64 …）');
  check('有在线 Android 设备', true, dev.split('\n').find((l) => l.includes('\tdevice')).trim());
} catch (e) {
  skipOut(`adb 不可用：${String(e.message).split('\n')[0]}`);
}

// ── 1) 装 + 起 ────────────────────────────────────────────────────────────────
section('安装与启动');
if (!fs.existsSync(APK)) skipOut(`APK 不存在：${APK}`);
console.log(`     APK: ${path.relative(ROOT, APK)}（${(fs.statSync(APK).size / 1024 / 1024).toFixed(1)} MB）`);
adb('install', '-r', APK);
adb('shell', 'am', 'force-stop', PKG);
adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 读界面文本（uiautomator dump 到 /dev/tty 拿不到结构化输出，所以落到文件再 cat）。 */
function uiTexts() {
  try {
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml', '>/dev/null', '2>&1');
  } catch {
    /* dump 偶发失败：下面按空处理，由断言暴露 */
  }
  let xml = '';
  try {
    xml = adb('shell', 'cat', '/sdcard/ui.xml');
  } catch {
    return [];
  }
  return [...xml.matchAll(/text="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
}

/** 截图 → 像素（用 CanvasKit 解 PNG：**不引新依赖**，而且它本来就是这套的真引擎）。 */
const { loadCanvasKit } = await import('./play.mjs');
const ck = await loadCanvasKit();

function screencapPixels(tag) {
  const file = path.join(TMP, `${tag}.png`);
  const buf = execFileSync('adb', ['exec-out', 'screencap', '-p'], {
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  });
  fs.writeFileSync(file, buf);
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
  return { w, h, px, file };
}

/** 数某个颜色（容差 12：截图经 GPU 合成，不保证逐位相同）。 */
function countColor({ px, w, h }, [r, g, b], tol = 12) {
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (
      Math.abs(px[i * 4] - r) <= tol &&
      Math.abs(px[i * 4 + 1] - g) <= tol &&
      Math.abs(px[i * 4 + 2] - b) <= tol
    ) {
      n++;
    }
  }
  return n;
}

// ── 2) ① 挂载：token ──────────────────────────────────────────────────────────
//
// ⚠️ **必须轮询，不能固定 sleep** —— 这是本仓库记过的坑（FINDINGS 的 N4/真机补记：
// "冷启动要轮询而不是固定 sleep"）。原因这次也实测到了：debug 包要等 Metro 现打 bundle，
// 而带 Skia 的首次打包 **52 秒**（`Android Bundled 52368ms`）；固定 12 秒只能看到
// `[runtime not ready]` 那一屏，于是把"还在加载"误判成"没渲染出来"。
section('① 挂载：界面 token（轮询等待 bundle，最多 4 分钟）');
let texts = [];
let token = undefined;
let opsN = NaN;
for (let i = 1; i <= 24; i++) {
  texts = uiTexts();
  token = texts.find((t) => t.startsWith('画布 ops='));
  if (token) break;
  // 把"界面在报错"也当场说出来，别让人对着空界面猜
  const bad = texts.find((t) => t.includes('[runtime not ready]') || t.includes('Error:'));
  if (bad) {
    console.log(`     第 ${i} 次轮询：界面在报错 → ${bad.slice(0, 200)}`);
  }
  if (i === 1 || i % 4 === 0) console.log(`     第 ${i} 次轮询：${texts.length} 条文本…`);
  await sleep(10000);
}
opsN = token ? Number(token.replace('画布 ops=', '')) : NaN;
check(
  '界面里有 `画布 ops=N` 且 N > 0（说明库侧产出了指令、节点进了 React 树）',
  Number.isFinite(opsN) && opsN > 0,
  token ? `token="${token}"` : `没找到；界面文本前 6 条：${texts.slice(0, 6).join(' | ')}`,
);
check('页面没崩（还能读到别的 token，例如同步行）', texts.some((t) => t.includes('心跳')), `${texts.length} 条文本`);

// ── 3) ② 真画出来了：像素 ─────────────────────────────────────────────────────
//
// ⚠️ 也要**轮询**：token 出现（React 树里有这个节点）与"Skia 把第一帧画到屏幕上"
// 是两件事 —— 实测同一份代码，有时截到画面、有时截到空白（差的就是那一两帧）。
// 固定等待会把"还没画"误判成"画不出来"，所以这里等到颜色出现为止（最多 40 秒）。
section('② 真绘制：截图里的品红与绿（轮询等 Skia 出第一帧）');
let shot = screencapPixels('canvas');
let mag = countColor(shot, MAGENTA);
let grn = countColor(shot, GREEN);
for (let i = 1; i <= 20 && mag <= 800; i++) {
  await sleep(2000);
  shot = screencapPixels('canvas');
  mag = countColor(shot, MAGENTA);
  grn = countColor(shot, GREEN);
  if (i % 5 === 0) console.log(`     第 ${i} 次等：品红 ${mag} px ／ 绿 ${grn} px`);
}
console.log(`     截图 ${shot.w}×${shot.h}；品红 ${mag} px ／ 绿 ${grn} px`);
check('截图里数得出一片品红（圆环）', mag > 800, `${mag} px（阈值 800）`);
check('截图里数得出绿色（实心方块）', grn > 300, `${grn} px（阈值 300）`);

// ── 4) ③ 证伪：换到没有画布的那一屏 ───────────────────────────────────────────
section('③ 证伪：切到无画布的那一屏，两个颜色必须消失');
let switched = false;
try {
  const b = texts.includes('R1 样本 →');
  if (b) {
    // 用 uiautomator 给出的 bounds 点一下那个按钮（不猜坐标）
    const xml = adb('shell', 'cat', '/sdcard/ui.xml');
    const m = /text="R1 样本 →"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml);
    if (m) {
      const cx = Math.round((Number(m[1]) + Number(m[3])) / 2);
      const cy = Math.round((Number(m[2]) + Number(m[4])) / 2);
      adb('shell', 'input', 'tap', String(cx), String(cy));
      switched = true;
      await sleep(2500);
    }
  }
} catch {
  /* 切屏失败下面按"证伪不成立"处理 */
}
if (switched) {
  const after = screencapPixels('other-screen');
  const mag2 = countColor(after, MAGENTA);
  const grn2 = countColor(after, GREEN);
  console.log(`     另一屏：品红 ${mag2} px ／ 绿 ${grn2} px`);
  check(
    '那一屏上两个颜色都掉到近 0（说明上面的像素确实来自画布，不是撞色）',
    mag2 <= 40 && grn2 <= 40,
    `品红 ${mag2} / 绿 ${grn2}（阈值 ≤40）`,
  );
} else {
  console.log('     没能切屏（找不到「R1 样本 →」或点击失败）—— 证伪没做，**别当通过**');
}

// ── 5) 异常检查 ───────────────────────────────────────────────────────────────
section('运行时异常');
try {
  const log = execFileSync('adb', ['logcat', '-d', '-t', '600'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  // 判据只认**错误级**的行。
  // ⚠️ 别用宽泛的 /Error/ 去扫：应用自己的诊断标记（`MOOBILE_JS_ERROR … ok`）会撞成假阳性
  //    —— 第一版就是这样报了一条 FAIL，而那条其实是"注册成功"的日志。
  const bad = log
    .split('\n')
    .filter((l) => / E ReactNativeJS|FATAL EXCEPTION|fatal=true|TypeError:|Invariant Violation/.test(l))
    .slice(0, 3);
  check('logcat 里没有 JS 致命错误 / 未捕获异常', bad.length === 0, bad.join(' | ').slice(0, 300));
} catch {
  console.log('     （logcat 读不到，跳过）');
}

// ── 汇总 ─────────────────────────────────────────────────────────────────────
console.log(`\n截图证据：${shot.file}`);
const pass = results.filter((r) => r.ok).length;
console.log(`\n================ 汇总 ================\n通过 ${pass}  失败 ${results.length - pass}`);
if (results.some((r) => !r.ok)) process.exit(1);
