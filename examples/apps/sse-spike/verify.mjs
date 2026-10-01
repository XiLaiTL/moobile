#!/usr/bin/env node
// verify.mjs —— **SSE 通道**的无头判据（不需要浏览器、不需要 Metro、不需要 APK）。
//
//   node examples/apps/sse-spike/verify.mjs            # 约 2 秒
//
// 它做两件事：起一个**本地 SSE 服务**（几种剧本），然后把编译好的应用产物 import 进 node、
// 点「连接」，读界面文字判断 —— 与 `tools/verify_headless.mjs` 同一套路子。
//
// ── 为什么非得是"真界面文字"而不是直接调 `@sse` ────────────────────────────────
//
// 这条通道横跨四层：**MoonBit 的 Cmd → 编译出来的 JS → 网络 → 消息回到 update → 重新渲染**。
// 只测其中一层都会漏掉真正的坑：
//   · 只测 JS 侧解析 → 漏掉"消息根本没到 update"（`Emit[Msg]` 返回的是 **Cmd**，
//     不把它交给 scheduler，消息是**静默丢掉**的 —— 这个坑本仓库栽过，见 `sse/sse.mbt`）；
//   · 只测 MoonBit 侧 → 漏掉分帧（一帧被网络切成两半）。
// ⇒ 判据的落点是**界面上那几行字**：它们既是渲染结果，也是状态机的输出。
//
// ── 判据清单（每一条都能被你亲手证伪，见文末"怎么证伪"）────────────────────────
//
//   1. 每一帧**单独**出现，且**按顺序**（`#1` `#2` `#3`）
//   2. **边收边长**：第 1 帧到的时候，第 3 帧**还不该在**（这是"流式"与"攒完一次给"的分界）
//   3. 一帧被切成两半（两个 TCP 写）也要拼回**一条**，不能变成两条
//   4. 两帧挤在一次读取里 → 仍然是**两条**
//   5. `[DONE]` → `完成`，且**不再有任何新行**
//   6. HTTP 500 → `失败：HTTP 500`
//   7. 停掉（abort）→ 之后再推的帧**一条都不出现**（服务端确实推了，客户端不该收）
//   8. 非 SSE 的响应体 → **一行都不出现**（负例：解析器不能瞎猜）

import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");

// ── 0) 依赖：react 与宿主 core 都从**已安装**的那份里取（与 verify_headless 同一策略）──
const CANDIDATES = [
  path.join(HERE, "node_modules"),
  path.join(ROOT, "examples/apps/todo-app/host/node_modules"),
  path.join(ROOT, "examples/apps/antd-spike/host/node_modules"),
];
function pick(need) {
  for (const d of CANDIDATES) if (existsSync(path.join(d, need))) return d;
  console.log(`SKIP  找不到装了 \`${need}\` 的 node_modules（先在一个应用里 npm install）`);
  process.exit(2);
}
const req = createRequire(path.join(pick("react"), "noop.cjs"));
const React = req("react");
const core = await import(
  pathToFileURL(path.join(pick("moobile-host"), "moobile-host", "core.js")).href
);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}

// ── 1) 本地 SSE 服务：几种剧本 ────────────────────────────────────────────────
//
// ⚠️ 每个剧本都**刻意控制写出的时机** —— "边收边长"这条判据只能靠"服务端还没发后面几帧"
//    来证明；如果服务端一口气全写完，客户端攒不攒包都看不出来。
let timer = null;
const server = createServer((req_, res) => {
  const route = req_.url || "/stream";
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (s) => res.write(s);
  if (route === "/split") {
    // 一帧被切成两半：先写一半，隔一拍再写另一半
    send('data: {"i":1}\n');
    timer = setTimeout(() => {
      send('\ndata: {"i":2}\n\ndata: [DONE]\n\n');
      res.end();
    }, 120);
    return;
  }
  if (route === "/burst") {
    // 两帧挤在一次写里
    send('data: {"i":1}\n\ndata: {"i":2}\n\ndata: [DONE]\n\n');
    res.end();
    return;
  }
  if (route === "/nosse") {
    // 负例：不是 SSE（没有 data: 帧）
    send("这不是 SSE，只是一段普通文本。");
    res.end();
    return;
  }
  if (route === "/slow") {
    // 给 abort 用：慢慢推，客户端会在中途停掉
    let n = 0;
    timer = setInterval(() => {
      n += 1;
      send(`data: {"i":${n}}\n\n`);
      if (n >= 20) {
        clearInterval(timer);
        res.end();
      }
    }, 60);
    return;
  }
  // 默认剧本：三帧，**帧之间隔 150ms**（于是"第 1 帧到了、第 3 帧还没到"是可观测的）
  send('data: {"i":1}\n\n');
  let n = 1;
  timer = setInterval(() => {
    n += 1;
    if (n <= 3) send(`data: {"i":${n}}\n\n`);
    else {
      clearInterval(timer);
      send("data: [DONE]\n\n");
      res.end();
    }
  }, 150);
});
server.on("error", (e) => {
  console.log(`SKIP  起不了本地服务：${e.message}`);
  process.exit(2);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const URL_ = (p) => `http://127.0.0.1:${PORT}${p}`;
console.log(`本地 SSE 服务：${URL_("/stream")}`);

// ── 2) 起应用 ─────────────────────────────────────────────────────────────────
const ARTIFACTS = [
  path.join(ROOT, "_build/js/debug/build/sse-spike/sse-spike.js"),
  path.join(ROOT, "_build/js/release/build/sse-spike/sse-spike.js"),
];
function locate() {
  return ARTIFACTS.find((p) => existsSync(p));
}
let artifact = locate();
if (!artifact) {
  // ⚠️ 产物不在就先**自己构建一次**：这条门要能在 CI（新鲜克隆、没有 `_build`）里真跑，
  //    否则它就永远是一条 SKIP —— 而"永远跳过"的门等于没有（本仓库记过这条）。
  console.log("产物不在，先 `moon build --target js` …");
  const r = spawnSync("moon", ["build", "--target", "js"], { cwd: ROOT, stdio: "inherit" });
  artifact = locate();
  if (!artifact) {
    console.log(
      `SKIP  构建后仍找不到产物（moon 退出码 ${r.status}）—— 先在仓库根跑：moon build --target js`,
    );
    process.exit(2);
  }
}
if (typeof globalThis.window === "undefined") {
  globalThis.window = {
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };
}
const h = React.createElement;
const tag = (n) => ({ children, ...rest }) => h(n, rest, children);
const COMPONENTS = {
  View: ({ children, style, ...r }) => h("div", { style, ...r }, children),
  Text: ({ children, style, ...r }) => h("span", { style, ...r }, children),
  Pressable: tag("button"),
  TextInput: tag("input"),
  ScrollView: ({ children, style, ...r }) => h("div", { style, ...r }, children),
};
core.installHostCore({ react: React, components: COMPONENTS, platform: "web", apiBase: "" });

const mod = await import(pathToFileURL(artifact).href);
const handles = mod.app();
core.checkContract(handles);
handles.start();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function texts(node, out = []) {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const c of node) texts(c, out);
    return out;
  }
  if (typeof node === "object" && node.props) texts(node.props.children, out);
  return out;
}
const TREE = () => texts(handles.element()).join(" | ");
function findBtn(label) {
  let hit = null;
  const walk = (n) => {
    if (!n || typeof n !== "object" || !n.props) return;
    const t = texts(n).join("");
    if (typeof n.props.onPress === "function" && t.includes(label) && !hit) hit = n;
    const k = n.props.children;
    for (const c of Array.isArray(k) ? k : [k]) walk(c);
  };
  walk(handles.element());
  assert.ok(hit, `界面上找不到「${label}」按钮；当前：${TREE().slice(0, 200)}`);
  return hit;
}
/** 帧的序号 —— 判据只认 `#N`，不认帧内容（内容随剧本变）。 */
function frames() {
  return [...TREE().matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
}

// ── 3) 剧本一：正常三帧 + [DONE] ──────────────────────────────────────────────
console.log("\n── 剧本 /stream：三帧 + [DONE] " + "─".repeat(28));
globalThis.__SSE_SPIKE_URL = URL_("/stream");
findBtn("连接").props.onPress();
await sleep(80);
check("点「连接」后进入「接收中」", TREE().includes("接收中"), TREE().slice(0, 120));
check("第 1 帧已经到了（还没等到全部）", frames().includes(1), `帧=${JSON.stringify(frames())}`);
check(
  "★ 边收边长：第 3 帧**还没**到（攒完一次给的话它已经到了）",
  !frames().includes(3),
  `帧=${JSON.stringify(frames())}`,
);
await sleep(700);
check("三帧全到且按顺序", JSON.stringify(frames()) === "[1,2,3]", JSON.stringify(frames()));
check("[DONE] 之后状态是「完成」", TREE().includes("完成"), TREE().slice(0, 120));
const settled = TREE();
await sleep(250);
check("完成之后不再冒新行（流真的收尾了）", TREE() === settled);

// ── 4) 剧本二：一帧被切成两半 / 两帧挤在一起 ──────────────────────────────────
console.log("\n── 剧本 /split：一帧切成两半 " + "─".repeat(30));
globalThis.__SSE_SPIKE_URL = URL_("/split");
findBtn("连接").props.onPress();
await sleep(500);
check(
  "★ 半帧被拼回**一条**（不是两条）",
  JSON.stringify(frames()) === "[1,2]",
  `帧=${JSON.stringify(frames())}（拆错了会是 1,1,2 这种）`,
);

console.log("\n── 剧本 /burst：两帧挤在一次写里 " + "─".repeat(26));
globalThis.__SSE_SPIKE_URL = URL_("/burst");
findBtn("连接").props.onPress();
await sleep(400);
check("★ 一次读取里的两帧被拆成**两条**", JSON.stringify(frames()) === "[1,2]", `帧=${JSON.stringify(frames())}`);

// ── 5) 剧本三：错误路径与负例 ─────────────────────────────────────────────────
console.log("\n── 剧本 /nosse：响应体不是 SSE（负例）" + "─".repeat(22));
globalThis.__SSE_SPIKE_URL = URL_("/nosse");
findBtn("连接").props.onPress();
await sleep(400);
check("★ 负例：非 SSE 的响应**一行都不出**", frames().length === 0, `帧=${JSON.stringify(frames())}`);

console.log("\n── 剧本 /500：HTTP 错误 " + "─".repeat(34));
// 让服务端这个路由直接回 500（临时换一个 handler）
server.removeAllListeners("request");
server.on("request", (_q, res) => {
  res.writeHead(500, { "Content-Type": "text/plain" });
  res.end("boom");
});
globalThis.__SSE_SPIKE_URL = URL_("/anything");
findBtn("连接").props.onPress();
await sleep(400);
check("★ HTTP 500 → 「失败：HTTP 500」", TREE().includes("失败：HTTP 500"), TREE().slice(0, 160));

// ── 6) 剧本四：abort ──────────────────────────────────────────────────────────
console.log("\n── 剧本 /slow：中途「停止」 " + "─".repeat(30));
server.removeAllListeners("request");
server.on("request", (q, res) => {
  if ((q.url || "") !== "/slow") {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  let n = 0;
  const iv = setInterval(() => {
    n += 1;
    res.write(`data: {"i":${n}}\n\n`);
    if (n >= 20) {
      clearInterval(iv);
      res.end();
    }
  }, 60);
});
globalThis.__SSE_SPIKE_URL = URL_("/slow");
findBtn("连接").props.onPress();
await sleep(200);
const beforeStop = frames().length;
findBtn("停止").props.onPress();
await sleep(120);
check("点「停止」后状态是「已停止」", TREE().includes("已停止"), TREE().slice(0, 120));
const atStop = frames().length;
await sleep(700); // 服务端还在推（它一共推 20 条）
check(
  "★ abort 之后**一条都不再出现**（服务端确实还在推）",
  frames().length === atStop,
  `停止时 ${atStop} 条（此前 ${beforeStop}），700ms 后 ${frames().length} 条`,
);

// ── 7) 汇总 ───────────────────────────────────────────────────────────────────
clearInterval(timer);
server.close();
const failed = results.filter((r) => !r.ok);
console.log("\n================ SSE 通道 汇总 ================");
console.log(`通过 ${results.length - failed.length}  失败 ${failed.length}`);
if (failed.length) {
  console.log(failed.map((f) => `  FAIL  ${f.name}`).join("\n"));
}
// ⚠️ 显式退出：不退出的进程会被超时杀掉，而被杀不执行清理（本仓库踩过）。
process.exit(failed.length ? 1 : 0);
