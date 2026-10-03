// class-rewrite.js —— F2 的第二半：把视图里的 `class="a b"` 改写成 `attrs=sty(@styles.…)`。
//
// ## 为什么必须做这一步（而不是留给人改）
//
// 在 moobile 里 `class=` **仍然能编译**（`div` 的签名里还留着 `class? : String`），
// 但它**没有任何视觉效果** —— RN 侧没有 CSS 类这一层。122 处 `class=` 会**全部静默失效**：
// 页面能跑、不报错、只是没样式。这正是 F1 动检要抓的那类问题，而机械改写是把它一次做完的手段。
//
// ## 关键：改写要带上**祖先链**（这是本文件存在的真正理由）
//
// CSS 里真正的样子不只由元素自身的类决定，还由**它在谁里面**决定：
// `.hex-card .name { font-size: 15px }` 说的是"`.hex-card` 里面的 `.name`"。
// RN 没有后代选择器，但**祖先链在源码里是静态可读的** —— 只要顺着括号往里走，
// 就知道 `span(class="name")` 外面套着 `div(class="hex-card")`。
// 于是每个 `class=` 用法都能算出一个**上下文键**（形如 `div.hex-card>span.name`），
// 样式模块按这个键生成一个函数，改写点就指向那个函数。
//
// 不做这一步的后果很具体：这套样式表里 **51 条**规则是后代/子代选择器，
// 承载的正是阅读页大半的排版。丢掉它们 = 迁完没样式。
//
// ## 只做"能证明对"的改写（三条形状，缺一不改）
//
//   ① `class="a b"`                      → `attrs=sty(@styles.…)`（名字来自上下文键）
//   ② `class=if c { "a" } else { "b" }`  → `attrs=if c { sty(…) } else { sty(…) }`
//   ③ 其它（`class=some_var`、同一元素**已经有** `attrs=` 的）→ **一个字符都不动**，记进 `todos`
//
// 第 ③ 条是刻意的：`class=line_cls` 这种类名是运行时算出来的，机械映射只能靠猜变量在别处
// 的赋值 —— 而"猜错"的代价是把错的样式写进用户代码，他永远不会知道（SCAFFOLD §3.7.4）。
//
// ## 改写依赖的 helper
//
// 生成的项目里有一份 `styles_helpers.mbt`，提供
// `pub fn sty(s : @style.Style) -> @html.Attrs`。用 helper 而不是每处手写
// `@html.Attrs::build().styles(...)`：调用点短一半，且将来换写法只改一处。

const { fnName, normalizeClassString } = require('./style-emit.js');

/**
 * HTML 标签名表 —— 用来判断"一个调用是不是元素"。
 *
 * 为什么需要它：源码里 `hex_card_view(h, emit)` 也是"标识符 + 括号"的形状，
 * 但它**不是元素**，不该进祖先链。判据取"小写 + 在这张表里"，
 * 表的内容就是 moobile 标签表（`render.mbt`）那一批。
 */
const HTML_TAGS = new Set([
  'div', 'span', 'p', 'a', 'button', 'input', 'textarea', 'select', 'option', 'label', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'td', 'th', 'pre', 'code', 'em', 'strong', 'b', 'i', 'u', 's',
  'small', 'sup', 'sub', 'blockquote', 'cite', 'hr', 'br', 'img', 'canvas', 'details', 'summary',
  'dialog', 'video', 'audio', 'svg', 'iframe',
]);

/** 从 `i` 开始读一个双引号字符串字面量。返回 `{value, end}`（end 指向闭引号之后）。 */
function readString(text, i) {
  let out = '';
  let j = i + 1;
  while (j < text.length) {
    if (text[j] === '\\') {
      out += text[j] + text[j + 1];
      j += 2;
      continue;
    }
    if (text[j] === '"') return { value: out, end: j + 1 };
    out += text[j];
    j++;
  }
  return { value: out, end: text.length };
}

/** 从 `open`（指向 `{`/`(`/`[`）找到配对的收括号下标（找不到返回 -1）。 */
function matchClose(text, open) {
  const pairs = { '{': '}', '(': ')', '[': ']' };
  const close = pairs[text[open]];
  if (!close) return -1;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      i = readString(text, i).end - 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      i = nl === -1 ? text.length : nl;
      continue;
    }
    if (c === text[open]) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * 解析 `class=` 右边的取值。
 *
 * @returns {{kind: 'literal'|'if'|'expr', start: number, end: number, value: string,
 *            literals?: {value: string, start: number, end: number}[]}}
 */
function parseClassValue(text, i) {
  let j = i;
  while (j < text.length && /\s/.test(text[j])) j++;

  if (text[j] === '"') {
    const s = readString(text, j);
    return { kind: 'literal', start: j, end: s.end, value: s.value };
  }

  if (/^if\b/.test(text.slice(j, j + 3))) {
    let k = j + 2;
    const literals = [];
    let end = j;
    for (;;) {
      // 跳过条件，停在分支体的 `{`
      let depthParen = 0;
      while (k < text.length) {
        const c = text[k];
        if (c === '"') {
          k = readString(text, k).end;
          continue;
        }
        if (c === '(') depthParen++;
        else if (c === ')') depthParen--;
        else if (c === '{' && depthParen === 0) break;
        k++;
      }
      const close = matchClose(text, k);
      if (close === -1) return { kind: 'expr', start: j, end: text.length, value: text.slice(j) };
      collectBranchLiteral(text, k, close, literals);
      end = close + 1;
      // `else` / `else if`
      let m = end;
      while (m < text.length && /\s/.test(text[m])) m++;
      if (text.slice(m, m + 4) !== 'else') break;
      m += 4;
      while (m < text.length && /\s/.test(text[m])) m++;
      if (/^if\b/.test(text.slice(m, m + 3))) {
        k = m + 2;
        continue;
      }
      if (text[m] === '{') {
        const c2 = matchClose(text, m);
        if (c2 === -1) return { kind: 'expr', start: j, end: text.length, value: text.slice(j) };
        collectBranchLiteral(text, m, c2, literals);
        end = c2 + 1;
      }
      break;
    }
    return { kind: 'if', start: j, end, value: text.slice(j, end), literals };
  }

  // 裸表达式：读到本层的 `,` / `)` / `}` 为止
  let k = j;
  let depth = 0;
  while (k < text.length) {
    const c = text[k];
    if (c === '"') {
      k = readString(text, k).end;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break;
      depth--;
    } else if (c === ',' && depth === 0) break;
    k++;
  }
  return { kind: 'expr', start: j, end: k, value: text.slice(j, k).trim() };
}

/**
 * 分支体必须**正好是一个字符串字面量**才算"类名分支"（`{ "a" }`）。
 * 别的形状（`{ compute() }`、`{ "a" + x }`）一律不认 —— 那要靠人。
 */
function collectBranchLiteral(text, open, close, sink) {
  const inner = text.slice(open + 1, close);
  if (!/^\s*"(?:[^"\\]|\\.)*"\s*$/.test(inner)) return;
  const at = open + 1 + inner.indexOf('"');
  const lit = readString(text, at);
  sink.push({ value: lit.value, start: at, end: lit.end });
}

/** 祖先链上/自己这个元素的标签：有类时用 `tag.class`，没类时用 `tag`。 */
function labelOf(el) {
  if (el.classes && el.classes.length) return `${el.tag || ''}${el.tag ? '.' : ''}${el.classes.join('.')}`;
  return el.tag || '?';
}

/**
 * 扫一个源码文件，产出**每个 `class=` 用法的上下文**。
 *
 * 单趟扫描，维护一个括号栈：
 *   · 遇到 `标识符 (` 且标识符是 HTML 标签 → 压一个"元素帧"；
 *   · 遇到 `class=` → 归属**最内层的元素帧**，并把它外面那些元素帧记成祖先链；
 *   · 其它括号（函数调用、数组、lambda 体）压普通帧，只用来配对。
 *
 * @returns {{sites: any[], todos: any[]}}
 */
function scanSites(text, file = '<inline>') {
  const sites = [];
  const todos = [];
  /** @type {{open: number, tag: string|null, classes: string[]|null}[]} */
  const stack = [];
  const lineOf = (idx) => text.slice(0, idx).split('\n').length;

  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      i = readString(text, i).end;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      i = nl === -1 ? text.length : nl;
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j++;
      const word = text.slice(i, j);
      let k = j;
      while (k < text.length && /[ \t]/.test(text[k])) k++;

      if (text[k] === '(') {
        stack.push({ open: k, tag: HTML_TAGS.has(word) ? word : null, classes: null });
        i = k + 1;
        continue;
      }
      if (word === 'class' && text[k] === '=') {
        const valueStart = k + 1;
        const v = parseClassValue(text, valueStart);
        // 最内层的**元素帧**（`tag !== null`）就是承载这个 class 的元素
        let owner = null;
        for (let s = stack.length - 1; s >= 0; s--) {
          if (stack[s].tag) {
            owner = stack[s];
            break;
          }
        }
        if (owner) {
          const key = (v.kind === 'literal' ? [normalizeClassString(v.value)] : [])
            .concat(v.kind === 'if' ? v.literals.map((l) => normalizeClassString(l.value)) : [])
            .filter(Boolean);
          if (v.kind === 'literal' && key[0]) owner.classes = key[0].split(' ');
          else if (v.kind === 'if' && key.length) owner.classes = null; // 条件类：不参与祖先链（不确定）
          // 祖先链：栈里在这个元素帧**外面**的元素帧，从内到外
          const chain = [];
          let seenOwner = false;
          for (let s = stack.length - 1; s >= 0; s--) {
            const fr = stack[s];
            if (fr === owner) {
              seenOwner = true;
              continue;
            }
            if (seenOwner && fr.tag) chain.push({ tag: fr.tag, classes: fr.classes || [] });
          }
          // chain 现在是从内到外；反过来变成从外到内更适合做键
          chain.reverse();

          if (v.kind !== 'expr') {
            const ownCandidates = v.kind === 'literal' ? [normalizeClassString(v.value)] : v.literals.map((l) => normalizeClassString(l.value));
            for (const own of ownCandidates) {
              if (!own) continue;
              const key = [...chain.map(labelOf), `${owner.tag}.${own.split(' ').join('.')}`].join('>');
              sites.push({
                file,
                line: lineOf(i),
                key,
                own: { tag: owner.tag, classes: own.split(' ') },
                chain,
                keyStart: i,
                valueStart,
                valueEnd: v.end,
                kind: v.kind,
                literals: v.literals || [],
                raw: text.slice(i, v.end),
              });
            }
          } else {
            todos.push({
              kind: 'dynamic-class',
              file,
              line: lineOf(i),
              reason: `类名不是字面量（\`class=${v.value}\`）—— 机械映射只能靠猜变量的赋值，不猜`,
              snippet: `class=${v.value}`,
            });
          }
        }
        i = v.end;
        continue;
      }
      i = j;
      continue;
    }

    if (c === '(' || c === '[' || c === '{') {
      stack.push({ open: i, tag: null, classes: null });
      i++;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      stack.pop();
      i++;
      continue;
    }
    i++;
  }

  return { sites, todos };
}

/** 从若干源码文件里抽出**全部上下文键**（= 样式模块要生成哪些函数）。 */
function extractSites(files) {
  const sites = [];
  const todos = [];
  for (const f of files) {
    if (!f.rel.endsWith('.mbt')) continue;
    const r = scanSites(f.text, f.rel);
    sites.push(...r.sites);
    todos.push(...r.todos);
  }
  return { sites, todos };
}

/**
 * 判断 `index` 所在的**函数调用括号组**里是不是已经有 `attrs=`。
 *
 * 为什么必须查：`canvas(id=…, attrs=…, …)` 再加一处就成了**两个 `attrs=`**，直接编不过。
 * 而"编不过"还算好的 —— 真正危险的是看起来改对了。
 */
function enclosingCallHasAttrs(text, index) {
  let depth = 0;
  for (let i = index; i >= 0; i--) {
    const c = text[i];
    if (c === ')') depth++;
    else if (c === '(') {
      if (depth === 0) {
        const close = matchClose(text, i);
        if (close === -1) return false;
        // ⚠️ 只看**本调用的参数这一层**（depth 0），不能整段 `text.slice(i, close)` 去 grep：
        //    子元素写在参数里，而子元素自己的 `attrs=` 也在这一段里 —— 于是"内层有"会被
        //    误判成"外层有"（实测 `div(class="bagua-canvas-box", [canvas(attrs=…)])` 就是这样，
        //    报了一条根本不需要人处理的 TODO）。
        let d = 0;
        for (let j = i + 1; j < close; j++) {
          const ch = text[j];
          if (ch === '"') {
            j = readString(text, j).end - 1;
            continue;
          }
          if (ch === '(' || ch === '[' || ch === '{') d++;
          else if (ch === ')' || ch === ']' || ch === '}') d--;
          else if (d === 0 && ch === 'a' && /^attrs\s*=/.test(text.slice(j, j + 12))) return true;
        }
        return false;
      }
      depth--;
    }
  }
  return false;
}

/**
 * 改写一个文件。
 *
 * @param {string} text
 * @param {{file?: string, known: Set<string>|string[], alias?: string, helper?: string}} opts
 *        `known` = 已经有生成函数的**上下文键**（`scanSites` 产出的 `key`）。
 *        不在里面的**不改写** —— 改了会指向一个不存在的函数，那是把编译错误留给用户。
 * @returns {{text: string, edits: any[], todos: any[]}}
 */
function rewrite(text, opts) {
  const file = opts.file || '<inline>';
  const known = opts.known instanceof Set ? opts.known : new Set(opts.known || []);
  const alias = opts.alias || '@styles';
  const helper = opts.helper || 'sty';
  const { sites, todos } = scanSites(text, file);
  const edits = [];

  // ⚠️ 「这个元素已经有 attrs= 了吗」必须在**改之前的原文**上判定，而且要一次算完。
  //    为什么：内层元素被改写后，它插进去的 `attrs=sty(…)` 正好落在**外层调用**的括号里，
  //    于是外层再去问"你有 attrs 吗"就会得到"有"——不存在的冲突会凭空冒出来
  //    （第一次跑就撞上：41 处假冲突，真冲突只有 2 处）。
  const conflictAt = new Map();
  for (const s of sites) {
    if (!conflictAt.has(s.keyStart)) conflictAt.set(s.keyStart, enclosingCallHasAttrs(text, s.keyStart));
  }

  // 按位置从后往前替换，避免偏移失效
  const ordered = sites.slice().sort((a, b) => b.keyStart - a.keyStart);
  const seen = new Set();
  let out = text;
  for (const s of ordered) {
    // 同一个 class= 可能产出多个 site（条件分支）：只处理一次
    const anchor = `${s.keyStart}`;
    if (seen.has(anchor)) continue;
    seen.add(anchor);

    if (conflictAt.get(s.keyStart)) {
      todos.push({
        kind: 'attrs-conflict',
        file,
        line: s.line,
        reason: '这个元素已经有 `attrs=` 了，再补一个会编不过 —— 两处要手工合并',
        snippet: s.raw.replace(/\s+/g, ' ').slice(0, 80),
      });
      continue;
    }

    if (s.kind === 'literal') {
      if (!known.has(s.key)) {
        todos.push({
          kind: 'unstyled-class',
          file,
          line: s.line,
          reason: `上下文键 \`${s.key}\` 在 CSS 里没有匹配的规则（多半是状态标记），未改写`,
          snippet: s.raw,
        });
        continue;
      }
      const replacement = `attrs=${helper}(${alias}.${fnName(s.key)}())`;
      out = out.slice(0, s.keyStart) + replacement + out.slice(s.valueEnd);
      edits.push({ file, line: s.line, kind: 'literal', key: s.key, from: s.raw, to: replacement });
      continue;
    }

    // if 形状：每个分支体都要是"已知上下文键的字面量"
    const branchSites = sites.filter((x) => x.keyStart === s.keyStart);
    const byValue = new Map(branchSites.map((b) => [b.own.classes.join(' '), b]));
    const allKnown = s.literals.length > 0 && s.literals.every((l) => byValue.has(normalizeClassString(l.value)));
    if (!allKnown) {
      todos.push({
        kind: 'dynamic-class',
        file,
        line: s.line,
        reason: '`class=if …` 里有分支不是"已知类的字面量"，未改写',
        snippet: s.raw.replace(/\s+/g, ' ').slice(0, 80),
      });
      continue;
    }
    // 只替换**分支体**里的字符串（条件里若出现字符串，不动它）
    let branchOut = '';
    let cursor = s.valueStart;
    for (const l of s.literals) {
      const key = byValue.get(normalizeClassString(l.value)).key;
      branchOut += out.slice(cursor, l.start) + `${helper}(${alias}.${fnName(key)}())`;
      cursor = l.end;
    }
    branchOut += out.slice(cursor, s.valueEnd);
    const replacement = 'attrs=' + branchOut;
    out = out.slice(0, s.keyStart) + replacement + out.slice(s.valueEnd);
    edits.push({
      file,
      line: s.line,
      kind: 'if',
      keys: s.literals.map((l) => byValue.get(normalizeClassString(l.value)).key),
      from: s.raw,
      to: replacement,
    });
  }

  return { text: out, edits, todos };
}

module.exports = {
  scanSites,
  extractSites,
  rewrite,
  parseClassValue,
  normalizeClassString,
  fnName,
  enclosingCallHasAttrs,
  matchClose,
  readString,
  labelOf,
  HTML_TAGS,
};
