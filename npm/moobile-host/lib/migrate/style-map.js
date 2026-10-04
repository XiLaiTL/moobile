// style-map.js —— F2 的核心：**CSS 声明 → `@style` 调用**的映射表。
//
// ## 这个文件的唯一责任
//
// 对每一条 CSS 声明给出两种结果之一：
//
//   ① 变成一串 `@style` 方法调用（`.font_size(14.0)`），或
//   ② 明确记为**有损**，并写清"为什么它没有对应物"。
//
// **没有第三种结果。** 这条规矩是这一层能被信任的前提：只要存在"我悄悄跳过了"这种可能，
// 迁移报告就不再是一份清单，而是一份"我以为的清单" —— 而它恰恰是要用来兜住"静默失效"的。
// 对账由 `style-emit.js` 强制（`声明数 = 已映射 + 有损`，不闭合就抛）。
//
// ## 为什么"有损"这么多是**对的**
//
// `style/style.mbt` 的属性集是**刻意封闭**的（"可移植子集优先于表达力"，设计文档原则 3）：
// 没有 `grid`、没有 `position:sticky`、没有 `transform`、没有 `box-shadow`、没有 `::before`，
// 因为这些在 RN 与 Web 上没有共同语义。所以 CSS 里那些属性**不是"我们忘了实现"**，
// 而是"这个框架明确不表达它们"。把它们逐条点名（而不是假装映射过去），正是迁移工具的价值。
//
// ## 实测口径（`interest/yi` 的 476 行 CSS，2026-10 测量）
//
// 类规则里出现 **46 个不同属性**：能机械映射的占绝大多数（颜色/字号/间距/flex/边框/圆角…），
// 必然有损的是 `display:grid`、`position:sticky`、`transform`、`box-shadow`、`transition`、
// `cursor`、`width:min(...)`、`border-radius:50%`、`font-family` 的**回退链**这几类。

/** MoonBit 的 Double 字面量写法：整数要补 `.0`（`16` 会被当成 Int）。 */
function d(n) {
  if (!Number.isFinite(n)) return null;
  return Number.isInteger(n) ? `${n}.0` : String(n);
}

/** MoonBit 的字符串字面量（转义 `"` 与 `\`）。 */
function q(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/**
 * 从 `grid-template-columns` 里认出**列宽（px）** —— 只认这一种写法：
 *
 *   `repeat(auto-fill, minmax(116px, 1fr))` / `repeat(auto-fit, minmax(96px, 1fr))`
 *
 * 认不出返回 `null`（调用方据此记有损）——**不做近似**，理由与 `dim()` 一样：
 * 猜错的值会静默画歪，而报错不会。
 */
function gridCellBasis(v) {
  const m = String(v)
    .trim()
    .match(/^repeat\(\s*(?:auto-fill|auto-fit)\s*,\s*minmax\(\s*(\d+(?:\.\d+)?)px\s*,\s*1fr\s*\)\s*\)$/i);
  return m ? Number(m[1]) : null;
}

/** `press:` 前缀（与 `style/style.mbt` 的 `press_prefix` 同一个字符串）。 */
const PRESS_PREFIX = 'press:';

/** 单个数值字面量（不带单位）：`1`、`1.65`、`-1`。 */
function num(v) {
  const s = String(v).trim();
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return d(Number(s));
}

/**
 * 长度 → `@style.Dimension` 表达式。**不认识的一律返回 null**（由调用方记有损），
 * 不做"猜一个近似值"这种事 —— 猜错的值会静默地画歪，而报错不会。
 *
 * 已经排除掉的写法（都在这套技术栈里真实出现过）：
 *   `min(94vw, 720px)` / `calc(...)` / `vw` / `vh` —— RN 没有"相对视口"这一层；
 *   `em` 用在宽度上 —— RN 的宽度不认字号相对值。
 */
function dim(v) {
  const s = String(v).trim();
  if (s === '0') return '@style.px(0.0)';
  if (s === 'auto') return '@style.auto()';
  let m = s.match(/^(-?(?:\d+\.?\d*|\.\d+))px$/);
  if (m) return `@style.px(${d(Number(m[1]))})`;
  m = s.match(/^(-?(?:\d+\.?\d*|\.\d+))%$/);
  if (m) return `@style.pct(${d(Number(m[1]))})`;
  return null;
}

/** 纯数字（无单位）→ MoonBit Double。`line-height: 1.65`、`flex: 1`、`opacity: .5` 走这条。 */
function unitless(v) {
  const s = String(v).trim();
  if (s === '') return null;
  const n = num(s);
  return n === null ? null : n;
}

/** `em` 比例（`letter-spacing: .32em` → 0.32）。 */
function emRatio(v) {
  const m = String(v).trim().match(/^(-?(?:\d+\.?\d*|\.\d+))e?m$/i);
  return m ? Number(m[1]) : null;
}

/**
 * 颜色 —— 一律**原样**变成字符串字面量。
 *
 * 不解析成 RGB 三元组：`@style` 的颜色接口收的就是字符串，而 RN 与 CSS 都认
 * `#rrggbb` / `rgba(...)` / `transparent`。多做一次解析只多一个出错的地方。
 */
function color(v) {
  const s = String(v).trim();
  if (!s) return null;
  if (s === 'transparent' || s === 'currentColor' || s === 'inherit') return null;
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return q(s);
  // `rgba(26,20,16,.10)` → 补上前导 0（RN 的颜色解析器对 `.10` 这种写法不保证认）
  const rgba = s.match(/^rgba?\(([^)]*)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(',').map((x) => x.trim().replace(/^\.(\d)/, '0.$1'));
    return q(`${/^rgba/i.test(s) ? 'rgba' : 'rgb'}(${parts.join(',')})`);
  }
  // 具名颜色（`white`）原样带过去
  if (/^[a-z]+$/i.test(s)) return q(s);
  return null;
}

/** 枚举表：CSS 关键字 → `@style` 的构造器表达式。 */
const ENUMS = {
  'flex-direction': {
    row: '@style.FlexDirection::Row',
    column: '@style.FlexDirection::Column',
    'row-reverse': '@style.FlexDirection::RowReverse',
    'column-reverse': '@style.FlexDirection::ColumnReverse',
  },
  'flex-wrap': {
    nowrap: '@style.FlexWrap::NoWrap',
    wrap: '@style.FlexWrap::Wrap',
    'wrap-reverse': '@style.FlexWrap::WrapReverse',
  },
  'align-items': {
    'flex-start': '@style.Align::FlexStart',
    start: '@style.Align::FlexStart', // ⚠️ webkit 写法，语义同 flex-start
    'flex-end': '@style.Align::FlexEnd',
    end: '@style.Align::FlexEnd',
    center: '@style.Align::Center',
    stretch: '@style.Align::Stretch',
    baseline: '@style.Align::Baseline',
  },
  'align-self': {
    auto: '@style.AlignSelf::Auto',
    'flex-start': '@style.AlignSelf::FlexStart',
    start: '@style.AlignSelf::FlexStart',
    'flex-end': '@style.AlignSelf::FlexEnd',
    end: '@style.AlignSelf::FlexEnd',
    center: '@style.AlignSelf::Center',
    stretch: '@style.AlignSelf::Stretch',
    baseline: '@style.AlignSelf::Baseline',
  },
  'justify-content': {
    'flex-start': '@style.Justify::FlexStart',
    start: '@style.Justify::FlexStart',
    'flex-end': '@style.Justify::FlexEnd',
    end: '@style.Justify::FlexEnd',
    center: '@style.Justify::Center',
    'space-between': '@style.Justify::SpaceBetween',
    'space-around': '@style.Justify::SpaceAround',
    'space-evenly': '@style.Justify::SpaceEvenly',
  },
  position: { relative: '@style.Position::Relative', absolute: '@style.Position::Absolute' },
  overflow: {
    visible: '@style.Overflow::Visible',
    hidden: '@style.Overflow::Hidden',
    scroll: '@style.Overflow::Scroll',
    auto: '@style.Overflow::Scroll',
  },
  'text-align': {
    auto: '@style.TextAlign::Auto',
    left: '@style.TextAlign::Left',
    right: '@style.TextAlign::Right',
    center: '@style.TextAlign::Center',
    justify: '@style.TextAlign::Justify',
  },
  'font-style': { normal: '@style.FontStyle::Normal', italic: '@style.FontStyle::Italic' },
  'text-transform': {
    none: '@style.TextTransform::None',
    uppercase: '@style.TextTransform::Uppercase',
    lowercase: '@style.TextTransform::Lowercase',
    capitalize: '@style.TextTransform::Capitalize',
  },
  'white-space': {
    normal: '@style.WhiteSpace::Normal',
    nowrap: '@style.WhiteSpace::NoWrap',
    pre: '@style.WhiteSpace::Pre',
    'pre-wrap': '@style.WhiteSpace::PreWrap',
    'pre-line': '@style.WhiteSpace::PreWrap', // ⚠️ 近似：pre-line 会合并空白，RN 的 PreWrap 不会
  },
  'border-style': {
    solid: '@style.BorderStyle::Solid',
    dotted: '@style.BorderStyle::Dotted',
    dashed: '@style.BorderStyle::Dashed',
  },
  'text-decoration-style': {
    solid: '@style.TextDecorationStyle::Solid',
    dotted: '@style.TextDecorationStyle::Dotted',
    dashed: '@style.TextDecorationStyle::Dashed',
    double: '@style.TextDecorationStyle::Double_',
  },
};

/** 字重的四种写法（数字 / 关键字）都收敛到同一个枚举。 */
function fontWeight(v) {
  const s = String(v).trim().toLowerCase();
  const table = {
    normal: '@style.FontWeight::Normal',
    bold: '@style.FontWeight::Bold',
    bolder: '@style.FontWeight::W700', // ⚠️ 相对值只能取一个近似档
    lighter: '@style.FontWeight::W300',
  };
  if (table[s]) return table[s];
  const n = Number(s);
  if (Number.isFinite(n) && n >= 100 && n <= 900) {
    const step = Math.round(n / 100) * 100;
    return `@style.FontWeight::W${step}`;
  }
  return null;
}

/** 一条 `prop: value` 的映射结果。 */
function loss(reason) {
  return { calls: [], loss: reason, notes: [] };
}
function mapped(calls, notes = []) {
  return { calls, loss: null, notes };
}

/**
 * ★ **把分边的 `border-*-style` 折成四边共用的 `borderStyle`**（2026-10-23 新增）。
 *
 * 为什么要有：原生 RN **只有**四边共用的 `borderStyle`，没有 `borderTopStyle` 这些
 * （登记表实测：`tools/style_platform_check.mjs`）⇒ `border-top: 1px dashed …` 迁过来之后
 * 在真机上**按默认的 `solid` 画**（web 上是对的，因为 RNW 当 CSS 照收）。
 * 而"有宽度的那些边共用同一个 style"时，发一次 `borderStyle` 是**等价**的
 * （没宽度的边画不出线，它的 style 是什么都不影响）⇒ 可以自动折。
 *
 * ⚠️ **不能折的情形必须留着**：`border-left: 2px solid` + `border-top: 1px dashed`
 * 这两条边**都有宽度、style 不同** ⇒ 四边共用的那个键**表达不了**它（真机上必然有一边画错）。
 * 这时候**不许折**，照旧发分边的调用 + 一句"这条在真机上不生效"的说明（让人知道要看这里）。
 *
 * 返回值：
 *   · `null` —— 没有可折的东西（没有分边 style，或者折了等于没折）；
 *   · `{ folded: true, expr, replace: Set, carrier, note }` —— 折得动：
 *     `replace` 里的属性**只去掉它的分边 style 调用**（shorthand 的宽度/颜色照旧发），
 *     `carrier` 那个属性把 `.border_*_style(…)` **就地换成** `.border_style(expr)`；
 *     ⚠️ 若四边共用的那个键**已经是同一个值**，则 `expr === null`、只删不补（纯去冗余）。
 *   · `{ folded: false, reason }` —— 看得见分边 style，但**不满足**折叠条件（要留说明）。
 *
 * @param {Map<string, any>} decls 这一格的声明（prop → {value,…}）
 */
function planBorderStyleFold(decls) {
  // ⚠️ 两个**只为判据门存在**的开关（`tools/border_fold_check.mjs` 的证伪用；默认都关）。
  //    别在产物生成里用它们 —— 打开 `ALL` 会把"折不动"的那些也折掉（那正是要防的假修）。
  if (process.env.MOBILE_NO_BORDER_FOLD === '1') return null;
  const SIDES = ['top', 'right', 'bottom', 'left'];
  const pxOf = (v) => {
    const m = String(v).trim().match(/^(-?(?:\d+\.?\d*|\.\d+))px$/);
    return m ? Number(m[1]) : null;
  };
  /** 一条 `border[-side]` 简写里认出 px 宽度与 style 枚举。 */
  const parseShorthand = (v) => {
    const out = { width: null, style: null };
    for (const p of String(v).split(/\s+/).filter(Boolean)) {
      const n = pxOf(p);
      if (n !== null && out.width === null) {
        out.width = n;
        continue;
      }
      const e = ENUMS['border-style'][p.toLowerCase()];
      if (e && out.style === null) out.style = e;
    }
    return out;
  };
  // 四边基准（`border-style` / `border` 简写）
  const baseProp = decls.has('border-style') ? 'border-style' : decls.has('border') ? 'border' : null;
  const baseStyle = baseProp
    ? baseProp === 'border-style'
      ? ENUMS['border-style'][String(decls.get(baseProp).value).trim().toLowerCase()] || null
      : parseShorthand(decls.get(baseProp).value).style
    : null;
  const baseWidth = decls.has('border-width')
    ? pxOf(decls.get('border-width').value)
    : decls.has('border')
      ? parseShorthand(decls.get('border').value).width
      : null;

  const info = {};
  for (const s of SIDES) {
    const long = `border-${s}-style`;
    const short = `border-${s}`;
    let style = null;
    let carrier = null;
    if (decls.has(long)) {
      style = ENUMS['border-style'][String(decls.get(long).value).trim().toLowerCase()] || null;
      carrier = style ? long : null;
    } else if (decls.has(short)) {
      style = parseShorthand(decls.get(short).value).style;
      carrier = style ? short : null;
    }
    let width = baseWidth;
    if (decls.has(`border-${s}-width`)) width = pxOf(decls.get(`border-${s}-width`).value);
    if (decls.has(short)) {
      const w = parseShorthand(decls.get(short).value).width;
      if (w !== null) width = w;
    }
    info[s] = { style, carrier, width: width === null ? 0 : width };
  }
  const styled = SIDES.filter((s) => info[s].style !== null);
  if (!styled.length) return null; // 一条分边 style 都没有：不关这条规则的事

  // 每边的"有效 style"：分边声明的 > 四边共用的 > 原生默认（solid）
  const SOLID = ENUMS['border-style'].solid;
  const eff = (s) => info[s].style || baseStyle || SOLID;
  const bearing = SIDES.filter((s) => info[s].width > 0);
  // ⚠️ "这几条边都没有宽度"是**独立的一种情形**：画不出线 ⇒ 分边 style 折与不折**外观一样**，
  //    但它**也折不成**（`borderStyle` 是四边共用的，而这里几条边的 style 可能不同）。
  //    以前这里会掉进下面那条"不生效"的通用说明 —— 那是一句**会吓人的假话**（明明什么都没画）。
  //    （2026-10-23 写判据时想到的：判据要能把"没影响"与"画错了"分开。）
  if (!bearing.length) {
    return {
      folded: false,
      reason:
        '⚠️ 这几条分边 style **都没有宽度**（`border-*-width` 缺省是 0）⇒ **画不出线**，' +
        `分边 style 折与不折**外观一样**（${styled.map((s) => s).join(' / ')}）—— 这条不是缺陷，只是记一笔。` +
        '判据：`tools/border_fold_check.mjs`',
    };
  }
  const targets = [...new Set(bearing.map(eff))];
  if (targets.length > 1 && process.env.MOBILE_BORDER_FOLD_ALL !== '1') {
    return {
      folded: false,
      reason:
        `⚠️ 分边的 style 在原生 RN 上没有对应物（只有四边共用的 \`borderStyle\`），而这几边**都带宽度、style 不同**` +
        `（${bearing.map((s) => `${s}=${eff(s).replace('@style.BorderStyle::', '')}`).join(' / ')}）` +
        '⇒ **折不成**四边共用的那个键 ⇒ **真机上这些分边 style 不生效**（按默认的 `solid` 画）。' +
        '（要修只能改设计：把这几边改成同一个 style，或者在 Model 里换成别的画法。）判据：`tools/border_fold_check.mjs`',
    };
  }
  const target = targets[0];
  const dropStyling = new Set(styled.map((s) => info[s].carrier));
  const carrier = styled.map((s) => info[s].carrier).find((p) => p.startsWith('border-') && p.split('-').length === 3 && p.endsWith('-style'))
    || styled.map((s) => info[s].carrier)[0];
  const pureDrop = baseStyle === target; // 四边共用那个键已经是这个值 ⇒ 只删不补
  return {
    folded: true,
    expr: pureDrop ? null : target,
    carrier,
    replace: dropStyling,
    note:
      `分边 style 折成四边共用的 \`borderStyle(${target.replace('@style.BorderStyle::', '')})\`` +
      `（原生 RN 只有四边共用那一个键；没宽度的边画不出线、style 不影响 ⇒ **等价**）` +
      (pureDrop ? ' —— 四边共用那个键**已经是这个值**，所以分边那条是**纯冗余**，删掉不丢东西。' : '。') +
      '判据：`tools/border_fold_check.mjs`',
  };
}


/**
 * ★ **原生 RN 不认 / 只有 iOS 的样式键**（2026-10-23 实测，逐条在真 RN 的登记表上核过）——
 * 把事实与"**对应物**"写进**生成的产物里**（函数头 + 报告），而不只是写在文档里。
 *
 * 为什么值得占一行注释：这类洞的形状是"**web 绿、真机红**" ——
 * `react-native-web` 当 CSS 照单全收，原生 RN **静默不认**（不报错、不崩、判据全绿），
 * 所以只有把话说到用户会看的地方（他产物里那一格），才有机会被发现。
 * 真实测到的**影响面**：`examples/apps/zhouyi-reader` 的产物里 **11 处**
 * （`border_*_style` 8 处来自 `border-top: 1px dashed …` 这类简写 + `white_space` 3 处），
 * 而同一个应用在 web 上 103 条判据全过。
 *
 * ⚠️ 判据在 `tools/style_platform_check.mjs`：库能产出的每一个"原生不认"的键都必须在那张表里
 * 登记（写清 why 与 instead），RN 哪天支持了它也会红（表过期）。
 */
const BORDER_SIDE_NOTE = (key) =>
  `⚠️ 原生 RN 只有**四边共用**的 \`borderStyle\`，没有分边的 \`${key}\` ⇒ **真机上这一条不生效**` +
  '（那边按默认的 `solid` 画）。对应物：当"有宽度的那些边"共用同一个 style 时，发一次 `borderStyle` 是等价的' +
  '（`border-top: 1px dashed …` 这类只有一边有宽度的写法，合成是安全的）—— **这种情形现在会被自动折叠**' +
  '（`planBorderStyleFold`），所以走到这条说明就说明**折不动**（几条带宽度的边 style 不同）。' +
  '判据：`tools/border_fold_check.mjs`';

const NATIVE_GAP_NOTES = {
  'white-space':
    '⚠️ 原生 RN **没有** `whiteSpace` 这个键（`react-native-web` 有）⇒ **真机上这一条不生效**。' +
    '对应物（部分有）：`nowrap` 的 RN 惯例是 `Text` 的 `numberOfLines(1)`' +
    '（语义**不完全相同**：那是截断、还会带省略号，不是"不折行"）；' +
    '`pre-line` / `pre-wrap` 的语义**接近** RN `Text` 的默认行为（保留换行符），差距要真机才量得准。' +
    '判据：`tools/style_platform_check.mjs`',
  order:
    '⚠️ 原生 RN **没有** `order`（Yoga 不支持 flexbox 的 order，RN 那边标 not_planned）⇒ **真机上不生效**。' +
    '对应物：**样式层没有** —— 要在 **Model 里把顺序排好**（与 `@media` 同一档）。' +
    '判据：`tools/style_platform_check.mjs`',
  'border-top-style': BORDER_SIDE_NOTE('borderTopStyle'),
  'border-right-style': BORDER_SIDE_NOTE('borderRightStyle'),
  'border-bottom-style': BORDER_SIDE_NOTE('borderBottomStyle'),
  'border-left-style': BORDER_SIDE_NOTE('borderLeftStyle'),
  'text-decoration-style':
    '⚠️ 这个键**只有 iOS** 实现（Android 上静默不生效）—— 它在 RN 的登记表里，但安卓侧没有对应物。' +
    '判据：`tools/style_platform_check.mjs`',
  'text-decoration-color':
    '⚠️ 这个键**只有 iOS** 实现（Android 上静默不生效）；安卓的 `TextPaint` 没有"下划线颜色"这个概念，' +
    '只能接受系统默认。判据：`tools/style_platform_check.mjs`',
};

/** 这条属性有没有"原生缺口"要写进产物；有就返回一条 note。 */
function nativeGapNotes(prop) {
  const n = NATIVE_GAP_NOTES[prop];
  return n ? [n] : [];
}

/**
 * 把一条声明映射成 `@style` 调用串（或"有损"）。
 *
 * @param {string} prop 已小写化的属性名
 * @param {string} value 已展开过 `var()` 的值
 * @param {{emWithoutFontSize?: boolean}} [ctx]
 */
function mapDeclaration(prop, value, ctx = {}) {
  const v = String(value).trim();

  // ── 按下态（`press:` 前缀）────────────────────────────────────────────────────
  //
  // 生成器把源 CSS 的 `:hover` 规则改写成"同一个元素 + `press:` 前缀的键"
  // （见 `style-emit.js` 的 hover hook）。这里把前缀剥掉、按普通声明映射，
  // 再把结果包一层 `.press()` —— 于是**同一个映射表**同时服务常态与按下态，
  // 不会出现"按下态支持哪些属性"这第二张表（那种表一定会漂）。
  //
  // 嵌套的 `press:` 直接拒绝：`.press()` 不该出现两次。
  if (prop.startsWith(PRESS_PREFIX)) {
    const inner = prop.slice(PRESS_PREFIX.length);
    if (inner.startsWith(PRESS_PREFIX)) return loss(`${prop} —— press: 不能嵌套`);
    const r = mapDeclaration(inner, value, ctx);
    if (r.loss) {
      return { calls: [], loss: `${prop}:${v} —— 按下态里的这一条没能映射：${r.loss}`, notes: [] };
    }
    // ⚠️ 这里只给调用串打一个**标记**（前导 `.press()`），标记"这一段属于按下态" ——
    //    链里三段的先后由 `emitModule` **一处**排（`hover 在前 → .press() → 常态在后`），
    //    本函数不管排布。为什么合并成一次 `.press()` 不在这一层做：排布是链路的事，
    //    两处各排一次一定会漂 —— 而 `Style::press` 是给**它前面**的键加前缀，位置写错
    //    就是常态与按下态**整体互换**（2026-10-23 实测踩到，见 `emitModule` 那段注释）。
    //    第一版在这里逐条 wrap 却没让 `emitModule` 拆标记，产物成了
    //    `.,.press(),border_color("#x")` —— 编都编不过。
    return {
      calls: ['.press()' + r.calls.join('')],
      loss: null,
      notes: [`${prop} ⇒ 按下态：${r.calls.join('')}`].concat(r.notes || []),
    };
  }

  // ── 枚举类：表里有就直接查 ──────────────────────────────────────────────────
  if (ENUMS[prop]) {
    let key = v.toLowerCase();
    if (prop === 'overflow') key = key.split(/\s+/)[0];
    const expr = ENUMS[prop][key];
    if (expr) {
      const method = prop.replace(/-([a-z])/g, (_, c) => '_' + c).replace('_style', '_style');
      return mapped([`.${method}(${expr})`], nativeGapNotes(prop));
    }
  }

  switch (prop) {
    // ── 布局 ────────────────────────────────────────────────────────────────
    case 'display': {
      const k = v.toLowerCase();
      if (k === 'flex') {
        // ⚠️ **这一条是 CSS 与 RN 最容易静默不一致的地方**：CSS 里 `display:flex` 的主轴
        // 默认是 **row**，而 RN 里 flexDirection 默认是 **column**。只写 `.display(Flex)`
        // 会让所有横向排布**变成纵向** —— 而且不报错。所以这里必须把 Row 显式写出来。
        return mapped(
          ['@style.Display::Flex'].map((e) => `.display(${e})`).concat('.flex_direction(@style.FlexDirection::Row)'),
          ['display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column'],
        );
      }
      if (k === 'none') return mapped(['.display(@style.Display::Hidden)']);
      if (k === 'grid') {
        // 见 `grid-template-columns` 那一段的长注释：grid 在 RN 里没有对应物，
        // 降级成"能换行的行 flex"。**列宽不在这里**（写在子项上，由 `mapClass` 补）。
        return mapped(
          [
            '.display(@style.Display::Flex)',
            '.flex_direction(@style.FlexDirection::Row)',
            '.flex_wrap(@style.FlexWrap::Wrap)',
          ],
          [
            'display:grid 降级成 flex(row) + flex_wrap(wrap)：RN 没有 grid；列宽由子项的 min_width + flex_grow 表达（见 mapClass 的 isGridCell）',
          ],
        );
      }
      return loss(
        `display:${k} —— \`@style\` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）`,
      );
    }
    case 'flex-direction':
    case 'flex-wrap':
    case 'align-items':
    case 'align-self':
    case 'justify-content':
      return loss(`${prop}:${v} —— 取值不在 \`@style\` 的枚举里`);

    case 'flex': {
      const n = unitless(v);
      if (n !== null) return mapped([`.flex(${n})`]);
      const parts = v.split(/\s+/);
      const grow = num(parts[0]);
      if (grow !== null && parts.length === 1) return mapped([`.flex(${grow})`]);
      if (grow !== null) {
        const calls = [`.flex_grow(${grow})`];
        const shrink = num(parts[1]);
        if (shrink !== null) calls.push(`.flex_shrink(${shrink})`);
        const basis = parts[2] ? dim(parts[2]) : null;
        if (basis) calls.push(`.flex_basis(${basis})`);
        return mapped(calls);
      }
      if (v === 'auto') return mapped(['.flex(1.0)'], ['flex:auto 近似成 flex(1)']);
      if (v === 'none') return mapped(['.flex_grow(0.0).flex_shrink(0.0)']);
      return loss(`flex:${v} —— 无法解析成 flexGrow/Shrink/Basis 三元组`);
    }
    case 'flex-grow': {
      const n = unitless(v);
      return n === null ? loss(`flex-grow:${v}`) : mapped([`.flex_grow(${n})`]);
    }
    case 'flex-shrink': {
      const n = unitless(v);
      return n === null ? loss(`flex-shrink:${v}`) : mapped([`.flex_shrink(${n})`]);
    }
    case 'flex-basis': {
      const e = dim(v);
      return e ? mapped([`.flex_basis(${e})`]) : loss(`flex-basis:${v} —— 不是 px/%/auto`);
    }
    case 'order': {
      const n = unitless(v);
      return n === null ? loss(`order:${v}`) : mapped([`.order(${n})`], nativeGapNotes('order'));
    }

    // ── 定位 ────────────────────────────────────────────────────────────────
    case 'position':
      return loss(
        `position:${v} —— \`@style\` 只有 Relative / Absolute；sticky / fixed 在 RN 上没有对应物`,
      );
    case 'top':
    case 'right':
    case 'bottom':
    case 'left': {
      const e = dim(v);
      if (!e) return loss(`${prop}:${v} —— 不是 px/%/auto`);
      const method = prop === 'right' ? 'right_' : prop;
      return mapped([`.${method}(${e})`]);
    }
    case 'z-index': {
      const n = unitless(v);
      return n === null ? loss(`z-index:${v}`) : mapped([`.z_index(${n})`]);
    }

    // ── 尺寸 ────────────────────────────────────────────────────────────────
    case 'width':
    case 'height':
    case 'min-width':
    case 'max-width':
    case 'min-height':
    case 'max-height': {
      const e = dim(v);
      if (!e) {
        return loss(
          `${prop}:${v} —— 只支持 px / % / auto（\`calc\` \`min\` \`max\` \`vw\` \`vh\` 与 em 在 RN 上没有对应物）`,
        );
      }
      return mapped([`.${prop.replace(/-/g, '_')}(${e})`]);
    }
    case 'aspect-ratio': {
      const n = unitless(v);
      return n === null ? loss(`aspect-ratio:${v}`) : mapped([`.aspect_ratio(${n})`]);
    }
    case 'gap':
    case 'row-gap':
    case 'column-gap': {
      const n = unitless(v.replace(/px$/, ''));
      if (n === null) return loss(`${prop}:${v}`);
      return mapped([`.${prop.replace(/-/g, '_')}(${n})`]);
    }

    // ── 盒模型（简写要展开成 4 个方向）────────────────────────────────────────
    case 'margin':
    case 'padding':
      return mapBoxShorthand(prop, v);

    case 'margin-top':
    case 'margin-bottom':
    case 'margin-left':
    case 'margin-right':
    case 'padding-top':
    case 'padding-bottom':
    case 'padding-left':
    case 'padding-right': {
      const e = dim(v);
      if (!e) return loss(`${prop}:${v} —— 不是 px/%/auto`);
      return mapped([`.${prop.replace(/-/g, '_')}(${e})`]);
    }

    // ── 边框 ────────────────────────────────────────────────────────────────
    case 'border':
      return mapBorderShorthand('border', v);
    case 'border-top':
    case 'border-right':
    case 'border-bottom':
    case 'border-left':
      return mapBorderShorthand(prop, v);
    case 'border-width': {
      const n = num(v.replace(/px$/, ''));
      if (n === null || !/px$/.test(v)) return loss(`border-width:${v} —— 只支持 px`);
      return mapped([`.border_width(${n})`]);
    }
    case 'border-top-width':
    case 'border-right-width':
    case 'border-bottom-width':
    case 'border-left-width': {
      const n = num(v.replace(/px$/, ''));
      if (n === null) return loss(`${prop}:${v}`);
      return mapped([`.${prop.replace(/-/g, '_')}(${n})`]);
    }
    case 'border-color': {
      const c = color(v);
      return c ? mapped([`.border_color(${c})`]) : loss(`border-color:${v} —— 不是颜色`);
    }
    case 'border-top-color':
    case 'border-right-color':
    case 'border-bottom-color':
    case 'border-left-color': {
      const c = color(v);
      return c ? mapped([`.${prop.replace(/-/g, '_')}(${c})`]) : loss(`${prop}:${v}`);
    }
    case 'border-top-style':
    case 'border-right-style':
    case 'border-bottom-style':
    case 'border-left-style': {
      // 这些是**简写的一部分**，单独出现时走同一张枚举表
      const expr = ENUMS['border-style'][v.toLowerCase()];
      if (!expr) return loss(`${prop}:${v}`);
      return mapped([`.${prop.replace(/-/g, '_')}(${expr})`], nativeGapNotes(prop));
    }
    case 'border-radius':
    case 'border-top-left-radius':
    case 'border-top-right-radius':
    case 'border-bottom-left-radius':
    case 'border-bottom-right-radius':
      return mapBorderRadius(prop, v);

    // ── 颜色 / 背景 ─────────────────────────────────────────────────────────
    case 'background':
    case 'background-color': {
      const c = color(v);
      if (c) {
        const notes = prop === 'background' ? ['background 简写只取到了颜色那一部分'] : [];
        return mapped([`.background_color(${c})`], notes);
      }
      return loss(
        `background:${v} —— 只支持纯色（渐变 / 图片 / 多重背景在 RN 上没有对应物）`,
      );
    }
    case 'opacity': {
      const n = unitless(v);
      return n === null ? loss(`opacity:${v}`) : mapped([`.opacity(${n})`]);
    }

    // ── 文字 ────────────────────────────────────────────────────────────────
    case 'color': {
      const c = color(v);
      return c ? mapped([`.color(${c})`]) : loss(`color:${v} —— 不是颜色（inherit/currentColor 在 RN 上由继承决定）`);
    }
    case 'font-size': {
      const m = String(v).match(/^(-?(?:\d+\.?\d*|\.\d+))px$/);
      if (!m) return loss(`font-size:${v} —— 只支持 px`);
      return mapped([`.font_size(${d(Number(m[1]))})`]);
    }
    case 'font-weight': {
      const e = fontWeight(v);
      return e ? mapped([`.font_weight(${e})`]) : loss(`font-weight:${v} —— 不是 100–900 / normal / bold`);
    }
    case 'font-family': {
      if (/^inherit$/i.test(v)) return loss('font-family:inherit —— RN 的字体不继承');
      const first = v.split(',')[0].trim().replace(/^["']|["']$/g, '');
      if (!first) return loss(`font-family:${v}`);
      return mapped(
        [`.font_family(${q(first)})`],
        [
          `font-family 只取回退链的第一项（${first}）：RN 没有回退链，**设备上必须真有这个字**` +
            (/,/.test(v) ? '，其余候选已丢弃' : ''),
        ],
      );
    }
    case 'line-height': {
      const n = unitless(v);
      if (n !== null) {
        // ⚠️ **无单位行高在两边语义不同，这里必须换算，不能原样搬**（2026-10 实测）：
        //   CSS 里 `line-height: 1.65` 是**倍数**；RN / RNW 里 `lineHeight: 1.65` 是
        //   **点数** —— 实测计算值就是 `1.65px`，整页行距被压成一坨。
        //   所以走 `line_height_em`：渲染时按同一样式的字号换算成点数（`1.65 × 16 = 26.4px`），
        //   与 CSS 的观感一致，也不需要生成器知道继承来的字号。
        //
        // 边界：≥4 的无单位值在 CSS 里几乎一定是"手滑写了 px 的数"，而按倍数算会得到
        // 巨大的行高。这种按**点数**处理，并在注释里点名。
        if (Number(n) >= 4) {
          return mapped(
            [`.line_height(${n})`],
            [`line-height:${v} —— 无单位且 ≥4，按**点数**处理（CSS 语义是倍数；这一档更可能是漏写单位）`],
          );
        }
        return mapped(
          [`.line_height_em(${n})`],
          [
            `line-height:${v} 无单位 —— 按**倍数**换算（CSS 语义）。RN 的 lineHeight 是点数，原样搬会变成 ${v}px`,
          ],
        );
      }
      const em = emRatio(v);
      if (em !== null) {
        return mapped(
          [`.line_height_em(${d(em)})`],
          ctx.emWithoutFontSize ? ['em 行高要靠同一样式里的 font-size 换算，而这一条规则里没有 font-size'] : [],
        );
      }
      const m = String(v).match(/^(-?(?:\d+\.?\d*|\.\d+))px$/);
      if (m) {
        return mapped(
          [`.line_height(${d(Number(m[1]))})`],
          ['CSS 的 px 行高与 RN 的 lineHeight 都是点数，但断行规则不同 —— 排版要重新验'],
        );
      }
      return loss(`line-height:${v}`);
    }
    case 'letter-spacing': {
      const em = emRatio(v);
      if (em !== null) {
        return mapped(
          [`.letter_spacing_em(${d(em)})`],
          ctx.emWithoutFontSize ? ['em 字距要靠同一样式里的 font-size 换算，而这一条规则里没有 font-size'] : [],
        );
      }
      const m = String(v).match(/^(-?(?:\d+\.?\d*|\.\d+))px$/);
      if (m) return mapped([`.letter_spacing(${d(Number(m[1]))})`]);
      if (/^normal$/i.test(v)) {
        // `normal` 是 CSS 的**初始值**（不额外加字距），而 RN 的 `letterSpacing` 默认就是 `0`
        // ⇒ 如实发 0（语义等价，且不改变观感）。
        //
        // ⚠️★ 2026-10-23 实测：这一条以前是 `mapped([])` —— **零调用、零 note，却计入「已映射」**。
        //    它是本文件里**唯一**一处 `mapped([])`，也就是"声称映射了、其实什么都没发"这一类
        //    （第十八轮审计点名的那个"恒等式守不住"的现网实例）。
        //    修法不是"补一张名单"，而是**别让这个形状存在**：要么给调用，要么给理由。
        //    判据在 `tools/migrate_ledger_check.mjs`（"声称已映射 ⇒ 至少一条调用"）。
        return mapped(
          ['.letter_spacing(0.0)'],
          ['letter-spacing: normal ⇒ 0（CSS 的初始值；RN 的 letterSpacing 默认就是 0）'],
        );
      }
      return loss(`letter-spacing:${v}`);
    }
    case 'text-decoration':
    case 'text-decoration-line': {
      const k = v.toLowerCase();
      const line =
        k === 'none'
          ? '@style.TextDecorationLine::None'
          : k.includes('underline') && k.includes('line-through')
            ? '@style.TextDecorationLine::UnderlineLineThrough'
            : k.includes('underline')
              ? '@style.TextDecorationLine::Underline'
              : k.includes('line-through')
                ? '@style.TextDecorationLine::LineThrough'
                : null;
      if (!line) return loss(`text-decoration:${v}`);
      return mapped([`.text_decoration_line(${line})`]);
    }
    case 'text-decoration-color': {
      const c = color(v);
      return c
        ? mapped([`.text_decoration_color(${c})`], nativeGapNotes('text-decoration-color'))
        : loss(`text-decoration-color:${v}`);
    }

    // ── `display:grid` 的**降级策略**（2026-10-23 落地；见 `mapClass` 的 `isGridCell`）──
    //
    // 以前这里是"如实记为有损"，理由写的是"降级成 flex 需要人来决定列宽策略"。
    // 实测的后果（`interest/yi` 的六十四卦速查）：`display:grid` 丢了、`grid-template-columns`
    // 丢了，而**容器上什么都没补** ⇒ 64 张卦卡在迁移版里是**单列**（旧版是多列网格）。
    // 现在把那个"人的决定"写下来、并且是可判据的：
    //
    //   CSS：`display:grid; grid-template-columns: repeat(auto-fill, minmax(116px, 1fr))`
    //   RN ：容器 `flex_direction(row) + flex_wrap(wrap)`，**子项** `min_width(116) + flex_grow(1)`
    //
    // 为什么列宽写在**子项**上而不是容器上：flex 的容器没有"列宽"这个概念 ——
    // 换行后的每一行各自分配宽度。子项给"最小宽度 + 会长大"就等价于
    // "每列至少 116px、有富余时各列平分"，与 `auto-fill + minmax(x, 1fr)` 的形状一致。
    case 'grid-template-columns':
    case 'grid-template-rows':
    case 'grid-template-areas':
    case 'grid-column':
    case 'grid-row': {
      const basis = prop === 'grid-template-columns' ? gridCellBasis(v) : null;
      if (basis !== null) {
        return mapped(
          [],
          [
            `${prop}:${v} 未映射到容器 —— **列宽改写在子项上**：\`.min_width(@style.px(${basis}))\` + \`.flex_grow(1.0)\`（见 mapClass 的 isGridCell）`,
          ],
        );
      }
      return loss(
        `${prop}:${v} —— RN 没有 grid 布局（\`@style\` 只有 flex）。这一条认不出列宽（只支持 repeat(auto-fill|auto-fit, minmax(<N>px, 1fr))），降级策略要人定`,
      );
    }
    case 'transform':
      return loss(`transform:${v} —— RN 要结构化数组，而 \`Style\` 的条目是扁平 (key, StyleValue)，装不下`);
    case 'transition':
      return loss(`transition:${v} —— RN 没有 CSS 过渡；动效走 Animated / Reanimated`);
    case 'box-shadow':
      return loss(
        `box-shadow:${v} —— RN 要拆成 shadowColor/shadowOffset/shadowOpacity/shadowRadius（Android 还要 elevation），需要复合助手`,
      );
    case 'cursor':
      return loss(`cursor:${v} —— 触屏没有光标概念（Web/桌面才有意义）`);
    case 'user-select':
    case '-webkit-user-select':
      return loss(`user-select:${v} —— RN 没有文本选择开关`);
    case 'content':
      return loss(`content:${v} —— 伪元素内容要改成真实子组件`);
    case 'outline':
      return loss(`outline:${v} —— RN 没有 outline；焦点样式要自己做`);
    case 'touch-action':
      return loss(`touch-action:${v} —— 手势由 RN 的手势通道接管`);
    case 'list-style':
    case 'list-style-type':
      return loss(`${prop}:${v} —— RN 里列表符号要自己画`);
    case 'font-feature-settings':
    case '-webkit-font-smoothing':
      return loss(`${prop}:${v} —— 原生字体渲染由平台决定`);
    case 'text-overflow':
    case 'overflow-wrap':
    case 'word-break':
      return loss(`${prop}:${v} —— RN 的截断走 numberOfLines / ellipsizeMode`);
    case 'background-image':
    case 'background-position':
    case 'background-size':
    case 'background-repeat':
    case 'background-clip':
      return loss(`${prop}:${v} —— RN 没有这些背景属性`);

    default:
      // **不认识的属性也要有点名的形状**：这一句是"零遗漏"的兜底，
      // 它不是"我跳过了"，而是"这条报告出来了"。
      return loss(`${prop}:${v} —— 未登记的属性（\`@style\` 里没有对应构造器）`);
  }
}

/** `padding` / `margin` 的 1–4 值简写 → 方向方法。 */
function mapBoxShorthand(prop, v) {
  const parts = v.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return loss(`${prop}: 空值`);
  const exprs = parts.map(dim);
  if (exprs.some((e) => !e)) return loss(`${prop}:${v} —— 含无法表达的长度`);
  const set = (suffix) => `.${prop}${suffix}(${exprs[0]})`;
  if (exprs.length === 1) return mapped([set('')]);
  if (exprs.length === 2) return mapped([`.${prop}_horizontal(${exprs[1]})`, `.${prop}_vertical(${exprs[0]})`]);
  if (exprs.length === 3) {
    return mapped([
      `.${prop}_top(${exprs[0]})`,
      `.${prop}_horizontal(${exprs[1]})`,
      `.${prop}_bottom(${exprs[2]})`,
    ]);
  }
  return mapped([
    `.${prop}_top(${exprs[0]})`,
    `.${prop}_right(${exprs[1]})`,
    `.${prop}_bottom(${exprs[2]})`,
    `.${prop}_left(${exprs[3]})`,
  ]);
}

/** `border: 1px solid var(--x)` / `border-top: 3px solid #8a2518` */
function mapBorderShorthand(prop, v) {
  const parts = v.split(/\s+/).filter(Boolean);
  const side = prop === 'border' ? '' : '_' + prop.split('-')[1];
  const calls = [];
  const notes = [];
  for (const p of parts) {
    const w = p.match(/^(-?(?:\d+\.?\d*|\.\d+))px$/);
    if (w) {
      calls.push(
        prop === 'border' ? `.border_width(${d(Number(w[1]))})` : `.border${side}_width(${d(Number(w[1]))})`,
      );
      continue;
    }
    const styleExpr = ENUMS['border-style'][p.toLowerCase()];
    if (styleExpr) {
      calls.push(prop === 'border' ? `.border_style(${styleExpr})` : `.border${side}_style(${styleExpr})`);
      continue;
    }
    const c = color(p);
    if (c) {
      calls.push(prop === 'border' ? `.border_color(${c})` : `.border${side}_color(${c})`);
      continue;
    }
    notes.push(`border 简写里有认不出的部分：\`${p}\``);
  }
  if (!calls.length) return loss(`${prop}:${v} —— 简写里没有一项能识别`);
  // ⚠️★ 分边的 style 在原生 RN 上没有对应物（登记表里没有 `borderTopStyle` 这些）——
  //    而**简写这条路不经过** `mapDeclaration` 的 `border-*-style` 分支，所以那句说明得在这里补上。
  //    2026-10-23 实测踩到：第一版只改了 `mapDeclaration`，于是同步产物时**一条相关说明都没有**
  //    （`white_space` 的 3 条进去了，`border_*_style` 的 8 条没有）—— 差一点就把
  //    "我们已经把话说到用户会看的地方"当成做完了。
  if (prop !== 'border' && /\.border_[a-z]+_style\(/.test(calls.join(''))) {
    notes.push(NATIVE_GAP_NOTES[`${prop}-style`]);
  }
  return { calls, loss: null, notes };
}

/** `border-radius`：单值、四角分开、以及百分比（RN 的接口只收点数）。 */
function mapBorderRadius(prop, v) {
  if (prop !== 'border-radius') {
    const n = num(v.replace(/px$/, ''));
    if (n === null || !/px$/.test(v)) return loss(`${prop}:${v} —— 只支持 px`);
    return mapped([`.${prop.replace(/-/g, '_')}(${n})`]);
  }
  const parts = v.split(/\s+/).filter(Boolean);
  const parsed = parts.map((p) => {
    const m = p.match(/^(-?(?:\d+\.?\d*|\.\d+))px$/);
    return m ? d(Number(m[1])) : null;
  });
  if (parsed.some((p) => p === null)) {
    if (/50%$/.test(v)) {
      return loss(`border-radius:${v} —— RN 的圆角只收点数，"圆形"要用一个大点数（如 999）来表达`);
    }
    return loss(`border-radius:${v} —— 只支持 px`);
  }
  if (parsed.length === 1) return mapped([`.border_radius(${parsed[0]})`]);
  if (parsed.length === 4) {
    return mapped([
      `.border_top_left_radius(${parsed[0]})`,
      `.border_top_right_radius(${parsed[1]})`,
      `.border_bottom_right_radius(${parsed[2]})`,
      `.border_bottom_left_radius(${parsed[3]})`,
    ]);
  }
  return loss(`border-radius:${v} —— 两/三值简写要人工展开成四角`);
}

module.exports = {
  mapDeclaration,
  planBorderStyleFold,
  dim,
  num,
  unitless,
  emRatio,
  color,
  fontWeight,
  gridCellBasis,
  d,
  q,
  ENUMS,
};
