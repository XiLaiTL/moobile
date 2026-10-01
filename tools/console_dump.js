// 把页面的控制台输出与控制台错误原样 dump 出来 —— 排查"白屏"用的。
//
//   node tools/console_dump.js [url]
//
// 白屏时最有用的是**模块加载期的报错**：`tools/verify_web.js` 会因为"页面根本没渲染"而
// 一路 FAIL，但看不出原因；这个脚本直接把 console / exception / log 三类事件打出来。
const { spawn, execSync } = require("child_process");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9234;
const URL = process.argv[2] || "http://localhost:8081";
const PROFILE = process.env.TEMP + "/chrome_moobile_console_" + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
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
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let id = 0;
  const pending = new Map();
  const print = (kind, text) => console.log(`[${kind}] ${text}`);
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      print(
        msg.params.type,
        msg.params.args
          .map((a) => a.value ?? a.description ?? a.type)
          .join(" "),
      );
    } else if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      print("EXCEPTION", d.exception?.description || d.text);
    } else if (msg.method === "Log.entryAdded") {
      print(msg.params.entry.level, msg.params.entry.text);
    } else if (msg.method === "Network.loadingFailed") {
      print(
        "NETWORK-FAIL",
        `${msg.params.errorText} type=${msg.params.type} blocked=${msg.params.blockedReason || "-"}`,
      );
    } else if (msg.method === "Network.responseReceived") {
      const r = msg.params.response;
      if (r.status >= 400 || /bundle|\.js/.test(r.url)) {
        print("NETWORK", `${r.status} ${r.url.slice(0, 120)}`);
      }
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Network.enable");
  await send("Page.navigate", { url: URL });
  await sleep(15000);

  const probe = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      host: typeof globalThis.MOBILE_HOST,
      app: typeof globalThis.__moobileApp,
      appKeys: Object.keys(globalThis.__moobileApp || {}),
      href: location.href,
      ready: document.readyState,
      htmlLen: document.documentElement.outerHTML.length,
      scripts: [...document.querySelectorAll('script')].map(s => s.src || '(inline)'),
      body: document.body.innerText.slice(0, 200),
    })`,
    returnByValue: true,
  });
  print("STATE", probe.result?.result?.value);
  process.exit(0);
}

main().catch((e) => {
  console.error("dump 失败:", e);
  process.exit(2);
});
