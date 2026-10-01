#!/usr/bin/env node
// verify.mjs —— C0：**同一份 MoonBit 产物，在"零 Expo"的裸 RN(Web) 宿主下渲染 + 交互**。
//
//   node examples/apps/host-swap-spike/verify.mjs
//
// 为什么要有这个脚本：PLAN §1.2 断言「宿主是可替换件 —— 库与具体 RN 版本无关，也与 Expo 无关」，
// 但 2026-09-20 之前它只有**读代码 + 间接证据**支撑（全文搜 `AppRegistry` 只搜得到
// 「注释里说换成它会怎样」）。这个脚本把那句话变成实测：走一遍**用户那条路**，最后开真 Chrome 看页面。
//
// 六步，每一步都断言（不是「跑完就算」）：
//
//   1. 编产物   `moon build --target js`（在 `examples/apps/template/` 里）
//   2. 搬产物   `moobile-host build --out <这里>/moobile.js`（**发现**产物，不写死 cp）
//   3. 打包     esbuild：把 `react-native` 映射到 `react-native-web`
//               （等价于 Metro / Expo 在 web 平台做的那件事）
//   4. 起服务   就是一个 node http 静态服务 —— **没有 Metro、没有 Expo**
//   5. 开浏览器 真 Chrome（headless + CDP），加载页面
//   6. 断言     渲染出来了 / 输入·添加·勾选·删除都回到 update /
//               **跑的是这一次编的产物**（sha256 在打包时注入，见 `index.js`）
//
// ⚠️ 它**不进 `tools/verify_all.sh`**：要 Chrome + `node_modules`（esbuild / react-native-web），
//    而离线门那条链刻意不依赖浏览器。定位与 `tools/verify_web.js` 一样：**需要本机资源，手动跑**。

import { spawn, spawnSync, execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const TEMPLATE = path.join(ROOT, "examples", "apps", "template");
const CLI = path.join(ROOT, "npm", "moobile-host", "bin", "cli.js");
const EVIDENCE = path.join(ROOT, "docs", "evidence");
const ARTIFACT = path.join(HERE, "moobile.js");
const DIST = path.join(HERE, "dist");
const PORT = Number(process.env.SPIKE_PORT || 8099);
const CDP_PORT = Number(process.env.SPIKE_CDP_PORT || 9232);
const URL_ = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chrome 候选：本机路径各不相同，所以给一张表 + `CHROME` 环境变量覆盖。
 *  ⚠️ Windows 那一档从环境变量拼，**不写盘符字面量** —— `tools/check_public_leaks.py`
 *  会把它当"本机绝对路径"（2026-09-21：那个门补上 `.mjs` 后缀之后，这两行立刻被点名）。 */
const PROGRAM_FILES = process.env['ProgramFiles'];
const PROGRAM_FILES_X86 = process.env['ProgramFiles(x86)'];
const CHROME_CANDIDATES = [
  process.env.CHROME,
  PROGRAM_FILES && path.join(PROGRAM_FILES, "Google/Chrome/Application/chrome.exe"),
  PROGRAM_FILES_X86 && path.join(PROGRAM_FILES_X86, "Google/Chrome/Application/chrome.exe"),
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}
function section(t) {
  console.log(`\n== ${t} ==`);
}
function report() {
  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log("================ C0 裸宿主门汇总 ================");
  console.log(`通过 ${results.length - failed.length}  失败 ${failed.length}`);
  for (const f of failed) console.log("  FAIL  " + f.name);
  process.exit(failed.length ? 1 : 0);
}

/**
 * 环境不够（没装依赖 / 没装 Chrome）—— **这不是"通过"**。
 *
 * 退出码 `2` 专门表示"没验"，让调用方（`verify_all.sh --with-e2e`）把它记成 SKIP 而不是 PASS。
 * 为什么要分这么细：这条门的全部价值就是"真浏览器里渲染出来了"，
 * 拿不到浏览器时**悄悄给个绿**等于把判据作废 —— 本仓库的负面清单第一条就是这个。
 */
function skipOut(reason) {
  console.log(`SKIP  ${reason}`);
  process.exit(2);
}

// ── 0) 前置：这个"零 Expo"的前提是不是真的 ────────────────────────────────────
section("前置：宿主工程里到底有没有 Expo");

let expoResolvable = true;
try {
  await import("expo");
} catch {
  expoResolvable = false;
}
check(
  "这个工程解析不到 expo（`import('expo')` 直接失败）",
  !expoResolvable,
  expoResolvable ? "居然解析到了 —— 那下面的结论就不算数" : "（这正是我们要的前提）",
);

const chrome = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
check("找得到 Chrome（headless + CDP 要用）", Boolean(chrome), chrome || CHROME_CANDIDATES.join(" / "));
if (!chrome) skipOut(`本机没有 Chrome —— 这条门要真浏览器才算数。设 CHROME=<路径> 或装一个再来。`);

// 打包工具也在这里先确认：缺了就别白编一遍产物（SKIP 退出码 2，见 skipOut 的说明）
const esbuild = await import("esbuild").catch(() => null);
if (!esbuild) {
  skipOut("esbuild 没装 —— `cd examples/apps/host-swap-spike && npm install`（本机 npm 若设了 omit=dev，别把它写回 devDependencies）");
}

// ── 1) 编产物（用户那条路的第一步）────────────────────────────────────────────
section("编产物：moon build --target js（在 examples/apps/template 里）");
const build = spawnSync("moon", ["build", "--target", "js"], { cwd: TEMPLATE, encoding: "utf8" });
check(
  "moon build --target js 通过",
  build.status === 0,
  build.status === 0 ? "" : (build.stdout + build.stderr).trim().split("\n").slice(-3).join(" / "),
);
if (build.status !== 0) {
  console.log(build.stdout + build.stderr);
  report();
}

// ── 2) 搬产物（第二步，走 moobile-host build：**发现**而不是写死 cp）──────────
section("搬产物：moobile-host build --out（发现产物，不写死路径）");
const copy = spawnSync(process.execPath, [CLI, "build", "--out", ARTIFACT], {
  cwd: TEMPLATE,
  encoding: "utf8",
});
check("moobile-host build 找到并搬走产物", copy.status === 0, (copy.stdout || "").trim().split("\n")[0] || copy.stderr?.trim());
if (copy.status !== 0) {
  console.log((copy.stdout || "") + (copy.stderr || ""));
  report();
}
const artifactBytes = fs.readFileSync(ARTIFACT);
const sha = crypto.createHash("sha256").update(artifactBytes).digest("hex");
console.log(`      moobile.js ${(artifactBytes.length / 1024).toFixed(0)} KB · sha256 ${sha.slice(0, 16)}…`);

// ── 3) 打包：把 react-native 映射到 react-native-web ──────────────────────────
section("打包：esbuild（react-native → react-native-web）");
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.copyFileSync(path.join(HERE, "index.html"), path.join(DIST, "index.html"));

let built;
try {
  built = await esbuild.build({
    entryPoints: [path.join(HERE, "index.js")],
    bundle: true,
    outfile: path.join(DIST, "bundle.js"),
    platform: "browser",
    format: "iife",
    metafile: true,
    logLevel: "silent",
    // ⚠️ 必须钉住工作目录：**esbuild 的 `alias` 值是按 cwd 解析的**（不是按 import 它的那个文件）。
    //    不写这一行，从仓库根跑 `node examples/apps/host-swap-spike/verify.mjs` 就会红在
    //    `Could not resolve "react-native-web"` —— 而 cd 进这个目录跑却是绿的。
    //    门的定位与 cwd 无关，是它该有的样子（`verify_all.sh` 就是从仓库根调的）。
    absWorkingDir: HERE,
    // ⚠️ 这一行就是"换宿主"的配置面：RN 的 `react-native` 在 web 平台上由
    //    `react-native-web` 顶上 —— Metro / Expo 干的也是这件事，只是藏在预设里。
    alias: { "react-native": "react-native-web" },
    define: {
      "process.env.NODE_ENV": '"development"',
      __ARTIFACT_SHA__: JSON.stringify(sha),
    },
    loader: { ".js": "jsx" },
  });
  check("esbuild 打包成功（零 Expo 的宿主 bundle）", true, `${(fs.statSync(path.join(DIST, "bundle.js")).size / 1024).toFixed(0)} KB`);
} catch (err) {
  check("esbuild 打包成功", false, err.message.split("\n").slice(0, 3).join(" / "));
  report();
}

// 依赖图里到底有哪些包 —— 这是"包里有/没有 Expo"最硬的证据（不看产物文本猜，看输入清单）
const inputs = Object.keys(built.metafile.inputs);
const expoInputs = inputs.filter((p) => /node_modules[\\/]expo(-|$)/.test(p));
const rnwInputs = inputs.filter((p) => /node_modules[\\/]react-native-web[\\/]/.test(p));
const rnInputs = inputs.filter((p) => /node_modules[\\/]react-native[\\/]/.test(p));
check("bundle 的依赖图里**一个 expo 包都没有**", expoInputs.length === 0, expoInputs.slice(0, 3).join(" ") || `共 ${inputs.length} 个输入，0 个 expo`);
check("bundle 里确实有 react-native-web（宿主换成了它）", rnwInputs.length > 0, `${rnwInputs.length} 个文件`);
check("原生 react-native 本体没有被卷进来（只有 web 那一份）", rnInputs.length === 0, rnInputs.slice(0, 2).join(" "));
check(
  "bundle 里没有任何 Metro / Expo 运行时（不是靠它们起的）",
  !inputs.some((p) => /node_modules[\\/](@expo|metro|expo-modules)/.test(p)),
);

// ── 4) 静态服务（node http 就够了）────────────────────────────────────────────
section("起服务：node http 静态服务（没有 Metro、没有 Expo）");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8",
};
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
  const file = path.resolve(DIST, rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});
await new Promise((res, rej) => {
  server.once("error", rej);
  server.listen(PORT, "127.0.0.1", res);
});
check(`静态服务起来了（${URL_}）`, true);

// ── 5) 真 Chrome + CDP ────────────────────────────────────────────────────────
section("开真 Chrome（headless + CDP）");
const profile = path.join(os.tmpdir(), "chrome_c0_" + Date.now());
const chromeProc = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--remote-debugging-port=" + CDP_PORT,
    "--user-data-dir=" + profile,
    "about:blank",
  ],
  { stdio: "ignore" },
);
const killAll = () => {
  try {
    server.close();
  } catch {}
  try {
    if (process.platform === "win32") execSync(`taskkill /PID ${chromeProc.pid} /T /F`, { stdio: "ignore" });
    else chromeProc.kill("SIGKILL");
  } catch {}
};
process.on("exit", killAll);

let targets = [];
for (let i = 0; i < 80; i++) {
  await sleep(250);
  try {
    targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
    if (targets.length) break;
  } catch {}
}
const page = targets.find((t) => t.type === "page");
check("Chrome 起来了（CDP 连得上）", Boolean(page));
if (!page) report();

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let msgId = 0;
const pending = new Map();
const problems = [];
// 控制台**全部**类型的输出都留着：白屏排查靠的就是它（本仓库为此专门有个 tools/console_dump.js）。
// 只在"页面什么都没渲染出来"时打出来，避免正常跑的时候刷屏。
const consoleLog = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.consoleAPICalled") {
    const line = msg.params.args.map((a) => a.value ?? a.description).join(" ");
    consoleLog.push(`${msg.params.type}: ${line}`);
    if (msg.params.type === "error") problems.push("console.error: " + line.slice(0, 300));
  } else if (msg.method === "Runtime.exceptionThrown") {
    // ⚠️ 先打**消息正文**再打栈：CDP 的 exceptionDetails 里 `exception.description` 排在
    //    `stackTrace` **后面**，只 dump JSON 再截断的话，最该看的那句话正好被切掉
    //    （第一版就是这样，只看到 `exception: {...$panic...}`，看不到它在抱怨什么）。
    const d = msg.params.exceptionDetails;
    const msgText = (d.exception?.description || d.text || "").split("\n").slice(0, 6).join(" / ");
    const top = d.stackTrace?.callFrames?.slice(0, 3).map((f) => f.functionName).join(" ← ") || "?";
    problems.push(`exception: ${msgText.slice(0, 500)}  [${top}]`);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++msgId;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: URL_ });

const evalJs = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description || "eval 出错" };
  return r.result?.result?.value;
};
const bodyText = async () => (await evalJs("document.body.innerText")) || "";

// 等首屏：轮询 DOM 文本（不 sleep 定长 —— 定长等待是本仓库记过的坑）
let firstText = "";
for (let i = 0; i < 60; i++) {
  firstText = await bodyText();
  if (firstText.includes("待办")) break;
  await sleep(250);
}

// ── 6) 断言：渲染 / 交互 / 新鲜度 ─────────────────────────────────────────────
section("断言：渲染出来了（真浏览器里的 DOM）");
console.log("--- 首屏 innerText ---");
console.log(firstText.trim() || "（空）");
console.log("----------------------");

check("宿主自报身份 = bare-rnw（不是 Expo 那条路）", (await evalJs("globalThis.__HOST_KIND__")) === "bare-rnw");
const renderedTitle = firstText.includes("待办");
check("首屏渲染出标题「待办」", renderedTitle);
if (!renderedTitle) {
  // 白屏时把现场交出来：页面文本 + 控制台（全部类型）
  console.log(`      页面没有渲染出内容 —— 控制台输出（最多 8 条）：`);
  if (consoleLog.length) for (const l of consoleLog.slice(0, 8)) console.log("        " + l.slice(0, 300));
  else console.log("        （一条都没有）");
}
check("首屏渲染出计数行「还有 0 件」", firstText.includes("还有 0 件"), firstText.split("\n")[0]);
check(
  "DOM 是 react-native-web 渲染的（#root 里有实际节点 + 内联样式类名）",
  Boolean(await evalJs(`(() => { const r = document.getElementById('root'); return r && r.children.length > 0 && r.innerHTML.length > 200; })()`)),
);

check(
  "跑的是**这一次**编的产物（页面上的 sha256 == 磁盘上那份）",
  (await evalJs("globalThis.__ARTIFACT_SHA__")) === sha,
  sha.slice(0, 16) + "…",
);

section("断言：交互真的回到 MoonBit 的 update");
const centerOfSelector = async (selector) =>
  evalJs(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
const centerOfText = async (label) =>
  evalJs(`(() => {
    const all = [...document.querySelectorAll('*')].filter((e) => e.textContent.trim() === ${JSON.stringify(label)});
    if (!all.length) return null;
    const el = all[all.length - 1];
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
async function clickAt(pt) {
  if (!pt || pt.__err) return false;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pt.x, y: pt.y, button: "none" });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
  await sleep(60);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
  await sleep(500);
  return true;
}
const clickText = async (label) => clickAt(await centerOfText(label));

// 输入 + 添加（证明 TextInput 的 onChangeText 与 button 的 onPress 两条线都通）
const inputPt = await centerOfSelector('input[placeholder="要做点什么？"]');
check("找到输入框", Boolean(inputPt) && !inputPt.__err);
await clickAt(inputPt);
await send("Input.insertText", { text: "在裸宿主里写的第一条" });
await sleep(400);
check(
  "输入被 MoonBit 收下并回灌 value",
  (await evalJs("document.querySelector('input')?.value")) === "在裸宿主里写的第一条",
  JSON.stringify(await evalJs("document.querySelector('input')?.value")),
);
check("点到了「添加」", await clickText("添加"));
let t = await bodyText();
check("新增生效（还有 1 件）", t.includes("还有 1 件"), t.split("\n").find((l) => l.includes("还有")));
check("新条目在列表里", t.includes("在裸宿主里写的第一条"));
check("输入框被清空", (await evalJs("document.querySelector('input')?.value")) === "");

// 勾选：**按结构定位**，不靠 role 属性。
// ⚠️ 这里连踩两次（都记在 FINDINGS 里）：① RNW 这一版没给 Pressable 加 `role="button"`；
//    ② RNW 把 `<Text>` 渲染成 **div + 内层 span 两层** —— 所以「文本最内层元素」比想象中深一级，
//    它的 `parentElement` 是文本自己那一层，不是行。
// 稳定的走法：从最内层往上找到**最近一个同时包含「删」的祖先**（那才是这一行），
// 行的第一个子元素就是勾选按钮（`app.mbt` 的 `item_row` 是 `[勾选, 文本, 删]` 三件）。
const TOGGLE_PROBE = `(() => {
  const TXT = '在裸宿主里写的第一条';
  const innermost = [...document.querySelectorAll('*')].filter((e) => e.textContent.trim() === TXT && e.children.length === 0).pop();
  let row = innermost;
  while (row && !row.textContent.includes('删')) row = row.parentElement;
  const btn = row && row.firstElementChild;
  if (!btn) return { __err: '没找到行/按钮', html: innermost ? innermost.outerHTML.slice(0, 300) : null };
  const r = btn.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, html: row.outerHTML.slice(0, 300) };
})()`;
const togglePt = await evalJs(TOGGLE_PROBE);
const toggleOk = Boolean(togglePt) && !togglePt.__err && togglePt.w > 0 && togglePt.h > 0;
check("找到了这一行的勾选按钮", toggleOk, toggleOk ? `${togglePt.w}×${togglePt.h}` : JSON.stringify(togglePt).slice(0, 300));
if (!toggleOk) console.log("      这一行的 HTML：" + (togglePt?.html || "（拿不到）"));
await clickAt(togglePt);
t = await bodyText();
const toggled = t.includes("还有 0 件");
check("勾选生效（还有 1 件 → 还有 0 件）", toggled, t.split("\n").find((l) => l.includes("还有")));
if (!toggled) {
  // 失败就把现场打出来（元素尺寸能直接看出"点到的是按钮还是文本"）
  console.log(`      点到的那块：${togglePt.w}×${togglePt.h} @ (${Math.round(togglePt.x)},${Math.round(togglePt.y)})`);
  console.log("      这一行的 HTML：" + (togglePt.html || "（拿不到）"));
  console.log("      #root 的结构：\n" + String(await evalJs("document.getElementById('root').innerHTML")).slice(0, 1500));
}

// 删除
check("点到了「删」", await clickText("删"));
t = await bodyText();
check("删除生效（条目消失）", !t.includes("在裸宿主里写的第一条"), t.split("\n").find((l) => l.includes("还有")));

check("页面全程没有 console.error / 未捕获异常", problems.length === 0, problems.slice(0, 2).join(" | "));

// 证据：截图（与 tools/verify_web.js 一样落到 docs/evidence/）
try {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (shot.result?.data) {
    const file = path.join(EVIDENCE, "shot-c0-bare-host.png");
    fs.writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    console.log(`      截图：${path.relative(ROOT, file)}`);
  }
} catch {
  /* 截图只是证据，失败不影响结论 */
}

report();
