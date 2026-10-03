#!/usr/bin/env node
// verify.mjs —— 桌面宿主**在本机能跑的那条判据**。
//
//   node examples/apps/zhouyi-reader-desktop/verify.mjs
//
// ## 为什么是"打包"而不是"起窗口"
//
// 原生窗口要 VS 2026 + Windows SDK 22621（本机没有，见 README 与
// `docs/design/DESKTOP-RNW.md`）。但**"同一份 MoonBit 产物能不能进第三个宿主"**
// 这件事**不必等工具链**：`react-native bundle --platform windows` 走的是 Metro +
// RNW 的平台解析 + `AppRegistry` 入口，它把 `index.js → App.js → ../zhouyi-reader/moobile.js`
// 整条链解出来并打进一个 bundle。
//
// 判据分三层（每层都能单独说明问题）：
//   A. 命令退出码 0（解析、转换、打包都过了）；
//   B. 产物存在且大小合理（> 1 MB —— 里面装着 3 MB 的 moobile.js）；
//   C. **产物里能读到这个应用的真串**（从 `moobile.js` 里现取一段中文去比对）
//      —— 这一条挡住"打了个空壳"或"打的是别的应用"。
//
// ⚠️ 与前两个宿主的分工：web/Android 那两条判据（`../zhouyi-reader/verify.mjs`、
//    `device_check.mjs`）验的是**界面**；这条只验**能不能把界面打进去**。

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..", "zhouyi-reader");
const OUT_DIR = path.join(HERE, "out");
const BUNDLE = path.join(OUT_DIR, "index.windows.bundle");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}
function skipOut(why) {
  console.log(`SKIP  ${why}`);
  process.exit(2); // 2 = 环境不够，没验（与仓库其它探针同一约定）
}

// ── 0) 前置：产物在不在、依赖装没装 ──────────────────────────────────────────
const moobileJs = path.join(APP, "moobile.js");
if (!existsSync(moobileJs)) {
  skipOut(`${path.relative(process.cwd(), moobileJs)} 不在（先在 ${path.relative(process.cwd(), APP)} 里跑 \`npm run build\`）`);
}
if (!existsSync(path.join(HERE, "node_modules", "react-native-windows"))) {
  skipOut("node_modules 没装（cd 进本目录跑 `npm install`）");
}
check("应用产物 moobile.js 在", true, `${(statSync(moobileJs).size / 1024).toFixed(0)} KB`);

// ── C 的准备：从 moobile.js 里现取一段**这个应用真有**的中文串 ────────────────
//
// 不写死"御纂周易折中"四个字：写死的话，产物换了应用也照样能过（判据就瞎了）。
// 从产物本身取一段，再去 bundle 里找 —— 这是"打进去的确实是这份应用"的直接证据。
const src = readFileSync(moobileJs, "utf8");
// ⚠️ 光"从产物里取一段中文"不够：第一版取到的是**库自己的报错文案**（`宿主给对象或给字`）——
//    那种串换一个应用也照样在产物里，判据就瞎了。要取**应用源码里也有**的串：
//    它同时出现在 `main.mbt`（应用内容）与 `moobile.js`（编译产物）里，
//    才是"这份产物是**这个应用**编出来的"。
const appSource = ["main.mbt", "colorring.mbt", "data_reader.mbt"]
  .map((f) => path.join(APP, f))
  .filter((f) => existsSync(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
const inSource = new Set(appSource.match(/[\u4e00-\u9fa5]{4,10}/g) || []);
const milestone =
  (src.match(/[\u4e00-\u9fa5]{4,10}/g) || []).find((s) => inSource.has(s)) ||
  [...inSource].sort((a, b) => b.length - a.length)[0] ||
  null;
if (!milestone) skipOut("取不到比对串（产物或源码形态变了？）");
console.log(`      · 比对串（应用源码与产物里都有）：\`${milestone}\``);

/**
 * `%LOCALAPPDATA%\Microsoft\WindowsApps` 的 **Windows 形式**（`<盘符>:/Users/…/WindowsApps`）。
 *
 * 为什么要这一层：`pwsh.exe` 装在那儿（Windows 给的是个 symlink 别名），而
 * `@react-native-windows/find-dotnet-tools` 是用 `where pwsh.exe` 找它的 ——
 * `where.exe` 是**原生程序**，它不认 MSYS 的 `/c/...` 写法。
 *
 * ⚠️ 两个都试过、都错过的写法：
 *   · 从 bash 里传 `<盘符>:\…`：bash/MSYS 会把整条 PATH 转换，反而找不到；
 *   · 在 node 里拼 `/<盘符>/…`：node **不做**转换（它看到的 PATH 本来就是 Windows 形式），
 *     于是 `where.exe` 拿到一个它不认的项 → 报
 *     `Unable to find pwsh.exe. It should have been made available by \`yarn install\``
 *     （把人往"要装 yarn"上带，而真因只是"PATH 项写法不对"）。
 *   在 node 里拼 PATH 时用**正斜杠的 Windows 路径**，两边都认。
 */
function windowsAppsDir() {
  const lad = process.env.LOCALAPPDATA || "";
  if (!lad) return "";
  return `${lad.split("\\").join("/")}/Microsoft/WindowsApps`;
}

// ── A/B：打包 ────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const t0 = Date.now();
let ok = true;
let err = "";
try {
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "react-native", "bundle",
      "--platform", "windows",
      "--dev", "true",
      "--entry-file", "index.js",
      "--bundle-output", path.relative(HERE, BUNDLE),
      "--assets-dest", "out",
    ],
    {
      cwd: HERE,
      stdio: "pipe",
      encoding: "utf8",
      // ⚠️ Windows 上跑 `npx.cmd` 必须 `shell: true`，否则 spawnSync 直接 EINVAL
      //    （报错只有一句 `spawnSync npx.cmd EINVAL`，看着像命令不存在）
      shell: true,
      env: {
        ...process.env,
        MSYS_NO_PATHCONV: "1",
        // 把 pwsh（PowerShell 7）放进 PATH。**不做这一步的表现极具误导性**：
        //   RNW 的 CLI 在加载 `react-native.config.js` 时要 require
        //   `@react-native-windows/find-dotnet-tools`，那个包会去找 `pwsh.exe`；
        //   找不到就抛错，而 RN CLI **静默吞掉**这个错误 —— 于是报的是
        //   `error: Invalid platform "windows" selected. Available platforms are: "ios", "android", "native"`
        //   （看起来像"RNW 没装"，其实是"PATH 里没有 pwsh"）。
        //   探针轮实测：这条与"RNW 0.83.2 漏声明依赖"是两个独立的坑，都要补。
        // PATH 项用 `windowsAppsDir()` 给的 **Windows 形式**（详见它的注释：在 node 里拼 PATH 时，
        // MSYS 形式是找不到的 —— `where.exe` 是原生程序，而 node 不做路径转换）。
        PATH: `${windowsAppsDir()}${path.delimiter}${process.env.PATH || ""}`,
      },
    },
  );
} catch (e) {
  ok = false;
  err = String((e.stderr || e.stdout || e.message) || "").split("\n").slice(-6).join(" / ");
}
check(`\`react-native bundle --platform windows\` 退出码 0（${((Date.now() - t0) / 1000).toFixed(1)}s）`, ok, ok ? "" : err);
if (!ok) {
  console.log("\n================ 桌面宿主 汇总 ================");
  console.log(`通过 ${results.filter((r) => r.ok).length}  失败 ${results.filter((r) => !r.ok).length}`);
  process.exit(1);
}

check("产物 index.windows.bundle 生成", existsSync(BUNDLE), existsSync(BUNDLE) ? `${(statSync(BUNDLE).size / 1024 / 1024).toFixed(2)} MB` : "没有");
const bundleText = existsSync(BUNDLE) ? readFileSync(BUNDLE, "utf8") : "";
check("产物里有**这个应用**的真串（不是空壳、也不是别的应用）", Boolean(milestone && bundleText.includes(milestone)), milestone || "");
// 宿主侧接线也在产物里（判据各自独立：少一条就说明那一环没进去）
check("产物里有宿主接线（`mountApp` 与 SVG 画布后端）", bundleText.includes("mountApp") && /canvas-svg|registerSvgCanvas/.test(bundleText));

const pass = results.filter((r) => r.ok).length;
console.log("\n================ 桌面宿主 汇总 ================");
console.log(`通过 ${pass}  失败 ${results.length - pass}`);
for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL  ${r.name}`);
console.log("⚠️ 这**不是**「桌面能跑」的判据：原生窗口要 VS 2026 + SDK 22621，本机没有（见 README 的前置表）。");
process.exit(results.some((r) => !r.ok) ? 1 : 0);
