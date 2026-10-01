#!/usr/bin/env node
// verify_headless.mjs —— **无浏览器、无 Metro** 地让一个 moobile 应用跑起来。
//
//   node tools/verify_headless.mjs                       # 默认验 examples/apps/template
//   node tools/verify_headless.mjs --app examples/apps/todo-app
//   node tools/verify_headless.mjs --slow                # 连订阅（每 5 秒推一次）也验
//
// ── 它验什么、不验什么（先说清，免得又被当成"都验过了"）────────────────────────
//
// 验（**应用逻辑真的在跑**）：
//   · 产物能被 node import，句柄表的契约版本与宿主对得上（`checkContract`）；
//   · `start()` 之后 `element()` 交出一棵 React 元素树 —— 树上的**文字**就是用户会看到的文字；
//   · **事件真的回到 MoonBit 的 update**：从树上取到输入框与按钮的处理器，直接调它们，
//     再读一次 `element()`，断言界面变了。这条正是"TEA 闭环通不通"的判据。
//
// 不验（各有更合适的门，别在这里重复造）：
//   · 真 React Native / 真浏览器里的**渲染与样式** → `tools/verify_web.js`、antd 试金石（jsdom）；
//   · 真机手势与排版 → `tools/verify_android.py`（要模拟器）。
//
// ── 为什么这条路值得存在 ──────────────────────────────────────────────────────
//
// `moon check` 只证明"编得过"，`moon build` 只证明"链得上"。而"生成出来的项目**跑得起来**"
// 这件事，以前只有两条路：Metro + 浏览器（慢、要装一堆 npm 包）或真机（更慢）。
// 两句都要装东西，于是**模板自身的可运行性没人验**。这里用宿主契约里已经有的东西
// （句柄表 + 组件表）把它变成一条 1 秒、零依赖的门。
//
// ⚠️ 它 import 的是**已安装的那份宿主包**（`node_modules/moobile-host`），不是源码 ——
//    因为 `core.js` 里的 `import 'react'` 必须从它自己的位置解析得到。副本与源码的一致性
//    由 `tools/check_npm_fresh.mjs` 保证（那条门存在的理由就是这个）。
//
// ⚠️ 组件表用的是**普通 DOM 标签**（`div` / `span` / `input`），不是 RN 的组件：
//    这里验的是"标签表映射 + 事件回填 + 状态机"，与 RN 的实现无关。
//    另外，met 的 props 名（`onPress` / `onChangeText`）来自库的 `render.mbt` 事件映射，
//    所以**它们变了这里就会红** —— 这是有意的。

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

// ── 参数 ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function opt(name, dflt) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
const APP = path.resolve(ROOT, opt("--app", path.join("examples", "apps", "template")));
const SLOW = argv.includes("--slow");
const LABEL_ADD = opt("--add-label", "添加");
const LABEL_DEL = opt("--delete-label", "删");
const DRAFT = opt("--draft", "买牛奶");
// 计数文案是可选的：模板有"还有 N 件"，demo 的清单页没有这行。
// 给了就断言（1 件 → 0 件），没给就跳过那两条 —— **不假装验过**。
const COUNT = opt("--count-pattern", null); // 例：'还有 %d 件'

// 让 lib/build.js 的**产物发现**逻辑也在这里被复用（不复制第二份路径猜测）。
const buildMod = createRequire(import.meta.url)(
  path.join(ROOT, "npm", "moobile-host", "lib", "build.js"),
);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
}

// ── 1) 找到产物（与 `moobile-host build` 同一套发现逻辑）──────────────────────
function findArtifact() {
  const mod = buildMod.findUp(APP, "moon.mod");
  if (!mod) throw new Error(`${APP} 里找不到 moon.mod（--app 指错了？）`);
  const moduleName = buildMod.readModuleName(mod.hit);
  const last = moduleName.split("/").pop();

  for (const profile of ["debug", "release"]) {
    const root = buildMod.findUp(APP, path.join("_build", "js", profile, "build"));
    if (!root) continue;
    const predicted = path.join(root.hit, moduleName, `${last}.js`);
    if (existsSync(predicted)) return { artifact: predicted, moduleName, profile, how: "预测路径" };
    const hits = buildMod.listJs(root.hit).filter((p) => path.basename(p) === `${last}.js`);
    if (hits.length === 1) return { artifact: hits[0], moduleName, profile, how: "扫描" };
    if (hits.length > 1) {
      throw new Error(
        `_build 里有 ${hits.length} 个 ${last}.js，分不清：\n` + hits.join("\n"),
      );
    }
  }
  throw new Error(
    `找不到 ${moduleName} 的 JS 产物 —— 先在仓库根跑：moon build --target js`,
  );
}

// ── 2) React 与宿主 core：都在**已安装**的那份包里 ────────────────────────────
const CANDIDATES = [
  path.join(APP, "node_modules"),
  path.join(ROOT, "examples/apps/todo-app/host/node_modules"),
  path.join(ROOT, "examples/apps/antd-spike/host/node_modules"),
];
function pickNodeModules(need) {
  for (const dir of CANDIDATES) {
    if (existsSync(path.join(dir, need))) return dir;
  }
  throw new Error(
    `找不到装了 \`${need}\` 的 node_modules。找过：\n  ` + CANDIDATES.join("\n  "),
  );
}

const nm = pickNodeModules("react");
const coreNm = pickNodeModules("moobile-host");
const require_ = createRequire(path.join(nm, "noop.cjs"));
const React = require_("react");
const core = await import(
  pathToFileURL(path.join(coreNm, "moobile-host", "core.js")).href
);

// ── 3) 装一个最小宿主（普通 DOM 标签当组件）───────────────────────────────────
const h = React.createElement;
const tag = (name) =>
  function Component({ children, ...rest }) {
    return h(name, rest, children);
  };
const COMPONENTS = {
  View: ({ children, style, ...rest }) => h("div", { style, ...rest }, children),
  Text: ({ children, style, ...rest }) => h("span", { style, ...rest }, children),
  Pressable: tag("button"),
  TextInput: tag("input"),
  ScrollView: ({ children, style, ...rest }) => h("div", { style, ...rest }, children),
};

// ⚠️ `@sub.every` 底下读的是 **`window.setInterval`**（rabitta 的订阅加载器先取 `window`）。
//    浏览器与 RN 里它天然存在，node 里没有 —— 这里补一个**最小的**同名对象。
//    这是无头环境的补齐，不是"绕过某个检查"：真跑起来时那一层由平台给。
if (typeof globalThis.window === "undefined") {
  globalThis.window = {
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };
}

core.installHostCore({
  react: React,
  components: COMPONENTS,
  platform: "web",
  apiBase: "",
});

// ── 4) 构造应用 + 比对契约 ────────────────────────────────────────────────────
const found = findArtifact();
const mod = await import(pathToFileURL(found.artifact).href);
check(
  `产物可被 node import（${found.how}：${path.relative(ROOT, found.artifact)}，${found.profile}）`,
  typeof mod.app === "function",
  Object.keys(mod).join(", "),
);
check("单导出：只有 `app`（H2）", Object.keys(mod).length === 1, Object.keys(mod).join(","));

const handles = mod.app();
core.checkContract(handles); // 不匹配会抛，并把两个版本号报出来
check(`契约版本一致（contract=${handles.contract}）`, handles.contract === core.CONTRACT);
handles.start();

// ── 5) 读树 / 驱动事件的小工具 ────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle(ms = 60) {
  // 不假设消息走的是微任务还是宏任务（调度钩子是宿主给的）：等一拍再读。
  await sleep(ms);
}

/** 收集一棵 React 元素树上的全部文字。 */
function textOf(node, out = []) {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const c of node) textOf(c, out);
    return out;
  }
  if (typeof node === "object" && node.props) textOf(node.props.children, out);
  return out;
}

/** 深度优先找**第一个**满足条件的元素（返回 {element, text}）。 */
function find(node, pred) {
  if (!node || typeof node !== "object" || !node.props) return null;
  const text = textOf(node).join("");
  if (pred(node, text)) return { element: node, text };
  const kids = node.props.children;
  for (const c of Array.isArray(kids) ? kids : [kids]) {
    const hit = find(c, pred);
    if (hit) return hit;
  }
  return null;
}

const TREE_TEXT = () => textOf(handles.element()).join("");
function must(desc, pred) {
  const hit = find(handles.element(), pred);
  assert.ok(hit, `树上找不到 ${desc}；当前界面文字：${TREE_TEXT().slice(0, 200)}`);
  return hit;
}

console.log(`\n-- 应用：${path.relative(ROOT, APP)}（模块 ${found.moduleName}）--`);
console.log(`   初始界面：${TREE_TEXT().slice(0, 200)}`);
console.log("");

// ── 6) 断言：首屏 ─────────────────────────────────────────────────────────────
check("首屏渲染出内容（不是空白屏）", TREE_TEXT().length > 0, `${TREE_TEXT().length} 字`);
check("列表页标题在", TREE_TEXT().includes("待办"));

// ── 7) 断言：输入 → 添加（事件真的回到 update）────────────────────────────────
const findInput = () => must("输入框（TextInput）", (el) => typeof el.props.onChangeText === "function");
findInput().element.props.onChangeText(DRAFT);
await settle();
const filled = findInput().element.props.value;
check(`草稿进了 Model（输入框 value 回填成「${DRAFT}」）`, filled === DRAFT, `value=${JSON.stringify(filled)}`);

const addBtn = must(
  `按钮「${LABEL_ADD}」`,
  (el, txt) => typeof el.props.onPress === "function" && txt.includes(LABEL_ADD),
);
const before = handles.snapshot();
addBtn.element.props.onPress();
await settle();
check("点击后快照变了（状态机真的在动）", handles.snapshot() !== before, `${before} → ${handles.snapshot()}`);
check(`添加的条目出现在界面上：「${DRAFT}」`, TREE_TEXT().includes(DRAFT));
if (COUNT) {
  const one = COUNT.replace("%d", "1");
  check(`计数跟着变了（「${one}」）`, TREE_TEXT().includes(one), TREE_TEXT().slice(0, 160));
} else {
  console.log("SKIP  计数文案（这条应用没有计数行；用 --count-pattern 指定）");
}

// ── 8) 断言：勾选 → 删除 ──────────────────────────────────────────────────────
// ⚠️ 勾选按钮**没有文字**（未完成时是空框，完成了才显示 ✓）—— 所以这里不能按文字找。
//    判据用"文字为空或 ✓ 的 Pressable"：模板里只有它是这个形状。
const findToggle = () =>
  must(
    "条目的勾选按钮（空框 / ✓）",
    (el, txt) =>
      typeof el.props.onPress === "function" && (txt === "" || txt === "✓"),
  );
findToggle().element.props.onPress();
await settle();
if (COUNT) {
  const zero = COUNT.replace("%d", "0");
  check(`勾选后计数归零（「${zero}」）`, TREE_TEXT().includes(zero), TREE_TEXT().slice(0, 160));
}
check("勾选标记出现（✓）", TREE_TEXT().includes("✓"));

const del = must(
  `条目的删除按钮（${LABEL_DEL}）`,
  (el, txt) => typeof el.props.onPress === "function" && txt.includes(LABEL_DEL),
);
del.element.props.onPress();
await settle();
check(`删除后条目消失（界面上不再有「${DRAFT}」）`, !TREE_TEXT().includes(DRAFT), TREE_TEXT().slice(0, 160));

// ── 9) 断言：订阅（运行时推消息，不由交互产生）—— 默认不跑（要等 5 秒）────────
if (SLOW) {
  const t0 = TREE_TEXT();
  await sleep(5600);
  const t1 = TREE_TEXT();
  check("订阅通道有动静（5 秒后界面变了）", t0 !== t1, `「${t0.slice(-40)}」→「${t1.slice(-40)}」`);
} else {
  console.log("SKIP  订阅通道（要等 5 秒；加 --slow 才跑）");
}

// ── 10) 应用自己的剧本（可选）────────────────────────────────────────────────
// 上面的断言是**每个 moobile 应用都该过**的那几条（首屏 / 输入 / 增 / 勾 / 删）。
// 每个应用还有自己的界面（多页面、过滤、手势…），那些写成剧本住在应用旁边，
// 由 `--scenario <file.mjs>` 指过来 —— 剧本拿到下面这个 driver。
//
// 为什么不让 harness 认识每个应用的文案：那会把"验证"变成"维护一份文案映射"，
// 而应用文案是最常改的东西。
const SCENARIO = opt("--scenario", null);
if (SCENARIO) {
  const file = path.resolve(ROOT, SCENARIO);
  const scen = await import(pathToFileURL(file).href);
  if (typeof scen.run !== "function") {
    throw new Error(`剧本 ${SCENARIO} 没有导出 \`run(driver)\``);
  }
  console.log(`\n-- 剧本：${path.relative(ROOT, file)} --`);
  await scen.run({
    app: APP,
    handles,
    text: TREE_TEXT,
    must,
    find: (pred) => find(handles.element(), pred),
    click: async (el, ms) => {
      el.props.onPress();
      await settle(ms);
    },
    type: async (el, s, ms) => {
      el.props.onChangeText(s);
      await settle(ms);
    },
    settle,
    check,
    draft: DRAFT,
  });
}

// ── 汇总 ──────────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log("");
console.log(`无头验证：通过 ${results.length - failed.length}  失败 ${failed.length}`);
if (failed.length) {
  for (const f of failed) console.log("  FAIL  " + f.name);
  process.exitCode = 1;
} else {
  console.log("（用的是已安装的宿主包副本：" + path.relative(ROOT, coreNm) + " —— 与源码一致由 check_npm_fresh 保证）");
}

// ⚠️ **必须显式退出**：`@sub.every` 装的是真的 `setInterval`，它会一直挂着事件循环 ——
//    不退出的话这条门跑完就卡住（第一次就是这么被自己坑了 120 秒）。
process.exit(process.exitCode || 0);

