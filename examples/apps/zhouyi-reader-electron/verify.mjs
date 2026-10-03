#!/usr/bin/env node
// verify.mjs —— **桌面端（Electron 窗口）的判据**。
//
//   cd examples/apps/zhouyi-reader-electron
//   npm install          # electron 的二进制走 npmmirror（见 README 的"装不上怎么办"）
//   node verify.mjs
//
// ## 它答的问题与 `../zhouyi-reader-desktop/` 那条**不一样**
//
// | 门 | 答的问题 |
// |---|---|
// | `../zhouyi-reader-desktop/verify.mjs`（5 项） | 同一份产物能不能进 **React Native 的原生宿主**（`--host rnw`；本机缺 VS 工具链，只到"打得进 bundle"） |
// | **本文件** | **桌面端能不能真的跑起来给人用** —— 起窗口、渲染、点得动（本机就能验，不需要 VS） |
//
// ## 判据分三层，第三层是重点
//
//   A. **窗口真的起来了**：Electron 进程活着、CDP 上有一个 `page` target、窗口尺寸就是我们要的、
//      标题是应用名（不是 `index.html` 那种默认值）。
//   B. **产物面**：这个窗口加载的是**这一次**编的 `dist/`（服务端指纹 = 磁盘 `moobile.js` 的 sha256），
//      而且依赖图里没有 expo / Metro。
//   C. ★ **把应用自己那 99 条界面判据原样打在这个窗口上** —— 走 `PROBE_CDP_URL` 附着模式
//      （`../zhouyi-reader/verify.mjs` 支持附着到别人的 CDP 端点）。于是"换宿主之后界面行为一样"
//      在桌面端也是**判据**，而不是"看起来能开"。
//
// 不进 `verify_all.sh`：要装 Electron（~100 MB）并起窗口 —— 与 `host-swap-spike` 同一档（手动跑）。

import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..", "zhouyi-reader");
const DIST = path.join(HERE, "dist");
const APP_VERIFY = path.join(APP, "verify.mjs");
// 附着模式下应用那份判据里"响应式"那一组会 **SKIP**（视口由宿主决定，靠 CDP 模拟不算数）
// ⇒ 期望 **97**（99 减去那 2 条）；桌面端的响应式由**下面第二段**用两个不同尺寸的真窗口验。
const EXPECT_APP_ASSERTIONS = 97;
const WIN_W = 1280;
const WIN_H = 900;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}
function skipOut(why) {
  console.log(`SKIP  ${why}`);
  process.exit(2);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 找一个空闲端口给 CDP 用（写死端口会撞上一轮残留的 Electron / Chrome）。 */
async function freePort(from = 9346, to = 9370) {
  for (let p = from; p <= to; p++) {
    const ok = await new Promise((res) => {
      const s = net.createServer();
      s.once("error", () => res(false));
      s.once("listening", () => s.close(() => res(true)));
      s.listen(p, "127.0.0.1");
    });
    if (ok) return p;
  }
  return from;
}

// ── 0) 前置 ──────────────────────────────────────────────────────────────────
const electronBin = (() => {
  const base = path.join(HERE, "node_modules", "electron", "dist");
  for (const name of ["electron.exe", "electron"]) {
    const p = path.join(base, name);
    if (fs.existsSync(p)) return p;
  }
  try {
    return require(path.join(HERE, "node_modules", "electron"));
  } catch {
    return null;
  }
})();
if (!electronBin || !fs.existsSync(electronBin)) {
  skipOut(
    "Electron 的二进制不在 —— `cd examples/apps/zhouyi-reader-electron && npm install`" +
      "（装不上时报错见 README：npm 的 postinstall 会被镜像跳过，需要手动 `ELECTRON_MIRROR=… node node_modules/electron/install.js`）",
  );
}
if (!fs.existsSync(path.join(APP, "moobile.js"))) {
  skipOut("产物不在 —— 先 `cd ../zhouyi-reader && npm run build`");
}

// ── 1) 打包（与静态宿主同一条流水线）─────────────────────────────────────────
console.log("── 打包（esbuild：react-native → react-native-web）──");
const build = spawnSync(process.execPath, [path.join(HERE, "build.mjs")], { cwd: HERE, encoding: "utf8" });
check("build.mjs 退出码 0", build.status === 0, (build.stdout || "").trim().split("\n").pop() || (build.stderr || "").trim().split("\n").slice(-2).join(" / "));
if (build.status !== 0) {
  console.log((build.stdout || "") + (build.stderr || ""));
  report();
}
console.log("      " + (build.stdout || "").trim().split("\n").join("\n      "));

const inputs = JSON.parse(fs.readFileSync(path.join(DIST, "metafile.json"), "utf8")).inputs;
const expoInputs = inputs.filter((p) => /node_modules[\\/](expo(-|$)|@expo|metro|expo-modules|react-native[\\/])/.test(p));
check("依赖图里没有 expo / Metro / 原生 react-native 本体", expoInputs.length === 0, expoInputs.slice(0, 3).join(" ") || `共 ${inputs.length} 个输入`);
check("`dist/index.html` 在（Electron 的 `loadFile` 装的就是它）", fs.existsSync(path.join(DIST, "index.html")));

// ── 2) 起 Electron 窗口（调试端口让它可被 CDP 附着）──────────────────────────
console.log("\n── 起窗口（Electron）──");
const PORT = await freePort();
console.log(`      （CDP 端口 ${PORT}；ELECTRON_HEADLESS=1 时不弹窗，判据读的是 CDP 里的页面）`);
const child = spawn(electronBin, [HERE], {
  cwd: HERE,
  env: {
    ...process.env,
    ELECTRON_DEBUG_PORT: String(PORT),
    ELECTRON_HEADLESS: process.env.ELECTRON_HEADLESS || "1",
    ELECTRON_WIN_W: String(WIN_W),
    ELECTRON_WIN_H: String(WIN_H),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let elog = "";
child.stdout.on("data", (d) => (elog += d));
child.stderr.on("data", (d) => (elog += d));
let exited = null;
child.on("close", (code) => (exited = code));

let page = null;
for (let i = 0; i < 60 && !page; i++) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    page = list.find((t) => t.type === "page" && /index\.html/.test(t.url || "")) || list.find((t) => t.type === "page");
  } catch {}
}
check("Electron 进程起来了（CDP 上有 page target）", Boolean(page), page ? page.url : `没连上 127.0.0.1:${PORT}` + (exited !== null ? `（进程已退出，code=${exited}）\n${elog.slice(-400)}` : ""));
if (!page) {
  try {
    child.kill();
  } catch {}
  report();
}

// 附着一个小 CDP 客户端：只问窗口尺寸/标题这类"宿主事实"（界面判据交给应用那份）
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.result?.value;

await send("Runtime.enable");
for (let i = 0; i < 40; i++) {
  const t = await evaluate("document.title");
  if (t && t.includes("折中")) break;
  await sleep(500);
}
const title = await evaluate("document.title");
const metrics = await evaluate("({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio })");
check("窗口标题是应用名（不是 `index.html` 之类的默认值）", typeof title === "string" && title.includes("折中"), String(title));
// ⚠️ 判据取"**这是个够大的桌面窗口**"，不是"CSS 视口 == 请求的窗口尺寸"：
//    这台机器的显示缩放是 **150%**（`devicePixelRatio: 1.5`），所以请求 1280×900 物理像素时
//    CSS 视口是 1266×617（还扣掉标题栏/边框）。第一版按物理尺寸断言 → 假红。
//    真正该盯的是"窗口够大、应用按这个视口布局" —— 后者由应用自己的判据验
//    （画布边长 = min(94vw, 720)，用的就是它自己的 `window.innerWidth`）。
check(
  `窗口是个像样的桌面窗口（CSS 视口 ${metrics ? Math.round(metrics.w) : "?"}×${metrics ? Math.round(metrics.h) : "?"}，dpr ${metrics ? metrics.dpr : "?"}）`,
  Boolean(metrics) && metrics.w >= 1000 && metrics.h >= 500,
  JSON.stringify(metrics),
);
check("渲染进程里没有 Node 能力（`nodeIntegration:false` + 沙箱：`require` 不可用）", (await evaluate("typeof require")) === "undefined", String(await evaluate("typeof require")));

// ── 3) 产物新鲜度（"这个窗口装的是不是这一次编的"）────────────────────────────
console.log("\n── 产物新鲜度 ──");
const diskSha = crypto.createHash("sha256").update(fs.readFileSync(path.join(APP, "moobile.js"))).digest("hex");
const served = JSON.parse(fs.readFileSync(path.join(DIST, "artifact.json"), "utf8"));
check("`dist/artifact.json` 的指纹 = 磁盘上 `moobile.js` 的 sha256", served.sha === diskSha, `dist ${served.sha.slice(0, 16)}… / 磁盘 ${diskSha.slice(0, 16)}…`);
const inPage = await evaluate("globalThis.__ARTIFACT_SHA__ || ''");
check("**窗口里的页面**报的是同一个指纹（装的就是这一次编的产物）", inPage === diskSha, String(inPage).slice(0, 20) + "…");
check("宿主标记是 `electron`（同一份产物能自报它在谁那里跑）", (await evaluate("globalThis.__HOST_KIND__ || ''")) === "electron", String(await evaluate("globalThis.__HOST_KIND__")));

// ── 4) ★ 同一套界面判据打在**这个窗口**上 ────────────────────────────────────
console.log("\n── 界面判据：附着到 Electron 的窗口跑 `../zhouyi-reader/verify.mjs` ──");
const run = await new Promise((resolve) => {
  const p = spawn(process.execPath, [APP_VERIFY], {
    cwd: APP,
    env: { ...process.env, PROBE_CDP_URL: `http://127.0.0.1:${PORT}` },
  });
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (out += d));
  const killer = setTimeout(() => {
    p.kill();
    resolve({ out: out + "\n[TIMEOUT] 应用判据超过 10 分钟", error: "超时" });
  }, 600000);
  p.on("close", (code) => {
    clearTimeout(killer);
    resolve({ out, status: code, error: null });
  });
});
console.log(
  run.out
    .trim()
    .split("\n")
    .slice(-12)
    .map((l) => "      " + l)
    .join("\n"),
);
const m = run.out.match(/通过\s+(\d+)\s+失败\s+(\d+)/);
const passed = m ? Number(m[1]) : -1;
const failed = m ? Number(m[2]) : -1;
check("应用的判据脚本跑完了并打出了汇总行", Boolean(m), m ? `通过 ${passed} 失败 ${failed}` : run.error || "（没有汇总行）");
check(
  `**同一套 ${EXPECT_APP_ASSERTIONS} 条界面判据在 Electron 窗口里全过**`,
  passed === EXPECT_APP_ASSERTIONS && failed === 0,
  `通过 ${passed} 失败 ${failed}（应用那边期望 ${EXPECT_APP_ASSERTIONS}/0）`,
);

// ── 4b) **真窗口**尺寸 → 画布边长（桌面端的响应式，不用 CDP 模拟视口）───────────
//
// 为什么单独立一段：应用那份判据在**附着模式**下会跳过它自己的响应式那一组
// （那段用 `Emulation.setDeviceMetricsOverride`，那是"浏览器夹具"的能力；
// 附着到 Electron 上时窗口大小是**宿主的事**，模拟出来的视口不算数）。
// 于是这里用**真的开一个更小的窗口**来验同一件事：窗口 420 宽 ⇒ 画布边长应当 ≈ min(94vw, 720)。
console.log('\n── 真窗口尺寸 → 画布边长（第二个更小的窗口）──');
const SMALL_W = 420;
const PORT2 = await freePort(PORT + 1);
const child2 = spawn(electronBin, [HERE], {
  cwd: HERE,
  env: { ...process.env, ELECTRON_DEBUG_PORT: String(PORT2), ELECTRON_HEADLESS: "1", ELECTRON_WIN_W: String(SMALL_W), ELECTRON_WIN_H: "700" },
  stdio: "ignore",
});
let page2 = null;
for (let i = 0; i < 60 && !page2; i++) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT2}/json/list`)).json();
    page2 = list.find((t) => t.type === "page");
  } catch {}
}
if (!page2) {
  check("第二个（更小的）窗口起来了", false, `没连上 127.0.0.1:${PORT2}`);
} else {
  const ws2 = new WebSocket(page2.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws2.onopen = res;
    ws2.onerror = rej;
  });
  let id2 = 0;
  const pend2 = new Map();
  ws2.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pend2.has(msg.id)) {
      pend2.get(msg.id)(msg);
      pend2.delete(msg.id);
    }
  };
  const send2 = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id2;
      pend2.set(i, res);
      ws2.send(JSON.stringify({ id: i, method, params }));
    });
  const ev2 = async (expr) => (await send2("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.result?.value;

  let small = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    small = await ev2(`(() => {
      const c = document.querySelector('canvas, svg');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { vw: window.innerWidth, css: Math.round(r.width), expect: Math.floor(Math.min(window.innerWidth * 0.94, 720)) };
    })()`);
    if (small) break;
  }
  check("小窗口里也渲染出了画布", Boolean(small), JSON.stringify(small));
  if (small) {
    // ⚠️ 容差 ±20px 是有理由的，不是"放水"：**Electron 窗口的内尺寸在页面加载之后才定型**
    //    （实测：`init` 那一刻读到的视口是 390，之后才变成 406 —— 差一个窗口边框的量级），
    //    而应用是"首帧读一次 + 之后靠 resize 订阅"。要判的是"**跟随窗口宽度**"这件事本身：
    //      · 上界：不许明显大过 min(94vw, 720)；
    //      · 下界：**必须明显不是那个"哪端都不溢出"的回落值 360** —— 那才是修之前的样子。
    check(
      `真窗口 ${SMALL_W}px ⇒ 画布边长 ≈ ${small.expect}（跟随**真实**窗口宽度，±20px 容差见注释）`,
      Math.abs(small.css - small.expect) <= 20,
      `视口 ${small.vw} · 实得 ${small.css} · 期望 ${small.expect}`,
    );
    check(
      "而且**不是回落值 360**（修之前窗口多宽都画 360）",
      Math.abs(small.css - 360) > 5,
      `实得 ${small.css}`,
    );
    check(
      "小窗口的画布**确实比大窗口小**（响应式在两个真窗口之间成立）",
      small.css < (metrics ? Math.round(metrics.w) : 9999) && small.css < 720,
      `小 ${small.css} < 大 ${metrics ? Math.round(metrics.w) : "?"}`,
    );
  }
  ws2.close();
  try {
    child2.kill();
  } catch {}
}

// ── 5) 证据 + 收尾 ───────────────────────────────────────────────────────────
// ⚠️ **截图只是证据，不是判据** —— 所以它**不能把整条门挂住**：
//    实测：隐藏窗口（`show:false`）上 `Page.captureScreenshot` 会**一直不返回**
//    （Chromium 不为不可见窗口合成帧），脚本卡在 `await` 上 ⇒ **汇总行永远打不出来**，
//    而跑的人只看到"没有输出"，很容易误以为应用崩了。这里给 6 秒硬上限，超时就跳过。
try {
  const shot = await Promise.race([
    send("Page.captureScreenshot", { format: "png" }),
    sleep(6000).then(() => null),
  ]);
  if (shot && shot.result?.data) {
    const out = path.join(HERE, "shot-electron.png");
    fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
    console.log(`      截图：${out}`);
  } else {
    console.log("      （截图跳过：隐藏窗口不合成帧 —— 要看截图就用 ELECTRON_HEADLESS=0 跑一次）");
  }
} catch {}
ws.close();
try {
  child.kill();
} catch {}
await sleep(800);
check("窗口进程能干净退出（判据跑完不留后台进程）", exited !== null || child.killed, `exited=${exited}`);

function report() {
  const pass = results.filter((r) => r.ok).length;
  console.log("\n================ 桌面端（Electron 窗口）汇总 ================");
  console.log(`通过 ${pass}  失败 ${results.length - pass}`);
  for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL  ${r.name}`);
  console.log("⚠️ 这条门验的是**Electron 这条桌面路线**（本机能跑）；");
  console.log("   `--host rnw`（React Native 原生窗口）那条仍要 VS 2026 + SDK 22621 —— 见 ../zhouyi-reader-desktop/。");
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}
report();
