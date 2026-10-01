// manifest_probe.mjs —— **生成器（PLAN 的 I2）的可行性量测**：不猜难度，直接量。
//
//   cd examples/apps/antd-spike/host && node manifest_probe.mjs
//
// 它回答三个问题：
//   ① 浅解析 antd 的 `.d.ts`（不起 TypeScript 编译器）能拿到多少 prop 名？
//   ② 那些"命名类型"（`SizeType` / `Variant` …）跳一跳能不能救回来？
//   ③ 继承来的 prop 怎么办 —— 它们到底在哪、在不在场？
//
// 这不是门（gate），是量测：结果给人看，并被 `PLAN.md` §3.8 与设计稿 §5 T7 引用。
// 2026-09 实测结论见文件末尾的"读数"注释。

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ANTD_ES = path.join(ROOT, "node_modules/antd/es");

/** 递归列文件。 */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ── 解析器：花括号配对 + 顶层 `name?: Type` 行 + extends 名单 ────────────────
function parseInterfaces(src) {
  const out = [];
  const re = /(?:export\s+)?interface\s+([A-Za-z_]\w*)(<[^>]*>)?\s*(extends\s+([^{]+))?\{/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const ext = (m[4] || "")
      .split(",")
      .map((s) => s.trim().replace(/<.*$/, "").trim())
      .filter((s) => /^[A-Za-z_]\w*$/.test(s));
    let i = re.lastIndex;
    let depth = 1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    const body = src.slice(re.lastIndex, i - 1);
    const fields = [];
    let d = 0;
    for (const raw of body.split("\n")) {
      const line = raw.trim();
      if (d === 0) {
        const f = line.match(/^(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:\s*(.+?);?$/);
        if (f) fields.push({ name: f[1], type: f[2].replace(/;$/, "").trim() });
      }
      d += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    }
    out.push({ name, ext, fields });
  }
  return out;
}

/** 字段类型 → 我们的通道类别。顺序敏感：先具体后宽泛。 */
const CLASSES = [
  [/^(boolean|true|false)$/, "bool"],
  [/^React\.(Mouse|Focus|Change|Keyboard|Form|Pointer|Touch|Drag|Clipboard|Composition|UI|Wheel|Animation)EventHandler/, "event"],
  [/^(string|number|React\.Key)$/, "scalar"],
  [/^React\.ReactNode$/, "reactnode"],
  [/^React\.CSSProperties$|^CSSProperties$/, "css"],
  [/=>/, "function"],
  [/\|/, "union"],
  [/^\{/, "object"],
  [/\[\]$|^Array</, "array"],
];
const classify = (t) => (CLASSES.find(([re]) => re.test(t)) || [null, "other"])[1];

// ── ① 组件与 props 接口 ─────────────────────────────────────────────────────
const componentDirs = fs
  .readdirSync(ANTD_ES, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
  .filter((d) => fs.existsSync(path.join(ANTD_ES, d.name, "index.d.ts")));

// ⚠️ 别名表要扫**整个 `antd/es/**`**（含 `_util/`）——
// 只扫"组件目录"会漏掉 `ComponentStyleConfig` / `Orientation` / `InputStatus`
// 这类定义在 `_util` 里的类型，于是把"能救回来"的比例**低估**（实测：172 vs 一个更高的真值）。
const aliases = new Set();
for (const f of walk(path.join(ANTD_ES))) {
  if (!f.endsWith(".d.ts")) continue;
  for (const m of fs.readFileSync(f, "utf8").matchAll(/(?:export\s+)?type\s+([A-Za-z_]\w*)\s*=/g)) {
    aliases.add(m[1]);
  }
}
let withProps = 0;
let totalFields = 0;
let withExtends = 0;
const kinds = new Map();
const others = new Map();
const perComponent = [];

for (const d of componentDirs) {
  const dir = path.join(ANTD_ES, d.name);
  let best = null;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".d.ts"))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/(?:export\s+)?type\s+([A-Za-z_]\w*)\s*=/g)) aliases.add(m[1]);
    for (const it of parseInterfaces(src)) {
      if (!it.name.endsWith("Props")) continue;
      if (!best || it.fields.length > best.fields.length) best = it;
    }
  }
  if (!best) continue;
  withProps++;
  totalFields += best.fields.length;
  if (best.ext.length) withExtends++;
  for (const f of best.fields) {
    const k = classify(f.type);
    kinds.set(k, (kinds.get(k) || 0) + 1);
    if (k === "other") {
      const bare = f.type.replace(/<.*$/, "").replace(/^React\./, "React.").trim();
      others.set(bare, (others.get(bare) || 0) + 1);
    }
  }
  perComponent.push({ comp: d.name, fields: best.fields.length, ext: best.ext });
}

console.log(`组件目录（<name>/index.d.ts）：${componentDirs.length}`);
console.log(`有 Props 接口的：${withProps}｜直接字段合计：${totalFields}（平均 ${(totalFields / withProps).toFixed(1)}/组件）`);
console.log(`带 extends 的：${withExtends}/${withProps}  ← 浅解析会漏掉继承来的 prop`);

console.log(`\n直接字段的类型分布（决定生成器要不要"多跳"）：`);
for (const [k, v] of [...kinds].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(9)} ${String(v).padStart(4)}  ${((v / totalFields) * 100).toFixed(0)}%`);
}

// ── ② "other" 桶里有多少能靠 antd 自己的别名表救回来 ────────────────────────
// 本地定义的"可跳一跳"名字：`type X = ...` 与 `interface X` 都算
const localIfaces = new Set();
for (const f of walk(path.join(ANTD_ES))) {
  if (!f.endsWith(".d.ts")) continue;
  for (const m of fs.readFileSync(f, "utf8").matchAll(/(?:export\s+)?interface\s+([A-Za-z_]\w*)/g)) {
    localIfaces.add(m[1]);
  }
}
const localDef = (k) => aliases.has(k) || localIfaces.has(k);
const otherTotal = [...others.values()].reduce((a, b) => a + b, 0);
const resolvable = [...others].filter(([k]) => localDef(k)).reduce((s, [, v]) => s + v, 0);
const utilTypes = new Set(["NonNullable", "Partial", "Required", "Readonly", "Pick", "Omit", "Record", "Exclude", "Extract", "LiteralUnion", "any", "unknown"]);
console.log(`\n"other" 桶最常见的类型名（共 ${otherTotal} 个字段、${others.size} 个不同名字）：`);
for (const [k, v] of [...others].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(v).padStart(3)}  ${k.padEnd(28)} ${aliases.has(k) ? "← antd 自己的 type 别名里有" : ""}`);
}
console.log(
  `  → 一跳可分类：${resolvable}/${otherTotal}` +
    `（antd 本地 ${aliases.size} 个 type 别名 + ${localIfaces.size} 个 interface）`,
);
const utilFields = [...others].filter(([k]) => utilTypes.has(k)).reduce((s, [, v]) => s + v, 0);
console.log(`  → 需拆工具类型（NonNullable / Partial / LiteralUnion / any…）：${utilFields}`);
console.log(`  → 剩下的是跨组件的（如 ButtonProps / Locale）→ 标 unsupported 并在报告里点名`);

// ── ③ 继承来的 prop 在哪：@types/react 在场吗 ───────────────────────────────
console.log(`\n继承来的 prop 的真相源（React 的 HTML 属性面）在场吗：`);
for (const p of ["typescript", "@types/react", "@types/react-dom"]) {
  let v = "**不存在**";
  try {
    v = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", p, "package.json"), "utf8")).version;
  } catch {}
  console.log(`  ${p.padEnd(16)} ${v}`);
}
const reactTypes = path.join(ROOT, "node_modules/@types/react/index.d.ts");
if (fs.existsSync(reactTypes)) {
  const ifaces = parseInterfaces(fs.readFileSync(reactTypes, "utf8"));
  for (const w of ["HTMLAttributes", "ButtonHTMLAttributes", "AnchorHTMLAttributes", "AriaAttributes", "DOMAttributes"]) {
    const it = ifaces.find((x) => x.name === w);
    if (it) {
      const evts = it.fields.filter((f) => /^on[A-Z]/.test(f.name)).length;
      console.log(`  ${w.padEnd(22)} ${String(it.fields.length).padStart(4)} 字段（其中事件 ${evts}）`);
    }
  }
} else {
  console.log(`  ⚠️ 没有 @types/react → 继承链**无法解析**（antd 不依赖它，纯 JS 应用也不会有）`);
}

console.log(`\n字段最多的 6 个组件（生成物的"体积"上限）：`);
for (const p of perComponent.sort((a, b) => b.fields - a.fields).slice(0, 6)) {
  console.log(`  ${p.comp.padEnd(16)} ${String(p.fields).padStart(3)} 字段  extends[${p.ext.join(", ")}]`);
}

// ── 读数（2026-09 实测，antd 6.6.4 + react 19.2.3）──────────────────────────
// 组件 79 个 / 有 Props 接口 73 个 / 直接字段 1260（平均 17.3）/ 带 extends 38 个。
//   类型分布：other 423 · scalar 248 · bool 160 · union 111 · reactnode 109
//            function 108 · css 67 · array 31 · object 3       ← bool+scalar 约 32% 直接落通道
//   other 桶 423 个里 282 个（67%）的名字在 antd 自己的 462 个 type 别名里 → 跳一跳可分类；
//   剩下的多为工具类型（NonNullable / LiteralUnion）、跨组件类型（ColProps / ButtonProps / Locale）、
//   事件类型（React.MouseEventHandler × 16）—— 前者拆包装、后者归 event、跨组件的标 unsupported。
//   typescript / @types/react / @types/react-dom **都不存在** → 继承来的 prop（onClick / href /
//   className / aria-* 这些最常用的）拿不到；必须自备一份"React 公共属性"小表 + 对清单外的名字**放行**。
