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
    await sleep(1500);
    let afterMode = shot();
    for (let i = 0; i < 3 && afterMode.hash === beforeMode.hash; i++) {
      await sleep(600 * (i + 1));
      afterMode = shot();
    }
    check(
      "点「京房八宫」→ 真机画面变了（Skia 那条绘制路径也跟着模式走）",
      afterMode.hash !== beforeMode.hash,
      `前 ${beforeMode.hash} 后 ${afterMode.hash}`,
    );
    tapText(dump(), "后天文王");
    await sleep(1500);
    let back = shot();
    for (let i = 0; i < 3 && back.hash !== beforeMode.hash; i++) {
      await sleep(600 * (i + 1));
      back = shot();
    }
    check(
      "切回「后天文王 · 卦气」→ 画面**复原**（不是「点一下就乱刷」）",
      back.hash === beforeMode.hash,
      `基准 ${beforeMode.hash} / 切回 ${back.hash}`,
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
    await sleep(1500);
    const opened = dump();
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
      await sleep(1500);
      const closed = dump();
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
