#!/usr/bin/env node
// migrate_click_scan.mjs —— F1 新规则 `click.on-view` 的**离线门**（两份实现 + 诱饵）。
//
//   node tools/migrate_click_scan.mjs
//
// ## 这条规则为什么非有不可（它是迁移里最隐蔽的一类静默失效）
//
// `on_click` 在 moobile 里映射成 RN 的 `onPress`，而标签表里**只有 `button` / `a` 落到
// `Pressable`**；`div` / `span` / `p` 落到 `View` / `Text`，那两个组件没有 `onPress`
// —— 点击被**丢掉**，不报错、不警告、`moon check` 全绿。
// 实测（`interest/yi`）：**5 处** `div(… on_click=…)` —— 卦卡点不动、折叠点不开；
// 当年是**手工**找出来的（`create` 的 TODO 清单里那 5 条），现在它是 F1 的正式一条。
//
// ## 为什么要有诱饵（而不是"在真项目上跑出 5 条就算过"）
//
// "在真项目上数出 5 条"只证明了**数得出来**，没证明**不瞎数**：
//   · `button(… on_click=…)` / `a(… on_click=…)` 是**对的写法**，一条都不该报；
//   · `on_clicked(…)` 这种同前缀的名字不该被当成 `on_click=`；
//   · 跨行的调用（`on_click=` 与左括号隔了好几行）必须**找到外层那次调用的标签**；
//   · 行号必须指到 `on_click` 那一行（不是文件头、不是左括号那行）。
// 所以这里造一个**小诱饵项目**，把期望值写死，两侧都必须逐条对上。
//
// ⚠️ 有意的一条口径：**注释里的代码同样算命中**（与那 14 条按行子串的规则同一口径：
//    `needle: 'class='` 在注释里一样命中）。这是**刻意**的 —— 假阳性（注释）比假阴性
//    （漏掉一个真的点不动的块）代价小得多。所以诱饵里那行注释**期望被命中**，
//    写在这儿免得下一个人把它当 bug 修掉。
//
// ⚠️ 两侧实现：`npm/moobile-host/lib/migrate/click-on-view.js`（JS，随包发布）
//    与 `tools/mbtools/src/migrate_scan.mbt`（MoonBit，真源）。改一边必须改另一边 ——
//    这条门与 `tools/migrate_scan_reconcile.mjs` 一起守这件事。

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(import.meta.url);
const { scanClickOnView } = req(path.join(ROOT, "npm", "moobile-host", "lib", "migrate", "click-on-view.js"));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}

// ── 诱饵源码：每一行都为了钉住一条判据 ──────────────────────────────────────
//
// 行号是期望值的一部分，所以这份源码**不能随便重排**（改了就要同步改下面的期望）。
const FIXTURE_LINES = [
  'fn view() {', //                                        1
  '  div(on_click=emit(A), "x")', //                       2  ← 命中（div）
  '  button(on_click=emit(B), "y")', //                    3  正确写法，不报
  '  a(on_click=emit(C), "z")', //                         4  正确写法，不报
  '  on_clicked(1)', //                                    5  同前缀的名字，不报
  '  @html.div(', //                                       6
  '    attrs=@styles.att(s),', //                          7
  '    on_click=emit(D),', //                              8  ← 命中（跨行也要找到 div）
  '    [span("q")],', //                                   9
  '  )', //                                               10
  '  div (', //                                           11  标签与括号之间有空格的写法
  '    on_click=emit(E),', //                              12  ← 命中
  '  )', //                                               13
  '  span(on_click=emit(F), "s")', //                      14  ← 命中（span 也不响）
  '  // div(on_click=emit(G))', //                         15  ← **注释里的也算**（见文件头那条口径）
  '  div(attrs=@styles.att(x), [p("no click here")])', // 16  没有 on_click，不报
  '}', //                                                 17
];
const FIXTURE = FIXTURE_LINES.join("\n") + "\n";
// 期望命中：(行号, 标签名)
const EXPECT = [
  [2, 'div'],
  [8, 'div'],
  [12, 'div'],
  [14, 'span'],
  [15, 'div'],
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "moobile-click-scan-"));
const projDir = path.join(tmp, "decoy-project");
fs.mkdirSync(path.join(projDir, "frontend"), { recursive: true });
fs.writeFileSync(path.join(projDir, "frontend", "main.mbt"), FIXTURE);
// 一个扫描器会动的 `moon.mod`：让报告里除了新规则之外还有别的东西（空项目"两边都数 0"最容易骗自己）
fs.writeFileSync(
  path.join(projDir, "moon.mod"),
  'name = "decoy/project"\nversion = "0.1.0"\npreferred_target = "wasm-gc"\n',
);
// 同样的代码放在一个**不被扫描**的扩展名里：确认规则只在 `.mbt` 上生效
fs.writeFileSync(path.join(projDir, "frontend", "main.mbt.bak"), FIXTURE);

try {
  // ── ① JS 侧（直接调共享实现）──────────────────────────────────────────────
  const jsHits = scanClickOnView(FIXTURE).map((h) => [h.line, h.tag]);
  check(
    "诱饵：JS 侧逐条命中（含跨行 / 空格式写法 / span / 注释）",
    JSON.stringify(jsHits) === JSON.stringify(EXPECT),
    JSON.stringify(jsHits),
  );
  check(
    "诱饵：`button` / `a` / `on_clicked` **一条都不报**（负例）",
    jsHits.every(([, tag]) => tag !== 'button' && tag !== 'a') && jsHits.length === EXPECT.length,
    JSON.stringify(jsHits),
  );

  // ── ② 两份实现的报告都要有这一类，且逐 hit（file:line/text）一致 ───────────
  const jsReport = req(path.join(ROOT, "npm", "moobile-host", "lib", "migrate", "scan.js")).scanProject({
    root: projDir.split(path.sep).join("/"),
    lib: ROOT.split(path.sep).join("/"),
    top: 5,
  });
  const mbRun = spawnSync(
    "bash",
    ["tools/mb.sh", "migrate-scan", "--root", projDir.split(path.sep).join("/"), "--lib", ROOT.split(path.sep).join("/"), "--json"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  if (mbRun.error || mbRun.status !== 0) {
    check(
      "MoonBit 侧能跑（`bash tools/mb.sh migrate-scan`）",
      false,
      (mbRun.error && mbRun.error.message) || (mbRun.stdout || "") + (mbRun.stderr || ""),
    );
    throw new Error("MoonBit 侧跑不起来，后面的对账没有意义");
  }
  const out = mbRun.stdout || "";
  const a = out.indexOf("{");
  const b = out.lastIndexOf("}");
  const mbReport = JSON.parse(out.slice(a, b + 1));

  const pick = (r) => (r.findings || []).find((f) => f.id === "click.on-view");
  const jsF = pick(jsReport);
  const mbF = pick(mbReport);
  check("两侧报告里都有 `click.on-view` 这一类", Boolean(jsF) && Boolean(mbF), `JS=${!!jsF} MB=${!!mbF}`);
  if (jsF && mbF) {
    const sig = (f) => f.hits.map((h) => `${h.file}:${h.line}|${h.text}`);
    const jsSig = sig(jsF);
    const mbSig = sig(mbF);
    check(
      `两侧逐 hit 一致（file:line + text，共 ${jsSig.length} 条）`,
      JSON.stringify(jsSig) === JSON.stringify(mbSig),
      JSON.stringify(jsSig) === JSON.stringify(mbSig) ? "" : `JS=${JSON.stringify(jsSig)}\n      MB=${JSON.stringify(mbSig)}`,
    );
    for (const key of ["id", "auto", "count", "why", "next"]) {
      check(`两侧 \`${key}\` 一致`, jsF[key] === mbF[key], `JS=${JSON.stringify(jsF[key])} MB=${JSON.stringify(mbF[key])}`);
    }
    check(
      "命中行的 `text` 带上了标签标注（人要照着它改）",
      jsF.hits.every((h) => /← `\w+\(…\) on_click=`/.test(h.text)),
      jsF.hits[0] ? jsF.hits[0].text : "（无命中）",
    );
    check(
      "`.mbt.bak` 那份**没被算进来**（规则只在 `.mbt` 上生效）",
      jsF.hits.every((h) => h.file.endsWith(".mbt")),
      [...new Set(jsF.hits.map((h) => h.file))].join(","),
    );
  }

  // ── ③ 真项目上的读数（判据是"5 处"，当年是手工数出来的）────────────────────
  //
  // 诱饵证明"不瞎数"，真项目证明"数得到" —— 两件事都要。
  const REAL = process.env.MIGRATE_CLICK_REAL || path.resolve(ROOT, "..", "yi", "zhouyi_reader");
  if (fs.existsSync(REAL)) {
    const real = req(path.join(ROOT, "npm", "moobile-host", "lib", "migrate", "scan.js")).scanProject({
      root: REAL.split(path.sep).join("/"),
      lib: ROOT.split(path.sep).join("/"),
      top: 5,
    });
    const f = (real.findings || []).find((x) => x.id === "click.on-view");
    check(
      `真项目（${path.basename(path.dirname(REAL))}/${path.basename(REAL)}）命中 5 处 —— 与当年手工数出的 5 处一致`,
      Boolean(f) && f.count === 5,
      f ? `${f.count} 处：${f.hits.map((h) => h.file + ":" + h.line).join(" / ")}` : "没有这一类",
    );
    check(
      "那 5 处都在 `frontend/main.mbt`（卦卡 / 变爻 / 爻辞 / 小象 / 折叠）",
      Boolean(f) && f.hits.every((h) => h.file === "frontend/main.mbt"),
      f ? [...new Set(f.hits.map((h) => h.file))].join(",") : "—",
    );
  } else {
    console.log(`SKIP  真项目不在（${REAL}）—— 只跑了诱饵那几条`);
  }
} catch (e) {
  check("探针自身没炸", false, String(e.message).split("\n")[0]);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const pass = results.filter((r) => r.ok).length;
console.log("\n================ F1 新规则 `click.on-view` 汇总 ================");
console.log(`通过 ${pass}  失败 ${results.length - pass}`);
for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL  ${r.name}`);
console.log(
  "⚠️ 这条门守两件事：**规则数得对**（诱饵里 5 命中 / 3 负例）与**两份实现一模一样**。" +
    "「真机上点得动」不在它范围里 —— 那条在 examples/apps/zhouyi-reader/device_check.mjs。",
);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
