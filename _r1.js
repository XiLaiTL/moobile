// R1 可行性测量（web / react-native-web）
//
// 目的：不靠肉眼，用几何数据回答「RN 能不能接受 yi 那种文本排版」。
// 手法：`Range.getClientRects()` 数**行盒**（line box）—— 直接看出有没有换行、换了几行。
//
//   node _r1.js
const fs = require("fs");
const { spawn, execSync } = require("child_process");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9235;
const OUT = __dirname + "/_r1"; // 从脚本位置推导，不写死盘符
const URL = "http://localhost:8081";
const PROFILE = process.env.TEMP + "\\chrome_r1_" + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MEASURE = `(() => {
  // 选到「RN 组件根」：先取文本最紧的那个元素，再向上爬到文本完全相同的最高祖先。
  // 不这么做会量到 RNW 内部包的一层 span，其样式是继承来的，量不到我们设的 minWidth 等。
  const tightest = (txt, exact) => {
    const c = [...document.querySelectorAll('*')].filter(e =>
      exact ? (e.textContent || '').trim() === txt
            : (e.textContent || '').includes(txt));
    if (!c.length) return null;
    c.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    return c[0];
  };
  const root = (el) => {
    if (!el) return null;
    let n = el;
    while (n.parentElement &&
           (n.parentElement.textContent || '') === (n.textContent || '')) n = n.parentElement;
    return n;
  };
  const lines = (el) => {
    if (!el) return -1;
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.getClientRects().length;
  };
  const info = (el, label) => {
    if (!el) return { label, missing: true };
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    return {
      label,
      lines: lines(el),
      w: +b.width.toFixed(1),
      h: +b.height.toFixed(1),
      fontSize: cs.fontSize,
      letterSpacing: cs.letterSpacing,
      marginRight: cs.marginRight,
      minWidth: cs.minWidth,
      textAlign: cs.textAlign,
      display: cs.display,
      overflow: cs.overflow,
      overflowY: cs.overflowY,
    };
  };
  const out = {};
  out.ci_long = info(root(tightest('君子终日乾乾，夕惕若厉，无咎。', true)), '爻辞·九三');
  out.ci_short = info(root(tightest('潜龙勿用。', true)), '爻辞·初九');
  out.xiang = info(root(tightest('潜龙勿用，阳在下也。', false)), '小象·p');
  out.xlab = info(root(tightest('小象', true)), '小象·xlab');
  out.fold = info(root(tightest('▸', true)), '折叠箭头');
  out.title = info(root(tightest('初九', true)), '爻题·初九');
  const bars = [...document.querySelectorAll('div')].filter(e => {
    const r = e.getBoundingClientRect();
    return Math.abs(r.width - 160) < 1.5 && Math.abs(r.height - 32) < 1.5;
  });
  out.bar = { label: '爻画列', count: bars.length, width: bars.length ? +bars[0].getBoundingClientRect().width.toFixed(1) : null };
  const note = [...document.querySelectorAll('div')].find(e => {
    const cs = getComputedStyle(e);
    return cs.borderLeftWidth === '2px' && cs.borderTopWidth === '1px';
  });
  out.note_box = info(note, '注疏盒');
  // 滚动容器：找 RNW 的 ScrollView（会有 overflow-y: auto/scroll）
  const sc = [...document.querySelectorAll('div')].find(e => {
    const cs = getComputedStyle(e);
    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 10;
  });
  out.scroller = sc ? { label: '滚动容器', clientH: sc.clientHeight, scrollH: sc.scrollHeight, overflowY: getComputedStyle(sc).overflowY } : { label: '滚动容器', missing: true };
  out.docHeight = document.documentElement.scrollHeight;
  return out;
})()`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + PROFILE, "about:blank",
  ], { stdio: "ignore" });
  const pid = chrome.pid;
  process.on("exit", () => { try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" }); } catch (e) {} });

  let targets = [];
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.length) break; } catch (e) {}
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  const problems = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === "Runtime.exceptionThrown") {
      problems.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    }
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: URL });
  await sleep(14000);

  const evalJs = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (r.result?.exceptionDetails) return { __err: JSON.stringify(r.result.exceptionDetails.text) };
    return r.result?.result?.value;
  };

  // 切到 R1 屏
  const pt = await evalJs(`(() => {
    const all = [...document.querySelectorAll('*')].filter(e => (e.textContent||'').trim() === 'R1 样本 →');
    if (!all.length) return null;
    const el = all[all.length-1]; const r = el.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 };
  })()`);
  if (!pt) {
    const t = await evalJs("document.body.innerText");
    console.log("FAIL 找不到 R1 入口。pt =", JSON.stringify(pt));
    console.log("--- 页面文本 ---\n" + t);
    process.exit(1);
  }
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
  await sleep(1800);

  const rep = await evalJs(MEASURE);
  console.log("================ R1 测量（web / RNW，390x844）================");
  for (const [k, v] of Object.entries(rep)) console.log(k.padEnd(10), JSON.stringify(v));
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  if (shot.result?.data) {
    fs.writeFileSync(`${OUT}/shot-web-r1.png`, Buffer.from(shot.result.data, "base64"));
    console.log("saved " + OUT + "/shot-web-r1.png");
  }
  if (problems.length) console.log("控制台异常:", problems.slice(0, 3).join(" | "));
  fs.writeFileSync(`${OUT}/report-web.json`, JSON.stringify(rep, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error("脚本出错:", e); process.exit(2); });
