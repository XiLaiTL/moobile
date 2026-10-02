#!/usr/bin/env node
// perf_bench.mjs —— **离线每帧成本基线**（`PLAN.md` §4.1 的 D1/D2，其中离线的那一半）
//
//   node tools/perf_bench.mjs --n 100,1000,5000 --mode translate
//   node tools/perf_bench.mjs --n 1000 --mode dom --frames 200
//   node tools/perf_bench.mjs --n 1000 --label baseline --json .scratch/perf/baseline.json
//
// ── 一个"帧"是什么 ────────────────────────────────────────────────────────────
// **状态机抽干 → VNode 建树 → 翻译成 React 元素 → React reconcile + commit**。
// 两档模式把这条链切开：
//
//   · `translate` —— 宿主的 `react` 换成**记账桩**。只量**翻译层**（标签查表、
//     事件名映射、`styles_to_js`、元素构造）。不装 jsdom、不装 react-dom ——
//     **噪声最小，所以改前/改后（A/B）应当看这一档**。
//   · `dom` —— 真 React + react-dom + jsdom + DOM 组件表。量整条 Web 帧成本；
//     与 `translate` 的差 ≈ React 的 diff/commit + DOM API 调用（见下面的边界）。
//
// ── 它**不**测什么（关键：别把这两档读成"手感"）────────────────────────────────
// 1. **没有布局**：jsdom 不实现布局引擎，RN 的 Yoga 也不在。真机掉帧里很大一块是
//    布局与绘制 —— 那要 Chrome Performance / `dumpsys gfxinfo`（D2 原文）。
// 2. **没有原生渲染**：Android 那半一点没碰。
// 3. **调度是同步的**（`scheduleTask` / `scheduleFrame` 直接调用）。这是**刻意**的：
//    量的是"算完这一帧要多少计算"，不是"调度器什么时候轮到它"。代价是这组数字
//    属于**下界** —— 真机上只会更差，不会更好。
// 4. 引擎是 V8（node），真机是 Hermes/JSC：**常量会差，曲线的形状才可迁移**。
// 5. `dom` 档里 React 的 commit 是**往 jsdom 里写**，它的 DOM 操作比真浏览器慢，
//    所以"React 那部分的绝对值"也偏悲观；只有差值的方向是可信的。
//
// ── 三条自证新鲜的机制（本仓库的规矩：工具的产出要能自证"这是不是这次的"）──────
// · 打印产物的 **sha256 + mtime + 字节数**：A/B 两次必须比这个哈希，哈希一样才叫同一份产物；
// · 打印**宿主副本与源码的 md5 是否一致**（`core.js`）—— 副本陈旧会让"量的是旧代码"；
// · 打印**实测元素数**与负载的**理论元素数**（`4N+5`）是否相等 —— 负载形状变了这里会立刻红。
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

// ── 依赖从哪来 ───────────────────────────────────────────────────────────────
//
// ⚠️ 不能直接 `import "react"`：本脚本住在 `tools/`，node 会从 `tools/` 往上找
// `node_modules`，而**仓库根没有 node_modules**（库自己不装依赖）。
// 而 `npm/moobile-host/core.js` 里那句 `import React from 'react'` 要求它身边就有 react。
// 于是**借一份装好的宿主**：`examples/apps/antd-spike/host/` 里有 react / react-dom / jsdom
// 与一份 `moobile-host` 副本 —— 与 `tools/verify_headless.mjs` 借已装宿主是同一路数。
//
// 代价是"可能量到陈旧的副本"，所以下面 `checkHostFresh()` 每次都核 core.js 的 md5。
// 这是 **FINDINGS 里那条教训**的直接产物：陈旧副本曾经让一整轮边界探测测的是旧实现。
const DEFAULT_DEPS = path.join(ROOT, "examples/apps/antd-spike/host");
const MODULE_NAME = "moobile-perf-bench"; // moon.mod 的 name 末段 = 产物文件名
const DRIVER_TEXT = "+1"; // app.mbt 里那个驱动按钮的文本（改它必须同步改这里）

// ── 参数 ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {
    ns: [1000], mode: "translate", frames: 200, warmup: 50, label: "",
    json: "", deps: DEFAULT_DEPS, child: false, quiet: false,
    trials: 1, artifact: "", profile: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === "--n") out.ns = String(val()).split(",").map((s) => parseInt(s.trim(), 10)).filter((x) => x > 0);
    else if (a === "--mode") out.mode = val();
    else if (a === "--frames") out.frames = parseInt(val(), 10);
    else if (a === "--warmup") out.warmup = parseInt(val(), 10);
    else if (a === "--trials") out.trials = Math.max(1, parseInt(val(), 10));
    else if (a === "--label") out.label = val();
    else if (a === "--json") out.json = val();
    else if (a === "--deps") out.deps = path.resolve(val());
    else if (a === "--artifact") out.artifact = path.resolve(val());
    else if (a === "--profile") out.profile = true;
    else if (a === "--child") out.child = true;
    else if (a === "--quiet") out.quiet = true;
    else if (a === "--help" || a === "-h") { console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 40).join("\n")); process.exit(0); }
    else { console.error(`未知参数：${a}（--help 看用法）`); process.exit(2); }
  }
  if (!["translate", "dom"].includes(out.mode)) {
    console.error(`--mode 只支持 translate / dom，收到 ${out.mode}`);
    process.exit(2);
  }
  if (out.ns.length === 0) { console.error("--n 必须至少给一个正整数"); process.exit(2); }
  return out;
}
const args = parseArgs(process.argv.slice(2));

// ── 统计（**必须定义在 fan-out 之前**：下面 `printSummary` 会用它们，
//    而 `const` 箭头函数不像 `function` 那样提升 —— 放后面会踩 TDZ。）──────────
const sorted = (a) => [...a].sort((x, y) => x - y);
const med = (a) => sorted(a)[Math.floor(a.length / 2)];
const p95 = (a) => sorted(a)[Math.min(a.length - 1, Math.floor(0.95 * a.length))];
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const heapMb = () => process.memoryUsage().heapUsed / 1048576;
const r3 = (x) => Math.round(x * 1000) / 1000;

/**
 * **校准哨兵**：一段固定计算量要多少毫秒 —— "这台机器此刻有多快"。
 *
 * 为什么需要它（本轮实测的教训）：同一份产物连跑三次，中位数差到 **2.2×**，事后查明
 * 是本机**同时有别的工作在跑**。而"CPU 占比"（`process.cpuUsage` / 墙钟）**测不出这件事** ——
 * V8 自己就有 JIT/GC 后台线程，那个比值常态就是 1.7~1.9（>1）。
 * 哨兵是直接可比的：同一台机器、同一段代码，它变慢了就说明有人在抢 CPU。
 *
 * 用法：量之前一次、量之后一次。**两次都要看**（后一次变慢 = 这一段里机器被占了）。
 */
let CANARY_SINK = 0;
function calibrate() {
  const t0 = performance.now();
  let x = 0;
  for (let i = 0; i < 4000000; i++) x = (x + i) % 1000003;
  CANARY_SINK = x;
  return performance.now() - t0;
}

// ── 每个 (N, 第几次) 一个**子进程** ──────────────────────────────────────────
//
// 两条理由，都是被实测逼出来的：
// 1. **不在一个进程里顺序跑多档**：库侧有进程级计数器（`g_unmapped` / `g_unsupported`）
//    与 `MOBILE_HOST` 全局，跑第二档时会带着第一档的残留 —— 那是"数字说不清是哪次的"。
// 2. **必须能报"噪声带"**：本轮第一版只跑一次，于是 N=1000 出现"改完更慢、N=5000 更快"
//    这种自相矛盾的读数（差值小于进程间的方差）。所以 `--trials N` 跑 N 个子进程，
//    报**每次的中位数**与 min/median/max —— 只有超出噪声带的差才配叫"优化"。
if (!args.child && (args.ns.length > 1 || args.trials > 1 || args.profile)) {
  if (args.profile) process.exit(runProfiled(args));
  const tmpDir = path.join(ROOT, ".scratch", "perf");
  mkdirSync(tmpDir, { recursive: true });
  const byN = new Map();
  for (const n of args.ns) {
    const runs = [];
    for (let t = 1; t <= args.trials; t++) {
      const jf = path.join(tmpDir, `perf-${args.mode}-n${n}-t${t}.json`);
      const argv2 = [fileURLToPath(import.meta.url), "--n", String(n), "--mode", args.mode,
        "--frames", String(args.frames), "--warmup", String(args.warmup),
        "--child", "--quiet", "--json", jf, "--trials", "1"];
      if (args.label) argv2.push("--label", args.label);
      if (args.deps !== DEFAULT_DEPS) argv2.push("--deps", args.deps);
      if (args.artifact) argv2.push("--artifact", args.artifact);
      const r = spawnSync(process.execPath, argv2, { stdio: "inherit" });
      if (r.status !== 0) { console.error(`N=${n} 第 ${t} 次失败（exit ${r.status}）`); process.exit(r.status || 1); }
      runs.push(JSON.parse(readFileSync(jf, "utf8")));
    }
    byN.set(n, runs);
  }
  printSummary(byN, args);
  const agg = {
    label: args.label || null, mode: args.mode, frames: args.frames, warmup: args.warmup, trials: args.trials,
    artifact: [...byN.values()][0][0].artifact,
    by_n: Object.fromEntries([...byN.entries()].map(([n, runs]) => [n, {
      medians: runs.map((r) => r.metrics.frame_ms_median),
      mins: runs.map((r) => r.metrics.frame_ms_min),
      p95s: runs.map((r) => r.metrics.frame_ms_p95),
      cpu_ratios: runs.map((r) => r.metrics.cpu_ratio),
      canaries: runs.map((r) => r.metrics.canary_before_ms),
      heap_delta_mb: runs.map((r) => r.metrics.heap_delta_mb),
      load: runs[0].load, by_type: runs[0].metrics.by_type,
    }])),
  };
  if (args.json) { mkdirSync(path.dirname(path.resolve(args.json)), { recursive: true }); writeFileSync(path.resolve(args.json), JSON.stringify(agg, null, 2)); }
  process.exit(0);
}

// ── `--profile`：用 V8 的 CPU profiler 回答"这些毫秒花在谁身上" ────────────────
//
// ⚠️ 采样本身有开销，所以**这一档的耗时数字只能用来看"占比"，不能当基线**。
function runProfiled(a) {
  const dir = path.join(ROOT, ".scratch", "perf", "cpuprofile");
  mkdirSync(dir, { recursive: true });
  const before = new Set(readdirSync(dir));
  const argv2 = ["--cpu-prof", `--cpu-prof-dir=${dir}`, fileURLToPath(import.meta.url),
    "--n", String(a.ns[0]), "--mode", a.mode, "--frames", String(a.frames),
    "--warmup", String(a.warmup), "--child", "--quiet", "--trials", "1"];
  if (a.artifact) argv2.push("--artifact", a.artifact);
  if (a.deps !== DEFAULT_DEPS) argv2.push("--deps", a.deps);
  const r = spawnSync(process.execPath, argv2, { stdio: "inherit" });
  const fresh = readdirSync(dir).filter((f) => f.endsWith(".cpuprofile") && !before.has(f));
  if (fresh.length === 0) { console.error("没有拿到 .cpuprofile"); return 1; }
  const p = JSON.parse(readFileSync(path.join(dir, fresh[fresh.length - 1]), "utf8"));
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const self = new Map();
  for (let i = 0; i < p.samples.length; i++) {
    const id = p.samples[i];
    self.set(id, (self.get(id) || 0) + (p.timeDeltas[i] || 0));
  }
  const merged = new Map();
  for (const [id, us] of self) {
    const cf = byId.get(id).callFrame;
    const name = cf.functionName || "(anonymous)";
    const file = (cf.url || "").split(/[\\/]/).pop() || "";
    const key = `${name}  ${file}`;
    merged.set(key, (merged.get(key) || 0) + us);
  }
  const total = [...self.values()].reduce((x, y) => x + y, 0);
  const rows = [...merged.entries()].sort((x, y) => y[1] - x[1]).slice(0, 25);
  console.log(`\n══ CPU 采样（self time，共 ${(total / 1000).toFixed(1)} ms 采样）══`);
  for (const [k, us] of rows) {
    const pct = (us / total) * 100;
    console.log(`  ${pct.toFixed(1).padStart(5)}%  ${(us / 1000).toFixed(1).padStart(8)} ms  ${k}`);
  }

  // ── 调用者归因：把"这 15% 花在数组分配上"推进到"**谁**在造这些数组" ─────────
  //
  // 做法：`.cpuprofile` 的节点是一棵树（`children` 是 id 数组），先建"父指针"，
  // 再把前几名函数按**名字**聚合，看它们的父函数是谁。
  // 这一步是本轮最有产出的一步：它把"分配很贵"这个没法动手的结论，
  // 变成"`Style` 的 Map 每帧都在重建"这种能动手的结论。
  const parentOf = new Map();
  for (const nd of p.nodes) for (const c of nd.children || []) parentOf.set(c, nd.id);
  const nameOf = (id) => {
    const cf = byId.get(id)?.callFrame || {};
    return `${cf.functionName || "(anonymous)"}  ${(cf.url || "").split(/[\\/]/).pop() || ""}`;
  };
  console.log(`\n── 调用者归因（前 5 名函数的父函数）──`);
  for (const [k, us] of rows.slice(0, 5)) {
    const ids = p.nodes.filter((nd) => `${nd.callFrame.functionName || "(anonymous)"}  ${(nd.callFrame.url || "").split(/[\\/]/).pop() || ""}` === k).map((nd) => nd.id);
    const parents = new Map();
    for (const id of ids) {
      const pid = parentOf.get(id);
      if (pid === undefined) continue;
      const pk = nameOf(pid);
      parents.set(pk, (parents.get(pk) || 0) + (self.get(id) || 0));
    }
    const top = [...parents.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
    console.log(`  ${k}  (${(us / 1000).toFixed(0)} ms)`);
    for (const [pk, pus] of top) console.log(`      ← ${((pus / us) * 100).toFixed(0).padStart(3)}%  ${pk}`);
  }
  console.log(`\n⚠️ 采样有开销：这一轮的耗时数字只能用来看**占比**，基线数字请用不带 --profile 的那次。`);
  return 0;
}

// ── gc 兜底：内存那两项要 `--expose-gc`，没有就自 re-exec 一次 ────────────────
//
// ⚠️ **必须把 profiling 那两个开关带过去**：`--cpu-prof*` 在 `process.execArgv` 里，
// 而 `process.argv` 里没有它 —— 只传 `argv.slice(1)` 的话，`--profile` 那一轮会
// **re-exec 成一个没有 profiler 的进程**，然后你去 `cpu-prof-dir` 里找不到文件
// （报的是"没拿到 .cpuprofile"，与真因无关）。
if (typeof globalThis.gc !== "function") {
  const keep = process.execArgv.filter((a) => a.startsWith("--cpu-prof"));
  const r = spawnSync(process.execPath, [...keep, "--expose-gc", ...process.argv.slice(1)], { stdio: "inherit" });
  process.exit(r.status === null ? 1 : r.status);
}

// ── 产物发现（**按模块名精确匹配**，歧义就报错）──────────────────────────────
//
// 为什么不写死路径：`_build/js/<profile>/build/` 下的形状取决于模块在**构建根里的身份**
// —— 工作区成员是 `<作者>/<模块>/<模块>.js`，独立模块是平铺的。写死必错一边
// （这条实测在 `npm/moobile-host/lib/build.js` 的注释里，这里沿用同一套"发现"哲学）。
function findArtifact(profile) {
  const base = path.join(ROOT, "_build", "js", profile, "build");
  if (!existsSync(base)) return [];
  const hits = [];
  const walk = (dir, depth) => {
    if (depth > 3) return;
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, name.name);
      if (name.isDirectory()) walk(p, depth + 1);
      else if (name.name === `${MODULE_NAME}.js`) hits.push(p);
    }
  };
  walk(base, 0);
  return hits;
}

function sha256(p) {
  return crypto.createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
}

function checkHostFresh(deps) {
  const copy = path.join(deps, "node_modules", "moobile-host", "core.js");
  const src = path.join(ROOT, "npm", "moobile-host", "core.js");
  if (!existsSync(copy) || !existsSync(src)) return { ok: false, why: "缺 core.js（副本或源码）" };
  const md5 = (p) => crypto.createHash("md5").update(readFileSync(p)).digest("hex");
  const a = md5(copy), b = md5(src);
  return { ok: a === b, why: a === b ? "副本与源码一致" : `副本陈旧（副本 ${a.slice(0, 8)} ≠ 源码 ${b.slice(0, 8)}）` };
}

// ── 记账桩 React：只记元素与 handler，不做任何 diff ───────────────────────────
function makeStubReact(counts) {
  const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };
  return {
    Fragment: Symbol("moobile.Fragment"),
    /** 归零 —— 要在**驱动一帧之前**调，否则"每帧元素数"会把预热那些帧一起算进去。 */
    reset() { for (const k of Object.keys(counts)) delete counts[k]; },
    createElement(type, props, ...children) {
      bump(typeof type === "string" ? type : String(type));
      for (const k of Object.keys(props || {})) {
        if (k !== "children" && k !== "style" && k !== "key" && /^on[A-Z]/.test(k) && typeof props[k] === "function") bump("__handlers");
        if (k === "style") bump("__styles");
      }
      return {
        type,
        key: props && props.key != null ? props.key : null,
        props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
      };
    },
    cloneElement(el, extra) { bump("__clone"); return { ...el, key: extra && extra.key }; },
  };
}

// ── 元素树遍历（两种形态都要认：真 React 元素 / 记账桩的仿制品）───────────────
function flat(c) {
  if (c == null || c === false) return [];
  return Array.isArray(c) ? c.flat(Infinity).filter((x) => x != null && x !== false) : [c];
}
function* walkEl(el) {
  if (!el || typeof el !== "object" || !("type" in el)) return;
  yield el;
  for (const k of flat(el.props && el.props.children)) yield* walkEl(k);
}
/**
 * 子树里有没有这段文字（**递归**找）。
 *
 * ⚠️ 为什么必须递归：`render.mbt` 的 `VNode::Text` 会**把每个文本节点再包一层 `Text`**
 * （RN 的硬约束：裸字符串不能当 `View` 的子节点）。所以应用写 `@html.button(…, "+1")`
 * 落在树上其实是 `button > Text > "+1"` —— 只查一层会找不到（第一版就是这么错的，
 * 报的还是"负载改了？"这种与真因无关的话）。
 */
function hasText(el, needle) {
  for (const node of walkEl(el)) {
    if (flat(node.props && node.props.children).some((k) => typeof k === "string" && k.includes(needle))) return true;
  }
  return false;
}
/** 在元素树里找**驱动按钮**：子树含 `DRIVER_TEXT`，且带一个函数型 prop。 */
function findDriver(el) {
  for (const node of walkEl(el)) {
    if (!hasText(node, DRIVER_TEXT)) continue;
    for (const [k, v] of Object.entries(node.props || {})) {
      if (k !== "children" && typeof v === "function") return { fn: v, prop: k };
    }
  }
  return null;
}

// ── jsdom 环境（只有 dom 档需要；顺序必须在 import react-dom **之前**）────────
function setupJsdom(require) {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // ⚠️ Node 24 起 `globalThis.navigator` 是**只读 getter**，直接赋值 TypeError
  // （antd 试金石的注释里记着这条，这里同样踩得到）。
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
  for (const k of ["HTMLElement", "Element", "Node", "Event", "MouseEvent"]) globalThis[k] = dom.window[k];
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

// ── 统计助手见文件上方（要在 fan-out 之前定义）──

// ── 主流程（单档）────────────────────────────────────────────────────────────-
async function main() {
  const n = args.ns[0];
  // `--artifact` —— 直接量**一份给定的产物文件**。
  // 为什么需要它：A/B 要的是"同一个测量口径下的两份构建"。让两份产物并存（各自存一份 .js），
  // 交错着量，就不必来回改源码、反复重编 —— 而重编本身会让"改前/改后"混进别的东西。
  // 产物是**自包含**的（库代码已经打进 bundle 里），所以单独一份文件就能量。
  let artifact;
  if (args.artifact) {
    if (!existsSync(args.artifact)) { console.error(`--artifact 指的文件不存在：${args.artifact}`); process.exit(2); }
    artifact = args.artifact;
  } else {
    const hits = findArtifact("debug");
    if (hits.length === 0) {
      console.error(`找不到产物 ${MODULE_NAME}.js。先在仓库根跑：moon build --target js\n（也可以在 examples/apps/perf-bench 里跑）`);
      process.exit(2);
    }
    if (hits.length > 1) {
      console.error(`发现 ${hits.length} 份同名产物，歧义不猜：\n  ` + hits.map((p) => path.relative(ROOT, p)).join("\n  "));
      process.exit(2);
    }
    artifact = hits[0];
  }
  const hostFresh = checkHostFresh(args.deps);
  if (!hostFresh.ok && !args.quiet) console.error(`⚠️ 宿主副本：${hostFresh.why}`);

  const require = createRequire(path.join(args.deps, "noop.js"));
  const React = require("react");
  // ⚠️ 版本号走**文件**读，不走 `require("react/package.json")`：React 19 的
  // `exports` 映射里没有 `./package.json`，那条 require 会 `ERR_PACKAGE_PATH_NOT_EXPORTED`。
  const pkgVersion = (name) => {
    try { return JSON.parse(readFileSync(path.join(args.deps, "node_modules", name, "package.json"), "utf8")).version; }
    catch { return "?"; }
  };
  const depsVersions = args.mode === "dom"
    ? { react: pkgVersion("react"), "react-dom": pkgVersion("react-dom"), jsdom: pkgVersion("jsdom") }
    : { react: `记账桩（未装真 React；node_modules 里有 ${pkgVersion("react")} 但本档不用）` };
  if (args.mode === "dom") setupJsdom(require);

  const core = await import(pathToFileURL(path.join(args.deps, "node_modules", "moobile-host", "core.js")).href);

  // 负载规模：**在 `app()` 之前**注入（`initial()` 会读它）。
  globalThis.__MOBILE_BENCH_N__ = n;

  const counts = {};
  const stub = makeStubReact(counts);
  const COMPONENTS = { View: "div", Text: "span", Pressable: "button", TextInput: "input", ScrollView: "div" };
  // ⚠️ **调度同步**（理由见文件头第 3 条）。宿主 `react` 按档给：translate 给桩、dom 给真 React。
  core.installHostCore({
    reset: true,
    react: args.mode === "dom" ? React : stub,
    components: COMPONENTS,
    // dom 档：DOM 元素不认 `onPress`，必须由**宿主事件表**把它落成 `onClick`
    //（这正是设计稿说的"落点由宿主决定"）。translate 档不需要，用默认表即可。
    events: args.mode === "dom" ? { "*": { click: "onClick", input: "onChange", change: "onChange" } } : {},
    platform: "web",
    scheduleTask: (f) => f(),
    scheduleFrame: (f) => f(),
  });

  const mod = await import(pathToFileURL(artifact).href);
  const handles = mod.app();
  core.checkContract(handles);
  handles.start();

  // ── dom 档：挂进 jsdom ──
  let domCtx = null;
  if (args.mode === "dom") {
    const { createRoot } = require("react-dom/client");
    const act = React.act ?? require("react").act;
    const Root = core.mountRoot(handles);
    const container = globalThis.document.createElement("div");
    globalThis.document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(React.createElement(Root)); });
    const btn = [...container.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === DRIVER_TEXT);
    if (!btn) { console.error(`jsdom 里找不到文本为 "${DRIVER_TEXT}" 的按钮 —— 负载或事件映射变了`); process.exit(1); }
    domCtx = { act, btn, container, root };
  }

  // ── 找一个"驱动帧"的东西（两档的驱动方式不同）──
  let drive;
  if (args.mode === "dom") {
    // 真实那一路：往 DOM 上派发一次点击（React 的事件系统、diff、commit 全都要跑）。
    drive = async () => {
      await domCtx.act(async () => {
        domCtx.btn.dispatchEvent(new globalThis.window.MouseEvent("click", { bubbles: true, cancelable: true, view: globalThis.window }));
      });
    };
  } else {
    const d = findDriver(handles.element());
    if (!d) { console.error(`元素树里找不到驱动按钮（文本 "${DRIVER_TEXT}"）—— 负载或事件映射改了？`); process.exit(1); }
    if (!args.quiet) console.log(`驱动：文本 "${DRIVER_TEXT}" 上的 prop = \`${d.prop}\``);
    // 同步调用：调度是同步装好的，所以这一句返回时整帧已经算完（见文件头第 3 条）。
    drive = () => d.fn();
  }

  // ── 元素 / handler / style 计数：**驱动正好一帧**，然后读计数 ────────────────
  //
  // ⚠️ 必须 `reset()` 后只驱动一帧：桩在 translate 档是**全程挂着**的，
  // 从 `start()` 到预热到计时全都会记账 —— 不归零的话"每帧元素数"是个无意义的累加值。
  if (args.mode === "dom") globalThis.MOBILE_HOST.react = stub;
  stub.reset();
  await drive();
  const elements = Object.entries(counts).filter(([k]) => !k.startsWith("__")).reduce((s, [, v]) => s + v, 0);
  const byType = Object.fromEntries(Object.entries(counts).filter(([k]) => !k.startsWith("__")));
  const perFrame = {
    elements, handlers: counts.__handlers || 0, styles: counts.__styles || 0, clones: counts.__clone || 0,
  };
  if (args.mode === "dom") globalThis.MOBILE_HOST.react = React;
  // 理论元素数 —— **含每个文本节点自动多出来的一层 `Text`**（`render.mbt` 的
  // `VNode::Text` 分支；RN 不允许裸字符串当 `View` 的子节点）。
  // 每行：div + span + span + button = 4 作者元素，外加 3 个文本各包一层 = 7；
  // 表头 3 个作者元素 + 2 个文本 = 5；再加上根 div 与列表 div = 2。⇒ 7N + 7。
  // 这个式子是**口径**：改 `app.mbt` 的视图就必须改它，否则 `shape_ok` 会红。
  const theoretical = 7 * n + 7;

  // ── 预热（JIT）──
  for (let i = 0; i < args.warmup; i++) await drive();

  // ── 计时 ──
  // 哨兵（量之前）—— 顺便它也是 JIT 的预热。
  const canaryBefore = med([calibrate(), calibrate(), calibrate()]);
  if (typeof globalThis.gc === "function") globalThis.gc();
  const heap0 = heapMb();
  const per = [];
  // ★ **污染记录**：CPU 时间 / 墙钟时间。
  //
  // ⚠️ 它**不是**"干净与否"的判据：V8 的 JIT/GC 后台线程让这个比值常态就在 1.7~1.9（>1）。
  //    它的用处是**跨次比较** —— 同一配置的几次里，某一次明显偏低，就说明那一次条件不同。
  //    真正可读的是**校准哨兵**（见 `calibrate()`）。
  const cpu0 = process.cpuUsage();
  const wall0 = performance.now();
  for (let i = 0; i < args.frames; i++) {
    const t0 = performance.now();
    await drive();
    per.push(performance.now() - t0);
  }
  const wallMs = performance.now() - wall0;
  const cpu = process.cpuUsage(cpu0);
  const cpuRatio = (cpu.user + cpu.system) / 1000 / wallMs;
  const canaryAfter = med([calibrate(), calibrate(), calibrate()]);
  const heap1 = heapMb();
  let retained = null;
  if (typeof globalThis.gc === "function") { globalThis.gc(); retained = heapMb() - heap0; }

  // ── dom 档附带：`act()` 自身的开销（不扣掉它就会把差距算到 React 头上）──
  let actFloor = null;
  if (args.mode === "dom") {
    const floors = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      await domCtx.act(async () => {});
      floors.push(performance.now() - t0);
    }
    actFloor = med(floors);
  }

  const half = Math.floor(per.length / 2);
  const out = {
    label: args.label || null,
    mode: args.mode,
    n,
    frames: args.frames,
    warmup: args.warmup,
    artifact: { path: path.relative(ROOT, artifact).replace(/\\/g, "/"), sha256: sha256(artifact), bytes: statSync(artifact).size, mtime: statSync(artifact).mtime.toISOString() },
    host_copy_fresh: hostFresh.ok,
    env: {
      node: process.version, platform: `${process.platform}-${process.arch}`,
      cpu: (os.cpus()[0] && os.cpus()[0].model) || "?", cores: os.cpus().length, mem_gb: r3(os.totalmem() / 1073741824),
      ...depsVersions,
    },
    load: { ...perFrame, theoretical_elements: theoretical, shape_ok: elements === theoretical },
    metrics: {
      frame_ms_median: r3(med(per)), frame_ms_p95: r3(p95(per)), frame_ms_mean: r3(mean(per)),
      frame_ms_min: r3(sorted(per)[0]),
      ms_per_row: r3(med(per) / n),
      half_drift: r3(med(per.slice(half)) / med(per.slice(0, half))),
      act_floor_ms: actFloor === null ? null : r3(actFloor),
      cpu_ratio: r3(cpuRatio),
      canary_before_ms: r3(canaryBefore),
      canary_after_ms: r3(canaryAfter),
      heap_delta_mb: r3(heap1 - heap0),
      heap_retained_mb: retained === null ? null : r3(retained),
      by_type: byType,
      unmapped: handles.unmapped(), unsupported: handles.unsupported(),
    },
  };

  if (args.json) {
    mkdirSync(path.dirname(path.resolve(args.json)), { recursive: true });
    writeFileSync(path.resolve(args.json), JSON.stringify(out, null, 2));
  }
  console.log(`@@PERF@@${JSON.stringify(out)}`);
  if (!args.quiet) printBlock(out);
}

// ── 打印 ─────────────────────────────────────────────────────────────────────
function printBlock(o) {
  const m = o.metrics;
  console.log(`\n── ${o.label ? o.label + " · " : ""}${o.mode} · N=${o.n} ─────────────────────────────`);
  console.log(`  产物      ${o.artifact.path}  sha256:${o.artifact.sha256}  ${(o.artifact.bytes / 1024).toFixed(0)} KB  ${o.artifact.mtime}`);
  console.log(`  环境      node ${o.env.node} · ${o.env.cpu} (${o.env.cores} 核) · react ${o.env.react}${o.env["react-dom"] ? " · react-dom " + o.env["react-dom"] : ""}`);
  console.log(`  负载      ${o.load.elements} 元素（理论 ${o.load.theoretical_elements}${o.load.shape_ok ? " ✓" : " ✗ 形状不符"}） · ${o.load.handlers} handler · ${o.load.styles} style 对象 · ${o.load.clones} cloneElement`);
  console.log(`  每帧      median ${m.frame_ms_median} ms  p95 ${m.frame_ms_p95} ms  mean ${m.frame_ms_mean} ms  (min ${m.frame_ms_min})`);
  console.log(`            ${m.ms_per_row} ms/行 · 后半/前半 ${m.half_drift}${m.half_drift > 1.15 ? "  ⚠️ 漂移" : ""}${m.act_floor_ms !== null ? ` · act() 地板 ${m.act_floor_ms} ms` : ""}`);
  console.log(`  内存      heap 增量 ${m.heap_delta_mb} MB${m.heap_retained_mb === null ? "（无 --expose-gc）" : ` · gc 后残留 ${m.heap_retained_mb} MB`}`);
  console.log(`  诊断      unmapped=${m.unmapped} unsupported=${m.unsupported}`);
}

function printSummary(byN, a) {
  console.log(`\n══ 汇总：${a.label ? a.label + " · " : ""}${a.mode} · 每次 ${a.frames} 帧（预热 ${a.warmup}） · ${a.trials} 次 ══`);
  console.log("      N    元素  每帧中位[最小..最大]      min     p95      ms/行   heap/帧  哨兵前/后");
  for (const [n, runs] of byN) {
    const mds = runs.map((r) => r.metrics.frame_ms_median);
    const los = runs.map((r) => r.metrics.frame_ms_min);
    const p95s = runs.map((r) => r.metrics.frame_ms_p95);
    const heap = runs.map((r) => r.metrics.heap_delta_mb);
    const cb = runs.map((r) => r.metrics.canary_before_ms ?? 0);
    const ca = runs.map((r) => r.metrics.canary_after_ms ?? 0);
    const spread = Math.max(...mds) / Math.min(...mds);
    console.log(
      `  ${String(n).padStart(6)} ${String(runs[0].load.elements).padStart(7)}  ` +
      `${String(med(mds)).padStart(7)} [${String(Math.min(...mds)).padStart(7)}..${String(Math.max(...mds)).padStart(7)}]` +
      `  ${String(med(los)).padStart(7)} ${String(med(p95s)).padStart(7)}  ${String(r3(med(mds) / n)).padStart(7)}  ` +
      `${((med(heap) * 1024) / a.frames).toFixed(0).padStart(7)} KB  ${String(med(cb)).padStart(5)}/${String(med(ca)).padStart(5)}` +
      (spread > 1.2 ? `   ⚠️ 次间差 ${spread.toFixed(2)}×（噪声带很宽，别拿单次读数下结论）` : ""),
    );
  }
  // 校准哨兵：绝对毫秒随机器变，但**同一台机器上同一份代码**应当稳定。
  // 前/后差别大 = 量到一半条件变了；跨配置差别大 = 两次不是在同等条件下量的。
  const allRuns = [...byN.values()].flat();
  const canaries = allRuns.map((o) => o.metrics.canary_before_ms ?? 0).filter((x) => x > 0);
  if (canaries.length > 1) {
    const lo = Math.min(...canaries), hi = Math.max(...canaries);
    if (hi / lo > 1.25) console.log(`\n⚠️ **条件不稳**：校准哨兵在 ${lo}~${hi} ms 之间浮动（${(hi / lo).toFixed(2)}×）——`);
    if (hi / lo > 1.25) console.log(`   这台机器在测量期间并不安静，跨配置的对比要打折看。`);
  }
  const hashes = [...new Set([...byN.values()].flat().map((o) => o.artifact.sha256))];
  console.log(`\n产物      ${hashes.length === 1 ? hashes[0] + `（${byN.size} 档同一份产物 ✓）` : hashes.join(" / ") + "  ⚠️ 不是同一份产物，曲线不可比"}`);
  console.log(`          ${[...byN.values()][0][0].artifact.path}`);
  console.log(`宿主副本  ${[...byN.values()].flat().every((o) => o.host_copy_fresh) ? "与源码一致 ✓" : "⚠️ 有陈旧副本"}`);
  const bad = [...byN.values()].flat().filter((o) => !o.load.shape_ok);
  if (bad.length) console.log(`⚠️ 负载形状与理论值不符：${bad.map((o) => "N=" + o.n).join(", ")}（改过 app.mbt？同步改本文件与 PERF.md 的口径）`);
}

await main();
