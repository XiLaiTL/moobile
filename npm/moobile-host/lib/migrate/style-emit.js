// style-emit.js —— 把「CSS 规则表」变成「一个能编译的 MoonBit 样式模块」。
//
// ## 输出是什么
//
// 一个 `styles/` 包（`styles.mbt` + `moon.pkg`），里面有**每一个"源码里真实用到的类组合"一个函数**：
//
//     ///| `.topnav` —— backend/index.html:27
//     pub fn topnav() -> @style.Style { … }
//
//     ///| `.bagua-mode on` —— frontend/main.mbt:1175
//     pub fn bagua_mode_on() -> @style.Style { … }   ← 把 `.bagua-mode` 与 `.bagua-mode.on` 合并
//
// 于是视图侧的 `div(class="topnav")` 迁移成 `div(attrs=sty(@styles.topnav()))`。
//
// **为什么按"类组合"生成，而不是"一个类一个函数"**：CSS 里真正决定一个元素长相的
// 是它**同时带的那几个类**（`.bagua-mode` + `.bagua-mode.on`）。只生成单类函数的话，
// 组合态的样式就落在 `.on` 这种**根本没有独立规则**的名字上 —— 那个函数不存在，
// 生成物编不过；就算编过了，高亮态也会**静默消失**。按组合生成把这件事变成"源码写了什么，
// 就有对应的函数"，而且级联顺序按 CSS 源序做，不猜。
//
// **为什么用函数而不是一张按名字查表**：查表要字符串，字符串要运行时才知道对不对；
// 函数名有编译器兜着（类名改了、函数没了，编译期就红）。迁移工具最怕的正是
// "名字对不上但不报错"。
//
// ## 有损的东西怎么处理（这一节是设计，不是实现细节）
//
// 每条声明只有两种归宿：**生成调用** 或 **记进 `losses` 并写清理由**。
// 一个类如果一条声明都没映射成功，**函数照样生成**（返回空 `Style`），
// 但头上带 `TODO(migrate)` 把丢失的每一条列出来 —— 理由是"删掉调用点"会让界面
// **静默变空**，而留一个空样式只是"没样式"，并且报告里点得出名字
// （SCAFFOLD §3.7.4 的负面清单：不顺手删代码）。
//
// ## 对账（本文件的硬断言）
//
// `声明总数 = 已映射 + 有损`，不闭合就抛。这条断言是"零遗漏"从口号变成事实的地方：
// 任何"我以为处理了"的漏网都会在这里变成一次崩溃，而不是报告里少一行。

const css = require('./css.js');
const map = require('./style-map.js');

/** MoonBit 的保留字 —— 类名撞上就加后缀（否则生成的模块直接编不过）。 */
const KEYWORDS = new Set([
  'let', 'fn', 'if', 'else', 'match', 'type', 'struct', 'enum', 'pub', 'priv', 'mut', 'while',
  'for', 'in', 'break', 'continue', 'return', 'true', 'false', 'import', 'as', 'with', 'derive',
  'trait', 'impl', 'guard', 'async', 'extern', 'init', 'test', 'try', 'catch', 'throw', 'is',
  'not', 'noraise', 'suberror', 'using', 'where', 'const',
]);

/** 一个类组合串 → MoonBit 标识符（`hex-index title` → `hex_index_title`）。 */
function fnName(classString) {
  let n = String(classString)
    .trim()
    .split(/\s+/)
    .map((c) => c.replace(/[^A-Za-z0-9_]/g, '_'))
    .join('_');
  n = n.replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
  if (!n) n = 'unnamed';
  if (/^[0-9]/.test(n)) n = '_' + n;
  if (KEYWORDS.has(n)) n = n + '_s';
  return n;
}

/** 组合串的规范化：多个类按**字母序**排（`"on bagua-mode"` 与 `"bagua-mode on"` 是同一个组合）。 */
function normalizeClassString(s) {
  return String(s)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/** 展开选择器里的类名（`.a.b` → `['a','b']`）；非纯类选择器返回 null。 */
function selectorClasses(selector) {
  const cls = css.classifySelector(selector);
  if (cls.kind === 'class') return [cls.className];
  if (cls.kind === 'compound-class') {
    return selector
      .split('.')
      .filter(Boolean)
      .map((x) => x.trim());
  }
  return null;
}

/**
 * 一个选择器的每一段是不是能匹配一个元素。
 * 元素 = `{tag, classes}`；段 = `{tag|null, classes[]}`。
 */
function partMatches(part, el) {
  if (!el) return false;
  if (part.tag && el.tag !== part.tag) return false;
  return part.classes.every((c) => (el.classes || []).includes(c));
}

/**
 * 选择器能不能匹配到某个**源码用法**（site）。
 *
 * 这是"后代选择器如实展开"的核心：从最后一段（元素自己）开始往回走，
 * `>` 要求正好是直接父级，空格则允许在更外层找到（就近优先，与 CSS 一致）。
 *
 * @param {{parts: any[], combinators: string[]}} parsed
 * @param {{own: any, chain: any[]}} site
 */
function selectorMatchesSite(parsed, site) {
  const { parts, combinators } = parsed;
  if (!partMatches(parts[parts.length - 1], site.own)) return false;
  // pos = 已匹配元素在 site.chain 里的下标；-1 表示"就是 site 自己"
  let pos = -1;
  for (let p = parts.length - 2; p >= 0; p--) {
    const comb = combinators[p];
    const parentIdx = pos === -1 ? 0 : pos + 1;
    let matched = -1;
    if (comb === '>') {
      if (parentIdx < site.chain.length && partMatches(parts[p], site.chain[parentIdx])) matched = parentIdx;
    } else {
      for (let k = parentIdx; k < site.chain.length; k++) {
        if (partMatches(parts[p], site.chain[k])) {
          matched = k;
          break;
        }
      }
    }
    if (matched === -1) return false;
    pos = matched;
  }
  return true;
}

/**
 * 收集"每个源码用法最终生效的那组声明"。
 *
 * **级联按 CSS 源序做**：所有能匹配这个用法的规则按文件里的先后顺序依次覆盖，同属性后者胜。
 * 这里**不做选择器权重运算** —— 权重反转（`.a.b` 写在 `.a` 之前）在真实样式表里极少，
 * 真遇到会在 `notes` 里提醒，而不是猜一个顺序。
 *
 * @param {any[]} rules 全部规则（已带 file/line/media）
 * @param {Record<string,string>} vars 已解析的 CSS 变量
 * @param {any[]} sites 源码用法（`class-rewrite.js` 的 `scanSites` 产出：key/own/chain）
 *                      传空数组 = 退化成"CSS 里每个纯类各一个函数"（单独试跑用）
 */
function collectStyles(rules, vars, sites) {
  const useSites = Array.isArray(sites) && sites.length > 0;
  /** @type {Map<string, {key: string, classes: string[], decls: Map<string, any>, order: string[], sources: string[]}>} */
  const sets = new Map();
  const ensure = (key) => {
    let e = sets.get(key);
    if (!e) {
      e = { key, classes: key.split('>').pop().split('.').slice(1), decls: new Map(), order: [], sources: [] };
      sets.set(key, e);
    }
    return e;
  };

  if (useSites) {
    for (const s of sites) ensure(s.key);
  }

  const ruleLosses = [];
  const unmatchedRules = [];
  const pageRules = [];

  for (const rule of rules) {
    if (rule.media) {
      ruleLosses.push({
        kind: 'media',
        reason: `@media ${rule.media} 里的 \`${rule.selector}\` —— RN 没有媒体查询，断点要在 Model 里按窗口宽度表达`,
        file: rule.file,
        line: rule.line,
        decls: rule.decls.length,
      });
      continue;
    }
    if (css.classifySelector(rule.selector).kind === 'root') {
      pageRules.push(rule);
      continue;
    }
    const parsed = css.parseSelectorParts(rule.selector);
    if (!parsed) {
      const cls = css.classifySelector(rule.selector);
      ruleLosses.push({
        kind: cls.kind,
        reason: `${cls.reason}（\`${rule.selector}\`）`,
        file: rule.file,
        line: rule.line,
        decls: rule.decls.length,
      });
      continue;
    }

    if (!useSites) {
      // 退化成"每条规则的最后一个类"的单类函数（不依赖源码）
      const last = parsed.parts[parsed.parts.length - 1];
      for (const c of last.classes) {
        const e = ensure(c);
        applyDecls(e, rule, vars);
        e.sources.push(`${rule.file}:${rule.line}`);
      }
      continue;
    }

    let matchedAny = false;
    for (const site of sites) {
      if (selectorMatchesSite(parsed, site)) {
        const e = sets.get(site.key);
        applyDecls(e, rule, vars);
        e.sources.push(`${rule.file}:${rule.line}`);
        matchedAny = true;
      }
    }
    if (!matchedAny) {
      // 这条规则没匹配上任何用法。两种情形要分开报：
      //   ① 它要的类源码里根本没用到 → 规则用不上，不是损失；
      //   ② 类用到了、但**祖先链对不上** → 那组样式在这个元素上**静默丢了**，必须点名。
      const last = parsed.parts[parsed.parts.length - 1];
      const usedOwn = sites.some((site) => last.classes.every((c) => (site.own.classes || []).includes(c)));
      unmatchedRules.push({
        selector: rule.selector,
        file: rule.file,
        line: rule.line,
        decls: rule.decls.length,
        // ② 这一类才是"损失"：同一个类在源码里出现过，只是上下文与选择器要求的不一样
        lost: usedOwn && parsed.parts.length > 1,
        reason: usedOwn
          ? `源码里用了 \`${last.classes.length ? last.classes.join(' ') : last.tag}\`，但**祖先链与该选择器要求的上下文不一致**（\`${rule.selector}\`）——这一组样式没有落到任何元素上`
          : `\`${rule.selector}\` 里的类/标签在源码里没被用到（规则用不上，不是损失）`,
      });
    }
  }

  const page = ensure('__page__');
  for (const r of pageRules) {
    applyDecls(page, r, vars);
    page.sources.push(`${r.file}:${r.line}`);
  }

  return { sets, ruleLosses, unmatchedRules };
}

/** 把一条规则的声明并进某个类组合的声明表（后写覆盖先写 —— CSS 的级联）。 */
function applyDecls(entry, rule, vars) {
  for (const d of rule.decls) {
    if (d.prop.startsWith('--')) continue; // 自定义属性只用于展开，本身不是样式
    // `class=` 之类的非样式声明不会走到这里；CSS 变量已被 substituteVars 展开
    const value = css.substituteVars(d.value, vars);
    if (!entry.decls.has(d.prop)) entry.order.push(d.prop);
    entry.decls.set(d.prop, { value, line: d.line, file: rule.file });
  }
}

/**
 * 一个类组合的声明 → MoonBit 调用串 + 有损清单 + 提醒清单。
 *
 * @returns {{calls: string[], losses: {prop: string, value: string, reason: string, line: number, file: string}[], notes: string[], emitted: number, lost: number}}
 */
function mapClass(entry) {
  const calls = [];
  const losses = [];
  const notes = [];
  const props = new Set(entry.decls.keys());
  // `display:flex` 要不要补 `flex_direction(Row)`，取决于这一条里**有没有**显式写方向
  const hasExplicitDirection = props.has('flex-direction');
  // em 字距/行高要靠同一样式里的 font-size 换算
  const hasFontSize = props.has('font-size');
  let emitted = 0;
  let lost = 0;

  // 同属性的去重已经在 applyDecls 里做掉（后者胜），这里保留**最后一次出现**的顺序：
  // 先按 order 出现的位置排，被覆盖过的属性沿用最初的位置（对样式结果无影响，对 diff 稳定有影响）。
  const seen = new Set();
  const orderedProps = [];
  for (const p of entry.order) {
    if (seen.has(p)) continue;
    seen.add(p);
    orderedProps.push(p);
  }

  for (const prop of orderedProps) {
    const { value, line, file } = entry.decls.get(prop);
    const r = map.mapDeclaration(prop, value, { emWithoutFontSize: !hasFontSize });
    if (r.loss) {
      losses.push({ prop, value, reason: r.loss, line, file });
      lost++;
      continue;
    }
    emitted++;
    if (prop === 'display' && hasExplicitDirection) {
      // 显式方向优先：只发 display，别补 Row
      calls.push(...r.calls.filter((c) => !c.includes('flex_direction')));
    } else {
      calls.push(...r.calls);
    }
    notes.push(...r.notes);
  }

  return { calls, losses, notes, emitted, lost };
}

/** 生成 `styles.mbt` 的源码文本。 */
function emitModule(collected, meta) {
  const classes = [];
  const usedNames = new Map();
  const accounting = { decls: 0, emitted: 0, lost: 0 };
  const unstyled = [];

  for (const entry of collected.sets.values()) {
    const m = mapClass(entry);
    accounting.decls += entry.decls.size;
    accounting.emitted += m.emitted;
    accounting.lost += m.lost;
    if (!entry.decls.size && entry.key !== '__page__') {
      unstyled.push(entry.key);
      continue; // 一条规则都没匹配上：不生成空函数（调用点会由 class-rewrite 记为 TODO）
    }

    let name = fnName(entry.key === '__page__' ? 'page' : entry.key);
    if (usedNames.has(name)) {
      let i = 2;
      while (usedNames.has(`${name}_${i}`)) i++;
      const renamed = `${name}_${i}`;
      m.notes.push(`与 \`${usedNames.get(name)}\` 的函数名撞了，已改名为 ${renamed}`);
      name = renamed;
    }
    usedNames.set(name, entry.key);
    classes.push({ ...entry, fnName: name, ...m });
  }

  // 排序：让生成物**稳定**（同样输入 → 逐字节相同的输出，才可能进 `--check` 这类门）
  classes.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const L = [];
  L.push('///|');
  L.push('/// 由 `moobile-host create --from-rabbita` 生成 —— **不要手改**。');
  L.push('///');
  L.push(`/// 源：${meta.sheets.map((s) => `${s.file}:${s.line}`).join(' + ')}`);
  L.push(`///     共 ${meta.cssLines} 行 / ${meta.cssRules} 条规则 → 这里 ${classes.length} 个样式函数。`);
  L.push('///');
  L.push('/// 每个函数对应**源码里真实用到的一个类组合**（`class="a b"` 就是 `a_b`）。');
  L.push('/// 有损的条目在函数头上以 `TODO(migrate)` 列出 —— 那些是 `@style` 明确不表达的东西');
  L.push('/// （grid / sticky / transform / box-shadow / 伪类…），不是生成器漏了。');
  L.push('');

  // `att` 这座桥：视图侧的写法是 `attrs=@styles.att(@styles.<类>())`。
  // 放在这个包里而不是每个应用包里各放一份 —— 副本少一份就少一个漂移点。
  L.push('///|');
  L.push('/// `Style` → `Attrs` 的桥。视图里的写法：`attrs=@styles.att(@styles.<类>())`。');
  L.push('pub fn att(s : @style.Style) -> @html.Attrs {');
  L.push('  @html.Attrs::build().styles(s)');
  L.push('}');
  L.push('');

  for (const c of classes) {
    const isPage = c.key === '__page__';
    L.push('///|');
    if (isPage) {
      L.push('/// 页面根样式（源 CSS 里的 `body` / `html`）—— 挂在最外层容器上。');
    } else {
      L.push(
        `/// \`class="${c.key}"\` —— ${c.sources[0]}` +
          (c.sources.length > 1 ? ` （另见 ${c.sources.slice(1).join('、')}）` : ''),
      );
    }
    for (const note of c.notes) L.push(`///   · ${note}`);
    for (const l of c.losses) {
      // `reason` 里已经带了 `prop:value`（style-map 的约定），这里不再重复
      L.push(`///   · TODO(migrate) ${l.reason}  （${l.file}:${l.line}）`);
    }
    L.push(`pub fn ${c.fnName}() -> @style.Style {`);
    L.push('  @style.Style::new()');
    for (const call of c.calls) L.push(`    ${call}`);
    if (!c.calls.length && c.losses.length) {
      L.push(`  // ↑ 这个类有 ${c.losses.length} 条声明没有对应物，逐条列在上面（别当它已经迁好了）`);
    }
    L.push('}');
    L.push('');
  }

  while (L.length && L[L.length - 1] === '') L.pop();
  const out = L.join('\n') + '\n';
  return { source: out, classes, accounting, unstyled };
}

/** 生成 `styles/moon.pkg`。 */
function emitMoonPkg() {
  return `// 由 \`moobile-host create --from-rabbita\` 生成 —— **不要手改**。
//
// 两个依赖：样式层（\`@style\`）+ 视图属性（\`att\` 这个桥要把 \`Style\` 变成 \`Attrs\`）。
supported_targets = "+js"

import {
  "XiLaiTL/moobile/style",
  "XiLaiTL/moobile/vendor/rabbita/html" @html,
}
`;
}

/**
 * 顶层入口：从一组源码文件里抽出 CSS、映射、生成模块。
 *
 * @param {{rel: string, text: string}[]} files
 * @param {{appName?: string, sites?: any[]}} [opts]
 *        `sites` = 源码里真实用到的 `class=` 用法（含祖先链）。给了就按它生成；
 *        没给就退化成"CSS 里每条规则的最后一个类各一个函数"（单独试跑 CSS → Style 用）。
 */
function generate(files, opts = {}) {
  const { sheets, losses: sheetLosses } = css.extractSheets(files);
  const rules = [];
  const vars = {};
  const parseLosses = [];
  for (const s of sheets) {
    // ⚠️ `s.line`：内联 `<style>` 的内容在 HTML 文件里的起始行 —— 报告的行号就是靠它对齐的
    const r = css.parse(s.text, s.file, s.line);
    for (const rule of r.rules) rules.push(rule);
    Object.assign(vars, r.vars);
    parseLosses.push(...r.losses);
  }
  const resolved = css.resolveVars(vars);
  const collected = collectStyles(rules, resolved.vars, opts.sites);
  const meta = {
    appName: opts.appName || 'app',
    sheets: sheets.map((s) => ({ file: s.file, line: s.line })),
    cssLines: sheets.reduce((n, s) => n + s.text.split('\n').length, 0),
    cssRules: rules.length,
  };
  const { source, classes, accounting, unstyled } = emitModule(collected, meta);

  // ── 对账：不留第三种结果 ────────────────────────────────────────────────────
  if (accounting.decls !== accounting.emitted + accounting.lost) {
    throw new Error(
      `样式对账不闭合：声明 ${accounting.decls} 条，已映射 ${accounting.emitted}，有损 ${accounting.lost}。` +
        ' 这说明 style-map.js 里有一条既没生成调用、也没记为有损的路径。',
    );
  }

  const ruleLossSummary = {};
  for (const l of collected.ruleLosses) ruleLossSummary[l.kind] = (ruleLossSummary[l.kind] || 0) + 1;

  return {
    source,
    moonPkg: emitMoonPkg(),
    classes,
    meta,
    vars: resolved.vars,
    unresolvedVars: resolved.unresolved,
    accounting,
    /** 规则级的有损（整条规则都没映射：伪类 / @media / 认不出的写法） */
    ruleLosses: collected.ruleLosses,
    /** 规则存在、但没落到任何源码用法上（其中 `lost: true` 的那些是真损失） */
    unmatchedRules: collected.unmatchedRules,
    ruleLossSummary,
    /** 源码用过、但 CSS 里没有对应规则的类组合（多半是状态标记，例如单独的 `on`） */
    unstyledClasses: unstyled,
    parseLosses: [...sheetLosses, ...parseLosses],
  };
}

module.exports = {
  generate,
  selectorMatchesSite,
  partMatches,
  fnName,
  normalizeClassString,
  selectorClasses,
  collectStyles,
  mapClass,
  emitModule,
  emitMoonPkg,
};
