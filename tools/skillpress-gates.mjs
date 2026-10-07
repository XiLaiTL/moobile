#!/usr/bin/env node
/**
 * skillpress-gates.mjs —— **内容仓自己的三道门**（程序仓 `PLAN.md` 的 **D18** / 需求 **R5** 的落地）。
 *
 * ## 一、这三道门为什么住在内容仓
 *
 * 判据只有一句话：**门读谁的东西，就跟谁走**。这三道门读的全是**本仓（moobile）的源码与文档**
 * —— 换一个仓库、换一份内容，它们连"参照物"都没有，住在程序里就是"程序替某一份内容保管判据"。
 *
 * | 门 | 它读的是谁的什么 | 旧实现住在哪 |
 * |---|---|---|
 * | **G5** 跳转 API 名 | 本仓 `*.mbt` / `*.mbti` 里的 `fn`/`struct`/`enum`/`type`/`trait`/`let`/`const` 名，以及 `pub using` 转发名 | `skillpress/lib/check.mjs` 的 `buildMbtIndex` |
 * | **G6** 文档节号 | 本仓 `docs/` 下的 md（` `x.md` §N ` 的 §N 必须真的存在） | `skillpress/lib/check.mjs` 的 `headingIds` / `resolveDoc` / `checkSectionRefs` |
 * | **facts** 事实来源 | 本仓 `docs/`（当前态那 20 份 + `examples/apps/<app>/README.md`）、`npm/moobile-host/` 下的 `README.md` 与 `*.js` 文件头注释、`tools/patches`、`tools/vendor.lock`、`moon.mod` | `skillpress/lib/docfacts.mjs`（567 行） |
 *
 * 一句话：**"这个仓库里到底有没有这个东西"只能由这个仓库回答**。程序仓是只读的参照物。
 *
 * ## 二、怎么跑
 *
 * ```bash
 * cd <内容仓>                      # 例如 D:/ai_project/interest/moobile
 * node tools/skillpress-gates.mjs                      # 三道门一起跑（默认）
 * node tools/skillpress-gates.mjs --gate g5            # 只跑 G5（看它自己的退出码）
 * node tools/skillpress-gates.mjs --gate g6
 * node tools/skillpress-gates.mjs --gate facts
 * node tools/skillpress-gates.mjs --selftest           # 证伪：造夹具，三道门**都必须红**；再跑一个正例，必须绿
 * node tools/skillpress-gates.mjs --emit-fixture /tmp/fix   # 把证伪夹具落到指定目录（供人工/对旧实现跑）
 * node tools/skillpress-gates.mjs --emit-fixture /tmp/fix --good        # 正例夹具（三道门都该零发现）
 * node tools/skillpress-gates.mjs --emit-fixture /tmp/fix --fixture-ledger  # 夹具自带台账（唯一一处刻意不同）
 * ```
 *
 * 参数：`--repo <内容仓根>`｜`--skills <内容根>`｜`--program <程序根>`｜`--strict`（facts 的软项也算不合格）。
 * 环境变量：`SKILLPRESS_GATES_REPO` / `SKILLPRESS_GATES_SKILLS` / `SKILLPRESS_PROGRAM`。
 *
 * 退出码：**0** 全绿 ｜ **1** 有不合格项 ｜ **2** 用法或环境错（找不到内容仓等）。
 * 三道的口径（与原实现一致）：G5/G6 有任一失败即 1；facts **只在"硬"**（可计算的真相对不上 / 台账说谎 /
 * 互相矛盾）时为 1，只有"软"（值得看一眼的警告）时为 0 —— 这与旧 `docfacts` 完全一致；
 * 想让软项也判红，加 `--strict`（**附加档，不改默认判据**）。
 *
 * ## 三、与旧实现的口径关系（逐字节一致，不是"差不多"）
 *
 * 本文件里的判定逻辑是**从 `skillpress/lib/check.mjs` 与 `skillpress/lib/docfacts.mjs` 逐字照搬**的
 * （正则、阈值、字符串模板、遍历顺序、连 `readdirSync` **不排序**这一点都照搬）——
 * 照搬是刻意的：任何"顺手重构"都会让两边的读数分叉，而分叉之后没人知道该信哪一份。
 *
 *   · **G5 / G6 的诊断行**：与旧 `check` 输出里那几行**逐字节相同**（`    ✗ G5 …` / `    ✗ G6 …` / `    · G6 提示：…`），
 *     顺序也相同（skill 按 `readdirSync` 序 → 文件按 `SKILL.md`、`references/*.md`（排序）、`FAQ.md` 序 →
 *     每个文件内"提示在前、失败在后"）。
 *   · **facts 的整份 stdout**：与旧 `facts` **逐字节相同**（连标题 `docfacts —— 根：…` 都照抄 ——
 *     改这个标题就等于改口径）。
 *   · 证明方式（**同一条口径**切两边，逐字节 diff）：
 *
 *     ```bash
 *     FIX=$(mktemp -d); FIXW=$(cygpath -m "$FIX")
 *     node tools/skillpress-gates.mjs --emit-fixture "$FIX"          # 造坏夹具（--good 造正例那份）
 *     # 旧实现（真相）、新实现，喂同一份夹具
 *     MOOBILE_ROOT=$FIXW node ../skillpress/bin/skillpress.mjs check --skills "$FIXW/skills" > old-check.txt
 *     node tools/skillpress-gates.mjs --gate check --repo "$FIXW"                            > new-check.txt
 *     node ../skillpress/bin/skillpress.mjs facts --root "$FIXW"                             > old-facts.txt
 *     node tools/skillpress-gates.mjs --gate facts --repo "$FIXW"                            > new-facts.txt
 *     # 同一条 grep 切 G5/G6 那几行（含"归属 + 顺序"的归一化版），再逐字节 diff
 *     grep -E '^    (· G6|✗ G5 |✗ G6 )' old-check.txt > a; grep -E '^    (· G6|✗ G5 |✗ G6 )' new-check.txt > b
 *     diff a b; diff old-facts.txt new-facts.txt
 *     ```
 *
 *   ⚠️ **唯一一处刻意的不同**：`facts` 的台账查找顺序（见 §四.2）。当**内容根自己也有一份
 *   `done-claims.txt`** 时，新工具读**本地**那份、旧实现永远读程序仓那份 ⇒ 这一种夹具上两边**故意**
 *   不一致（本地那份赢是 D18 的方向）。真仓库（moobile）没有这一份 ⇒ 逐字节一致，已实测。
 *
 * ## 四、**残留的程序仓耦合**（只有两处，都写在这里，别当没看见）
 *
 * R5 的目标是"门跟着内容走"，但旧判据里有两处**指向程序仓**。照搬意味着这两处也得照搬，
 * 否则口径立刻分叉（分叉的形态是最坏的一种：**旧的报、新的不报**，而新工具看起来一切正常）。
 *
 * 1. **G6 的第二解析根**。内容里 `skills/skillpress/SKILL.md` 有 3 处引用**程序**的 `SPEC.md` §2/§3
 *    —— 那是"讲这套工具自己"的指针，相对程序根。旧 `resolveDoc` 按 `[moobile, 程序根]` 两个根找；
 *    本工具照搬，程序根默认取**兄弟目录** `../skillpress`（可用 `--program` 改）。
 *    ⚠️ 找不到程序根时那 3 处会**静默不查**（与旧实现在"根不存在"时的行为一致）——
 *    这不是 bug 而是口径，但**别让它悄悄发生**：G6 的头部会打印实际用的文档根。
 * 2. **facts 的《已落地能力台账》`done-claims.txt`**（D6 / D6-self 用）。它今天**只有程序仓有**
 *    （`skillpress/done-claims.txt`，8 条）。查找顺序：**`<内容仓>/done-claims.txt` → `<程序根>/done-claims.txt`**。
 *    今天 moobile 没有这一份 ⇒ 读到的是程序仓那份 ⇒ 与旧 `facts` 逐字节同。
 *    这是**唯一**一处刻意的扩展：它的方向就是 D18 ——台账的证据文件（`vendor/...`、`docs/evidence/...`）
 *    全是相对**本仓**的路径，它本来就该住内容仓。哪天真搬进 `moobile/done-claims.txt`，这份副本胜出。
 *
 * 除了这两处，本工具**不 import 程序仓的任何代码**，也不依赖它存在（`--selftest` 完全自足）。
 *
 * ## 五、诚实边界
 *
 *   · 这是**照搬**，不是重写：判据（正则、阈值、措辞）与旧实现一字不差。**改判据要两边一起改**，
 *     只改一边 = 两套真相互相矛盾。
 *   · 本工具**只管这三道门**：旧 `check` 的 G1–G4/G7/G8 不在这里（它们查的是 skill 的体量/格式/禁语/指纹，
 *     与"本仓的源码与文档"无关）。所以本工具**不打印**旧 `check` 的 skill 汇总行（`✓ name …`）——
 *     那一行的 ✓/✗ 由全部八道门共同决定，只有三道门的工具**印不出**它；这正是 G5/G6 用切片 diff 对账的原因。
 */
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

// ─────────────────────────────────────────────────────────── 0. 根

/** 本文件在 `<内容仓>/tools/` ⇒ 内容仓根 = 往上一层。**它自己不猜**，除非用 --repo 覆盖。 */
const HERE = resolve(fileURLToPath(import.meta.url), "..");
const DEFAULT_REPO = process.env.SKILLPRESS_GATES_REPO || resolve(HERE, "..");

/**
 * 默认**程序根**：本工具所在仓的兄弟目录 `../skillpress`（用途见文件头 §四.1 / §四.2）。
 * 认它是"程序仓"的凭据：`lib/check.mjs` 在（那是 G5/G6 的旧实现）。找不到就返回 null —— **不猜**。
 *
 * ⚠️ 它是**相对本工具的位置**算的，与 `--repo`（要查哪份内容）**无关** —— 照旧实现，
 * `PROGRAM` 是个常量。若跟着 `--repo` 走，把 `--repo` 指向夹具时程序根会**悄悄消失**，
 * 于是"程序根本该报的那几条"静默不漏（这正是最坏的一种错：新的不报、旧的报）。
 */
function defaultProgram() {
  if (process.env.SKILLPRESS_PROGRAM) return resolve(process.env.SKILLPRESS_PROGRAM);
  const sib = resolve(HERE, "..", "..", "skillpress");
  if (existsSync(join(sib, "lib", "check.mjs"))) return sib;
  return null;
}

// ─────────────────────────────────────────────────────────── 1. G5 索引（照搬 check.mjs buildMbtIndex）

/** SPEC §1 里"跳转 API"的八个包名（`@html.x` / `@style.x` / …）。顺序照抄旧实现（正则里的分支顺序）。 */
const APIS = ["html", "style", "cmd", "sub", "canvas", "gesture", "sqlite", "http"];

/** 旧实现里这个正则是**每个 token 现建一次**的；这里建一次，语义完全相同。 */
const G5_RE = new RegExp(`^@(${APIS.join("|")})\\.([^\\s(（[\\],，;；)）]+)`);

/** moobile 源码里的 `fn <名字>` 与转发包名字清单 —— G5 用。只读一次。（照搬 check.mjs） */
function buildMbtIndex(root) {
  const names = new Set();
  const skip = new Set(["_build", "node_modules", ".mooncakes", ".git", "target"]);
  let files = 0;
  const walk = (dir, depth) => {
    if (depth > 12) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        walk(p, depth + 1);
        continue;
      }
      if (!e.name.endsWith(".mbt") && !e.name.endsWith(".mbti")) continue;
      files++;
      let text;
      try {
        text = readFileSync(p, "utf8");
      } catch {
        continue;
      }
      for (const m of text.matchAll(/\b(?:fn|struct|enum|type|trait|let|const)\s+([A-Za-z_][A-Za-z0-9_]*)/g)) names.add(m[1]);
      for (const m of text.matchAll(/pub\s+using\s+@[A-Za-z0-9_/.@-]+\s*\{([^}]*)\}/g)) {
        for (const raw of m[1].split(",")) {
          const n = raw.trim().replace(/^type\s+/, "").split(/[\s(]/)[0];
          if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) names.add(n);
        }
      }
    }
  };
  walk(root, 0);
  return { names, files };
}

// ─────────────────────────────────────────────────────────── 2. G5 / G6（照搬 check.mjs）

/** 与 DSH 注册表**同款**的解析语义（照搬 check.mjs）：本工具只需要它算出的 `body`。 */
const REQUIRED_FIELDS = ["name", "description", "whenToUse"];
function parseFrontmatter(text) {
  const firstLineEnd = text.indexOf("\n");
  const fenced = firstLineEnd >= 0 && text.slice(0, firstLineEnd).replace(/\r$/, "") === "---";
  if (!fenced) return { data: null, body: text };
  const end = text.indexOf("\n---", firstLineEnd + 1);
  if (end === -1) return { data: null, body: text };
  const all = {};
  for (const rawLine of text.slice(firstLineEnd + 1, end).split("\n")) {
    const line = rawLine.trim();
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    all[m[1]] = v;
  }
  const data = {};
  for (const k of REQUIRED_FIELDS) if (all[k] !== undefined) data[k] = all[k];
  data.__all = all;
  return { data, body: text.slice(end + 4) };
}

/** 反引号里的短片段（行内代码）。check.mjs 与 docfacts.mjs 里各有一份，**两份实现一字不差**。 */
function inlineCodes(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

const CJK_NUM = "一二三四五六七八九十";

/** 标题 → 它的"节号"。支持 `## 2. 契约` / `### 3.7.4 xxx` / `## 二、想改这个库`。（照搬 check.mjs headingIds） */
function headingIds(text) {
  const ids = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(/^#{1,6}\s+(.*)$/);
    if (!m) continue;
    const body = m[1].trim();
    const arabic = body.match(/^([0-9]+(?:\.[0-9]+)*)(?=[\s.、:：)）]|$)/);
    if (arabic) ids.add(arabic[1]);
    const cjk = body.match(new RegExp(`^([${CJK_NUM}]+)[、.]`));
    if (cjk) ids.add(cjk[1]);
  }
  return ids;
}

/** 解析 skill 里的文档引用目标：按 `ctx.docRoots` 依次找（旧实现是 `[moobile, 程序根]`）。 */
function resolveDoc(ctx, tok) {
  for (const root of ctx.docRoots) {
    const p = join(root, tok);
    if (existsSync(p)) return p;
  }
  return null;
}

/** G6：`file.md` §N 的**节号必须真的存在**。（照搬 check.mjs checkSectionRefs） */
function checkSectionRefs(ctx, body, fails, notes) {
  const cache = new Map();
  const idsFor = (abs) => {
    if (!cache.has(abs)) cache.set(abs, headingIds(readFileSync(abs, "utf8")));
    return cache.get(abs);
  };
  body.split("\n").forEach((line, i) => {
    const fileTokens = [...line.matchAll(/`([^`\n]+\.(?:md|mbt\.md))`/g)].map((m) => ({
      tok: m[1],
      at: m.index,
      end: m.index + m[0].length, // 到**收尾反引号之后**为止 —— 距离要从这里算
    }));
    if (!fileTokens.length) return;
    for (const m of line.matchAll(/§\s*([0-9]+(?:\.[0-9]+)*|[一二三四五六七八九十]+)/g)) {
      // 最近的、且在它前面的文件引用（12 字符内）
      const owner = [...fileTokens].reverse().find((f) => f.end <= m.index && m.index - f.end < 12);
      if (!owner) continue;
      const abs = resolveDoc(ctx, owner.tok);
      if (!abs) continue; // 路径不存在由 G3 负责，这里不重复报
      const ids = idsFor(abs);
      const want = m[1];
      if (!ids.size) {
        notes.push(`G6 提示：\`${owner.tok}\` §${want} —— 该文件没有可识别的编号标题，无法对账`);
        continue;
      }
      if (!ids.has(want)) {
        const sample = [...ids].slice(0, 8).join(" / ");
        fails.push(`G6 节号不存在：\`${owner.tok}\` §${want}（正文 L${i + 1}；该文件只有 ${sample} …）`);
      }
    }
  });
}

/**
 * 一个文件的 G5 + G6 结果（= 旧 `judge()` 里那两段的**逐字搬运**）。
 *
 * ⚠️ 两个数组的**推入顺序**照旧：`notes` 只收 G6 提示（旧实现里它前面还有 G1/G3 的提示，
 * 但那些不属于这三道门），`fails` 是 **G5 在前、G6 在后**（旧实现里 G5 在内联代码那个循环里，
 * G6 在 `checkSectionRefs` 里，后者更晚）。旧 `run()` 是**先印 notes 再印 fails** —— 这里也一样。
 */
function judgeG56(ctx, text) {
  const fails = [];
  const notes = [];
  const { body } = parseFrontmatter(text);
  for (const tok of inlineCodes(body)) {
    const m = tok.match(G5_RE);
    if (!m) continue;
    const api = m[2].split("::")[0]; // `@style.Style::new()` —— 名字部分是 Style
    if (api && !ctx.index.names.has(api)) fails.push(`G5 源码里没有这个 API：${tok}`);
  }
  checkSectionRefs(ctx, body, fails, notes);
  return { notes, fails };
}

/** 一个 skill 的文本文件（SPEC §3 的固定结构）。（照搬 check.mjs skillFiles；`rel` 相对内容根） */
function skillFiles(skills, d) {
  const base = join(skills, d);
  const out = [];
  if (existsSync(join(base, "SKILL.md"))) out.push({ rel: `${d}/SKILL.md`, kind: "skill" });
  const refs = join(base, "references");
  if (existsSync(refs)) {
    for (const f of readdirSync(refs).filter((f) => f.endsWith(".md")).sort()) {
      out.push({ rel: `${d}/references/${f}`, kind: "aux" });
    }
  }
  if (existsSync(join(base, "FAQ.md"))) out.push({ rel: `${d}/FAQ.md`, kind: "aux" });
  return out;
}

/** ⚠️ **刻意不排序** —— 旧实现就是 `readdirSync` 的原序，排序会让两边的行序分叉。 */
function skillDirs(skills) {
  if (!existsSync(skills)) return [];
  return readdirSync(skills).filter((d) => statSync(join(skills, d)).isDirectory());
}

/**
 * 三道门里的 G5 / G6：**按旧实现的顺序**产出条目。
 * 每条 = {skill, kind: "note"|"fail", text}；`text` 与旧输出的字形一字不差，
 * 印出来就是 `    · <text>` / `    ✗ <text>`。
 */
function g56Find(ctx) {
  const out = [];
  for (const d of skillDirs(ctx.skills)) {
    for (const f of skillFiles(ctx.skills, d)) {
      const r = judgeG56(ctx, readFileSync(join(ctx.skills, f.rel), "utf8"));
      for (const n of r.notes) out.push({ skill: d, kind: "note", text: n });
      for (const x of r.fails) out.push({ skill: d, kind: "fail", text: x });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────── 3. facts（照搬 docfacts.mjs 全文判据）

/**
 * **当前态文档**：这些文件描述"现在是什么样"，里面的数字必须是当下的真相。
 * 其余的一律当**记录**（历史日志允许留旧数字，这正是它们存在的意义）。
 * （照搬 docfacts.mjs —— 这份清单是判据的一部分，不是可调参数）
 */
const CURRENT_DOCS = [
  "README.md",
  "AGENTS.md",
  "DEV.md",
  "CONTRIBUTING.md",
  "FORK.md",
  "THIRD-PARTY-NOTICE.md",
  "docs/README.md",
  "docs/ARCHITECTURE.md",
  "docs/HANDOVER.md",
  "docs/STATUS.md",
  "docs/PERF.md",
  "docs/PERF-RECIPES.md",
  "docs/design/LAYERS.md",
  "docs/design/DESIGN.md",
  "docs/design/DESIGN-COMPONENT-LIBRARY.md",
  "docs/design/DESIGN-FEASIBILITY.md",
  "docs/design/DESIGN-README.md",
  "docs/design/DESKTOP-RNW.md",
  "docs/design/SCAFFOLD.md",
  "npm/moobile-host/README.md",
];

/** 记录类文件（扫描范围外）。 */
const RECORD_DOCS = ["CHANGELOG.md", "docs/FINDINGS.md", "PLAN.md"];

/** 代码注释里的"当前态"断言：`npm/moobile-host/*.js` —— 只对它们跑 D6。 */
function claimFiles(root) {
  const dir = join(root, "npm", "moobile-host");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => `npm/moobile-host/${f}`);
}

function currentDocs(root) {
  const docs = CURRENT_DOCS.filter((d) => existsSync(join(root, d)));
  const appsDir = join(root, "examples", "apps");
  if (existsSync(appsDir)) {
    for (const app of readdirSync(appsDir).sort()) {
      const rel = `examples/apps/${app}/README.md`;
      if (existsSync(join(root, rel))) docs.push(rel);
    }
  }
  return docs;
}

const TOP_DIRS = new Set([
  "tools", "docs", "examples", "npm", "vendor", "canvas", "style", "html", "cmd", "sub", "http", "sqlite", "gesture",
  ".github", ".scratch", ".mooncakes",
]);

/** **搬家前的一级目录**：它们曾经在仓库根，现在不在。（照搬 docfacts.mjs STALE_ROOTS） */
const STALE_ROOTS = new Set(["internal", "dom", "svg", "server"]);

/** 裸文件名（无 `/`）在**全仓库任何位置**找得到就算存在。 */
function buildBasenameIndex(root) {
  const names = new Set();
  const skip = new Set(["_build", "node_modules", ".git", ".mooncakes", ".scratch", "target"]);
  const walk = (dir, depth) => {
    if (depth > 12) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      if (e.isDirectory()) walk(join(dir, e.name), depth + 1);
      else names.add(e.name);
    }
  };
  walk(root, 0);
  return names;
}

function truthPatchCount(root) {
  const dir = join(root, "tools", "patches");
  if (!existsSync(dir)) return null;
  return readdirSync(dir).filter((f) => f.endsWith(".patch")).length;
}

/** 库版本：真相在 `moon.mod` 的 `version = "x.y.z"`。 */
function truthLibVersion(root) {
  const f = join(root, "moon.mod");
  if (!existsSync(f)) return null;
  const m = readFileSync(f, "utf8").match(/^\s*version\s*=\s*"(\d+\.\d+\.\d+)"/m);
  return m ? m[1] : null;
}

/** 宿主包版本：真相在 `npm/moobile-host/package.json`。 */
function truthHostVersion(root) {
  const f = join(root, "npm", "moobile-host", "package.json");
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, "utf8")).version || null;
  } catch {
    return null;
  }
}

function truthVendorVersion(root) {
  const f = join(root, "tools", "vendor.lock");
  if (!existsSync(f)) return null;
  const m = readFileSync(f, "utf8").match(/RABBITA_VERSION=(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

function fileExists(ctx, tok) {
  if (existsSync(join(ctx.root, tok))) return true;
  if (tok.includes("/")) return false;
  return ctx.basenames.has(tok);
}

function isHardPath(tok) {
  return tok.includes("/");
}

/**
 * D6 的台账：《已落地能力台账》。
 *
 * ⚠️ **与旧实现唯一不同的一处**（见文件头 §四.2）：查找顺序是
 * `<内容仓>/done-claims.txt` → `<程序根>/done-claims.txt`。今天 moobile 没有第一份 ⇒ 读程序仓那份 ⇒ 逐字节同。
 */
function ledgerFile(repo, program) {
  const cands = [join(repo, "done-claims.txt")];
  if (program) cands.push(join(program, "done-claims.txt"));
  for (const f of cands) if (existsSync(f)) return f;
  return null;
}

/** 台账每行 `关键词1+关键词2 | 证据文件 | 说明`；证据文件不存在 ⇒ 台账自己说谎（D6-self）。 */
function loadDoneClaims(file) {
  if (!file || !existsSync(file)) return [];
  const out = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [kws, evidence, note] = t.split("|").map((s) => (s || "").trim());
    if (!kws || !evidence) continue;
    out.push({ kws: kws.split("+").map((s) => s.trim()).filter(Boolean), evidence, note: note || "" });
  }
  return out;
}

/** "缺席说法"的措辞。 */
const ABSENCE = /未做|未实现|未提供|还没有|尚未|暂时用不了|不透明|没上过|未上过|没验|未验|未量|没量/;

/** **历史语境豁免**：明确在讲"过去"的句子，说"当时没做"是对的。 */
const HISTORICAL = /当时|那时|起初|当初|原先|此前|曾经|历史上|那一轮|本轮之前/;

/** 每个检查 = 一个"真相解析器" + 一组"文档里的说法"模式。 */
const ASSERTIONS = [
  {
    id: "D1",
    about: "patch 系列的长度",
    truth: truthPatchCount,
    unit: "个",
    patterns: [
      /(\d+)\s*个\s*patch/g,
      /patches\/\*\.patch[^\n|]{0,24}?\*\*(\d+)\s*个\*\*/g,
    ],
  },
  {
    id: "D2",
    about: "vendor 的基准版本（rabitta 注册表制品）",
    truth: truthVendorVersion,
    unit: "",
    patterns: [/rabbita@(\d+\.\d+\.\d+)/g, /RABBITA_VERSION=(\d+\.\d+\.\d+)/g],
  },
  {
    id: "D7",
    about: "README 里抄的库版本",
    truth: truthLibVersion,
    unit: "",
    only: /^README\.md$/,
    patterns: [/XiLaiTL\/moobile@(\d+\.\d+\.\d+)/g],
  },
  {
    id: "D8",
    about: "宿主包 README 里抄的宿主包版本",
    truth: truthHostVersion,
    unit: "",
    only: /^npm\/moobile-host\/README\.md$/,
    patterns: [/moobile-host@(\d+\.\d+\.\d+)/g],
  },
];

/** 算不出真相、但**多处互相矛盾**就一定是 bug 的事实。 */
const CONTRADICTIONS = [
  { id: "D5", about: "真机判据项数", pattern: /真机\s*(\d+)\s*项/g, scope: /verify_android\.py/ },
  { id: "D5", about: "离线判据项数", pattern: /离线\s*(\d+)\s*项/g, scope: /verify_all\.sh/ },
];

const PLACEHOLDER = /[<>{}$*?|\\\s]|^@|^https?:|^\.\.?\//;

function isPathToken(tok) {
  if (PLACEHOLDER.test(tok) || tok.includes("…") || tok.startsWith("-") || tok.includes("@")) return false;
  if (tok.includes("/")) {
    const first = tok.split("/")[0];
    return TOP_DIRS.has(first) || STALE_ROOTS.has(first);
  }
  if (tok.startsWith(".")) return false;
  return /\.(md|mbt|mbti|js|mjs|cjs|json|jsonc|sh|py|ps1|toml|yml|yaml|txt)$/i.test(tok) && !/[\u4e00-\u9fff]/.test(tok);
}

/** 扫描一份当前态文档（豁免机制：行内 `docfacts:ignore` / 区间 `docfacts:off`…`docfacts:on`）。 */
function scanDoc(ctx, rel) {
  const abs = join(ctx.root, rel);
  if (!existsSync(abs)) return [];
  const findings = [];
  const lines = readFileSync(abs, "utf8").split("\n");
  let off = false;

  lines.forEach((line, i) => {
    if (/docfacts:off/.test(line)) off = true;
    if (/docfacts:on/.test(line)) {
      off = false;
      return;
    }
    if (off || /docfacts:ignore/.test(line)) return;

    for (const tok of inlineCodes(line)) {
      if (!isPathToken(tok)) continue;
      const tok2 = tok.replace(/[，。；、)）]+$/, "").replace(/:\d+(?:[-/]\d+)*$/, "");
      if (!tok2 || fileExists(ctx, tok2)) continue;
      findings.push({
        id: "D3",
        severity: isHardPath(tok2) ? "hard" : "soft",
        file: rel,
        line: i + 1,
        msg: STALE_ROOTS.has(tok2.split("/")[0])
          ? `引用了**搬家前的旧一级目录**：\`${tok2}\`（该目录在仓库根已不存在；见 docfacts 的 STALE_ROOTS 注释）`
          : `${isHardPath(tok2) ? "引用的路径不存在" : "这个文件名在仓库里一处都找不到"}：\`${tok2}\``,
      });
    }

    if (ABSENCE.test(line) && !HISTORICAL.test(line)) {
      for (const c of ctx.doneClaims) {
        if (!c.kws.every((k) => line.includes(k))) continue;
        findings.push({
          id: "D6",
          severity: "soft",
          file: rel,
          line: i + 1,
          msg: `说"未做/没验"，但台账记它**已落地**（${c.note}）；证据：\`${c.evidence}\``,
        });
      }
    }

    for (const a of ASSERTIONS) {
      if (a.only && !a.only.test(rel)) continue;
      const t = a.truth(ctx.root);
      if (t === null) continue;
      for (const p of a.patterns) {
        for (const m of line.matchAll(p)) {
          if (m[1] === String(t)) continue;
          findings.push({
            id: a.id,
            severity: "hard",
            file: rel,
            line: i + 1,
            msg: `${a.about}：文档写 \`${m[1]}${a.unit}\`，代码里是 \`${t}${a.unit}\`（真相可计算）`,
          });
        }
      }
    }
  });
  return findings;
}

/** **只跑 D6** 的扫描器（给"代码注释"这类文件用）。 */
function scanAbsenceClaims(ctx, rel) {
  const abs = join(ctx.root, rel);
  if (!existsSync(abs)) return [];
  const findings = [];
  readFileSync(abs, "utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!ABSENCE.test(line) || HISTORICAL.test(line)) return;
      for (const c of ctx.doneClaims) {
        if (!c.kws.every((k) => line.includes(k))) continue;
        findings.push({
          id: "D6",
          severity: "soft",
          file: rel,
          line: i + 1,
          msg: `说"未做/没验"，但台账记它**已落地**（${c.note}）；证据：\`${c.evidence}\``,
        });
      }
    });
  return findings;
}

/** 跨文件的"同一事实给出不同数字"—— 不判断谁对，只点名矛盾。 */
function scanContradictions(root, docs) {
  const findings = [];
  for (const c of CONTRADICTIONS) {
    const hits = new Map();
    for (const rel of docs) {
      const abs = join(root, rel);
      if (!existsSync(abs)) continue;
      readFileSync(abs, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (c.scope && !c.scope.test(line)) return;
          for (const m of line.matchAll(c.pattern)) {
            if (!hits.has(m[1])) hits.set(m[1], []);
            hits.get(m[1]).push(`${rel}:${i + 1}`);
          }
        });
    }
    if (hits.size > 1) {
      const detail = [...hits.entries()].map(([v, where]) => `${v} 项 ← ${where.join("、")}`).join("；");
      findings.push({ id: c.id, severity: "hard", file: "(多处)", line: 0, msg: `${c.about}互相矛盾：${detail}` });
    }
  }
  return findings;
}

/** 结构化的 facts 判据（照搬 docfacts.mjs check）。 */
function factsCheck(root, mo, doneClaims) {
  const ctx = { root, mo, basenames: buildBasenameIndex(root), doneClaims };
  const docs = currentDocs(root);
  const claims = claimFiles(root);
  const findings = [
    ...docs.flatMap((d) => scanDoc(ctx, d)),
    ...claims.flatMap((f) => scanAbsenceClaims(ctx, f)),
    ...scanContradictions(root, docs),
  ];
  // D6-self：台账引用的证据文件必须存在 —— 台账自己说谎比文档漂移更严重
  for (const c of doneClaims) {
    if (!existsSync(join(mo, c.evidence))) {
      findings.push({
        id: "D6-self",
        severity: "hard",
        file: "done-claims.txt",
        line: 0,
        msg: `台账引用的证据不存在：\`${c.evidence}\`（关键词 ${c.kws.join("+")}）`,
      });
    }
  }
  return { docs, claims, findings };
}

/**
 * facts 的报告（照搬 docfacts.mjs report）。
 *
 * ⚠️ **标题 `docfacts —— 根：…` 是故意一字不差的**：facts 的整份 stdout 要能直接和旧实现 diff。
 * `--strict` 只影响**退出码与最后那句**（附加档，默认口径不变）。
 */
function factsReport(root, doneClaims, strict) {
  const { docs, claims, findings } = factsCheck(root, root, doneClaims);
  console.log(`docfacts —— 根：${root}`);
  console.log(
    `扫描 ${docs.length} 份**当前态**文档 + ${claims.length} 份**代码注释**（只查 D6）（记录类不扫：${RECORD_DOCS.join("、")}）`,
  );
  console.log(
    `真相：patch=${truthPatchCount(root)} ｜ RABBITA_VERSION=${truthVendorVersion(root)} ｜ ` +
      `库版本=${truthLibVersion(root)} ｜ 宿主包版本=${truthHostVersion(root)}`,
  );
  const hard = findings.filter((f) => f.severity === "hard");
  const soft = findings.filter((f) => f.severity !== "hard");

  const dump = (list, title) => {
    if (!list.length) return;
    console.log(`\n──────── ${title}（${list.length} 处）`);
    const byId = new Map();
    for (const f of list) byId.set(f.id, [...(byId.get(f.id) || []), f]);
    for (const [id, l] of byId) {
      console.log(`\n── ${id}（${l.length} 处）`);
      for (const f of l) console.log(`   ${f.file}${f.line ? ":" + f.line : ""}  ${f.msg}`);
    }
  };
  dump(hard, "硬：可计算的真相对不上");
  dump(soft, "软：仓库里一处都找不到的文件名（警告，不判红）");

  if (!hard.length && !soft.length) {
    console.log("\n✓ 没有发现漂移");
    return 0;
  }
  console.log(
    `\n硬 ${hard.length} 处 ／ 软 ${soft.length} 处` +
      (hard.length
        ? " —— 红了：**先改文档的家，别只改一处**（改完重跑）"
        : strict && soft.length
          ? " —— 红了（--strict：软也算不合格）"
          : " —— 没红，但值得看一眼"),
  );
  return hard.length || (strict && soft.length) ? 1 : 0;
}

// ─────────────────────────────────────────────────────────── 4. 夹具（证伪用；只写临时目录）

/**
 * 造一份**坏的内容仓**（也可造好的那份）—— 用来证伪三道门。
 *
 * 它**不写进仓库**：调用方给目录（`--selftest` 给 `mkdtemp`，`--emit-fixture` 给用户指定的路径）。
 * 夹具刻意做成"真实用法的样子"（有 frontmatter、有 references/、有 docs/、有 tools/patches/），
 * 否则诱饵不成立。
 */
function buildFixture(dir, opts = {}) {
  const { good = false, ledger = false } = opts;
  const mk = (rel, content) => {
    const p = join(dir, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content);
  };

  // 真相的来源（facts 的 D1/D2/D7 都从这里算）
  mk("moon.mod", 'name = "XiLaiTL/moobile"\nversion = "0.5.0"\n');
  mk("tools/vendor.lock", "RABBITA_VERSION=0.16.3\n");
  for (const n of ["001-a", "002-b", "003-c"]) mk(`tools/patches/${n}.patch`, "");
  mk("tools/verify_all.sh", "");
  mk("tools/verify_android.py", "");
  // G5 的名字来源：`fn on_raw` ⇒ 索引里有 on_raw（正例要用它）
  mk("vendor/rabbita/html/payload.mbt", "pub fn on_raw(self : Attrs, f : (Payload) -> Unit) -> Unit {\n  ignore(self)\n}\n");
  mk("npm/moobile-host/host.js", "// 夹具宿主（代码注释只跑 D6）\n");
  mk("docs/NOHEAD.md", "# 没有编号标题\n\n正文。\n");
  mk("docs/evidence/zhouyi-compass-cjk-after.png", "");

  if (ledger) {
    // 夹具自带的台账：D6 的证据文件相对**这个夹具根**（真实台账也是相对 moobile 根）
    mk(
      "done-claims.txt",
      "# 夹具台账（--fixture-ledger 写的）\n" +
        "字形+真机 | docs/evidence/zhouyi-compass-cjk-after.png | 夹具：画布字形已在真机量到\n",
    );
  }

  if (good) {
    // 正例：一个合格的 skill + 不撒谎的文档 —— 三道门必须**零发现**（证明没有误杀）
    mk("README.md", "# 夹具\n\n版本是 XiLaiTL/moobile@0.5.0。\nrabbita@0.16.3。\n");
    mk("FORK.md", "# 夹具\n\n共 3 个 patch。\n");
    mk("docs/STATUS.md", "# 夹具状态\n\n## 1. 现状\n\n- 画布文字字形已在真机量到（有像素证据）。\n\n## 2. 分数\n\n- `tools/verify_all.sh` —— 离线 34 项。\n");
    mk("DEV.md", "# 夹具\n\n`tools/verify_android.py` —— 真机 21 项。\n");
    mk(
      "skills/demo-skill/SKILL.md",
      "---\nname: demo-skill\ndescription: 夹具\nwhenToUse: 证伪的正例\n---\n\n" +
        "# 夹具 skill（正例）\n\n用 `@html.on_raw` —— 源码里真的有。\n\n见 `docs/STATUS.md` §1 与 §2。\n",
    );
    mk(
      "skills/demo-skill/references/extra.md",
      "---\nname: extra\ndescription: 夹具\nwhenToUse: 证伪的正例\n---\n\n" +
        "# 夹具 references（正例）\n\n也见 `docs/STATUS.md` §2。\n",
    );
    mk("skills/demo-skill/FAQ.md", "# 夹具 FAQ\n\n见 `docs/NOHEAD.md`。\n");
    // 正例要能被**旧实现**也判绿 ⇒ 台账（那份在程序仓里、7 条）引用的证据文件全都得在
    mk("docs/design/DESKTOP-RNW.md", "# 桌面宿主\n");
    mk("docs/FINDINGS.md", "# 记录类（不扫）\n");
    mk("examples/apps/zhouyi-reader/device_check.mjs", "// 证据文件（夹具）\n");
    return;
  }

  // ── 坏的那份：三道门各自的诱饵 ──
  mk("README.md", "# 夹具\n\n版本是 XiLaiTL/moobile@0.5.0。\nrabbita@9.9.9。\n"); // D2 诱饵（真相 0.16.3）
  mk("FORK.md", "# 夹具\n\n共 7 个 patch。\n"); // D1 诱饵（真相 3）
  mk(
    "docs/STATUS.md",
    "# 夹具状态\n\n## 1. 现状\n\n- 字形在真机上还没验过。\n\n## 2. 分数\n\n- `tools/verify_all.sh` —— 离线 34 项。\n",
  ); // D6 诱饵（台账说已落地）
  mk("DEV.md", "# 夹具\n\n`tools/verify_android.py` —— 真机 21 项。\n");
  mk(
    "skills/demo-skill/SKILL.md",
    "---\nname: demo-skill\ndescription: 夹具\nwhenToUse: 证伪\n---\n\n" +
      "# 夹具 skill（诱饵）\n\n" +
      "用 `@html.on_raw` 是真的；用 `@html.没这个函数` 是假的。\n\n" + // G5 诱饵（on_raw 是真的 —— 正对照）
      "见 `docs/STATUS.md` §99 —— 越界的节号。\n\n" + // G6 诱饵
      "见 `docs/NOHEAD.md` §1 —— 目标文件没有编号标题（提示，不判红）。\n\n" + // G6 提示
      "见 `SPEC.md` §99 —— 那份在**程序根**里（第二解析根）。\n", // G6 诱饵（走程序根）
  );
  mk(
    "skills/demo-skill/references/extra.md",
    "---\nname: extra\ndescription: 夹具\nwhenToUse: 证伪\n---\n\n" +
      "# 夹具 references（诱饵）\n\n" +
      "见 `docs/STATUS.md` §99 —— 又一条（排在主文档之后，验顺序）。\n\n" +
      "用 `@style.也没有这个` —— 另一类 API。\n",
  );
}

// ─────────────────────────────────────────────────────────── 5. 证伪自检

/** 三个根 + 索引 + 台账一次性算好（旧实现的 ctx 是同样的形状）。 */
function makeCtx(repo, skills, program) {
  const docRoots = [repo];
  if (program) docRoots.push(program);
  return {
    repo,
    skills,
    program,
    docRoots,
    index: buildMbtIndex(repo),
    doneClaims: loadDoneClaims(ledgerFile(repo, program)),
  };
}

/**
 * 证伪：造**坏**夹具 ⇒ 三道门每一条都必须点名；再造**好**夹具 ⇒ 必须零发现。
 * 它直接调用 CLI 用的同一批函数（`g56Find` / `factsCheck`），所以自检绿而 CLI 红是不可能的。
 */
function selftest() {
  const tmp = mkdtempSync(join(tmpdir(), "skillpress-gates-"));
  const bad = join(tmp, "content");
  const prog = join(tmp, "program");
  mkdirSync(bad, { recursive: true });
  mkdirSync(prog, { recursive: true });
  // 假的"程序根"：G6 的第二解析根要靠它（夹具里的 `SPEC.md` §99 走这条支路）
  writeFileSync(join(prog, "SPEC.md"), "# SPEC（假程序根）\n\n## 1. 收录\n\n## 2. 进\n");
  buildFixture(bad, { ledger: true });

  const ctx = makeCtx(bad, join(bad, "skills"), prog);
  const found = g56Find(ctx);
  const facts = factsCheck(bad, bad, ctx.doneClaims).findings;

  console.log(`skillpress-gates 证伪自检 —— ${tmp}`);
  console.log(`G5 索引：${ctx.index.files} 个 .mbt 文件 / ${ctx.index.names.size} 个名字 ｜ 台账：${ctx.doneClaims.length} 条`);

  const want = [
    // ⚠️ 措辞照抄旧实现：G5 那行**没有**反引号（`check.mjs` 的 `G5 源码里没有这个 API：${tok}`）
    ["G5", "`@html.没这个函数` —— 源码里没有这个名字", () => found.some((e) => e.kind === "fail" && /G5 源码里没有这个 API：@html\.没这个函数/.test(e.text))],
    ["G5", "`@style.也没有这个` —— references 里那一条（验两段都扫）", () => found.some((e) => e.kind === "fail" && /G5 源码里没有这个 API：@style\.也没有这个/.test(e.text))],
    ["G6", "`docs/STATUS.md` §99 —— 越界的节号（主文档）", () => found.some((e) => e.kind === "fail" && /G6 节号不存在：`docs\/STATUS\.md` §99/.test(e.text))],
    ["G6", "`docs/STATUS.md` §99 —— references 里也有一条（验顺序：主文档在前）", () => found.filter((e) => /G6 节号不存在：`docs\/STATUS\.md` §99/.test(e.text)).length === 2],
    ["G6", "`SPEC.md` §99 —— 走**程序根**那条解析支路", () => found.some((e) => e.kind === "fail" && /G6 节号不存在：`SPEC\.md` §99/.test(e.text))],
    ["G6", "`docs/NOHEAD.md` §1 —— 目标文件没有编号标题（提示，不判红）", () => found.some((e) => e.kind === "note" && /G6 提示：`docs\/NOHEAD\.md` §1/.test(e.text))],
    ["facts", "D1 —— patch 数说 7、真相 3", () => facts.some((f) => f.id === "D1")],
    ["facts", "D2 —— rabbita 版本说 9.9.9、真相 0.16.3", () => facts.some((f) => f.id === "D2")],
    ["facts", "D6 —— 说\"真机上还没验\"但台账记着已落地", () => facts.some((f) => f.id === "D6")],
  ];
  let badN = 0;
  for (const [gate, what, ok] of want) {
    const hit = ok();
    console.log(`${hit ? "✓" : "✗"} 诱饵 ${gate} —— ${hit ? "被点名" : "**没被抓到**（门有洞）"}：${what}`);
    if (!hit) badN++;
  }
  // 正对照：合格的引用**不许**被点名（否则门在乱咬）
  const clean = !found.some((e) => /@html\.on_raw/.test(e.text));
  console.log(`${clean ? "✓" : "✗"} 正对照 —— ${clean ? "`@html.on_raw` 没被误杀" : "**`@html.on_raw` 被误杀**"}`);
  if (!clean) badN++;

  // 坏夹具的退出码必须非零
  const badExit = found.some((e) => e.kind === "fail") ? 1 : 0;
  const badExitFacts = facts.some((f) => f.severity === "hard") ? 1 : 0;
  console.log(`${badExit ? "✓" : "✗"} 坏夹具退出码 —— G5/G6=${badExit} ｜ facts=${badExitFacts}（都必须非零）`);
  if (!badExit || !badExitFacts) badN++;

  // 好夹具：三道门必须零发现
  const goodDir = join(tmp, "good");
  mkdirSync(goodDir, { recursive: true });
  buildFixture(goodDir, { good: true, ledger: true });
  const gctx = makeCtx(goodDir, join(goodDir, "skills"), prog);
  const g56 = g56Find(gctx);
  const gfacts = factsCheck(goodDir, goodDir, gctx.doneClaims).findings;
  const goodOk = g56.length === 0 && gfacts.length === 0;
  console.log(
    `${goodOk ? "✓" : "✗"} 正例 —— ${goodOk ? "零发现（三道门都没有误杀）" : "被误杀：" + [...g56.map((e) => e.text), ...gfacts.map((f) => f.id + " " + f.msg)].join("；")}`,
  );
  if (!goodOk) badN++;

  console.log(badN ? `\n自检未通过（${badN} 项）—— 门本身有问题` : `\n自检通过（${want.length + 3} 项）`);
  return badN ? 1 : 0;
}

// ─────────────────────────────────────────────────────────── 6. 命令行

const argv = process.argv.slice(2);
const flagVal = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};

const USAGE = `skillpress-gates —— 内容仓自己的三道门（G5 跳转 API 名 / G6 文档节号 / facts 事实来源）

用法：
  node tools/skillpress-gates.mjs                        # 三道门一起跑
  node tools/skillpress-gates.mjs --gate g5              # 只跑一道（g5 / g6 / facts / check(=g5+g6)）
  node tools/skillpress-gates.mjs --strict               # facts 的"软"项也算不合格（默认只算"硬"）
  node tools/skillpress-gates.mjs --selftest             # 证伪：造坏夹具，三道门都必须点名
  node tools/skillpress-gates.mjs --emit-fixture <目录>   # 把证伪夹具写到该目录（[--fixture-ledger] 带本地台账）
                                                          #   [--good] 写"正例"那份（三道门都该零发现）

根：--repo <内容仓根>（默认本文件的上层目录）｜--skills <内容根>（默认 <repo>/skills）
    --program <程序根>（默认兄弟目录 ../skillpress；只有 G6 的第二解析根与 facts 的台账用它）

退出码：0 全绿 ｜ 1 有不合格项 ｜ 2 用法/环境错
`;

if (argv.includes("-h") || argv.includes("--help")) {
  process.stdout.write(USAGE);
  process.exit(0);
}

if (argv.includes("--emit-fixture")) {
  const dir = flagVal("--emit-fixture");
  if (!dir) {
    console.error("✗ --emit-fixture 需要一个目录参数");
    process.exit(2);
  }
  const abs = resolve(dir);
  const good = argv.includes("--good");
  const ledger = argv.includes("--fixture-ledger");
  buildFixture(abs, { good, ledger });
  console.log(`证伪夹具已写到：${abs}${good ? "（正例：合格的那份）" : ""}${ledger ? "（含本地 done-claims.txt）" : ""}`);
  console.log("跑法（旧实现 → 新实现，同一份夹具）：");
  console.log(`  MOOBILE_ROOT=${abs} node ../skillpress/bin/skillpress.mjs check --skills ${abs}/skills`);
  console.log(`  node tools/skillpress-gates.mjs --repo ${abs}`);
  console.log(`  node ../skillpress/bin/skillpress.mjs facts --root ${abs}`);
  console.log(`  node tools/skillpress-gates.mjs --gate facts --repo ${abs}`);
  process.exit(0);
}

if (argv.includes("--selftest")) process.exit(selftest());

const repo = resolve(flagVal("--repo") || DEFAULT_REPO);
const program = flagVal("--program") ? resolve(flagVal("--program")) : defaultProgram();
const skills = resolve(flagVal("--skills") || process.env.SKILLPRESS_GATES_SKILLS || join(repo, "skills"));

if (!argv.includes("--repo") && !process.env.SKILLPRESS_GATES_REPO && !existsSync(join(repo, "skills"))) {
  console.error(`✗ 找不到内容仓（默认取本文件的上层目录）：${repo}`);
  console.error("  用 --repo <内容仓根> 或 SKILLPRESS_GATES_REPO 指定。");
  process.exit(2);
}

const gatesArg = [];
for (let i = 0; i < argv.length; i++) if (argv[i] === "--gate" && argv[i + 1]) gatesArg.push(argv[i + 1]);
const gates = new Set();
for (const g of gatesArg.length ? gatesArg : ["all"]) {
  if (g === "all") for (const x of ["g5", "g6", "facts"]) gates.add(x);
  else if (g === "check" || g === "g56") for (const x of ["g5", "g6"]) gates.add(x);
  else if (["g5", "g6", "facts"].includes(g)) gates.add(g);
  else {
    console.error(`✗ 不认识的 --gate：${g}（g5 / g6 / facts / check / all）`);
    process.exit(2);
  }
}
if (!existsSync(repo)) {
  console.error(`✗ 内容仓根目录不存在：${repo}`);
  process.exit(2);
}

const strict = argv.includes("--strict");
const ctx = makeCtx(repo, skills, program);
const codes = {};

if (gates.has("g5") || gates.has("g6")) {
  const dirs = skillDirs(skills);
  // ⚠️ 指错了根时**别静默全绿**：一个什么都没查的门看起来和全绿一模一样（这是最坏的一种"绿"）
  if (!dirs.length) console.error(`⚠️ 内容根里一个 skill 都没有：${skills}\n   G5/G6 这次什么都没查 —— 确认这是你要查的那份内容（用 --skills 指定）。`);
  const found = g56Find(ctx).filter((e) => (e.text.startsWith("G5 ") ? gates.has("g5") : gates.has("g6")));
  const label = gates.has("g5") && gates.has("g6") ? "G5 + G6" : gates.has("g5") ? "G5" : "G6";
  console.log(`skillpress-gates check（${label}）—— 内容仓：${repo}`);
  console.log(`内容根：${skills}（${dirs.length} 个 skill）`);
  if (gates.has("g5")) console.log(`G5 索引：${ctx.index.files} 个 .mbt 文件 / ${ctx.index.names.size} 个名字（在 ${repo} 的源码里真的存在）`);
  if (gates.has("g6")) {
    // 找不到的根**当场标出来** —— 找不到程序根时那几处会静默不查，别让这件事藏着
    console.log(`G6 文档根：${ctx.docRoots.map((r) => (existsSync(r) ? r : `${r}（**不存在** —— 这个根下的引用不会被查）`)).join(" ｜ ")}`);
  }
  let last = null;
  for (const e of found) {
    if (e.skill !== last) {
      console.log(`\n── ${e.skill}`);
      last = e.skill;
    }
    console.log(e.kind === "note" ? `    · ${e.text}` : `    ✗ ${e.text}`);
  }
  const bad = found.filter((e) => e.kind === "fail").length;
  console.log(bad ? `\n${label}：${bad} 项不合格` : `\n${label}：无不合格项（${skillDirs(skills).length} 个 skill）`);
  if (gates.has("g5")) codes.g5 = found.some((e) => e.text.startsWith("G5 ") && e.kind === "fail") ? 1 : 0;
  if (gates.has("g6")) codes.g6 = found.some((e) => e.text.startsWith("G6 ") && e.kind === "fail") ? 1 : 0;
}

if (gates.has("facts")) {
  if (gates.size > 1) console.log("");
  codes.facts = factsReport(repo, ctx.doneClaims, strict);
}

process.exit(Object.values(codes).some((c) => c !== 0) ? 1 : 0);
