// css.js —— F2（样式层迁移）的第一步：把项目的 CSS 读成**结构化规则**。
//
// ## 为什么要有这一层
//
// moobile 没有 CSS 文件：样式是**类型化**的 `@style.Style`，属性集封闭（`style/style.mbt`）。
// 于是迁移一个既有 rabbita 项目时，"122 处 `class=` 全部会静默失效"这件事必须先变成
// **可对账的数据**，才谈得上机械映射。这一层只做一件事：**把 CSS 解析成规则表**，
// 不做任何"猜意图"的判断（那是 `style-map.js` 的活，而它必须逐条说明自己丢了什么）。
//
// ## 边界（说清楚，免得以为它能处理完整 CSS）
//
// 覆盖的是**这套技术栈实际会写的那个子集**：规则块、`,` 分组选择器、`:root` 自定义属性、
// `@media` 块（**只记录不映射**）、单层大括号嵌套。**不覆盖**：`@supports` / `@keyframes` /
// `@import` / CSS 嵌套语法（`&`）/ `!important` 的优先级运算 / 属性选择器。
// 不覆盖的那些**不会被静默丢掉** —— 它们进 `losses`，由调用方报给人看（见 `create.js`）。
//
// ## 行号是硬要求
//
// 迁移报告的价值大半在"**去哪一行改**"。所以每个规则、每条声明都带 `file:line` ——
// 这也是 F1 动检报告已有的形状（`hits[].file/line`），两份报告要能对上。

/**
 * @typedef {{prop: string, value: string, line: number}} Decl
 * @typedef {{file: string, line: number, media: string|null, selector: string, decls: Decl[]}} Rule
 */

/** 去掉 `/* … *​/` 注释，但**保留换行数**（行号不能因此漂）。 */
function stripComments(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      // 注释里的换行原样补回来，行号才不会漂
      for (let j = i; j < stop; j++) if (text[j] === '\n') out += '\n';
      i = stop;
      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

/** 一段文本里第 `index` 个字符在第几行（1 基）。 */
function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

/**
 * 解析一个 CSS 源码字符串。
 *
 * 这是**手写的子集解析器**，不是正则拼接：`@media` 里还有一层大括号，用正则切会得到
 * 看起来对、边界上错的结果（而"边界上错"正是迁移工具最不该有的失败方式 ——
 * 它会把错的样式当对的写进用户代码）。
 *
 * ⚠️ `baseLine` 是**必须传对的**：内联 `<style>` 的内容从第 1 行起算，但它在 HTML 文件里
 * 可能位于第 7 行（`interest/yi` 就是）。报告要回答的是"**去哪一行改**"，
 * 差 7 行就等于把人指到别的地方 —— 那比不报还坏。
 *
 * @param {string} text CSS 文本
 * @param {string} file 归因用的文件名（报告里要指回原文件）
 * @param {number} [baseLine] 这段 CSS 文本第 1 行对应的**文件行号**（默认 1）
 * @returns {{rules: Rule[], vars: Record<string,string>, losses: {reason: string, file: string, line: number, text: string}[]}}
 */
function parse(text, file = '<inline>', baseLine = 1) {
  const src = stripComments(text);
  const rules = [];
  const vars = {};
  const losses = [];
  /** 文本内偏移 → **文件**行号。 */
  const at = (index) => baseLine + lineAt(src, index) - 1;

  // 递归下降：读一串"前置串"，遇到 `{` 就进块，遇到 `;` 就是一条裸声明（顶层不该有）。
  const walk = (start, end, media) => {
    let i = start;
    let preludeStart = start;
    while (i < end) {
      const c = src[i];
      if (c === '{') {
        const rawPrelude = src.slice(preludeStart, i);
        const selector = rawPrelude.trim();
        // ⚠️ 行号要取**选择器第一个非空白字符**的位置，不能取 `preludeStart`：
        //    那一位紧跟在**上一条规则**的 `}` 后面，于是它算在上一行 —— 实测差 1 行，
        //    而"去哪一行改"正是报告的全部价值。
        const selStart = preludeStart + (rawPrelude.length - rawPrelude.trimStart().length);
        // 找匹配的 `}`
        let depth = 1;
        let j = i + 1;
        const bodyStart = j;
        while (j < end && depth > 0) {
          if (src[j] === '{') depth++;
          else if (src[j] === '}') depth--;
          j++;
        }
        const bodyEnd = depth === 0 ? j - 1 : end;
        const head = selector.toLowerCase();
        if (head.startsWith('@')) {
          const kind = head.split(/[\s({]/)[0];
          if (kind === '@media') {
            // 断点**不映射**（RN 没有媒体查询）—— 但里面的规则要读出来，
            // 否则"这条类在窄屏下长什么样"就丢了，报告会少一类。
            walk(bodyStart, bodyEnd, selector);
          } else {
            losses.push({
              reason: `不支持的 at-rule：${kind}`,
              file,
              line: at(selStart),
              text: selector.slice(0, 60),
            });
          }
        } else {
          const decls = parseDecls(src.slice(bodyStart, bodyEnd), at(bodyStart), file, losses);
          if (selector.startsWith(':root') || selector.startsWith('html:root')) {
            for (const d of decls) if (d.prop.startsWith('--')) vars[d.prop] = d.value;
          } else {
            // 一个规则可以有多个选择器（`.a, .b { }`）—— 拆开，各自成规则。
            for (const one of selector.split(',')) {
              const sel = one.trim();
              if (sel) rules.push({ file, line: at(selStart), media, selector: sel, decls });
            }
          }
        }
        preludeStart = j;
        i = j;
        continue;
      }
      if (c === ';' || c === '}') {
        preludeStart = i + 1;
      }
      i++;
    }
  };

  walk(0, src.length, null);
  return { rules, vars, losses };
}

/** 把一段块体解析成声明列表（`prop: value;`）。 */
function parseDecls(body, baseLine, file, losses) {
  const decls = [];
  // 顶层按 `;` 切；值里的 `;` 只会出现在字符串/函数里，这个子集里没有，所以直接切。
  let depth = 0;
  let start = 0;
  const push = (chunk, offset) => {
    const raw = chunk.trim();
    if (!raw) return;
    const colon = raw.indexOf(':');
    if (colon === -1) {
      losses.push({ reason: '看不懂的声明', file, line: baseLine + offset, text: raw.slice(0, 60) });
      return;
    }
    decls.push({
      prop: raw.slice(0, colon).trim().toLowerCase(),
      value: raw.slice(colon + 1).trim(),
      line: baseLine + offset,
    });
  };
  let lineOffset = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === '\n') lineOffset = countLines(body.slice(start, i));
    if (c === ';' && depth === 0) {
      push(body.slice(start, i), countLines(body.slice(0, start)));
      start = i + 1;
    }
  }
  push(body.slice(start), countLines(body.slice(0, start)));
  return decls;
}

function countLines(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === '\n') n++;
  return n;
}

/**
 * 迭代展开 `var(--x)` —— 自定义属性可以引用另一个自定义属性（yi 的 `--bg: var(--paper-1)`
 * 就是两层），所以一次遍历不够，要跑到不动点。
 *
 * @returns {{vars: Record<string,string>, unresolved: string[]}}
 */
function resolveVars(vars) {
  const out = { ...vars };
  const MAX = 8; // 环（`--a: var(--b); --b: var(--a)`）会在这里被截断并报出来
  for (let round = 0; round < MAX; round++) {
    let changed = false;
    for (const [k, v] of Object.entries(out)) {
      const next = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (m, name, fallback) => {
        if (out[name] !== undefined) return out[name];
        if (fallback !== undefined) return fallback.trim();
        return m;
      });
      if (next !== v) {
        out[k] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const unresolved = [];
  for (const [k, v] of Object.entries(out)) {
    // 只把**根**上的未解析项报出来；被别的变量引用的那些会一起暴露
    for (const m of v.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (!unresolved.includes(m[1])) unresolved.push(m[1]);
    }
  }
  return { vars: out, unresolved };
}

/** 把 `var(--x, fallback)` 在**值**里替换掉（值里的变量与 :root 里的都走这一条）。 */
function substituteVars(value, vars) {
  let out = value;
  for (let i = 0; i < 8; i++) {
    const next = out.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (m, name, fallback) => {
      if (vars[name] !== undefined) return vars[name];
      if (fallback !== undefined) return fallback.trim();
      return m;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * 从一组源文件里把 CSS 抽出来：**独立的 `.css` 文件** + **HTML 里的 `<style>` 块**。
 *
 * 为什么两种都要：这套技术栈里两种写法都常见 —— `interest/yi` 的样式就在
 * `backend/index.html` 的内联 `<style>` 里（476 行），而 `mockup/` 那半边可能是独立文件。
 * 只认一种，报告就会"看起来干净"但少了一半规则。
 *
 * @param {{rel: string, text: string}[]} files
 * @returns {{sheets: {file: string, line: number, text: string}[], losses: any[]}}
 */
function extractSheets(files) {
  const sheets = [];
  const losses = [];
  for (const f of files) {
    if (f.rel.endsWith('.css')) {
      sheets.push({ file: f.rel, line: 1, text: f.text });
      continue;
    }
    if (!f.rel.endsWith('.html') && !f.rel.endsWith('.htm')) continue;
    const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let m;
    while ((m = re.exec(f.text))) {
      sheets.push({ file: f.rel, line: lineAt(f.text, m.index), text: m[1] });
    }
    if (/<link[^>]+rel=["']?stylesheet/i.test(f.text)) {
      losses.push({
        reason: 'HTML 里用 <link> 引了外部样式表（本工具只看 .css 文件与内联 <style>）',
        file: f.rel,
        line: lineAt(f.text, f.text.search(/<link[^>]+rel=["']?stylesheet/i)),
      });
    }
  }
  return { sheets, losses };
}

/**
 * 把选择器拆成"组合序列"：`.a .b > input.c` → parts `[.a, .b, input.c]` + combinators `[' ', '>']`。
 *
 * **为什么要拆而不是"判个类型就丢掉"**：后代选择器（`.hex-card .idx`）在这类应用里
 * 承载着大量真实排版（字号 / 颜色 / 字体 / 字距）。RN 侧确实没有"后代"这个机制，
 * 但这类选择器的**意图是静态可判定的** —— 只要知道元素在源码里的祖先链
 * （`class-rewrite.js` 会把祖先链扫出来），就能把 `.hex-card .idx` 如实展开成
 * "这个 `.idx` 待在 `.hex-card` 里面时"的那组样式。丢掉它们等于"迁完没样式"，
 * 那正是迁移工具最不该交的东西。
 *
 * 返回 `null` = **不参与机械映射**：伪类/伪元素、属性选择器、相邻/兄弟（`+` `~`），
 * 以及任何认不出的写法。不猜。
 *
 * @param {string} selector
 * @returns {{parts: {tag: string|null, classes: string[]}[], combinators: string[]}|null}
 */
function parseSelectorParts(selector) {
  const sel = String(selector).trim();
  if (!sel) return null;
  if (/[:\[\]]/.test(sel)) return null; // 伪类 / 伪元素 / 属性选择器
  const tokens = sel
    .replace(/\s*>\s*/g, ' > ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.some((t) => t === '+' || t === '~')) return null; // 兄弟/相邻：不猜

  const parts = [];
  const combinators = [];
  let pending = null;
  for (const t of tokens) {
    if (t === '>') {
      if (!parts.length) return null;
      pending = '>';
      continue;
    }
    const m = t.match(/^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)$/);
    if (!m) return null; // `*` / 转义 / 命名空间等：认不出就不映射
    const classes = (m[2] || '').split('.').filter(Boolean);
    if (!m[1] && !classes.length) return null;
    if (parts.length) combinators.push(pending || ' ');
    pending = null;
    parts.push({ tag: m[1] ? m[1].toLowerCase() : null, classes });
  }
  if (!parts.length) return null;
  if (combinators.length !== parts.length - 1) return null;
  return { parts, combinators };
}

/**
 * 选择器的分类 —— **这一层决定了"哪条规则能机械映射、哪条必然有损"**。
 *
 * 能映射的是两类：**纯类**（`.card`）与**类/元素的组合序列**（`.a .b > input`，
 * 见 `parseSelectorParts`）。其余的在 RN 侧没有对应物（`style/style.mbt` 的属性集里
 * 根本没有这些构造器 —— 那是刻意的设计，不是缺口）。所以这里**不猜**：
 * 不能映射的如实归类，交给报告点名。
 *
 * @param {string} selector
 * @returns {{kind: string, className?: string, reason?: string}}
 */
function classifySelector(selector) {
  const sel = selector.trim();
  if (sel === '') return { kind: 'empty', reason: '空选择器' };

  // 伪类 / 伪元素：`:hover`、`::before`、`:focus`、`:first-child` …
  if (sel.includes(':')) {
    const pseudo = sel.match(/::?([\w-]+)/);
    return {
      kind: 'pseudo',
      reason: `伪类/伪元素 :${pseudo ? pseudo[1] : '?'} —— RN 没有伪类，:hover 在触屏上本来也不存在`,
    };
  }
  if (sel.includes('[')) return { kind: 'attribute', reason: '属性选择器没有对应物' };

  const simple = sel.match(/^\.([A-Za-z_][\w-]*)$/);
  if (simple) return { kind: 'class', className: simple[1] };

  if (/^(html|body|:root|\*)$/i.test(sel)) return { kind: 'root' };

  if (parseSelectorParts(sel)) {
    // 能拆成"祖先链 + 自身"的组合序列：**可映射**（靠源码里的祖先链匹配）。
    return { kind: 'combinator', reason: '后代/子代选择器（按源码祖先链展开）' };
  }
  if (/[\s>+~]/.test(sel)) {
    return { kind: 'combinator', reason: '后代/子代/兄弟选择器（含无法静态判定的部分）' };
  }

  // 元素选择器（`p` / `h2` / `input`…）：RN 侧没有元素级默认样式这一层
  if (/^[a-z][\w-]*$/i.test(sel)) return { kind: 'element', reason: `元素选择器 \`${sel}\`` };

  return { kind: 'other', reason: `无法分类的选择器 \`${sel}\`` };
}

module.exports = {
  parse,
  parseDecls,
  stripComments,
  lineAt,
  countLines,
  resolveVars,
  substituteVars,
  extractSheets,
  classifySelector,
  parseSelectorParts,
};
