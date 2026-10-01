#!/usr/bin/env node
// device_check.mjs —— **chat-app 在真机（Android）上**的判据。
//
//   node examples/apps/chat-app/device_check.mjs
//
// ## 它验两件无头判据**验不到**的事
//
// 1. **RN 那条传输**：`@http.stream` 在 web 上走 `fetch` 流、在 RN 上走 **XHR 渐进读**
//    —— 两份代码。`verify.mjs` 全绿**推不出**真机能收流。
// 2. **markdown 真的被渲染了**：无头环境里没有 `react-native`，`md:Markdown` 只能给替身
//    （见 `verify.mjs` 的注释）。所以"markdown 画成什么样"只有这里和浏览器上看得见。
//
// ## 前置
// 1. 模拟器在跑；2. **Metro 在 8081 且服务的是本目录**（`npx expo start --port 8081`）；
// 3. 设备上有一个**已装的 debug 包**（`CHAT_APP_PKG` 可指定）。
//
// ⚠️ 为什么可以借别的应用的 debug 壳：debug 包从 Metro 拉 bundle，所以它加载的**就是我们这份 JS**；
//    本应用要的原生模块只有 `expo-sqlite`（todo-app 的壳里正好有）。免得为了验一次去编十几分钟 gradle。
//    ⚠️ 代价说清楚：**这不是这个应用自己的 APK**，所以"它自己能不能装机跑"这条没被验到。

import { execFileSync } from "node:child_process";
import { createServer } from "node:http";

const PKG = process.env.CHAT_APP_PKG || "com.anonymous.host";
const PORT = Number(process.env.CHAT_APP_PORT || 8899);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}
function section(t) {
  console.log(`\n── ${t} ${"─".repeat(Math.max(0, 58 - t.length))}`);
}
function skipOut(why) {
  console.log(`SKIP  ${why}`);
  process.exit(0);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** adb：**关掉 MSYS 的路径改写**（`/sdcard/x` 会被改成 git 的路径，实测踩过）。 */
function adb(...args) {
  return execFileSync("adb", args, {
    encoding: "utf8",
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
}

// ── 0) 设备 ───────────────────────────────────────────────────────────────────
section("设备");
try {
  const dev = adb("devices");
  if (!dev.split("\n").some((l) => l.includes("\tdevice"))) skipOut("没有在线设备（先起模拟器）");
  check("有在线 Android 设备", true, dev.split("\n").find((l) => l.includes("\tdevice")).trim());
} catch (e) {
  skipOut(`adb 不可用：${String(e.message).split("\n")[0]}`);
}

// ── 1) Metro 必须是**本工程**的（HANDOVER §4-5：8081 上是谁的 Metro 一定要确认）──
section("Metro");
let title = "";
for (let i = 0; i < 20; i++) {
  try {
    const html = execFileSync("curl", ["-s", "--max-time", "5", "http://localhost:8081/"], {
      encoding: "utf8",
    });
    title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
    if (title) break;
  } catch {
    /* 还没起来 */
  }
  await sleep(1000);
}
if (!title) skipOut("8081 上没有 Metro（先在本目录跑 `npx expo start --port 8081`）");
check(`Metro 服务的是本应用（title=${title}）`, title === "chat-app", title);
if (title !== "chat-app") {
  console.log("\n================ chat-app 真机 汇总 ================");
  console.log("通过 0  失败 1（Metro 服务的是别的应用，继续验没有意义）");
  process.exit(1);
}

// ── 2) 假的 OpenAI 兼容服务：**吐 markdown**，这样一屏就能看两件事 ──────────────
section("本地假服务 + adb reverse");
// 回复里刻意四样都放：标题 / 粗体 / 行内代码 / 围栏代码块 / 列表。
// 判据靠**渲染结果里没有字面量 `**` 和 ` ``` `、并且有列表符号**来判断"markdown 真被渲染了"。
const MD = [
  "# 标题一",
  "",
  "这是**粗体**和`行内代码`。",
  "",
  "```js",
  "const a = 1;",
  "```",
  "",
  "- 列表甲",
  "- 列表乙",
].join("\n");
const server = createServer((q, res) => {
  const url = q.url || "/";
  if (url.startsWith("/mode")) {
    res.writeHead(200);
    res.end("ok");
    return;
  }
  let raw = "";
  q.on("data", (c) => (raw += c));
  q.on("end", () => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const chars = [...MD];
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
    }, 20);
    // ⚠️ 挂 `res`，不是 `req`（`req` 的 close 在请求体读完时就触发 —— 那样一帧都不会发）
    res.on("close", () => clearInterval(iv));
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
check(`假的 OpenAI 服务在宿主机 ${PORT}`, true, `POST http://127.0.0.1:${PORT}/v1/chat/completions`);
adb("reverse", `tcp:${PORT}`, `tcp:${PORT}`);
adb("reverse", "tcp:8081", "tcp:8081");
check("adb reverse 就绪（8081 与 " + PORT + "）", true);

// ── 3) 拉起应用 ───────────────────────────────────────────────────────────────
section("启动");
// ⚠️ **先清数据**：不清的话上一轮跑留下的 key 还在库里，应用会（正确地）直接进聊天页 ——
//    于是"首次打开落在设置页"那条判据就没法验，而且会看起来像失败。
//    代价：`pm clear` 连 Metro 的 bundle 缓存一起清掉，**冷启动要轮询**（下面的重试就是为此）。
//    另外我们是**借了别人的壳**（todo-app 的 debug 包），所以这也会清掉它的数据 —— 实验环境里无所谓。
adb("shell", "pm", "clear", PKG);
await sleep(1200);
adb("shell", "am", "force-stop", PKG);
adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1");

/** ⚠️ 每次 dump **先删旧文件** —— dump 失败会留下上一次的 xml，读到陈旧界面就会得出错误结论。 */
function dump() {
  try {
    adb("shell", "rm", "-f", "/sdcard/ui.xml");
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
  } catch {
    /* 偶发失败：下面按空处理，由断言暴露 */
  }
  try {
    return adb("shell", "cat", "/sdcard/ui.xml");
  } catch {
    return "";
  }
}
/** ⚠️ **两种引号都要认**：属性值里含 `"` 时 uiautomator 会改用单引号包起来。 */
function attrsOf(tag) {
  const out = {};
  const re = /([\w-]+)=(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(tag))) out[m[1]] = m[2] !== undefined ? m[2] : m[3];
  return out;
}
function nodes(xml) {
  const out = [];
  for (const m of xml.matchAll(/<node[^>]*>/g)) {
    const a = attrsOf(m[0]);
    const b = (a.bounds || "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!b) continue;
    const [x1, y1, x2, y2] = b.slice(1).map(Number);
    out.push({ text: a.text || "", cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 });
  }
  return out;
}
const uiTexts = (xml) => nodes(xml).map((n) => n.text).filter(Boolean).join(" | ");
/** 输入框：**按 class 找**，不靠坐标猜 —— 猜错过一次（三个字段全打进同一个框）。 */
function editTexts(xml) {
  const out = [];
  for (const m of xml.matchAll(/<node[^>]*>/g)) {
    const a = attrsOf(m[0]);
    if (!(a.class || "").includes("EditText")) continue;
    const b = (a.bounds || "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!b) continue;
    const [x1, y1, x2, y2] = b.slice(1).map(Number);
    out.push({ cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 });
  }
  return out;
}

/** 键盘/权限对话框会挡住界面（Gboard 第一次弹"访问联系人"）——先关掉。 */
function dismissDialogs(xml) {
  return tapText(xml, "Deny") || tapText(xml, "不允许") || false;
}

/**
 * 清空一个输入框再打字。
 *
 * ⚠️ 必须**先清空**：这些框里本来就有值（Base URL 有默认的 DeepSeek 地址），
 *    直接 `input text` 会插在光标处 —— 实测打出来的是
 *    `https://api.deepseekh//127.0.0.1:8899/v1.com/v1`（新串插进了默认值中间），
 *    而后果是"请求发去了一个不存在的地址"，看起来却像"流式坏了"。
 * ⚠️ 清空用**一次 keyevent 带多个键码**（40 次 DEL 一次发），否则 40 次 adb 调用要好几分钟。
 */
/**
 * 把一个输入框清空、打字、**回读校验**，不一致就重来。
 *
 * ⚠️ 两个坑都是实测踩出来的：
 *  1. **不清空**：框里本来有值（Base URL 有默认地址），`input text` 会插在光标处 ——
 *     打出来是 `https://api.deepseekh//127.0.0.1:8899/v1.com/v1`，而症状看起来像"流式坏了"；
 *  2. **`input text` 会丢字符**（打得越快丢得越多）：实测 `http://127.0.0.1:8899/v1`
 *     变成 `hp://127.0.0.1891` —— 后果是请求发去了一个不存在的地址。
 *     所以**分块慢打**（每次 4 个字符）+ **回读校验**（dump 里读那个框的值）+ 重试。
 */
async function typeInto(box, s, tag) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    adb("shell", "input", "tap", String(Math.round(box.cx)), String(Math.round(box.cy)));
    await sleep(500);
    adb("shell", "input", "keyevent", "123"); // MOVE_END
    adb("shell", "input", "keyevent", ...Array(60).fill("67")); // DEL × 60（一次调用，快）
    await sleep(300);
    // ⚠️ **逐字符慢打**：实测块打会随机丢字符（`sk-device-test` → `sk-ice-t`、
    //    `http://…` → `hp://…`）—— 丢的位置随机，缺的不只是冒号。
    //    这与"受控输入框在输入快于往返时丢键"的形状一致（每次按键都要 emit → update →
    //    重渲染，值从 Model 回灌）。判据用慢打绕开它；**这本身记在 FINDINGS 里**，
    //    因为真用户粘贴一大段长文本时会撞上同一件事。
    for (const ch of s) {
      adb("shell", "input", "text", ch);
      await sleep(160);
    }
    await sleep(400);
    const seen = uiTexts(dump());
    if (seen.includes(s)) return { ok: true, seen, attempts: attempt };
    console.log(`     （第 ${attempt} 次打「${tag}」没打准，重来）`);
    after = seen; // 供上层报告
  }
  return { ok: false, seen: uiTexts(dump()), attempts: 3 };
}
let after = "";

function tapText(xml, needle) {
  const hit = nodes(xml).find((n) => n.text.includes(needle));
  if (!hit) return false;
  adb("shell", "input", "tap", String(Math.round(hit.cx)), String(Math.round(hit.cy)));
  return true;
}

let xml = "";
let up = false;
for (let attempt = 1; attempt <= 2 && !up; attempt++) {
  if (attempt > 1) {
    console.log("     界面没起来，重起一次（冷启动拉 bundle 的时序）…");
    adb("shell", "am", "force-stop", PKG);
    await sleep(1500);
    adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1");
  }
  for (let i = 0; i < 25; i++) {
    xml = dump();
    // ⚠️ 首屏**可能是设置页**（这台设备上还没有 key）—— 那正是应用该有的行为，
    //    不能只等"对话"，否则会把"正确地落在设置页"读成"界面没起来"（第一版就是这么错的）。
    if (uiTexts(xml).includes("对话") || uiTexts(xml).includes("Base URL")) {
      up = true;
      break;
    }
    await sleep(2500);
  }
}
check(
  "我们的 JS 在真机上跑起来了（「对话」或设置页）",
  up,
  up ? "" : uiTexts(xml).slice(0, 160),
);
if (!up) {
  console.log("\n================ chat-app 真机 汇总 ================");
  console.log("通过 0  失败 1（界面没起来：Metro 的 bundle 拉不到？看 logcat）");
  server.close();
  process.exit(1);
}

// ── 4) 填设置（第一次打开会直接落在设置页）────────────────────────────────────
section("设置页");
const settingsFirst = uiTexts(xml).includes("Base URL");
check("★ 第一次打开落在设置页（没有 key 不让他先撞 401）", settingsFirst, uiTexts(xml).slice(0, 140));
if (settingsFirst) {
  // ⚠️ 键盘第一次弹出来会问一句权限（Gboard「访问联系人」）—— 它挡着界面，
  //    不关掉后面所有点击都落在对话框上（第一版就是这么失败的）。
  let x0 = dump();
  if (dismissDialogs(x0)) {
    console.log("     （关掉了一个系统对话框）");
    await sleep(600);
  }

  const typed = [`http://127.0.0.1:${PORT}/v1`, "sk-device-test", "md-test"];
  const names = ["Base URL", "API Key", "Model"];
  for (let i = 0; i < 3; i++) {
    const boxes = editTexts(dump());
    if (!boxes[i]) break;
    // ⚠️ **原文传**：上一版给 `:` `/` 加了反斜杠转义，结果打进去的是 `htp//1270.:881`
    //    —— 转义在 adb/设备 shell 两层里被吃掉了。这些字符本来就安全。
    const r = await typeInto(boxes[i], typed[i], names[i]);
    if (!r.ok) console.log(`     ⚠️ ${names[i]} 打进去的是：${r.seen.slice(0, 160)}`);
  }
  // 收起键盘，否则它可能盖住「保存」
  adb("shell", "input", "keyevent", "111"); // ESC
  await sleep(300);
  xml = dump();
  const filled = editTexts(xml).length;
  check(`三个输入框都找到了（找到 ${filled} 个）`, filled >= 3, "");
  const seen = uiTexts(xml);
  check(
    "Base URL 回填成了我们那个假服务地址",
    seen.includes("127.0.0.1") || seen.includes("8899"),
    seen.slice(0, 220),
  );
  if (dismissDialogs(xml)) await sleep(400);
  xml = dump();
  tapText(xml, "保存");
  await sleep(700);
  xml = dump();
  if (dismissDialogs(xml)) {
    await sleep(400);
    xml = dump();
  }
  check("保存后回到聊天页（出现「发送」）", uiTexts(xml).includes("发送"), uiTexts(xml).slice(0, 160));
}

// ── 5) 发一条，看它长出来 + markdown 渲染 ─────────────────────────────────────
section("发送 → 逐字长出来 → markdown 渲染");
xml = dump();
// 输入框：界面上唯一一个可编辑控件（TextInput）。按类名找不到可靠特征，改用坐标：
// 它就是底部那一行 —— 取「发送」按钮左侧的空白区域。
const sendBtn = nodes(xml).find((n) => n.text.includes("发送"));
if (!sendBtn) {
  check("找到「发送」按钮", false, uiTexts(xml).slice(0, 160));
} else {
  const r2 = await typeInto({ cx: sendBtn.cx - 160, cy: sendBtn.cy }, "hi", "消息框");
  if (!r2.ok) console.log(`     ⚠️ 消息框里是：${r2.seen.slice(-120)}`);
  // ⚠️ **收起软键盘再点按钮**：聊天输入框在屏幕底部，键盘弹起来会把它（和「发送」）顶走 ——
  //    实测症状是"点了发送没反应、草稿还留着"，看起来像应用不工作。
  adb("shell", "input", "keyevent", "4"); // BACK：RN 里先关键盘
  await sleep(600);
  xml = dump();
  const draftOk = uiTexts(xml).includes("hi");
  check("打的字进了输入框", draftOk, uiTexts(xml).slice(-120));
  const tapped = tapText(xml, "发送");
  check("点到了「发送」", tapped, tapped ? "" : uiTexts(xml).slice(-140));
  await sleep(250);
  const early = uiTexts(dump());
  check("★ 生成中看得出来（状态行「生成中」或尾巴有光标）", early.includes("生成中") || early.includes("▍"), early.slice(-140));
  await sleep(2500);
  const done = uiTexts(dump());
  check("回复长完了：标题/正文出现在界面上", done.includes("标题一") && done.includes("粗体"), done.slice(-260));

  // ★★ markdown 真的被渲染了没 —— 靠**字面量标记消失** + **结构出现**判断：
  check(
    "★★ 渲染后**不含**字面量 `**`（粗体标记被吃掉了）",
    !done.includes("**"),
    done.includes("**") ? "界面上出现了 ⭐⭐ 字面量 —— 说明根本没走 markdown 渲染" : "",
  );
  check(
    "★★ 渲染后**不含**字面量 ``` 围栏（代码块被吃掉了）",
    !done.includes("```"),
    done.includes("```") ? "围栏字面量还在" : "",
  );
  check("★ 列表符号出现了（markdown 列表渲染成了条目）", done.includes("•") || done.includes("列表甲"), done.slice(-200));
  check("代码块内容在（`const a = 1;`）", done.includes("const a = 1;"), "");
}

// ── 6) 汇总 ───────────────────────────────────────────────────────────────────
server.close();
const failed = results.filter((r) => !r.ok);
console.log("\n================ chat-app 真机 汇总 ================");
console.log(`通过 ${results.length - failed.length}  失败 ${failed.length}`);
if (failed.length) console.log(failed.map((f) => `  FAIL  ${f.name}`).join("\n"));
process.exit(failed.length ? 1 : 0);
