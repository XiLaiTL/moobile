'use strict';
// dts-scan.js —— `.d.ts` 的**浅解析器**（花括号配对 + 顶层成员），刻意**不起 TypeScript**。
//
// 为什么不起 TypeScript（`PLAN.md` 决策点 12 / 设计稿 §5 T7 已量测）：
//   · 输入是第三方包发出来的 `.d.ts`，语法是**机器生成**的、比人写的手稿规整得多；
//   · 实测浅解析对 antd 6.6.4 能分类约 88% 的 prop，剩下 12% 有明确去处（标 unsupported 并点名）；
//   · 代价面很清楚：这一层只负责"**结构**"（谁 extends 谁、有哪些成员、成员的类型文本是什么），
//     **语义**（跳别名、拆 Omit、React 公共属性表）在 resolve.js 里，两者分开才好单测。
//
// ⚠️ 一条工程纪律：**解析器的产出必须能自证**。本文件带一个自检入口
//   （`node dts-scan.js <目录>`），它会把"解析到多少个 interface / 多少个成员 /
//   多少条被判成解析不了"打出来 —— 生成器如果悄悄少解析一半成员，这里会先红，
//   而不是等到生成物少了一堆 prop 才发现（那种错在生成的 MoonBit 代码里毫无线索）。
//
// 本文件不依赖任何外部包（仓库规矩：宿主包只有 0 个 runtime 依赖）。

const fs = require('fs');
const path = require('path');

/** 标识符判定（含 `$`，TypeScript 允许）。 */
const IDENT_RE = /^[A-Za-z_$][\w$]*$/;

/**
 * 把注释替换成**等长空格**。
 *
 * 为什么必须等长：后面要拿"剥离注释后的坐标"去**原始文本**里切 body ——
 * 于是注释里的 `{` / `}` 不会破坏配对，而字段的行内注释又原样保留。
 * 第一版直接删注释，导致切出来的 body 少了几个字符，报的错却是
 * "某个 interface 找不到" —— 差一点点就查错方向（记在 docs/FINDINGS.md）。
 */
function blankComments(text) {
  const out = text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
  return out;
}

/** 跳过字符串字面量（含模板串的 `${}`），返回结束引号的下标。 */
function skipString(src, i) {
  const quote = src[i];
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (quote === '`' && c === '$' && src[i + 1] === '{') {
      let depth = 1;
      i += 2;
      while (i < src.length && depth > 0) {
        const d = src[i];
        if (d === '{') depth++;
        else if (d === '}') depth--;
        else if (d === '"' || d === "'" || d === '`') {
          i = skipString(src, i);
          continue;
        }
        i++;
      }
      continue;
    }
    if (c === quote) return i;
    i++;
  }
  return src.length - 1;
}

/**
 * 从 `open`（必须是 `{`）匹配到对应的 `}`，返回下标；忽略字符串与注释（注释已被抹平）。
 */
function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * 从 `open`（必须是 `<`）匹配到对应的 `>`，返回下标。
 *
 * ⚠️ 必须把 `=>` 的 `>` 排除掉：`SelectProps<ValueType = any, OptionType extends BaseOptionType | DefaultOptionType = DefaultOptionType>`
 * 里没有箭头，但 `type F = <T>(x: T) => T` 这类泛型函数类型里有 —— 漏掉这层处理会让
 * 泛型参数表被切错，症状是"泛型参数当成了未解析类型"，一堆 prop 无端变成 unsupported。
 */
function matchAngle(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c === '=' && src[i + 1] === '>') {
      i++;
      continue;
    }
    if (c === '<') depth++;
    else if (c === '>') {
      depth--;
      if (depth === 0) return i;
    } else if (c === ';' || c === '{') {
      return -1; // 不是泛型参数表（例如比较运算），别把整段吃进去
    }
  }
  return -1;
}

/** 把 `<A, B extends C = D>` 拆成 ['A', 'B', 'C'...] —— 只要**名字**，约束与默认值丢掉。 */
function genericParamNames(text) {
  if (!text) return [];
  const names = [];
  let depth = 0;
  let buf = '';
  const parts = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '<' || c === '(' || c === '[' || c === '{') depth++;
    else if (c === '>' || c === ')' || c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
      continue;
    }
    buf += c;
  }
  if (buf.trim()) parts.push(buf);
  for (const p of parts) {
    // 'B extends C = D' → 'B'；只取第一个标识符
    const m = p.trim().match(/^([A-Za-z_$][\w$]*)/);
    if (m && IDENT_RE.test(m[1])) names.push(m[1]);
  }
  return names;
}

/** 取 `<...>` 原始文本（不含尖括号）。 */
function genericText(src, open) {
  const close = matchAngle(src, open);
  if (close < 0) return null;
  return { text: src.slice(open + 1, close), end: close };
}

const UTIL_WRAPPERS = new Set([
  'Omit', 'Pick', 'Partial', 'Required', 'Readonly', 'NonNullable',
  'Exclude', 'Extract', 'Record', 'Promise', 'Array', 'ReadonlyArray',
  'PropsWithChildren', 'PropsWithoutRef', 'RefAttributes', 'FunctionComponent',
  'LiteralUnion', 'GenerateSemantic', 'GetProps', 'GetProp', 'GetRef',
]);

/**
 * 解析一份 `.d.ts` 文本。
 *
 * 产出（全是**结构**，不做语义解析）：
 *   interfaces: [{ name, generics, extendsText, fields, indexSignatures, file }]
 *   aliases:    [{ name, generics, rhs, file }]
 *   imports:    [{ local, imported, spec, kind: 'named'|'namespace'|'default' }]
 *   exports:    [{ exported, local, spec, kind: 'value'|'type' }]  ← 组件清单的真相源
 */
function parseDts(text, file) {
  const src = blankComments(text);
  const original = text;
  const interfaces = [];
  const aliases = [];
  const values = [];
  const imports = [];
  const exports_ = [];

  // ── imports / exports ─────────────────────────────────────────────────────
  const importRe =
    /\bimport\s+(?:type\s+)?(?:(\*\s+as\s+([A-Za-z_$][\w$]*))|([A-Za-z_$][\w$]*))?\s*(?:,\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    const ns = m[2];
    const def = m[3];
    const braces = m[4];
    const spec = m[5];
    if (ns) imports.push({ local: ns, imported: '*', spec, kind: 'namespace', file });
    if (def) imports.push({ local: def, imported: 'default', spec, kind: 'default', file });
    if (braces) {
      for (const raw of braces.split(',')) {
        // ⚠️ 必须剥掉**内联的 `type` 修饰符**：`import Picker, { type PickerProps } from '…'`
        //    是 TypeScript 4.5+ 的常见写法（`@rc-component/picker` 就用它）。
        //    不剥的话这条 import 被整条丢掉 —— 症状是 `RcPickerProps` 查不到，
        //    表现为"DatePicker 只有 11 个 prop"（**少 prop 是静默的**，所以这类退化特别值得防）。
        const t = raw.trim().replace(/^type\s+/, '');
        if (!t) continue;
        const mm = t.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (!mm) continue;
        imports.push({
          local: mm[2] || mm[1],
          imported: mm[1],
          spec,
          kind: 'named',
          file,
        });
      }
    }
  }

  // `export { default as Button } from './button';` —— antd 的组件清单就长这样
  const reExportRe = /\bexport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  while ((m = reExportRe.exec(src))) {
    const isType = /^export\s+type\b/.test(m[0]);
    for (const raw of m[1].split(',')) {
      const t = raw.trim();
      if (!t) continue;
      const mm = t.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (!mm) continue;
      exports_.push({
        exported: mm[2] || mm[1],
        local: mm[1],
        spec: m[2],
        kind: isType ? 'type' : 'value',
        file,
      });
    }
  }
  // `export * from './X'` —— **必须认**：`@rc-component/image/es/index.d.ts` 就长这样
  // （`import Image from './Image'; export * from './Image'; export default Image;`）。
  // 不认的后果是那个包里所有名字都查不到，于是 antd 的 `RcImageProps` 解不开 ——
  // 表现为"Image 这一档只剩 3 个 prop"，而且**没有任何报错**（少 prop 是静默的）。
  const starReExportRe = /\bexport\s+\*\s+from\s*['"]([^'"]+)['"]/g;
  while ((m = starReExportRe.exec(src))) {
    exports_.push({ exported: '*', local: '*', spec: m[1], kind: 'type', file });
  }

  const localExportRe = /\bexport\s+(?:declare\s+)?(?:default\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = localExportRe.exec(src))) {
    exports_.push({ exported: m[1], local: m[1], spec: null, kind: 'value', file });
  }

  // ── interface ─────────────────────────────────────────────────────────────
  const ifaceRe = /\binterface\s+([A-Za-z_$][\w$]*)/g;
  while ((m = ifaceRe.exec(src))) {
    const name = m[1];
    let i = ifaceRe.lastIndex;
    let generics = [];
    if (src[i] === '<') {
      const g = genericText(src, i);
      if (g) {
        generics = genericParamNames(g.text);
        i = g.end + 1;
      }
    }
    // 跳过 extends 名单
    const rest = src.slice(i);
    const extMatch = rest.match(/^\s*(?:extends\s+([\s\S]*?))?(?=\s*\{)/);
    let extendsText = null;
    if (extMatch) {
      extendsText = extMatch[1] ? extMatch[1].trim() : null;
      i += extMatch[0].length;
    } else {
      continue; // 形态不认识（例如 interface 出现在类型位置），跳过而不是猜
    }
    // ⚠️ 必须再吃掉空白：上面的 lookahead 是**零宽**的，匹配到的 `m[0]` 停在
    //    `{` 之前的空格上。第一版就栽在这里 —— `interface X extends A, B {` 全部解析不出来，
    //    而 `interface X {`（没有 extends）恰好能过，于是症状是"**带继承的接口集体消失**"，
    //    正好是 antd 里最常用的那批（ButtonProps / CardProps…）。记在 docs/FINDINGS.md。
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] !== '{') continue;
    const close = matchBrace(src, i);
    if (close < 0) continue;
    const body = original.slice(i + 1, close);
    const members = parseMembers(body);
    interfaces.push({
      name,
      generics,
      extendsText,
      extendsList: splitTopLevel(extendsText || '', ','),
      fields: members.fields,
      indexSignatures: members.indexSignatures,
      skipped: members.skipped,
      file,
    });
    ifaceRe.lastIndex = close;
  }

  // ── type 别名 ─────────────────────────────────────────────────────────────
  const typeRe = /\btype\s+([A-Za-z_$][\w$]*)/g;
  while ((m = typeRe.exec(src))) {
    const name = m[1];
    let i = typeRe.lastIndex;
    let generics = [];
    if (src[i] === '<') {
      const g = genericText(src, i);
      if (g) {
        generics = genericParamNames(g.text);
        i = g.end + 1;
      }
    }
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] !== '=') continue;
    i++;
    const rhs = readTypeRhs(src, i);
    if (rhs == null) continue;
    // ⚠️ `readTypeRhs` 返回的是 `{text, end}`，这里**必须取 `.text`**。
    //    第一版直接把整个对象存进 `rhs`，于是每个 type 别名都被求值成字符串 "[object Object]"
    //    —— 而它以 `[` 开头、`]` 结尾，正好撞上"元组"那条判据，最终表现为
    //    **一大半 prop 被归成 json**（Button 的 type/color/variant/shape/size 全是）。
    //    形状对不上却"有结果"，是这一类 bug 最难查的地方。记在 docs/FINDINGS.md。
    aliases.push({ name, generics, rhs: rhs.text, file });
    typeRe.lastIndex = rhs.end;
  }

  // ── `const` 值声明 ─────────────────────────────────────────────────────────
  //
  // 为什么必须解析它们：antd 6.6.4 的枚举**几乎全**是 `(typeof X)[number]` 这个写法 ——
  //
  //     declare const _ButtonTypes: readonly ["default", "primary", "dashed", …];
  //     export type ButtonType = (typeof _ButtonTypes)[number];
  //
  // 不认它就等于**把枚举整体丢掉**：`type`/`shape`/`variant`/`color`/`status` 全变成
  // "解不开的类型"，而这正是设计稿 §5 T7 规则 2（"联合字面量算 str"）要保住的那批。
  // 实测：补上这一条之前，`ButtonType` 等 64 个 prop 落进 unsupported。
  const constRe = /\b(?:export\s+)?(?:declare\s+)?const\s+([A-Za-z_$][\w$]*)\s*([:=])/g;
  while ((m = constRe.exec(src))) {
    const name = m[1];
    let i = constRe.lastIndex;
    if (m[2] === ':') {
      const t = readUntilSemi(src, i);
      if (!t) continue;
      values.push({ name, type: t.text, init: null, file });
      const after = src.slice(t.end).match(/^\s*=\s*/);
      if (after) {
        const init = readUntilSemi(src, t.end + after[0].length);
        if (init) values[values.length - 1].init = init.text;
      }
      constRe.lastIndex = t.end;
    } else {
      const init = readUntilSemi(src, i);
      if (!init) continue;
      values.push({ name, type: null, init: init.text, file });
      constRe.lastIndex = init.end;
    }
  }

  return { file, interfaces, aliases, values, imports, exports: exports_ };
}

/** 从 `start` 读到**顶层** `;`（不做 readTypeRhs 的换行启发 —— 这里要的是原文）。 */
function readUntilSemi(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c === '{' || c === '(' || c === '[' || c === '<') depth++;
    else if (c === '}' || c === ')' || c === ']' || c === '>') depth--;
    else if (c === '=' && src[i + 1] === '>') i++;
    else if (c === ';' && depth === 0) {
      return { text: src.slice(start, i).trim(), end: i + 1 };
    }
  }
  return null;
}

/**
 * 读一段类型右值，停在**顶层** `;`。
 *
 * 为什么不能"读到行尾"：`type MergedHTMLAttributes = Omit<React.HTMLAttributes<HTMLElement> & …, 'type' | 'color'>;`
 * 是一行，但 `type X = { a: string; b: number }` 里的分号在花括号内部 ——
 * 按行尾读会把对象类型截断，按顶层分号读才对。
 */
function readTypeRhs(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c === '{' || c === '(' || c === '[' || c === '<') depth++;
    else if (c === '}' || c === ')' || c === ']' || c === '>') depth--;
    else if (c === '=' && src[i + 1] === '>') i++;
    else if (c === ';' && depth === 0) {
      return { text: src.slice(start, i).trim(), end: i + 1 };
    } else if (c === '\n' && depth === 0) {
      // 别名不带分号（某些 .d.ts 这么写）
      const text = src.slice(start, i).trim();
      if (text && !/[|&,<=(]$/.test(text)) return { text, end: i + 1 };
    }
  }
  return null;
}

/** 按顶层分隔符切分（忽略括号/尖括号/字符串内部）。 */
function splitTopLevel(text, sep) {
  const out = [];
  let depth = 0;
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const j = skipString(text, i);
      buf += text.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === '{' || c === '(' || c === '[' || c === '<') depth++;
    else if (c === '}' || c === ')' || c === ']' || c === '>') depth--;
    else if (c === '=' && text[i + 1] === '>') {
      buf += '=>';
      i++;
      continue;
    }
    if (c === sep && depth === 0) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += c;
  }
  out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** 从 doc 注释里取标注（@deprecated / @private / @internal）。 */
function readDocTags(doc) {
  const tags = [];
  if (!doc) return tags;
  const find = (re) => re.test(doc);
  if (find(/@deprecated\b/)) tags.push('deprecated');
  if (find(/@private\b/)) tags.push('private');
  if (find(/@internal\b/)) tags.push('internal');
  return tags;
}

/**
 * 解析 interface body 里的成员。
 *
 * 只认三类，其余**显式记进 `skipped`**（含原文片段）——
 * "不认识的成员"必须看得见：静默丢字段会让生成物少一批 prop，
 * 而那种错在生成的 MoonBit 代码里完全没有线索（少一个可选参数，编译器不会说话）。
 */
function parseMembers(body) {
  const fields = [];
  const indexSignatures = [];
  const skipped = [];

  // ① 先把 doc 注释摘出来，换成原位标记，于是后面可以按"语句"扫描。
  const docs = [];
  const marked = body.replace(/\/\*\*([\s\S]*?)\*\//g, (_all, inner) => {
    docs.push(inner);
    return `\u0000DOC${docs.length - 1}\u0000`;
  });

  const statements = splitMembers(marked);
  for (const raw of statements) {
    let text = raw.trim();
    if (!text) continue;
    let doc = '';
    const docM = text.match(/\u0000DOC(\d+)\u0000/);
    if (docM) {
      doc = docs[Number(docM[1])];
      text = text.replace(/\u0000DOC\d+\u0000/g, '').trim();
      if (!text) continue;
    }
    // 索引签名 / 调用签名 / 构造签名 —— 不是具名 prop
    if (/^\[/.test(text)) {
      indexSignatures.push(text.replace(/;$/, '').trim());
      continue;
    }
    if (/^\(/.test(text) || /^new\s*\(/.test(text)) {
      skipped.push({ reason: 'call-signature', text });
      continue;
    }
    // 方法成员：`onClick?(e: X): void`
    const method = text.match(
      /^(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\??)\s*\(([\s\S]*?)\)\s*:\s*([\s\S]+)$/,
    );
    if (method) {
      fields.push({
        name: method[1],
        optional: method[2] === '?',
        type: `(${method[3].trim()}) => ${method[4].trim().replace(/;$/, '')}`,
        method: true,
        doc,
        tags: readDocTags(doc),
      });
      continue;
    }
    // 属性成员：`readonly type?: ButtonType`
    const prop = text.match(
      /^(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\??)\s*:\s*([\s\S]+)$/,
    );
    if (prop) {
      fields.push({
        name: prop[1],
        optional: prop[2] === '?',
        type: prop[3].trim().replace(/;$/, '').trim(),
        method: false,
        doc,
        tags: readDocTags(doc),
      });
      continue;
    }
    skipped.push({ reason: 'unparsed-member', text });
  }
  return { fields, indexSignatures, skipped };
}

/**
 * 把 body 切成"成员语句"：顶层 `;` 为界；另外在没有分号时，
 * 遇到**看起来已经完整**的换行也断开（TS 允许用换行当分隔符）。
 */
function splitMembers(text) {
  const out = [];
  let depth = 0;
  let buf = '';
  const flushable = (s) => {
    const t = s.trim();
    if (!t) return false;
    if (/[|&,<=(]$/.test(t)) return false;
    return t.includes(':') || t.includes(')');
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const j = skipString(text, i);
      buf += text.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === '{' || c === '(' || c === '[' || c === '<') depth++;
    else if (c === '}' || c === ')' || c === ']' || c === '>') depth--;
    else if (c === '=' && text[i + 1] === '>') {
      buf += '=>';
      i++;
      continue;
    }
    if (c === ';' && depth === 0) {
      out.push(buf);
      buf = '';
      continue;
    }
    if (c === '\n' && depth === 0 && flushable(buf)) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** 递归列文件。 */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      walk(p, out);
    } else if (e.name.endsWith('.d.ts')) {
      out.push(p);
    }
  }
  return out;
}

// ── 自检入口：`node dts-scan.js <目录>` ────────────────────────────────────────
// 它的用途不是"给人看报表"，而是**让解析器的退化看得见**：
// 解析到的 interface/成员数如果突然掉一半，这里先红，而不是生成物少一堆 prop。
if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('用法：node dts-scan.js <含 .d.ts 的目录>');
    process.exit(2);
  }
  const files = walk(dir);
  let ifaces = 0;
  let fields = 0;
  let aliases = 0;
  let indexSigs = 0;
  const skipped = new Map();
  const t0 = Date.now();
  for (const f of files) {
    const parsed = parseDts(fs.readFileSync(f, 'utf8'), f);
    ifaces += parsed.interfaces.length;
    aliases += parsed.aliases.length;
    for (const it of parsed.interfaces) {
      fields += it.fields.length;
      indexSigs += it.indexSignatures.length;
      for (const s of it.skipped) skipped.set(s.reason, (skipped.get(s.reason) || 0) + 1);
    }
  }
  console.log(`文件 ${files.length} 个，解析耗时 ${Date.now() - t0}ms`);
  console.log(`interface ${ifaces} 个｜成员 ${fields} 个｜type 别名 ${aliases} 个｜索引签名 ${indexSigs} 个`);
  for (const [r, n] of skipped) console.log(`  跳过（${r}）：${n}`);
}

module.exports = {
  parseDts,
  walk,
  readUntilSemi,
  splitTopLevel,
  blankComments,
  matchBrace,
  matchAngle,
  genericParamNames,
  genericText,
  readTypeRhs,
  UTIL_WRAPPERS,
  IDENT_RE,
};
