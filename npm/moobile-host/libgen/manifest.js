'use strict';
// manifest.js —— **I2**：从组件库的类型定义抽出「组件 → prop 名 + 类别」的清单。
//
// 输入：`node_modules/<lib>/**/*.d.ts`（由 `package.json` 的 `types` 定位入口）
// 输出：一份 JSON（入库、可 diff、可手改兜底）
//
// ## 三条规矩（设计稿 §5 T7「取样时立刻暴露的 3 条规则」，逐条落在这里）
//
// 1. **按导出名挑接口，不按"哪个接口字段多"**。启发式"挑最大的 `*Props`"实测挑错过：
//    一个组件目录里有多个 Props 接口时，`Input` 会挑到 `GroupProps`。
//    真相源是入口 `.d.ts` 的**导出名**（antd 是 `export { default as Input } from './input'`），
//    再按导出名去对 `<Name>Props`；复合子组件（`Input.Group`）天然不在入口导出里，自动被排除。
// 2. **联合字面量算 `str`，不算 `json`**。`iconPosition?: 'start' | 'end'` 是枚举，
//    塞进 JSON 通道意味着调用点要写 `"\"start\""` —— 把一整个枚举降级成字符串拼接。
// 3. **跳过 `_` 前缀与 `@private`/`@internal` 的字段**，并且跳过 `prefixCls`/`rootClassName`
//    这类内部 prop。**但不是删掉**：它们在清单里带 `internal: true`，看得见、可追溯。
//
// 另外两条**必须**在报告里点名的东西（不是失败，但绝不能静默）：
//   · `unsupported` 的 prop（跨组件类型、`keyof`/`typeof`、回调…）—— 逐条列出名字与原因；
//   · `extends` 链里**解不开**的那一环 —— 它意味着"这个组件的常用 prop 可能不全"。

const fs = require('fs');
const path = require('path');
const { walk } = require('./dts-scan');
const { Resolver, familyOf, VALUE_FAMILIES } = require('./resolve');

/** 内部 prop：不是用户该写的（清单里保留，DSL 里不生成）。 */
const INTERNAL_PROPS = new Set([
  'prefixCls', 'rootClassName', 'classNames', 'styles', 'getPopupContainer',
  'getTargetContainer', 'direction', 'component', 'wrapClassName', 'wrapStyle',
  'dropdownClassName', 'dropdownStyle', 'popupClassName', 'popupStyle',
  'internalHooks', 'internalRefs', 'transformColumns', '_skipSemantic',
]);

/** React 自己的保留字段：由渲染层负责，不经我们的 prop 通道。 */
const REACT_RESERVED = new Set(['key', 'ref', 'dangerouslySetInnerHTML']);

/**
 * **React 公共属性面**里"值得进 DSL"的白名单（非事件的那部分）。
 *
 * 为什么要有这张白名单：`React.HTMLAttributes` 展开后有 130+ 个属性（光 aria-* 就 50 个），
 * 而每个转发 DOM props 的组件都长一样 —— 全塞进生成物的签名里，等于让每个组件多 130 个
 * 参数，真实用到的不到 20 个。**清单里一个都不删**（事实记录），只是**不生成参数**；
 * 真的要用 `aria-*` / `data-*` / 长尾属性时，走生成函数的 `attrs?` 逃生口。
 *
 * 事件不在白名单里限制：它们**全部**保留（回调是"能不能用"的核心，不是噪音）。
 */
const REACT_SURFACE_ALLOW = new Set([
  'className', 'style', 'id', 'title', 'hidden', 'tabIndex', 'role', 'lang', 'dir',
  'name', 'value', 'placeholder', 'disabled', 'checked', 'readOnly', 'required',
  'multiple', 'rows', 'cols', 'maxLength', 'minLength', 'min', 'max', 'step', 'pattern',
  'accept', 'autoComplete', 'autoFocus', 'src', 'alt', 'width', 'height',
  'href', 'target', 'rel', 'download', 'colSpan', 'rowSpan', 'scope', 'htmlFor',
]);

/**
 * 这个 prop 要不要**生成 DSL 参数**。
 *
 * 三档（判据都可复算，不靠人记得）：
 *   ① `internal` / `unsupported` / `children` → 不生成（children 另走 trait 参数）；
 *   ② 事件 → **一律生成**；
 *   ③ 来自 React 公共属性面的非事件 → 只有进白名单才生成。
 * 被挡掉的都在清单里留 `exposed: false` 与原因 —— 不然"某个 prop 为什么没生成"
 * 会变成只能靠读生成器的源码才能回答的问题。
 */
function exposureOf(name, prop) {
  if (prop.kind === 'internal') return { exposed: false, reason: 'internal' };
  if (prop.kind === 'unsupported') return { exposed: false, reason: 'unsupported' };
  if (prop.kind === 'children') return { exposed: false, reason: 'children-trait' };
  if (prop.kind === 'event') return { exposed: true };
  if (prop.surface === 'react' && !REACT_SURFACE_ALLOW.has(name)) {
    return { exposed: false, reason: 'react-surface-长尾（走 attrs? 逃生口）' };
  }
  return { exposed: true };
}

/**
 * 定位组件库的类型入口。
 *
 * 顺序：`package.json` 的 `types`/`typings` → 常见目录下的 `index.d.ts`。
 * ⚠️ 为什么必须认 `types` 字段：antd 同时带 `es/`（ESM）与 `lib/`（CJS）两套**完整的** `.d.ts`，
 * 若把两套都载入，同一个名字会有两份声明（解析歧义），而且白读一倍文件。
 */
function findTypeEntry(pkgDir) {
  const pkgJson = path.join(pkgDir, 'package.json');
  if (fs.existsSync(pkgJson)) {
    try {
      const meta = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
      const t = meta.types || meta.typings;
      if (t) {
        const p = path.join(pkgDir, t);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
      }
      if (meta.exports && meta.exports['.']) {
        const e = meta.exports['.'];
        const cand = typeof e === 'string' ? e : e.types || (e.import && e.import.types);
        if (cand) {
          const p = path.join(pkgDir, cand);
          if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
        }
      }
    } catch {
      /* package.json 坏了就退回目录扫描 */
    }
  }
  for (const rel of ['index.d.ts', 'es/index.d.ts', 'lib/index.d.ts', 'dist/index.d.ts', 'types/index.d.ts']) {
    const p = path.join(pkgDir, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 找组件库的包根（从应用根往 node_modules 里找）。 */
function findPackageDir(appDir, packageName) {
  let cur = appDir;
  for (let i = 0; i < 8; i++) {
    const cand = path.join(cur, 'node_modules', ...packageName.split('/'));
    if (fs.existsSync(cand) && fs.existsSync(path.join(cand, 'package.json'))) return cand;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

function readPackageVersion(pkgDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

// ── prop 分类 ────────────────────────────────────────────────────────────────

/**
 * 这个组件的 `children` 是不是**原始字符串**（而不是一棵子树）。
 *
 * ## 为什么必须分这两种（这不是洁癖，是两种完全不同的东西）
 *
 * MoonBit 侧的 `IsChildren for String` 把字符串变成 `VNode::Text`，
 * 到宿主是 `React.createElement(Text, {}, "…")` —— 也就是 RN 的 `<Text>` **元素**。
 * 对普通组件（`@html.div("你好")`）这正是要的；对"把 children 当数据用"的组件则是**毒药**：
 *
 *     react-native-markdown-display 的 `Markdown` 把 children 交给 markdown-it 解析，
 *     拿到 `<Text>` 元素后抛 `Error: Input data should be a String` —— **每个字符一次**
 *     （实测：真机 6 条错帧，栈里只有 markdown-it，看不出是谁递错了东西）。
 *
 * 于是"原始字符串"要有自己的投递方式。判据分两档：
 *
 *   ① **类型定义说它是字符串**（`children: string`）→ 无需声明的原始字符串；
 *   ② **类型定义在撒谎** → 只能**显式声明**（`libgen.config.json` 的 `content`）。
 *      典型：`ComponentType<PropsWithChildren<MarkdownProps>>` 明写 `children: ReactNode`，
 *      运行期却要字符串 —— 生成器**猜不出来**，猜错的下场是"组件内部报一句与 prop 无关的错"。
 *
 * ⚠️ 别把 ① 读成"`string` 一定是原始字符串所以随便传"：`prop_str` 传出去的就是 JS 字符串，
 *    与"节点"是两条路；这条判据只是说**类型定义已经写明了该走哪条**。
 */
function childrenDeliveryOf(node) {
  const walk = (n, depth = 0) => {
    if (!n || depth > 6) return false;
    if (n.k === 'prim') return n.name === 'string';
    if (n.k === 'lit') return true; // `'a' | 'b'` 这种字面量联合：它只收这几个字符串
    if (n.k === 'union') {
      // `children?: string` 在 TS 里常常是 `string | undefined` —— undefined 那一支不算反例
      const parts = (n.parts || []).filter(
        (p) => !(p.k === 'prim' && (p.name === 'undefined' || p.name === 'null')),
      );
      return parts.length > 0 && parts.every((p) => walk(p, depth + 1));
    }
    return false;
  };
  return walk(node);
}

/**
 * 把"解析出来的类型"映射到**我们通道里的类别**。
 *
 * 类别 → 通道的对应（生成器与宿主两侧都按这张表）：
 *   str / bool / num  → `prop_str` / `prop_bool` / `prop_num`
 *   json              → `prop_json`（宿主 `JSON.parse` 后交给组件）
 *   reactnode         → `prop_str`（文本；要放整棵子树时走 `items` 之类的 JSON 字段）
 *   event             → `on_raw`，载荷按 `eventKind` 决定是信号还是带值
 *   internal/unsupported → **不生成参数**，但进报告
 *
 * `children` 有**两种投递形态**（见 `childrenDeliveryOf`）：节点（默认）与原始字符串。
 */
function classify(propName, typeText, node, opts = {}) {
  if (propName === 'children') {
    return childrenDeliveryOf(node)
      ? { kind: 'children', deliver: 'raw', deliver_from: 'type' }
      : { kind: 'children' };
  }
  if (REACT_RESERVED.has(propName)) {
    return { kind: 'unsupported', reason: 'react-reserved' };
  }

  // 事件：名字像事件 **且** 类型是函数 —— 两个条件都要。
  // 只要名字像事件是不够的（`onChange` 在 antd 里既有函数也有值），
  // 只要类型是函数也不够（`filterOption?: (…) => boolean` 是回调，不是事件）。
  const isFnLike =
    node.k === 'fn' ||
    (node.k === 'react' && /Event(Handler)?$/.test(node.name)) ||
    (node.k === 'union' && node.parts.some((p) => p.k === 'fn' || p.k === 'react'));
  // ⚠️ **类型解不开但名字是 `on*`** 的，仍然当事件 —— 判据是"名字这条线索够不够用"：
  //    够。因为带值形态（`(Payload) -> Cmd`）对**信号回调同样安全**：
  //    JS 侧多传一个实参不会出错，少传也只是提取器给出空值。
  //    反过来若按 unsupported 丢掉，`onDropdownVisibleChange`（类型是索引访问
  //    `RcSelectProps<…>['onPopupVisibleChange']`）这类**真事件**就会从清单里消失，
  //    而调用点上表现为"这个回调根本不存在"，没有任何线索。
  if (/^on[A-Z]/.test(propName) && (isFnLike || node.k === 'unresolved')) {
    if (node.k === 'unresolved') {
      return { kind: 'event', eventKind: 'value', reason: `name-only(unresolved:${node.why || '?'})` };
    }
    return eventKindOf(propName, node, opts);
  }

  const leaf = unwrapUnionForClassification(node);

  switch (leaf.kind) {
    case 'bool':
      return { kind: 'bool' };
    case 'str':
      return { kind: 'str' };
    case 'num':
      return { kind: 'num' };
    case 'reactnode':
      return { kind: 'reactnode' };
    case 'json':
      return { kind: 'json' };
    case 'fn':
      return { kind: 'unsupported', reason: 'callback' };
    case 'unsupported':
      return { kind: 'unsupported', reason: leaf.reason };
    default:
      return { kind: 'unsupported', reason: 'unclassified' };
  }
}

/**
 * 事件分类：**信号**（`@cmd.Cmd`）还是**带值**（`(Payload) -> Cmd`）。
 *
 * 判据是"载荷里到底有没有这个组件的值"：
 *   · 处理器没有参数（`onClick?: () => void`）→ 信号；
 *   · 第一个参数是 `Change`/`Input` 家族的事件（`React.ChangeEventHandler`）→ 带值
 *     （`target.value` / `target.checked` 就是组件的值）；
 *   · 第一个参数根本不是事件（`onChange?: (value, option) => void`）→ 带值；
 *   · 名字带 `Change` 的具名事件（`CheckboxChangeEvent`）→ 带值；
 *   · 其余（鼠标/键盘/焦点/指针/滚动…）→ 信号。
 *
 * 反例要求（别读多）：信号事件**不是**"拿不到载荷"，而是"载荷不是一个值"——
 * 真需要坐标/按键时用 `attrs=@html.Attrs::build().on_raw(…)` 逃生口，生成物的文件头写了这件事。
 */
function eventKindOf(propName, node, opts) {
  // ① **React 具名事件类型**（`React.ChangeEventHandler`）：这里没有参数表可看
  //    （它是个**接口名**，解析器不会去展开它的调用签名），只能按**家族**判 —— 而家族够用：
  //    Change / Input 两族就是"带值"，其余是"信号"。
  //    ⚠️ 漏掉这一档的后果很具体：`Input.onChange` 会被判成**信号**（因为"看不到参数"），
  //    于是生成物里 `on_change? : @cmd.Cmd` —— 受控输入当场失效，而 I1 的招牌用例正是它。
  const reactNode = node.k === 'react' ? node : (node.parts || []).find((p) => p.k === 'react');
  if (reactNode && reactNode.family) {
    return {
      kind: 'event',
      eventKind: VALUE_FAMILIES.has(reactNode.family) ? 'value' : 'signal',
      reason: `family:${reactNode.family}`,
    };
  }
  const fnNode = node.k === 'fn' ? node : node.parts ? node.parts.find((p) => p.k === 'fn') : null;
  const params = fnNode ? fnNode.params : [];
  if (!params.length) return { kind: 'event', eventKind: 'signal', reason: 'no-args' };
  const first = String(params[0].type || '');
  const family = familyOf(first.replace(/<[\s\S]*$/, '').split('.').pop());
  if (VALUE_FAMILIES.has(family)) {
    return { kind: 'event', eventKind: 'value', reason: `family:${family}` };
  }
  if (/\bEvent\b|Event</.test(first) || /Event$/.test(first.replace(/<[\s\S]*$/, ''))) {
    if (/Change|Input|Select|Check/.test(first)) {
      return { kind: 'event', eventKind: 'value', reason: `named-event:${family}` };
    }
    return { kind: 'event', eventKind: 'signal', reason: `family:${family}` };
  }
  // 第一个参数不是事件 → 它是**值回调**
  return { kind: 'event', eventKind: 'value', reason: 'value-callback' };
}

/** 把 union 压成"最宽的那个类别"。 */
function unwrapUnionForClassification(node) {
  const prim = (n) => n.k === 'prim' && n.name !== 'any' && n.name !== 'unknown';
  const walkNode = (n, depth = 0) => {
    if (depth > 8 || !n) return { kind: 'unsupported', reason: 'deep' };
    switch (n.k) {
      case 'prim':
        if (n.name === 'boolean') return { kind: 'bool' };
        if (n.name === 'string' || n.name === 'null' || n.name === 'undefined') return { kind: 'str' };
        if (n.name === 'number' || n.name === 'bigint') return { kind: 'num' };
        if (n.name === 'any' || n.name === 'unknown' || n.name === 'object') return { kind: 'json' };
        if (n.name === 'symbol' || n.name === 'never' || n.name === 'void') {
          return { kind: 'unsupported', reason: `prim:${n.name}` };
        }
        return { kind: 'unsupported', reason: `prim:${n.name}` };
      case 'lit':
        return { kind: 'str' };
      case 'numlit':
        return { kind: 'num' };
      case 'react':
        if (n.name === 'CSSProperties') return { kind: 'json' };
        if (n.name === 'ReactNode') return { kind: 'reactnode' };
        return { kind: 'unsupported', reason: `react:${n.name}` };
      case 'array':
        return { kind: 'json' };
      case 'tuple':
        return { kind: 'json' };
      case 'fields':
        return { kind: 'json' };
      case 'object':
        return { kind: 'json' };
      case 'fn':
        return { kind: 'fn' };
      case 'generic':
        return { kind: 'json' };
      case 'union': {
        const inner = n.parts.map((p) => walkNode(p, depth + 1));
        return pickWidest(inner);
      }
      case 'inter':
        return { kind: 'json' };
      case 'unresolved':
        return { kind: 'unsupported', reason: n.why || 'unresolved' };
      default:
        return { kind: 'unsupported', reason: `node:${n.k}` };
    }
  };
  const pickWidest = (parts) => {
    const kinds = new Set(parts.map((p) => p.kind));
    const unresolvedOnly = parts.every((p) => p.kind === 'unsupported');
    if (unresolvedOnly) return parts.find((p) => p.kind === 'unsupported');
    // ⚠️ 还要**丢掉 `fn` 那一支**：联合里的函数分支对我们**不可达**（回调进不了 prop 通道），
    //    把它算进"最宽类别"会得出错误结论。实例：`Table.rowKey?: string | ((record) => string)`
    //    —— 含函数 → 判成 json → 调用点必须写 JSON 文本，而它 99% 的用法就是一个普通字符串
    //    （实测代价：demo 里 `rowKey="id"` 被宿主拒绝，报的是"不是合法 JSON"，
    //    真因却是"生成器把不可达的分支算进来了"）。
    const reachable = parts.filter((p) => p.kind !== 'fn');
    const meaningful = (reachable.length ? reachable : parts).filter((p) => p.kind !== 'unsupported');
    // 全是函数/全不可达（`(a) => b` 这种纯回调）→ 交回原样，让上层判成 `callback`
    if (!meaningful.length) return parts[0];
    const set = new Set(meaningful.map((p) => p.kind));
    if (set.size === 1) return meaningful[0];
    // 混合：bool+str 里 str 能装下 "true"；str+num 退化到 str；带 json 就 json
    if (set.has('json') || set.has('reactnode') || set.has('fn')) {
      if (set.has('fn') && set.size === 1) return meaningful[0];
      return { kind: 'json' };
    }
    if (set.has('str')) return { kind: 'str' };
    if (set.has('num')) return { kind: 'num' };
    if (set.has('bool')) return { kind: 'bool' };
    return meaningful[0];
  };
  return walkNode(node);
}

/**
 * 在清单里按**注册表用的那个键**找一个组件（顶层 `Markdown`，或复合子组件 `Form.Item`）。
 *
 * 键必须与宿主注册表、与 MoonBit 侧标签**逐字一致** —— 所以这里只认点号路径，
 * 不做任何模糊匹配（模糊匹配的后果是"声明落到了另一个组件上"，而它是静默的）。
 */
function componentOf(components, name) {
  if (components[name]) return components[name];
  if (!name.includes('.')) return null;
  const [head, ...rest] = name.split('.');
  const subs = components[head] && components[head].subcomponents;
  return subs ? subs[rest.join('.')] || null : null;
}

/** 配置写错时的统一报错：**带 code、带名字、带怎么办**（静默是这里唯一的禁忌）。 */
function badConfig(head, key, name) {
  const err = new Error(
    `${head}\n` +
      `  \`${key}\` 里拼错的名字必须报错，不能静默 —— 静默的下场是"我以为声明了，其实没有"，\n` +
      `  而症状是组件里一句与 prop / 导出无关的报错（真事：markdown 组件报 "Input data should be a String"）。\n` +
      `  现有的组件名见 generated/*.manifest.json 的 components 键。`,
  );
  err.code = 'BAD_CONTENT';
  return err;
}

/**
 * 应用**显式声明**的"这个组件从模块的 `default` 导出上取"（`libgen.config.json` 的
 * `defaultExports`）。
 *
 * ## 为什么需要它：类型定义会**谎报导出**
 *
 * `react-native-markdown-display` 的类型定义里写着 `export const Markdown: MarkdownStatic;`，
 * 而它的 JS 里 `Markdown` **只在 default 上**（`export default Markdown`），具名导出那一串
 * 没有它。于是按类型定义生成的 `components: ['Markdown']` 与运行时命名空间对不上：
 *
 *     moobile-host: registerLibrary("md") 里列了 `Markdown`，但模块里没有这个导出。
 *
 * ⚠️ 这条是**真机上报出来的**（2026-10-02）：web/node 上 Metro 的 interop 恰好能看见它，
 *    于是无头判据全绿、只有真机红 —— 又一次"只在真机露头"。
 *
 * ⚠️ 为什么不让宿主自动回落：盲取 `default` 是**猜**，猜错是"注册了另一个组件"，
 *    比"启动即报错"坏得多。所以由人声明，而声明错了就报错（与 `content` 同一条规矩）。
 *
 * @returns {string[]} 声明过的组件名（写进 manifest 的 `host.defaultExports`，`--check` 守住）
 */
function applyDefaultExports(components, defaultExports) {
  const out = [];
  for (const name of defaultExports || []) {
    if (!componentOf(components, name)) {
      throw badConfig(
        `libgen: libgen.config.json 的 \`defaultExports\` 里写了 \`${name}\`，但清单里没有这个组件。`,
        'defaultExports',
        name,
      );
    }
    out.push(name);
  }
  return out;
}

// ── 主流程 ───────────────────────────────────────────────────────────────────

/**
 * 应用**显式声明**的"原始字符串 children"（`libgen.config.json` 的 `content`）。
 *
 * ## 为什么需要显式声明（而不是全靠类型推断）
 *
 * `childrenDeliveryOf` 能从 `children: string` 推断出"这是原始字符串"，但**类型定义会撒谎**：
 * `react-native-markdown-display` 写的是 `ComponentType<PropsWithChildren<MarkdownProps>>`
 * —— 明明白白说 `children` 是 `ReactNode`，而运行期它把 children 交给 markdown-it，要的是字符串。
 * 生成器**没有线索**能识破这一点，所以只能由人来说；而"由人来说"就必须**说错就报错**，
 * 不然就是又一个静默失败（表现为"组件内部报一句与 prop 无关的错"）。
 *
 * ## 两种写法
 *
 * ```json
 * { "content": ["Markdown"] }                  // 内容进 `children` prop（默认，最常见）
 * { "content": { "Markdown": "children" } }    // 同上，写全了
 * { "content": { "Fancy": "text" } }           // 内容进具名 prop
 * ```
 *
 * ## 落点是 prop，**不需要宿主适配层**
 *
 * 这一点是实测出来的（`render.mbt` 的 `render_props` 不筛键，`render_node` 传的是
 * `createElement(tag, props, ...children)`，空 children 时 React 保留 `props.children`）：
 * `Attrs::prop_str("children", "# 标题")` 到宿主就是 `props.children === "# 标题"` ——
 * **原始字符串**，不经过 `<Text>`。于是"原始字符串"这条通道既不改宿主、也不改渲染规则，
 * 只是"这个组件的 children 走 prop 而不是走子节点"。
 *
 * @returns {object} 组件键 → prop 名（写进 manifest 与报告，便于核对"哪些组件走了这条通道"）
 */
function applyContent(components, content) {
  const out = {};
  if (!content) return out;
  const entries = Array.isArray(content)
    ? content.map((name) => [name, 'children'])
    : Object.entries(content);

  for (const [name, value] of entries) {
    const prop = value === true || value === undefined || value === null ? 'children' : String(value);
    const comp = componentOf(components, name);
    if (!comp) {
      throw badConfig(
        `libgen: libgen.config.json 的 \`content\` 里写了 \`${name}\`，但清单里没有这个组件。`,
        'content',
        name,
      );
    }
    comp.props = comp.props || {};
    // 具名 prop 必须真的在这个组件的清单里 —— 拼错一个字母的后果是"内容进了一个没人读的 prop"，
    // 表现为**空白**（不是报错），正是本仓库最防的那类失败。
    // ⚠️ 唯一的例外：这个组件的继承链有解不开的环（`unresolved_extends`）——
    //    那种情况下"清单里没有"不等于"组件没有"，断言下去会误伤，所以放过。
    if (prop !== 'children' && !comp.props[prop] && !(comp.unresolved_extends || []).length) {
      const err = new Error(
        `libgen: \`content\` 说组件 \`${name}\` 的内容进 \`${prop}\` prop，但清单里没有这个 prop。\n` +
          `  拼错的 prop 名不能静默 —— 字符串会被塞进一个没人读的 prop，界面上就是**空白**。\n` +
          `  要么改名字（现有 prop 见 generated/*.manifest.json 的 components.${name}.props），\n` +
          `  要么把内容写进默认的 \`children\`（\`{"content": ["${name}"]}\`）。`,
      );
      err.code = 'BAD_CONTENT';
      throw err;
    }
    comp.props.children = {
      kind: 'children',
      deliver: 'raw',
      prop,
      deliver_from: 'config:content',
      // 之前那份（类型推断出来的 children 条目）留着来源，删掉它等于抹掉"类型说过什么"
      from: comp.props.children ? `config:content(覆盖 ${comp.props.children.from || 'type'})` : 'config:content',
    };
    out[name] = prop;
  }
  return out;
}

/**
 * @param {object} opts
 * @param {string} opts.appDir      应用根（找 node_modules）
 * @param {string} opts.packageName 组件库包名（'antd'）
 * @param {string} opts.namespace   命名空间（'antd'，即 MoonBit 里写的 `antd:Button`）
 * @param {string[]} [opts.platforms]
 * @param {string} [opts.provider]  Provider 组件名（包在树外，如 'ConfigProvider'）
 * @param {string[]} [opts.exclude] 明确排除的导出名
 * @param {string[]|object} [opts.content] 哪些组件的 children 是**原始字符串**（见 `applyContent`）
 * @param {string[]} [opts.defaultExports] 哪些组件要从模块的 `default` 导出上取（类型定义会谎报导出）
 * @param {string} [opts.generatorVersion]
 */
function buildManifest(opts) {
  const {
    appDir,
    packageName,
    namespace,
    platforms = ['web'],
    provider = null,
    exclude = [],
    content = null,
    defaultExports = [],
    generatorVersion = '0.1.0',
  } = opts;

  const pkgDir = findPackageDir(appDir, packageName);
  if (!pkgDir) {
    const err = new Error(
      `libgen: 在 ${appDir} 的 node_modules 里找不到 \`${packageName}\`（先 npm install）。`,
    );
    err.code = 'NO_PACKAGE';
    throw err;
  }
  const entry = findTypeEntry(pkgDir);
  if (!entry) {
    const err = new Error(
      `libgen: \`${packageName}\` 里找不到类型入口（package.json 的 types/typings 或 index.d.ts）。\n` +
        '  没有类型定义就无法生成清单 —— 这不是可以猜的事情。',
    );
    err.code = 'NO_TYPES';
    throw err;
  }

  const rootDir = path.dirname(entry);
  const files = walk(rootDir);
  // 入口自己也要在里面（有些包的 types 指到根上的 index.d.ts，而 rootDir 就是包根）
  if (!files.includes(entry)) files.push(entry);
  const resolver = new Resolver({ libRoot: pkgDir, files, entry });
  const entryParsed = resolver.files.get(entry);

  const notes = [];
  notes.push(
    `类型入口：${path.relative(pkgDir, entry).split('\\').join('/')}（` +
      `${files.length} 个 .d.ts 文件）`,
  );

  // ── ① 组件清单：真相源 = 入口的**值导出** ──────────────────────────────────
  const excludes = new Set(exclude);
  const candidates = [];
  for (const ex of entryParsed.exports) {
    if (ex.kind !== 'value') continue;
    if (ex.exported === 'default' || excludes.has(ex.exported)) continue;
    if (candidates.some((c) => c.name === ex.exported)) continue;
    candidates.push({ name: ex.exported, spec: ex.spec, local: ex.local });
  }
  notes.push(`入口值导出：${candidates.length} 个`);

  const components = {};
  const excluded = [];
  for (const cand of candidates) {
    const propsInfo = findPropsInterface(resolver, cand, entry);
    if (!propsInfo) {
      excluded.push({ name: cand.name, reason: 'no-props-interface' });
      continue;
    }
    const desc = resolver.evalType(propsInfo.typeName, {
      file: propsInfo.file,
      subs: new Map(),
      generics: new Set(),
      depth: 0,
    });
    const flat = resolver.materializeFields(desc, { file: propsInfo.file });
    if (flat.k !== 'fields') {
      excluded.push({ name: cand.name, reason: `props-not-object:${desc.k}` });
      continue;
    }
    const built = buildComponentProps(resolver, flat, propsInfo, cand);
    if (!built.props.children) {
      const extra = componentDeclaredProps(resolver, cand, entry);
      if (extra && extra.children) built.props.children = { kind: 'children', from: 'component-type' };
    }
    // 复合子组件（`Form.Item` / `Layout.Header` / `Radio.Group` / `Input.TextArea`…）
    const subs = findSubcomponents(resolver, cand, entry, propsInfo);
    if (Object.keys(subs).length) built.subcomponents = subs;
    components[cand.name] = built;
  }

  // 显式声明的"原始字符串 children"（`libgen.config.json` 的 `content`）——
  // 它必须**在组件都建好之后**才应用：早于这一步的话，一个拼错的组件名会被
  // "还没建到那个组件"当成不存在，而报错信息就成了错的。
  const contentDecl = applyContent(components, content);
  // 「从 `default` 导出上取」的显式声明 —— 与上一条同样在组件都建好之后校验
  const defaultExportDecl = applyDefaultExports(components, defaultExports);

  // ── ② 产物 ────────────────────────────────────────────────────────────────
  const events = {};
  const jsonProps = {};
  let propCount = 0;
  const kindTotals = {};
  const unsupported = [];
  const unresolvedExtends = [];
  for (const [name, c] of Object.entries(components)) {
    // 顶层组件与它的复合子组件**一视同仁**地汇总：子组件的键写成 `Parent.Sub`
    // （与宿主注册表、与 MoonBit 侧标签 `"antd:Parent.Sub"` 完全同一个名字）。
    // 漏掉子组件这一轮的后果很具体：`jsonProps` / `events` 少一批，
    // 于是子组件的 JSON prop 到不了位（表现为"数据没进去"，而不是报错）。
    // ⚠️ 键必须与宿主注册表**逐字一致**：子组件是 `Parent.Sub`，不是裸的 `Sub`。
    //    第一版写成裸名，后果很具体：`jsonProps` 里出现 `Group: [...]` 而不是
    //    `Radio.Group: [...]`，于是 `Radio.Group.options`（JSON 通道）**没被 parse** ——
    //    报错发生在 antd 内部（`options.map is not a function`），离真因隔了一整个组件。
    const entries = [
      [name, c],
      ...Object.entries(c.subcomponents || {}).map(([sub, v]) => [`${name}.${sub}`, v]),
    ];
    for (const [key, comp] of entries) {
      const jsonList = [];
      for (const [propName, p] of Object.entries(comp.props)) {
        propCount++;
        kindTotals[p.kind] = (kindTotals[p.kind] || 0) + 1;
        if (p.kind === 'json') jsonList.push(propName);
        if (p.kind === 'event') events[propName] = propName; // ← 身份映射：事件键就是 prop 名
        if (p.kind === 'unsupported') {
          unsupported.push({ component: key, prop: propName, reason: p.reason, type: p.type });
        }
      }
      if (jsonList.length) jsonProps[key] = jsonList.sort();
      for (const u of comp.unresolvedExtends || []) unresolvedExtends.push({ component: key, ...u });
    }
  }

  const manifest = {
    $generator: {
      tool: 'moobile-host libgen',
      version: generatorVersion,
      manifest_version: 1,
      // 生成物是**承诺面**：头部带版本，重跑时 diff 会立刻显示"哪一边变了"
    },
    library: {
      package: packageName,
      version: readPackageVersion(pkgDir),
      namespace,
      title: `node_modules/${packageName}`,
    },
    host: {
      platforms,
      provider,
      // 顶层 `registerLibrary({ defaultExports })` 的输入：**类型定义没说准导出的那几个名字**。
      // 宿主侧据此从 `mod.default` 上取（见 `core.js` 的 `resolveExport`）——
      // 不写这一条时宿主**不会**回落，而是启动即报错（那样才知道是哪里不对）。
      defaultExports: defaultExportDecl,
      // 宿主侧 `registerLibrary({ jsonProps })` 的输入：**与生成物用到的 json 通道严格同源**。
      // 手写这两处的下场是"MoonBit 传了 JSON 文本、宿主没 parse"，组件收到一个字符串，
      // 表现为"数据没进去"（而不是报错）—— 正是本仓库反复记的那类静默失败。
      jsonProps,
      // 事件键 → 组件库的 prop 名。**生成的就写死成身份映射**：
      // 生成物里的 `on_raw("onClick", …)` 用的键就是 prop 名，于是不需要"猜"这一层。
      events,
    },
    counts: {
      components: Object.keys(components).length,
      props: propCount,
      kinds: kindTotals,
      excluded: excluded.length,
      unsupported: unsupported.length,
    },
    components,
    // 内容走**原始字符串**（而不是子节点）的组件 → 落点 prop。
    // 两侧都不需要额外机制（宿主就是普通 prop），所以它只是**记录**：谁走了这条通道、
    // 为什么走（`deliver_from` 分 `type` 与 `config:content` 两种）。`--check` 会守住它。
    content: contentDecl,
    // ↓ 报告段：**不是失败，但绝不能静默**
    report: {
      notes,
      excluded,
      json_props: jsonProps,
      // ↑ 与 `host.jsonProps` 是同一份内容：报告里留一份，便于人核对"哪些 prop 走了 JSON 通道"
      content: contentDecl,
      default_exports: defaultExportDecl,
      unsupported,
      unresolved_extends: unresolvedExtends.slice(0, 60),
      resolver: resolver.report(),
    },
  };
  return manifest;
}

/**
 * 组件**声明的类型**上额外挂的 props。
 *
 * 已知的真实形态（antd 的 Splitter）：
 *
 *     declare const Splitter: React.ForwardRefExoticComponent<
 *         SplitterProps & { children?: React.ReactNode | undefined } & React.RefAttributes<…>>;
 *
 * `SplitterProps`（公开的 props 接口）里**没有 children**，而组件显然需要它 ——
 * 于是"按导出名挑 Props 接口"这条主路径在这里必然漏掉它。
 *
 * ⚠️ 只用来**补缺**：已有的 prop 一律以 props 接口为准（接口是公开面，组件类型是实现细节）。
 * 拿不到就返回 null —— 这一层是补丁，不是主力，失败不该让整条流水线红。
 */
function componentDeclaredProps(resolver, cand, entry) {
  try {
    // ⚠️ 必须从**组件自己的模块**里找这个值声明，不能从入口找：
    //    入口里是 `export { default as Splitter } from './splitter'`，
    //    而 `declare const Splitter: …` 住在 `splitter/index.d.ts`。
    const mods = cand.spec ? resolver.resolveSpec(cand.spec, entry) : null;
    let sym = null;
    for (const mod of mods || []) {
      if (!mod) continue;
      sym = resolver.lookupValue(cand.name, mod.file, 0);
      if (sym && sym.decl && sym.decl.type) break;
    }
    if (!sym) sym = resolver.lookupValue(cand.name, entry, 0);
    if (!sym || !sym.decl.type) return null;
    const desc = resolver.evalType(sym.decl.type, {
      file: sym.file,
      subs: new Map(),
      generics: new Set(),
      depth: 0,
    });
    const flat = resolver.materializeFields(desc, { file: sym.file });
    if (flat.k !== 'fields') return null;
    const out = {};
    for (const f of flat.fields) out[f.name] = f;
    return out;
  } catch {
    return null;
  }
}

/** 用 resolver 把描述符压平（走 resolver 的公开入口，别再实现第二遍）。 */
function materialize(resolver, desc, file) {
  return resolver.materializeFields(desc, { file });
}

/**
 * 找组件的 Props 接口：**按导出名对 `<Name>Props`**，只在必要时才退到全库搜索。
 *
 * 为什么不是"全库搜 `<Name>Props`"：同名接口可能有多份（`es/` 与 `lib/`、或两个组件目录
 * 各有一份 `AbstractCheckboxGroupProps`），全库搜会解到**另一个组件**的那份，
 * 而症状是"prop 清单看起来合理、但少/多了几个" —— 最难查的一类错。
 */
function findPropsInterface(resolver, cand, entry) {
  const wanted = `${cand.name}Props`;
  const mods = cand.spec ? resolver.resolveSpec(cand.spec, entry) : null;
  if (mods) {
    for (const mod of mods) {
      if (!mod) continue;
      const hit = findExportedType(resolver, mod, wanted);
      if (hit) return hit;
    }
  }
  const sym = resolver.lookup(wanted, entry);
  if (sym) return { typeName: wanted, file: sym.file, via: 'global' };
  // 有些库的默认导出与名字不同（`Affix` → `AffixProps` 找不到时退到 `<file>Props`）
  return null;
}

/** 在某个模块里找 `name` 的**类型**声明（含该文件自己的 re-export）。 */
function findExportedType(resolver, parsed, name) {
  const direct = parsed.interfaces.find((x) => x.name === name) || null;
  if (direct) return { typeName: name, file: parsed.file, via: 'direct' };
  const alias = parsed.aliases.find((x) => x.name === name) || null;
  if (alias) return { typeName: name, file: parsed.file, via: 'direct-alias' };
  for (const ex of parsed.exports) {
    if (!ex.spec) continue;
    if (ex.exported !== name && ex.local !== name) continue;
    const mods = resolver.resolveSpec(ex.spec, parsed.file);
    if (!mods) continue;
    for (const mod of mods) {
      if (!mod) continue;
      const hit = findExportedType(resolver, mod, ex.local === 'default' ? name : ex.local);
      if (hit) return { ...hit, via: 're-export' };
    }
  }
  return null;
}

/**
 * 找**复合子组件**：`Form.Item` / `Layout.Header` / `Radio.Group` / `Input.TextArea` …
 *
 * ## 为什么必须做（不做的话"全套示例"是空的）
 *
 * React 组件库的层级结构一大半靠复合子组件表达：antd 的表单没有 `Form.Item` 就没有标签与校验，
 * `Radio` 没有 `Radio.Group` 就不成群，`Layout` 没有 `Header/Sider/Content` 就只是个壳。
 * 而这些子组件**不在入口的值导出里**（`export { default as Form } from './form'` 只给了 `Form`），
 * 所以"按导出名挑"这条规矩天然看不见它们 —— 反过来，宿主注册表里也不会有 `antd:Form.Item`，
 * 运行期是**启动即报错**（这是好事：不是渲染成空盒子）。
 *
 * ## 怎么认（不猜）
 *
 * 复合子组件的表就写在各组件的 `index.d.ts` 里，形态固定：
 *
 *     type CompoundedComponent = InternalFormType & {
 *         Item: typeof Item;
 *         List: typeof List;
 *     };
 *     declare const Form: CompoundedComponent;
 *
 * 于是：在该模块的 `index.d.ts` 里取 `大写名: typeof 标识符` 的键值对（`_` 开头的是内部件，跳过）。
 * props 接口按 `${标识符}Props` → `${子名}Props` 两跳找（`Item`→`FormItemProps`、
 * `TextArea`→`TextAreaProps`、`Group`→`GroupProps`）；**都找不到就只给 `attrs?`** ——
 * 生成物仍然可用（手写 prop），只是没有编译期检查，这一点在报告里点名。
 */
function findSubcomponents(resolver, cand, entry, propsInfo) {
  const out = {};
  const mods = cand.spec ? resolver.resolveSpec(cand.spec, entry) : null;
  for (const mod of mods || []) {
    if (!mod || !/index\.d\.ts$/.test(mod.file)) continue;
    let text;
    try {
      text = fs.readFileSync(mod.file, 'utf8');
    } catch {
      continue;
    }
    const re = /^\s*([A-Z][A-Za-z0-9_]*)\s*:\s*typeof\s+([A-Za-z_$][\w$]*)\s*;/gm;
    let m;
    while ((m = re.exec(text))) {
      const sub = m[1];
      const target = m[2];
      const hit = findSubProps(resolver, mod.file, target, sub, cand.name);
      out[sub] = hit
        ? buildComponentProps(resolver, hit.flat, { typeName: hit.typeName, file: hit.file, via: hit.via }, cand)
        : { props: {}, props_interface: null, props_interface_via: 'none', unresolved_extends: [], unsupported_count: 0 };
      out[sub].target = target;
    }
  }
  return out;
}

/**
 * 子组件的 props 接口：**先在"这个子组件的来源模块"里找**，找不到才退到全库。
 *
 * `Item` → `FormItemProps`（不是 `ItemProps`！）：目标标识符的**来源模块**才是判据 ——
 * `Item` 从 `./FormItem` import 进来，于是 props 类型就在那个模块里。
 * 第一版直接按 `${target}Props` 去**全库**查，查到了另一个组件的 `ItemProps`
 * （antd 里 `ItemProps` 有好几份），于是 `Form.Item` 拿到 8 个不相干的 prop ——
 * 清单看起来是"有内容的"，但内容是错的。
 */
function findSubProps(resolver, file, target, sub, compName) {
  const parsed = resolver.files.get(file);
  if (!parsed) return null;

  // ① 目标标识符的**来源模块**（`import Item from './FormItem'` → `./FormItem`）
  const specs = new Set();
  for (const imp of parsed.imports) {
    if (imp.local !== target && imp.imported !== target) continue;
    specs.add(imp.spec);
  }
  const targetMods = [];
  for (const spec of specs) {
    const m = resolver.resolveSpec(spec, file);
    if (m) for (const x of m) if (x) targetMods.push(x);
  }

  // 候选名按"信息量"排：越具体越靠前，全部**限定在已知模块内**（scoped）——
  // 宁可退到"只给 attrs?"，也不要解到另一个组件的同名接口（那会静默给错 props）。
  const scopes = [...targetMods.map((m) => ({ file: m.file })), { file }];
  const names = [
    `${target}Props`, // Item → ItemProps（同模块里真的这么写时）
    `${compName}${sub}Props`, // Radio + Group → RadioGroupProps；Card + Meta → CardMetaProps
    `${sub}Props`, // TextArea → TextAreaProps；Group → GroupProps
  ];
  for (const scope of scopes) {
    for (const name of names) {
      const sym = resolver.lookup(name, scope.file, 0, { scoped: true });
      if (!sym) continue;
      const hit = tryFlat(resolver, name, sym.file);
      if (hit) return { ...hit, via: `scoped:${name}` };
    }
  }
  // ② 最后一档：目标模块里**任何** `*Props`（仍然 scoped —— 只在这一个模块内选）
  for (const m of targetMods) {
    const cands = (m.interfaces || [])
      .filter((it) => it.name.endsWith('Props'))
      .sort((a, b) => b.fields.length - a.fields.length);
    for (const it of cands) {
      const hit = tryFlat(resolver, it.name, m.file);
      if (hit) return { ...hit, via: `scoped:any-props(${it.name})` };
    }
  }
  return null;
}

function tryFlat(resolver, name, file) {
  const desc = resolver.evalType(name, { file, subs: new Map(), generics: new Set(), depth: 0 });
  const flat = resolver.materializeFields(desc, { file });
  if (flat.k !== 'fields') return null;
  return { typeName: name, file, flat };
}

/** 把一个压平后的 props 接口变成清单里的一个组件条目。 */
function buildComponentProps(resolver, flat, propsInfo, cand) {
  const byName = new Map();
  const props = {};
  const unsupported = [];

  const addField = (f, origin) => {
    const prev = byName.get(f.name);
    // 后声明覆盖前声明（TS 的语义：派生成员盖住基类成员），但把来源都留着
    byName.set(f.name, { ...f, origin, origins: [...(prev?.origins || []), origin] });
  };

  for (const f of flat.fields) addField(f, f.from || 'inline');

  // 泛型绑定：`SelectProps<ValueType>` 这类形参一律绑到 `any`（清单不追求泛型精度），
  // 但**必须绑** —— 不绑的话 `(value: ValueType) => void` 会被判成"解不开的类型"。
  const subMap = new Map(flat.subs || []);

  for (const [name, f] of byName) {
    if (name.startsWith('_') || (f.tags || []).some((t) => t === 'private' || t === 'internal')) {
      props[name] = { kind: 'internal', reason: 'underscore-or-annotated' };
      continue;
    }
    if (INTERNAL_PROPS.has(name)) {
      props[name] = { kind: 'internal', reason: 'internal-name' };
      continue;
    }
    const node = resolver.evalType(f.type, {
      file: f.file || propsInfo.file,
      subs: subMap,
      generics: new Set(f.generics || []),
      depth: 0,
    });
    const cls = classify(name, f.type, node, {});
    // ⚠️ 清单条目是**逐字段重建**的（不是把 `cls` 摊开），所以 `classify` 每多一个字段，
    //    就必须在下面**再写一行** —— 漏掉不会报错，只会让那个字段**静默消失**。
    //    实测代价（2026-10-02）：`children: string` 明明判成了 `deliver: 'raw'`，
    //    到清单里却没有 `deliver`，于是生成物仍然按"子节点"发 —— 症状在真机上，
    //    离这里隔着整个生成器（真因靠一个假包的探针才定住，见 `tools/libgen_probe.mjs`）。
    props[name] = {
      kind: cls.kind,
      ...(f.surface ? { surface: f.surface } : {}),
      ...(cls.eventKind ? { event_kind: cls.eventKind, event_reason: cls.reason } : {}),
      ...(cls.reason && cls.kind !== 'event' ? { reason: cls.reason } : {}),
      ...(cls.deliver ? { deliver: cls.deliver, deliver_from: cls.deliver_from } : {}),
      type: f.type.length > 200 ? f.type.slice(0, 200) + '…' : f.type,
      required: f.optional === false,
      ...((f.tags || []).length ? { tags: f.tags } : {}),
      from: f.origins && f.origins.length > 1 ? f.origins.join(' + ') : f.origin,
    };
    const ex = exposureOf(name, props[name]);
    props[name].exposed = ex.exposed;
    if (!ex.exposed && ex.reason) props[name].exposed_reason = ex.reason;
    if (props[name].kind === 'unsupported') {
      unsupported.push({ prop: name, reason: props[name].reason, type: props[name].type });
    }
  }

  return {
    props,
    props_interface: propsInfo.typeName,
    props_interface_via: propsInfo.via,
    unresolved_extends: (flat.unresolvedExtends || []).map((u) => ({
      ext: String(u.ext).slice(0, 120),
      why: u.why,
    })),
    unsupported_count: unsupported.length,
  };
}

module.exports = {
  buildManifest,
  findSubcomponents,
  exposureOf,
  REACT_SURFACE_ALLOW,
  findTypeEntry,
  findPackageDir,
  classify,
  unwrapUnionForClassification,
  INTERNAL_PROPS,
  REACT_RESERVED,
};
