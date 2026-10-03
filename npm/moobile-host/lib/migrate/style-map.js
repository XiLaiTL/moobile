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
 * 把一条声明映射成 `@style` 调用串（或"有损"）。
 *
 * @param {string} prop 已小写化的属性名
 * @param {string} value 已展开过 `var()` 的值
 * @param {{emWithoutFontSize?: boolean}} [ctx]
 */
function mapDeclaration(prop, value, ctx = {}) {
  const v = String(value).trim();

  // ── 枚举类：表里有就直接查 ──────────────────────────────────────────────────
  if (ENUMS[prop]) {
    let key = v.toLowerCase();
    if (prop === 'overflow') key = key.split(/\s+/)[0];
    const expr = ENUMS[prop][key];
    if (expr) {
      const method = prop.replace(/-([a-z])/g, (_, c) => '_' + c).replace('_style', '_style');
      return mapped([`.${method}(${expr})`]);
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
      return n === null ? loss(`order:${v}`) : mapped([`.order(${n})`]);
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
      return mapped([`.${prop.replace(/-/g, '_')}(${expr})`]);
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
      if (n !== null) return mapped([`.line_height(${n})`]);
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
      if (/^normal$/i.test(v)) return mapped([]);
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
      return c ? mapped([`.text_decoration_color(${c})`]) : loss(`text-decoration-color:${v}`);
    }

    // ── 明确不表达的东西（逐条给理由，别只说"不支持"）────────────────────────
    case 'grid-template-columns':
    case 'grid-template-rows':
    case 'grid-template-areas':
    case 'grid-column':
    case 'grid-row':
      return loss(
        `${prop}:${v} —— RN 没有 grid 布局（\`@style\` 只有 flex）。降级成 flex 需要**人来决定**列宽策略`,
      );
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
  dim,
  num,
  unitless,
  emRatio,
  color,
  fontWeight,
  d,
  q,
  ENUMS,
};
