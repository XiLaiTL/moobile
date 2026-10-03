#!/usr/bin/env node
// verify.mjs —— 迁移过来的《御纂周易折中》阅读器在**真浏览器**里的断言。
//
//   node verify.mjs [URL]        # 默认 http://localhost:8081（npm run web 起的那个）
//
// 为什么这个脚本必须存在（而不是"看一眼截图就行"）：
//   · 迁移工具能保证的只有"生成物能编译"（`moon check`）。**编译过 ≠ 渲染对** ——
//     122 处 `class=` 全都会静默失效、样式全丢，页面照样能跑；
//   · 所以这条链上唯一有说服力的判据是"真浏览器里长出了什么"，
//     而且要断言到**具体文本**（卦名 / 爻辞），不是"页面上有字"。
//
// 判据分层（红一条就退出码非 0）：
//   A. 首屏：标题 + 六十四卦速查 + 卦名 + 卦卡数量
//   B. 交互：点卦卡进详情页、爻辞出现（这条验的是 TEA 真的接上了宿主）
//   C. 样式：关键元素**真的拿到了样式**（迁移后 class= 失效的话，这里会红）
//   D. 干净：全程没有 console.error / 未捕获异常
//
// ⚠️ 截图不一定"新"：失败时先看它带的 `innerText`，别只看图。

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const URL_ = process.argv[2] || "http://localhost:8081/";
const CDP_PORT = Number(process.env.PROBE_CDP_PORT || 9244);
const OUT = process.env.PROBE_OUT || path.join(process.cwd(), "shot-zhouyi-reader.png");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ⚠️ 别把本机绝对路径写进来：仓库的泄漏门（`tools/check_public_leaks.py`）会点名它 ——
//    `tools/` 下的脚本被那道门豁免，`examples/` 下的**不豁免**。这里从环境变量拼，
//    顺带也就跨机器可用了。
const CHROME_CANDIDATES = [
  process.env.CHROME,
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
  process.env["PROGRAMFILES(X86)"] &&
    path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
};

// ── 两种模式：自己起 Chrome（默认）· **附着到别人的 CDP 端点**（`PROBE_CDP_URL`）──────
//
// 为什么要第二种：**同一套判据要能打在别的宿主上**。桌面端（Electron）与静态 Web 宿主
// 都是 Chromium 内核、都能开 CDP —— "换个宿主，判据一个不改"这句话只有真打过去才算数
// （webview 那条就是这么做的：`examples/apps/zhouyi-reader-webview/verify.mjs`
//  spawn 本脚本、读它的汇总行）。附着模式下：
//   · **不自己起浏览器**（宿主已经在跑了），所以也不负责关它；
//   · **不导航** —— 宿主加载的是它自己的入口（file:// 或它自己的服务器），
//     我们去导航等于把被测物换掉。
const ATTACH = process.env.PROBE_CDP_URL || "";
let proc = null;
let profile = null;
if (ATTACH) {
  console.log(`（附着模式：CDP ${ATTACH} —— 判据打在别人起的宿主上，不自己开浏览器、也不导航）`);
} else {
  const chrome = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!chrome) {
    console.log("SKIP  本机没有 Chrome");
    process.exit(2);
  }
  profile = path.join(os.tmpdir(), "chrome_zhouyi_" + Date.now());
  proc = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--window-size=1400,1000",
      "--remote-debugging-port=" + CDP_PORT,
      "--user-data-dir=" + profile,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  process.on("exit", () => {
    try {
      if (process.platform === "win32") execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: "ignore" });
      else proc.kill("SIGKILL");
    } catch {}
    try {
      if (profile) fs.rmSync(profile, { recursive: true, force: true });
    } catch {}
  });
}

let targets = [];
const CDP_BASE = ATTACH || `http://127.0.0.1:${CDP_PORT}`;
for (let i = 0; i < 80; i++) {
  await sleep(250);
  try {
    targets = await (await fetch(`${CDP_BASE}/json`)).json();
    if (targets.length) break;
  } catch {}
}
const page = targets.find((t) => t.type === "page");
if (!page) {
  console.log(`FAIL  连不上 CDP（${CDP_BASE}）`);
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let id = 0;
const pending = new Map();
const problems = [];
const consoleLog = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.consoleAPICalled") {
    const line = msg.params.args.map((a) => a.value ?? a.description).join(" ");
    consoleLog.push(`${msg.params.type}: ${line}`);
    if (msg.params.type === "error") problems.push("console.error: " + line.slice(0, 400));
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    const text = (d.exception?.description || d.text || "").split("\n").slice(0, 6).join(" / ");
    problems.push(`exception: ${text.slice(0, 500)}`);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.text };
  return { value: r.result?.result?.value };
};

await send("Runtime.enable");
await send("Page.enable");
if (ATTACH) {
  // 附着模式：宿主已经把应用加载好了，**不导航**（导航会把被测物换成别的入口）。
  await sleep(1500);
} else {
  await send("Page.navigate", { url: URL_ });
}

// ── A. 首屏 ──────────────────────────────────────────────────────────────────
let text = "";
for (let i = 0; i < 60; i++) {
  await sleep(500);
  const r = await evaluate("document.body ? document.body.innerText : ''");
  text = r.value || "";
  if (text.includes("折中") || text.includes("加载失败")) break;
}

console.log("--- 首屏 innerText（前 300 字）---");
console.log(text.slice(0, 300).split("\n").filter(Boolean).join(" | "));
console.log("----------------------");

check("首屏不是「加载失败」", !text.includes("加载失败"), text.includes("加载失败") ? text.slice(0, 120) : "");
check("标题「御纂周易折中」在页面上", text.includes("御纂周易折中"));
check("副题「康熙御定 · 折中程朱」在页面上", text.includes("折中程朱"));
check("页脚印章「誠正貞」在页面上", text.includes("誠正貞"));

// 数据：应用自己打的日志（`debug_log`）—— "数据真的进了应用"的直接证据。
// 为什么不信 DOM：数据没进来时页头页脚照样渲染，只有中间那块会空（第一版就误判过）。
const dataLog = consoleLog.find((l) => l.includes("阅读数据已装载"));
check("应用日志里报出数据已装载（658049 字符）", Boolean(dataLog && /658049/.test(dataLog)), dataLog || "");

// ── 罗盘：画布通道 + 手势通道 ────────────────────────────────────────────────
//
// 这一块验的是**两条通道**是否真的通了：`@canvas.canvas`（画布）与 `@gesture.attrs`（手势）。
// 判据刻意选"像素"与"画面变化"，而不是"元素在不在" —— 元素在但没画东西，
// 正是"看起来迁好了"的典型样子。
check("罗盘面板在首屏（模式按钮 + 立竿测影）", /伏羲先天/.test(text) && /立竿测影/.test(text));

// ⚠️ 这条判据要**与后端无关**：画布通道有三条后端（DOM 2D / Skia / SVG），
//    DOM 那条渲染成 `<canvas>`，SVG 那条渲染成 `<svg>`。第一版只认 `canvas`，
//    于是换成 SVG 后端时四条断言一起红 —— 而它们红的是**判据**，不是被测物。
//
//    "画了东西"的判据按类型取：canvas 读像素（非透明点），svg 数元素（Path/Rect/Text）。
//    "画面变了"用**字符串哈希**而不是长度 —— 旋转只改数字，`outerHTML` 的长度可能一点不变。
const SNAPSHOT = `(() => {
  const el = document.querySelector('canvas, svg');
  if (!el) return null;
  const isCanvas = el.tagName.toLowerCase() === 'canvas';
  let painted = 0, text = '';
  if (isCanvas) {
    const ctx = el.getContext('2d');
    const d = ctx.getImageData(0, 0, el.width, el.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) painted++;
    text = el.toDataURL();
  } else {
    painted = el.querySelectorAll('*').length;
    text = el.outerHTML || '';
  }
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  const r = el.getBoundingClientRect();
  // ⚠️（模板字符串里**不能写反引号** —— 会把模板提前闭合，第九轮踩过一次）
  //    w/h 是 **CSS 尺寸**，bw/bh 是**位图尺寸**，两者可以不相等（dpr > 1）。
  //    "同一张图"的判据必须能区分"图变了"与"位图分辨率变了"（第十三轮在 Electron 上撞到过：
  //    dpr 1.5 时位图是 1080×1080，而我的响应式测试把 dpr 临时改成 1 再清掉，
  //    位图分辨率一变，同一模式的像素哈希就对不上了 —— 那红的是**判据**）。
  return { tag: el.tagName.toLowerCase(), painted, hash: h, len: text.length,
           w: Math.round(r.width), h: Math.round(r.height),
           bw: isCanvas ? el.width : 0, bh: isCanvas ? el.height : 0 };
})()`;
const painted = await evaluate(SNAPSHOT);
const pt = painted.value;
// 判据阈值按类型分：canvas 是像素（几万起），svg 是元素（几十起）
const paintedOk = pt && (pt.tag === 'canvas' ? pt.painted > 5000 : pt.painted >= 50);
check("画布元素存在且尺寸 > 0（canvas 或 svg 都认）", Boolean(pt && pt.w > 0 && pt.h > 0), JSON.stringify(pt));
check(
  `画布**真的画了东西**（${pt ? (pt.tag === 'canvas' ? '非透明像素 > 5000' : '矢量元素 ≥ 50') : '—'}）`,
  Boolean(paintedOk),
  pt ? `${pt.tag}: ${pt.painted}` : "没有画布元素",
);

// ── 罗盘面板的控件（模式 / 环层 / 顺序 / 立竿测影）────────────────────────────
//
// 为什么这块值得单独判：四个模式（伏羲先天 / 后天文王·卦气 / 京房八宫 / 卦爻色环）与
// 立竿测影、环层、顺序**各自都是一份绘制逻辑**，迁移时改动最多的地方就是它们；
// 而"点了没反应"这类静默失效（`on_click` 挂在不会响的标签上）在**画布类控件**上
// 尤其难发现 —— 页面不会报错，画布也不会变。
//
// 判据取**两条后果**，缺一不可：
//   ① 按钮**变成选中态**（样式里"on"那一版与"off"那版不同）—— 证明模型变了；
//   ② **画布内容真的变了**（`outerHTML` 的哈希变化）—— 证明重绘跟着模型走了。
// 只判 ① 会漏掉"模型变了但没重绘"，只判 ② 会漏掉"点到了别的按钮也碰巧重绘"。
//
// ⚠️ 会话状态：这一段跑完必须把模式切回**伏羲先天**、测影关掉 —— 否则后面的判据
// （轻点外环进卦 / 拖拽）会落在别的模式上，红出来的是"手势坏了"（夹具污染）。
{
  /** 按钮的"选中态"怎么判：比较它的计算样式（选中版与未选中版的底色不同）。 */
  // ⚠️ 按文本找**按钮**时要小心**同名文本**：切到色环模式后，面板的标题也变成「卦爻色环」
  //    （`h2` 与按钮同一个字符串），第一版取"第一个匹配"就取到了标题 —— 标题没有背景色，
  //    于是"按钮没变成选中态"这条假红（真因是判据选错了元素）。
  //    判据改成：**在所有同名候选里，挑那个能解析出背景色的**（按钮才有）。
  const buttonBg = (label) =>
    evaluate(`(() => {
      const els = Array.from(document.querySelectorAll('*'))
        .filter(e => e.children.length === 0 && (e.textContent || '').trim() === ${JSON.stringify(label)});
      for (const el of els) {
        let n = el;
        for (let i = 0; i < 3 && n; i++) {
          const bg = getComputedStyle(n).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          n = n.parentElement;
        }
      }
      return 'none';
    })()`);

  // ⚠️ **默认模式是「后天文王 · 卦气」，不是伏羲先天** —— 这一条我一开始猜错了：
  //    原项目就是这么初始化的（`interest/yi/.../frontend/main.mbt:106` 的 `mode: GuaQi`），
  //    移植时照搬 ✓。判据的错法是"以为默认是伏羲，于是把'点卦气没变化'当成绘制 bug" ——
  //    其实是**点了一个已经选中的按钮**（无操作，像素当然不变）。实测：单跑探针点四个模式，
  //    四张图的像素哈希两两不同，应用是对的。
  const DEFAULT_MODE = "后天文王 · 卦气";
  const OTHERS = ["京房八宫", "卦爻色环", "伏羲先天"];

  // ⚠️★ 基准要取**稳定态**：先随便切一个模式再切回来，然后才量基准。
  //    理由是实测出来的：**首帧那张图和之后同一模式的图不一样**（Electron 上 dpr=1.5 实测：
  //    首次进「卦气」的像素哈希与第二次进不同，而第二、第三次相同 —— 稳定下来了）。
  //    差异来自**首帧的字体定型**（画布上的字走 `matchFont`，第一帧可能还是回退字体）——
  //    这不是应用缺陷，但会让"切回来是不是同一张图"这条判据在首帧上假红。
  //    判据要问的是"**同一模式下画面稳不稳定**"，所以拿两个稳定态比。
  const warm = await foldProbe("京房八宫");
  if (warm) {
    await clickAt(warm);
    await canvasSnapSettled();
    const back = await foldProbe("后天文王 · 卦气");
    if (back) {
      await clickAt(back);
      await canvasSnapSettled();
    }
  }
  const baseSnap = await canvasSnapSettled();
  const baseHash = baseSnap.hash;
  // "选中态"的判据取**已知选中按钮的底色**当基准（默认那个按钮就是选中的），
  // 而不是"有没有背景色" —— 后者太弱：未选中的按钮也有底色（实测 230,216,188 vs 138,37,24）。
  const onColor = await buttonBg(DEFAULT_MODE);
  const offColor = await buttonBg("伏羲先天");
  check(
    `罗盘默认在「${DEFAULT_MODE}」（选中态底色与未选中不同）`,
    Boolean(onColor.value) && onColor.value !== "none" && onColor.value !== offColor.value,
    `选中 ${onColor.value} / 未选 ${offColor.value}`,
  );

  const hashes = [baseHash];
  for (const label of OTHERS) {
    const p = await foldProbe(label);
    check(`找得到模式按钮「${label}」`, Boolean(p), JSON.stringify(p));
    if (!p) continue;
    await clickAt(p);
    const h = await canvasHashSettled(hashes[hashes.length - 1]);
    hashes.push(h);
    const bg = await buttonBg(label);
    check(`点「${label}」→ 它变成选中态`, Boolean(bg.value) && bg.value === onColor.value, `底色 ${bg.value}（选中色 ${onColor.value}）`);
    check(
      `点「${label}」→ **画布内容变了**（换了绘制逻辑，不是只换高亮）`,
      h !== 0 && h !== hashes[hashes.length - 2],
      `hash ${hashes[hashes.length - 2]} → ${h}`,
    );
  }
  // 切回默认模式（后面"立竿测影"与手势判据的夹具前提）—— 顺便验**切回去是同一张图**
  const backToDefault = await foldProbe(DEFAULT_MODE);
  if (backToDefault) {
    await clickAt(backToDefault);
    const backSnap = await canvasSnapSettled(hashes[hashes.length - 1]);
    check(
      "切回默认模式 ⇒ 画布回到**同一张图**（模式切换是可逆的）",
      backSnap.hash === baseHash,
      `${baseHash} → ${backSnap.hash}｜基准 ${baseSnap.w}×${baseSnap.h}/${baseSnap.len}B · 切回 ${backSnap.w}×${backSnap.h}/${backSnap.len}B`,
    );
    hashes.push(backSnap.hash);
  }
  const four = hashes.slice(0, 4); // 默认 + 三个别的模式（切回默认那一次是重复值，单列一条判据）
  check(
    "四种模式的画布**两两不同**（同一份 ops 循环出来的，逻辑真的分叉了）",
    four.length === 4 && new Set(four).size === 4,
    four.join(" / "),
  );

  // 立竿测影：只在**非色环**模式下渲染 —— 上面已经切回默认（卦气）了，这里只需要确认夹具状态

  const simBtn = await foldProbe("立竿测影 · 关");
  check("非色环模式下有「立竿测影 · 关」按钮", Boolean(simBtn), JSON.stringify(simBtn));
  if (simBtn) {
    const beforeSim = await canvasHashSettled();
    await clickAt(simBtn);
    const afterSim = await canvasHashSettled();
    check(
      "点「立竿测影」→ 画布变了（多了一层测影图）",
      beforeSim !== 0 && afterSim !== 0 && afterSim !== beforeSim,
      `${beforeSim} → ${afterSim}`,
    );
    const onBtn = await foldProbe("立竿测影 · 开");
    check("按钮文案跟着变成「立竿测影 · 开」", Boolean(onBtn), JSON.stringify(onBtn));
    // 收尾：关掉，并把模式确认回伏羲先天（后面的手势判据依赖这个夹具状态）
    if (onBtn) {
      await clickAt(onBtn);
      await sleep(300);
    }
  }
  const restored = await foldProbe("立竿测影 · 关");
  check("（夹具）测影已关掉、模式回到默认（后面手势判据的前提）", Boolean(restored), JSON.stringify(restored));
}

// ── 画布边长**跟随窗口宽度**（原实现是 CSS `min(94vw, 720px)`）─────────────────
//
// 为什么单独立一条：第十轮之前这条**一直是坏的而且没人知道** ——
// 边长按"窗口宽度的 94%（上限 720）"算，而窗口宽度**从来没读到过**
// （`@sub.on_resize` 只推变化、**不补发初始值**），于是永远走回落值 360。
// 在 758px 宽的窗口里"正好看着还行"，所以肉眼看不出问题；换个大窗口立刻露馅。
// 第十一轮库侧补了 `@sub.current_viewport()`（读一次），这条判据就是它的验收：
//
//   ① 首屏：边长 == min(0.94 × window.innerWidth, 720)（**不是** 360 那个回落值）；
//   ② 把窗口改窄（400px）：边长跟着变小（== min(0.94×400, 720)）。
if (ATTACH) {
  // ⚠️ **附着模式下跳过这一段**，理由不是"跑不过"，而是"**它测的东西在这里不属于被测物**"：
  //    这一段用 CDP 的 `Emulation.setDeviceMetricsOverride` 改视口 —— 那是**浏览器夹具**
  //    的能力；附着到别人的宿主上时，"窗口多大"是**宿主的事**（Electron 的窗口不理会这个
  //    覆盖，实测：改了之后布局没变，后面依赖"视口=400"的判据会连带假红）。
  //    ⇒ 桌面端的响应式要**真的改窗口大小**来验，那件事写在宿主那侧：
  //      `examples/apps/zhouyi-reader-electron/verify.mjs` 用**两个不同尺寸的真窗口**验
  //      （`ELECTRON_WIN_W=420` 那种），而不是在这里模拟。
  console.log("SKIP  响应式（附着模式：视口由宿主决定 —— 真窗口那条在宿主自己的判据里）");
} else {
  const winW = await evaluate("window.innerWidth");
  const expect = Math.floor(Math.min((winW.value || 0) * 0.94, 720));
  check(
    `首屏画布边长 = min(94vw, 720)（窗口 ${winW.value}px ⇒ 期望 ${expect}）`,
    Boolean(pt) && Math.abs(pt.w - expect) <= 2,
    pt ? `实得 ${pt.w}（回落值 360 会让这条红）` : "没有画布元素",
  );
  // ② 收窄窗口 → 边长应当跟着变小（这一步走的是 `on_resize` 订阅那条路）
  await send("Emulation.setDeviceMetricsOverride", { width: 400, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(1200);
  const narrow = await evaluate(SNAPSHOT);
  const expectNarrow = Math.floor(Math.min(400 * 0.94, 720));
  check(
    `窗口收窄到 400px ⇒ 画布边长跟着变成 ${expectNarrow}（响应式真的通了）`,
    Boolean(narrow.value) && Math.abs(narrow.value.w - expectNarrow) <= 2,
    narrow.value ? `实得 ${narrow.value.w}` : "没有画布元素",
  );
  await send("Emulation.clearDeviceMetricsOverride");
  await sleep(900);
}

/**
 * 取画布的像素哈希，**等它稳定**再返回。
 *
 * ⚠️ 为什么需要"等"：画布是**重绘**出来的（模型变 → 渲染 → 后端重放 draw-op），
 *    点完立刻读很可能读到**上一帧或中间态**。这一块第一次跑就吃了这个亏：
 *    "点「卦气」之后 hash 没变"看起来像绘制逻辑没分叉，其实两次采样的都是旧图
 *    （单跑一次探针、点完等 1.5s，四种模式的 hash 两两不同，应用是对的）。
 *    判据要能分辨"没变"与"还没画完" —— 所以连续两次读到同一个值才算稳。
 */
/** 只要哈希的薄包装（大多数断言只关心"变没变"）。 */
async function canvasHashSettled(prev = null) {
  return (await canvasSnapSettled(prev)).hash;
}

async function canvasSnapSettled(prev = null, tries = 14) {
  // ① 先等它**变**（从 `prev` 变走）—— "两次读数相同"单独用是不够的：
  //    在慢一点的宿主上（Electron 隐藏窗口会给 rAF 降频）可能撞上一段**中间态的停顿**，
  //    于是"稳定"地读到一个过渡帧（实测：切回默认模式那条 red 在 Electron 上）。
  if (prev !== null) {
    for (let i = 0; i < tries; i++) {
      await sleep(300);
      const v = await evaluate(SNAPSHOT);
      const h = v.value ? v.value.hash : 0;
      if (h !== 0 && h !== prev) break;
    }
  }
  // ② 再等它**稳**：连续两次读到同一个值才算数。
  let last = 0;
  for (let i = 0; i < tries; i++) {
    await sleep(350);
    const v = await evaluate(SNAPSHOT);
    const h = v.value ? v.value.hash : 0;
    if (h !== 0 && h === last) return { ...v.value, hash: h };
    last = h;
  }
  return { hash: last };
}

// ⚠️ 顺序：**响应式那一段放在罗盘控件之后**。它会把 dpr 临时改掉再清掉，而
//    **位图分辨率**跟着 dpr 走 ⇒ 跨越它的两次像素哈希比较没有可比性
//    （Electron 上 dpr=1.5 时实测：同一模式切回来哈希不同，而图其实一样）。
//    放在这里之后，上面那些"同一张图"的判据都在**同一档 dpr** 里做。
// ⚠️ **顺序有讲究**：先"轻点外环"，再"拖拽"。
//    反过来（先拖后点）时，某些后端下这一次轻点会被当成上一次拖动的延续
//    （responder 还没交出去），于是"点了没反应" —— 实测 SVG 后端踩到过，
//    而单独跑一次轻点（探针）是通的。把两件事拆开、各自从干净状态开始，判据才说明得了问题。
// 轻点外环 → 按角度判卦并进入详情（原实现里这是"轻点不拖动"的那条分支）
if (pt) {
  const rect2 = await evaluate(`(() => {
    const c = document.querySelector('canvas, svg');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);
  const R2 = rect2.value;
  if (!R2) check("（夹具）拿得到画布矩形（点击前）", false, "null");
  const tx = R2 ? R2.x + ((360 + 260) / 720) * R2.w : 0; // 外环中径（绘制坐标 222–300）
  const ty = R2 ? R2.y + (360 / 720) * R2.h : 0;
  console.log(`      · 画布 rect=(${Math.round(R2.x)},${Math.round(R2.y)}) ${Math.round(R2.w)}×${Math.round(R2.h)}；点击点 (${Math.round(tx)},${Math.round(ty)})`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: tx, y: ty });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: tx, y: ty, button: "left", clickCount: 1 });
  await sleep(80);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: tx, y: ty, button: "left", clickCount: 1 });
  await sleep(1200);
}
let tapped = "";
for (let i = 0; i < 15; i++) {
  await sleep(400);
  const r = await evaluate("document.body.innerText");
  tapped = r.value || "";
  if (/‹\s*六十四卦/.test(tapped)) break;
}
check("轻点罗盘外环 → 进入某卦详情", /‹\s*六十四卦/.test(tapped), tapped.slice(0, 100).split('\n').join(" | "));
// 回到列表页，后面的"搜索 → 网格"要在列表页上跑
// ⚠️ 上一步（轻点外环）会把界面带到**详情页** —— 详情页没有罗盘，
//    所以拖拽之前必须**先回到列表页**，否则拿不到画布矩形（实测就是这么崩的）。
await evaluate(`(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const b = all.find(e => (e.textContent || '').trim() === '‹ 六十四卦');
  if (b) b.click();
  return b ? 'back' : 'no-back';
})()`);
for (let i = 0; i < 20; i++) {
  await sleep(300);
  const r = await evaluate("document.body.innerText");
  if (String(r.value || '').includes("八卦罗盘")) break;
}

// 拖拽：真鼠标序列打到画布中心附近。手势通道把它变成 DragStart/Move/End，
// 模型里的 rot 变 → 绘制指令重算 → 画面必须**不一样**。
const beforeHash = pt && pt.hash;
const beforeTag = pt && pt.tag;
if (pt) {
  const cx = 360, cy = 360; // 画布逻辑坐标；vp_w>=780 时 k=1，屏幕坐标与画布坐标一致
  const rect = await evaluate(`(() => {
    const c = document.querySelector('canvas, svg');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);
  const R = rect.value;
  if (!R) { check('（夹具）拿得到画布矩形', false, 'null'); }
  const px = R.x + (cx / 720) * R.w;
  const py = R.y + (cy / 720) * R.h;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: px, y: py });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: px, y: py, button: "left", clickCount: 1 });
  for (let i = 1; i <= 6; i++) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved", x: px + i * 12, y: py + i * 10, button: "left", buttons: 1,
    });
    await sleep(60);
  }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: px + 72, y: py + 60, button: "left", clickCount: 1 });
  await sleep(900);
}
const after = await evaluate(SNAPSHOT);
const a2 = after.value;
check(
  "拖拽之后画面**变了**（手势 → 模型 → 重绘整条链通）",
  Boolean(a2 && beforeHash !== undefined && a2.hash !== beforeHash),
  `前 ${beforeHash} / 后 ${a2 && a2.hash}（${a2 && a2.tag}）`,
);

const backed = await evaluate(`(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const b = all.find(e => (e.textContent || '').trim() === '‹ 六十四卦');
  if (!b) return 'no-back';
  b.click();
  return 'back';
})()`);
await sleep(900);

// ── 搜索 → 网格 ──────────────────────────────────────────────────────────────
//
// ⚠️ 列表页**无搜索词时显示的是罗盘**（`list_view` 的分派），而罗盘是 S7 的活
//    （画布 + 手势），现在还是保底桩。所以这里走"输入搜索词 → 过滤网格"这条真实链路
//    来验列表与详情 —— 它同样是迁移后的代码，而且**不依赖罗盘**。
const focused = await evaluate(`(() => {
  const i = document.querySelector('input');
  if (!i) return 'no-input';
  i.focus();
  return 'focused';
})()`);
check("找得到搜索框", focused.value === "focused", String(focused.value));
await send("Input.insertText", { text: "乾" });
await sleep(1500);

let grid = "";
for (let i = 0; i < 20; i++) {
  await sleep(400);
  const r = await evaluate("document.body.innerText");
  grid = r.value || "";
  if (grid.includes("六十四卦速查")) break;
}
check("搜索后出现「六十四卦速查」（过滤网格）", grid.includes("六十四卦速查"), grid.slice(0, 140).replace(/\n/g, " | "));
check("网格里有卦名「乾」", /乾/.test(grid));
const cardCount = await evaluate(
  "Array.from(document.querySelectorAll('*')).filter(e => e.children.length === 0 && /^\\d{1,2}$/.test((e.textContent||'').trim())).length",
);
check("网格里有卦卡（序号节点 ≥ 1）", (cardCount.value || 0) >= 1, `序号节点 ${cardCount.value}`);

// ── C. 样式真的生效（迁移后 class= 全失效的话，这里会红）────────────────────
const styled = await evaluate(`(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const withBg = all.filter(e => {
    const s = getComputedStyle(e);
    return s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent';
  }).length;
  const withRadius = all.filter(e => parseFloat(getComputedStyle(e).borderRadius) > 0).length;
  const paper = all.some(e => {
    const bg = getComputedStyle(e).backgroundColor;
    return bg === 'rgb(246, 239, 224)' || bg === 'rgb(239, 229, 208)';
  });
  return { withBg, withRadius, paper, total: all.length };
})()`);
const st = styled.value || {};
check("页面用的是纸色底（#f6efe0/#efe5d0 出现在计算样式里）", Boolean(st.paper), JSON.stringify(st));
const styled2 = await evaluate(`(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const bordered = all.filter(e => parseFloat(getComputedStyle(e).borderTopWidth) > 0).length;
  const spaced = all.filter(e => {
    const ls = getComputedStyle(e).letterSpacing;
    return ls && ls !== 'normal' && ls !== '0px';
  }).length;
  const serif = all.some(e => /Charter|Georgia|Kaiti|Noto Serif/i.test(getComputedStyle(e).fontFamily));
  return { bordered, spaced, serif };
})()`);
const s2 = styled2.value || {};
// 判据取"这一页真的该有的样式"，不是随便挑一个属性：卡片有边框、标题有字距、正文是衬线体。
check("卦卡带边框（迁移后的样式落了元素上）", (s2.bordered || 0) >= 1, JSON.stringify(s2));
check("标题带字距（letter-spacing 生效）", (s2.spaced || 0) >= 1, JSON.stringify(s2));
check("正文字体是衬线族（font-family 生效）", Boolean(s2.serif), JSON.stringify(s2));

// ── B. 交互：点第一个卦卡进详情 ──────────────────────────────────────────────
// ⚠️ 用 CDP 的**真鼠标事件**，不用 `element.click()`：
//    RNW 的 `Pressable` 把 onClick 挂在它自己那个 div 上，`.click()` 往往落在包裹层上
//    （第一版就是这么"点到了"却什么也没发生）—— 而且真事件才代表用户真的能点。
const rect = await evaluate(`(() => {
  const all = Array.from(document.querySelectorAll('div,span'));
  // 找"卦卡本身"：一个既含卦名又含象名的元素里**最小的那个 div**（就是 on_click 挂的那个）
  const cands = all
    .filter(e => e.tagName === 'DIV' && /乾/.test(e.textContent || '') && /乾为天/.test(e.textContent || ''))
    .map(e => ({ r: e.getBoundingClientRect(), t: (e.textContent || '').length }))
    .filter(x => x.r.width > 40 && x.r.height > 20)
    .sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height);
  const c = cands[0];
  return c ? { x: c.r.x + c.r.width / 2, y: c.r.y + c.r.height / 2, w: Math.round(c.r.width), h: Math.round(c.r.height), text: c.t } : null;
})()`);
const rc = rect.value;
check("找得到卦卡的位置", Boolean(rc), JSON.stringify(rc));
if (rc) {
  // 真鼠标序列：移动 → 按下 → 抬起（只发 pressed/released 有时不打到 Pressable 上）
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rc.x, y: rc.y });
  await sleep(120);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: rc.x, y: rc.y, button: "left", clickCount: 1 });
  await sleep(60);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rc.x, y: rc.y, button: "left", clickCount: 1 });
}
const clicked = { value: rc ? "clicked" : "no-card" };
check("点到了卦卡", clicked.value === "clicked", String(clicked.value));

let detail = "";
for (let i = 0; i < 20; i++) {
  await sleep(400);
  const r = await evaluate("document.body.innerText");
  detail = r.value || "";
  if (/初九|潜龙勿用|象曰/.test(detail)) break;
}
check("详情页出现爻辞（初九 / 潜龙勿用 / 象曰）", /初九|潜龙勿用|象曰/.test(detail), detail.slice(0, 120).replace(/\n/g, " | "));
// ⚠️ 判据要能区分"还在列表"与"进了详情"：列表页也有「六十四卦速查」，
//    第一版拿 `/六十四卦/` 当返回入口的判据，于是在**根本没跳转**的情况下也 PASS 了。
check("详情页有返回按钮「‹ 六十四卦」", /‹\s*六十四卦/.test(detail), detail.slice(0, 80).split('\n').join(" | "));
check("已离开列表页（不再有「文王卦序」提示）", !detail.includes("文王卦序"));

// ── B2. 底部三块是**受控**折叠（`<details>/<summary>` 迁不动，见 MIGRATION.md §2.1）──
//
// 为什么这条判据非有不可：原实现用 `<details>` 的**自身状态**，而那两个标签在 moobile
// 的标签表里是**明确排除**的（RN 没有那个语义）。迁不动的东西如果"悄悄不渲染"，
// 页面看上去照样"正常" —— 只是少了三块内容。所以这里按**行为**断言，不是按元素在不在：
//   ① 标题按钮**常显**，而正文**不在树上**（默认折叠 —— 不是"整块丢了"）；
//   ② 真鼠标点标题 → 正文出现、箭头 `▸`→`▾`；
//   ③ **再点一下 → 正文又消失**。
// ③ 是关键：只断言"点一下出现了"会漏掉"半受控"（`<details>` 自带状态，写错成
// "点开就收不回"照样能过前两条）。判据取正文里的**具体句子**（不是"元素多了几个"）。
const FOLDS = [
  { head: "文言（卦）", marker: "元者，善之长也" },
  { head: "传文关联 · 序卦 / 杂卦 / 说卦 / 系辞", marker: "乾刚坤柔" },
  { head: "卦主 · 总论 · 用 · 义例归类", marker: "卦主：九五" },
];

const bodyText = async () => (await evaluate("document.body.innerText")).value || "";

// 找标题（那个**没有子元素**且文本恰好等于标题的节点），返回它和它外面那圈按钮
// ⚠️ 必须先 `scrollIntoView` 再量坐标：这三块在详情页**底部**，多半在视口之外 ——
//    CDP 的鼠标事件用的是视口坐标，给一个视口外的 y 打过去什么也不会发生
//    （第②步会"点了没反应"，而真因是坐标，不是折叠坏了）。
async function foldProbe(title) {
  const found = await evaluate(`(() => {
    const t = ${JSON.stringify(title)};
    const el = Array.from(document.querySelectorAll('*'))
      .find(e => e.children.length === 0 && (e.textContent || '').trim() === t);
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    return true;
  })()`);
  if (!found.value) return null;
  await sleep(250);
  const r = await evaluate(`(() => {
    const t = ${JSON.stringify(title)};
    const el = Array.from(document.querySelectorAll('*'))
      .find(e => e.children.length === 0 && (e.textContent || '').trim() === t);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    // ⚠️ 注释里**不能出现反引号**：这段代码本身就在 JS 模板字符串里，
    //    反引号会把模板提前闭合（第一版就这么写的，报的是 "missing ) after argument list"）。
    // 箭头不在标题**自己**这个节点里 —— 标题与 ▸/▾ 是同一行里的两个 span，
    // 谁包着谁取决于宿主把 button 映射成什么（web 上是 Pressable，多一层 div）。
    // 所以判据沿祖先链往上找**第一个含箭头的文本**，而不是写死 parentElement
    // （第一版就写死了，于是三条"箭头"断言全红 —— 红的是判据，不是被测物）。
    let n = el;
    let arrow = "";
    for (let i = 0; i < 4 && n; i++) {
      const tx = (n.textContent || "").trim();
      const m = tx.match(/[▸▾]/);
      if (m) { arrow = m[0]; break; }
      n = n.parentElement;
    }
    return {
      x: b.x + b.width / 2, y: b.y + b.height / 2,
      arrow,
      head: (el.parentElement ? el.parentElement.textContent : el.textContent).trim(),
    };
  })()`);
  return r.value;
}

/**
 * 点一下，并**等到页面真的变了**（而不是固定 sleep）。
 *
 * ⚠️★ 这条是第十三轮换宿主时逼出来的：在 Electron 里（窗口是隐藏的，Chromium 会给隐藏窗口
 * 节流 rAF）**React 的提交比 Chrome 慢一拍** —— 固定 `sleep(500)` 读到的是点击前的内容，
 * 于是"点一下应当出现"整批红，而**同一次点击的效果在下一条断言时才出现**
 * （症状是"点击慢一步"，极具误导性）。
 * 判据的正确形状是"**点完等到变化发生**"：变了就继续（快），超时就按当前状态判（红得有据）。
 * 这不 weaken 判据：真"点了没反应"时，等满超时后 marker 依然不在树上 → 那条断言照样红。
 */
async function textNow() {
  return (await evaluate("document.body ? document.body.innerText : ''")).value || "";
}
async function waitForTextChange(before, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await sleep(120);
    if ((await textNow()) !== before) return true;
  }
  return false;
}
async function clickAt(p, opts = {}) {
  const settle = opts.settle !== false;
  const before = settle ? await textNow() : "";
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y });
  await sleep(120);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await sleep(60);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  if (settle) await waitForTextChange(before);
  else await sleep(500);
}

for (const f of FOLDS) {
  const before = await bodyText();
  check(`折叠区块标题常显「${f.head}」`, before.includes(f.head), before.slice(-160).replace(/\n/g, " | "));
  check(`默认折叠：正文「${f.marker}」不在树上`, !before.includes(f.marker), f.marker);

  const p = await foldProbe(f.head);
  check(`找得到折叠标题的位置「${f.head}」`, Boolean(p), JSON.stringify(p));
  if (!p) continue;
  check(`折叠箭头是合上的（▸）「${f.head}」`, p.arrow === "▸", JSON.stringify(p));

  await clickAt(p);
  const opened = await bodyText();
  check(`点标题展开：「${f.marker}」出现在树上`, opened.includes(f.marker), opened.slice(-160).replace(/\n/g, " | "));
  const p2 = await foldProbe(f.head);
  check(`展开后箭头是打开的（▾）「${f.head}」`, Boolean(p2) && p2.arrow === "▾", p2 ? JSON.stringify(p2) : "标题不见了");

  await clickAt(p2 || p);
  const closed = await bodyText();
  check(`再点一次收起：「${f.marker}」又不在树上`, !closed.includes(f.marker), closed.slice(-160).replace(/\n/g, " | "));
  // 收尾：三块都回到默认态，后面（D）的判据看到的是"干净"页面
}

// ── B3. 详情页剩下的交互族：**每一条都要有判据**（10-02 第十轮补）──────────────
//
// 为什么补这一批：B2 只覆盖了底部三块（`more_view`）。而详情页还有**六个**折叠族
// （卦辞 / 大象 / 彖辞逐句 / 爻辞 / 小象）与三个状态族（变爻 / 错综互预览 / 上下卦导航）——
// 它们在迁移里**全都动过**（`on_click` 挂错标签就静默失效、`<details>` 换成受控、样式重挂），
// 却一条判据都没有。**没有判据的迁移 = 靠运气**。
//
// 判据形状统一成"**点一下 → 正文里那句具体的话出现 → 再点一下 → 又不在树上**"：
// 前两条证明它真的能展开，第三条证明它**是受控的**（`<details>` 那类"能开不能收"会漏过前两条）。

/**
 * 回到乾的详情页（跳走之后用）：回列表 → 在过滤网格里点「乾」那张卡。
 *
 * ⚠️ 为什么需要它：这一节里有几条判据会**跳走**（变卦 / 上下卦导航 / 错综互），
 *    而后面几条判据的前提是"在乾上"。少了这一步，红出来的是"找不到错卦那一枚"这种
 *    看起来像功能坏了的断言（第一版就吃过这个亏）。
 */
async function backToQian() {
  if (/第\s*1\s*卦/.test(await bodyText())) return true; // 已经在乾上
  const back = await foldProbe("‹ 六十四卦");
  if (back) {
    await clickAt(back);
    await sleep(1000);
  }
  for (let i = 0; i < 12; i++) {
    const card = await evaluate(`(() => {
      const c = Array.from(document.querySelectorAll('div'))
        .filter(e => /乾/.test(e.textContent || '') && /乾为天/.test(e.textContent || ''))
        .map(e => ({ r: e.getBoundingClientRect() }))
        .filter(x => x.r.width > 40 && x.r.height > 20)
        .sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height)[0];
      return c ? { x: c.r.x + c.r.width / 2, y: c.r.y + c.r.height / 2 } : null;
    })()`);
    if (!card.value) {
      await sleep(600);
      continue;
    }
    await clickAt(card.value);
    await sleep(1200);
    if (/第\s*1\s*卦/.test(await bodyText())) return true;
  }
  return false;
}

/** 通用：点开一个可折叠元素 → 断言 marker 出现 → 再点 → 断言 marker 消失。 */
async function foldByText(label, target, marker) {
  const before = await bodyText();
  check(`（${label}）初始状态：正文「${marker}」不在树上`, !before.includes(marker), marker);
  const p = await foldProbe(target);
  check(`（${label}）找得到可点的文本「${target}」`, Boolean(p), JSON.stringify(p));
  if (!p) return;
  await clickAt(p);
  const opened = await bodyText();
  const pAfter = await foldProbe(target);
  check(
    `（${label}）点一下：「${marker}」出现`,
    opened.includes(marker),
    // 失败时把**箭头前后**一起报出来：这一条能区分"没点着"与"点了但没渲染"（实测靠它定位过大象那条）
    opened.includes(marker) ? "" : `箭头 ${p.arrow} → ${pAfter ? pAfter.arrow : "元素不见了"}`,
  );
  const p2 = await foldProbe(target);
  await clickAt(p2 || p);
  const closed = await bodyText();
  check(`（${label}）再点一下：「${marker}」又不在树上`, !closed.includes(marker), closed.slice(-120).replace(/\n/g, " | "));
}

// 标记串都取**注疏正文里独有的那一句**（不是"页面上有字"）：它们只可能来自展开后的注疏。
const YAO_FOLDS = [
  { label: "卦辞注疏", target: "乾，元，亨，利，贞。", marker: "六画者，伏羲所画之卦也" },
  { label: "大象注疏", target: "天行健，君子以自强不息。", marker: "乾卦之象也" },
  { label: "彖辞逐句注疏", target: "大哉乾元，万物资始，乃统天。", marker: "此专以天道明" },
  { label: "爻辞注疏（初九）", target: "潜龙勿用。", marker: "初九者，卦下阳爻之名" },
  { label: "小象注疏（初九）", target: "潜龙勿用，阳在下也。", marker: "阳气在下，君子处微" },
];
for (const f of YAO_FOLDS) await foldByText(f.label, f.target, f.marker);

// ── 变爻 → ○ 标记 → 变卦按钮出现 → 一键跳转 ────────────────────────────────────
//
// 卦画 111111 = 六爻皆阳，所以点任一爻线应当出现 **○**（老阳）。三个后果一起断言：
// 标记出现、**变卦按钮**因此出现（它只在有变爻时渲染）、点了它真的换卦。
{
  // ⚠️ 判据不能写成"页面上有没有 ○"：详情页那句操作提示里**本来就有**
  //    「点击爻线标记变爻（阳→老阳 ○，阴→老阴 ×）」（`main.mbt:1938`）—— 第一版就是这么假红的。
  //    改成**数 ○ 的个数**（点一下就应当 +1）。
  const countMarks = (s) => (s.match(/○/g) || []).length;
  const before = await bodyText();
  const n0 = countMarks(before);
  check("（变爻）初始没有「变卦」按钮", !/变卦/.test(before), before.slice(-80).replace(/\n/g, " | "));
  // 爻线是**图形按钮**（内容只有 ○/× 与线条），`title` 在 react-native-web 上不落 DOM，
  // 而"往上找祖先"会先撞上爻辞那一行 —— 所以直接**按形状**找它：
  // **空文本 + 宽 100–260 + 高 24–40 + 有子元素**（子元素就是那根横条）。
  // （第一版按"爻题左边"的几何去点，点的是爻辞那行的头部 —— 于是"点了没反应"其实是没点着。）
  await evaluate(`(() => {
    const c = Array.from(document.querySelectorAll('*'))
      .filter(e => (e.textContent || '').trim() === '')
      .map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(x => x.r.width >= 100 && x.r.width <= 260 && x.r.height >= 24 && x.r.height <= 40);
    const hit = c.find(x => x.e.children.length > 0) || c[0];
    if (hit) hit.e.scrollIntoView({ block: 'center' });
    return Boolean(hit);
  })()`);
  await sleep(250);
  const line = await evaluate(`(() => {
    const c = Array.from(document.querySelectorAll('*'))
      .filter(e => (e.textContent || '').trim() === '')
      .map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(x => x.r.width >= 100 && x.r.width <= 260 && x.r.height >= 24 && x.r.height <= 40);
    const hit = c.find(x => x.e.children.length > 0) || c[0];
    if (!hit) return null;
    return { x: hit.r.x + hit.r.width / 2, y: hit.r.y + hit.r.height / 2, w: Math.round(hit.r.width), h: Math.round(hit.r.height), kids: hit.e.children.length };
  })()`);
  check("（变爻）按形状找得到爻线（空文本 · 160×32 · 里面有横条）", Boolean(line.value), JSON.stringify(line.value));
  if (line.value) {
    await clickAt(line.value);
    const marked = await bodyText();
    const n1 = countMarks(marked);
    check(`（变爻）点爻线 → **○ 的个数 +1**（${n0} → ${n1}）`, n1 === n0 + 1, `初始 ${n0} / 点后 ${n1}`);
    check("（变爻）有变爻之后「变卦」按钮出现", /变卦/.test(marked), marked.slice(-100).replace(/\n/g, " | "));
    // 变卦按钮：点了应当跳到**变卦**那一卦。
    // ⚠️ 判据要按**实际标了几个变爻**算：这里只点了初九这一根爻线 ⇒ 乾(111111) 第 1 位翻转
    //    ⇒ **111110 = 泽天夬（第 43 卦）**。第一版判据写的是"六爻皆变 → 坤"—— **判据错**，
    //    我只点了一根线（红的是判据，不是应用）。
    const bian = await foldProbe("变卦");
    if (bian) {
      await clickAt(bian);
      let after = "";
      for (let i = 0; i < 20; i++) {
        await sleep(400);
        after = await bodyText();
        if (/泽天夬|第\s*43\s*卦/.test(after)) break;
      }
      check(
        "（变爻）点「变卦」→ 跳到变卦（只标初九 ⇒ 111110 = 泽天夬·第43卦）",
        /泽天夬/.test(after) && /第\s*43\s*卦/.test(after),
        after.slice(0, 90).replace(/\n/g, " | "),
      );
      // ⚠️ 跳走之后**必须回到乾**：后面几条判据（下一卦 / 错综互）都写在乾上，
      //    留在夬上会让它们红成"找不到元素"（第一版就是这样 —— 看起来像功能坏了）。
      check("（夹具）从变卦跳回乾为天·第1卦", await backToQian());
    }
  }
}

// ── 上一卦 / 下一卦 ────────────────────────────────────────────────────────────
{
  const next = await foldProbe("下一卦 ›");
  check("找得到「下一卦 ›」", Boolean(next), JSON.stringify(next));
  if (next) {
    await clickAt(next);
    let moved = "";
    for (let i = 0; i < 20; i++) {
      await sleep(400);
      moved = await bodyText();
      if (/第\s*2\s*卦/.test(moved)) break;
    }
    check("点「下一卦 ›」→ 走到第 2 卦（坤为地）", /坤为地/.test(moved) && /第\s*2\s*卦/.test(moved), moved.slice(0, 90).replace(/\n/g, " | "));
    const prev = await foldProbe("‹ 上一卦");
    if (prev) {
      await clickAt(prev);
      let home = "";
      for (let i = 0; i < 20; i++) {
        await sleep(400);
        home = await bodyText();
        if (/第\s*1\s*卦/.test(home)) break;
      }
      check("点「‹ 上一卦」→ 回到第 1 卦（乾为天）", /乾为天/.test(home) && /第\s*1\s*卦/.test(home), home.slice(0, 90).replace(/\n/g, " | "));
    }
  }
}

// ── 错 / 综 / 互：**第一次点选中预览（出现 ×），再点跳转** ─────────────────────
//
// 这是"两段式交互"：一段判据（点一下就跳）会把"预览"这一步整个漏掉。
// 判据按它的三条后果来：① 选中后**取消预览的 `×`** 出现；② 点 `×` 能取消（`×` 消失）；
// ③ 再点一次（处于选中态）才**真的跳转**。
{
  // ⚠️ 夹具前提：这一段所有判据都写在**乾**上（"乾的错卦是坤"），所以先确保在乾上 ——
  //    上面那几段会跳走（变卦 → 夬、下一卦 → 坤），漏了这一步就会红成"找不到错卦那一枚"，
  //    看起来像功能坏了。
  check("（夹具）错综互这一段之前确实在乾为天·第1卦", await backToQian());
  const chip = await evaluate(`(() => {
    const el = Array.from(document.querySelectorAll('*'))
      .find(e => e.children.length === 0 && /^错卦/.test((e.textContent || '').trim()));
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: (el.textContent || '').trim() };
  })()`);
  check("找得到「错卦」那一枚（关系链接）", Boolean(chip.value), JSON.stringify(chip.value));
  if (chip.value) {
    // ⚠️ `×` 也在那句提示里（`main.mbt:1664` 的「金线＝变动爻 · 再按一次跳转 · × 取消」）——
    //    所以判据是"**文本恰好等于 × 的那个节点**在不在"，不是"页面里有没有 ×"。
    //    取消按钮的 `title` 同样不落 DOM，所以也走"按文本找节点"这条路。
    const findX = () =>
      evaluate(`(() => {
        const el = Array.from(document.querySelectorAll('*'))
          .find(e => e.children.length === 0 && (e.textContent || '').trim() === '×');
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
    check("（错综互）初始没有**单独的**取消预览按钮（文本恰好是 `×` 的节点）", !(await findX()).value);
    await clickAt(chip.value);
    const picked = await findX();
    check("（错综互）第一次点 → 进入**预览**（出现取消按钮 `×`）", Boolean(picked.value), JSON.stringify(picked.value));
    if (picked.value) {
      await clickAt(picked.value);
      const cleared = await bodyText();
      check("（错综互）点 `×` → 预览取消（那个节点没了）", !(await findX()).value);
      check("（错综互）取消**不跳转**（仍在乾为天·第1卦）", /乾为天/.test(cleared) && /第\s*1\s*卦/.test(cleared), cleared.slice(0, 80).replace(/\n/g, " | "));
    }
    // 再点一次（这次是选中态下的第二次点）→ 跳转
    const chip2 = await evaluate(`(() => {
      const el = Array.from(document.querySelectorAll('*'))
        .find(e => e.children.length === 0 && /^错卦/.test((e.textContent || '').trim()));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    if (chip2.value) {
      await clickAt(chip2.value); // 选
      await clickAt(chip2.value); // 再点 = 跳转
      let jumped = "";
      for (let i = 0; i < 20; i++) {
        await sleep(400);
        jumped = await bodyText();
        if (/坤为地/.test(jumped)) break;
      }
      check("（错综互）选中之后再点一次 → **真的跳转**（乾的错卦是坤）", /坤为地/.test(jumped), jumped.slice(0, 90).replace(/\n/g, " | "));
    }
  }
}

// ── D. 干净 ─────────────────────────────────────────────────────────────────
check("没有 console.error / 未捕获异常", problems.length === 0, problems.slice(0, 3).join(" ;; "));

// 收尾诊断：把"这一轮跑出来的关键量"打出来（不是判据，是给下一个人看的现场）
const final = await evaluate(`(() => {
  const c = document.querySelector('canvas');
  return c ? { w: c.width, h: c.height } : null;
})()`);
console.log(`      · 画布位图：${final.value ? `${final.value.w}×${final.value.h}` : "不在当前页（已进入详情页，正常）"}`);

// 截图
try {
  await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (shot.result?.data) {
    fs.writeFileSync(OUT, Buffer.from(shot.result.data, "base64"));
    console.log(`      截图：${OUT}`);
  }
} catch {}

const pass = results.filter((r) => r.ok).length;
console.log("\n================ 阅读器（迁移后）=================");
console.log(`通过 ${pass}  失败 ${results.length - pass}`);
for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL  ${r.name}`);
if (problems.length) {
  console.log("--- 控制台错误 ---");
  for (const p of problems.slice(0, 6)) console.log("  " + p);
}
ws.close();
// 显式退出：不退出的进程会被超时杀掉，而被杀的进程不执行清理（下次报 EADDRINUSE）
process.exit(results.some((r) => !r.ok) ? 1 : 0);
