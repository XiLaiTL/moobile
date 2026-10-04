#!/usr/bin/env node
// device_check.mjs —— **《御纂周易折中》阅读器在 Android 真机（模拟器）上**的判据。
//
//   node examples/apps/zhouyi-reader/device_check.mjs
//
// ## 它验的是无头/浏览器判据**验不到**的事
//
// 1. **画布通道的原生那条**：web 上走 `canvas-web.js`（DOM 2D），原生走
//    `canvas-skia.js` + `@shopify/react-native-skia` —— **两份实现**。
//    `verify.mjs` 全绿**推不出**原生也能画（库自己的 FINDINGS 里记着"web 上验过 ≠ 真机也能跑"，
//    手势通道上栽过三次）。
// 2. **手势通道在原生上的坐标语义**：`Gesture.x/y` 是"元素内坐标"，web 宿主与 RN 宿主的
//    实现不同（原生要自己量元素原点）。所以"点罗盘进卦"必须在真机上再验一次。
// 3. **触摸真能点到**：`div` → `Pressable` 那条（`on_click` 只对 `Pressable` 有效）
//    在真机上是**手指真的按下去**才算数。
//
// ## 前置
// 1. 模拟器在跑；2. **Metro 在 8081 且服务的是本目录**；3. 设备上装了本应用的 debug 包
//    （`npm run android` 或 `cd android && ./gradlew assembleDebug && adb install -r …`）。
//
// ⚠️ 与 chat-app 那份的差别：**这里用的是本应用自己的 APK**（它带 Skia 这个原生依赖，
//    借别人的壳跑不了）—— 所以"它自己能不能装机跑"这条**是被验到的**。

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import zlib from "node:zlib";

const PKG = process.env.ZHOUYI_PKG || "com.anonymous.zhouyireader";
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}
function section(t) {
  console.log(`\n── ${t} ${"─".repeat(Math.max(0, 58 - t.length))}`);
}
function skipOut(why) {
  console.log(`SKIP  ${why}`);
  process.exit(0);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** adb：**关掉 MSYS 的路径改写**（`/sdcard/x` 会被改成 git 的路径，实测踩过）。 */
function adb(...args) {
  return execFileSync("adb", args, {
    encoding: "utf8",
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
}

// ── 0) 设备 ───────────────────────────────────────────────────────────────────
section("设备");
try {
  const dev = adb("devices");
  if (!dev.split("\n").some((l) => l.includes("\tdevice"))) skipOut("没有在线设备（先起模拟器）");
  check("有在线 Android 设备", true, dev.split("\n").find((l) => l.includes("\tdevice")).trim());
} catch (e) {
  skipOut(`adb 不可用：${String(e.message).split("\n")[0]}`);
}

// ── 1) 装的包与 Metro 都必须是**这一份** ─────────────────────────────────────
section("包与 Metro");
let installed = "";
try {
  installed = adb("shell", "pm", "list", "packages", PKG);
} catch {
  /* 下面是断言 */
}
if (!installed.includes(PKG)) {
  skipOut(`设备上没装 ${PKG}（先 \`cd android && ./gradlew assembleDebug\` 再 \`adb install -r\`）`);
}
check(`设备上装了本应用的包（${PKG}）`, true);

let title = "";
for (let i = 0; i < 20; i++) {
  try {
    const html = execFileSync("curl", ["-s", "--max-time", "5", "http://localhost:8081/"], {
      encoding: "utf8",
    });
    title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
    if (title) break;
  } catch {
    /* 还没起来 */
  }
  await sleep(1000);
}
if (!title) skipOut("8081 上没有 Metro（先在本目录跑 `npx expo start --port 8081`）");
// ⚠️ HANDOVER §4-5：8081 上是谁的 Metro 一定要确认 —— 拉到别人的 bundle 会得出完全错误的结论。
check(`Metro 服务的是本应用（title=${title}）`, title === "zhouyi-reader", title);
if (title !== "zhouyi-reader") {
  console.log("\n================ 阅读器 真机 汇总 ================");
  console.log("通过 0  失败 1（Metro 服务的是别的应用，继续验没有意义）");
  process.exit(1);
}
adb("reverse", "tcp:8081", "tcp:8081");
check("adb reverse 8081 就绪（不然 app 白屏）", true);

// ── 2) 拉起应用并等首屏 ───────────────────────────────────────────────────────
section("启动与首屏");
adb("shell", "am", "force-stop", PKG);
adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1");

/** ⚠️ 每次 dump **先删旧文件** —— dump 失败会留下上一次的 xml，读到陈旧界面就会得出错误结论。 */
function dump() {
  try {
    adb("shell", "rm", "-f", "/sdcard/ui.xml");
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
  } catch {
    /* 偶发失败：按空处理，由断言暴露 */
  }
  try {
    return adb("shell", "cat", "/sdcard/ui.xml");
  } catch {
    return "";
  }
}
/** ⚠️ **两种引号都要认**：属性值里含 `"` 时 uiautomator 会改用单引号包起来。 */
function attrsOf(tag) {
  const out = {};
  const re = /([\w-]+)=(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(tag))) out[m[1]] = m[2] !== undefined ? m[2] : m[3];
  return out;
}
function nodes(xml) {
  const out = [];
  for (const m of xml.matchAll(/<node[^>]*>/g)) {
    const a = attrsOf(m[0]);
    const b = (a.bounds || "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!b) continue;
    const [x1, y1, x2, y2] = b.slice(1).map(Number);
    out.push({ text: a.text || "", cls: a.class || "", cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, x1, y1, x2, y2 });
  }
  return out;
}
const uiTexts = (xml) => nodes(xml).map((n) => n.text).filter(Boolean).join(" | ");
function tapText(xml, needle) {
  const n = nodes(xml).find((x) => x.text.includes(needle));
  if (!n) return false;
  adb("shell", "input", "tap", String(Math.round(n.cx)), String(Math.round(n.cy)));
  return true;
}
/** 冷启动要**轮询**（`pm clear` 会连 Metro 的 bundle 缓存一起清掉，固定 sleep 会误判）。 */
async function waitFor(pred, ms = 60000, step = 1500) {
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < ms) {
    last = dump();
    if (pred(last)) return last;
    await sleep(step);
  }
  return last;
}

let xml = await waitFor((x) => uiTexts(x).includes("御纂周易折中"), 90000);
const first = uiTexts(xml);
check("首屏出现标题「御纂周易折中」", first.includes("御纂周易折中"), first.slice(0, 120));
check("首屏出现「八卦罗盘 · 六十四卦总览」（罗盘页）", first.includes("八卦罗盘"), first.slice(0, 120));
// ⚠️ uiautomator **只 dump 可见节点**：1080×2340 的屏上，模式按钮那行的后两个在折叠区外。
//    所以判据取"看得见的那两个"，别拿"看不见"当失败（第一版就是这么误判的）。
check("罗盘模式按钮在（伏羲先天 / 后天文王）", first.includes("伏羲先天") && first.includes("后天文王"), first.slice(0, 160));

// ── 3) 画布：原生这条后端有没有真的挂上 ───────────────────────────────────────
section("画布（Skia）");
// uiautomator 看不到 canvas 的内容（Skia 是原生绘制），**也看不到它的节点**
// （RN 的层级里那个 View 的 bounds 是全屏，第一版拿"最大的 ≥600×600 节点"当画布，
//  量出来是 (0,0)-(1080,2340) 也就是整页 —— 于是后面点的坐标全错位）。
// 靠**文本锚点**反推：画布夹在「模式按钮那行」与「立竿测影」按钮之间，且水平居中。
function anchor(text) {
  return nodes(dump()).find((n) => n.text.includes(text)) || null;
}
// 用同一次 dump 取两个锚点（别 dump 两次，界面可能在动）
const oneXml = dump();
const rows = nodes(oneXml);
const modeRow = rows.find((n) => n.text.includes("伏羲先天"));
const simRow = rows.find((n) => n.text.includes("立竿测影"));
const GAP = 20; // 画布与上下元素之间的间距（styles 里的 margin），量级兜底
/** 量画布几何（一次 dump 出两个锚点）。⚠️ 布局会变（软键盘占掉半屏、页面滚动位置），
 *  所以**要用的地方必须重新量**，别拿开头那一次的坐标到处点 —— 点空之后红的是后面的断言。 */
function measureCanvas() {
  const rs = nodes(dump());
  const mode = rs.find((n) => n.text.includes("伏羲先天"));
  const sim = rs.find((n) => n.text.includes("立竿测影"));
  if (!mode || !sim) return null;
  const top = mode.y2 + GAP;
  const bottom = sim.y1 - GAP;
  const side = Math.min(bottom - top, 1080);
  return { top, bottom, side, cx: 540, cy: (top + bottom) / 2 };
}
let canvas = null;
if (modeRow && simRow) {
  const top = modeRow.y2 + GAP;
  const bottom = simRow.y1 - GAP;
  const side = Math.min(bottom - top, 1080);
  canvas = { top, bottom, side, cx: 540, cy: (top + bottom) / 2 };
}
check(
  "能由文本锚点反推出画布几何（模式行 ↔ 立竿测影之间）",
  Boolean(canvas) && canvas.side > 200,
  canvas ? `side≈${Math.round(canvas.side)}px 中心(${canvas.cx},${Math.round(canvas.cy)})` : "锚点没找齐",
);
// 判据：画布**铺得下**（360dp ≈ 990px）且**不溢出屏宽** —— 溢出时圆心会被裁到屏外，
// 手指只能碰到左半边（实测踩过：vp_w 恒 0 → 画布按 720 画，右边被裁掉）。
check(
  "画布铺得下且不溢出屏宽（边长 ≤ 屏宽）",
  Boolean(canvas) && canvas.side <= 1080 && canvas.side > 400,
  canvas ? `side≈${Math.round(canvas.side)}px / 屏宽 1080` : "—",
);

// ── 4) 手势 → 模型 → 重绘：拖一下罗盘，然后**回到列表页再点进详情** ─────────────
//
// 原生上没法像浏览器那样读像素，所以"拖了有没有转"用**间接但硬**的判据：
// 拖动之后界面**没崩、还在同一页**，且随后"轻点进卦"仍然工作 ——
// 手势通道若坏了（比如坐标语义错），`DragStart/Move` 会带着错的角度跑，
// 表现要么是崩，要么是点卦点不中。
section("手势与导航");
/** 截屏的指纹 —— 用来判"画面变没变"（真机上读不到 canvas 的像素，但读得到屏幕）。 */
function shot() {
  const buf = execFileSync("adb", ["exec-out", "screencap", "-p"], {
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { hash: createHash("sha256").update(buf).digest("hex").slice(0, 16), size: buf.length };
}

/**
 * **轮询等"指纹到达目标状态"**，返回最后那张。
 *
 * 为什么不能"点一下 + sleep 一会儿"（2026-10-23 实测）：`adb shell input tap` 之后界面要等
 * React 提交 + 一次截屏，而这台机器上固定 `sleep(1500)` **读到的是点击前的那一帧** ——
 * 表现是"慢一拍"（点展开读到没变、下一次检查却已经是展开态）。
 * 另外 `screencap` 还会**回陈旧帧**（模型已变、两张截屏逐字节相同），所以判据得盯**目标状态**。
 */
async function waitForShot(pred, ms = 20000, step = 800) {
  const t0 = Date.now();
  let last = shot();
  while (Date.now() - t0 < ms) {
    if (pred(last.hash)) return last;
    await sleep(step);
    last = shot();
  }
  return last;
}

/** 解一张 `screencap -p` 出来的 PNG（8 位、非隔行）—— 只为拿像素，不装任何图像库。 */
function decodePng(buf) {
  let off = 8;
  let w = 0;
  let h = 0;
  let bpp = 4;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error("只支持 8 位、非隔行 PNG");
      bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[data[9]] || 4;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[pos++];
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = raw[pos + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
    pos += stride;
  }
  return { w, h, bpp, px: out };
}
// ⚠️ 真机上"拖拽转了多少"这条**判据没达成**，原因是**库的手势通道**：
//    实测（同一台模拟器、同一屏）把两个已知屏幕点喂给 `@gesture`，拿到的"元素内坐标"对不上：
//
//      `input swipe 400 1300 …` → pan-start x=125 y=313
//      `input swipe 350  900 …` → pan-start x=250 y=404     ← 屏幕 x 更小，元素内 x 反而更大
//
//    即 **原生侧那个"元素原点"测得不对**（库自己的 FINDINGS 把这条列为手势通道最险的边界：
//    "原生的 locationX/locationY 是手指底下最深那个 view 的、而且会中途换"）。
//    后果：`canvas_angle(x, y)` 算出的角度与手指位置不一致 —— 拖约 45° 只转了约 5°，
//    环上命中也不跟手。**这不是本应用的问题**（web 上同一份代码是对的：verify.mjs 24/24）。
//
//    所以这里只断言**能证明的那部分**，未达成的显式打出来（别让它看起来像验过了）。
if (canvas) {
  const x1 = Math.round(canvas.cx - canvas.side * 0.30);
  const y1 = Math.round(canvas.cy - canvas.side * 0.05);
  const x2 = Math.round(canvas.cx + canvas.side * 0.20);
  const y2 = Math.round(canvas.cy + canvas.side * 0.24);
  const before = shot();
  adb("shell", "input", "swipe", String(x1), String(y1), String(x2), String(y2), "600");
  await sleep(1800);
  // ⚠️ `adb exec-out screencap` 会**回陈旧帧**（实测：模型已变、两张截屏逐字节相同；换个时机再截又不同）。
  //    所以"没变"时**再截几次**（3 次 + 递增等待），别把陈旧帧当成"没重绘"。
  //    这条断言本身只是"画面变了"的旁证 —— 转没转的**主判据**是下面那条
  //    "同一个点转过之后命中另一卦"（它才同时覆盖手势坐标 / 旋转 / 命中三件事）。
  let after = before;
  let tries = 0;
  for (; tries < 3 && after.hash === before.hash; tries++) {
    if (tries) await sleep(600 * tries);
    after = shot();
  }
  const alive = uiTexts(dump());
  check("拖过罗盘之后界面还在（没崩、没白屏）", alive.includes("御纂周易折中"), alive.slice(0, 120));
  check(
    "拖过之后画布**重绘了**（截屏指纹变了 ⇒ 手势 → 模型 → Skia 重绘这条链是通的）",
    before.hash !== after.hash,
    `前 ${before.hash} 后 ${after.hash}（连截 ${tries + 1} 次）`,
  );
}
// ── 4a2) 罗盘模式按钮：**真机上点得动、而且画布真的换了** ──────────────────────
//
// 为什么要在真机上再验一次模式切换：web 判据验的是"像素跟着模式变"（DOM 2D 后端），
// 而真机走的是 **Skia** —— 另一份绘制实现；而按钮本身是 `Pressable`（触摸命中那条链路）。
// 判据与 web 那侧同构但**手法不同**（真机读不到画布像素）：用**截屏指纹**判"画面变了"，
// 并且**切回去要求指纹复原**（只判"变了"会把"点任意按钮都乱刷一屏"也算过）。
if (canvas) {
  const beforeMode = shot();
  const tapped = tapText(dump(), "京房八宫");
  check("（模式）找得到并点到「京房八宫」", tapped, tapped ? "" : "dump 里没有这个按钮");
  if (tapped) {
    // ⚠️ 轮询等"画面变了"，别用固定 sleep（同上：固定 sleep 读到的是点击前的那一帧）。
    //    ⚠️ `adb exec-out screencap` 还会**回陈旧帧**（实测：模型已变、两张截屏逐字节相同），
    //    所以这里等的是"指纹变了"这个**目标状态**，而不是"等一段时间"。
    const afterMode = await waitForShot((h) => h !== beforeMode.hash, 20000, 800);
    check(
      "点「京房八宫」→ 真机画面变了（Skia 那条绘制路径也跟着模式走）",
      afterMode.hash !== beforeMode.hash,
      `前 ${beforeMode.hash} 后 ${afterMode.hash}`,
    );
    const backTapped = tapText(dump(), "后天文王");
    const back = backTapped
      ? await waitForShot((h) => h === beforeMode.hash, 25000, 1000)
      : afterMode;
    check(
      "切回「后天文王 · 卦气」→ 画面**复原**（不是「点一下就乱刷」）",
      backTapped && back.hash === beforeMode.hash,
      backTapped
        ? `基准 ${beforeMode.hash} / 切回 ${back.hash}`
        : "dump 里找不到「后天文王」这个按钮（它可能在模式行的可见区之外）",
    );
  }
}

// ── 4b) 拖拽真的转了：**同一点、转过之后应命中另一卦** ─────────────────────────
//
// 判据为什么用"命中哪一卦"而不是截屏：截屏会回陈旧帧（见上），而"同一处点开另一卦"
// 正是"轮盘转了"在这个应用里的**语义** —— 它同时覆盖了手势坐标、旋转与环上命中三件事。
function tapRing(where) {
  const r = (canvas.side * 260) / 720; // 外环中径（绘制坐标 222–300）
  const tx = Math.round(canvas.cx + r);
  const ty = Math.round(canvas.cy);
  console.log(`      · tapRing(${where}) → (${tx},${ty})  画布 side≈${Math.round(canvas.side)} 中心(${canvas.cx},${Math.round(canvas.cy)})`);
  adb("shell", "input", "tap", String(tx), String(ty));
}
function hexOf(text) {
  const m = text.match(/([一-龥]{1,4})\s*·\s*第(\d{1,2})卦/);
  return m ? `${m[1]}#${m[2]}` : null;
}
let rotatedAway = null;
if (canvas) {
  tapRing("before");
  const first = await waitFor((x) => /第\d{1,2}卦/.test(uiTexts(x)), 15000);
  const a = hexOf(uiTexts(first));
  // ⚠️ 回列表页要**轮询确认**：`tapText` 打偏一次（或返回按钮还没渲染好）就会留在详情页，
  //    于是后面的"拖动"发生在详情页上（那里没有罗盘）→ 第二次点的还是同一卦 →
  //    断言会**因为夹具没回位而红**，而它看起来像"手势又坏了"（实测就是这么误报过一次）。
  async function backToCompass() {
    for (let i = 0; i < 6; i++) {
      if (uiTexts(dump()).includes("八卦罗盘")) return true;
      tapText(dump(), "六十四卦");
      await sleep(1200);
    }
    adb("shell", "input", "keyevent", "4"); // 兜底：系统返回键
    await sleep(1500);
    return uiTexts(dump()).includes("八卦罗盘");
  }
  const backOk = await backToCompass();
  check("（夹具）从详情页回到了罗盘页", backOk, backOk ? "" : "没能回到列表页");
  // 拖一大段（跨过大半个盘面）
  const x1 = Math.round(canvas.cx - canvas.side * 0.30);
  const y1 = Math.round(canvas.cy - canvas.side * 0.05);
  const x2 = Math.round(canvas.cx + canvas.side * 0.20);
  const y2 = Math.round(canvas.cy + canvas.side * 0.24);
  adb("shell", "input", "swipe", String(x1), String(y1), String(x2), String(y2), "600");
  await sleep(1500);
  tapRing("after");
  const second = await waitFor((x) => /第\d{1,2}卦/.test(uiTexts(x)), 15000);
  const b = hexOf(uiTexts(second));
  rotatedAway = { a, b };
  check(
    "同一个点、转过之后命中的是**另一卦**（⇒ 手势坐标 / 旋转 / 环上命中 三件事都对）",
    Boolean(a && b && a !== b),
    `前 ${a || "?"} / 后 ${b || "?"}`,
  );
  tapText(dump(), "六十四卦");
  await sleep(1200);
}

// 轻点外环进卦：这条**在真机上是通的**（触摸 → 手势 tap → 判卦 → 导航）
//
// ⚠️ 前置：**必须确保当前在列表页**。上面那一段末尾会从详情页返回，若返回没生效，
//    这次的 tap 就落在详情页上 → 断言会**因为夹具状态不对而红**（实测踩过，
//    而且它看起来像"手势坏了"）。所以这里先看页面，必要时再点一次返回。
let tappedHex = null;
if (canvas) {
  if (!uiTexts(dump()).includes("八卦罗盘")) {
    tapText(dump(), "六十四卦");
    await sleep(1800);
    if (!uiTexts(dump()).includes("八卦罗盘")) {
      adb("shell", "input", "keyevent", "4"); // 兜底：系统返回键
      await sleep(1500);
    }
  }
  const r = (canvas.side * 260) / 720; // 外环中径（绘制坐标 222–300）
  adb("shell", "input", "tap", String(Math.round(canvas.cx + r)), String(Math.round(canvas.cy)));
  const d = await waitFor((x) => /第\d{1,2}卦/.test(uiTexts(x)), 15000);
  const t = uiTexts(d);
  const m = t.match(/([一-龥]{1,4})\s*·\s*第(\d{1,2})卦/);
  tappedHex = m ? `${m[1]}#${m[2]}` : null;
  check("轻点罗盘外环 → 进入某卦详情（真机上的环上命中）", Boolean(tappedHex), tappedHex || t.slice(0, 100));
  // 回列表页，后面的断言要在列表页上跑
  tapText(dump(), "六十四卦");
  await sleep(1500);
}

if (rotatedAway && rotatedAway.a === rotatedAway.b) {
  console.log(
    "      · ⚠️ 转过之后命中的还是同一卦 —— 手势坐标 / 旋转这条链在真机上**没走通**" +
      "（web 上同一份代码是对的，见 docs/FINDINGS.md 的 Android 补记）",
  );
}
console.log("      · ⚠️ 跳过：输入中文 → 点卦卡（adb 打不出中文；该链路由 verify.mjs 覆盖）");

// ── 5) 搜索 → 网格 → 点卦卡 → 详情（与 web 上同一条链路）─────────────────────
section("列表 → 详情");
// 先回列表页（详情页有「‹ 六十四卦」返回按钮）
let back = dump();
tapText(back, "六十四卦");
await sleep(1500);

// 搜索框：**按 class 找**，不靠坐标猜
function editTexts(x) {
  const out = [];
  for (const m of x.matchAll(/<node[^>]*>/g)) {
    const a = attrsOf(m[0]);
    if (!(a.class || "").includes("EditText")) continue;
    const b = (a.bounds || "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!b) continue;
    const [x1, y1, x2, y2] = b.slice(1).map(Number);
    out.push({ cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 });
  }
  return out;
}
const boxes = editTexts(dump());
check("找得到搜索框", boxes.length > 0, `EditText ×${boxes.length}`);
if (boxes.length) {
  adb("shell", "input", "tap", String(Math.round(boxes[0].cx)), String(Math.round(boxes[0].cy)));
  await sleep(600);
  // ⚠️ `adb shell input text` **打不出中文**：它把参数当 ASCII 发（`input text 乾` 会变成空、
  //    `%E4%B9%BE` 会原样落成字面量 `E4%9E`）。实测这行 dump 里就是 `E4%9E`。
  //    所以真机上只能验到"**输入通道通了**"（键入了东西 → 模型变了 → 过滤网格出现），
  //    而"输入中文 → 命中卦卡 → 点进去"这条留在 web 判据里（`verify.mjs`，那边能真打字）。
  adb("shell", "input", "text", "qian");
  await sleep(1800);
  const grid = await waitFor((x) => uiTexts(x).includes("六十四卦速查"), 20000);
  const g = uiTexts(grid);
  check("键入后出现「六十四卦速查」（输入通道 → 模型 → 重绘 通了）", g.includes("六十四卦速查"), g.slice(0, 140));
  check(
    "网格进入空态（`qian` 匹配不到中文卦名 —— 这是预期的，不是 bug）",
    !g.includes("䷀") && !g.includes("乾为天"),
    g.slice(0, 100),
  );
  // 清掉查询，回到罗盘页（后续断言不依赖它，但把界面留在干净状态便于人再看一眼）
  for (let i = 0; i < 6; i++) adb("shell", "input", "keyevent", "67");
  await sleep(1200);
}

// ⚠️ 真机上**验不到**的那条，写清楚（别让它看起来像"验过了"）：
//    "输入中文 → 命中卦卡 → 点卦卡进详情"需要 adb 能打中文，而 `input text` 不行。
//    它由 web 判据覆盖（`verify.mjs`：搜索「乾」→ 网格 → 点卦卡 → 详情）。
//    真机这边覆盖的是**设备特有**的那部分：触摸（Pressable）、手势坐标、Skia 画布。

// ── 5b) 底部折叠区块：**受控**（原生上同样是"按钮 + 条件渲染"）────────────────
//
// 为什么要单独在真机上验一遍：`<details>/<summary>` 迁不动（标签表里明确排除），
// 换成"按钮 + 条件渲染"之后，**开合状态从 DOM 挪进了 Model** —— 这条链在原生宿主上
// 走的是**另一份** Pressable 映射（同 `verify.mjs` 的"web 上验过 ≠ 真机也能跑"）。
//
// 判据为什么**不依赖具体文本**：真机上 `adb shell input text` 打不出中文，搜索条路走不通，
// 只能靠点罗盘进卦 —— 进的是哪一卦由轮盘当前角度决定，事前不知道，所以判据不能写死
// "卦辞第一句"这种数据相关的字符串。
// 改用**与卦无关的两件事**：
//   ① 三个区块标题里的「传文关联…」**每一卦都有**（64/64 都有该字段，实测过，
//      另外两块只在部分卦里出现：文言 41 / 用 2），所以它是最好的锚点；
//   ② "内容在不在树上"用**长文本节点数**（≥ 8 字）代替：折叠时标题下面只剩页脚，
//      展开后成段的注疏会进树 —— 节点数是**可见节点**的计数，所以展开前必须先 scroll 好、
//      之后不再滚动，两次测量才可比。
section("底部折叠（受控）");
const FOLD_TITLE = "传文关联 · 序卦 / 杂卦 / 说卦 / 系辞";
/**
 * **标题那条线以下**的长文本（≥ 8 字）条数。
 *
 * ⚠️ 基准线取标题的上沿：标题**以上**还留着别的正文（六爻注疏那种），把它算进来
 *    会得到"折叠时也有好几条长文本"的假红 —— 数的是"这块折叠区自己有没有内容"。
 */
/** 标题那条线以下的长文本**集合**（用于"哪一条是展开后才出现的"）。 */
function longTextSetBelow(x, y) {
  return new Set(nodes(x).filter((n) => n.text.trim().length >= 8 && n.y1 >= y).map((n) => n.text.trim()));
}

function longTextsBelow(x, y) {
  return nodes(x).filter((n) => n.text.trim().length >= 8 && n.y1 >= y).length;
}
function arrowCount(x) {
  return nodes(x).filter((n) => n.text.includes("▾")).length;
}
function findNode(x, needle) {
  return nodes(x).find((n) => n.text.includes(needle)) || null;
}
/** 往下滚，直到锚点标题可见（返回滚好之后的 xml；找不到就返回最后一次的 xml）。 */
// ⚠️ 这一页**很长**（六爻 + 小象 + 彖辞正文…），8 次 swipe 只滚到「六爻」那一段 ——
//    实测那次就停在那儿，判据红的是**夹具没滚到**，不是折叠坏了。所以预算给足，
//    并且每滚一次打一行进度（下次红了能一眼看出"滚到哪儿了"）。
async function scrollToTitle(title, tries = 30) {
  let x = dump();
  for (let i = 0; i < tries; i++) {
    if (findNode(x, title)) return { xml: x, found: true };
    const seen = nodes(x).map((n) => n.text.trim()).filter(Boolean);
    console.log(`      · 滚动 ${i + 1}/${tries}：当前最下面一条「${seen[seen.length - 1] || ""}」`.slice(0, 100));
    adb("shell", "input", "swipe", "60", "2000", "60", "600", "250");
    await sleep(800);
    x = dump();
  }
  return { xml: x, found: Boolean(findNode(x, title)) };
}
/**
 * 把锚点标题滚到**屏幕靠上**（y 在 60..240），返回滚好之后的 xml。
 *
 * ⚠️ 为什么不是"滚到底"：这一段的判据是"展开后正文出现在**标题下面**"，
 *    而 `uiautomator` 只 dump **可见**节点 —— 标题停在屏幕下半部时，新插进来的正文
 *    落在视口外，只能"边滚边收集合"；而那样收集来的集合**会随滚动位置抖动**
 *    （实测：收起后"多出 1 条"其实是《睽》的一条爻辞，跟折叠无关）。
 *    把标题顶到上面，展开的内容直接落在视口里，两次测量之间不用再滚，判据就稳了。
 */
async function scrollTitleToTop(title, tries = 30) {
  let x = dump();
  for (let i = 0; i < tries; i++) {
    const n = findNode(x, title);
    if (n && n.y1 >= 60 && n.y1 <= 240) return { xml: x, found: true };
    // 已经滚过头（标题在屏幕上方之外）就反着滚一小段
    if (n && n.y1 < 60) {
      adb("shell", "input", "swipe", "60", "700", "60", "1100", "250");
    } else {
      adb("shell", "input", "swipe", "60", "2000", "60", "600", "250");
    }
    await sleep(800);
    x = dump();
  }
  const n = findNode(x, title);
  return { xml: x, found: Boolean(n) };
}

/** 往回滚（手指从上往下划），直到锚点标题再次可见。 */
async function scrollUpToTitle(title, tries = 30) {
  let x = dump();
  for (let i = 0; i < tries; i++) {
    if (findNode(x, title)) return { xml: x, found: true };
    adb("shell", "input", "swipe", "60", "600", "60", "2000", "250");
    await sleep(800);
    x = dump();
  }
  return { xml: x, found: Boolean(findNode(x, title)) };
}
/** 一路往下滚，收集**这一路上出现过的**长文本（≥ 8 字）。
 *
 *  ⚠️ 为什么必须"边滚边收"：uiautomator **只 dump 可见节点** —— 展开折叠区块之后，
 *  新插进来的正文多半落在屏幕**下面**（y > 2340），不滚过去它根本不在 dump 里。
 *  第一版直接数"标题下面有几条长文本"，于是展开前后都是 1（那条红的是**判据**，
 *  不是折叠 —— 折叠本身是对的：箭头 ▸→▾ 当场就变了）。
 *  收集的是**文本集合**（不是条数）：集合能做差集，"收起后又多出来的文本"必须是 0 条。 */
async function collectLongTexts(times) {
  const seen = new Set();
  for (let i = 0; i < times; i++) {
    for (const n of nodes(dump())) {
      const t = n.text.trim();
      if (t.length >= 8) seen.add(t);
    }
    adb("shell", "input", "swipe", "60", "2000", "60", "600", "250");
    await sleep(800);
  }
  return seen;
}

// 先进一卦详情页：从列表页点罗盘外环（与上面"轻点外环"同一条路）
if (!uiTexts(dump()).includes("八卦罗盘")) {
  tapText(dump(), "六十四卦");
  await sleep(1800);
}
// ⚠️ 两个夹具上的坑，都踩过：
//   ① 上一段**在搜索框里打过字**，软键盘还占着下半屏 → 布局与开头不一样了，
//      所以这里必须先收起键盘、再**重新量**画布几何（`measureCanvas`）——拿开头那次的
//      坐标点会落到画布外，表现为"折叠标题找不到"，真因却在夹具的坐标；
//   ② 点一次不中（responder 交接、动画帧）就重试，而不是把一次失败当结论。
let onDetail = false;
for (let attempt = 0; attempt < 3 && !onDetail; attempt++) {
  adb("shell", "input", "keyevent", "111"); // ESC：收起软键盘
  await sleep(1200);
  const c = measureCanvas() || canvas;
  if (!c) break;
  const r = (c.side * 260) / 720; // 外环中径（与上面 tapRing 同一处）
  adb("shell", "input", "tap", String(Math.round(c.cx + r)), String(Math.round(c.cy)));
  const x = await waitFor((xx) => /第\d{1,2}卦/.test(uiTexts(xx)), 8000);
  onDetail = /第\d{1,2}卦/.test(uiTexts(x));
}
if (onDetail) {
  check("（夹具）进入了某一卦的详情页", true, uiTexts(dump()).slice(0, 100));

  // ① 把标题滚到**屏幕靠上**（不是"滚到底"）：这样展开后新插入的正文**直接落在视口里**，
  //    两次测量之间**不用再滚动** —— 而"边滚边收集合"那版会被**别的**内容干扰：
  //    滚动位置的细微差别会让某一条爻辞时有时无，于是"收起后多出 1 条"这种假红
  //    （十轮实测踩到：多出来的是《睽》的一条爻辞，与折叠无关）。
  const scrolled = await scrollTitleToTop(FOLD_TITLE);
  check(`折叠标题常显（滚到靠上能找到）「${FOLD_TITLE}」`, scrolled.found, uiTexts(scrolled.xml).slice(-120));
  if (scrolled.found) {
    const head = findNode(scrolled.xml, FOLD_TITLE);
    const y0 = head.y1;
    const beforeSet = longTextSetBelow(scrolled.xml, y0);
    const before = beforeSet.size;
    check("折叠箭头是合上的（▾ 不可见）", arrowCount(scrolled.xml) === 0, `▾ 节点 ${arrowCount(scrolled.xml)}`);

    adb("shell", "input", "tap", String(Math.round(head.cx)), String(Math.round(head.cy)));
    // ⚠️★ **轮询等目标状态，不用固定 sleep**（2026-10-23 实测的教训）：
    //    `adb shell input tap` 之后界面要等 React 提交 + 一次 uiautomator dump；
    //    这台机器上固定 `sleep(1500)` **读到的是点击前的界面** —— 表现为"慢一拍"：
    //    "点标题展开"读到 `▾ 节点 0`（没变），而紧接着"收起后箭头合上"却读到 `▾ 节点 1`（已经展开了）。
    //    本仓库早就记过这条（"节流 rAF：React 的提交比刷新慢一拍"），这里把它落到代码里。
    const opened = await waitFor((x) => arrowCount(x) >= 1, 20000, 600);
    const afterSet = longTextSetBelow(opened, y0);
    const fresh = [...afterSet].filter((s) => !beforeSet.has(s));
    check("点标题展开：箭头变 ▾（模型真的变了）", arrowCount(opened) >= 1, `▾ 节点 ${arrowCount(opened)}`);
    // ⚠️ 判据取"**展开后才出现的那句话**"，而不是"长文本条数 ≥ N"：
    //    标题下面本来就可能有别的东西（另外两个折叠标题、页脚），而视口高度决定一次能看到几段
    //    —— 拿绝对条数当阈值会随屏幕高度抖（十轮实测：折叠态 3 条、展开后 5 条，阈值写 3 就假红）。
    const sample = fresh[0] || "";
    check(
      `展开后正文**就在视口里**（标题下长文本 ${before} → ${afterSet.size}，新出现 ${fresh.length} 条）`,
      fresh.length >= 1,
      fresh.length ? `例：${sample.slice(0, 40)}` : "一条都没多出来",
    );

    // ② 收起：**再找一次标题**（展开会把标题往下顶）再点，然后同样量"标题下面"
    const head2 = findNode(opened, FOLD_TITLE);
    check("展开后标题还在（内容插在它下面）", Boolean(head2), head2 ? `y=${Math.round(head2.cy)}` : "标题不见了");
    if (head2) {
      adb("shell", "input", "tap", String(Math.round(head2.cx)), String(Math.round(head2.cy)));
      // 同上：轮询等"箭头合上"（别用固定 sleep —— 那会读到点击前的界面）
      const closed = await waitFor((x) => arrowCount(x) === 0, 20000, 600);
      const cy2 = findNode(closed, FOLD_TITLE) ? findNode(closed, FOLD_TITLE).y1 : y0;
      const closedSet = longTextSetBelow(closed, cy2);
      check("收起后箭头又是合上的（▾ 消失）", arrowCount(closed) === 0, `▾ 节点 ${arrowCount(closed)}`);
      check(
        `再点一次收起：刚才那句正文又看不到了（长文本 ${afterSet.size} → ${closedSet.size}）`,
        sample !== "" && !closedSet.has(sample),
        sample ? `基准 ${before} / 展开 ${afterSet.size} / 收起 ${closedSet.size}｜样句：${sample.slice(0, 26)}` : "（展开时没取到样句）",
      );
    }
  }
} else {
  // 夹具没到位时**要红**：不红的话"折叠那几条没跑"会被读成"折叠验过了"。
  check(
    "（夹具）进入了某一卦的详情页",
    false,
    `点了 3 次罗盘外环都没进详情页（当前页：${uiTexts(dump()).slice(0, 80)}）`,
  );
}

// ── 5c) 画布上的文字：**真的画出来了吗**（量像素，不靠应用自述）────────────────
//
// 为什么必须有（2026-10-23 实测）：Android 上"按族名要不到中文字形"——设备 **33 个字体族里
// 没有一个**能画「乾」（对照拉丁 `A` = 38 ⇒ 探针没问题），而 Skia 的 `<Text font=>`
// **不做字体回退** ⇒ 画布上的中文**一条都画不出来，而且不报错、不崩**。
// 那一轮这个洞是**用户用眼睛看出来的** —— 所以这里补一条**量**的判据。
//
// 判据怎么定的（同一台模拟器上的标定读数）：
//   回退字体**没生效**：画布区域里"独立的墨色连通块" = **790** 个
//   回退字体**生效**后：                          = **2191** 个（一个汉字就是一两块笔画）
//   ⇒ 阈值 **1500**（两边各有 ~2× 余量）。⚠️ 画面构成变了要**重新标定**（别硬抄这个数）。
//
// ⚠️ 为什么不用"应用自己报的 unrenderableTextCount()"：**判据不能建在被检查者的自述上**
//    （那一句是本仓库栽过的坑：把兜底删掉，自述计数就恒为 0、判据空转）。
section("画布文字（回退字体）");
if (canvas) {
  // ⚠️ **先回到"罗盘页"**：上面那批折叠判据把页面留在**详情页**了，而这一段量的是罗盘画布。
  //    前两版都栽在"以为回去了"：第一版用"六十四卦"返回（那去的是**列表页**，量到 571 块），
  //    第二版点顶部导航 + sleep（页还没切完，量到 329 块）。**导航与 sleep 都不可靠。**
  //    现在改成**重启应用**：应用本来就开在罗盘页（脚本开头的断言就是这么过的），
  //    重启是**确定性**的。到位判据：罗盘页特有的「立竿测影」出现在 dump 里（轮询，不 sleep）。
  adb("shell", "am", "force-stop", PKG);
  adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1");
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    if (uiTexts(dump()).includes("立竿测影")) break;
  }
  await sleep(2000); // 让画布这一帧落定（Skia 首帧之后还有一次"回退字体就绪"的重渲染）

  const buf = execFileSync("adb", ["exec-out", "screencap", "-p"], {
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
  let blobs = 0;
  let ink = 0;
  try {
    const img = decodePng(buf);
    const X0 = Math.max(0, Math.round(canvas.cx - canvas.side / 2));
    const X1 = Math.min(img.w, Math.round(canvas.cx + canvas.side / 2));
    const Y0 = Math.max(0, Math.round(canvas.cy - canvas.side / 2));
    const Y1 = Math.min(img.h, Math.round(canvas.cy + canvas.side / 2));
    const W = X1 - X0;
    const H = Y1 - Y0;
    // "笔画像素"：墨色 / 朱红 / 棕（画布上的线条与文字都在这几档里）
    const isInk = (x, y) => {
      const i = (y * img.w + x) * img.bpp;
      const r = img.px[i];
      const g = img.px[i + 1];
      const b2 = img.px[i + 2];
      for (const [pr, pg, pb] of [[26, 20, 16], [138, 37, 24], [122, 104, 81]]) {
        if (Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b2 - pb) <= 70) return true;
      }
      return false;
    };
    const seen = new Uint8Array(W * H);
    const stack = [];
    for (let y0 = 0; y0 < H; y0++) {
      for (let x0 = 0; x0 < W; x0++) {
        if (seen[y0 * W + x0] || !isInk(X0 + x0, Y0 + y0)) continue;
        stack.length = 0;
        stack.push(x0, y0);
        seen[y0 * W + x0] = 1;
        blobs++;
        while (stack.length) {
          const y = stack.pop();
          const x = stack.pop();
          ink++;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              if (seen[ny * W + nx] || !isInk(X0 + nx, Y0 + ny)) continue;
              seen[ny * W + nx] = 1;
              stack.push(nx, ny);
            }
          }
        }
      }
    }
  } catch (e) {
    check("画布截图能解开（PNG 解码）", false, String(e.message).slice(0, 120));
  }
  // ⚠️ 阈值来自标定（无字 790 / 有字 2191）；这里如实把读数打出来，便于下次重新标定。
  check(
    "★ 画布上**真的有字**（独立的墨色连通块 ≥ 1500 —— 标定：无字 790 / 有字 2191）",
    blobs >= 1500,
    `实测连通块 ${blobs} 个 / 墨点 ${ink}（阈值 1500；画面构成变了要重新标定）`,
  );
}

// ── 5d) 画布**几何**：它必须是个正圆（2026-10-23 实测补的）──────────────────────
//
// 为什么必须有：那一天真机上"八卦阵"变成了**横扁的椭圆**、而且外圈与内圈对不上 ——
// 根因是 `canvas-ops.js` 把变换写成两项合一（`{translateX, translateY}`），
// 而 RN Skia 的 `processTransform3d` **只读每项的第一个键** ⇒ `scale(k,k)` 只缩了 x。
// **那次是用户用眼睛看出来的**，而当时 29 条真机判据全绿。所以这里补一条**量**的判据。
//
// 判据怎么来的（同一台模拟器上的标定读数）：
//   修前（椭圆）：横半轴 489.5px / 竖半轴 955.2px ⇒ **a/b = 0.512**（≈ k = 369/720），圆心比画布中心低 482px
//   修后（正圆）：a = b = 489.5px ⇒                **a/b = 1.000**，圆心落在画布中心
// ⇒ 做法：逐行取"最外沿"半宽 h(y)，拟合 `h² = A + B·y + C·y²`（椭圆正是这个形状），
//    解出 a、b、圆心与残差；断言 **|a/b − 1| ≤ 0.03**，且残差小（残差大说明量的不是那条外圈）。
section("画布几何（正圆性）");
if (canvas) {
  const shotBuf = execFileSync("adb", ["exec-out", "screencap", "-p"], {
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
  let verdict = null;
  try {
    const img = decodePng(shotBuf);
    const side = Math.round(canvas.side);
    // 取样区内缩 20px：把画布外面的页面留白排除掉（它是纸色，会被当成"内容"）
    const X0 = Math.max(0, Math.round(canvas.cx - side / 2) + 20);
    const X1 = Math.min(img.w, Math.round(canvas.cx + side / 2) - 20);
    const Y0 = Math.max(0, Math.round(canvas.cy - side / 2) + 20);
    const Y1 = Math.min(img.h, Math.round(canvas.cy + side / 2) - 20);
    const boxBg = [246, 239, 224]; // 画布盒子的底色（--bg-elev）
    const isContent = (x, y) => {
      const i = (y * img.w + x) * img.bpp;
      return (
        Math.abs(img.px[i] - boxBg[0]) + Math.abs(img.px[i + 1] - boxBg[1]) + Math.abs(img.px[i + 2] - boxBg[2]) > 40
      );
    };
    const rows = [];
    for (let y = Y0; y < Y1; y++) {
      let l = -1;
      let r = -1;
      for (let x = X0; x < X1; x++) {
        if (isContent(x, y)) {
          if (l < 0) l = x;
          r = x;
        }
      }
      if (l < 0) continue;
      if (l <= X0 + 1 || r >= X1 - 2) continue; // 贴到取样区边缘 ⇒ 这一行被裁了
      rows.push([y, (r - l + 1) / 2]);
    }
    if (rows.length > 50) {
      // 最小二乘：h² = A + B·y + C·y²（3×3 正规方程 + 高斯消元）
      const S = [0, 0, 0, 0, 0];
      const T = [0, 0, 0];
      for (const [y, h] of rows) {
        const y2 = y * y;
        const h2 = h * h;
        S[0] += 1;
        S[1] += y;
        S[2] += y2;
        S[3] += y2 * y;
        S[4] += y2 * y2;
        T[0] += h2;
        T[1] += h2 * y;
        T[2] += h2 * y2;
      }
      const M = [
        [S[0], S[1], S[2], T[0]],
        [S[1], S[2], S[3], T[1]],
        [S[2], S[3], S[4], T[2]],
      ];
      for (let c = 0; c < 3; c++) {
        let piv = c;
        for (let r2 = c + 1; r2 < 3; r2++) if (Math.abs(M[r2][c]) > Math.abs(M[piv][c])) piv = r2;
        const tmp = M[c];
        M[c] = M[piv];
        M[piv] = tmp;
        if (M[c][c] === 0) continue;
        for (let r2 = 0; r2 < 3; r2++) {
          if (r2 === c) continue;
          const f = M[r2][c] / M[c][c];
          for (let k = c; k < 4; k++) M[r2][k] -= f * M[c][k];
        }
      }
      const A0 = M[0][3] / M[0][0];
      const B0 = M[1][3] / M[1][1];
      const C0 = M[2][3] / M[2][2];
      const k2 = -C0; // a²/b²
      if (k2 > 0) {
        const cy = B0 / (2 * k2);
        const a = Math.sqrt(Math.max(A0 + k2 * cy * cy, 1));
        const b = a / Math.sqrt(k2);
        let rms = 0;
        for (const [y, h] of rows) {
          const t = (y - cy) / b;
          const pred = Math.abs(t) < 1 ? a * Math.sqrt(1 - t * t) : 0;
          rms += (pred - h) ** 2;
        }
        verdict = { a, b, cy, rms: Math.sqrt(rms / rows.length), n: rows.length, midY: (Y0 + Y1) / 2 };
      }
    }
  } catch (e) {
    check("画布截图能解开（PNG 解码）", false, String(e.message).slice(0, 120));
  }
  if (!verdict) {
    check("画布几何：能量到最外圈（逐行最外沿 + 椭圆拟合）", false, "样本不足或拟合失败");
  } else {
    const ratio = verdict.a / verdict.b;
    check(
      "★ 罗盘是**正圆**（横半轴/竖半轴 ≈ 1；标定：修前 0.512 / 修后 1.000）",
      Math.abs(ratio - 1) <= 0.03,
      `a=${verdict.a.toFixed(1)}px b=${verdict.b.toFixed(1)}px a/b=${ratio.toFixed(3)} 残差RMS=${verdict.rms.toFixed(1)}px（${verdict.n} 行）`,
    );
    check(
      "★ 圆心落在画布中间（偏差 ≤ 4% 边长；标定：修前低 482px）",
      Math.abs(verdict.cy - verdict.midY) <= canvas.side * 0.04,
      `圆心 y≈${verdict.cy.toFixed(0)} / 取样区中心 y≈${verdict.midY.toFixed(0)}（差 ${(verdict.cy - verdict.midY).toFixed(0)}px）`,
    );
  }
}

// ── 5f) 叶子文字样式（`fontWeight`）在真机上**真的生效**吗 ─────────────────────
//
// 廿一轮那条欠账的原话是"真机上那 4 个文字键（`fontWeight` / `fontStyle` / `textAlign` /
// `textTransform`）的效果**仍未量**"。这条先量 `fontWeight`。
//
// 为什么这条判据值得存在：那一轮我们**改的就是这几个键**（它们曾经在内嵌白名单里被静默丢掉），
// 而 web 侧「看」不出这类问题 —— CSS 的 `font-weight` **会继承**，RN 的不继承：
// 一旦键在某条路径上被吃掉，**只有真机看得见**。（同理：一轮前那条"椭圆"就是"29 条全绿、
// 用户用眼睛看出来的" —— "会自己抓住"的判据比"人眼发现"的判据值钱。）
//
// 怎么量（**不靠应用自述、也不装图像库**）：详情页上每一爻都是「爻题（`span.m-yao-title`：
// 16.5px **W700** 红字）+ 爻辞（16px 常规深字）」，一屏里两类都有 ⇒ 分成两组比：
//   A 组 = 2~3 字的爻题节点          B 组 = 同字号（框高 66~82px）的整句正文（卦辞 / 爻辞）
// 统计量 = 墨色**水平游程**里"**粗笔（≥4px）占的段数比例**" —— 见下面的标定为什么选它。
//
// ⚠️ 为什么不用"墨点密度"：它被**字形复杂度**带偏（实测 A 0.122 / B 0.136 —— 加粗的那组反而更"稀"，
//    因为「六三」的「三」只有三横）。也正因如此，这条判据**不是**"绝对粗细"，
//    而是"**同一屏上两组之间的比值**"。
// ⚠️ 为什么不用"游程 p25"（第一版用的就是它）：它是**整数分位数** ⇒ 样本少时读数会跳
//    （实测同一次原始态里 A 的 p25 逐个节点是 4/5/5/5/4/4 ⇒ 平均 4.67，而证伪态是 3.33：
//    真正的信号只有"3 还是 4"），于是原始态 1.56 / 证伪态 1.11，阈值只能卡在 1.35，两侧余量都只有 ~0.2。
//    换成"粗笔段数占比"（几千段里的比例，连续量）之后：原始态 **2.15** / 证伪态 **1.22**。
// ⚠️ 方向上的偏差是**诚实记下**的：A 组是红字（#8a2518，亮度 66）、B 组是深字（#1a1410，亮度 22）
//    ⇒ 抗锯齿时红字的边缘更早越过墨色阈值 ⇒ **红字量出来偏细**（对"加粗"这个结论偏保守）。
//
// 标定（同一台模拟器、同一卦「风地观」#20、同一套取样规则；A 组 6 个节点、B 组 7 个节点，两次都一样）：
//   | 统计量               | 原始代码 | 证伪（删掉 `font_weight`）|
//   | 粗笔段数占比 比值    | **2.15** | **1.22**                  |
//   | 游程 p25 比值        | 1.67     | 1.00                      |
//   | 每节点 p25 均值 比值 | 1.56     | 1.11                      |
//   ⇒ 阈值取 **1.6**（原始侧余量 0.55、证伪侧余量 0.38）。
//   跑判据本体（样本比探针少一些：B 组 3 个节点）时的读数：**原始 2.33（A 0.952 / B 0.409）/
//   证伪 1.32（A 0.542 / B 0.409）** —— ⚠️ A 那两组的组分比在两次之间**逐位相同**
//   （0.952 / 0.542），抖动全在 B（0.443 与 0.409，样本多少之差）。
section("文字样式（fontWeight）");
{
  // 前置：走到某一卦的详情页（本判据要的样本只在那里）
  adb("shell", "am", "force-stop", PKG);
  adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1");
  await waitFor((x) => uiTexts(x).includes("八卦罗盘"), 90000);
  const cv = measureCanvas();
  let onDetail = false;
  if (cv) {
    // 点外环中径（与 `tapRing` 同一套几何：绘制坐标 222–300 的中径 = 260/720）
    adb(
      "shell",
      "input",
      "tap",
      String(Math.round(cv.cx + (cv.side * 260) / 720)),
      String(Math.round(cv.cy)),
    );
    const d = await waitFor((x) => /第\d{1,2}卦/.test(uiTexts(x)), 25000);
    onDetail = /第\d{1,2}卦/.test(uiTexts(d));
  }
  check("（文字样式）能走到卦的详情页（爻题与爻辞同屏的那一页）", onDetail, onDetail ? "" : "点外环没进详情页");

  /** 墨色水平游程（竖笔的粗细）**原始段长列表** —— 统计留到最后池化算（别在节点级先算分位数）。 */
  function strokeRuns(img, x1, y1, x2, y2) {
    const lum = (x, y) => {
      const i = (y * img.w + x) * img.bpp;
      return 0.299 * img.px[i] + 0.587 * img.px[i + 1] + 0.114 * img.px[i + 2];
    };
    const runs = [];
    for (let y = Math.max(0, y1); y < Math.min(img.h, y2); y++) {
      let run = 0;
      for (let x = Math.max(0, x1); x < Math.min(img.w, x2); x++) {
        if (lum(x, y) < 140) run++;
        else {
          if (run) runs.push(run);
          run = 0;
        }
      }
      if (run) runs.push(run);
    }
    return runs.length ? runs : null;
  }

  const isYaoTitle = (t) => /^(初|上)?[九六][一二三四五]?$/.test(t.trim());
  const isBody = (t) => /^[\u4e00-\u9fff]{4,}/.test(t.trim());
  const A = new Map();
  const B = new Map();
  if (onDetail) {
    for (let step = 0; step < 16; step++) {
      const ns = nodes(dump());
      const inView = (n) => n.y1 > 150 && n.y2 < 2280 && n.x2 - n.x1 > 30;
      const ta = ns.filter((n) => isYaoTitle(n.text) && inView(n));
      // B 组限"同字号"：框高 66~82px（16px 的整句正文）；小字提示 / 页脚（≈55–62px）排除掉
      const tb = ns.filter(
        (n) => isBody(n.text) && n.text.trim().length >= 5 && inView(n) && n.y2 - n.y1 >= 66 && n.y2 - n.y1 <= 82,
      );
      if (ta.length || tb.length) {
        const img = decodePng(
          execFileSync("adb", ["exec-out", "screencap", "-p"], {
            env: { ...process.env, MSYS_NO_PATHCONV: "1" },
            maxBuffer: 64 * 1024 * 1024,
          }),
        );
        for (const n of ta) {
          const s = strokeRuns(img, n.x1, n.y1, n.x2, n.y2);
          if (s && !A.has(n.text.trim())) A.set(n.text.trim(), s);
        }
        for (const n of tb) {
          const s = strokeRuns(img, n.x1, n.y1, n.x2, n.y2);
          if (s && !B.has(n.text.trim().slice(0, 8))) B.set(n.text.trim().slice(0, 8), s);
        }
      }
      adb("shell", "input", "swipe", "540", "1700", "540", "1100", "250");
      await sleep(700);
    }
  }
  const avg = (m, f) => {
    const v = [...m.values()].map(f);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
  };
  // 池化（把所有节点的段长合起来再算）—— 节点级先算分位数会被"整数分位"放大抖动
  const pooled = (m) => {
    const all = [...m.values()].flat();
    const sorted = all.slice().sort((a, b) => a - b);
    const q = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);
    return { runs: all.length, fracGe4: all.filter((v) => v >= 4).length / all.length, p25: q(0.25), med: q(0.5) };
  };
  // ⚠️ 前提自查（别"零样本"地判过）：两组都要有足够样本，否则这条判据没有意义
  check(
    "（文字样式）两组样本都够（爻题 ≥ 3 个、同字号正文 ≥ 3 个）",
    A.size >= 3 && B.size >= 3,
    `爻题 ${A.size} 个 / 正文 ${B.size} 个`,
  );
  const pa = pooled(A);
  const pb = pooled(B);
  const ratio = pb.fracGe4 > 0 ? pa.fracGe4 / pb.fracGe4 : 0;
  check(
    "★ 真机上 `fontWeight` **真的生效**（爻题里粗笔（≥4px）占的段数比例 ≥ 同屏正文的 1.6 倍；标定：有加粗 2.15 / 删掉后 1.22）",
    ratio >= 1.6,
    `爻题 粗笔占比 ${pa.fracGe4.toFixed(3)}（${A.size} 个节点 / ${pa.runs} 段，p25=${pa.p25}）/ ` +
      `正文 ${pb.fracGe4.toFixed(3)}（${B.size} 个 / ${pb.runs} 段，p25=${pb.p25}）⇒ 比值 ${ratio.toFixed(2)}；` +
      `每节点 p25 均值 ${avg(A, (r) => r.slice().sort((x, y) => x - y)[Math.floor(r.length / 4)]).toFixed(2)} / ` +
      `${avg(B, (r) => r.slice().sort((x, y) => x - y)[Math.floor(r.length / 4)]).toFixed(2)}`,
  );
}

// ── 6) 没有原生崩溃 ──────────────────────────────────────────────────────────
section("稳定性");
let logcat = "";
try {
  logcat = adb("logcat", "-d", "-b", "crash", "-t", "200");
} catch {
  /* 拿不到就当空 */
}
const fatals = logcat
  .split("\n")
  .filter((l) => /FATAL EXCEPTION|AndroidRuntime/.test(l))
  .slice(0, 3);
check("全程没有原生崩溃（logcat -b crash 里没有 FATAL）", fatals.length === 0, fatals.join(" ;; "));

const pass = results.filter((r) => r.ok).length;
console.log("\n================ 阅读器 真机 汇总 ================");
console.log(`通过 ${pass}  失败 ${results.length - pass}`);
for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL  ${r.name}`);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
