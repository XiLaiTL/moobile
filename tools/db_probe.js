// 本地数据库能力的**宿主侧探针**（Web）。
//
// 验的是"链路通不通"，不是"应用对不对"：
//   1. expo-sqlite 在 Web 上能不能起来（wasm + OPFS + worker）
//   2. metro.config.js 的 COOP/COEP 是否生效（crossOriginIsolated）
//   3. `MOBILE_HOST.db` 的契约是否与 `sqlite/sqlite.mbt` 一致
//      （snake_case 键、JSON 字符串参数与返回值、布尔→0/1）
//
//   node tools/db_probe.js        # 需要 Metro 在 8081
//
// 与 `tools/verify_web.js` 的分工：那个验"UI 全链路 26 项"，这个只验数据库这一条边。
const { spawn, execSync } = require("child_process");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9232;
const URL = "http://localhost:8081";
const PROFILE = process.env.TEMP + "\\chrome_moobile_db_" + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
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
  await send("Page.navigate", { url: URL });
  await sleep(14000);

  const evalJs = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.result?.exceptionDetails)
      return { __err: JSON.stringify(r.result.exceptionDetails) };
    return r.result?.result?.value;
  };

  check(
    "页面已挂载（能找到 MOBILE_HOST）",
    (await evalJs("typeof globalThis.MOBILE_HOST")) === "object",
  );

  const isolated = await evalJs("globalThis.crossOriginIsolated === true");
  console.log(`       crossOriginIsolated = ${isolated}（仅同步 API 才需要它）`);

  check(
    "MOBILE_HOST.db 已注册（installDb 生效）",
    (await evalJs("typeof globalThis.MOBILE_HOST.db?.all")) === "function",
    await evalJs("Object.keys(globalThis.MOBILE_HOST.db || {}).join(',')"),
  );

  // 契约走一遍：DDL → 插入（含中文与布尔）→ 查询 → 删除
  const r = await evalJs(`(async () => {
    const db = globalThis.MOBILE_HOST.db;
    const out = {};
    try {
      await db.exec("DROP TABLE IF EXISTS probe; CREATE TABLE probe(id INTEGER PRIMARY KEY, body TEXT NOT NULL, done INTEGER NOT NULL);");
      const w = await db.run("INSERT INTO probe(body, done) VALUES (?, ?)", JSON.stringify(["买 菜·中文", true]));
      out.write = JSON.parse(w);
      out.rows = JSON.parse(await db.all("SELECT id, body, done FROM probe", "[]"));
      const del = await db.run("DELETE FROM probe WHERE id = ?", JSON.stringify([out.write.last_insert_row_id]));
      out.deleted = JSON.parse(del);
      out.after = JSON.parse(await db.all("SELECT id FROM probe", "[]"));
      out.ok = true;
    } catch (e) {
      out.ok = false;
      out.err = String(e && e.message ? e.message : e);
    }
    return out;
  })()`);

  if (r && r.__err) {
    check("db 契约调用", false, r.__err);
  } else {
    check(
      "exec + run 返回 snake_case 的 last_insert_row_id",
      r?.write?.last_insert_row_id === 1,
      JSON.stringify(r?.write),
    );
    check(
      "all 返回 JSON 行数组（中文与布尔都活下来了）",
      Array.isArray(r?.rows) && r.rows[0]?.body === "买 菜·中文" && r.rows[0]?.done === 1,
      JSON.stringify(r?.rows),
    );
    check(
      "带参数 DELETE 生效",
      r?.deleted?.changes === 1 && Array.isArray(r?.after) && r.after.length === 0,
      JSON.stringify(r?.deleted),
    );
  }

  check(
    "无未捕获异常",
    problems.length === 0,
    problems.slice(0, 3).join(" | "),
  );

  // ---------- 应用级：界面显示的清单 == 库里的活行数 ----------
  const footerCount = await evalJs(`(() => {
    const m = document.body.innerText.match(/共\\s*(\\d+)\\s*项/);
    return m ? Number(m[1]) : null;
  })()`);
  const dbCount = await evalJs(`(async () => {
    const rows = JSON.parse(await globalThis.MOBILE_HOST.db.all("SELECT id FROM todo WHERE deleted = 0", "[]"));
    return rows.length;
  })()`);
  check(
    "页脚项数与库里的活行数一致",
    footerCount !== null && footerCount === dbCount,
    `界面=${footerCount} 库=${dbCount}`,
  );

  const before = await evalJs(`document.body.innerText`);
  await send("Page.reload", { ignoreCache: true });
  await sleep(12000);
  const after = await evalJs(`document.body.innerText`);
  const footerAfter = await evalJs(`(() => {
    const m = document.body.innerText.match(/共\\s*(\\d+)\\s*项/);
    return m ? Number(m[1]) : null;
  })()`);
  check(
    "刷新后清单仍在（OPFS 持久化，不是内存）",
    footerAfter === dbCount && /expo-sqlite/.test(after || ""),
    `刷新前=${dbCount} 刷新后=${footerAfter}`,
  );

  const passed = results.filter((x) => x.ok).length;
  console.log(`\n================ 汇总 ================`);
  console.log(`通过 ${passed} / ${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error("探针失败:", e);
  process.exit(2);
});
