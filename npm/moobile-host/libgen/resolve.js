'use strict';
// resolve.js —— 把 `.d.ts` 里的**类型文本**解析成"这个 prop 是什么"。
//
// 分工：`dts-scan.js` 只认**结构**（谁 extends 谁、成员叫什么、类型文本是什么），
// 本文件负责**语义**：跳别名、拆 `Omit` / `Partial` 这类工具类型、把
// `React.HTMLAttributes<HTMLElement>` 展开成一张 prop 表、以及跨包（`@rc-component/*`）解析。
//
// 三条实测得来的规矩（写在设计稿 §5 T7 的"取样时立刻暴露的 3 条规则"）之后，
// 这里是它们的**落地点**：
//   ① 组件清单的真相源是**导出名**，不是"哪个接口字段多" → `manifest.js` 按导出名找 `XProps`；
//   ② 联合字面量算 `str`（枚举），**不是** `json` → `classify()` 里 union 全是字面量时的判据；
//   ③ `_` 前缀 / `@private` 的字段跳过 → `manifest.js` 过滤（本文件保留标签，不替它决定）。
//
// ⚠️ 解析深度是**有界**的：任何一环超过 12 跳或撞上环，就返回 `{k:'unresolved'}`，
//    并在报告里点名。**"解析不了"必须是一个看得见的结果**，不能变成"少了一个 prop"
//    —— 少一个可选参数，编译器一句话都不会说（这是本仓库反复踩的那类坑）。

const fs = require('fs');
const path = require('path');
const { parseDts, walk, splitTopLevel, IDENT_RE } = require('./dts-scan');
const { reactAttrsFor, isReactAttrsName } = require('./react-attrs');

const MAX_DEPTH = 12;

/** 已知的 React 类型面（没有 `@types/react` 时也认得的名字）。 */
const REACT_KNOWN = new Set([
  'ReactNode', 'ReactElement', 'ReactChild', 'ReactFragment', 'ReactPortal',
  'CSSProperties', 'Key', 'Ref', 'RefObject', 'MutableRefObject', 'ElementType',
  'HTMLAttributes', 'ButtonHTMLAttributes', 'AnchorHTMLAttributes', 'InputHTMLAttributes',
  'TextareaHTMLAttributes', 'SelectHTMLAttributes', 'ImgHTMLAttributes', 'FormHTMLAttributes',
  'MediaHTMLAttributes', 'AllHTMLAttributes', 'AriaAttributes', 'DOMAttributes',
  'HTMLProps', 'ClassAttributes', 'RefAttributes', 'PropsWithChildren', 'PropsWithoutRef',
  'SyntheticEvent', 'MouseEvent', 'KeyboardEvent', 'ChangeEvent', 'FocusEvent', 'FormEvent',
  'PointerEvent', 'TouchEvent', 'DragEvent', 'ClipboardEvent', 'CompositionEvent',
  'UIEvent', 'WheelEvent', 'AnimationEvent', 'TransitionEvent', 'InputEvent', 'Event',
  'MouseEventHandler', 'KeyboardEventHandler', 'ChangeEventHandler', 'FocusEventHandler',
  'FormEventHandler', 'PointerEventHandler', 'TouchEventHandler', 'DragEventHandler',
  'ClipboardEventHandler', 'CompositionEventHandler', 'UIEventHandler', 'WheelEventHandler',
  'AnimationEventHandler', 'TransitionEventHandler', 'InputEventHandler',
  'SyntheticEventHandler', 'EventHandler', 'ComponentType', 'FC', 'FunctionComponent',
]);

/**
 * **React 属性面**的接口名。
 *
 * 为什么需要这个正则：`React.HTMLAttributes<HTMLElement>` 这类"公共属性面"是**一大片**
 * （光 aria-* 就 50 个、事件 50 个）。它们对"这个组件能不能用"没信息量 ——
 * 每个转发 DOM props 的组件都长一样。所以清单里给它们打 `surface: 'react'`，
 * 生成 DSL 时**按一张收窄的白名单投影**（见 emit-moonbit.js），
 * 而 manifest 里**一个都不删**（它是事实记录，不是用法建议）。
 */
const REACT_SURFACE_IFACE =
  /^(All)?HTMLAttributes$|^(Anchor|Button|Input|Textarea|Select|Img|Form|Media|HTML)HTMLAttributes$|^AriaAttributes$|^DOMAttributes$|^HTMLProps$/;

/** 工具类型：要**拆**而不是当成命名类型去找。 */
const WRAPPERS = new Set([
  'Omit', 'Pick', 'Partial', 'Required', 'Readonly', 'NonNullable', 'Exclude', 'Extract',
  'Record', 'PropsWithChildren', 'PropsWithoutRef', 'RefAttributes', 'LiteralUnion',
  'ComponentProps', 'ComponentPropsWithoutRef', 'ComponentPropsWithRef',
  'GenerateSemantic', 'GetProps', 'GetProp', 'GetRef', 'Array', 'ReadonlyArray',
  // React 的"组件类型"包装：**透明**（取第一个实参就是 props）。
  // 为什么必须认：antd 有些组件的 `children` 不在 `XxxProps` 里，而是**加在组件类型上** ——
  //     declare const Splitter: React.ForwardRefExoticComponent<
  //         SplitterProps & { children?: React.ReactNode | undefined } & React.RefAttributes<…>>;
  // 不认这一层，`Splitter` 就会得出"不能有 children"的错误结论（而它其实**必须**有：
  // Splitter 的内容就是它的若干 Panel）。
  'ForwardRefExoticComponent', 'ForwardRefRenderFunction', 'NamedExoticComponent',
  'MemoExoticComponent', 'ExoticComponent', 'ComponentType', 'FunctionComponent', 'FC',
]);

/** 解出来是"一个值对象/回调"的名字（`@rc-component` 里最常见的形态）。 */
/**
 * 模块的默认导出标识符（`declare const Rate: …; export default Rate;` → `Rate`）。
 *
 * 为什么要它：`ComponentPropsWithoutRef<typeof RcRate>` 里的 props 类型名，按 React 生态的
 * 约定等于**默认导出名 + `Props`**（`RcRate` → `RateProps`）。拿不到名字就只能标 unresolved。
 * 实现上重新读一次文件（解析结果里没留原文）—— 这条路径只在少数类型上走到，读一次很便宜。
 */
function defaultExportIdent(parsed) {
  try {
    const text = fs.readFileSync(parsed.file, 'utf8');
    const m = text.match(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** `@scope/name/sub/path` → 包名与子路径分开。 */
function splitSpec(spec) {
  const parts = spec.split('/');
  if (spec.startsWith('@')) {
    const pkgName = parts.slice(0, 2).join('/');
    return { pkgName, sub: parts.slice(2).join('/') };
  }
  return { pkgName: parts[0], sub: parts.slice(1).join('/') };
}

function isPrimitiveName(n) {
  return ['string', 'number', 'boolean', 'any', 'unknown', 'void', 'never', 'object',
    'symbol', 'bigint', 'null', 'undefined', 'this', 'true', 'false'].includes(n);
}

function stripOuterParens(text) {
  let t = text.trim();
  while (t.startsWith('(') && t.endsWith(')')) {
    let depth = 0;
    let ok = true;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') depth++;
      else if (t[i] === ')') {
        depth--;
        if (depth === 0 && i !== t.length - 1) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) break;
    t = t.slice(1, -1).trim();
  }
  return t;
}

class Resolver {
  /**
   * @param {object} opts
   * @param {string} opts.libRoot   组件库的包根（含 `es/` 或 `lib/` 或直接是根）
   * @param {string[]} opts.files   要载入的 .d.ts 绝对路径
   * @param {string} [opts.entry]   入口 .d.ts（组件清单的真相源）
   */
  constructor({ libRoot, files, entry }) {
    this.libRoot = libRoot;
    this.entry = entry || null;
    this.files = new Map(); // absPath -> parsed
    this.byName = new Map(); // name -> [{kind, decl, file}]
    this.byValueName = new Map(); // 同上，但索引的是 `const` 值声明（`typeof X` 要用）
    this.moduleCache = new Map(); // spec|fromDir -> parsed[] | null
    this.stats = {
      specResolved: 0,
      specFailed: [],
      unresolvedTypes: new Map(),
      symbolLookups: 0,
    };
    for (const f of files) this.#loadFile(f);
  }

  #loadFile(abs) {
    if (this.files.has(abs)) return this.files.get(abs);
    let text;
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch {
      return null;
    }
    const parsed = parseDts(text, abs);
    this.files.set(abs, parsed);
    const push = (kind, decl) => {
      const list = this.byName.get(decl.name) || [];
      list.push({ kind, decl, file: abs });
      this.byName.set(decl.name, list);
    };
    for (const it of parsed.interfaces) push('interface', it);
    for (const a of parsed.aliases) push('alias', a);
    for (const v of parsed.values || []) {
      const list = this.byValueName.get(v.name) || [];
      list.push({ kind: 'value', decl: v, file: abs });
      this.byValueName.set(v.name, list);
    }
    return parsed;
  }

  // ── 模块解析 ───────────────────────────────────────────────────────────────

  /**
   * 把 import specifier 解析成 `.d.ts` 文件列表。
   *
   * 三类都要处理（antd 的继承链三种都用到了）：
   *   · 相对路径（`./Button`）—— 同包内；
   *   · 裸包名（`@rc-component/select`）—— 跨包，antd 的 props 大量 extends 它们；
   *   · `'react'` —— TypeScript 会映射到 `@types/react`（**本项目不装它也能跑**，
   *     那时返回 null，由 React 公共属性表兜底）。
   */
  resolveSpec(spec, fromFile) {
    const key = `${spec}|${path.dirname(fromFile)}`;
    if (this.moduleCache.has(key)) return this.moduleCache.get(key);
    let out = this.#resolveSpecUncached(spec, fromFile);
    this.moduleCache.set(key, out);
    if (out) this.stats.specResolved++;
    else if (!this.stats.specFailed.includes(spec)) this.stats.specFailed.push(spec);
    return out;
  }

  #resolveSpecUncached(spec, fromFile) {
    const dir = path.dirname(fromFile);
    if (spec.startsWith('.')) {
      const base = path.resolve(dir, spec);
      const cands = [
        `${base}.d.ts`,
        path.join(base, 'index.d.ts'),
        path.join(base, 'index.d.mts'),
      ];
      for (const c of cands) if (fs.existsSync(c) && fs.statSync(c).isFile()) return [this.#loadFile(c)];
      // 目录形态：把目录下所有 .d.ts 都收进来（antd 的 `<comp>/index.d.ts` 会 re-export 兄弟文件）
      if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
        return walk(base).map((f) => this.#loadFile(f));
      }
      return null;
    }
    // 裸包名（可能带子路径：`@rc-component/picker/interface`、`antd/es/button`）
    //
    // 子路径这一档是**必须**的：antd 的 props 继承链大量写成
    // `import type { PickerProps } from '@rc-component/picker/interface'`，
    // 而这类包的 `types` 只指到根 `index.d.ts`，子路径靠 `package.json` 的 `exports`
    // 映射（实测这套 monorepo 包都写了 exports）。第一版不认子路径也不认 exports，
    // 症状是 `PickerProps` 整条链断掉 —— 表现为"DatePicker 只有 11 个 prop"，
    // 而不是报错（少 prop 是静默的，所以这类退化特别值得防）。
    for (const root of this.#nodeModulesRoots(dir)) {
      const { pkgName, sub } = splitSpec(spec);
      const pkgDir = path.join(root, ...pkgName.split('/'));
      const pkgJson = path.join(pkgDir, 'package.json');
      if (fs.existsSync(pkgJson)) {
        let meta = {};
        try {
          meta = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
        } catch {
          /* package.json 读不动就当没有 types 字段 */
        }
        if (sub) {
          const hit = this.#resolveSubpath(pkgDir, meta, sub);
          if (hit) return hit;
        }
        const types = meta.types || meta.typings;
        const cands = [];
        if (!sub && types) cands.push(path.join(pkgDir, types));
        if (!sub) cands.push(path.join(pkgDir, 'index.d.ts'));
        for (const c of cands) if (fs.existsSync(c) && fs.statSync(c).isFile()) return [this.#loadFile(c)];
        // 兜底：整包读进来（子路径认不出时，至少让"按名字查"能查到）。
        // 代价是同时读进 es/ 与 lib/ 两份 —— 两份内容等价，解析结果不受影响。
        if (fs.existsSync(pkgDir)) return walk(pkgDir).map((f) => this.#loadFile(f));
      }
      const atTypes = path.join(root, '@types', ...spec.split('/'));
      const atIndex = path.join(atTypes, 'index.d.ts');
      if (fs.existsSync(atIndex)) return [this.#loadFile(atIndex)];
    }
    return null;
  }

  /** 子路径解析：先 `exports` 映射（含 `*` 通配），再按 `types` 所在目录探测。 */
  #resolveSubpath(pkgDir, meta, sub) {
    const ex = meta.exports;
    const want = `./${sub}`;
    const pick = (v) => {
      if (!v) return null;
      if (typeof v === 'string') return v;
      return v.types || (v.import && v.import.types) || (v.require && v.require.types) || null;
    };
    if (ex && typeof ex === 'object') {
      const direct = pick(ex[want]);
      if (direct) {
        const p = path.join(pkgDir, direct);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return [this.#loadFile(p)];
      }
      for (const [k, v] of Object.entries(ex)) {
        if (!k.includes('*') || !k.startsWith('./')) continue;
        const [pre, post] = k.split('*');
        if (!want.startsWith(pre) || (post && !want.endsWith(post))) continue;
        const star = want.slice(pre.length, post ? want.length - post.length : want.length);
        const t = pick(v);
        if (!t) continue;
        const p = path.join(pkgDir, t.replace('*', star));
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return [this.#loadFile(p)];
      }
    }
    const types = meta.types || meta.typings;
    const bases = [];
    if (types) bases.push(path.dirname(path.join(pkgDir, types)));
    bases.push(pkgDir, path.join(pkgDir, 'es'), path.join(pkgDir, 'lib'));
    for (const base of bases) {
      for (const cand of [path.join(base, `${sub}.d.ts`), path.join(base, sub, 'index.d.ts')]) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return [this.#loadFile(cand)];
      }
    }
    return null;
  }

  #nodeModulesRoots(fromDir) {
    const out = [];
    let cur = fromDir;
    for (let i = 0; i < 8; i++) {
      const nm = path.join(cur, 'node_modules');
      if (fs.existsSync(nm)) out.push(nm);
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    return out;
  }

  // ── 符号查找 ───────────────────────────────────────────────────────────────

  /**
   * 找 `name` 的定义。顺序**固定**（这条顺序就是"为什么同一个名字不会解错"的机制）：
   *   ① 本文件的声明 → ② 本文件的 import → ③ 全库唯一同名 → ④ 全库第一个同名（并记歧义）。
   */
  lookup(name, file, depth = 0, opts = {}) {
    this.stats.symbolLookups++;
    const own = this.files.get(file);
    if (own) {
      const hit = this.#inParsed(own, name);
      if (hit) return hit;
      for (const imp of own.imports) {
        const mods = this.resolveSpec(imp.spec, file);
        if (!mods) continue;
        for (const mod of mods) {
          if (!mod) continue;
          if (imp.kind === 'namespace') {
            const hit2 = this.#inParsed(mod, name);
            if (hit2) return hit2;
          } else if (imp.imported === name || imp.local === name) {
            const target = imp.kind === 'default' ? 'default' : imp.imported;
            const hit2 = this.#inParsed(mod, target) || (imp.kind === 'default' ? this.#inParsed(mod, name) : null);
            if (hit2) return hit2;
          }
        }
      }
    }
    // `scoped`：**只在本文件与它的 import 里找**，不许退到全库索引。
    // 为什么需要它：全库索引在"同名接口有多份"时只能猜（`ItemProps` 在 antd 里就有好几份），
    // 而猜错的代价是**解到另一个组件的 props** —— 清单看起来合理，但内容是错的，
    // 这种错在生成物里完全没有线索。凡是"本来就知道它应该来自哪个模块"的地方，都用 scoped。
    if (opts.scoped) return null;

    const all = this.byName.get(name) || [];
    if (all.length === 1) return all[0];
    if (all.length > 1) {
      // 同一个名字在多处声明：优先 interface，其次文件路径里含组件名的
      const ifaces = all.filter((x) => x.kind === 'interface');
      if (ifaces.length === 1) return ifaces[0];
      if (ifaces.length > 1) {
        if (depth === 0) {
          const key = `ambiguous:${name}`;
          this.stats.unresolvedTypes.set(key, (this.stats.unresolvedTypes.get(key) || 0) + 1);
        }
        return ifaces[0];
      }
      return all[0];
    }
    return null;
  }

  #inParsed(parsed, name, seen = new Set()) {
    if (!parsed) return null;
    const guard = `${parsed.file}|${name}`;
    if (seen.has(guard)) return null;
    seen.add(guard);
    // 本文件里直接声明的
    const it = parsed.interfaces.find((x) => x.name === name);
    if (it) return { kind: 'interface', decl: it, file: parsed.file };
    const al = parsed.aliases.find((x) => x.name === name);
    if (al) return { kind: 'alias', decl: al, file: parsed.file };
    // `export * from './X'` 全部转发（**没有通配名单语法**，只能逐个模块下去找）
    for (const ex of parsed.exports) {
      if (ex.exported !== '*' || !ex.spec) continue;
      const mods = this.resolveSpec(ex.spec, parsed.file);
      if (!mods) continue;
      for (const mod of mods) {
        const hit = mod && this.#inParsed(mod, name, seen);
        if (hit) return hit;
      }
    }
    // `export * from './X'`：**全部转发**。没有通配名单语法可用，只能逐个模块下去找。
    // 缺了这一档，`@rc-component/image` 这类包（入口只有 `export * from './Image'`）
    // 里所有名字都查不到 —— 而症状是"那个组件的 prop 少了一大半"，不是报错。
    for (const ex of parsed.exports) {
      if (ex.exported !== '*' || !ex.spec) continue;
      const mods = this.resolveSpec(ex.spec, parsed.file);
      if (!mods) continue;
      for (const mod of mods) {
        const hit = mod && this.#inParsed(mod, name, seen);
        if (hit) return hit;
      }
    }
    // 本文件 re-export 的（`export { default as Button } from './button'`）
    const re = parsed.exports.find((x) => x.exported === name || x.local === name);
    if (re && re.spec) {
      const mods = this.resolveSpec(re.spec, parsed.file);
      if (mods) {
        for (const mod of mods) {
          if (!mod) continue;
          const target = re.kind === 'value' && re.local === 'default' ? 'default' : re.local;
          const hit = this.#inParsed(mod, target, seen) || this.#inParsed(mod, name, seen);
          if (hit) return hit;
        }
      }
    }
    // ⚠️ **光 import 进来再 `export type { X }`（不带 from）** 也是 re-export ——
    //    `@rc-component/select/es/index.d.ts` 正是这个写法：
    //        import type { SelectProps } from './Select';
    //        export type { SelectProps, BaseSelectProps, … };
    //    第一版只认带 `from` 的 `export {…} from '…'`，于是这些名字"明明在入口导出里"却查不到，
    //    症状是 `RcSelectProps` / `RcTableProps` 整条继承链断掉（antd 的 props 大量 extends 它们）。
    for (const imp of parsed.imports) {
      if (imp.kind === 'namespace') continue;
      if (imp.local !== name) continue;
      const mods = this.resolveSpec(imp.spec, parsed.file);
      if (!mods) continue;
      for (const mod of mods) {
        const hit = mod && this.#inParsed(mod, imp.imported === 'default' ? name : imp.imported, seen);
        if (hit) return hit;
      }
    }
    return null;
  }

  // ── 类型求值 ───────────────────────────────────────────────────────────────

  /**
   * 求值一段类型文本。
   *
   * @param {string} text
   * @param {{file:string, subs?:Map<string,string>, depth?:number, seen?:Set<string>}} ctx
   */
  evalType(text, ctx) {
    const depth = ctx.depth || 0;
    if (depth > MAX_DEPTH) return { k: 'unresolved', text, why: 'depth' };
    const raw = String(text || '').trim().replace(/;$/, '').trim();
    if (!raw) return { k: 'unresolved', text: raw, why: 'empty' };

    // 泛型实参替换（文本级）：`SelectProps<ValueType, OptionType>` 里的 ValueType 换成实参
    const subs = ctx.subs || new Map();
    const subbed = subs.size ? substituteIdents(raw, subs) : raw;

    let t = stripOuterParens(subbed);
    t = t.replace(/^readonly\s+/, '').trim();

    // 联合
    const unionParts = splitTopLevel(t, '|');
    if (unionParts.length > 1) {
      return {
        k: 'union',
        parts: unionParts.map((p) => this.evalType(p, { ...ctx, depth: depth + 1 })),
        text: t,
      };
    }
    // 交叉
    const interParts = splitTopLevel(t, '&');
    if (interParts.length > 1) {
      return {
        k: 'inter',
        parts: interParts.map((p) => this.evalType(p, { ...ctx, depth: depth + 1 })),
        text: t,
      };
    }

    // 函数类型：`(a: X, b?: Y) => R` / `<T>(...) => R` / `new (...) => R`
    const fn = matchFunctionType(t);
    if (fn) {
      return {
        k: 'fn',
        params: fn.params,
        ret: fn.ret,
        ctor: fn.ctor,
        text: t,
      };
    }

    // 取键 / typeof / import() —— 一律 unsupported（要真求值就得上编译器，而我们**不**上）
    // 例外见下：`typeof X` 与 `T['k']` 这两种**结构上可求值**的，必须支持 ——
    // antd 6.6.4 的枚举全是 `(typeof _X)[number]`，不支持就等于把枚举整体丢掉。
    const typeofIdx = t.match(/^\(\s*typeof\s+([A-Za-z_$][\w$.]*)\s*\)\s*\[([^\]]+)\]$/);
    if (typeofIdx) {
      return this.#indexAccess(
        this.#typeofValue(typeofIdx[1], ctx, depth),
        typeofIdx[2],
        ctx,
        depth,
        t,
      );
    }
    const bareTypeof = t.match(/^typeof\s+([A-Za-z_$][\w$.]*)$/);
    if (bareTypeof) return this.#typeofValue(bareTypeof[1], ctx, depth);

    const indexed = t.match(/^([A-Za-z_$][\w$.]*(?:\s*<[\s\S]*>)?)\s*\[([^\]]+)\]$/);
    if (indexed && !/\[\]$/.test(t)) {
      const base = this.evalType(indexed[1], { ...ctx, depth: depth + 1 });
      return this.#indexAccess(base, indexed[2], ctx, depth, t);
    }

    if (/^(keyof|infer|unique\s+symbol)\b/.test(t) || /^import\s*\(/.test(t)) {
      return { k: 'unresolved', text: t, why: 'operator-type' };
    }

    // 数组后缀
    const arr = t.match(/^([\s\S]+)\[\]$/);
    if (arr) return { k: 'array', elem: this.evalType(arr[1], { ...ctx, depth: depth + 1 }), text: t };

    // 元组
    if (t.startsWith('[') && t.endsWith(']')) {
      return {
        k: 'tuple',
        items: splitTopLevel(t.slice(1, -1), ',').map((x) => this.evalType(x, { ...ctx, depth: depth + 1 })),
        text: t,
      };
    }

    // 对象字面量类型
    if (t.startsWith('{')) {
      const fields = parseInlineObject(t);
      return { k: 'fields', fields, origins: ['inline'], text: t };
    }

    // 字面量
    if (/^'[^']*'$/.test(t) || /^"[^"]*"$/.test(t)) {
      return { k: 'lit', value: t.slice(1, -1), text: t };
    }
    if (/^-?\d+(\.\d+)?$/.test(t)) return { k: 'numlit', value: Number(t), text: t };

    // 命名类型（可带泛型实参、可带命名空间前缀）
    const ref = matchTypeRef(t);
    if (ref) return this.#evalRef(ref, ctx, depth, t);

    return { k: 'unresolved', text: t, why: 'shape' };
  }

  #evalRef(ref, ctx, depth, text) {
    const { qualifier, name, args } = ref;
    if (isPrimitiveName(name) && !qualifier) return { k: 'prim', name, text };
    if (qualifier && qualifier !== 'React' && qualifier !== 'globalThis') {
      // 命名空间限定（`Antd.MenuProps` 之类）—— 不猜
      return { k: 'unresolved', text, why: `namespace:${qualifier}` };
    }

    const genericSet = ctx.generics || new Set();
    if (!qualifier && genericSet.has(name)) {
      return { k: 'generic', name, text };
    }

    // React 的已知类型（`@types/react` 缺席时的兜底入口）
    if (qualifier === 'React' || (!qualifier && REACT_KNOWN.has(name))) {
      if (isReactAttrsName(name)) {
        const fields = reactAttrsFor(name).map((f) => ({ ...f, surface: 'react' }));
        return { k: 'fields', fields, origins: [`react-table:${name}`], text, reactAttrs: name };
      }
      if (name.endsWith('EventHandler') || /Event$/.test(name)) {
        return { k: 'react', name, text, family: familyOf(name) };
      }
      if (['ReactNode', 'ReactElement', 'ReactChild', 'ReactFragment', 'ReactPortal'].includes(name)) {
        return { k: 'react', name: 'ReactNode', text };
      }
      if (name === 'CSSProperties') return { k: 'react', name: 'CSSProperties', text };
      if (name === 'Key') return { k: 'prim', name: 'string', text };
    }

    // 工具类型：拆
    if (WRAPPERS.has(name)) {
      const inner = args.map((a, i) => ({ text: a, desc: this.evalType(a, { ...ctx, depth: depth + 1 }) }));
      switch (name) {
        case 'Omit': {
          const base = inner[0] ? inner[0].desc : { k: 'unresolved', text: '', why: 'omit-base' };
          const keys = inner[1] ? literalKeys(inner[1].text) : [];
          return omitKeys(this.#materializeFields(base, ctx, depth + 1), keys, text);
        }
        case 'Pick': {
          const base = inner[0] ? inner[0].desc : { k: 'unresolved', text: '', why: 'pick-base' };
          const keys = inner[1] ? literalKeys(inner[1].text) : [];
          return pickKeys(this.#materializeFields(base, ctx, depth + 1), keys, text);
        }
        case 'Partial': {
          const base = inner[0] ? inner[0].desc : null;
          const f = this.#materializeFields(base, ctx, depth + 1);
          if (f.k !== 'fields') return f;
          return { k: 'fields', fields: f.fields.map((x) => ({ ...x, optional: true })), origins: [...f.origins, 'Partial'], text };
        }
        case 'Required': {
          const base = inner[0] ? inner[0].desc : null;
          const f = this.#materializeFields(base, ctx, depth + 1);
          if (f.k !== 'fields') return f;
          return { k: 'fields', fields: f.fields.map((x) => ({ ...x, optional: false })), origins: [...f.origins, 'Required'], text };
        }
        case 'Readonly': {
          const base = inner[0] ? inner[0].desc : null;
          const f = this.#materializeFields(base, ctx, depth + 1);
          return f.k === 'fields' ? { ...f, origins: [...f.origins, 'Readonly'], text } : f;
        }
        case 'NonNullable': {
          const base = inner[0] ? inner[0].desc : null;
          return base ? { ...base, text: text } : { k: 'unresolved', text, why: 'nonnullable' };
        }
        case 'LiteralUnion': {
          // antd 自己的：`LiteralUnion<T, U>` = T | (U & {}) —— 取第一个实参的分类即可
          return inner[0] ? inner[0].desc : { k: 'unresolved', text, why: 'literal-union' };
        }
        case 'Record': {
          return { k: 'object', text, why: 'record' };
        }
        // `React.ComponentPropsWithoutRef<typeof X>` —— 从**组件类型**反推 props。
        // antd 里很常见（`type RcRateProps = React.ComponentPropsWithoutRef<typeof RcRate>`），
        // 而 `typeof X` 本身没法求值。可解的那一半：`X` 从哪个包 import → 去那个包里找
        // `${X}Props`（React 生态的命名约定）。
        case 'ComponentProps':
        case 'ComponentPropsWithoutRef':
        case 'ComponentPropsWithRef': {
          const argText = inner[0] ? inner[0].text : '';
          const m2 = String(argText).match(/^\s*typeof\s+([A-Za-z_$][\w$]*)\s*$/);
          if (!m2) return { k: 'unresolved', text, why: `wrapper:${name}` };
          const hit = this.#propsOfComponentIdent(m2[1], ctx, depth);
          return hit || { k: 'unresolved', text, why: `component-props:${m2[1]}` };
        }
        case 'ForwardRefExoticComponent':
        case 'ForwardRefRenderFunction':
        case 'NamedExoticComponent':
        case 'MemoExoticComponent':
        case 'ExoticComponent':
        case 'ComponentType':
        case 'FunctionComponent':
        case 'FC': {
          // 透明包装：props 就是第一个实参
          return inner[0] ? inner[0].desc : { k: 'unresolved', text, why: `wrapper:${name}` };
        }
        case 'Array':
        case 'ReadonlyArray': {
          return { k: 'array', elem: inner[0] ? inner[0].desc : null, text };
        }
        default:
          return { k: 'unresolved', text, why: `wrapper:${name}` };
      }
    }

    // 真类型解析
    const sym = this.lookup(name, ctx.file, depth);
    if (!sym) {
      const why = `missing:${qualifier ? qualifier + '.' : ''}${name}`;
      this.stats.unresolvedTypes.set(why, (this.stats.unresolvedTypes.get(why) || 0) + 1);
      return { k: 'unresolved', text, why };
    }
    if (sym.kind === 'alias') {
      const decl = sym.decl;
      const subMap = bindGenerics(decl.generics, args, ctx);
      const desc = this.evalType(decl.rhs, {
        ...ctx,
        file: sym.file,
        subs: subMap,
        depth: depth + 1,
      });
      return { ...desc, text, via: [...(desc.via || []), `${name}=alias`] };
    }
    const decl = sym.decl;
    const subMap = bindGenerics(decl.generics, args, ctx);
    const fields = [];
    const unresolvedExtends = [];
    const fileCtx = { ...ctx, file: sym.file, subs: subMap, depth: depth + 1 };
    for (const ext of decl.extendsList || []) {
      const baseDesc = this.evalType(ext, { ...fileCtx, depth: depth + 1 });
      const mat = this.#materializeFields(baseDesc, fileCtx, depth + 1);
      if (mat.k === 'fields') fields.push(...mat.fields);
      else unresolvedExtends.push({ ext, why: mat.why || mat.k });
    }
    const isReactSurface = REACT_SURFACE_IFACE.test(name);
    for (const f of decl.fields) {
      fields.push({
        name: f.name,
        type: f.type,
        optional: f.optional,
        tags: f.tags,
        doc: f.doc,
        from: `${name}@${path.relative(this.libRoot, sym.file).split('\\').join('/')}`,
        file: sym.file,
        generics: decl.generics,
        ...(isReactSurface ? { surface: 'react' } : {}),
      });
    }
    return {
      k: 'fields',
      fields,
      origins: [name],
      unresolvedExtends,
      file: sym.file,
      // 泛型绑定与形参表一路带着走：分类阶段要用它去替换 `ValueType` 这类形参
      // （丢了它，`onChange?: (value: ValueType) => void` 会变成"解不开的类型"）
      subs: subMap,
      generics: decl.generics,
      text,
    };
  }

  /**
   * `typeof X` → 求值 `X` 的**声明类型**（或字面量初始化器）。
   *
   * 这是 antd 6.6.4 的枚举写法的前半截：`declare const _ButtonTypes: readonly ["default", …]`。
   * 拿不到就返回 unresolved —— **不猜**：猜错的代价是"枚举里少几个取值"，
   * 而那种错在调用点上表现为"某个合法取值被拒绝了"，完全没有线索。
   */
  #typeofValue(name, ctx, depth) {
    if (depth > MAX_DEPTH) return { k: 'unresolved', text: `typeof ${name}`, why: 'depth' };
    const sym = this.lookupValue(name, ctx.file, depth);
    if (!sym) {
      this.stats.unresolvedTypes.set(`typeof:${name}`, (this.stats.unresolvedTypes.get(`typeof:${name}`) || 0) + 1);
      return { k: 'unresolved', text: `typeof ${name}`, why: `missing-value:${name}` };
    }
    const decl = sym.decl;
    if (decl.type) {
      return this.evalType(decl.type.replace(/^readonly\s+/, ''), {
        ...ctx,
        file: sym.file,
        depth: depth + 1,
      });
    }
    if (decl.init) {
      return parseLiteralArray(decl.init);
    }
    return { k: 'unresolved', text: `typeof ${name}`, why: 'value-without-type' };
  }

  /** `T[K]`：`[number]` 取元素，字面量键取字段。 */
  #indexAccess(base, keyText, ctx, depth, text) {
    const key = keyText.trim().replace(/\s+/g, '');
    if (key === 'number') {
      const elems = [];
      const push = (d) => {
        if (d && d.k === 'union') for (const p of d.parts) elems.push(p);
        else if (d) elems.push(d);
      };
      if (base && base.k === 'tuple') for (const it of base.items) push(it);
      else if (base && base.k === 'array') {
        const m = this.#materializeFields(base.elem, ctx, depth + 1);
        if (m.k === 'fields' && m.unit) push({ k: 'lit', value: m.unit, text: m.unit });
        else push(base.elem);
      } else if (base && base.k === 'fields' && base.unit) {
        push({ k: 'lit', value: base.unit, text: base.unit });
      } else push(base);
      const dedup = [];
      const seen = new Set();
      for (const e of elems) {
        const sig = e.k === 'lit' ? `lit:${e.value}` : e.k === 'numlit' ? `n:${e.value}` : `${e.k}:${e.text}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        dedup.push(e);
      }
      if (dedup.length === 0) return { k: 'unresolved', text, why: 'index-empty' };
      if (dedup.length === 1) return { ...dedup[0], text };
      return { k: 'union', parts: dedup, text };
    }
    const litKey = key.replace(/^['"]|['"]$/g, '');
    const flat = this.#materializeFields(base, ctx, depth + 1);
    if (flat.k === 'fields') {
      const hit = flat.fields.find((f) => f.name === litKey);
      if (hit) {
        return this.evalType(hit.type, {
          ...ctx,
          file: hit.file || flat.file || ctx.file,
          subs: flat.subs || ctx.subs,
          depth: depth + 1,
        });
      }
    }
    return { k: 'unresolved', text, why: `index:${litKey}` };
  }

  /**
   * `typeof X` 里的 `X`（一个组件标识符）→ 它的 props 接口。
   *
   * 两步，都不猜：
   *   ① `X` 从哪个 import 进来 → 那个包的模块；
   *   ② 在那个模块里找 `${默认导出名}Props` / `${文件名}Props`，都找不到就取该模块里
   *      字段最多的 `*Props`（**仍然 scoped**：只在那个模块内选，不会串到别的组件）。
   */
  #propsOfComponentIdent(ident, ctx, depth) {
    if (depth > MAX_DEPTH) return null;
    const parsed = this.files.get(ctx.file);
    if (!parsed) return null;
    const specs = new Set();
    for (const imp of parsed.imports) {
      if (imp.local !== ident) continue;
      specs.add(imp.spec);
    }
    for (const spec of specs) {
      const mods = this.resolveSpec(spec, ctx.file);
      for (const mod of mods || []) {
        if (!mod) continue;
        // ⚠️ 用 `path.sep` 而不是正则字面量里的转义反斜杠：本文件被工具脚本改过好几次，
        //    而**反斜杠在 heredoc / 脚本字符串里会被吃掉一层**，症状是正则未闭合
        //    （`/\/g, '/'`），报错却是"私有字段不在类里"—— 与真因差了十万八千里。
        //    凡是能不用转义反斜杠的地方就别用。记在 docs/FINDINGS.md。
        const base = mod.file.split(path.sep).pop().replace(/\.d\.ts$/, '');
        const defIdent = defaultExportIdent(mod);
        for (const cand of [`${defIdent}Props`, `${base}Props`]) {
          if (!cand || cand === 'Props' || cand === 'nullProps') continue;
          const sym = this.lookup(cand, mod.file, 0, { scoped: true });
          if (!sym) continue;
          const desc = this.evalType(cand, { ...ctx, file: sym.file, depth: depth + 1 });
          if (desc && desc.k === 'fields') return desc;
        }
        const anyProps = (mod.interfaces || [])
          .filter((it) => it.name.endsWith('Props'))
          .sort((a, b) => b.fields.length - a.fields.length)[0];
        if (anyProps) {
          const desc = this.evalType(anyProps.name, { ...ctx, file: mod.file, depth: depth + 1 });
          if (desc && desc.k === 'fields') return desc;
        }
      }
    }
    return null;
  }

  /** 找 `const` 值声明（顺序与 `lookup` 相同）。 */
  lookupValue(name, file, depth = 0) {
    const own = this.files.get(file);
    if (own) {
      const hit = this.#inParsedValue(own, name);
      if (hit) return hit;
      for (const imp of own.imports) {
        if (imp.kind === 'default' || imp.kind === 'namespace') continue;
        if (imp.imported !== name && imp.local !== name) continue;
        const mods = this.resolveSpec(imp.spec, file);
        if (!mods) continue;
        for (const mod of mods) {
          const hit2 = mod && this.#inParsedValue(mod, imp.imported);
          if (hit2) return hit2;
        }
      }
    }
    const all = this.byValueName.get(name) || [];
    if (all.length) return all[0];
    return null;
  }

  #inParsedValue(parsed, name) {
    if (!parsed) return null;
    const v = (parsed.values || []).find((x) => x.name === name);
    if (v) return { kind: 'value', decl: v, file: parsed.file };
    for (const ex of parsed.exports) {
      if (!ex.spec) continue;
      if (ex.exported !== name && ex.local !== name) continue;
      const mods = this.resolveSpec(ex.spec, parsed.file);
      if (!mods) continue;
      for (const mod of mods) {
        const hit = mod && this.#inParsedValue(mod, ex.local);
        if (hit) return hit;
      }
    }
    return null;
  }

  /**
   * 公开的"压平"入口：把任意描述符压成 `{k:'fields', fields}`（压不平就原样返回）。
   *
   * 为什么要有公开版本：调用方（manifest）需要拿到 groups 之后的字段表去做分类，
   * 而分类必须知道**泛型绑定**（`SelectProps<ValueType>` 里 ValueType 绑给了谁）。
   * 第一版让调用方自己再实现一遍压平 —— 那正是"同一件事两处实现，等着漂"。
   */
  materializeFields(desc, ctx = {}) {
    return this.#materializeFields(desc, { file: ctx.file, subs: ctx.subs, depth: 0 }, ctx.depth || 0);
  }

  /** 把描述符"压平"成 fields（对象类才压得平，其它原样返回）。 */
  #materializeFields(desc, ctx, depth) {
    if (!desc) return { k: 'unresolved', why: 'missing' };
    if (depth > MAX_DEPTH) return { k: 'unresolved', why: 'depth' };
    switch (desc.k) {
      case 'fields':
        return desc;
      case 'inter': {
        const fields = [];
        const origins = [];
        const unresolvedExtends = [];
        let subOut = null;
        for (const p of desc.parts) {
          const m = this.#materializeFields(p, ctx, depth + 1);
          if (m.k === 'fields') {
            fields.push(...m.fields);
            origins.push(...(m.origins || []));
            if (!subOut && m.subs) subOut = m.subs;
            if (m.unresolvedExtends) unresolvedExtends.push(...m.unresolvedExtends);
          } else {
            unresolvedExtends.push({ ext: p.text || p.k, why: m.why || m.k });
          }
        }
        return { k: 'fields', fields, origins, unresolvedExtends, subs: subOut, text: desc.text };
      }
      case 'union': {
        // 只有当**每一支**都能压平才当对象看（`A | B` 的 props 合并）；否则不是对象
        const mats = desc.parts.map((p) => this.#materializeFields(p, ctx, depth + 1));
        if (mats.every((m) => m.k === 'fields')) {
          return {
            k: 'fields',
            fields: mats.flatMap((m) => m.fields),
            origins: ['union'],
            subs: mats.find((m) => m.subs)?.subs || null,
            text: desc.text,
          };
        }
        return { k: 'union', parts: desc.parts, text: desc.text };
      }
      case 'react': {
        if (isReactAttrsName(desc.name)) {
          return { k: 'fields', fields: reactAttrsFor(desc.name), origins: [`react-table:${desc.name}`] };
        }
        return desc;
      }
      default:
        return desc;
    }
  }

  /** 诊断信息（进 manifest 的报告段）。 */
  report() {
    return {
      spec_failed: this.stats.specFailed.slice(0, 40),
      unresolved_types: [...this.stats.unresolvedTypes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40)
        .map(([why, n]) => ({ why, n })),
    };
  }
}

// ── 文本工具 ─────────────────────────────────────────────────────────────────

/** 把标识符按 subs 替换（**按词边界**，不碰字符串与属性名）。 */
function substituteIdents(text, subs) {
  if (!subs || subs.size === 0) return text;
  return text.replace(/[A-Za-z_$][\w$]*/g, (id) => (subs.has(id) ? subs.get(id) : id));
}

/** `Foo<A, B>` → { qualifier, name, args }。 */
function matchTypeRef(text) {
  const m = text.match(/^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(<([\s\S]*)>)?$/);
  if (!m) return null;
  const full = m[1];
  const args = m[3] ? splitTopLevel(m[3], ',') : [];
  const parts = full.split('.');
  const name = parts.pop();
  const qualifier = parts.length ? parts.join('.') : null;
  return { qualifier, name, args };
}

/** 函数类型识别（返回参数表 + 返回类型）。 */
function matchFunctionType(text) {
  let t = text.trim();
  let ctor = false;
  if (t.startsWith('new ')) {
    ctor = true;
    t = t.slice(4).trim();
  }
  // 可选的泛型参数表 `<T>(...) => R`
  if (t.startsWith('<')) {
    let depth = 0;
    let end = -1;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '<') depth++;
      else if (t[i] === '>') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end > 0) t = t.slice(end + 1).trim();
  }
  if (!t.startsWith('(')) return null;
  // 找匹配右括号
  let depth = 0;
  let close = -1;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(') depth++;
    else if (t[i] === ')') {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) return null;
  const rest = t.slice(close + 1).trim();
  if (!rest.startsWith('=>')) return null;
  const paramsText = t.slice(1, close);
  const params = splitTopLevel(paramsText, ',')
    .map((p) => {
      const m = p.match(/^(?:\.\.\.)?([A-Za-z_$][\w$]*)\s*(\??)\s*:\s*([\s\S]+)$/);
      if (m) return { name: m[1], optional: m[2] === '?', type: m[3].trim() };
      return { name: null, optional: true, type: p.trim() };
    })
    .filter((p) => p.type);
  return { params, ret: rest.slice(2).trim(), ctor };
}

/** 内联对象类型 `{ a?: string; b: number }` 的成员。 */
function parseInlineObject(text) {
  const inner = text.replace(/^\{/, '').replace(/\}$/, '');
  const out = [];
  for (const stmt of splitTopLevel(inner, ';')) {
    const m = stmt.match(/^(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\??)\s*:\s*([\s\S]+)$/);
    if (m) out.push({ name: m[1], optional: m[2] === '?', type: m[3].trim(), tags: [], from: 'inline' });
  }
  return out;
}

/** `'a' | 'b'` → ['a','b']（不是字面量联合就给空表）。 */
function literalKeys(text) {
  return splitTopLevel(text, '|')
    .map((p) => p.trim().match(/^['"]([^'"]*)['"]$/))
    .filter(Boolean)
    .map((m) => m[1]);
}

function omitKeys(desc, keys, text) {
  if (desc.k !== 'fields') return desc;
  const drop = new Set(keys);
  return { ...desc, fields: desc.fields.filter((f) => !drop.has(f.name)), omitted: keys, text };
}

function pickKeys(desc, keys, text) {
  if (desc.k !== 'fields') return desc;
  const keep = new Set(keys);
  return { ...desc, fields: desc.fields.filter((f) => keep.has(f.name)), text };
}

/**
 * `const X = ['a', 'b'] as const` 这种**字面量初始化器** → 元组描述符。
 *
 * 有的库用注解形态（`declare const X: readonly [...]`），有的用初始化器形态，两种都认。
 * 认不出就返回 unresolved：这里同样**不猜**（猜错等于枚举里凭空多/少取值）。
 */
function parseLiteralArray(text) {
  const t = String(text).trim().replace(/\s+as\s+const\s*$/, '').trim();
  if (!t.startsWith('[') || !t.endsWith(']')) {
    return { k: 'unresolved', text, why: 'init-shape' };
  }
  const items = splitTopLevel(t.slice(1, -1), ',').map((x) => {
    const s = x.trim();
    if (/^['"][\s\S]*['"]$/.test(s)) return { k: 'lit', value: s.slice(1, -1), text: s };
    if (/^-?\d+(\.\d+)?$/.test(s)) return { k: 'numlit', value: Number(s), text: s };
    if (s === 'true' || s === 'false') return { k: 'prim', name: 'boolean', text: s };
    return { k: 'unresolved', text: s, why: 'init-item' };
  });
  return { k: 'tuple', items, text: t };
}

/** 把泛型形参绑到实参文本（缺实参 → 用约束/默认值，取不到就用 `any`）。 */
function bindGenerics(formal, args, ctx) {
  const map = new Map(ctx.subs || []);
  if (!formal || !formal.length) return map;
  formal.forEach((p, i) => {
    if (args[i]) map.set(p, args[i]);
    else if (!map.has(p)) map.set(p, 'any');
  });
  return map;
}

/**
 * 事件家族：`MouseEventHandler` → `Mouse`。
 *
 * 这张表决定 DSL 里这个事件参数是 `@cmd.Cmd`（信号）还是 `(Payload) -> Cmd`（带值）。
 * 判据是**载荷里到底有没有值**，不是"名字好不好听"：
 *   Change / Input 两族 → 值（`target.value` / `target.checked` 就是组件的值）；
 *   其余（鼠标、键盘、焦点、指针、滚动…）→ 信号。
 */
function familyOf(name) {
  const m = String(name).match(/^([A-Z][A-Za-z]*?)(?:EventHandler|Event)$/);
  return m ? m[1] : 'Synthetic';
}

const VALUE_FAMILIES = new Set(['Change', 'Input']);

module.exports = {
  Resolver,
  parseLiteralArray,
  splitSpec,
  familyOf,
  VALUE_FAMILIES,
  matchFunctionType,
  matchTypeRef,
  literalKeys,
  isPrimitiveName,
  REACT_KNOWN,
  WRAPPERS,
};
