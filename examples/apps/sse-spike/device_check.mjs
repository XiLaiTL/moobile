#!/usr/bin/env node
// device_check.mjs —— **SSE 通道在真机（Android）上**的判据。
//
//   node examples/apps/sse-spike/device_check.mjs
//
// ## 为什么无头判据不够 —— 这条是**两套传输**，无头只覆盖了其中一套
//
// `sse/sse.mbt` 在编译出来的 JS 里**先判平台再发请求**：
//
// | 平台 | 传输 | 无头（node）验得到吗 |
// |---|---|---|
// | Web / Node | `fetch` + `response.body.getReader()` | ✅ `verify.mjs` 12 项 |
// | **React Native** | **`XMLHttpRequest` 渐进读 `responseText`** | ❌ **node 里没有 XMLHttpRequest** |
//
// ⇒ **"web 上验过 ≠ 真机能跑"** 在这条通道上是字面意义上的：两条传输**代码不同**。
// 而 RN 那条偏偏是最容易想当然的一条 —— RN 的 `fetch` 没有 `response.body`，
// 照 fetch 写法写出来的流式在**真机上一条 `Delta` 都收不到**（而且**不报错**）。
//
// ## 前置
//
// 1. 模拟器在跑（`emulator-5554`）；
// 2. **Metro 在 8081，而且服务的就是本目录**（`npx expo start --port 8081`）——
//    ⚠️ 8081 上是谁的 Metro **一定要确认**：别的应用会把 bundle 服务出来，
//    于是你验的是另一个应用（本仓库踩过，见 `HANDOVER.md` §4-5）；
// 3. 设备上有一个**已装的 debug 包**（`SSE_SPIKE_PKG` 可指定）。不必是本应用的 APK ——
//    debug 包从 Metro 拉 bundle，所以**它加载的就是我们这份 JS**；本应用不用任何新原生模块，
//    因此复用已有 debug 包是安全的（少一次 10 分钟的 gradle）。
//
// 判据自己会起一个 SSE 服务在宿主机 8799，并 `adb reverse` 进设备 —— 于是应用里的
// `127.0.0.1:8799` 就是宿主机（这与 todo-app 的 `10.0.2.2` 是一个道理，用 reverse 更省事）。

import { execFileSync } from "node:child_process";
import { createServer } from "node:http";

const PKG = process.env.SSE_SPIKE_PKG || "com.anonymous.host";
const PORT = Number(process.env.SSE_SPIKE_PORT || 8799);

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

// ── 1) Metro 必须服务**本工程**（否则验的是别的应用）─────────────────────────────
section("Metro");
let title = "";
for (let i = 0; i < 20; i++) {
  try {
    const html = execFileSync(
      "curl",
      ["-s", "--max-time", "5", "http://localhost:8081/"],
      { encoding: "utf8" },
    );
    title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
    if (title) break;
  } catch {
    /* 还没起来 */
  }
  await sleep(1000);
}
if (!title) skipOut("8081 上没有 Metro（先在本目录跑 `npx expo start --port 8081`）");
check(
  `8081 上的 Metro 服务的是本应用（title=${title}）`,
  title === "sse-spike",
  title === "sse-spike" ? "" : "⚠️ 这是别的工程的 bundle —— 换一个端口或先停掉那个 Metro",
);
if (title !== "sse-spike") {
  console.log("\n================ SSE 真机 汇总 ================");
  console.log("通过 0  失败 1（Metro 服务的是别的应用，继续验没有意义）");
  process.exit(1);
}

// ── 2) 宿主机上的 SSE 服务 + adb reverse ──────────────────────────────────────
section("本地 SSE 服务 + adb reverse");
let mode = "normal"; // normal | slow
const server = createServer((q, res) => {
  const u = q.url || "/";
  if (u.startsWith("/mode")) {
    mode = new URL(u, "http://x").searchParams.get("m") || "normal";
    res.writeHead(200);
    res.end(mode);
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  if (mode === "slow") {
    // 一直推（给"停止"用）—— 60ms 一条，推满 30 条
    let n = 0;
    const iv = setInterval(() => {
      n += 1;
      res.write(`data: {"i":${n}}\n\n`);
      if (n >= 30) {
        clearInterval(iv);
        res.end();
      }
    }, 60);
    return;
  }
  // 三帧，帧间 200ms（于是"第 1 帧到了、第 3 帧还没到"在真机上也可观测）
  res.write('data: {"i":1}\n\n');
  let n = 1;
  const iv = setInterval(() => {
    n += 1;
    if (n <= 3) res.write(`data: {"i":${n}}\n\n`);
    else {
      clearInterval(iv);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }, 200);
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
check(`SSE 服务在宿主机 ${PORT}`, true, `http://127.0.0.1:${PORT}/stream`);
adb("reverse", `tcp:${PORT}`, `tcp:${PORT}`);
adb("reverse", "tcp:8081", "tcp:8081");
check("adb reverse 就绪（8081 与 " + PORT + "）", true);

// ── 3) 拉起应用 + 等界面 ──────────────────────────────────────────────────────
section("启动");
adb("shell", "am", "force-stop", PKG);
adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1");
check(`已拉起 ${PKG}（debug 包从 Metro 拉 bundle）`, true);

/** ⚠️ 每次 dump **先删旧文件** —— dump 失败时会留下**上一次**的 xml，读到陈旧界面就会得出错误结论。 */
function dump() {
  try {
    adb("shell", "rm", "-f", "/sdcard/ui.xml");
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
  } catch {
    /* 偶发失败：下面按空处理，由断言暴露 */
  }
  try {
    return adb("shell", "cat", "/sdcard/ui.xml");
  } catch {
    return "";
  }
}
/**
 * ⚠️ **两种引号都要认** —— `uiautomator dump` 的属性值里**含双引号**时会改用**单引号**：
 *     `<node text='#1 {"i":1}' … />`
 * 只匹配 `text="…"` 的写法会把这类文字读成**空字符串**，症状是"断言说界面上没有，
 * 而屏幕上明明有"（**不报错**）。本文件第一版就栽在这 —— 于是判据自己成了被测物。
 * 同一处坑在 `tools/verify_android.py` 也有，已一并修（见那边的注释）。
 */
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
    out.push({ text: a.text || "", cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 });
  }
  return out;
}
const uiTexts = (xml) => nodes(xml).map((n) => n.text).filter(Boolean).join(" | ");
function tapText(xml, needle) {
  const hit = nodes(xml).find((n) => n.text.includes(needle));
  if (!hit) return false;
  adb("shell", "input", "tap", String(Math.round(hit.cx)), String(Math.round(hit.cy)));
  return true;
}

/**
 * ⚠️ **冷启动必须轮询，而且值得重试一次**：debug 包第一次拉 bundle 时，
 * Metro 可能正好在重新打包（改了 `moobile.js` 之后尤其如此）——
 * 那一次会停在 "Unable to load script"，而**再起一次就好了**。
 * 固定 sleep 或"一次不成即判失败"都会把这种时序问题记成功能缺陷（本仓库在这上面栽过）。
 */
let xml = "";
let up = false;
for (let attempt = 1; attempt <= 2 && !up; attempt++) {
  if (attempt > 1) {
    console.log("     界面没起来，重起一次（冷启动拉 bundle 的时序问题）…");
    adb("shell", "am", "force-stop", PKG);
    await sleep(1500);
    adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1");
  }
  for (let i = 0; i < 25; i++) {
    xml = dump();
    if (uiTexts(xml).includes("SSE 试金石")) {
      up = true;
      break;
    }
    await sleep(2500);
  }
}
check(
  "我们这份 JS 在真机上跑起来了（界面上有「SSE 试金石」）",
  up,
  up ? "" : uiTexts(xml).slice(0, 160),
);
if (!up) {
  console.log("\n================ SSE 真机 汇总 ================");
  console.log("通过 0  失败 1（界面没起来：Metro 的 bundle 拉不到？看 logcat 与 Metro 的输出）");
  server.close();
  process.exit(1);
}
check("初始相位是「空闲」", uiTexts(xml).includes("状态：空闲"), uiTexts(xml).slice(0, 120));

/** 帧序号 —— 只认 `#N`。 */
function framesNow() {
  return [...uiTexts(dump()).matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
}

// ── 4) 剧本一：三帧 + [DONE] ──────────────────────────────────────────────────
section("剧本：三帧 + [DONE]");
await fetch(`http://127.0.0.1:${PORT}/mode?m=normal`);
adb("shell", "input", "tap", "0", "0"); // 唤醒（无害）
xml = dump();
check("找到「连接」按钮并点下去", tapText(xml, "连接"), "");
await sleep(120);
let fr = framesNow();
check(
  "★ 真机上也**边收边长**：第 1 帧到了、第 3 帧还没到",
  fr.includes(1) && !fr.includes(3),
  `帧=${JSON.stringify(fr)}（攒完一次给的话这里会是 [1,2,3]）`,
);
await sleep(1500);
fr = framesNow();
check("三帧全到且按顺序", JSON.stringify(fr) === "[1,2,3]", JSON.stringify(fr));
check("收到 [DONE] 后状态是「完成」", uiTexts(dump()).includes("完成"), uiTexts(dump()).slice(0, 140));

// ── 5) 剧本二：中途停止 ───────────────────────────────────────────────────────
section("剧本：中途「停止」");
await fetch(`http://127.0.0.1:${PORT}/mode?m=slow`);
xml = dump();
tapText(xml, "连接");
await sleep(400);
const beforeStop = framesNow().length;
xml = dump();
check("点「停止」", tapText(xml, "停止"), "");
await sleep(200);
check("状态变成「已停止」", uiTexts(dump()).includes("已停止"), uiTexts(dump()).slice(0, 140));
const atStop = framesNow().length;
await sleep(1200); // 服务端还在推（一共 30 条）
const after = framesNow().length;
check(
  "★ abort 之后**一条都不再出现**（服务端确实还在推）",
  after === atStop,
  `停止时 ${atStop} 条（此前 ${beforeStop}）→ 1.2s 后 ${after} 条`,
);

// ── 6) 汇总 ───────────────────────────────────────────────────────────────────
server.close();
const failed = results.filter((r) => !r.ok);
console.log("\n================ SSE 真机 汇总 ================");
console.log(`通过 ${results.length - failed.length}  失败 ${failed.length}`);
if (failed.length) console.log(failed.map((f) => `  FAIL  ${f.name}`).join("\n"));
process.exit(failed.length ? 1 : 0);
