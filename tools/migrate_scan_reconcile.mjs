#!/usr/bin/env node
// migrate_scan_reconcile.mjs —— F1「迁移动检」两份实现的**逐项对账门**。
//
//   node tools/migrate_scan_reconcile.mjs                    # 默认扫 ../yi/zhouyi_reader
//   node tools/migrate_scan_reconcile.mjs --root <项目>
//   node tools/migrate_scan_reconcile.mjs --root <项目> --lib <moobile 库根>
//
// 退出码：0 = 逐项一致 · 1 = 两侧有差异（红） · 2 = 环境/用法问题（root 不存在、bash 缺失、
// MoonBit 侧 JSON 解析不了 —— 这类红**不是**"实现不一致"，所以分开报，免得看错真因）。
//
// ── 这条门在防什么 ──────────────────────────────────────────────────────────
//
// F1 现在有**两份**实现：
//   · 真源：`tools/mbtools/src/migrate_scan.mbt`（MoonBit，判据见 PLAN §5.1 / SCAFFOLD §3.7）
//   · 副本：`npm/moobile-host/lib/migrate/scan.js`（使用者机器上没有 MoonBit 工具链，
//           `npx moobile-host` 得能就地动检 —— 所以规则是**照抄**过来的）
//
// **同一个报告两个实现 = 一个必然的漂移点**，而"副本 ≠ 源码"这件事本仓库栽过好几次
// （见 `tools/check_npm_fresh.mjs` 记的那次事故）。所以规矩是 AGENTS.md §2 的「迁移规矩」：
// **新实现必须与旧实现逐行对账**，并做证伪测试。
//
// ── 比对到什么粒度 ──────────────────────────────────────────────────────────
//
// 逐 finding 比 `id` / `auto` / `count` / `why` / `next`，逐 hit 比 `file:line` 与 `text`，
// **顺序也参与比较**（顺序变了，"人看到的清单"就变了，虽然不是数字错，但报告是产物）。
// 外层再比 `root` / `files` / `lines` / `table.mapped` / `table.excluded`。
//
// ⚠️ 比 `why`/`next`/`text` 是**判据要求的超集**（要求只点名 id/auto/count 与逐 hit 的 file:line）。
//    为什么加：这三个字段全是**抄过来**的字符串，抄错一个字人就被引到错的地方去
//    （F1 的价值全在"下一步"准不准，见 migrate_scan.mbt 里 gesture.mouse 那条的补记），
//    而多比这三个字段的成本是零 —— 对账门红了才有意义，绿得越厚越好。
//
// ── 为什么默认拿 `../yi/zhouyi_reader` 当判据 ─────────────────────────────────
//
// F1 的判据（"报告零遗漏"）就是在那个真实项目上立的：6 文件 / 3139 行 / 15 类有命中。
// 拿一个**空目录**或**玩具项目**对账，等于用"两边都数 0"证明两边都对 —— 那是最容易骗过自己的跑法。
// 扫描对象是仓库外的兄弟目录（`interest/yi`），所以它对 `--root` 完全开放：换任何项目都能跑，
// 只是"零遗漏"的判据只在那个项目上人工清点过。

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_JS = path.join(ROOT, "npm", "moobile-host", "lib", "migrate", "scan.js");
const DEFAULT_SCAN_ROOT = path.resolve(ROOT, "..", "yi", "zhouyi_reader");

// 参数解析：`--root <路径>` / `--lib <路径>` / `--show <条数>`，也接受裸的位置参数当 root。
// 为什么自己写：node 的 `util.parseArgs` 与 `process.argv` 都能用，但这里的规则只有三条，
// 而"哪些 token 是值、哪些是位置参数"必须**明确**（漏掉一个 `--lib` 的值，
// 它就会被当成 root 去扫 —— 那种错会表现为"扫描对象不存在"，真因却藏在解析里）。
const argv = process.argv.slice(2);
const opts = { root: null, lib: null, show: 8 };
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === "--root" || a === "--lib" || a === "--show") {
    if (i + 1 >= argv.length) bail(`参数 ${a} 后面缺一个值`);
    if (a === "--root") opts.root = argv[i + 1];
    else if (a === "--lib") opts.lib = argv[i + 1];
    else opts.show = Math.max(1, Number(argv[i + 1]) || 8);
    i += 1;
  } else if (a === "-h" || a === "--help") {
    console.log("用法：node tools/migrate_scan_reconcile.mjs [--root <项目>] [--lib <moobile 库根>] [--show <条数>]");
    process.exit(0);
  } else if (a.startsWith("--")) {
    bail(`不认识的参数 ${a}`);
  } else if (opts.root === null) {
    opts.root = a;
  } else {
    bail(`多余的参数 ${a}`);
  }
}
const SHOW = opts.show;

const IS_WIN = process.platform === "win32";
const MSYS_DRIVE = /^\/([a-zA-Z])\/(.*)$/;

/**
 * 归一成"正斜杠绝对路径"，**两侧喂同一个字符串**。
 *
 * 为什么门里也写一份（而不是只用 JS 版里的那个）：MoonBit 侧必须拿到一个 **shell 能用的**
 * 路径，而 JS 侧拿到的是同一个字符串 —— 只有同一个输入，`root` 字段的差异才是实现差异。
 * ⚠️ Windows 上要先认 git bash 形态的盘符路径（`/` + 一个字母 + `/` + 剩余）：
 * node 会把它当成**当前盘的根相对路径**，整条路径错位一级，而且错得静默
 * （看着像"目录不存在"，其实是我们自己解析错了）。
 */
function absPosix(p) {
  let s = String(p);
  if (IS_WIN) {
    const m = MSYS_DRIVE.exec(s);
    if (m) s = m[1].toUpperCase() + ":/" + m[2];
  }
  return path.resolve(s).split(path.sep).join("/");
}

const scanRoot = absPosix(opts.root || DEFAULT_SCAN_ROOT);
const libRoot = absPosix(opts.lib || ROOT);

// ── 结论账本 ────────────────────────────────────────────────────────────────
const diffs = [];
function diff(what, detail) {
  diffs.push({ what, detail });
}

/** 一行一条的进度/结论打印（与仓库其它门同一套 PASS/FAIL 语汇）。 */
function say(line) {
  console.log(line);
}

function bail(msg, hint) {
  console.error(`对账无法进行：${msg}`);
  if (hint) console.error(`      ${hint}`);
  process.exit(2);
}

// 扫描对象先验存在性：**这一条要在跑两侧之前**做。
// 为什么：`--root` 打错时 MoonBit 侧会以 IOError 收场，而那个红很容易被读成"两侧实现对不上"。
// 真因是"路径错了"，就得按路径错了报。
if (!fs.existsSync(scanRoot)) {
  bail(
    `扫描对象不存在：${scanRoot}`,
    `默认对象是仓库外的真实项目 ../yi/zhouyi_reader（F1 的判据就在它上面立的）；用 --root 换一个。`
  );
}
if (!fs.existsSync(path.join(libRoot, "render.mbt"))) {
  bail(
    `标签表真源不存在：${libRoot}/render.mbt`,
    `--lib 要指向 moobile 库根目录（里面有 render.mbt）。`
  );
}

// ── ① MoonBit 侧 ────────────────────────────────────────────────────────────
//
// `--lib` 显式给：默认值是"调用者的 cwd"（`tools/mb.sh` 传的 `MBTOOLS_CWD`），
// 而那条路要经过 MSYS 的 argv/env 转换 —— 显式给就与转换规则无关，门才不会因环境不同而抖。
function runMoonBit() {
  const res = spawnSync(
    "bash",
    ["tools/mb.sh", "migrate-scan", "--root", scanRoot, "--lib", libRoot, "--json"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }
  );
  if (res.error) {
    bail(
      `跑不起 MoonBit 侧（bash tools/mb.sh）：${res.error.message}`,
      "这条门需要 bash（git bash / MSYS）与 `moon`；没有它们就没法对账 —— 不许把「只跑了一侧」当通过。"
    );
  }
  if (res.status !== 0) {
    bail(
      `MoonBit 侧非零退出（${res.status}）\n${(res.stdout || "").trim()}\n${(res.stderr || "").trim()}`,
      "先单独跑一次 `bash tools/mb.sh migrate-scan --root " + scanRoot + " --json` 看真因。"
    );
  }
  return parseMbJson(res.stdout || "");
}

/**
 * 解析 MoonBit 侧的 JSON。
 *
 * ⚠️ 为什么要留一条"先修传输、再解析"的路：MoonBit 侧的 `json_escape` 只处理
 * `" \ \n \r \t` 五个字符，**其它 C0 控制字符**（`\v` `\f` `\x1b` …）会被原样写进字符串
 * 字面量里，而 JSON 规范不允许那样 → `JSON.parse` 直接拒绝整份报告。
 * 那是**传输**的问题，不是要比的东西，所以这里把"字符串内部的裸控制字符"转义掉再解析，
 * 并且**把这件事打出来**（不许静默）；否则一条含 `\f` 的 CSS 行就能让门报出"实现对不上"的假红。
 */
function parseMbJson(stdout) {
  const a = stdout.indexOf("{");
  const b = stdout.lastIndexOf("}");
  if (a < 0 || b < a) {
    bail(`MoonBit 侧没有输出 JSON：\n${stdout.slice(0, 400)}`);
  }
  const body = stdout.slice(a, b + 1);
  try {
    return { json: JSON.parse(body), repaired: false };
  } catch (err) {
    let out = "";
    let inStr = false;
    let esc = false;
    for (const ch of body) {
      if (esc) {
        out += ch;
        esc = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        esc = true;
        continue;
      }
      if (ch === '"') inStr = !inStr;
      if (inStr && ch.codePointAt(0) < 0x20) {
        out += "\\u" + ch.codePointAt(0).toString(16).padStart(4, "0");
        continue;
      }
      out += ch;
    }
    try {
      return { json: JSON.parse(out), repaired: true };
    } catch (err2) {
      bail(
        `MoonBit 侧的 JSON 解析不了（原样：${err.message}；转义控制字符后：${err2.message}）`,
        "别放宽断言：先看它到底吐了什么（把 stdout 存下来看）。"
      );
    }
  }
}

// ── ② JS 侧 ─────────────────────────────────────────────────────────────────
//
// 直接 require 宿主包里的那个文件 —— **就是使用者会跑的那一份**，不是"照它的逻辑重写一遍"。
const req = createRequire(import.meta.url);
const jsLib = req(SCAN_JS);
const jsJson = jsLib.scanProject({ root: scanRoot, lib: libRoot, top: 10 });

const mbJson = runMoonBit();

// ── ③ 逐项对账 ──────────────────────────────────────────────────────────────
say(`# F1 两份实现逐项对账`);
say("");
say(`- 扫描对象：\`${scanRoot}\``);
say(`- 标签表真源：\`${libRoot}/render.mbt\``);
say(`- 左：MoonBit（\`bash tools/mb.sh migrate-scan --json\`） · 右：JS（\`npm/moobile-host/lib/migrate/scan.js\`）`);
if (mbJson.repaired) {
  say(`- ⚠️ MoonBit 侧 JSON 里有**裸控制字符**（它的 json_escape 只转义 5 个字符）：本门就地转义后再解析`);
}
say("");

const mb = mbJson.json;

// 两侧真的都在扫这棵树吗 —— 先证"输入可比"，再谈"结果一致"。
if (!mb.findings || !Array.isArray(mb.findings)) bail("MoonBit 侧 JSON 里没有 findings 数组");
if (mb.table && (mb.table.mapped === 0 || mb.table.excluded === 0)) {
  bail(
    `标签表解析出 0 条（mapped=${mb.table.mapped} / excluded=${mb.table.excluded}）`,
    "`render.mbt` 的写法变了或 `--lib` 指错了 —— 此时标签分类整体失效，对账毫无意义（MoonBit 版自己也会这么警告）。"
  );
}

// 外层标量
for (const key of ["root", "files", "lines"]) {
  if (mb[key] !== jsJson[key]) diff(key, `MB=${JSON.stringify(mb[key])}  JS=${JSON.stringify(jsJson[key])}`);
}
for (const key of ["mapped", "excluded"]) {
  const a = mb.table ? mb.table[key] : undefined;
  if (a !== jsJson.table[key]) diff(`table.${key}`, `MB=${a}  JS=${jsJson.table[key]}`);
}

const mbF = mb.findings || [];
const jsF = jsJson.findings || [];
if (mbF.length !== jsF.length) {
  diff("findings 条数", `MB=${mbF.length}  JS=${jsF.length}（MB: ${mbF.map((f) => f.id)} / JS: ${jsF.map((f) => f.id)}）`);
}

const shown = { n: 0 };
function showDetail(what, detail) {
  diff(what, detail);
  if (shown.n < SHOW) {
    console.log(`  ✗ ${what}`);
    for (const line of String(detail).split("\n")) console.log(`      ${line}`);
    shown.n += 1;
  }
}

// 逐类表格
const hits = (f) => f.hits.map((h) => `${h.file}:${h.line}`);
const texts = (f) => f.hits.map((h) => h.text);
const total = { mb: 0, js: 0, nonzero: 0 };

say("| # | id | auto | count(MB) | count(JS) | hits | 判定 |");
say("|---|---|---|---|---|---|---|");
const n = Math.max(mbF.length, jsF.length);
for (let i = 0; i < n; i++) {
  const a = mbF[i];
  const b = jsF[i];
  if (!a || !b) {
    say(`| ${i + 1} | \`${a ? a.id : b.id}\` | — | ${a ? a.count : "—"} | ${b ? b.count : "—"} | — | **只有一侧有这一类** |`);
    continue;
  }
  // 顺序敏感的比较：id / auto / count / why / next + 逐 hit 的 file:line/text
  const bad = [];
  for (const key of ["id", "auto", "count", "why", "next"]) {
    if (a[key] !== b[key]) bad.push(key);
  }
  const ha = hits(a);
  const hb = hits(b);
  const ta = texts(a);
  const tb = texts(b);
  const hitsSame = ha.length === hb.length && ha.every((v, k) => v === hb[k]);
  const textSame = ta.length === tb.length && ta.every((v, k) => v === tb[k]);
  if (!hitsSame) bad.push("hits(file:line)");
  if (!textSame) bad.push("hits(text)");

  total.mb += a.count;
  total.js += b.count;
  if (a.count > 0 && a.count === b.count) total.nonzero += 1;

  say(
    `| ${i + 1} | \`${a.id}\` | ${a.auto} | ${a.count} | ${b.count} | ${a.count === b.count ? a.count : `${a.count} vs ${b.count}`} | ${
      bad.length === 0 ? "一致" : "**不一致**"
    } |`
  );

  if (bad.length > 0) {
    const detail = [];
    for (const key of bad) {
      if (key === "hits(file:line)" || key === "hits(text)") {
        const which = key === "hits(file:line)" ? ha : ta;
        const other = key === "hits(file:line)" ? hb : tb;
        const at = [];
        for (let k = 0; k < Math.max(which.length, other.length) && at.length < 4; k++) {
          if (which[k] !== other[k]) at.push(`#${k + 1}: MB=${JSON.stringify(which[k])}  JS=${JSON.stringify(other[k])}`);
        }
        detail.push(`${key} 起先不同（MB ${which.length} 条 / JS ${other.length} 条）：\n  ` + at.join("\n  "));
      } else {
        detail.push(`${key}: MB=${JSON.stringify(a[key])}\n  JS=${JSON.stringify(b[key])}`);
      }
    }
    showDetail(`finding[${i}] \`${a.id}\`：${bad.join(", ")}`, detail.join("\n"));
  }
}
say("");

// ── ④ 结论 ──────────────────────────────────────────────────────────────────
const classes = mbF.length;
if (diffs.length === 0) {
  say(
    `对账通过：${classes} 类（其中 ${total.nonzero} 类有命中）/ ${total.mb} 条命中，两侧逐项一致` +
      `（逐条比了 id/auto/count/why/next 与每条 hit 的 file:line/text）`
  );
  if (total.mb === 0) {
    // "两边都数 0"是最容易骗过自己的绿色：除非这个项目真的干净，否则就是两边一起瞎了。
    say(`⚠️ 但这次命中共 0 条 —— 请确认 \`--root\` 指的真是那个项目（空目录上"两侧一致"说明不了任何事）`);
  }
  process.exit(0);
}

console.error(`对账不通过：${diffs.length} 处差异`);
if (shown.n >= SHOW && diffs.length > shown.n) {
  console.error(`      （只打了前 ${SHOW} 处明细，剩下的用 --show ${diffs.length} 看全）`);
}
console.error("");
console.error("两侧现在是**两份不同的报告** —— F1 的判据是「报告零遗漏」，");
console.error("所以要么把 JS 版改回与真源一致，要么**同时**改两边（MoonBit 版是真源，先改它）。");
process.exit(1);
