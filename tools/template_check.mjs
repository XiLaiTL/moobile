#!/usr/bin/env node
// template_check.mjs —— 脚手架的**离线**门：生成 → 编译 → 构建 → 真跑一遍。
//
//   node tools/template_check.mjs            # 全套（约 20 秒）
//   node tools/template_check.mjs --quick    # 只跑便宜的（生成 + 替换干净 + 文件集合）
//   node tools/template_check.mjs --keep     # 留下临时目录（调试用）
//
// 对应 docs/design/SCAFFOLD.md §6 的哪几条：
//
//   T1b  替换干净   生成物里不许残留模板的字面量（`moobile-template` / `{{`）
//   T1c  模板自身可验 模板在仓库里能编译 —— 这一条由 verify_all 的 `moon check` 覆盖
//                    （模板是 moon.work 的成员），这里只确认"它确实在工作区里"
//   T3   生成物可编译 在一份临时工作区里 `moon check --target js` 通过
//   T3b  生成物可构建+可运行 `moon build` → `moobile-host build` → 无头跑一遍界面逻辑
//
// ── 为什么每一条都值得存在（而不是"多一个检查"）────────────────────────────────
//
// 模板是**真源**（§3.4：demo 是它的测试用例）。真源一旦坏了，坏的不是一个示例，
// 而是**每一个新用户拿到的第一个项目** —— 而这件事以前没有任何一条门看得见，
// 因为模板自己不存在。T1b 挡住"漏参数化"（用真字面量的对价），T3/T3b 挡住
// "模板能编、生成物不能编"这类只在别人机器上暴露的差异。
//
// ⚠️ 生成器是**当子进程跑真实 CLI**（`node npm/moobile-host/bin/cli.js init …`），
//    不是在进程内调函数：用户敲的就是这条命令，门要验的是它。

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "npm", "moobile-host", "bin", "cli.js");
const argv = process.argv.slice(2);
const QUICK = argv.includes("--quick");
const KEEP = argv.includes("--keep");

const req = createRequire(import.meta.url);
const templateLib = req(path.join(ROOT, "npm", "moobile-host", "lib", "template.js"));
const placeholdersLib = req(path.join(ROOT, "npm", "moobile-host", "lib", "placeholders.js"));
const buildLib = req(path.join(ROOT, "npm", "moobile-host", "lib", "build.js"));

const APP_NAME = "gen-check-app";
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
}
function section(t) {
  console.log(`\n== ${t} ==`);
}

/** 跑命令，返回 {ok, out}。所有子进程的输出都攒着，失败时一起打出来。 */
// ⚠️ 刻意**不用 shell**：`shell: true` 在 Windows 上会把 `D:\Program Files\nodejs\node.exe`
//    按空格切开（第一次就是这么红的：`'D:\Program' is not recognized…`）。
//    node 用 process.execPath 的绝对路径，moon 交给 PATH 解析（moon.exe）。
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || ""), status: r.status };
}

// ── 0) 真源与临时目录 ─────────────────────────────────────────────────────────
const tpl = templateLib.locate();
section(`模板：${path.relative(ROOT, tpl.dir)}（${tpl.how}）`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "moobile-template-check-"));
const app = path.join(tmp, APP_NAME);
if (!KEEP) {
  process.on("exit", () => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* Windows 上偶尔删不掉（文件被占），不值得让门变红 */
    }
  });
} else {
  console.log(`临时目录（--keep）：${tmp}`);
}

// ── 0.5) 包内副本新鲜度（只在发包时存在）──────────────────────────────────────
// `publish.sh` 会把真源按发布规矩拷进 `npm/moobile-host/template/`（npm 包只能发文件，
// 而 `moobile-host init` 跑在别人的机器上 —— 模板必须随包走）。
// 于是又出现一个"副本 ≠ 源码"的漂移点。**副本可以存在，但不能静默**：
// 存在就必须与真源逐字节一致，否则这里红。
const staged = path.join(ROOT, "npm", "moobile-host", "template");
if (fs.existsSync(staged)) {
  const a = templateLib.read(tpl.dir).map((f) => [f.rel, f.text]).sort();
  const b = templateLib.read(staged).map((f) => [f.rel, f.text]).sort();
  const same = JSON.stringify(a) === JSON.stringify(b);
  check(
    "包内模板副本与真源逐字节一致（publish.sh 拷进去的那份）",
    same,
    same
      ? `${a.length} 个文件`
      : `真源 ${a.length} 个 / 副本 ${b.length} 个 —— 别手改副本，改真源`,
  );
} else {
  console.log("SKIP  包内模板副本（不存在 —— 它只在 publish.sh 发包期间存在）");
}

// ── 1) T1b：生成 ──────────────────────────────────────────────────────────────
const init = run(process.execPath, [CLI, "init", app], { cwd: tmp });
check("init 生成成功（真实 CLI，子进程）", init.ok, init.ok ? "" : init.out.trim().split("\n")[0]);
if (!init.ok) {
  console.log(init.out);
  process.exit(1);
}

const generated = templateLib.read(app);
const source = templateLib.read(tpl.dir);

// 替换干净：自己再扫一遍，不信生成器的自述（门要能独立抓住）
const residue = placeholdersLib.assertClean(generated);
check(
  "T1b 替换干净（无字面量残留）",
  residue.length === 0,
  residue.length ? residue.slice(0, 3).join("；") : `${generated.length} 个文件`,
);

// 文件集合一致：少一个文件 = 生成物缺胳膊（这正是 `cp` 写死路径会出的错）
const genSet = generated.map((f) => f.rel).sort();
const srcSet = source.map((f) => f.rel).sort();
check(
  "文件集合与模板逐一对上",
  JSON.stringify(genSet) === JSON.stringify(srcSet),
  genSet.join(" "),
);

// 参数化真的生效（三个值各验一处，别只验 grep 通过）
const moonMod = generated.find((f) => f.rel === "moon.mod").text;
const pkg = JSON.parse(generated.find((f) => f.rel === "package.json").text);
const appJson = JSON.parse(generated.find((f) => f.rel === "app.json").text);
check("moon.mod 的模块名换成新的", /name = "gen-check-app"/.test(moonMod));
check("package.json 的 name 换成新的", pkg.name === APP_NAME, pkg.name);
check(
  "app.json 的 name/slug/android.package 都换了",
  appJson.expo.name === APP_NAME &&
    appJson.expo.slug === APP_NAME &&
    appJson.expo.android.package === "com.anonymous.gencheckapp",
  `${appJson.expo.name} / ${appJson.expo.slug} / ${appJson.expo.android.package}`,
);
check(
  "生成物没把构建产物带过去（moobile.js / _build 不入模板）",
  !fs.existsSync(path.join(app, "moobile.js")) && !fs.existsSync(path.join(app, "_build")),
);

// ── 1.5) **打包形态**的离线代理：npm 解包会把 `.gitignore` 改名成 `.npmignore` ──────
//
// 2026-09-21 实测出来的坑：tarball 里明明是 `template/.gitignore`（`files` 白名单也写了它），
// 但 `npm install` **解包那一步**会把它改名成 `.npmignore`（手写 `tar -xzf` 不会）——
// 于是从**装好的包**生成出来的项目**没有 `.gitignore`**，用户会把 `moobile.js` / `_build/`
// 提交进自己的仓库，而这在仓库布局下**永远复现不出来**。
//
// 那条门（真身）是 `tools/package_check.mjs`：真打 tarball、真 `npm install`、再用**装好的 CLI**
// 生成一遍 —— 要 registry，所以它挂在**发布前**（`publish.sh` 会调）。这里放的是一份**离线代理**：
// 把模板副本里的 `.gitignore` 改个名（npm 干的就是这件事），再用 `MOBILE_TEMPLATE_DIR` 指过去
// 生成一遍。于是"改了 init 的拷贝逻辑、把还原那步弄丢了"在**日常门**里就红，不必等到发包前。
const pkgLike = path.join(tmp, "pkg-like-template");
fs.cpSync(tpl.dir, pkgLike, { recursive: true });
for (const junk of ["node_modules", "_build", "moobile.js", "package-lock.json"]) {
  fs.rmSync(path.join(pkgLike, junk), { recursive: true, force: true });
}
if (fs.existsSync(path.join(pkgLike, ".gitignore"))) {
  fs.renameSync(path.join(pkgLike, ".gitignore"), path.join(pkgLike, ".npmignore"));
}
const pkgApp = path.join(tmp, "pkg-form-app");
const initPkgForm = run(process.execPath, [CLI, "init", pkgApp, "--name", APP_NAME], {
  cwd: tmp,
  env: { ...process.env, MOOBILE_TEMPLATE_DIR: pkgLike },
});
const pkgAppNames = fs.existsSync(pkgApp) ? fs.readdirSync(pkgApp) : [];
check(
  "打包形态（`.gitignore` 被 npm 改名成 `.npmignore`）生成出来仍然是 `.gitignore`",
  initPkgForm.ok && pkgAppNames.includes(".gitignore") && !pkgAppNames.includes(".npmignore"),
  initPkgForm.ok
    ? pkgAppNames.filter((n) => n.includes("ignore")).join(" ") || "（一个都没有）"
    : initPkgForm.out.trim().split("\n")[0],
);

if (QUICK) {
  report();
}

// ── 2) T3：在临时工作区里编译 ─────────────────────────────────────────────────
section("T3 生成物可编译（临时工作区，吃本地源码）");
const winRoot = process.platform === "win32" ? ROOT.replace(/\\/g, "/") : ROOT;
fs.writeFileSync(
  path.join(app, "moon.work"),
  `// 门临时写的：把生成出来的项目与仓库里的库连起来，于是**不用联网**也能编。\n` +
    `// ⚠️ 用户拿到的项目里没有这个文件 —— 它的依赖从 registry 解析（见 README）。\n` +
    `members = [\n  "${winRoot}",\n  ".",\n]\n`,
);

const chk = run("moon", ["check", "--target", "js"], { cwd: app });
check(
  "T3 生成物 moon check --target js 通过",
  chk.ok,
  chk.ok ? (chk.out.match(/\((\d+ warnings?, \d+ errors?)\)/) || [])[1] || "" : "见下",
);
if (!chk.ok) console.log(chk.out.split("\n").slice(-25).join("\n"));

const bld = run("moon", ["build", "--target", "js"], { cwd: app });
check("T3 生成物 moon build --target js 通过", bld.ok, bld.ok ? "" : "见下");
if (!bld.ok) console.log(bld.out.split("\n").slice(-25).join("\n"));

// ── 3) 产物发现：成员形态 ─────────────────────────────────────────────────────
section("生成物的产物：发现（不是写死 cp）");
const mod = buildLib.findUp(app, "moon.mod");
const moduleName = buildLib.readModuleName(mod.hit);
const buildRoot = buildLib.findUp(app, path.join("_build", "js", "debug", "build"));
const nested = buildRoot && path.join(buildRoot.hit, moduleName, `${moduleName}.js`);
check(
  "工作区成员形态：产物在 build/<模块名>/<模块名>.js（实测布局）",
  Boolean(nested && fs.existsSync(nested)),
  nested ? path.relative(app, nested) : "找不到",
);

const cop = run(process.execPath, [CLI, "build"], { cwd: app });
check("moobile-host build 找到并搬走产物", cop.ok, cop.ok ? "" : cop.out.trim());
if (cop.ok && nested && fs.existsSync(nested)) {
  const same = fs.readFileSync(path.join(app, "moobile.js")).equals(fs.readFileSync(nested));
  check("搬过去的 moobile.js 与产物逐字节相同", same);
}

// 独立形态（**布局来自实测**：空目录里 `moon new` + `moon add`，产物平铺在 build/ 下）
// —— 这里只验"发现逻辑在这种情况下也能找到"，不重复造一个 moon 项目。
const flat = path.join(tmp, "flat-app");
fs.mkdirSync(path.join(flat, "_build", "js", "debug", "build"), { recursive: true });
fs.writeFileSync(path.join(flat, "moon.mod"), `name = "${APP_NAME}"\nversion = "0.1.0"\n`);
if (nested && fs.existsSync(nested)) {
  fs.copyFileSync(nested, path.join(flat, "_build", "js", "debug", "build", `${APP_NAME}.js`));
}
const copFlat = run(process.execPath, [CLI, "build"], { cwd: flat });
check(
  "独立形态（平铺 _build/js/debug/build/<模块名>.js）：扫描也能找到",
  copFlat.ok && fs.existsSync(path.join(flat, "moobile.js")),
  copFlat.ok ? copFlat.out.split("\n")[1]?.trim() : copFlat.out.trim().split("\n")[0],
);

// ── 4) T3b：真跑一遍（无头，无浏览器无 Metro）─────────────────────────────────
section("T3b 生成物跑得起来（无头）");
const head = run(
  process.execPath,
  [
    path.join(ROOT, "tools", "verify_headless.mjs"),
    "--app",
    app,
    // 模板有"还有 N 件"这一行 —— 计数断言是可选的，**不指定就跳过**（而不是假装验过）。
    "--count-pattern",
    "还有 %d 件",
  ],
  { cwd: ROOT, timeout: 120000 },
);
check("无头验证（首屏 + 输入 + 添加 + 勾选 + 删除）全过", head.ok, head.ok ? "" : "见下");
if (!head.ok) console.log(head.out.split("\n").slice(-25).join("\n"));

report();

function report() {
  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log("================ 模板门汇总 ================");
  console.log(`通过 ${results.length - failed.length}  失败 ${failed.length}`);
  for (const f of failed) console.log("  FAIL  " + f.name);
  process.exit(failed.length ? 1 : 0);
}
