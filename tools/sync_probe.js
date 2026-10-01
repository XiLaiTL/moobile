// **同步链路探针**（Web）：本地库 ↔ MoonBit 后端 的完整往返。
//
// 验的是"网络请求链路真的通了"，而不是"界面看着对"：
//   1. 服务器已有的数据能拉下来并合并进本地库
//   2. 本地新增（负 id）能推上去，并**换成服务器 id**
//   3. 推完之后本地没有负 id、没有 dirty，服务器上的条数与界面一致
//
//   node tools/sync_probe.js      # 需要 Metro 在 8081、后端在 8787
const { spawn, execSync } = require("child_process");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9233;
const URL = "http://localhost:8081";
const API = "http://127.0.0.1:8787";
const PROFILE = process.env.TEMP + "/chrome_moobile_sync_" + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
}

async function api(path, init) {
  const r = await fetch(API + path, init);
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function main() {
  // ---------- 0. 把服务器清成已知状态，并放两条已知数据 ----------
  const existing = await api("/todos");
  for (const t of existing.body || []) {
    await api(`/todos/${t.id}`, { method: "DELETE" });
  }
  await api("/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "服务器下发的第一条" }),
  });
  await api("/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "服务器下发的第二条" }),
  });
  const srv0 = (await api("/todos")).body;
  console.log(`      服务器初始状态：${srv0.length} 条（${srv0.map((t) => t.id).join(",")}）`);

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
    } else if (msg.method === "Runtime.exceptionThrown") {
      problems.push(
        "exception: " +
          (msg.params.exceptionDetails.exception?.description ||
            msg.params.exceptionDetails.text),
      );
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
  const clickAt = async (pt) => {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", {
        type,
        x: pt.x,
        y: pt.y,
        button: "left",
        clickCount: 1,
      });
    }
    await sleep(400);
  };
  const clickText = async (label) => {
    const pt = await centerOfText(label);
    if (!pt || pt.__err) return false;
    await clickAt(pt);
    return true;
  };
  const dbQuery = async (sql) =>
    evalJs(`(async () => JSON.parse(await globalThis.MOBILE_HOST.db.all(${JSON.stringify(
      sql,
    )}, "[]")))()`);

  // ---------- 1. 同步前：本地还是种子数据 ----------
  let t = await bodyText();
  check("同步前显示的是本地种子数据", t.includes("共 3 项"), t.split("\n").filter((l) => l.includes("共"))[0]);
  check("同步状态初始为「尚未与服务器同步」", t.includes("尚未与服务器同步"));

  // ---------- 2. 点「同步」：拉服务器数据并合并 ----------
  check("点到了「同步」", await clickText("同步"));
  await sleep(4000);
  t = await bodyText();
  const local0 = await dbQuery("SELECT id, text, dirty, deleted FROM todo");
  check(
    "服务器下发的两条进了本地库",
    t.includes("服务器下发的第一条") && t.includes("服务器下发的第二条"),
    JSON.stringify(local0),
  );
  check("同步状态变成「已与服务器同步」", t.includes("已与服务器同步"));
  check(
    "服务器为准：本地种子里服务器没有的那些被清掉（只剩 2 条）",
    (await dbQuery("SELECT id FROM todo")).length === 2,
    JSON.stringify(await dbQuery("SELECT id, text FROM todo")),
  );

  // ---------- 3. 本地新增一条（负 id、dirty）----------
  const inputPt = await evalJs(`(() => {
    const el = document.querySelector('input');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await clickAt(inputPt);
  await send("Input.insertText", { text: "本地新增待推送" });
  await sleep(600);
  check("点到了「添加」", await clickText("添加"));
  await sleep(1200);
  const localNew = await dbQuery("SELECT id, dirty FROM todo WHERE text = '本地新增待推送'");
  check(
    "新条目是负 id 且标记为 dirty",
    localNew.length === 1 && localNew[0].id < 0 && localNew[0].dirty === 1,
    JSON.stringify(localNew),
  );

  // ---------- 4. 再同步：推上去并换 id ----------
  check("再点一次「同步」", await clickText("同步"));
  await sleep(5000);
  t = await bodyText();
  const srv1 = (await api("/todos")).body;
  check(
    "服务器现在有 3 条（本地新增推上去了）",
    srv1.length === 3 && srv1.some((x) => x.text === "本地新增待推送"),
    JSON.stringify(srv1.map((x) => [x.id, x.text])),
  );
  const localAfter = await dbQuery("SELECT id, dirty, deleted FROM todo");
  check(
    "本地负 id 已换成服务器 id，且不再有 dirty",
    localAfter.length === 3 && localAfter.every((r) => r.id > 0 && r.dirty === 0),
    JSON.stringify(localAfter),
  );
  check(
    "界面条数与服务器一致",
    t.includes("共 3 项") && srv1.length === 3,
    t.split("\n").filter((l) => l.includes("共"))[0],
  );
  check("同步状态为「已与服务器同步」", t.includes("已与服务器同步"));
  check("无未捕获异常", problems.length === 0, problems.slice(0, 3).join(" | "));

  const passed = results.filter((x) => x.ok).length;
  console.log(`\n================ 汇总 ================`);
  console.log(`通过 ${passed} / ${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error("探针失败:", e);
  process.exit(2);
});
