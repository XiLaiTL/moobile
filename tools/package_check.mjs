#!/usr/bin/env node
// package_check.mjs —— **打包形态**的门：把包打出来、装进去、用**装进去的那份 CLI** 生成一个项目。
//
//   node tools/package_check.mjs            # 约 5–15 秒（要 npm；走一次 registry 解析）
//   node tools/package_check.mjs --keep     # 留下临时目录（调试用）
//
// ── 为什么必须有这一条（2026-09-21 实测出来的）──────────────────────────────────
//
// 仓库里所有脚手架门（`template_check` / `scaffold_probe` / T1）都从**仓库布局**的模板生成 ——
// 而用户拿到的是**装到 node_modules 里的**那份。这两者**不是一回事**：
//
//   · tarball 里明明是 `template/.gitignore`（`npm pack --dry-run` 与 `tar -tzf` 都能看到）；
//   · 可是 `npm install` 解包时 npm 把它**改名成 `.npmignore`**（手写 tar 解包不会 —— 所以这是
//     npm 解包那一步干的，跟 pack 无关）；
//   · 于是 `init` 把这个名字照抄进用户的项目 → **用户拿到的项目没有 `.gitignore`**
//     （`moobile.js` / `_build/` 会被提交进他的仓库），而我们这边**永远复现不出来**。
//
// 这正是仓库里记过的那类坑（"发布包 ≠ 工作区"）的又一次，只不过这次不是"文件没打进去"，
// 而是"打进去了、装的时候被改了名"。**判据只能是"装完之后再生成一遍看看"。**
//
// ⚠️ 它**不进** `tools/verify_all.sh` 的默认那一组：要跑 `npm install`（要 registry）。
//    它是**发布前**的那道门 —— `npm/moobile-host/publish.sh --dry-run` 会调它。

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG_DIR = path.join(ROOT, "npm", "moobile-host");
const TPL_SRC = path.join(ROOT, "examples", "apps", "template");
const STAGED = path.join(PKG_DIR, "template");
const KEEP = process.argv.includes("--keep");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}
function report() {
  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log("================ 打包形态门汇总 ================");
  console.log(`通过 ${results.length - failed.length}  失败 ${failed.length}`);
  for (const f of failed) console.log("  FAIL  " + f.name);
  process.exit(failed.length ? 1 : 0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "moobile-package-check-"));
// ⚠️ **只删自己新建的**：`publish.sh` 会先暂存一份再叫这个门，那时它不能把人家的删掉
//    （本仓库在 `.mbti` 那件事上记过同一条：生成器"用完只删自己新建的"）。
const stagedByUs = !fs.existsSync(STAGED);
const cleanup = () => {
  if (stagedByUs) fs.rmSync(STAGED, { recursive: true, force: true });
  if (!KEEP) {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  }
};
process.on("exit", cleanup);

for (const f of ["bin/cli.js", "lib/init.js"]) {
  if (!fs.existsSync(path.join(PKG_DIR, f))) {
    check(`包里该有的文件还在（${f}）`, false, "是不是把包挪地方了？");
    report();
  }
}

// ── 1) 按发布规矩把模板拷进包内（与 publish.sh 同一套规则）────────────────────
console.log(`\n== 1) 模板按发布规矩拷进包内（${path.relative(ROOT, STAGED)}）==`);
if (stagedByUs) {
  fs.rmSync(STAGED, { recursive: true, force: true });
  fs.cpSync(TPL_SRC, STAGED, { recursive: true });
  for (const junk of ["node_modules", "_build", "moobile.js", "package-lock.json"]) {
    fs.rmSync(path.join(STAGED, junk), { recursive: true, force: true });
  }
} else {
  console.log("      （publish.sh 已经暂存好了，这里用它那份，跑完也不动它）");
}
check(
  "包内副本里有 ignore 规则文件",
  fs.existsSync(path.join(STAGED, ".gitignore")) || fs.existsSync(path.join(STAGED, ".npmignore")),
  fs.readdirSync(STAGED).filter((n) => n.includes("ignore")).join(" ") || "（一个都没有）",
);

// ── 2) npm pack ───────────────────────────────────────────────────────────────
console.log("\n== 2) npm pack ==");
const packTmp = path.join(tmp, "pack");
fs.mkdirSync(packTmp, { recursive: true });
const pack = spawnSync("npm", ["pack", "--silent", "--pack-destination", packTmp], {
  cwd: PKG_DIR,
  encoding: "utf8",
  shell: process.platform === "win32", // npm 在 Windows 上是 .cmd
});
const tgzName = (pack.stdout || "").trim().split("\n").pop();
const tgz = path.join(packTmp, tgzName || "");
check("npm pack 成功", pack.status === 0 && fs.existsSync(tgz), tgzName || (pack.stderr || "").slice(0, 200));
if (!fs.existsSync(tgz)) report();

// tarball 里那一条（`files` 白名单的事实依据）。
// ⚠️ 用 `npm pack --dry-run --json` 拿条目清单，**不要**去 shell 里调 `tar`：
//    第一版就是这么写的，本机 `tar` 的解析结果拿不到（Windows 上是 bsdtar），
//    于是"tarball 里有 .gitignore"这条**假红**了一次。
const dry = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: PKG_DIR,
  encoding: "utf8",
  shell: process.platform === "win32",
});
let tarFiles = [];
try {
  tarFiles = JSON.parse(dry.stdout)[0].files.map((f) => f.path);
} catch {
  tarFiles = [];
}
check(
  "tarball 里确实有 `template/.gitignore`（`files` 白名单没白写）",
  tarFiles.includes("template/.gitignore"),
  tarFiles.length ? tarFiles.filter((p) => p.includes("ignore")).join(" ") || "（一个 ignore 文件都没有）" : "拿不到条目清单",
);

// ── 3) 装进一个干净工程 ───────────────────────────────────────────────────────
console.log("\n== 3) 装进一个干净工程（npm install <tarball>）==");
const proj = path.join(tmp, "consumer");
fs.mkdirSync(proj, { recursive: true });
fs.writeFileSync(path.join(proj, "package.json"), JSON.stringify({ name: "pack-check-consumer", private: true, version: "0.0.0" }, null, 2) + "\n");
const inst = spawnSync(
  "npm",
  ["install", tgz, "--no-save", "--no-audit", "--no-fund", "--ignore-scripts"],
  { cwd: proj, encoding: "utf8", shell: process.platform === "win32", timeout: 180000 },
);
check(
  "装成功（连官方/镜像源解析 peer）",
  inst.status === 0,
  inst.status === 0 ? "" : ((inst.stdout || "") + (inst.stderr || "")).trim().split("\n").slice(-3).join(" / "),
);
if (inst.status !== 0) report();

const installed = path.join(proj, "node_modules", "moobile-host");
check("node_modules 里有那份包", fs.existsSync(installed));
const installedTemplate = path.join(installed, "template");
const installedNames = fs.existsSync(installedTemplate) ? fs.readdirSync(installedTemplate).filter((n) => n.includes("ignore")) : [];
check(
  "包内模板在**装完之后**还带着 ignore 规则（npm 会改名，所以这里看的是「还在不在」）",
  installedNames.length > 0,
  installedNames.join(" ") || "（一个都没有 —— npm 把它删了？）",
);

// ── 4) 用**装进去的那份** CLI 生成一个项目 ────────────────────────────────────
console.log("\n== 4) 用装进去的那份 CLI `init`（用户敲的就是这条）==");
const appDir = path.join(proj, "generated-app");
const init = spawnSync(process.execPath, [path.join(installed, "bin", "cli.js"), "init", appDir, "--name", "pack-check-app"], {
  cwd: proj,
  encoding: "utf8",
});
check("init 从**打包形态**跑通", init.status === 0, init.status === 0 ? "" : ((init.stdout || "") + (init.stderr || "")).trim().split("\n").slice(0, 3).join(" / "));
if (init.status !== 0) {
  console.log((init.stdout || "") + (init.stderr || ""));
  report();
}

const genNames = fs.readdirSync(appDir);
check(
  "生成物里有 `.gitignore`（**这就是那条实测出来的坑**：npm 解包会把模板里的 `.gitignore` 改名成 `.npmignore`）",
  genNames.includes(".gitignore"),
  genNames.filter((n) => n.includes("ignore")).join(" ") || "（一个都没有）",
);
check(
  "生成物里**没有**漏出来的 `.npmignore`（那是打包中间物的名字，不该出现在用户项目里）",
  !genNames.includes(".npmignore"),
);

// 逐一对上：两侧都把 `.npmignore` 归一到 `.gitignore` 再比（npm 的改名是已知的，不是差异）
const normalize = (names) => names.map((n) => (n === ".npmignore" ? ".gitignore" : n)).sort();
const stagedSet = normalize(fs.readdirSync(STAGED));
const genSet = normalize(genNames);
const sameSet = JSON.stringify(genSet) === JSON.stringify(stagedSet);
check(
  "生成物的文件与包内模板逐一对得上",
  sameSet,
  sameSet ? `${genSet.length} 个` : `生成物 [${genSet.join(" ")}] vs 模板 [${stagedSet.join(" ")}]`,
);

console.log(`\n      临时目录：${tmp}${KEEP ? "（--keep 保留）" : "（跑完删）"}`);
report();
