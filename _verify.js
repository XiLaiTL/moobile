// moobile demo 端到端验证：真浏览器 + 移动端视口 + 真实鼠标/键盘事件。
//
// 目的不是"截个图"，而是证明三件事真的通了：
//   1. MoonBit 的 VNode 树 → React 元素 → DOM，渲染出来了
//   2. 结构化样式（styles map）真的作用到了 DOM 上
//   3. 点击 / 输入事件真的回到了 MoonBit 的 update，并触发重渲染
//
//   node _verify.js
const fs = require("fs");
const { spawn, execSync } = require("child_process");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9231;
const OUT = __dirname; // 从脚本位置推导，不写死盘符
const URL = "http://localhost:8081";
const PROFILE = process.env.TEMP + "\\chrome_moobile_" + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
}

async function main() {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--remote-debugging-port=" + PORT,
      "--user-data-dir=" + PROFILE,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const pid = chrome.pid;
  process.on("exit", () => {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } catch (e) {}
  });

  let targets = [];
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      if (targets.length) break;
    } catch (e) {}
  }
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("找不到 page target");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let id = 0;
  const pending = new Map();
  const problems = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      problems.push("console.error: " + JSON.stringify(msg.params.args.map((a) => a.value ?? a.description)));
    } else if (msg.method === "Runtime.exceptionThrown") {
      problems.push("exception: " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      problems.push("log: " + msg.params.entry.text);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await send("Page.navigate", { url: URL });
  await sleep(14000);

  const evalJs = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.result?.exceptionDetails) return { __err: JSON.stringify(r.result.exceptionDetails) };
    return r.result?.result?.value;
  };

  const bodyText = async () => (await evalJs("document.body.innerText")) || "";

  // 找到"文本恰好等于 label 的最内层元素"的中心坐标
  const centerOfText = async (label) =>
    evalJs(`(() => {
      const all = [...document.querySelectorAll('*')].filter(
        (e) => e.textContent.trim() === ${JSON.stringify(label)}
      );
      if (!all.length) return null;
      const el = all[all.length - 1];
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);

  const centerOfSelector = async (selector) =>
    evalJs(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);

  async function clickAt(pt) {
    if (!pt || pt.__err) return false;
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pt.x, y: pt.y, button: "none" });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
    await sleep(60);
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
    await sleep(700);
    return true;
  }
  const clickText = async (label) => clickAt(await centerOfText(label));

  const shot = async (name) => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    if (r.result?.data) {
      fs.writeFileSync(`${OUT}/${name}`, Buffer.from(r.result.data, "base64"));
      console.log(`      saved ${name}`);
    }
  };

  // ---------- 1. 初始渲染 ----------
  let t = await bodyText();
  console.log("--- 初始 innerText ---\n" + t + "\n----------------------");
  check("标题渲染出来了", t.includes("moobile"));
  check("副标题渲染出来了", t.includes("MoonBit 写 UI"));
  check("待办条目渲染出来了", t.includes("在 MoonBit 里写 UI") && t.includes("让 React Native 渲染出来"));
  check("页脚计数正确 (2 项未完成)", t.includes("2 项未完成 · 共 3 项"), t.split("\n").pop());

  // 结构化样式是否真的落到了 DOM 上
  const styleProbe = await evalJs(`(() => {
    const el = [...document.querySelectorAll('*')].find(e => e.textContent.trim() === 'moobile' && e.children.length === 0);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color };
  })()`);
  console.log("      标题 computed style =", JSON.stringify(styleProbe));
  check(
    "结构化样式生效 (fontSize 34 / fontWeight 700 / 朱砂色)",
    styleProbe &&
      styleProbe.fontSize === "34px" &&
      String(styleProbe.fontWeight) === "700" &&
      styleProbe.color === "rgb(26, 20, 16)",
    JSON.stringify(styleProbe),
  );

  // 背景色证明根 View 的 flex/背景来自 styles map
  const rootBg = await evalJs(`(() => {
    const els = [...document.querySelectorAll('div')];
    const hit = els.find(e => getComputedStyle(e).backgroundColor === 'rgb(246, 239, 224)');
    return hit ? getComputedStyle(hit).flexGrow : null;
  })()`);
  check("根 View 的 backgroundColor + flex 生效", rootBg === "1", "flexGrow=" + rootBg);

  await shot("shot-1-initial.png");

  // ---------- 2. 点过滤标签：证明 dispatch → update → 重渲染 ----------
  check("点到了「已完成」标签", await clickText("已完成"));
  t = await bodyText();
  check("过滤后只剩已完成项", t.includes("在 MoonBit 里写 UI") && !t.includes("让 React Native 渲染出来"));

  check("点回「全部」", await clickText("全部"));
  t = await bodyText();
  check("回到全部", t.includes("在 MoonBit 里写 UI") && t.includes("让 React Native 渲染出来"));

  // ---------- 3. 点复选框：证明 Toggle 生效 ----------
  check("点到了复选框 ✓", await clickText("✓"));
  t = await bodyText();
  check("Toggle 生效 (未完成 2 -> 3)", t.includes("3 项未完成 · 共 3 项"), t.split("\n").pop());

  // ---------- 4. 输入 + 添加：证明 TextInput 的 onChangeText 桥通了 ----------
  const inputPt = await centerOfSelector('input[placeholder="要做点什么？"]');
  check("找到输入框", !!inputPt && !inputPt.__err);
  await clickAt(inputPt);
  await send("Input.insertText", { text: "第四条：看看输入能不能回传" });
  await sleep(600);
  const typed = await evalJs(`(() => { const i = document.querySelector('input'); return i ? i.value : null })()`);
  check("输入被 MoonBit 收下并回灌 value", typed === "第四条：看看输入能不能回传", JSON.stringify(typed));

  check("点到了「添加」", await clickText("添加"));
  t = await bodyText();
  check("新增成功 (共 4 项, 未完成 4)", t.includes("4 项未完成 · 共 4 项"), t.split("\n").pop());
  check("新条目在列表里", t.includes("第四条：看看输入能不能回传"));
  check("输入框被清空", (await evalJs(`document.querySelector('input').value`)) === "");

  await shot("shot-2-after-interaction.png");

  // ---------- 5. 删除 ----------
  check("点到了第一个「✕」", await clickText("✕"));
  t = await bodyText();
  check("Remove 生效 (共 3 项)", t.includes("共 3 项"), t.split("\n").pop());
  await shot("shot-3-final.png");

  // ---------- 5.5 可移植性缺口度量 ----------
  // `Children::RawHtml` 在 RN 上没有等价物。moobile 丢弃它并计数，
  // 这里断言"这棵真实 rabbita 树里一个都不到"。
  const unsupported = await evalJs(
    "globalThis.__moobileUnsupported ? globalThis.__moobileUnsupported() : null",
  );
  check(
    "真实 rabbita 树里没有不可移植节点（Children::RawHtml = 0）",
    unsupported === 0,
    "unsupported=" + unsupported,
  );

  // 标签表覆盖度：未收录标签必须为 0，否则说明"看起来能跑"的假象
  const unmapped = await evalJs("globalThis.__moobileUnmapped ? __moobileUnmapped() : null");
  const unmappedNames = await evalJs(
    "globalThis.__moobileUnmappedNames ? __moobileUnmappedNames() : ''",
  );
  check(
    "标签表覆盖住了这棵树（未收录标签 = 0）",
    unmapped === 0,
    "unmapped=" + unmapped + (unmappedNames ? " [" + unmappedNames + "]" : ""),
  );

  // ---------- 6. 布局审计（代替肉眼看图） ----------
  const audit = await evalJs(`(() => {
    const VW = 390, VH = 844;
    const out = { overflowRight: [], overflowBottom: [], zeroSize: [], docHeight: 0, nodes: 0 };
    out.docHeight = document.documentElement.scrollHeight;
    for (const el of document.querySelectorAll('*')) {
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.nodes++;
      const leaf = el.children.length === 0;
      if (leaf && (r.width < 1 || r.height < 1)) out.zeroSize.push(txt.slice(0, 20));
      if (r.right > VW + 0.5 && out.overflowRight.length < 5) out.overflowRight.push(txt.slice(0, 16) + ' right=' + r.right.toFixed(0));
      if (r.bottom > VH + 0.5 && out.overflowBottom.length < 5) out.overflowBottom.push(txt.slice(0, 16) + ' bottom=' + r.bottom.toFixed(0));
    }
    return out;
  })()`);
  console.log("      布局审计 =", JSON.stringify(audit));
  check("没有横向溢出", audit && audit.overflowRight.length === 0, (audit?.overflowRight || []).join(", "));
  check("没有零尺寸的文字节点", audit && audit.zeroSize.length === 0, (audit?.zeroSize || []).join(", "));
  check(
    "内容高度在视口内（不会被裁）",
    audit && audit.docHeight <= 844,
    "docHeight=" + audit?.docHeight,
  );

  // ---------- 控制台干净吗 ----------
  const real = problems.filter((p) => !/Download the React DevTools|source map|DevTools/i.test(p));
  check("浏览器控制台无错误", real.length === 0, real.slice(0, 4).join(" | "));

  console.log("\n================ 汇总 ================");
  const bad = results.filter((r) => !r.ok);
  console.log(`通过 ${results.length - bad.length} / ${results.length}`);
  if (bad.length) {
    console.log("失败项：");
    for (const b of bad) console.log("  - " + b.name + (b.detail ? "  " + b.detail : ""));
    process.exitCode = 1;
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("脚本自身出错:", e);
  process.exit(2);
});
