#!/usr/bin/env node
// check_npm_fresh —— `npm/moobile-host/` 的源码，与 demo 里装的那份副本是否一致。
//
//   node tools/check_npm_fresh.mjs
//
// 为什么需要这条门（2026-09 的事故）：
//
//   `examples/apps/todo-app/host/package.json` 把宿主包写成 `file:…/npm/moobile-host`。
//   直觉上这像 symlink（改源码立刻生效），**实测不是** —— npm 把它装成了一份**独立副本**
//   （两边 inode 不同）。于是出现一个非常坏的组合：
//
//     · 源码里的 `bin/cli.js` 常量是坏的（旧仓库路径）；
//     · `node_modules` 里那份副本被**手工修过**，是好的；
//     · `verify_all.sh` 那条门跑的是 `npx moobile-host` = **副本** → 门是绿的。
//
//   结果：门绿、demo 能跑、**而仓库源码与已发布的 npm 包都是坏的**。
//   这类"验证跑的不是被测物"的坑在本仓库记过好几次（FINDINGS R7/R8），所以这条门
//   的存在意义不是"多一个检查"，而是**让"副本 ≠ 源码"这件事不可能静默**。
//
// 判据：副本必须是源码的复制品 —— 两边每个文件逐字节相同，文件集合也相同。
//       不一致 → 非零退出，并给出可照抄的刷新命令。
//
// 注意：**`package.json` 也要比**。`npm install` 从 `file:` 依赖装出来的副本与源码
//       应当一致；若哪天不一致，同样值得红（那说明装的时候就有偏差）。

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "npm", "moobile-host");
const HOST = join(ROOT, "examples", "apps", "todo-app", "host");
const DST = join(HOST, "node_modules", "moobile-host");

const quiet = process.argv.includes("--quiet");
const say = (...a) => { if (!quiet) console.log(...a); };

/**
 * 已安装副本的位置。**必须是"另一份"，不能是源码自己。**
 *
 * 为什么要防"等于源码"：应用的 `package.json` 写的是 `file:…` 相对路径，
 * 而 **npm 9.2.0 对这种相对 `file:` 的解析基准不可靠** —— 实测：应用声明
 * `file:../../../../npm/moobile-host`（从 `host/` 退四级，正确），但 lockfile 存的是
 * 旧的 `file:../npm/moobile-host`（退一级），`npm install` 会照 lock 的基准解析，
 * 报出一个不存在的路径（2026-09 实测）。所以这里**不依赖 npm 的解析**：
 * 自己按 `package.json` 算出源码位置并**排除它**，只认真正的 `node_modules` 副本。
 *
 * ⚠️ 这里踩过一次：第一版把"按 spec 解析出的目录"当候选 2，而它**恰好等于源码目录**，
 *    于是拿源码和源码比 → 永远"一致" → 副本根本不存在也报绿。
 *    同一个假通过形状（验证跑的不是被测物）在本仓库已记过三次，所以这层排除是必需的。
 */
function findInstalled() {
  const fromSpec = (() => {
    try {
      const pkg = JSON.parse(readFileSync(join(HOST, "package.json"), "utf8"));
      const spec = (pkg.dependencies || {})["moobile-host"] || "";
      return spec.startsWith("file:") ? resolve(HOST, spec.slice("file:".length)) : null;
    } catch {
      return null;
    }
  })();

  const isSource = (p) => p !== null &&
    resolve(p).toLowerCase() === resolve(SRC).toLowerCase();

  // node_modules 副本优先；其次才是 `file:` 指向的目录，且必须不是源码本身
  for (const cand of [DST, fromSpec]) {
    if (cand && !isSource(cand) && existsSync(cand)) return cand;
  }
  return null;
}

/** 递归列出目录下的文件，返回相对路径（POSIX 分隔符）数组。 */
function listFiles(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) listFiles(full, base, out);
    else out.push(relative(base, full).split("\\").join("/"));
  }
  return out;
}

/**
 * 「会被 npm 发布的文件」判定器 —— 依据源码 `package.json` 的 `files` 白名单。
 *
 * 为什么必须按白名单比：`publish.sh` 住在包目录里，但**不在 `files` 里**，
 * 所以 npm 不会把它装进 `node_modules`。第一版把它算成「副本里缺」→ 假红。
 * 实测过：源码 8 个文件、副本 7 个，缺的就是 `publish.sh`（`npm pack --dry-run`
 * 的 Tarball Contents 里也没有它）。门若在这里红，修的人会去动一个**没错**的文件。
 *
 * 顺带一个好处：比"会被发布的那些"比"整个目录"更贴这条门的目的 ——
 * 我们真正怕的是"发出去的那份和源码不一致"。
 */
function importantMatcher() {
  let files;
  try {
    files = JSON.parse(readFileSync(join(SRC, "package.json"), "utf8")).files;
  } catch {
    return () => true; // 读不到白名单就不筛，宁可多比也不漏比
  }
  if (!Array.isArray(files) || !files.length) return () => true;

  const entries = files.map((e) => e.replace(/^\.\//, "").replace(/\/$/, ""));
  return (rel) => entries.some((e) => rel === e || rel.startsWith(e + "/"));
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function main() {
  const dst = findInstalled();
  if (!dst) {
    console.error(
      "check_npm_fresh: 找不到 " + relative(ROOT, DST) + "（真正的「另一份」副本）。\n" +
      "  先在 examples/apps/todo-app/host 里跑一次 npm install。\n" +
      "  ⚠️ 副本不存在时**不能**报「一致」—— 那正是本工具要防的假通过。",
    );
    process.exit(2);
  }

  const important = importantMatcher();
  const srcFiles = new Set(listFiles(SRC).filter(important));
  const dstFiles = new Set(listFiles(dst).filter(important));

  const missing = [...srcFiles].filter((f) => !dstFiles.has(f)).sort();
  const extra = [...dstFiles].filter((f) => !srcFiles.has(f)).sort();
  const differing = [...srcFiles]
    .filter((f) => dstFiles.has(f) && sha256(join(SRC, f)) !== sha256(join(dst, f)))
    .sort();

  if (!missing.length && !extra.length && !differing.length) {
    say(`check_npm_fresh: 一致（${srcFiles.size} 个文件）`);
    return;
  }

  console.error("check_npm_fresh: 副本与源码不一致 —— 这条门就是为这件事存在的。");
  console.error("");
  console.error("  源码   : " + relative(ROOT, SRC));
  console.error("  已装副本: " + relative(ROOT, dst));
  console.error("");
  for (const f of differing) console.error("  内容不同  " + f);
  for (const f of missing) console.error("  副本里缺  " + f);
  for (const f of extra) console.error("  副本里多  " + f);
  console.error("");
  console.error("  ⚠️ 别只改副本：副本是 `file:` 依赖装出来的，改了它源码不会变，");
  console.error("     而发布出去的、别人装到的是**源码**。改源码，然后刷新副本：");
  console.error("");
  console.error("     cd examples/apps/todo-app/host");
  console.error("     rm -rf node_modules/moobile-host && npm install");
  console.error("");
  process.exit(1);
}

main();
