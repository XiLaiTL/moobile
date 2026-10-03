#!/usr/bin/env node
// migrate_app_audit.mjs —— **生成物自查**的离线门（迁移缺的两块：根样式与滚动容器）。
//
//   node tools/migrate_app_audit.mjs
//
// ## 这条门在守什么
//
// 迁移能编译、web 判据能全绿，**仍然**可能少两样东西 —— 而它们只在原生上现形：
//
//   ① `page()`（源 CSS 的 `body`/`html` 声明）被生成出来了，却**没人挂到元素上**；
//   ② 根上没有滚动容器 —— RN 的 `View` 不滚动，超过一屏的内容在真机上**够不着**。
//
// 本轮实测（zhouyi-reader 迁到 Android）就是这两条同时踩中：
// 真机上「滚动 30 次、界面纹丝不动」，而**同一个页面**在 web 判据里 45/45。
// 判据写在库侧（`npm/moobile-host/lib/migrate/app-audit.js`），本文件只负责
// "拿真实应用与**故意做坏的样本**去撞它"。
//
// ## 为什么必须有证伪样本
//
// 一个"永远返回空数组"的检查器能让所有真实应用都绿。所以除了"真应用 0 命中"，
// 这里还构造了 5 个**故意做坏**的样本目录（含两个诱饵：注释里的假代码、
// 组件属性名也叫 `scroll`），要求它**逐条点名**。

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { auditApp } = require(path.join(ROOT, "npm", "moobile-host", "lib", "migrate", "app-audit.js"));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}
const ids = (dir) => auditApp(dir).map((f) => f.id);

// ── 1) 真实应用：迁移过的应用**必须干净** ─────────────────────────────────────
//
// 这四个是"人在用"的应用（zhouyi-reader 是本轮三端迁移的主应用）。
// 它们干净 = 这条门对真代码是绿的；下面那批坏样本 = 它对坏代码会红。
const AUDITED = [
  ["examples/apps/zhouyi-reader", "本轮三端迁移的主应用（web / Android 真机都在跑）"],
  ["examples/apps/todo-app", "R1 样本屏：它的 F7 判据就是「这一页必须能滚」"],
  ["examples/apps/chat-app", "气泡列表：要滚的就是中间那块"],
  ["examples/apps/gesture-edges", "手势边界样本：滚动容器用 width/height 定尺寸"],
];
for (const [rel, why] of AUDITED) {
  const got = ids(path.join(ROOT, rel));
  check(`真实应用干净：${rel}`, got.length === 0, got.length ? `${got.join(",")}（${why}）` : why);
}

// ── 2) 两个**已记录**的例外：命中是事实，不是漏网 ─────────────────────────────
//
// 例外必须**点名列出**而不是"整目录跳过"：这样一旦它们多出**别的**命中，门照样红。
const KNOWN = [
  [
    "examples/apps/perf-bench",
    ["no-native-scroll"],
    "压测 harness：行数是**刻意**撑爆视口的，滚不滚不在它测的东西里（给它补滚动容器会改掉被测负载）",
  ],
  [
    "examples/apps/antd-demo",
    ["no-native-scroll"],
    "组件库画廊（web 演示）：真要在原生上跑就得补滚动容器 —— 记在这儿，别让它偷偷绿",
  ],
];
for (const [rel, expect, why] of KNOWN) {
  const got = ids(path.join(ROOT, rel));
  check(
    `已记录的例外：${rel} 只命中 ${expect.join(",")}`,
    got.length === expect.length && expect.every((e) => got.includes(e)),
    `实际 ${got.join(",") || "（干净）"} —— ${why}`,
  );
}

// ── 3) 证伪样本 ──────────────────────────────────────────────────────────────
const tmp = mkdtempSync(path.join(os.tmpdir(), "moobile-app-audit-"));
const STYLES = `///|\n/// 源 CSS 的 body/html\npub fn page() -> @style.Style {\n  @style.Style::new().background_color("#efe5d0")\n}\n`;

/** 造一个最小应用目录：`main.mbt` 的内容由调用方给（`{MAIN}`）。 */
function fixture(name, mainText, opts = {}) {
  const dir = path.join(tmp, name);
  mkdirSync(path.join(dir, "styles"), { recursive: true });
  if (opts.withStyles !== false) writeFileSync(path.join(dir, "styles", "styles.mbt"), STYLES);
  writeFileSync(path.join(dir, "main.mbt"), mainText);
  return dir;
}

const GOOD_MAIN = `fn view(model : Model) -> @html.Html {
  @html.div(
    attrs=@styles.att(@styles.page().flex(1.0)),
    [
      @html.node(
        "scroll",
        @styles.att(@style.Style::new().flex(1.0)),
        [@html.div("内容")],
      ),
    ],
  )
}
`;
const BROKEN_MAIN = `fn view(model : Model) -> @html.Html {
  @html.div([@html.div("内容")])
}
`;
// 诱饵一：**注释里**写着正确做法 —— 去注释之后这两条都应命中
const COMMENT_DECOY = `/// 正确做法：attrs=@styles.att(@styles.page().flex(1.0))，
/// 再包一层 @html.node("scroll", @styles.att(@style.Style::new().flex(1.0)), [...])
fn view(model : Model) -> @html.Html {
  @html.div([@html.div("内容")])
}
`;
// 诱饵二：滚动容器没有 flex / height（RN 里会量成 0 高）
const NO_FLEX_MAIN = `fn view(model : Model) -> @html.Html {
  @html.div(
    attrs=@styles.att(@styles.page().flex(1.0)),
    [@html.node("scroll", @styles.att(@style.Style::new()), [@html.div("内容")])],
  )
}
`;
// 诱饵三：裸的 `"scroll"` 字符串是**组件属性名**，不是伪标签
const ANTD_DECOY = `fn view(model : Model) -> @html.Html {
  @html.div(attrs=@styles.att(@styles.page().flex(1.0)), [antd_table(opt_json(a, "scroll", scroll))])
}
`;

const good = fixture("good", GOOD_MAIN);
const broken = fixture("broken", BROKEN_MAIN);
const commentDecoy = fixture("comment-decoy", COMMENT_DECOY);
const noFlex = fixture("no-flex", NO_FLEX_MAIN);
const antdDecoy = fixture("antd-decoy", ANTD_DECOY);
const noMbt = path.join(tmp, "empty-app");
mkdirSync(noMbt, { recursive: true });

try {
  check("证伪①「哪条都没做」→ 两条都点名", JSON.stringify(ids(broken)) === JSON.stringify(["page-style-unused", "no-native-scroll"]), ids(broken).join(",") || "（一条都没报 —— 检查器是瞎的）");
  check("证伪②「两件都做了」→ 干净", ids(good).length === 0, ids(good).join(","));
  check(
    "证伪③ 注释里的假代码**不算数**（去注释后才判）",
    JSON.stringify(ids(commentDecoy)) === JSON.stringify(["page-style-unused", "no-native-scroll"]),
    ids(commentDecoy).join(",") || "注释满足了判据 —— 那断言就在测我的注释",
  );
  check(
    "证伪④ 滚动容器没有 flex/height → 只报 scroll-without-flex",
    JSON.stringify(ids(noFlex)) === JSON.stringify(["scroll-without-flex"]),
    ids(noFlex).join(",") || "（没报 —— 量成 0 高这种情况没人管）",
  );
  check(
    "证伪⑤ 裸的 `\"scroll\"` 属性名**不算**滚动容器",
    JSON.stringify(ids(antdDecoy)) === JSON.stringify(["no-native-scroll"]),
    ids(antdDecoy).join(",") || "（把组件属性当成了滚动容器）",
  );
  check("证伪⑥ 目录里没有 .mbt → 明确说「这不是应用目录」", JSON.stringify(ids(noMbt)) === JSON.stringify(["no-mbt"]), ids(noMbt).join(","));

  // ── 4) 判据本身要能区分"有 page() 但没人用"与"根本没有 page()" ──────────────
  // 前者才是迁移的洞（生成器抽出来了却没人挂），后者是应用**确实没有** body 级样式 ——
  // 不该报（否则每个没有全局样式的应用都会被冤枉）。
  const noPageFn = fixture("no-page-fn", BROKEN_MAIN, { withStyles: false });
  check(
    "样式层里没有 `page()` → 不报 page-style-unused（只报滚动那条）",
    JSON.stringify(ids(noPageFn)) === JSON.stringify(["no-native-scroll"]),
    ids(noPageFn).join(","),
  );
} catch (e) {
  check("探针自身没炸", false, String(e.message).split("\n")[0]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const pass = results.filter((r) => r.ok).length;
console.log("\n================ 生成物自查（迁移的洞）汇总 ================");
console.log(`通过 ${pass}  失败 ${results.length - pass}`);
for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL  ${r.name}`);
console.log(
  "⚠️ 这条门只读文件、不跑应用：它守的是「生成物里**少了**这两块」。" +
    "「补上之后原生上真的能滚」由 examples/apps/zhouyi-reader/device_check.mjs 守（真机 29 项）。",
);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
