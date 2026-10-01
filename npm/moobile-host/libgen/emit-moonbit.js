'use strict';
// emit-moonbit.js —— 由 manifest 生成**与 `@html` 平级的 MoonBit DSL 包**（PLAN 的 I3）。
//
// 目标写法（与 `@html.button(...)` **同款形状**）：
//
//     @antd.button(type_="primary", danger=true, on_click=emit(Bump), "加一条")
//     @antd.input(value=model.draft, on_change=e => emit(SetDraft(e.text())))
//
// 而不是 `@html.node("antd:Button", @html.Attrs::build().prop_str("type","primary"), "加一条")`。
//
// ## 三条已经实测过的形状约束（别重新发明）
//
// 1. **函数名必须小写**：`pub fn Button(...)` 是 parse error（大写开头在 MoonBit 里是类型名），
//    要大写只能 `pub struct Button` + `Button::new(...)`，反而更长。所以是 `@antd.button`。
// 2. `attrs?` + 具名可选参数 + `children : C`（`C : @html.IsChildren`）的签名能编，
//    产出的 `@html.Html` 能直接塞进 `@html.div([...])` —— 见
//    `examples/apps/antd-spike/generated_shape_probe.mbt`（本次之前的编译期探针）。
// 3. **每个 prop 一行**：靠包内私有的 `opt_*` 小助手把 `match` 收进函数体，
//    而不是把 `match` 摊在每个参数上 —— 2693 个参数摊开是 1.5 万行，收起来是 3 千行。
//
// ## 事件参数为什么有两种形态
//
// · **信号**（`on_click? : @cmd.Cmd`）—— 载荷里不是"这个组件的值"（鼠标、键盘、焦点…）；
// · **带值**（`on_change? : (@html.Payload) -> @cmd.Cmd`）—— 载荷就是组件的值
//   （`target.value` / `target.checked`），受控组件全靠它。
//
// 判定发生在 manifest 阶段（`event_kind` + `event_reason` 都写进清单，可复核）。
// 需要信号事件的载荷时（例如 `onKeyDown` 的按键），走 `attrs?` 逃生口 —— 文件头写明了。

/** MoonBit 关键字：撞上就加 `_` 后缀（与 `@html` 的 `type_` / `class_` 同款）。 */
const KEYWORDS = new Set([
  'as', 'assert', 'async', 'await', 'break', 'catch', 'class', 'const', 'continue',
  'defer', 'derive', 'else', 'enum', 'extern', 'false', 'fn', 'fnalias', 'for', 'guard',
  'if', 'impl', 'import', 'in', 'init', 'is', 'let', 'match', 'mut', 'noraise', 'not',
  'package', 'priv', 'pub', 'raise', 'return', 'self', 'static', 'struct', 'suberror',
  'test', 'throw', 'trait', 'true', 'try', 'type', 'typealias', 'using', 'while', 'with',
  'where', 'noraw', 'ffi',
]);

/** `onChange` → `on_change`；`QRCode` → `qr_code`；`type` → `type_`。 */
function snake(name) {
  let s = String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  if (/^[0-9]/.test(s)) s = `_${s}`;
  if (KEYWORDS.has(s)) s = `${s}_`;
  return s;
}

const MOON_TYPE = {
  str: 'String',
  bool: 'Bool',
  num: 'Double',
  json: 'String',
  reactnode: 'String',
};
const SETTER = {
  str: 'prop_str',
  bool: 'prop_bool',
  num: 'prop_num',
  json: 'prop_json',
  reactnode: 'prop_str',
};

/** 一个 prop 在生成物里的形态。 */
function paramOf(propName, p) {
  const name = snake(propName);
  if (p.kind === 'event') {
    return p.event_kind === 'value'
      ? { name, decl: `(@html.Payload) -> @cmd.Cmd`, setter: 'opt_payload', arg: `"${propName}"` }
      : { name, decl: `@cmd.Cmd`, setter: 'opt_cmd', arg: `"${propName}"` };
  }
  const base = MOON_TYPE[p.kind];
  const setter = SETTER[p.kind];
  if (!base || !setter) return null;
  return { name, decl: base, setter: `opt_${p.kind === 'reactnode' ? 'str' : p.kind}`, arg: `"${propName}"` };
}

/** 生成整份 MoonBit DSL 包（一个 `.mbt` 文件的内容）。 */
function emitMoonbit(manifest, opts = {}) {
  const ns = manifest.library.namespace;
  const components = Object.entries(manifest.components).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const usedSetters = new Set();
  const collisions = [];
  let paramTotal = 0;
  let hiddenTotal = 0;

  // 一个"生成单元"= 顶层组件或**复合子组件**。子组件的函数名带父前缀
  // （`form_item` / `radio_group` / `input_text_area`），标签是 `antd:Form.Item` ——
  // 与宿主注册表的键**逐字相同**，这是两侧同源那条判据的落脚点。
  const units = [];
  for (const [compName, comp] of components) {
    units.push({ key: compName, fnName: snake(compName), tag: `${ns}:${compName}`, comp, isSub: false });
    for (const [subName, sub] of Object.entries(comp.subcomponents || {})) {
      units.push({
        key: `${compName}.${subName}`,
        fnName: snake(`${compName}_${subName}`),
        tag: `${ns}:${compName}.${subName}`,
        comp: sub,
        isSub: true,
      });
    }
  }
  const fnSeen = new Map();
  const blocks = [];
  for (const unit of units) {
    const compName = unit.key;
    const comp = unit.comp;
    const fnName = unit.fnName;
    if (fnSeen.has(fnName)) {
      collisions.push(`函数名 ${fnName}：${compName} 与 ${fnSeen.get(fnName)} 同名`);
      continue;
    }
    fnSeen.set(fnName, compName);
    const params = [];
    const seen = new Map();
    const own = Object.entries(comp.props).filter(([, p]) => p.exposed);
    hiddenTotal += Object.keys(comp.props).length - own.length;
    const nonEvents = own.filter(([, p]) => p.kind !== 'event');
    const events = own.filter(([, p]) => p.kind === 'event');
    const ordered = [...nonEvents, ...events];
    for (const [propName, p] of ordered) {
      const param = paramOf(propName, p);
      if (!param) continue;
      if (seen.has(param.name)) {
        collisions.push(`${compName}: ${propName} 与 ${seen.get(param.name)} 都映射到 \`${param.name}\``);
        continue;
      }
      seen.set(param.name, propName);
      usedSetters.add(param.setter);
      params.push(param);
    }
    paramTotal += params.length;
    // 子组件在"没解到 props 接口"时**默认接受 children**：复合子组件基本都是容器
    // （`Layout.Header` / `Card.Grid` / `Typography.Title`），不给 children 反而没法用。
    const hasChildren =
      unit.isSub && !comp.props_interface
        ? true
        : !!(comp.props.children && comp.props.children.kind === 'children');

    const L = [];
    L.push('///|');
    L.push(
      unit.isSub
        ? `/// 复合子组件 \`${unit.tag}\`（Props 接口 \`${comp.props_interface || '无（只有 attrs?）'}\`）。`
        : `/// 组件库 \`${unit.tag}\`（Props 接口 \`${comp.props_interface}\`）。`,
    );
    L.push('///');
    L.push(
      `/// 参数 ${params.length} 个（清单里另有 ${Object.keys(comp.props).length - params.length} 个没有生成：` +
        `内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 \`exposed_reason\`）。`,
    );
    if (unit.isSub && !comp.props_interface) {
      L.push('///');
      L.push('/// ⚠️ 这个子组件**没找到 props 接口**（生成器只在它自己的模块里找，不跨组件猜）——');
      L.push('/// 于是只有 `attrs?`：prop 得手写（`@html.Attrs::build().prop_str(…)`），没有编译期检查。');
    }
    const unc = comp.unresolved_extends || [];
    if (unc.length) {
      L.push('///');
      L.push(`/// ⚠️ 继承链有 ${unc.length} 环解不开（${unc.map((u) => u.ext).join(' / ')}）——`);
      L.push('/// 这些基类上的 prop **不在**参数表里，需要时用 `attrs?` 手写。');
    }
    // ⚠️ `fn` 与函数名之间的空格不是排版问题：`pub fnalert(` 是 parse error 的来源。
    //    两种形态分别是 `pub fn[C : …] name(` 与 `pub fn name(` —— 别把空格也一起条件化。
    const sigHead = hasChildren ? 'pub fn[C : @html.IsChildren] ' : 'pub fn ';
    L.push(`${sigHead}${fnName}(`);
    for (const p of params) L.push(`  ${p.name}? : ${p.decl},`);
    L.push('  attrs? : @html.Attrs,');
    if (hasChildren) L.push('  children : C,');
    L.push(') -> @html.Html {');
    // ⚠️ 没有参数时不能写 `mut`：本仓库把 `unused_mut` 当**错误**（不是警告），
    //    而"只有 attrs?"的组件（子组件里最常见）确实一次都不改 `a`。
    L.push(params.length ? '  let mut a = match attrs {' : '  let a = match attrs {');
    L.push('    Some(x) => x.copy()');
    L.push('    None => @html.Attrs::build()');
    L.push('  }');
    for (const p of params) L.push(`  a = ${p.setter}(a, ${p.arg}, ${p.name})`);
    L.push(`  @html.node("${unit.tag}", a, ` + (hasChildren ? 'children)' : '([] : Array[@html.Html]))'));
    L.push('}');
    L.push('');
    blocks.push(L.join('\n'));
  }

  const head = [];
  head.push(`// 由 \`moobile-host libgen\` 生成 —— **不要手改**。`);
  head.push('//');
  head.push(`// 组件库：${manifest.library.package}@${manifest.library.version}（命名空间 \`${ns}:\`）`);
  head.push(`// 生成器：${manifest.$generator.tool} ${manifest.$generator.version}｜manifest 版本 ${manifest.$generator.manifest_version}`);
  head.push(`// 组件 ${components.length} 个｜生成的参数 ${paramTotal} 个｜未生成 ${hiddenTotal} 个`);
  head.push('//');
  head.push('// ## 怎么用');
  head.push('//');
  head.push('// ```moonbit');
  head.push(`// @${ns}.button(type_="primary", danger=true, on_click=emit(Bump), "加一条")`);
  head.push(`// @${ns}.input(value=model.draft, on_change=e => emit(SetDraft(e.text())))`);
  head.push('// ```');
  head.push('//');
  head.push('// ## 四条边界（都是实测的，不是猜测）');
  head.push('//');
  head.push('// 1. **写错 prop 名 = 编译错误**（这正是生成这套东西的主要收益）。');
  head.push('// 2. 名字**必须小写**：`pub fn Button(...)` 是 parse error（大写开头是类型名）。');
  head.push('// 3. 事件的两种参数形态：');
  head.push('//    · `on_click? : @cmd.Cmd` —— **信号**（鼠标/键盘/焦点…，载荷里没有"组件的值"）；');
  head.push('//    · `on_change? : (@html.Payload) -> @cmd.Cmd` —— **带值**（`e.text()` / `e.bool()` / `e.json()`）。');
  head.push('//    分类逐条写在 manifest 的 `event_kind` / `event_reason` 里，可复核。');
  head.push('// 4. **逃生口是 `attrs?`**：');
  head.push('//    · 没生成的 prop（React 公共属性的长尾、`aria-*`、`data-*`）→ `attrs=@html.Attrs::build().prop_str(...)`；');
  head.push('//    · 信号事件想读载荷（例如 `onKeyDown` 的按键）→ `attrs=@html.Attrs::build().on_raw("onKeyDown", …)`；');
  head.push('//    · 继承链解不开的基类 prop 也只能这么写。');
  head.push('//');
  head.push(`// 底层仍然是"字符串标签 + 命名空间"（\`@html.node("${ns}:X", …)\`）：`);
  head.push('// 生成器只是把这层写法抹掉了。名字指向哪个真实实现，仍然由宿主注册表决定 ——');
  head.push('// 这正是平台矩阵（同一命名空间按平台注册不同实现）还能成立的原因。');
  head.push('');
  head.push('// ── 包内私有助手：把 `match Some/None` 收进一个地方 ─────────────────────────');
  head.push('// 为什么要它们：不加的话，2693 个参数要摊开 1.5 万行 `match`。');
  head.push('// 它们**不是**公开 API（没有 `pub`），所以不会变成"我们承诺的接口面"。');
  head.push('');
  if (usedSetters.has('opt_str')) {
    head.push('///|');
    head.push('fn opt_str(a : @html.Attrs, key : String, v : String?) -> @html.Attrs {');
    head.push('  match v {');
    head.push('    Some(x) => a.prop_str(key, x)');
    head.push('    None => a');
    head.push('  }');
    head.push('}');
    head.push('');
  }
  if (usedSetters.has('opt_bool')) {
    head.push('///|');
    head.push('fn opt_bool(a : @html.Attrs, key : String, v : Bool?) -> @html.Attrs {');
    head.push('  match v {');
    head.push('    Some(x) => a.prop_bool(key, x)');
    head.push('    None => a');
    head.push('  }');
    head.push('}');
    head.push('');
  }
  if (usedSetters.has('opt_num')) {
    head.push('///|');
    head.push('fn opt_num(a : @html.Attrs, key : String, v : Double?) -> @html.Attrs {');
    head.push('  match v {');
    head.push('    Some(x) => a.prop_num(key, x)');
    head.push('    None => a');
    head.push('  }');
    head.push('}');
    head.push('');
  }
  if (usedSetters.has('opt_json')) {
    head.push('///|');
    head.push('/// 结构化值走 **JSON 文本**（`Payload` 之外的既有限制：`Attrs` 的值域只有');
    head.push('/// String / Bool / Int / Double）。宿主按 manifest 的 `jsonProps` 做 `JSON.parse`。');
    head.push('fn opt_json(a : @html.Attrs, key : String, v : String?) -> @html.Attrs {');
    head.push('  match v {');
    head.push('    Some(x) => a.prop_json(key, x)');
    head.push('    None => a');
    head.push('  }');
    head.push('}');
    head.push('');
  }
  if (usedSetters.has('opt_cmd')) {
    head.push('///|');
    head.push('fn opt_cmd(a : @html.Attrs, key : String, v : @cmd.Cmd?) -> @html.Attrs {');
    head.push('  match v {');
    head.push('    Some(c) => a.on_raw(key, _ => c)');
    head.push('    None => a');
    head.push('  }');
    head.push('}');
    head.push('');
  }
  if (usedSetters.has('opt_payload')) {
    head.push('///|');
    head.push('fn opt_payload(a : @html.Attrs, key : String, v : ((@html.Payload) -> @cmd.Cmd)?) -> @html.Attrs {');
    head.push('  match v {');
    head.push('    Some(f) => a.on_raw(key, f)');
    head.push('    None => a');
    head.push('  }');
    head.push('}');
    head.push('');
  }

  return { text: head.join('\n') + blocks.join('\n'), stats: { paramTotal, hiddenTotal, collisions } };
}

/** 生成该包的 `moon.pkg`。 */
function emitMoonPkg(manifest, opts = {}) {
  const htmlPkg = opts.htmlPackage || 'XiLaiTL/moobile/html';
  const cmdPkg = opts.cmdPackage || 'XiLaiTL/moobile/cmd';
  return [
    '// 由 `moobile-host libgen` 生成 —— **不要手改**。',
    '//',
    '// ⚠️ `supported_targets = "+js"` 是**必须**的，不是保守：',
    '//    事件走 `Attrs::on_raw`（`vendor/rabbita/html/payload.mbt`），而那个文件在',
    '//    `moon.pkg` 里被限定为 js 目标 —— 它的前提是"载荷是宿主递过来的 JS 值"。',
    '//    所有用得上组件库的目标（Web / RN）本来就都是 js。',
    'supported_targets = "+js"',
    '',
    'import {',
    `  "${htmlPkg}" @html,`,
    `  "${cmdPkg}" @cmd,`,
    '}',
    '',
  ].join('\n');
}

module.exports = { emitMoonbit, emitMoonPkg, snake, paramOf };
