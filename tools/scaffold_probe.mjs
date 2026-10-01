#!/usr/bin/env node
// scaffold_probe.mjs —— 脚手架**承载真应用**的那条门。
//
//   node tools/scaffold_probe.mjs [--keep]
//
// 流程（全部离线）：
//   1. `moobile-host init` 生成一个项目（真实 CLI，子进程）；
//   2. 把 `tools/scaffold_probe/app/*.mbt` 覆盖进去 —— 也就是"用户拿到项目之后写的第一版代码"：
//      **拆成三个文件、多一个编辑页、多一套过滤**（模板是单文件的最小 Todo）；
//   3. `moon check` / `moon build` → `moobile-host build` → 拿到 `moobile.js`；
//   4. `tools/verify_headless.mjs` 无头跑一遍，外加 `scaffold_probe/scenario.mjs` 的剧本
//      （过滤切换 + 进编辑页 + 保存 + 计数）。
//
// ── 为什么这条门要单独存在 ────────────────────────────────────────────────────
//
// `tools/template_check.mjs` 验的是"生成物能编、能跑起**模板自带的最小 Todo**"。
// 那还回答不了这个真问题：**生成出来的形状撑不撑得住一个像样的应用**（多文件、多页面、
// 状态里有好几路 Msg）。历史教训就在这个形状上：产物路径不是模块名的函数、`host/` 这一层
// 生成物没有、`App.js` 只有 4 行 —— 每一条都足以让"模板能跑"与"生成物能跑"分家。
//
// ⚠️ 探针住 `tools/` 的理由（与 pub_probe / ext_probe 同规矩）：**只为一条门存在、不给人跑**。
//    真给人跑的示例是 `examples/apps/todo-app/`。
//
// ⚠️ 刻意**不用 shell**：`shell: true` 在 Windows 上会把 `D:\Program Files\...\node.exe`
//    按空格切开（template_check 第一次就是这么红的）。

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "npm", "moobile-host", "bin", "cli.js");
const PROBE = path.join(ROOT, "tools", "scaffold_probe");
const KEEP = process.argv.includes("--keep");

const req = createRequire(import.meta.url);
const templateLib = req(path.join(ROOT, "npm", "moobile-host", "lib", "template.js"));

const APP_NAME = "scaffold-probe-app";
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || ""), status: r.status };
}
function fail(name, out) {
  console.log(`\n---- ${name} 的输出（末尾 25 行）----`);
  console.log(out.split("\n").slice(-25).join("\n"));
}

const tpl = templateLib.locate();
console.log(`== 模板：${path.relative(ROOT, tpl.dir)}（${tpl.how}）==`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "moobile-scaffold-probe-"));
if (KEEP) console.log(`临时目录（--keep）：${tmp}`);
else {
  process.on("exit", () => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* Windows 上偶尔删不掉，不值得让门变红 */
    }
  });
}

// ── 1) 生成 ───────────────────────────────────────────────────────────────────
const app = path.join(tmp, APP_NAME);
const init = run(process.execPath, [CLI, "init", app], { cwd: tmp });
check("init 生成项目", init.ok, init.ok ? "" : init.out.trim().split("\n")[0]);
if (!init.ok) {
  fail("init", init.out);
  process.exit(1);
}

// ── 2) 把探针应用覆盖上去（这就是"实现 demo"那一步）────────────────────────────
const srcDir = path.join(PROBE, "app");
const sources = fs.readdirSync(srcDir).filter((n) => n.endsWith(".mbt"));
for (const name of sources) {
  fs.copyFileSync(path.join(srcDir, name), path.join(app, name));
}
check(
  `探针应用覆盖到生成物上（${sources.length} 个 .mbt：${sources.join(" ")}）`,
  sources.length >= 3 && fs.existsSync(path.join(app, "model.mbt")),
  "模板的 app.mbt 被覆盖、model.mbt / ui.mbt 是新增的",
);

// 覆盖之后必须仍然**只有一份** `app` 导出（多文件最容易出的错是两个 app()）
const dupExport = sources.filter((n) => /pub fn app\s*\(/.test(fs.readFileSync(path.join(app, n), "utf8")));
check("只有一个 `pub fn app()`（多文件没有重复导出）", dupExport.length === 1, dupExport.join(" "));

// ── 3) 编译 ───────────────────────────────────────────────────────────────────
const winRoot = process.platform === "win32" ? ROOT.replace(/\\/g, "/") : ROOT;
fs.writeFileSync(
  path.join(app, "moon.work"),
  `// 门临时写的：把生成出来的项目与仓库里的库连起来（离线可编）。\nmembers = [\n  "${winRoot}",\n  ".",\n]\n`,
);

const chk = run("moon", ["check", "--target", "js"], { cwd: app });
check(
  "探针应用在生成物里 moon check 通过（多文件 + 多页面）",
  chk.ok,
  chk.ok ? (chk.out.match(/\((\d+ warnings?, \d+ errors?)\)/) || [])[1] || "" : "见下",
);
if (!chk.ok) fail("moon check", chk.out);

const bld = run("moon", ["build", "--target", "js"], { cwd: app });
check("moon build --target js 通过", bld.ok, bld.ok ? "" : "见下");
if (!bld.ok) fail("moon build", bld.out);

const cop = run(process.execPath, [CLI, "build"], { cwd: app });
check("moobile-host build 搬出 moobile.js", cop.ok && fs.existsSync(path.join(app, "moobile.js")), cop.ok ? "" : cop.out.trim());
if (!cop.ok) fail("moobile-host build", cop.out);

// ── 4) 跑起来（无头 + 剧本）──────────────────────────────────────────────────
const head = run(
  process.execPath,
  [
    path.join(ROOT, "tools", "verify_headless.mjs"),
    "--app",
    app,
    "--delete-label",
    "✕",
    "--count-pattern",
    "还有 %d 件",
    "--scenario",
    path.join("tools", "scaffold_probe", "scenario.mjs"),
  ],
  { cwd: ROOT, timeout: 180000 },
);
// 子进程的输出直接透出来：里面的每条断言都是判据，藏起来就变成"信我"
console.log("");
console.log(head.out.trimEnd());
console.log("");
check("无头验证 + 探针剧本全部通过", head.ok, head.ok ? "" : "见上面的 FAIL");

// ── 汇总 ──────────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log("");
console.log("================ 探针门汇总 ================");
console.log(`通过 ${results.length - failed.length}  失败 ${failed.length}`);
for (const f of failed) console.log("  FAIL  " + f.name);
process.exit(failed.length ? 1 : 0);
