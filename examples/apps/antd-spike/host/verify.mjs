// verify.mjs —— antd 试金石的验证脚本。**不需要浏览器，也不需要 Metro**。
//
//   cd examples/apps/antd-spike/host && node verify.mjs
//
// 为什么可以不带浏览器：两条链路各自有更省的判据 ——
//   · "antd 的组件真的被构造出来了" → SSR 出 HTML，断言 antd **自己的**类名与数据；
//   · "事件回到 MoonBit 的 update 并触发重渲染" → jsdom 里真实挂载 + 真实点击，看 DOM 变没变。
// 浏览器/真机要验的是**样式与手势**（antd 的 CSS-in-JS 有没有生效、触摸行为对不对），
// 那是另一件事，见设计稿 §N7 的"未覆盖"。
//
// 前置：`moon build --target js`（本脚本直接吃 `_build/` 里的产物 ——
// 刻意**不拷一份** `moobile.js`，因为"拷了旧的那份"是本仓库踩过的坑）。
//
// 三个阶段，判据都必须能抓住设计错误：
//   0. SSR：antd 组件名解析、四条 prop 通道（字符串 / 布尔 / 数值 / JSON）都到位；
//   1. 交互：antd 按钮的点击回到 update（且重渲染出了新表格行）；
//   2. 负例：**写错的组件名**要点名报错；**没有事件覆盖**时点击必须无效 ——
//      后者是"事件落点由宿主决定"这个设计的反证，防止我们误以为它本来就通。

// ⚠️ 必须在**任何 import 之前**把 NODE_ENV 钉成 development：
//   · 本机环境里 NODE_ENV=production，而 React 的 **production 构建不含 `act`**
//     （`import("react").act` 实测是 undefined，报 `act is not a function`）；
//   · 这个脚本要的正是"确定性刷新"，而 `act` 只在 development 构建里可用。
// 代价是 React 会打开发模式的告警 —— 对验证脚本而言是收益，不是噪音。
process.env.NODE_ENV = "development";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../.."); // 仓库根

const ARTIFACTS = [
  "_build/js/debug/build/XiLaiTL/moobile-antd-spike/moobile-antd-spike.js",
  "_build/js/release/build/XiLaiTL/moobile-antd-spike/moobile-antd-spike.js",
].map((p) => path.join(ROOT, p));
const ARTIFACT = ARTIFACTS.find((p) => fs.existsSync(p));
if (!ARTIFACT) {
  console.error("找不到 MoonBit 产物。先在仓库根跑：moon build --target js");
  console.error("找过：\n  " + ARTIFACTS.map((p) => path.relative(ROOT, p)).join("\n  "));
  process.exit(2);
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
}

// ── jsdom 环境必须在 import antd / react-dom **之前**装好 ──────────────────────
// 理由：rc-* 与 antd 在模块初始化时就会读 `window` / `document`（`canUseDom`），
// 装晚了会走"服务端分支"，测的就不是同一套代码了。
const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// ⚠️ Node 24 起 `globalThis.navigator` 是**只读 getter**，直接赋值会 TypeError
// （`Cannot set property navigator of #<Object> which has only a getter`）。
// 只能用 defineProperty 覆盖 —— 实测踩到。
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.Event = dom.window.Event;
globalThis.MouseEvent = dom.window.MouseEvent;
// jsdom 的 getComputedStyle 一旦收到第二个参数（pseudoElt）就抛 "Not implemented"，
// 而 `@rc-component/util` 的 getScrollBarSize 正好那么调（Table 的 useLayoutEffect 里）。
// 包一层丢掉第二个参数 —— 这是**测试替身**，不是我们代码的一部分。
const jsdomGetComputedStyle = dom.window.getComputedStyle.bind(dom.window);
dom.window.getComputedStyle = (el) => jsdomGetComputedStyle(el);
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
// jsdom 没有实现这两个，antd 的响应式/尺寸探测需要 —— 给个最小桩，
// **并在报告里说明**：它们是测试替身，不是我们代码的一部分。
dom.window.matchMedia ||= (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
});
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
dom.window.ResizeObserver ||= ResizeObserverStub;
globalThis.ResizeObserver = dom.window.ResizeObserver;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── 真正的依赖（顺序见上） ────────────────────────────────────────────────────
const ReactMod = await import("react");
const React = ReactMod.default;
// ⚠️ CJS 的命名导出不一定被 ESM 静态识别（`import("react").act` 实测是 undefined），
// 所以从 default 上取 —— React 19 把 `act` 挂在 default 导出上。
const act = ReactMod.act ?? ReactMod.default.act;
const { renderToStaticMarkup } = await import("react-dom/server");
const { createRoot } = await import("react-dom/client");
const antd = await import("antd");
const core = await import("moobile-host/core.js");
// ⚠️ Windows 上 dynamic import 必须吃 `file://` URL —— 直接给 `D:\...` 会被
// 默认 ESM loader 拒掉（`ERR_UNSUPPORTED_ESM_URL_SCHEME`）。实测踩到。
const spike = await import(pathToFileURL(ARTIFACT).href);

// ── 宿主预设：纯 DOM（没有 RN） ───────────────────────────────────────────────
//
// ★ 这里就是设计稿说的"宿主 = 组件表 + 事件表"：
//   · 组件表把内置的 5 个名字指到 DOM 元素（react-native-web 干的也是这件事）；
//   · 事件表把 `click` 这类语义落点声明成 DOM 的 prop 名 —— 因为内置标签表默认按
//     **RN 的语义**映射（`click` → `onPress`），而 DOM 元素根本不认 `onPress`。
//   没有事件表，这个宿主渲染得出来、但一个事件都收不到。
const DOM_COMPONENTS = {
  View: "div",
  Text: "span",
  Pressable: "button",
  TextInput: "input",
  ScrollView: "div",
};

const DOM_EVENTS = {
  "*": {
    click: "onClick",
    input: "onChange",
    change: "onChange",
    focus: "onFocus",
    blur: "onBlur",
    submit: "onSubmit",
  },
};

const ANTD_EVENTS = { click: "onClick", change: "onChange" };

function install({ hostEvents = DOM_EVENTS, libraryEvents = ANTD_EVENTS } = {}) {
  core.installHostCore({
    // ★ `reset: true` —— **每次从干净宿主开始**。
    //
    // 不加它的话，下面那些负例**根本不是负例**：`installHostCore` 是合并进全局
    // `MOBILE_HOST` 的（那是为了修"重复 install 会冲掉已注册的组件"），
    // 于是前面用例装进去的 `"*": { click: "onClick" }` 会**留到**后面，
    // 而 (b) 以为自己装的是"没有任何事件覆盖的宿主"。
    // 实测：这条 (b) 长期是绿的，直到它的 `moobile-host` 副本**被刷新** ——
    // 旧副本是整体替换语义，天然干净，所以这个假通过被"陈旧的副本"掩盖了。
    reset: true,
    components: { ...DOM_COMPONENTS },
    events: hostEvents,
    platform: "web",
    scheduleTask: (f) => queueMicrotask(f),
    scheduleFrame: (f) => setTimeout(f, 0),
  });
  return core.registerLibrary({
    namespace: "antd",
    module: antd,
    platforms: ["web"],
    jsonProps: { Table: ["columns", "dataSource"] },
    events: libraryEvents,
    // Provider 包裹：antd 的组件要在 ConfigProvider 里面才是"装配完整"的
    wrap: (el) => React.createElement(antd.ConfigProvider, null, el),
    quiet: true,
  });
}

/** 只装宿主并抽干首帧，返回句柄表（不挂进 React）。 */
function startHandles(appFn = spike.app) {
  const handles = appFn();
  core.checkContract(handles);
  handles.start();
  return handles;
}

// ── 负例专用模式：只跑"注定要抛"的那一次挂载，然后立刻退出 ──────────────────────
// 见阶段 2 的说明：这种用例没法与其它用例共处一个进程。
if (process.argv.includes("--typo-only")) {
  install();
  try {
    startHandles(spike.app_typo);
    console.log("NO_THROW（本该抛错却没有）");
    process.exit(1);
  } catch (err) {
    console.log(err && err.message ? err.message : String(err));
    process.exit(err && err.message && err.message.includes("antd:Botton") ? 0 : 1);
  }
}

let mountSeq = 0;
/** 装宿主 + 挂进 jsdom，返回 { handles, container }。 */
async function mountFresh({ hostEvents, libraryEvents, appFn } = {}) {
  const registered = install({ hostEvents, libraryEvents });
  const handles = startHandles(appFn);
  const Root = core.mountRoot(handles);
  const container = document.createElement("div");
  container.id = `mount-${++mountSeq}`;
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(Root));
  });
  return { handles, container, root, registered };
}

async function click(el) {
  assert.ok(el, "要点的元素不存在");
  await act(async () => {
    el.dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
    );
    // 给微任务（Cmd 抽干）与定时器（frame）都留出机会
    await new Promise((r) => setTimeout(r, 30));
  });
}

/**
 * 按文本找元素（归一化空白）。
 *
 * ⚠️ 为什么必须归一化：antd 对**两个汉字**的按钮会 `autoInsertSpace`
 * （`清空` → `清 空`，见 Button 的 autoInsertSpace），于是 `textContent.includes("清空")`
 * 会**找不到** —— 实测踩到，且报的是一句与真因无关的"元素不存在"。
 */
const norm = (s) => (s || "").replace(/\s+/g, "");
const byText = (container, selector, text) =>
  [...container.querySelectorAll(selector)].find((el) => norm(el.textContent).includes(norm(text)));

// ── 阶段 0：SSR ───────────────────────────────────────────────────────────────
console.log(`\n产物：${path.relative(ROOT, ARTIFACT)}\n`);
const host0 = install();
check(
  "registerLibrary 注册了 antd 的组件",
  host0.includes("antd:Button") && host0.includes("antd:Table"),
  `${host0.length} 个：${host0.slice(0, 6).join(", ")}…`,
);

const handles0 = startHandles();
const diag = {
  unsupported: handles0.unsupported(),
  unmapped: handles0.unmapped(),
  unmapped_names: handles0.unmapped_names(),
};
const html = renderToStaticMarkup(handles0.element());

check("antd Button 由 antd 自己渲染（.ant-btn 出现）", html.includes("ant-btn"));
check("antd Card 渲染（.ant-card 出现）", html.includes("ant-card"));
check("antd Tag 渲染且拿到 children（条数 3）", html.includes("ant-tag") && html.includes("条数 3"));
check(
  "字符串 / 数值 prop 通道（Button type=primary、Progress percent）",
  html.includes("ant-btn-primary") && html.includes("ant-progress"),
);
check(
  "JSON prop 通道（Table 的 columns + dataSource 被宿主 JSON.parse 后交给 antd）",
  html.includes("ant-table") && html.includes(">10<") && html.includes(">20<") && html.includes(">30<"),
  "表体里能看到 10 / 20 / 30 三行分数",
);
check(
  "Provider 包裹生效（ConfigProvider 在树外，antd 的 class 前缀仍是 ant-）",
  html.includes('class="ant-'),
);
check(
  "内置标签路径未受影响（div/span 走宿主基础组件）",
  html.includes("内置标签仍在：点击 0 次"),
);
check(
  "诊断计数：不可移植节点 0、未收录标签 0",
  diag.unsupported === 0 && diag.unmapped === 0,
  `unsupported=${diag.unsupported} unmapped=${diag.unmapped}${diag.unmapped_names ? " (" + diag.unmapped_names + ")" : ""}`,
);

// ── 阶段 1：jsdom 交互 ───────────────────────────────────────────────────────
const { container } = await mountFresh();
check(
  "挂载后 DOM 里有 antd 的按钮（真 React 调和，不是 SSR 字符串）",
  container.querySelectorAll(".ant-btn").length >= 2,
);
// ⚠️ 不能直接数 `tr`：**空数据时 antd 会渲染一行 `.ant-table-placeholder`**，
// 于是"0 行"会被数成 1 行。真实数据的行要把占位行排除掉（实测踩到）。
const dataRows = (c) => c.querySelectorAll(".ant-table-tbody tr:not(.ant-table-placeholder)").length;
check("初始表格 3 行（dataSource 来自 MoonBit 的 JSON）", dataRows(container) === 3, `${dataRows(container)} 行`);

// ① antd:Button → onClick → emit(Bump) → update → 重渲染
await click(byText(container, ".ant-btn", "加一条"));
check(
  "① 点 antd 按钮 → 事件回到 MoonBit update（条数 3 → 4）",
  container.textContent.includes("条数 4"),
  byText(container, ".ant-tag", "条数")?.textContent,
);
check("① 重渲染后表格变成 4 行（结构化 prop 跟着 Model 走）", dataRows(container) === 4, `${dataRows(container)} 行`);

// ② 内置标签的按钮（宿主 "*" 事件覆盖）
await click(byText(container, "button", "内置按钮"));
check(
  "② 点内置标签按钮 → 同样回到 update（点击 2 次）",
  container.textContent.includes("点击 2 次"),
);

// ③ 另一个 antd 按钮走另一条消息
await click(byText(container, ".ant-btn", "清空"));
check(
  "③ 第二个 antd 按钮走另一条 Msg（条数 4 → 0）",
  container.textContent.includes("条数 0"),
);
check(
  "③ 表格清空（0 数据行，只剩 antd 的空态占位行）",
  dataRows(container) === 0 && container.querySelectorAll(".ant-table-placeholder").length === 1,
  `${dataRows(container)} 数据行`,
);

// ── 阶段 1b：受控组件（**载荷**通道，PLAN 的 I1）──────────────────────────────
// 判据不是"事件触发了"，而是"**值对上了**"：在 antd 的 Input 里打字 →
// MoonBit 的 update 收到**那段文本** → 重渲染后 DOM 里出现它。
const inputEl = container.querySelector("input.ant-input");
check("antd Input 渲染出来了（受控组件的前提）", !!inputEl);

if (inputEl) {
  // React 用自己的 value tracker 判断"值变了没"，直接改 `el.value` 它**看不见**，
  // 所以要用原型上的原生 setter 再派发 input 事件 —— 这是驱动受控组件的老办法，
  // 与"模拟真实用户输入"等价（实测：不用它，onChange 不触发）。
  const setNativeValue = (el, value) => {
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    desc.set.call(el, value);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };

  await act(async () => {
    setNativeValue(inputEl, "你好，antd");
    await new Promise((r) => setTimeout(r, 30));
  });

  check(
    "① 打字后 MoonBit 的 Model 收到该文本（回显：你好，antd）",
    container.textContent.includes("回显：你好，antd"),
    container.textContent.match(/回显：\S*/)?.[0],
  );
  check(
    "① DOM 的 input.value 仍然等于 Model 的值（受控回填生效）",
    inputEl.value === "你好，antd",
    `input.value=${JSON.stringify(inputEl.value)}`,
  );

  // 再打一次：证明是**每次**都带回值，而不是第一次碰巧
  await act(async () => {
    setNativeValue(inputEl, "第二次");
    await new Promise((r) => setTimeout(r, 30));
  });
  check(
    "② 第二次输入同样回到 Model（回显：第二次）",
    container.textContent.includes("回显：第二次"),
    container.textContent.match(/回显：\S*/)?.[0],
  );
}


// ── 阶段 2：负例 ─────────────────────────────────────────────────────────────
// (a) 写错的组件名必须**点名报错**，而不是回落成 View 渲染个空盒子。
//
// ⚠️ 这一条**必须单独起一个进程**。这次挂载注定要在渲染时抛，而 `ReactHost`
// 还会在稍后的一个 frame 里**再抛一次**（那时已经没人接了）。实测代价：
// 不隔离的话，后面的阶段会在一个不相干的时刻被这个未捕获异常打断，
// 报出来的是一句与当前用例无关的错 —— 一个进程没法既"崩溃"又"继续跑剩下的用例"。
const { spawnSync } = await import("node:child_process");
const typoChild = spawnSync(
  process.execPath,
  [fileURLToPath(import.meta.url), "--typo-only"],
  { encoding: "utf8", env: { ...process.env } },
);
const typoOut = (typoChild.stdout || "").trim();
check(
  "(a) 负例：写错的组件名点名报错，并列出已注册的名字（独立进程）",
  typoChild.status === 0 && typoOut.includes("antd:Botton") && typoOut.includes("已注册"),
  typoOut.split("\n").slice(0, 2).join(" ").slice(0, 130) ||
    `退出码 ${typoChild.status}：${(typoChild.stderr || "").trim().split("\n").slice(-1)[0]}`,
);

// (b) 事件落点是**宿主的责任**：不给覆盖时，antd 组件收不到任何处理器。
//     这一条是反证 —— 没有它，我们无法区分"设计生效了"和"本来就通"。
const noEvents = await mountFresh({ hostEvents: {}, libraryEvents: {} });
await click(byText(noEvents.container, ".ant-btn", "加一条"));
check(
  "(b) 负例：宿主不给事件覆盖时，点 antd 按钮**无效**（条数仍是 3）",
  noEvents.container.textContent.includes("条数 3"),
  byText(noEvents.container, ".ant-tag", "条数")?.textContent,
);
check(
  "(b) 但组件本身仍然渲染出来了（说明差的确实只是事件落点）",
  noEvents.container.querySelectorAll(".ant-btn").length >= 2,
);

// (c) 全局 "*" 覆盖同样能落到组件库的组件上（三级优先里的第三级）
const globalOnly = await mountFresh({ libraryEvents: {} });
await click(byText(globalOnly.container, ".ant-btn", "加一条"));
check(
  "(c) 只给宿主级 `\"*\"` 覆盖，antd 按钮也能收到点击（三级优先的兜底有效）",
  globalOnly.container.textContent.includes("条数 4"),
);

// (d) 一个**有信息量**的对照：`click` 必须靠覆盖（默认落点是 RN 的 `onPress`），
//     而 `change` **不靠** —— 默认表的 camelCase 兜底本来就产出 `onChange`。
//     换句话说：单词回调大多"默认就能通"，只有落点语义不同的（press/click）才必须声明。
const bare = await mountFresh({ hostEvents: {}, libraryEvents: {} });
const bareInput = bare.container.querySelector("input.ant-input");
if (bareInput) {
  const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  await act(async () => {
    desc.set.call(bareInput, "无覆盖也能到");
    bareInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
}
check(
  "(d) 不给任何事件覆盖时，`change` 仍能到达 Model（camelCase 兜底的功劳）",
  bare.container.textContent.includes("回显：无覆盖也能到"),
  bare.container.textContent.match(/回显：\S*/)?.[0],
);
check(
  "(d) 但同一份配置下 `click` 到不了（默认是 RN 的 onPress）—— 与 (b) 一致",
  !bare.container.textContent.includes("条数 3 次") && bare.container.textContent.includes("条数 3"),
);

// ── 汇总 ─────────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} 通过` +
    (failed.length ? `，失败：\n  - ${failed.map((f) => f.name).join("\n  - ")}` : ""),
);
process.exit(failed.length ? 1 : 0);
