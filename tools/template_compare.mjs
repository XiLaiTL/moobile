#!/usr/bin/env node
// template_compare.mjs —— T1：**模板生成物与 demo 的同源比对器**。
//
//   node tools/template_compare.mjs            # 全套（约 1 秒）
//   node tools/template_compare.mjs --keep     # 留下临时目录（调试用）
//
// 对应 docs/design/SCAFFOLD.md §3.4 / §6 的 T1：
//
//   `moobile-host init` 生成一个临时项目 → 与 `examples/apps/todo-app/` 比对
//   → **清单之外的任何差异 = 红**（清单 = `tools/template/deltas.txt`）。
//
// ── 为什么这条门必须存在 ────────────────────────────────────────────────────────
//
// 模板是**唯一真源**，demo 是"模板最狠的那个测试用例"（SCAFFOLD §3.4.4）。T1b/T1c/T3
// 验的是"模板自己好不好"；T1 验的是另一件事：**模板与 demo 还是一家人吗**。
// 两者之间的每一处差异都必须是**被理解过并写下来的**，否则"demo 能从模板重新生成"
// 就只是一句印象 —— 而这句话正是 S4 判据的全部内容。
//
// ⚠️ 这条门的**判据清单是手写的**，门只负责"清单之外的一个都不许有"。
//    所以清单本身也会腐烂，见下面"死条目"那一段 —— 门会把它打出来（但不弄红）。
//
// ── 比对的两侧是什么 ───────────────────────────────────────────────────────────
//
//   左：`examples/apps/todo-app/`（**含仓库根那一层**：moon.mod / moon.pkg / *.mbt），
//       其中 `host/<x>` **摊平成 `<x>`** —— 生成物是平铺的，没有 `host/` 这一层
//       （那是 `create-expo-app` 强加的定位，见 SCAFFOLD §3.1）。
//   右：`moobile-host init` 现场生成的一个临时项目（**真实 CLI 子进程**：
//       用户敲的就是这条命令，门要验的是它，不是进程内调个函数）。
//
// 两侧用**同一个读法**，所以 `host/` 的摊平规则在两边同时成立、不会错一边。

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "npm", "moobile-host", "bin", "cli.js");
const DELTAS = path.join(ROOT, "tools", "template", "deltas.txt");
const DEMO = path.join(ROOT, "examples", "apps", "todo-app");
const APP_NAME = "gen-check-app";
const KEEP = process.argv.includes("--keep");

const req = createRequire(import.meta.url);
const templateLib = req(path.join(ROOT, "npm", "moobile-host", "lib", "template.js"));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
  return ok;
}
function section(t) {
  console.log(`\n== ${t} ==`);
}
const hint = (lines) => lines.forEach((l) => console.log("      " + l));

// 这两个是"攒着最后一起报"的账，**先声明**：解析清单失败时会提前 report()，
// 那时它们还没被赋值（第一版写成 const，提前报错就炸在 TDZ 上）。
let contentRules = new Map();
let deadRules = [];

// ── 0) 判据清单 ───────────────────────────────────────────────────────────────
//
// 格式与字段语义见 deltas.txt 顶部（那份文件的头部就是这份代码的规格说明）。
// ⚠️ 这里刻意**不硬编码忽略清单**：它是判据的一部分，住在 deltas.txt 的 `# @ignore`
//    那一行 —— 免得"文档说忽略 A、代码忽略 B"这种漂移。

const IGNORE_ALWAYS = new Set([".git"]); // 两侧都不是"内容"（版本库元数据）
const IGNORE_MARKER = "# @ignore";

function parseDeltas(file) {
  const rules = [];
  const errors = [];
  const ignore = [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

  for (const [i, raw] of lines.entries()) {
    const line = raw.trim();
    if (line.startsWith(IGNORE_MARKER)) {
      ignore.push(...line.slice(IGNORE_MARKER.length).trim().split(/\s+/).filter(Boolean));
      continue;
    }
    if (!line || line.startsWith("#")) continue;

    const parts = line.split("|").map((s) => s.trim());
    if (parts.length < 3) {
      errors.push(`第 ${i + 1} 行不是 \`<类别> | <路径> | <为什么>\`：${line}`);
      continue;
    }
    const [kind, target, why] = parts;
    if (!["file-extra", "file-missing", "content"].includes(kind)) {
      errors.push(`第 ${i + 1} 行的类别 \`${kind}\` 不认识（只有 file-extra / file-missing / content）`);
      continue;
    }
    // `路径:字段 / 字段` —— 字段只在 content 里有意义
    let file = target;
    let fields = [];
    const colon = target.indexOf(":");
    if (colon >= 0) {
      file = target.slice(0, colon).trim();
      fields = target
        .slice(colon + 1)
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (kind !== "content" && fields.length) {
      errors.push(`第 ${i + 1} 行：\`${kind}\` 不该带字段（只有 content 能细化到字段）`);
      continue;
    }
    const top = file.split("/")[0];
    if (IGNORE_ALWAYS.has(top) || ignore.includes(top)) {
      errors.push(`第 ${i + 1} 行登记了被忽略的 \`${file}\` —— 这一条永远不会生效（忽略清单见文件顶部 @ignore）`);
      continue;
    }
    rules.push({ kind, file, fields, why, line: i + 1 });
  }
  if (!ignore.length) {
    errors.push(
      `清单里没有 \`${IGNORE_MARKER} …\` 那一行 —— 忽略清单是判据的一部分（缺了会把 node_modules 之类全部算成差异）`,
    );
  } else if (ignore.includes("host")) {
    errors.push("忽略清单里有 `host` —— 它是要被**摊平**的那一层，不是要忽略的（见文件顶部说明）");
  }
  return { rules, errors, ignore };
}

// ── 0.1) 文本比对的三个规范化（对应 deltas.txt 的"忽略行尾与行尾空白"）──────────

/** 行尾 / 行尾空白 / 文件末尾空行 —— 一律不算差异（编辑器与 git 的自动转换）。 */
function norm(text) {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
}

/**
 * 去掉注释后再比 —— 用来兑现"代码完全相同、只有注释不同"这条判据。
 *
 * 逐字符扫（而不是正则）：`//` 出现在字符串里（URL、`'a//b'`）不该被当成注释头。
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, Math.min(j + 1, src.length));
      i = j + 1;
      continue;
    }
    if (c === "/" && d === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  // 注释行会被掏空成空行 → 顺手把空白与空行一起无视（只关心"还有没有代码"）
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/** `import { … }` 块的字符区间（花括号配平，不用正则硬啃）。找不到就 null。 */
function importBlockRange(src) {
  const m = /^[ \t]*import[ \t]*\{/m.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length - 1; // 停在 '{'
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return [m.index, i + 1];
  }
  return null;
}

/** 去掉 `import { … }` 块。 */
function removeImportBlock(src) {
  const r = importBlockRange(src);
  return r ? src.slice(0, r[0]) + src.slice(r[1]) : src;
}

/** import 块里的包名（`"XiLaiTL/moobile/sqlite" @sqlite` → `XiLaiTL/moobile/sqlite`）。 */
function parseImports(src) {
  const r = importBlockRange(src);
  if (!r) return [];
  return [...src.slice(r[0], r[1]).matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/** 删掉 `键 = …` 那一行（moon.mod 的 name / description 这类）。 */
function removeKeyLine(src, key) {
  return src
    .split("\n")
    .filter((l) => !new RegExp(`^\\s*${key}\\s*=`).test(l))
    .join("\n");
}

/** 取 `键 = "值"` 的值（判"死条目"用：两侧本来就一样 = 这条不是差异）。 */
function keyValue(src, key) {
  const m = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m").exec(src);
  return m ? m[1] : undefined;
}

/** 按键排序的 JSON —— 比"内容是否相同"时不能受键序影响（两侧的键序本来就不一样）。 */
function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stable(value[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

/** JSON 路径（`dependencies.moobile-host`）。⚠️ 键名里带 `.` 会解析错 —— 现在没有这种键。 */
const getPath = (obj, dotted) =>
  dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

function delPath(obj, dotted) {
  const segs = dotted.split(".");
  // ⚠️ 单段路径（`name`）不能走 getPath：`"".split(".")` 得到 `[""]`，会去找 `obj[""]`
  //    然后静默什么都不删 —— 第一版就是这么把 package.json 的 `name` 漏删的。
  const parent = segs.length === 1 ? obj : getPath(obj, segs.slice(0, -1).join("."));
  if (parent && typeof parent === "object") delete parent[segs[segs.length - 1]];
}

/**
 * 删空了的对象按"不存在"算。
 *
 * 为什么必须有：删掉 demo 的 `expo.web.favicon` 之后，demo 那边剩一个 `web: {}`，
 * 而生成物**根本没有 `web` 这个键** —— 不归一化的话，一处已经登记的差异会被算成两处。
 */
function prune(value) {
  if (Array.isArray(value)) return value.map(prune);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) {
      const v = prune(value[k]);
      if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      out[k] = v;
    }
    return out;
  }
  return value;
}

// ── 1) 两侧的文件树 ───────────────────────────────────────────────────────────

/**
 * 读一棵文件树：相对路径 → 文本。忽略清单来自 deltas.txt 的 `@ignore`。
 *
 * @param {string} dir
 * @param {{flatten: Set<string>, ignore: Set<string>}} opts
 */
function readTree(dir, opts) {
  const out = new Map();
  const walk = (d, base) => {
    for (const name of fs.readdirSync(d).sort()) {
      const abs = path.join(d, name);
      if (opts.ignore.has(name) || IGNORE_ALWAYS.has(name)) continue;
      const rel = base ? base + "/" + name : name;
      if (fs.statSync(abs).isDirectory()) {
        // `host/` 摊平：里面的文件用**父目录**的相对路径（生成物没有这一层）
        walk(abs, opts.flatten.has(name) ? base : rel);
        continue;
      }
      if (out.has(rel)) {
        throw new Error(
          `摊平后路径撞车：${rel} —— \`host/\` 里有一个与外面同名的文件，比对会漏掉一个（先改掉这个同名）`,
        );
      }
      out.set(rel, fs.readFileSync(abs, "utf8"));
    }
  };
  walk(dir, "");
  return out;
}

// ── 2) 主流程 ─────────────────────────────────────────────────────────────────

const { rules, errors, ignore } = parseDeltas(DELTAS);
section("判据清单：tools/template/deltas.txt");
check(
  "清单可解析（格式与类别都对得上）",
  errors.length === 0,
  errors.length ? `${errors.length} 处` : `${rules.length} 条`,
);
if (errors.length) {
  for (const e of errors) hint(["! " + e]);
  report();
}
console.log(`      忽略（两侧都不比）：${ignore.join(" ")}`);

const tpl = templateLib.locate();
console.log(`      模板真源：${path.relative(ROOT, tpl.dir)}（${tpl.how}）`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "moobile-template-compare-"));
const app = path.join(tmp, APP_NAME);
if (KEEP) {
  console.log(`      临时目录（--keep）：${tmp}`);
} else {
  process.on("exit", () => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* Windows 上偶尔删不掉（文件被占），不值得让门变红 */
    }
  });
}

section("生成：moobile-host init（真实 CLI，子进程）");
const init = spawnSync(process.execPath, [CLI, "init", app, "--name", APP_NAME], { encoding: "utf8" });
const initOk = check(
  "init 生成成功",
  init.status === 0,
  init.status === 0 ? "" : (init.stdout || "").trim().split("\n")[0] || (init.stderr || "").trim().split("\n")[0],
);
if (!initOk) {
  console.log((init.stdout || "") + (init.stderr || ""));
  report();
}

const opts = { flatten: new Set(["host"]), ignore: new Set(ignore) };
const demoTree = readTree(DEMO, opts);
const genTree = readTree(app, opts);

const onlyDemo = [...demoTree.keys()].filter((k) => !genTree.has(k)).sort();
const onlyGen = [...genTree.keys()].filter((k) => !demoTree.has(k)).sort();
const inBoth = [...demoTree.keys()].filter((k) => genTree.has(k)).sort();
const diffFiles = inBoth.filter((k) => norm(demoTree.get(k)) !== norm(genTree.get(k)));

section("两侧的差异（事实层：这里只报差在哪，判「允许不允许」在下一节）");
console.log(`      demo ${demoTree.size} 个文件 / 生成物 ${genTree.size} 个文件`);
console.log(`      只在 demo 里：${onlyDemo.join(" ") || "（无）"}`);
console.log(`      只在生成物里：${onlyGen.join(" ") || "（无）"}`);
console.log(`      两边都有、内容不同：${diffFiles.join(" ") || "（无）"}`);
console.log(`      两边都有、逐字节相同：${inBoth.filter((k) => !diffFiles.includes(k)).join(" ") || "（无）"}`);

section("判据：清单之外的任何差异 = 红");

const declared = (kind) => new Set(rules.filter((r) => r.kind === kind).map((r) => r.file));

const undeclaredDemo = onlyDemo.filter((f) => !declared("file-extra").has(f));
check(
  "只在 demo 里的文件都已登记（file-extra）",
  undeclaredDemo.length === 0,
  undeclaredDemo.join(" ") || `${onlyDemo.length} 个`,
);
if (undeclaredDemo.length) {
  hint([
    "这些文件在清单里没有 → 要么删掉/对回去，要么在 tools/template/deltas.txt 里登记：",
    "  file-extra | <路径> | <为什么允许它只在 demo 里>",
  ]);
}

const undeclaredGen = onlyGen.filter((f) => !declared("file-missing").has(f));
check(
  "只在生成物里的文件都已登记（file-missing）",
  undeclaredGen.length === 0,
  undeclaredGen.join(" ") || `${onlyGen.length} 个`,
);
if (undeclaredGen.length) {
  hint([
    "这些文件在清单里没有 → 要么删掉/对回去，要么登记：",
    "  file-missing | <路径> | <为什么允许它只在生成物里>",
  ]);
}

contentRules = new Map();
for (const r of rules) {
  if (r.kind !== "content") continue;
  if (!contentRules.has(r.file)) contentRules.set(r.file, []);
  contentRules.get(r.file).push(r);
}
const undeclaredDiff = diffFiles.filter((f) => !contentRules.has(f));
check(
  "内容不同的文件都已登记（content）",
  undeclaredDiff.length === 0,
  undeclaredDiff.join(" ") || `${diffFiles.length} 个`,
);
if (undeclaredDiff.length) {
  hint([
    "这些文件内容不同，而清单里没有 → 先问一句「这是不是漂移」：",
    "  · 是漂移 → 把它改回去（模板是真源，demo 是它的测试用例）；",
    "  · 是真差异 → 登记：content | <路径>:<字段> | <为什么>",
    "⚠️ 登记之前想清楚：SCAFFOLD §3.4.4 说了，**清单越长说明这条路越没走通**。",
  ]);
}

// ── 3) 逐文件：声明的字段够不够解释这处差异 ───────────────────────────────────
//
// 这一层才是这条门的价值所在：光有"这个文件允许不同"等于把漂移藏进清单里。
// 所以对**声明的字段**逐个兑现，并要求**剩下的部分一模一样**。

const stale = [];
for (const f of diffFiles) {
  const fileRules = contentRules.get(f);
  if (!fileRules) continue;

  // ⚠️ 一个文件可以有好几条条目（package.json 有 5 条、app.json 有 3 条）——
  //    所以这里必须把**同一个文件的全部条目**合起来用。第一版按"文件 → 一条"存，
  //    后一条把前一条覆盖掉了，于是红的是"清单漏登"，其实是工具自己漏读。
  const fields = [...new Set(fileRules.flatMap((r) => r.fields))];

  if (fields.length === 0) {
    // 最弱的一档：整份文件各写各的（"为什么"那句话是不是还成立，机器判不了）
    check(`${f} —— 整份文件允许不同（清单未细化到字段）`, true, fileRules.map((r) => r.why).join("；"));
    continue;
  }

  const demoText = norm(demoTree.get(f));
  const genText = norm(genTree.get(f));

  if (f.endsWith(".json")) {
    let a, b;
    try {
      a = JSON.parse(demoText);
      b = JSON.parse(genText);
    } catch (err) {
      check(`${f} —— 两侧都是合法 JSON`, false, err.message);
      continue;
    }
    for (const p of fields) {
      if (stable(getPath(a, p)) === stable(getPath(b, p))) stale.push(`${f}:${p}（两侧本来就一样）`);
      delPath(a, p);
      delPath(b, p);
    }
    const pa = prune(a);
    const pb = prune(b);
    const rest = stable(pa) === stable(pb);
    const diff = rest ? "" : firstJsonDiff(pa, pb) || "（顶层看不出来，在嵌套里）";
    check(
      `${f} —— 差异只落在已声明的字段（${fields.join(" / ")}）`,
      rest,
      rest ? "" : `剩下一处没登记的差异：${diff}`,
    );
    if (!rest) {
      hint([
        "把两侧这些路径都删掉之后，剩下的 JSON 还是不一样 —— 说明有一处差异清单里没有。",
        "要么改回去，要么在 deltas.txt 里补一条 `" + f + ":<路径>`。",
      ]);
    }
    continue;
  }

  // ── 非 JSON：按字段"删掉那一块"，然后要求剩下的部分一模一样 ────────────────
  let a = demoText;
  let b = genText;
  let commentOnly = false;
  for (const field of fields) {
    if (field === "注释") {
      commentOnly = true;
      continue;
    }
    if (field === "import") {
      const ai = parseImports(a);
      const bi = parseImports(b);
      const missing = bi.filter((x) => !ai.includes(x)); // demo = 模板 + 能力：只许多、不许少
      if (!missing.length && ai.length === bi.length) {
        stale.push(`${f}:import（两侧本来就一样）`);
      }
      check(
        `${f}:import —— 生成物的每一条 import 都在 demo 里（demo 只许多、不许少）`,
        missing.length === 0,
        missing.length ? `demo 缺 ${missing.join(" / ")}` : `生成物 ${bi.length} 条 / demo ${ai.length} 条`,
      );
      if (missing.length) {
        hint([
          "生成物里有一条 demo 没有的 import → 模板多了一条能力依赖，而 demo 没跟上。",
          "· 想加能力：模板与 demo 一起加（并补上 npm 依赖与 `regen` 的产物）；",
          "· 只是试试：把模板改回去 —— 模板是唯一真源，demo 是它的测试用例。",
        ]);
      }
      a = removeImportBlock(a);
      b = removeImportBlock(b);
      continue;
    }
    // `键 = 值` 那一行：两侧值一样 = 这不是差异（死条目）
    if (keyValue(a, field) === keyValue(b, field)) {
      stale.push(`${f}:${field}（两侧本来就一样）`);
    }
    a = removeKeyLine(a, field);
    b = removeKeyLine(b, field);
  }

  const ra = commentOnly ? stripComments(a) : a;
  const rb = commentOnly ? stripComments(b) : b;
  const same = ra === rb;
  check(
    `${f} —— ${commentOnly ? "只有注释不同（去掉注释后逐字相同）" : `差异只落在已声明的字段（${fields.join(" / ")}）`}`,
    same,
    same ? "" : `去掉已声明的部分之后仍有差异：${firstLineDiff(ra, rb)}`,
  );
  if (!same) {
    hint([
      "清单说这处差异在（" + fields.join(" / ") + "）里，但把那些部分去掉之后两边还是不一样。",
      "要么把剩下那处改回去，要么在 deltas.txt 里补一条。",
    ]);
  }
}

/** 剩下的差异里，第一处不同长什么样 —— 报错要能直接指到地方。 */
function firstLineDiff(a, b) {
  const la = a.split("\n");
  const lb = b.split("\n");
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) {
      return `第 ${i + 1} 行：demo \`${(la[i] ?? "（没有这行）").slice(0, 60)}\` vs 生成物 \`${(lb[i] ?? "（没有这行）").slice(0, 60)}\``;
    }
  }
  return "（行都一样，差异在别处）";
}

/** 剩下的差异里，第一处不同长什么样 —— 报错要能直接指到地方（能钻多深钻多深）。 */
function firstJsonDiff(a, b, prefix = "") {
  const keysOf = (v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v) : []);
  for (const k of [...new Set([...keysOf(a), ...keysOf(b)])].sort()) {
    const va = a?.[k];
    const vb = b?.[k];
    if (stable(va) === stable(vb)) continue;
    if (keysOf(va).length && keysOf(vb).length) {
      const inner = firstJsonDiff(va, vb, prefix + k + ".");
      if (inner) return inner;
    }
    return `\`${prefix + k}\`：demo ${JSON.stringify(va)?.slice(0, 50)} vs 生成物 ${JSON.stringify(vb)?.slice(0, 50)}`;
  }
  return null;
}

// ── 4) 死条目：清单在腐烂（**不弄红**）────────────────────────────────────────
//
// 一条登记着的差异，如果实际上已经不存在了，它不是"漂移"——它是**清单在骗人**。
// 为什么不让它红：红的意思是"生成物与 demo 有一处清单外的差异"，那是另一回事；
// 把"清单该删一行"也弄红，会让人为了绿而去删清单里的**真**条目（那才是灾难）。
// 所以这里大声打出来，并按条数记账。

deadRules = [];
const seenStale = new Set(stale.map((s) => s.split("（")[0]));
for (const r of rules) {
  const target = r.kind === "content" ? diffFiles.includes(r.file) : null;
  if (r.kind === "file-extra" && !onlyDemo.includes(r.file)) deadRules.push(r);
  else if (r.kind === "file-missing" && !onlyGen.includes(r.file)) deadRules.push(r);
  else if (r.kind === "content" && target === false) deadRules.push(r);
  else if (r.kind === "content" && r.fields.length && r.fields.every((f) => seenStale.has(`${r.file}:${f}`))) {
    deadRules.push(r);
  }
}

section("清单里的死条目（不弄红：它不是漂移，是清单该删一行了）");
if (deadRules.length) {
  for (const r of deadRules) {
    console.log(`      第 ${r.line} 行  ${r.kind} ${r.file}${r.fields.length ? ":" + r.fields.join(" / ") : ""}`);
  }
  console.log("      处置：删掉这些行（或把 why 改成一句备注：已经不是差异了）。");
} else {
  console.log("      （无）");
}

report();

function report() {
  const failed = results.filter((r) => !r.ok);
  const n = (kind) => (rules || []).filter((r) => r.kind === kind).length;
  console.log("");
  console.log("================ T1 同源门汇总 ================");
  console.log(
    `清单 ${(rules || []).length} 条（file-extra ${n("file-extra")} / file-missing ${n("file-missing")} / content ${n("content")}）`,
  );
  console.log(`通过 ${results.length - failed.length}  失败 ${failed.length}  死条目 ${deadRules.length}`);
  for (const f of failed) console.log("  FAIL  " + f.name);
  process.exit(failed.length ? 1 : 0);
}
