///|
/// **moobile 的类型化样式层。**
///
/// 设计要点（对应 README「架构级改造的空间」）：
///
/// 1. **属性集是封闭的** —— 只有下面这些方法存在。`display:grid`、
///    `position:sticky`、`::before` 这些**根本没有构造器**，
///    所以"Web 能跑、移动端不能"在**编译期就不可能发生**。
///    （DESIGN 原则 3：可移植子集优先于表达力。）
///
/// 2. **每个属性的值类型由签名钉死** —— `font_weight` 只收 `FontWeight`，
///    所以不可能出现"把数字塞给 fontWeight"这种静默非法。
///
/// 3. **一份数据、两个后端** —— `StyleValue` 同时携带"是不是长度"，
///    于是 RN 侧产出数字、CSS 侧产出 `"16px"`，不需要两边各存一套。
///
/// 词表取自 **React Native 的 style props**（它本身就已经是一份被策展过的
/// 可移植子集：flexbox + 有限属性集，且刻意排除了 grid / sticky / 伪元素）。
pub struct Style {
  entries : Array[(String, StyleValue)]
}

///|
/// 值的形态，已足够覆盖 RN 与 CSS 的 style 取值：
///
/// | 构造器 | RN 产出 | CSS 产出 |
/// |---|---|---|
/// | `Unitless(d)` | 数字 | `"1"` |
/// | `Px(d)` | 数字 | `"16px"` |
/// | `Pct(d)` | `"50%"` | `"50%"` |
/// | `Em(d)` | 数字（按同一样式里的 `fontSize` 换算） | `"0.1em"` |
/// | `Auto` | `"auto"` | `"auto"` |
/// | `Str(s)` | 字符串 | 字符串 |
///
/// ★ `Em` 是实测补上的：yi 大量使用 `letter-spacing: .1em` 这类相对单位，
/// 而 **RN 的 `letterSpacing` 只认点数**。为它单独设构造器，
/// 就把"每次调用点手工乘一遍"这个易错动作消灭了。
pub(all) enum StyleValue {
  Unitless(Double)
  Px(Double)
  Pct(Double)
  Em(Double)
  Auto
  Str(String)
} derive(Eq)

///|
pub fn Style::new() -> Style {
  { entries: [] }
}

///|
/// 取出条目（后端按顺序消费）。
pub fn Style::entries(self : Style) -> Array[(String, StyleValue)] {
  self.entries
}

///|
pub fn Style::is_empty(self : Style) -> Bool {
  self.entries.length() == 0
}

// ---------------------------------------------------------------- 内部写入器

///|
fn Style::unitless(self : Style, key : String, v : Double) -> Style {
  self.entries.push((key, Unitless(v)))
  self
}

///|
fn Style::len(self : Style, key : String, v : Double) -> Style {
  self.entries.push((key, Px(v)))
  self
}

///|
fn Style::kw(self : Style, key : String, v : String) -> Style {
  self.entries.push((key, Str(v)))
  self
}

///|
fn Style::dim(self : Style, key : String, v : Dimension) -> Style {
  self.entries.push((key, v.to_style_value()))
  self
}

// ------------------------------------------------------------------ 关键字枚举
// 刻意只列 Web 与 RN 都有等价物的取值。

///|
pub(all) enum FlexDirection {
  Row
  Column
  RowReverse
  ColumnReverse
}

///|
pub fn FlexDirection::to_string(self : FlexDirection) -> String {
  match self {
    Row => "row"
    Column => "column"
    RowReverse => "row-reverse"
    ColumnReverse => "column-reverse"
  }
}

///|
pub(all) enum FlexWrap {
  NoWrap
  Wrap
  WrapReverse
}

///|
pub fn FlexWrap::to_string(self : FlexWrap) -> String {
  match self {
    NoWrap => "nowrap"
    Wrap => "wrap"
    WrapReverse => "wrap-reverse"
  }
}

///|
pub(all) enum Align {
  FlexStart
  FlexEnd
  Center
  Stretch
  Baseline
}

///|
pub fn Align::to_string(self : Align) -> String {
  match self {
    FlexStart => "flex-start"
    FlexEnd => "flex-end"
    Center => "center"
    Stretch => "stretch"
    Baseline => "baseline"
  }
}

///|
pub(all) enum AlignSelf {
  Auto
  FlexStart
  FlexEnd
  Center
  Stretch
  Baseline
}

///|
pub fn AlignSelf::to_string(self : AlignSelf) -> String {
  match self {
    Auto => "auto"
    FlexStart => "flex-start"
    FlexEnd => "flex-end"
    Center => "center"
    Stretch => "stretch"
    Baseline => "baseline"
  }
}

///|
pub(all) enum Justify {
  FlexStart
  FlexEnd
  Center
  SpaceBetween
  SpaceAround
  SpaceEvenly
}

///|
pub fn Justify::to_string(self : Justify) -> String {
  match self {
    FlexStart => "flex-start"
    FlexEnd => "flex-end"
    Center => "center"
    SpaceBetween => "space-between"
    SpaceAround => "space-around"
    SpaceEvenly => "space-evenly"
  }
}

///|
pub(all) enum Position {
  Relative
  Absolute
}

///|
pub fn Position::to_string(self : Position) -> String {
  match self {
    Relative => "relative"
    Absolute => "absolute"
  }
}

///|
pub(all) enum Overflow {
  Visible
  Hidden
  Scroll
}

///|
pub fn Overflow::to_string(self : Overflow) -> String {
  match self {
    Visible => "visible"
    Hidden => "hidden"
    Scroll => "scroll"
  }
}

///|
pub(all) enum BorderStyle {
  Solid
  Dotted
  Dashed
}

///|
pub fn BorderStyle::to_string(self : BorderStyle) -> String {
  match self {
    Solid => "solid"
    Dotted => "dotted"
    Dashed => "dashed"
  }
}

///|
/// ⚠️ 注意：`fontWeight` 在 RN 里是**字符串**，不是数字。
/// 把它做成枚举，就杜绝了"被 `Number()` 吃掉变成 700"这个静默 bug（README 的 F3）。
pub(all) enum FontWeight {
  Normal
  Bold
  W100
  W200
  W300
  W400
  W500
  W600
  W700
  W800
  W900
}

///|
pub fn FontWeight::to_string(self : FontWeight) -> String {
  match self {
    Normal => "normal"
    Bold => "bold"
    W100 => "100"
    W200 => "200"
    W300 => "300"
    W400 => "400"
    W500 => "500"
    W600 => "600"
    W700 => "700"
    W800 => "800"
    W900 => "900"
  }
}

///|
pub(all) enum FontStyle {
  Normal
  Italic
}

///|
pub fn FontStyle::to_string(self : FontStyle) -> String {
  match self {
    Normal => "normal"
    Italic => "italic"
  }
}

///|
pub(all) enum TextAlign {
  Auto
  Left
  Right
  Center
  Justify
}

///|
pub fn TextAlign::to_string(self : TextAlign) -> String {
  match self {
    Auto => "auto"
    Left => "left"
    Right => "right"
    Center => "center"
    Justify => "justify"
  }
}

///|
pub(all) enum TextDecorationLine {
  None
  Underline
  LineThrough
  UnderlineLineThrough
}

///|
pub fn TextDecorationLine::to_string(self : TextDecorationLine) -> String {
  match self {
    None => "none"
    Underline => "underline"
    LineThrough => "line-through"
    UnderlineLineThrough => "underline line-through"
  }
}

///|
pub(all) enum TextTransform {
  None
  Uppercase
  Lowercase
  Capitalize
}

///|
pub fn TextTransform::to_string(self : TextTransform) -> String {
  match self {
    None => "none"
    Uppercase => "uppercase"
    Lowercase => "lowercase"
    Capitalize => "capitalize"
  }
}

///|
/// 尺寸：`auto` / 绝对长度 / 百分比。用类型把它们分开，就不需要
/// `width` / `width_pct` / `width_auto` 三个方法。
pub(all) enum Dimension {
  Auto
  Px(Double)
  Pct(Double)
}

///|
pub fn Dimension::to_style_value(self : Dimension) -> StyleValue {
  match self {
    Auto => Auto
    Px(d) => Px(d)
    Pct(d) => Pct(d)
  }
}

// ------------------------------------------------------------------ 简短构造器
// 让调用点写 `@style.px(16)` 而不是 `@style.Dimension::Px(16)`。

///|
pub fn px(d : Double) -> Dimension {
  Px(d)
}

///|
pub fn pct(d : Double) -> Dimension {
  Pct(d)
}

///|
pub fn auto() -> Dimension {
  Auto
}

// ---------------------------------------------------------------------- 布局

///|
pub fn Style::flex(self : Style, v : Double) -> Style {
  self.unitless("flex", v)
}

///|
pub fn Style::flex_direction(self : Style, v : FlexDirection) -> Style {
  self.kw("flexDirection", v.to_string())
}

///|
pub fn Style::flex_wrap(self : Style, v : FlexWrap) -> Style {
  self.kw("flexWrap", v.to_string())
}

///|
pub fn Style::flex_grow(self : Style, v : Double) -> Style {
  self.unitless("flexGrow", v)
}

///|
pub fn Style::flex_shrink(self : Style, v : Double) -> Style {
  self.unitless("flexShrink", v)
}

///|
pub fn Style::flex_basis(self : Style, v : Dimension) -> Style {
  self.dim("flexBasis", v)
}

///|
pub fn Style::align_items(self : Style, v : Align) -> Style {
  self.kw("alignItems", v.to_string())
}

///|
pub fn Style::align_self(self : Style, v : AlignSelf) -> Style {
  self.kw("alignSelf", v.to_string())
}

///|
pub fn Style::justify_content(self : Style, v : Justify) -> Style {
  self.kw("justifyContent", v.to_string())
}

///|
pub fn Style::position(self : Style, v : Position) -> Style {
  self.kw("position", v.to_string())
}

///|
pub fn Style::top(self : Style, v : Dimension) -> Style {
  self.dim("top", v)
}

///|
pub fn Style::right_(self : Style, v : Dimension) -> Style {
  self.dim("right", v)
}

///|
pub fn Style::bottom(self : Style, v : Dimension) -> Style {
  self.dim("bottom", v)
}

///|
pub fn Style::left(self : Style, v : Dimension) -> Style {
  self.dim("left", v)
}

///|
pub fn Style::z_index(self : Style, v : Double) -> Style {
  self.unitless("zIndex", v)
}

///|
pub fn Style::overflow(self : Style, v : Overflow) -> Style {
  self.kw("overflow", v.to_string())
}

// ---------------------------------------------------------------------- 尺寸

///|
pub fn Style::width(self : Style, v : Dimension) -> Style {
  self.dim("width", v)
}

///|
pub fn Style::height(self : Style, v : Dimension) -> Style {
  self.dim("height", v)
}

///|
pub fn Style::min_width(self : Style, v : Dimension) -> Style {
  self.dim("minWidth", v)
}

///|
pub fn Style::max_width(self : Style, v : Dimension) -> Style {
  self.dim("maxWidth", v)
}

///|
pub fn Style::min_height(self : Style, v : Dimension) -> Style {
  self.dim("minHeight", v)
}

///|
pub fn Style::max_height(self : Style, v : Dimension) -> Style {
  self.dim("maxHeight", v)
}

///|
pub fn Style::aspect_ratio(self : Style, v : Double) -> Style {
  self.unitless("aspectRatio", v)
}

// ---------------------------------------------------------------------- 间隙
// RN 0.71+ 与 RNW 都支持 gap，属于可移植子集。

///|
pub fn Style::gap(self : Style, v : Double) -> Style {
  self.len("gap", v)
}

///|
pub fn Style::row_gap(self : Style, v : Double) -> Style {
  self.len("rowGap", v)
}

///|
pub fn Style::column_gap(self : Style, v : Double) -> Style {
  self.len("columnGap", v)
}

// ---------------------------------------------------------------------- 外边距

///|
pub fn Style::margin(self : Style, v : Dimension) -> Style {
  self.dim("margin", v)
}

///|
pub fn Style::margin_top(self : Style, v : Dimension) -> Style {
  self.dim("marginTop", v)
}

///|
pub fn Style::margin_bottom(self : Style, v : Dimension) -> Style {
  self.dim("marginBottom", v)
}

///|
pub fn Style::margin_left(self : Style, v : Dimension) -> Style {
  self.dim("marginLeft", v)
}

///|
pub fn Style::margin_right(self : Style, v : Dimension) -> Style {
  self.dim("marginRight", v)
}

///|
pub fn Style::margin_horizontal(self : Style, v : Dimension) -> Style {
  self.dim("marginHorizontal", v)
}

///|
pub fn Style::margin_vertical(self : Style, v : Dimension) -> Style {
  self.dim("marginVertical", v)
}

// ---------------------------------------------------------------------- 内边距

///|
pub fn Style::padding(self : Style, v : Dimension) -> Style {
  self.dim("padding", v)
}

///|
pub fn Style::padding_top(self : Style, v : Dimension) -> Style {
  self.dim("paddingTop", v)
}

///|
pub fn Style::padding_bottom(self : Style, v : Dimension) -> Style {
  self.dim("paddingBottom", v)
}

///|
pub fn Style::padding_left(self : Style, v : Dimension) -> Style {
  self.dim("paddingLeft", v)
}

///|
pub fn Style::padding_right(self : Style, v : Dimension) -> Style {
  self.dim("paddingRight", v)
}

///|
pub fn Style::padding_horizontal(self : Style, v : Dimension) -> Style {
  self.dim("paddingHorizontal", v)
}

///|
pub fn Style::padding_vertical(self : Style, v : Dimension) -> Style {
  self.dim("paddingVertical", v)
}

// ---------------------------------------------------------------------- 边框

///|
pub fn Style::border_width(self : Style, v : Double) -> Style {
  self.len("borderWidth", v)
}

///|
pub fn Style::border_top_width(self : Style, v : Double) -> Style {
  self.len("borderTopWidth", v)
}

///|
pub fn Style::border_bottom_width(self : Style, v : Double) -> Style {
  self.len("borderBottomWidth", v)
}

///|
pub fn Style::border_left_width(self : Style, v : Double) -> Style {
  self.len("borderLeftWidth", v)
}

///|
pub fn Style::border_right_width(self : Style, v : Double) -> Style {
  self.len("borderRightWidth", v)
}

///|
pub fn Style::border_color(self : Style, v : String) -> Style {
  self.kw("borderColor", v)
}

///|
pub fn Style::border_style(self : Style, v : BorderStyle) -> Style {
  self.kw("borderStyle", v.to_string())
}

///|
pub fn Style::border_radius(self : Style, v : Double) -> Style {
  self.len("borderRadius", v)
}

///|
pub fn Style::border_top_left_radius(self : Style, v : Double) -> Style {
  self.len("borderTopLeftRadius", v)
}

///|
pub fn Style::border_top_right_radius(self : Style, v : Double) -> Style {
  self.len("borderTopRightRadius", v)
}

///|
pub fn Style::border_bottom_left_radius(self : Style, v : Double) -> Style {
  self.len("borderBottomLeftRadius", v)
}

///|
pub fn Style::border_bottom_right_radius(self : Style, v : Double) -> Style {
  self.len("borderBottomRightRadius", v)
}

// ---------------------------------------------------------------------- 视觉

///|
pub fn Style::background_color(self : Style, v : String) -> Style {
  self.kw("backgroundColor", v)
}

///|
pub fn Style::opacity(self : Style, v : Double) -> Style {
  self.unitless("opacity", v)
}

// ---------------------------------------------------------------------- 文字

///|
pub fn Style::color(self : Style, v : String) -> Style {
  self.kw("color", v)
}

///|
pub fn Style::font_size(self : Style, v : Double) -> Style {
  self.len("fontSize", v)
}

///|
pub fn Style::font_family(self : Style, v : String) -> Style {
  self.kw("fontFamily", v)
}

///|
pub fn Style::font_weight(self : Style, v : FontWeight) -> Style {
  self.kw("fontWeight", v.to_string())
}

///|
pub fn Style::font_style(self : Style, v : FontStyle) -> Style {
  self.kw("fontStyle", v.to_string())
}

///|
pub fn Style::line_height(self : Style, v : Double) -> Style {
  self.len("lineHeight", v)
}

///|
pub fn Style::letter_spacing(self : Style, v : Double) -> Style {
  self.len("letterSpacing", v)
}

///|
pub fn Style::text_align(self : Style, v : TextAlign) -> Style {
  self.kw("textAlign", v.to_string())
}

///|
pub fn Style::text_decoration_line(self : Style, v : TextDecorationLine) -> Style {
  self.kw("textDecorationLine", v.to_string())
}

///|
pub fn Style::text_transform(self : Style, v : TextTransform) -> Style {
  self.kw("textTransform", v.to_string())
}

// ---------------------------------------- 补齐：yi 的 CSS 用到的可移植属性
//
// 清单来自 `_r1/style_gap.md` 的差集分析（yi 的 198 条 CSS 共 57 个属性名，
// 本层原有 34 个覆盖）。下面这批是**可移植且 RN 支持**的，补齐它们；
// 不可移植的（grid / 伪元素 / transition / cursor …）在 README 里另有降级策略，
// 刻意不加进类型 —— 让它们在编译期就写不出来。

///|
pub(all) enum WhiteSpace {
  Normal
  NoWrap
  Pre
  PreWrap
}

///|
pub fn WhiteSpace::to_string(self : WhiteSpace) -> String {
  match self {
    Normal => "normal"
    NoWrap => "nowrap"
    Pre => "pre"
    PreWrap => "pre-wrap"
  }
}

///|
/// 只留 `flex` 与 `none`。**刻意不含 `grid`** —— 那正是要避免的东西。
pub(all) enum Display {
  Flex
  Hidden
}

///|
pub fn Display::to_string(self : Display) -> String {
  match self {
    Flex => "flex"
    Hidden => "none"
  }
}

///|
pub(all) enum TextDecorationStyle {
  Solid
  Double_
  Dotted
  Dashed
}

///|
pub fn TextDecorationStyle::to_string(self : TextDecorationStyle) -> String {
  match self {
    Solid => "solid"
    Double_ => "double"
    Dotted => "dotted"
    Dashed => "dashed"
  }
}

///|
pub fn Style::display(self : Style, v : Display) -> Style {
  self.kw("display", v.to_string())
}

///|
pub fn Style::white_space(self : Style, v : WhiteSpace) -> Style {
  self.kw("whiteSpace", v.to_string())
}

///|
/// `order` —— flex 排序。yi 用它把某块提到前面（`order: -1`）。
pub fn Style::order(self : Style, v : Double) -> Style {
  self.unitless("order", v)
}

///|
pub fn Style::border_top_color(self : Style, v : String) -> Style {
  self.kw("borderTopColor", v)
}

///|
pub fn Style::border_bottom_color(self : Style, v : String) -> Style {
  self.kw("borderBottomColor", v)
}

///|
pub fn Style::border_left_color(self : Style, v : String) -> Style {
  self.kw("borderLeftColor", v)
}

///|
pub fn Style::border_right_color(self : Style, v : String) -> Style {
  self.kw("borderRightColor", v)
}

///|
pub fn Style::border_top_style(self : Style, v : BorderStyle) -> Style {
  self.kw("borderTopStyle", v.to_string())
}

///|
pub fn Style::border_bottom_style(self : Style, v : BorderStyle) -> Style {
  self.kw("borderBottomStyle", v.to_string())
}

///|
pub fn Style::border_left_style(self : Style, v : BorderStyle) -> Style {
  self.kw("borderLeftStyle", v.to_string())
}

///|
pub fn Style::border_right_style(self : Style, v : BorderStyle) -> Style {
  self.kw("borderRightStyle", v.to_string())
}

///|
pub fn Style::text_decoration_color(self : Style, v : String) -> Style {
  self.kw("textDecorationColor", v)
}

///|
pub fn Style::text_decoration_style(self : Style, v : TextDecorationStyle) -> Style {
  self.kw("textDecorationStyle", v.to_string())
}

///|
/// 相对字号的字距：`letter-spacing: .1em`。
/// RN 侧会按同一样式里的 `fontSize` 换算成点数（见 README 的 R1-3）。
pub fn Style::letter_spacing_em(self : Style, ratio : Double) -> Style {
  self.entries.push(("letterSpacing", Em(ratio)))
  self
}

///|
/// 相对字号的行动高。
pub fn Style::line_height_em(self : Style, ratio : Double) -> Style {
  self.entries.push(("lineHeight", Em(ratio)))
  self
}

// ------------------------------------------------------------------ 序列化

///|
/// RN 侧取值：长度与无单位量都是**数字**（RN 不接受 `"16px"`）。
///
/// `Em` 需要上下文里的字号，所以这里返回 `None`；
/// 由后端在知道同一样式的 `fontSize` 时另行换算（见 `Em::resolve`）。
pub fn StyleValue::to_rn_number(self : StyleValue) -> Double? {
  match self {
    Unitless(d) => Some(d)
    Px(d) => Some(d)
    _ => None
  }
}

///|
/// RN 侧取值：非数字的一律是**字符串**。
pub fn StyleValue::to_rn_string(self : StyleValue) -> String? {
  match self {
    Pct(d) => Some("\{d}%")
    Auto => Some("auto")
    Str(s) => Some(s)
    _ => None
  }
}

///|
/// 把 `Em` 按给定字号换算成点数。RN 没有 `em` 这个概念，只能换算。
pub fn StyleValue::resolve_em(self : StyleValue, font_size : Double) -> StyleValue {
  match self {
    Em(ratio) => Px(ratio * font_size)
    other => other
  }
}

///|
/// 从一份样式里找字号，供 `Em` 换算。找不到时返回 `None`。
pub fn Style::font_size_of(self : Style) -> Double? {
  for entry in self.entries {
    if entry.0 == "fontSize" {
      match entry.1 {
        Px(d) | Unitless(d) => return Some(d)
        _ => ()
      }
    }
  }
  None
}

///|
/// CSS 侧取值：长度要补 `px`，无单位量不补，`em` **原样保留**（CSS 认识它）。
pub fn StyleValue::to_css(self : StyleValue) -> String {
  match self {
    Unitless(d) => "\{d}"
    Px(d) => "\{d}px"
    Pct(d) => "\{d}%"
    Em(d) => "\{d}em"
    Auto => "auto"
    Str(s) => s
  }
}

///|
/// RN 的键是 camelCase（`backgroundColor`），CSSOM 要 kebab-case（`background-color`）。
/// 命名差异由这一层吸收 —— 上层只需要写一种拼法。
pub fn css_property_name(key : String) -> String {
  let buf = StringBuilder::new()
  for c in key {
    if c >= 'A' && c <= 'Z' {
      buf.write_char('-')
      buf.write_char(Char::from_int(c.to_int() + 32))
    } else {
      buf.write_char(c)
    }
  }
  buf.to_string()
}
