#!/usr/bin/env node
// verify.mjs —— **chat-app 的无头判据**（不需要浏览器、不需要 Metro、不需要 APK、不需要真 key）。
//
//   node examples/apps/chat-app/verify.mjs          # 约 3 秒
//
// 它做三件事：
//   1. 起一个**假的 OpenAI 兼容服务**（`POST /v1/chat/completions`，`stream: true` 时吐 SSE）；
//   2. 给宿主一个**假的 `MOBILE_HOST.db`**（内存版，SQL 语句按文本认 —— 见下面注释）；
//   3. 把编译好的应用产物 import 进来，**当成用户在操作**：填设置 → 打字 → 发送 → 读界面文字。
//
// ── 为什么"假 db"不算作弊 ─────────────────────────────────────────────────────
//
// `@sqlite` 与宿主之间的边界是**三个函数 + JSON 字符串**（`sqlite/sqlite.mbt` 文件头写了）：
//     MOBILE_HOST.db.exec(sql) / run(sql, paramsJson) / all(sql, paramsJson)
// 真机上是 `expo-sqlite`，web 上是 wasm 版，**node 里没有 SQLite**。所以这里给它一个
// **内存实现**：它不是"把被测物换掉"，而是**换一个宿主实现** —— 正是"宿主是可替换件"这条设计的用法。
// 而且它让一条判据变得可测：**把应用重建一次，历史还在**（内存实现活过重建）——
// 这条用真 SQLite 反而不好测。
//
// 它**按 SQL 文本认语句**（应用一共就发那几条），不解析 SQL —— 后者是另一个项目。

import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 0) 依赖（react / 宿主 core 都从**已安装**的那份取，与 verify_headless 同一策略）──
const CANDIDATES = [
  path.join(HERE, "node_modules"),
  path.join(ROOT, "examples/apps/todo-app/host/node_modules"),
  path.join(ROOT, "examples/apps/antd-spike/host/node_modules"),
];
function pick(need) {
  for (const d of CANDIDATES) if (existsSync(path.join(d, need))) return d;
  console.log(`SKIP  找不到装了 \`${need}\` 的 node_modules（先在某个应用里 npm install）`);
  process.exit(2);
}
const req = createRequire(path.join(pick("react"), "noop.cjs"));
const React = req("react");
const core = await import(
  pathToFileURL(path.join(pick("moobile-host"), "moobile-host", "core.js")).href
);

// ── 1) 假的 `MOBILE_HOST.db`（内存版宿主实现）──────────────────────────────────
/** 每次 `run_boot()` 之前清空；跨 boot 保留 —— 这就是"重启还在"那条判据。 */
const store = { bubbles: [], settings: new Map(), nextId: 1 };
function makeDb() {
  return {
    exec: async () => undefined,
    run: async (sql, paramsJson) => {
      const args = JSON.parse(paramsJson || "[]");
      if (sql.startsWith("INSERT INTO bubble")) {
        store.bubbles.push({ id: store.nextId++, role: args[0], text: args[1] });
      } else if (sql.startsWith("DELETE FROM bubble")) {
        store.bubbles = [];
      } else if (sql.startsWith("INSERT OR REPLACE INTO setting")) {
        store.settings.set(args[0], args[1]);
      } else {
        throw new Error("假的 db 不认这条 SQL：" + sql);
      }
      return JSON.stringify({ changes: 1, last_insert_row_id: store.nextId - 1 });
    },
    all: async (sql) => {
      if (sql.includes("FROM bubble")) return JSON.stringify(store.bubbles);
      if (sql.includes("FROM setting")) {
        return JSON.stringify([...store.settings].map(([k, v]) => ({ k, v })));
      }
      throw new Error("假的 db 不认这条 SQL：" + sql);
    },
  };
}
globalThis.MOBILE_HOST = { db: makeDb() };

// ── 2) 假的 OpenAI 兼容服务 ───────────────────────────────────────────────────
//
// 路由：`POST /v1/chat/completions`。行为由 `/mode?m=…` 切换（判据自己控制）：
//   ok     —— 正常：逐字吐 SSE，最后一帧 [DONE]
//   unauth —— 401（key 错）
//   slow   —— 一直吐（给"停止"用）
//   nosse  —— 200 但响应体不是 SSE（负例）
//   inframe—— 200 的流里塞一条 error 帧（有些网关这么干）
let mode = "ok";
let seenAuth = null;
let seenBody = null;
const server = createServer((q, res) => {
  const url = q.url || "/";
  if (url.startsWith("/mode")) {
    mode = new URL(url, "http://x").searchParams.get("m") || "ok";
    res.writeHead(200);
    res.end(mode);
    return;
  }
  if (url.startsWith("/seen")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ auth: seenAuth, body: seenBody }));
    return;
  }
  let raw = "";
  q.on("data", (c) => (raw += c));
  q.on("end", () => {
    seenAuth = q.headers["authorization"] || null;
    seenBody = raw;
    if (mode === "unauth") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end('{"error":{"message":"Invalid API key"}}');
      return;
    }
    if (mode === "nosse") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"choices":[{"message":{"content":"不是流式"}}]}');
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    if (mode === "inframe") {
      // 200 的流里塞一条错误帧 —— 应用必须把它当**错误**，而不是"AI 没说话"
      res.write('data: {"error":{"message":"quota exceeded"}}\n\n');
      res.end("data: [DONE]\n\n");
      return;
    }
    const text = mode === "slow" ? "这是一段很长的回复".repeat(20) : "你好，我是助手。";
    const chars = [...text];
    let i = 0;
    const iv = setInterval(() => {
      if (i >= chars.length) {
        clearInterval(iv);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chars[i] } }] })}\n\n`);
      i += 1;
    }, mode === "slow" ? 120 : 25);
    // ⚠️ 挂在 **`res`** 上而不是 `q` 上：`req` 的 `close` 在**请求体读完**时就触发了
    //    （POST 发完即触发），挂错地方会**当场清掉定时器 → 一帧都不发**。
    //    第一版就这么写的：症状是"应用永远停在生成中"，而判据第一眼读成了应用的问题。
    res.on("close", () => clearInterval(iv));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const URL_ = (p) => `http://127.0.0.1:${PORT}${p}`;
console.log(`假的 OpenAI 兼容服务：${URL_("/v1/chat/completions")}`);

// ── 3) 起应用（可重建 —— "重启还在"那条判据要用两次）──────────────────────────
const ARTIFACTS = [
  path.join(ROOT, "_build/js/debug/build/chat-app/chat-app.js"),
  path.join(ROOT, "_build/js/release/build/chat-app/chat-app.js"),
];
function locate() {
  return ARTIFACTS.find((p) => existsSync(p));
}
if (!locate()) {
  console.log("产物不在，先 `moon build --target js` …");
  spawnSync("moon", ["build", "--target", "js"], { cwd: ROOT, stdio: "inherit" });
}
const artifact = locate();
if (!artifact) {
  console.log("SKIP  构建后仍找不到产物 —— 先在仓库根跑：moon build --target js");
  process.exit(2);
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

async function boot() {
  const mod = await import(pathToFileURL(artifact).href);
  const handles = mod.app();
  core.checkContract(handles);
  handles.start();
  await sleep(60); // 等首次"读库"那条 Cmd 落定
  return handles;
}

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
function walk(node, fn) {
  if (!node || typeof node !== "object" || !node.props) return;
  fn(node);
  const k = node.props.children;
  for (const c of Array.isArray(k) ? k : [k]) walk(c, fn);
}
function findEl(pred) {
  let hit = null;
  walk(handlesRef.element(), (n) => {
    if (!hit && pred(n, texts(n).join(""))) hit = n;
  });
  assert.ok(hit, `界面上找不到：${desc}`);
  return hit;
}

// 当前这一次 boot 的句柄（`findEl` 用）
let handlesRef = null;
let desc = "";
function button(label) {
  desc = `按钮「${label}」`;
  return findEl((n, t) => typeof n.props.onPress === "function" && t.includes(label));
}
function inputAt(i) {
  desc = `第 ${i + 1} 个输入框`;
  const all = [];
  walk(handlesRef.element(), (n) => {
    if (typeof n.props.onChangeText === "function") all.push(n);
  });
  assert.ok(all[i], `界面上没有第 ${i + 1} 个输入框（一共 ${all.length} 个）`);
  return all[i];
}
const TREE = () => texts(handlesRef.element()).join(" | ");
/** 助手那条气泡的文字（去掉正在生成的光标）。判"长到一半"只能这么读 —— 正则要求整句。 */
function assistantText() {
  const parts = TREE().split(" | ");
  const i = parts.lastIndexOf("AI");
  return i >= 0 ? (parts[i + 1] || "").replace("▍", "") : "";
}
const has = (s) => TREE().includes(s);

// ── 4) 剧本一：第一次打开 → 没有 key → 落在设置页 ─────────────────────────────
console.log("\n── 首次打开（没有 key）" + "─".repeat(40));
handlesRef = await boot();
check("★ 没有 key 时落在**设置页**（而不是让他先撞一次 401）", has("设置") && has("Base URL"), TREE().slice(0, 140));

console.log("\n── 填设置并保存" + "─".repeat(44));
inputAt(0).props.onChangeText(URL_("/v1"));
await sleep(20);
inputAt(1).props.onChangeText("sk-test-123");
await sleep(20);
inputAt(2).props.onChangeText("test-model");
await sleep(20);
button("保存").props.onPress();
await sleep(80);
check("保存后回到聊天页（出现输入框与「发送」）", has("发送") && has("对话"), TREE().slice(0, 140));

console.log("\n── 发一条消息，看它**逐字长出来**" + "─".repeat(28));
inputAt(0).props.onChangeText("你好");
await sleep(20);
button("发送").props.onPress();
await sleep(150);
const early = TREE();
const grew = assistantText().length;
check("用户那条气泡在界面上", early.includes("你好"), early.slice(0, 160));
check(
  "★ 助手已经开始长字了，但**还没长完**",
  grew > 0 && grew < 8,
  `此刻「${assistantText()}」= ${grew} 字（攒完一次给的话这里会是 8）`,
);
check("生成中看得出来（状态行「生成中…」+ 光标）", early.includes("生成中") && early.includes("▍"), "");
await sleep(700);
check("长完了：全文在界面上", has("你好，我是助手。"), TREE().slice(-160));
check("收尾后状态行不再说「生成中」", !has("生成中"), TREE().slice(-120));

console.log("\n── 请求发对了没（Authorization / body）" + "─".repeat(22));
const seen = await (await fetch(URL_("/seen"))).json();
check("带了 Authorization: Bearer（用设置里填的那个 key）", seen.auth === "Bearer sk-test-123", String(seen.auth));
const body = JSON.parse(seen.body || "{}");
check("body 里 stream=true", body.stream === true, JSON.stringify(body).slice(0, 120));
check("body 里 model 用了设置里的值", body.model === "test-model", String(body.model));
check(
  "发给模型的消息里**不含**那条空的助手占位",
  Array.isArray(body.messages) && body.messages.length === 1 && body.messages[0].content === "你好",
  JSON.stringify(body.messages).slice(0, 140),
);

// ── 5) 剧本二：重启之后历史还在 ───────────────────────────────────────────────
console.log("\n── 重启（重建应用实例，同一个库）" + "─".repeat(22));
handlesRef = await boot();
check(
  "★ 重开之后历史还在（用户那条 + 助手那条）",
  has("你好") && has("你好，我是助手。"),
  TREE().slice(0, 200),
);
check("重启后不再落在设置页（key 已存）", has("发送"), TREE().slice(0, 120));

// ── 6) 剧本三：停止 ───────────────────────────────────────────────────────────
console.log("\n── 中途「停止」" + "─".repeat(48));
await fetch(URL_("/mode?m=slow"));
inputAt(0).props.onChangeText("再问一次");
await sleep(20);
button("发送").props.onPress();
await sleep(300);
const midLen = TREE().length;
// ⚠️ 先确认**真的在长** —— 否则"停止后不再变长"在"什么都没发生"时也成立（**假通过**）。
check("停止之前流确实在长（否则下面那条是假通过）", midLen > 0 && has("▍"), `此刻 ${midLen} 字`);
button("停止").props.onPress();
await sleep(120);
const atStop = TREE().length;
check("停止后按钮回到「发送」", has("发送") && !has("停止"), TREE().slice(-120));
await sleep(600); // 服务端还在吐
check(
  "★ abort 之后界面**不再变长**（服务端确实还在推）",
  TREE().length === atStop,
  `停止时 ${atStop}，600ms 后 ${TREE().length}（此前在涨：${midLen}）`,
);

// ── 7) 剧本四：错误路径 ───────────────────────────────────────────────────────
console.log("\n── 401（key 错了）" + "─".repeat(44));
await fetch(URL_("/mode?m=unauth"));
inputAt(0).props.onChangeText("触发 401");
await sleep(20);
button("发送").props.onPress();
await sleep(400);
check("★ 401 显示在界面上（不白屏、不静默）", has("出错：HTTP 401"), TREE().slice(-200));

console.log("\n── 200 的流里塞一条 error 帧" + "─".repeat(28));
await fetch(URL_("/mode?m=inframe"));
inputAt(0).props.onChangeText("触发错误帧");
await sleep(20);
button("发送").props.onPress();
await sleep(400);
check(
  "★ 错误帧被当成错误（而不是「AI 一个字没说」）",
  has("出错：quota exceeded"),
  TREE().slice(-200),
);

console.log("\n── 负例：200 但响应体不是 SSE" + "─".repeat(26));
await fetch(URL_("/mode?m=nosse"));
inputAt(0).props.onChangeText("触发非流式");
await sleep(20);
button("发送").props.onPress();
await sleep(400);
check(
  "★ 非 SSE 的响应：助手那条是空的，但**应用没崩、也没乱写**",
  has("对话") && !has("不是流式"),
  TREE().slice(-200),
);

// ── 8) 剧本五：清空 ───────────────────────────────────────────────────────────
console.log("\n── 清空" + "─".repeat(56));
button("清空").props.onPress();
await sleep(150);
check("界面上消息没了", !has("触发 401") && !has("你好，我是助手。"), TREE().slice(0, 160));
check("库里也空了", store.bubbles.length === 0, `库里 ${store.bubbles.length} 条`);

// ── 9) 汇总 ───────────────────────────────────────────────────────────────────
server.close();
const failed = results.filter((r) => !r.ok);
console.log("\n================ chat-app 无头判据 汇总 ================");
console.log(`通过 ${results.length - failed.length}  失败 ${failed.length}`);
if (failed.length) console.log(failed.map((f) => `  FAIL  ${f.name}`).join("\n"));
process.exit(failed.length ? 1 : 0);
