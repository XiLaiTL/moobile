#!/usr/bin/env node
// host_probe.mjs —— **宿主矩阵**的离线门：`--host expo | rnw | webview`。
//
//   node tools/host_probe.mjs
//
// ## 这条门在守什么
//
// SCAFFOLD §3.3 的承诺是：**支持一个新平台 = 换一个宿主，不是改库**。
// 落到生成器上，那句话的可执行形式就是：
//
//   `init --host <任意宿主>` 生成出来的工程，
//   **应用侧（`moon.mod` / `moon.pkg` / `app.mbt`）逐字节相同**，
//   差别只在**宿主文件**（package.json / App.js / index.js / 入口 / 构建配置…）。
//
// 这条断言比"文件生成了"强得多：它正是"换宿主"这个说法**唯一的硬判据**。
//
// ⚠️ 文件名曾经叫 `desktop_host_probe.mjs`（那时只有 expo / rnw 两个宿主）。
//    加进第三个宿主（`webview`：零 Expo、零 Metro 的静态站点）之后它守的是**整张矩阵**，
//    名字跟着改 —— 留着旧名会让"这条门守什么"变成猜的。
//
// ## 为什么它不需要装依赖、也不需要浏览器
//
// 它只跑生成器 + 读文件 + `node --check`。真正"能不能跑起来"那两条由两个示例守：
//   · `examples/apps/zhouyi-reader-desktop/verify.mjs`（RNW：`react-native bundle --platform windows`）
//   · `examples/apps/zhouyi-reader-webview/verify.mjs`（静态宿主：esbuild 打成 dist/ → 起静态服务
//     → **把应用自己那 45 条界面判据原样指向它**）
// 分工：**这里守"生成物对不对"，那两条守"换宿主之后界面一样不一样"。**

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "npm", "moobile-host", "bin", "cli.js");
const NAME = "probe-app";

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}

function run(args) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8", stdio: "pipe" });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String((e.stdout || "") + (e.stderr || "") || e.message) };
  }
}
const read = (dir, rel) => readFileSync(path.join(dir, rel), "utf8");

/**
 * 只留**代码行**（去掉 `//` 之后的部分，含 `///` 文档注释）。
 *
 * ⚠️ 为什么必须有它：这几份宿主文件的注释里**正大光明地写着**"不 import expo""别引
 *    react-native-svg"这类话 —— 拿全文 grep，判据会被**自己的注释**满足/触发。
 *    本仓库在这上面栽过三次（rnw 的 `index.js`、`app-audit` 扫 `todo-app`、以及这里），
 *    所以规矩是：**判据只看代码行**。
 */
const code = (text) =>
  text
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i === -1 ? l : l.slice(0, i);
    })
    .join('\n');

const tmp = mkdtempSync(path.join(os.tmpdir(), "moobile-host-probe-"));
const expoDir = path.join(tmp, "expo-app");
const rnwDir = path.join(tmp, "rnw-app");
const wvDir = path.join(tmp, "webview-app");

try {
  // ── 1) 三个宿主各生成一遍（同一个应用名，才可比）────────────────────────────
  const a = run(["init", expoDir, "--name", NAME]);
  const b = run(["init", rnwDir, "--name", NAME, "--host", "rnw"]);
  const c = run(["init", wvDir, "--name", NAME, "--host", "webview"]);
  check("`init --host expo` 成功", a.ok, a.ok ? "" : a.out.trim().split("\n")[0]);
  check("`init --host rnw` 成功", b.ok, b.ok ? "" : b.out.trim().split("\n")[0]);
  check("`init --host webview` 成功", c.ok, c.ok ? "" : c.out.trim().split("\n")[0]);
  if (!a.ok || !b.ok || !c.ok) throw new Error("生成失败，后面的断言没有意义");

  // ── 2) ★ 应用侧逐字节相同（这就是"换宿主、不改应用"）────────────────────────
  for (const rel of ["moon.mod", "moon.pkg", "app.mbt"]) {
    const texts = [expoDir, rnwDir, wvDir].map((d) => (existsSync(path.join(d, rel)) ? read(d, rel) : null));
    const same = texts.every((x) => x !== null) && texts.every((x) => x === texts[0]);
    check(
      `应用侧 \`${rel}\` 三个宿主下**逐字节相同**`,
      same,
      same ? "" : `内容不同：[${texts.map((x) => (x === null ? "缺" : x.length + " 字节")).join(", ")}]（那就不叫「换宿主」了）`,
    );
  }

  // ── 3) 宿主侧确实换了（各自该有的有、不该有的没有）──────────────────────────
  const expoPkg = JSON.parse(read(expoDir, "package.json"));
  const rnwPkg = JSON.parse(read(rnwDir, "package.json"));
  check(
    "expo 档：package.json 里有 `expo`、没有 `react-native-windows`",
    Boolean(expoPkg.dependencies.expo) && !("react-native-windows" in expoPkg.dependencies),
    Object.keys(expoPkg.dependencies).join(","),
  );
  check(
    "rnw 档：package.json 里有 `react-native-windows`、没有 `expo`",
    Boolean(rnwPkg.dependencies["react-native-windows"]) && !("expo" in rnwPkg.dependencies),
    Object.keys(rnwPkg.dependencies).join(","),
  );
  // RNW 0.83.2 的 CLI 漏声明这个依赖（0.84 才修）；缺了它 `init-windows` 报"未知命令"
  check(
    "rnw 档：`@react-native-windows/find-dotnet-tools` 落在 **dependencies**（不是 dev）",
    Boolean(rnwPkg.dependencies["@react-native-windows/find-dotnet-tools"]) &&
      !(rnwPkg.devDependencies || {})["@react-native-windows/find-dotnet-tools"],
    rnwPkg.dependencies["@react-native-windows/find-dotnet-tools"] || "（没有）",
  );
  check(
    "rnw 档：RN 版本与 RNW 配套（0.83.x / 0.83.2）",
    /^0\.83\./.test(rnwPkg.dependencies["react-native"] || "") &&
      rnwPkg.dependencies["react-native-windows"] === "0.83.2",
    `${rnwPkg.dependencies["react-native"]} + ${rnwPkg.dependencies["react-native-windows"]}`,
  );

  // ── 4) 入口/配置的形状：裸 RN 与 Expo 不能混（混了就是"看起来能跑"）─────────
  // ⚠️ 判据要看**代码**，不能 grep 全文：这两份文件的注释里明明白白写着"不用 Expo"，
  //    第一版用 `/expo/` 一测就把注释也算成违规 → 两条假红（判据自己骗自己）。
  //    只认 import/require 那一行。
  const rnwIndex = read(rnwDir, "index.js");
  check(
    "rnw 档：入口用 `AppRegistry`（裸 RN），且**不 import expo**",
    /AppRegistry\.registerComponent/.test(rnwIndex) && !/from\s+['"]expo['"]/.test(rnwIndex),
  );
  const rnwMetro = read(rnwDir, "metro.config.js");
  check(
    "rnw 档：metro 配置 require `@react-native/metro-config`，且**不 require `expo/metro-config`**",
    /require\(['"]@react-native\/metro-config['"]\)/.test(rnwMetro) &&
      !/require\(['"]expo\/metro-config['"]\)/.test(rnwMetro),
  );
  check(
    "rnw 档：App.js 注册 **SVG 画布后端**（Windows 上 Skia 没有后端、也没有 DOM canvas）",
    /registerSvgCanvas/.test(read(rnwDir, "App.js")) && /platforms:\s*\[\s*'windows'\s*\]/.test(read(rnwDir, "App.js")),
  );
  check("rnw 档：`babel.config.js` 在（裸 RN 要它）", existsSync(path.join(rnwDir, "babel.config.js")));
  // ⚠️ 宿主文件集里那份真源叫 `gitignore`（无点）：`npm pack` 永远不打 `.gitignore`。
  //    生成器要把它写成 `.gitignore` —— 否则**从装好的包生成**出来的项目没有忽略规则
  //    （`moobile.js` 与 `_build/` 会被提交进用户的仓库），而这件事只有打包形态才看得出来。
  check(
    "rnw 档：生成了 `.gitignore`（真源叫 `gitignore`，写盘时映射过来）",
    existsSync(path.join(rnwDir, ".gitignore")) && !existsSync(path.join(rnwDir, "gitignore")),
  );
  check(
    "rnw 档：忽略规则里有 `windows/` 与 `moobile.js`（桌面特有的两样）",
    /windows\//.test(read(rnwDir, ".gitignore")) && /moobile\.js/.test(read(rnwDir, ".gitignore")),
  );
  check("expo 档：没有 `babel.config.js`（Expo 那份被 metro 接管）", !existsSync(path.join(expoDir, "babel.config.js")));

  // ── 4b) webview 档：**零 Expo、零 Metro** 的静态站点 ────────────────────────
  //
  // 这三条是这个宿主的**定义**（不是风格偏好）：它存在的理由就是"打成静态站点、
  // 不需要 dev server"。判据因此盯三处：依赖表 / 入口 / 构建脚本。
  const wvPkg = JSON.parse(read(wvDir, "package.json"));
  const wvDeps = Object.keys(wvPkg.dependencies || {});
  // ⚠️ 判据按**确切包名**，不能用前缀正则：`/^react-native/` 会把 `react-native-web` 也命中
  //    （而它正是这个宿主要用的那个）—— 第一版就是这么假红的。
  const FORBIDDEN_DEPS = ["expo", "react-native", "react-native-windows", "metro"];
  const offending = wvDeps.filter(
    (d) => FORBIDDEN_DEPS.includes(d) || d.startsWith("@react-native/") || d.startsWith("@expo/"),
  );
  check(
    "webview 档：依赖表里**没有** expo / react-native / react-native-windows / metro",
    offending.length === 0,
    offending.length ? offending.join(",") : wvDeps.join(","),
  );
  check(
    "webview 档：依赖表里有 `react-native-web`（它顶 `react-native`）与 `esbuild`（打包器）",
    wvDeps.includes("react-native-web") && wvDeps.includes("esbuild"),
    wvDeps.join(","),
  );
  const wvIndex = code(read(wvDir, "index.js"));
  check(
    "webview 档：入口用 RN 的 `AppRegistry`，且**不 import expo**",
    /AppRegistry\.registerComponent/.test(wvIndex) && !/from\s+['"]expo['"]/.test(wvIndex),
    /from\s+['"]expo['"]/.test(wvIndex) ? "代码行里出现了 `from 'expo'`" : "",
  );
  // ⚠️ 这一行就是"换宿主"的**配置面**：Metro / Expo 在 web 平台干的也是这件事，只是藏在预设里。
  check(
    "webview 档：打包脚本里有那一行 `alias`（`react-native` → `react-native-web`）",
    /alias:\s*\{\s*['"]react-native['"]\s*:\s*['"]react-native-web['"]\s*\}/.test(read(wvDir, "build-web.mjs")),
  );
  check(
    "webview 档：静态外壳在（`index.html` 有 `#root` 与 `bundle.js`）",
    /id="root"/.test(read(wvDir, "index.html")) && /bundle\.js/.test(read(wvDir, "index.html")),
  );
  const wvApp = code(read(wvDir, "App.js"));
  check(
    "webview 档：只注册 **DOM 2D** 那条画布后端（不给静态宿主引 react-native-svg）",
    /registerWebCanvas\(\)/.test(wvApp) && !/react-native-svg/.test(wvApp),
    /react-native-svg/.test(wvApp) ? "代码行里出现了 react-native-svg" : "",
  );
  // ⚠️ 模板本身就是 Expo 宿主 —— 宿主文件集只**覆盖**同名文件、删不掉模板里的。
  //    所以宿主要显式声明 `drop`（`lib/hosts.js`）。不 drop 的话生成物里会留着
  //    `app.json` / `metro.config.js`，用户会以为还得装 Expo（实测踩到）。
  check(
    "webview 档：**没有** Expo 专属的 `app.json` / `metro.config.js`（`drop` 生效了）",
    !existsSync(path.join(wvDir, "app.json")) && !existsSync(path.join(wvDir, "metro.config.js")),
    [existsSync(path.join(wvDir, "app.json")) ? "app.json 还在" : "", existsSync(path.join(wvDir, "metro.config.js")) ? "metro.config.js 还在" : ""].filter(Boolean).join(" / "),
  );
  check(
    "expo / rnw 档**仍然有** `app.json`（drop 只作用在声明了它的宿主上）",
    existsSync(path.join(expoDir, "app.json")) && existsSync(path.join(rnwDir, "app.json")),
  );
  check(
    "webview 档：`.gitignore` 里有 `/dist/` 与 `moobile.js`（静态产物 + 编译产物都不该入库）",
    /\/dist\//.test(read(wvDir, ".gitignore")) && /moobile\.js/.test(read(wvDir, ".gitignore")),
  );
  check(
    "webview 档：静态服务挡路径穿越（`resolve` 之后必须仍在 `dist/` 里）",
    /startsWith\(dist\)/.test(read(wvDir, "serve-web.mjs")),
  );
  // ⚠️ 这条是"给人看的"但那也是产物：`init` 的收尾提示必须**跟着宿主走**，
  //    否则 webview 用户会照着一句 `npm run web` 去敲 —— 而那个脚本在这个宿主里根本不存在。
  check(
    "webview 档：`init` 的收尾提示是静态宿主那两句（`npm run build` / `npm run serve`）",
    /npm run serve/.test(c.out) && !/npm run web/.test(c.out),
    c.out.trim().split('\n').filter((l) => /npm run/.test(l)).join(' ; '),
  );

  // app.json 的形状随宿主不同
  const rnwApp = JSON.parse(read(rnwDir, "app.json"));
  check(
    "rnw 档：app.json 是裸 RN 形状（`{name, displayName}`，且 name 无连字符）",
    rnwApp.name === "probeapp" && rnwApp.displayName === NAME && !("expo" in rnwApp),
    JSON.stringify(rnwApp),
  );

  // ── 5) 替换干净 + 生成的 JS 语法合法 ────────────────────────────────────────
  const leftovers = [];
  for (const dir of [expoDir, rnwDir, wvDir]) {
    for (const rel of ["package.json", "app.json", "index.js", "App.js", "metro.config.js", "README.md", "moon.mod", "moon.pkg"]) {
      if (!existsSync(path.join(dir, rel))) continue;
      const t = read(dir, rel);
      for (const bad of ["moobile-template", "moobiletemplate", "{{"]) {
        if (t.includes(bad)) leftovers.push(`${path.basename(dir)}/${rel}: ${bad}`);
      }
    }
  }
  check("生成物里没有模板身份的残留", leftovers.length === 0, leftovers.slice(0, 4).join(" ;; "));
  let syntaxBad = [];
  for (const dir of [rnwDir, wvDir]) {
    for (const rel of ["index.js", "App.js", "metro.config.js", "babel.config.js", "registry.generated.js", "build-web.mjs", "serve-web.mjs"]) {
      if (!existsSync(path.join(dir, rel))) continue;
      try {
        execFileSync(process.execPath, ["--check", path.join(dir, rel)], { stdio: "pipe" });
      } catch (e) {
        syntaxBad.push(rel);
      }
    }
  }
  check("rnw / webview 档生成的 JS 全部通过 `node --check`", syntaxBad.length === 0, syntaxBad.join(","));

  // ── 6) 证伪：不认识的宿主必须**当场红**，而不是静默给 expo ──────────────────
  const bogus = run(["init", path.join(tmp, "bogus"), "--name", NAME, "--host", "desktop"]);
  check(
    "`--host desktop`（不认识的别名）**非零退出**并列出可选值",
    !bogus.ok && /不认识的 --host/.test(bogus.out) && /rnw/.test(bogus.out) && /webview/.test(bogus.out),
    bogus.ok ? "居然成功了 —— 那就是把拼写错误变成了静默降级" : "",
  );
} catch (e) {
  check("探针自身没炸", false, String(e.message).split("\n")[0]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const pass = results.filter((r) => r.ok).length;
console.log("\n================ 桌面宿主（生成器）汇总 ================");
console.log(`通过 ${pass}  失败 ${results.length - pass}`);
for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL  ${r.name}`);
console.log("⚠️ 这条门只验**生成物**。「换宿主之后界面一样不一样」由两条示例守：");
console.log("   · examples/apps/zhouyi-reader-desktop/verify.mjs （RNW：把界面打进桌面宿主）");
console.log("   · examples/apps/zhouyi-reader-webview/verify.mjs（静态宿主：esbuild → 静态服务 → 应用那 45 条判据）");
process.exit(results.some((r) => !r.ok) ? 1 : 0);
