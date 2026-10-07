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
/// **按下状态**的样式 —— 给触屏与 web 同一套表达（源 CSS 的 `:hover` 降级到这里）。
///
/// 用**键前缀**（`press:`）而不是给 `StyleValue` 加变体：加变体会让每一个构造器都得处理
/// "带不带状态"，污染整个类型化属性集；键前缀只影响一次遍历，形状仍是扁平的 (String, Value)。
///
/// ⚠️ **语义**：它把**当前已有的键**都加上前缀 —— 所以**`.press()` 落在链的哪一格，
/// 就决定它前面那一段是按下态**。要让"源 CSS 的 `:hover` 是按下态、常态仍是常态"，
/// 链的形状只能是 **hover 的键 → `.press()` → 常态的键**（它夹在中间）：
///
/// ```text
/// .border_color("#8a2518")     // 源 CSS 的 :hover ⇒ 落在 .press() 之前 ⇒ 按下态 ✅
/// .press()
/// .background_color("#e6d8bc") // 源 CSS 的常态  ⇒ 落在 .press() 之后 ⇒ 仍是常态 ✅
/// .min_width(@style.px(116.0)) // grid 列宽也是常态调用，必须在这一侧 ✅
/// ```
///
/// 三种落法只有这一种对，而**错的两种都很难看见**（产物编得过、判据全绿，只是语义反了）：
///   · 写在**链尾**（把常态整段标成按下态）—— 2026-10-23 第十七轮就这么修的，实测后果：
///     卦卡的 `.min_width(116).flex_grow(1)` 变成"只在按住时生效" ⇒ **网格塌成单列**
///     （容器 331px、卡片 54px）；第十八轮又量到更重的一层：`button.bagua-mode` 的常态
///     只剩 `borderColor` + `color` 两条 —— 没内边距、没底色、没边框、没字号，
///     **按住才变成一个按钮**。
///   · 写在**链中间但两侧写反**（常态在前、hover 在后）—— 同样是整体互换，只是这次
///     连"hover 那一半"也没落在按下态上。
///
/// 生成器侧的组装只有**一处**（`style-emit.js` 的 `emitModule`），判据在
/// `tools/regen_styles_check.mjs` 的"按下态组装顺序"那一节。
///
/// ⚠️ 消费侧（库的 `Pressable` 接线）**尚未就绪**（2026-10-23）：生成器默认不产出它
/// （`DSH_PRESS_FROM_HOVER=1` 才开），等接线稳了再默认打开。
pub fn Style::press(self : Style) -> Style {
  let out : Array[(String, StyleValue)] = []
  for i = 0; i < self.entries.length(); i = i + 1 {
    let (k, v) = self.entries[i]
    out.push(("press:" + k, v))
  }
  { entries: out }
}

///|
/// 键前缀（`render.mbt` 与生成物共用一个常量，别各自写死字符串）。
pub let press_prefix : String = "press:"

///|
/// 把一份 `(键, 值)` 列表**原样**装回 `Style` —— **不按名字过滤**。
///
/// 为什么不复用"按名字 match"的写法（那种写法踩过，2026-10-23）：那种白名单只适用于
/// **特定用途**（"哪些键会被文字继承"）。一旦拿它去重建**常态样式**，名单外的键
/// （`minWidth` / `flexGrow` …）就被**静默丢掉** —— 症状是"样式看起来没生效"，
/// 排查方向会被带偏。这个构造器只做类型还原，不认识名字，所以不会漏键。
pub fn Style::from_entries(entries : Array[(String, StyleValue)]) -> Style {
  { entries: entries.copy() }
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

///|
/// 指针形状（见 `Cursor` 的注释：**只有 web 有**，原生静默不画）。
///
/// ⚠️ 它**不改布局**，只改"这东西能不能点"的手感 ⇒ 别拿它当可点性的**唯一**表达：
///    真正的可点性靠 `Pressable` / `on_click`（`cursor` 只是 web 上的视觉补充）。
pub fn Style::cursor(self : Style, v : Cursor) -> Style {
  self.kw("cursor", v.to_string())
}

///|
/// 阴影 → **一条值**（`offsetX offsetY blurRadius spreadDistance color`）。
///
/// 为什么合成一条而不是发四个键：`boxShadow` 在现代 RN（New Architecture）与 `react-native-web`
/// **都**是一条字符串的键（RN 0.76 起 `boxShadow` 进登记表，取值形如 `"5px 5px 5px 5px rgba(...)"`）。
/// 发成 `shadowOffsetX/Y` 那套是**老写法**（Android 还得叠 `elevation`），两套并存会让"同一个阴影
/// 在两个后端长得不一样"。**这一条由 `tools/style_platform_check.mjs` 当场断言**：
/// 如果哪天 RN 的登记表里没有 `boxShadow` 了，那条门会红 —— 那时再回来改这里，别凭记忆。
///
/// ⚠️ 参数是**语义**（往哪偏、糊多少、扩散多少、什么色），**不是** CSS 字符串拼装权：
///    调用点写不出 `"0 3px 12px red"` 这种自由形态，只能给数。
fn shadow_value(color : String, x : Double, y : Double, blur : Double, spread : Double) -> String {
  let buf = StringBuilder::new()
  buf.write_string(x.to_string())
  buf.write_string("px ")
  buf.write_string(y.to_string())
  buf.write_string("px ")
  buf.write_string(blur.to_string())
  buf.write_string("px ")
  buf.write_string(spread.to_string())
  buf.write_string("px ")
  buf.write_string(color)
  buf.to_string()
}

///|
/// **阴影**（层次感的来源：卡片 / 浮层 / 下拉）。
///
/// ⚠️ 这是"甲级能力"里的第一条（`PLAN-ui §3.1`：各宿主都有对应物，只是形状不同）：
///    web/RNW 与 RN 都吃这条字符串，所以**不需要按后端分叉**——分叉会带来"两端不一样"的新账。
/// ⚠️ 阴影**不占布局**（它画在盒子外面）：窄容器里向上/向左的阴影会被裁掉，这与 CSS 同源，
///    别指望它当边框用（要"看得见的边界"用 `border_*` + `line-2` 那个语义色）。
pub fn Style::box_shadow(
  self : Style,
  color : String,
  x : Double,
  y : Double,
  blur : Double,
  spread : Double
) -> Style {
  self.kw("boxShadow", shadow_value(color, x, y, blur, spread))
}

///|
/// **一条变换**（`transform` 里的一个动作）。
///
/// ## 为什么是"有序的一串"而不是几个字段
///
/// 变换**顺序敏感**：`translate` 之后再 `scale`，与反过来**不是同一个结果**（后者缩放的才是位移后的坐标系）。
/// 所以 API 收 `Array[Transform]`，**数组顺序就是施加顺序** —— 换成结构体字段
/// （`x` / `scale` / `rotate` 各一格）就把"顺序"这件事永久丢掉了。
///
/// ## 为什么吐**字符串**（实测：两端都认，**不需要按后端分叉**）
///
/// 这是甲级三样里最容易被想当然的一条 —— 直觉是"RN 要数组、web 要字符串 ⇒ 必须分叉"。
/// **读两端自己的源码之后，这句不成立**：
///
/// · **RN**（`Libraries/StyleSheet/processTransform.js`）：签名就是 `Array<Object> | string`；
///   传字符串时用 `/(\w+)\(([^)]+)\)/g` 把每个 `fn(args)` 解析成**单键对象**，并**保序**
///   ⇒ 字符串是它的一等输入，不是兼容层；
/// · **RNW 0.21.3**（`exports/StyleSheet/preprocess.js`）：`transform` 那一支只在
///   `Array.isArray(_value)` 时走数组翻译，**字符串原样落进 CSS** ⇒ 也认。
///
/// ⇒ 本层只吐**一条字符串**（与 `box_shadow` 同一形状），不必分叉 ——
///   分叉只会带来"同一个变换在两端长得不一样"的新账。
///
/// ## 一个动作一个函数（不是风格问题：RN 有硬校验）
///
/// RN 的 `_validateTransforms` 要求**每个 transform 对象恰好一个键**；本仓 canvas 那边也栽过同一件事
/// （RN Skia 只读 `Object.keys(val)[0]`，第二个键**静默作废** —— 罗盘被画成横扁的椭圆）。
/// ⇒ `Translate(x, y)` 一律吐**两个函数**（`translateX(…) translateY(…)`，RN 解析成两个单键对象），
///   **绝不**吐 `translate(x, y)` 那种一个函数带两个参数的形态。
///   判据：白盒测试数**函数个数 == 动作个数**（`style_wbtest.mbt`）。
///
/// ⚠️ 单位写死在这里（调用点给不出裸字符串，与 `box_shadow` 同一条规矩：别把 CSS 语法漏进可移植子集）：
///   RN 的解析器要求 `translateX/Y` **带单位**（值为 0 时可省）；`rotate` 走默认分支 ⇒ 要 `deg`；`scale` 是纯数。
///
/// **平台**：Web ✅ · RNW ✅ · RN ✅（字符串形态是它的一等输入）。
pub(all) enum Transform {
  /// 位移（px）：抽屉/浮出的"移出去多少"
  Translate(Double, Double)
  /// 缩放（倍数）
  Scale(Double)
  /// 旋转（度）
  Rotate(Double)
}

///|
pub fn Transform::to_string(self : Transform) -> String {
  match self {
    Translate(x, y) => "translateX(\{x}px) translateY(\{y}px)"
    Scale(f) => "scale(\{f})"
    Rotate(d) => "rotate(\{d}deg)"
  }
}

///|
/// **变换**（甲级三样的最后一样）：抽屉 / 下拉的位移、指示条、悬浮抬起。
///
/// 语义参数**有序**：`[Translate(0.0, -8.0), Scale(1.02)]` 就是"先上移 8px 再放大 2%"。
/// 传空数组 = 一条空串（等于不加变换，但**键还在** —— 需要"清掉变换"时用它）。
///
/// ⚠️ 它**不改布局**：变换是合成期的（不参与 flex 计算）⇒ 别拿它当"撑开/收窄"用，
///    也别指望它触发重排（那正是它与 `margin` / `width` 的区别）。
pub fn Style::transform(self : Style, items : Array[Transform]) -> Style {
  let buf = StringBuilder::new()
  for i = 0; i < items.length(); i = i + 1 {
    if i > 0 {
      buf.write_string(" ")
    }
    buf.write_string(items[i].to_string())
  }
  self.kw("transform", buf.to_string())
}

// ---------------------------------------- 补齐：yi 的 CSS 用到的可移植属性
//
// 清单来自 `docs/evidence/r1/style_gap.md` 的差集分析（yi 的 198 条 CSS 共 57 个属性名，
// 本层原有 34 个覆盖）。下面这批按"可移植且 RN 支持"补进来的；
// 不可移植的（grid / 伪元素 / transition / cursor …）在 README 里另有降级策略，
// 刻意不加进类型 —— 让它们在编译期就写不出来。
//
// ⚠️★ **但这句"RN 支持"对 6 个键不成立**（2026-10-23 逐条在**真 RN 的登记表**上核过；
// `ReactNativeStyleAttributes.js`，本仓库装着的 0.83.10 / 0.86.3 / 0.87.1 三份都缺）：
//
//   · `whiteSpace`（`Style::white_space`）—— 原生没有这个键。对应物：**部分有**，
//     `nowrap` 的 RN 惯例是 `Text` 的 `numberOfLines(1)`（截断，语义不同）；
//     `pre-line` / `pre-wrap` 接近 RN `Text` 的默认行为。
//     ★ 2026-10-23 起这条"惯例"有了**显式的键**：`Style::number_of_lines`（见下面那条的说明）。
//     ⚠️ 但生成器**不自动**把 `white-space: nowrap` 折成它 —— 语义不同（截断 + 省略号 ≠ 不折行），
//        自动折会**悄悄改变外观**；要哪一处用它，由**人**在应用代码里显式写（拍板结论）。
//   · `order`（`Style::order`）—— Yoga 不支持。对应物：**没有**，要在 Model 里把顺序排好。
//   · `borderTopStyle` / `borderBottomStyle` / `borderLeftStyle` / `borderRightStyle`
//     （`Style::border_top_style` 等）—— 原生只有**四边共用**的 `borderStyle`。
//     对应物：**半有**，当"有宽度的那些边"共用同一个 style 时，发一次 `borderStyle` 等价。
//
// 另有两个键**只有 iOS**（在登记表里、Android 上静默失效）：`textDecorationStyle` /
// `textDecorationColor`（`Style::text_decoration_style` / `Style::text_decoration_color`）。
//
// ⇒ 也就是说：**这 6 个键在 web（react-native-web）上生效、在原生上静默不生效**
//   —— 正是本仓库反复栽的那一类"web 绿、真机红"。真实影响面（实测）：
//   `examples/apps/zhouyi-reader` 的产物里 **11 处**（`border_*_style` 8 + `white_space` 3），
//   而同一个应用的 web 判据 103/0 全过。
//   **判据**：`tools/style_platform_check.mjs`（库能产出的每一个"原生不认"的键都必须登记，
//   并写清"对应物"；RN 哪天支持了它也会红 —— 表过期）。

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
///|
/// **指针形状** —— 只留三种**语义**，不暴露 CSS 的字符串。
///
/// 为什么是语义而不是字符串（`cursor: "grab"` 那种）：给字符串等于把 web 语法漏进可移植子集；
/// 给三档语义，两端各自翻各自的（web 出 `cursor`，别的端该忽略就忽略）。
///
/// ⚠️ **一条实测更正（2026-10-07，别凭直觉写）**：我原以为 `cursor` 是"只有 web 有、原生 RN 不认"——
/// **不成立**：`node tools/style_platform_check.mjs` 拿装在仓里的真 RN 登记表
/// （`ReactNativeStyleAttributes.js`，0.83.10 / 0.86.3 两份）**当场否掉**了这条假设
/// （"登记表没有过期：已经支持了 → cursor"）。所以它**不进** `RN_UNSUPPORTED` 登记表。
/// ⚠️ 但"RN 认这个键"≠"移动端看得见效果"：**移动端有没有可见效果未实测**（要有指针的宿主才谈得上），
///    所以别把它当可点性的表达 —— 可点性仍靠 `Pressable` / `on_click` 与 `press:` 那条按下态通道。
///
/// ⚠️ 三档各自的**语义**（不是外观）：`Pointer` = "这东西能点"；`Text` = "这里能选中文字"；
///    `Default` = 明确要回默认箭头（用来**压掉**从父级继承来的 pointer）。
pub(all) enum Cursor {
  Pointer
  Text
  Default
}

///|
pub fn Cursor::to_string(self : Cursor) -> String {
  match self {
    Pointer => "pointer"
    Text => "text"
    Default => "default"
  }
}

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
/// ⚠️ **原生 RN 没有 `whiteSpace` 这个键**（`react-native-web` 有）⇒ 真机上这一条**不生效**。对应物（部分有）：`nowrap` 的 RN 惯例是 `Text` 的 `numberOfLines(1)`（截断，语义不同）。详见文件上方"补齐"那段的说明与 `tools/style_platform_check.mjs`。
pub fn Style::white_space(self : Style, v : WhiteSpace) -> Style {
  self.kw("whiteSpace", v.to_string())
}

///|
/// `numberOfLines` —— `white-space: nowrap` 在 **RN 上惯用的那条替代路径**（**显式键，不自动折**）。
///
/// ⚠️★ **它不是样式键，是 `Text` 的组件属性**（`<Text numberOfLines={1}>`）。`@style` 这一层故意
/// 仍把它写成 `Style` 的一个键（好用、可组合），由**渲染层把它从 `style` 对象里摘出来挂成 prop**
/// （`render.mbt` 的 `prop_keys_of`）—— 留在 `style` 里 RN 会忽略、RNW 会当成非法 CSS。
///
/// ⚠️ **语义与 `white-space: nowrap` 不同**：这是**截断**（超出部分去掉、通常带省略号），
/// 不是"不折行、把容器撑开"。所以：
///   · 生成器**不会**自动把 `white-space: nowrap` 折成它（会悄悄改变外观）；
///   · 要哪一处用它，**人在应用代码里显式写**（`@style.Style::number_of_lines(1.0)`）。
///
/// 两端都认这个属性（实测）：原生 RN `Libraries/Text/Text.js` 读 `props.numberOfLines`；
/// `react-native-web` 的 `Text` 也读它（`1` → 单行样式，`>1` → `-webkit-line-clamp`）。
/// 判据：`tools/style_platform_check.mjs` 的 `PROP_KEYS`（**属性**那一类，与"样式键"分开登记）。
pub fn Style::number_of_lines(self : Style, v : Double) -> Style {
  self.unitless("numberOfLines", v)
}

///|
/// `order` —— flex 排序。yi 用它把某块提到前面（`order: -1`）。
/// ⚠️ **原生 RN 没有 `order`**（Yoga 不支持）⇒ 真机上不生效。对应物：**样式层没有** —— 要在 Model 里把顺序排好（与 `@media` 同一档）。判据：`tools/style_platform_check.mjs`。
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
/// ⚠️ **原生 RN 没有分边的 border style**（只有四边共用的 `borderStyle`）⇒ 真机上这一条不生效（按默认 `solid` 画）。对应物（半有）：当"有宽度的那些边"共用同一个 style 时，发一次 `borderStyle` 等价。判据：`tools/style_platform_check.mjs`。
pub fn Style::border_top_style(self : Style, v : BorderStyle) -> Style {
  self.kw("borderTopStyle", v.to_string())
}

///|
/// ⚠️ **原生 RN 没有分边的 border style**（只有四边共用的 `borderStyle`）⇒ 真机上不生效。对应物（半有）见 `Style::border_top_style` 的说明。判据：`tools/style_platform_check.mjs`。
pub fn Style::border_bottom_style(self : Style, v : BorderStyle) -> Style {
  self.kw("borderBottomStyle", v.to_string())
}

///|
/// ⚠️ **原生 RN 没有分边的 border style**（只有四边共用的 `borderStyle`）⇒ 真机上不生效。对应物（半有）见 `Style::border_top_style` 的说明。判据：`tools/style_platform_check.mjs`。
pub fn Style::border_left_style(self : Style, v : BorderStyle) -> Style {
  self.kw("borderLeftStyle", v.to_string())
}

///|
/// ⚠️ **原生 RN 没有分边的 border style**（只有四边共用的 `borderStyle`）⇒ 真机上不生效。对应物（半有）见 `Style::border_top_style` 的说明。判据：`tools/style_platform_check.mjs`。
pub fn Style::border_right_style(self : Style, v : BorderStyle) -> Style {
  self.kw("borderRightStyle", v.to_string())
}

///|
/// ⚠️ 这个键**只有 iOS** 实现 —— Android 上静默不生效（安卓的 `TextPaint` 没有"下划线颜色"这个概念）。判据：`tools/style_platform_check.mjs`。
pub fn Style::text_decoration_color(self : Style, v : String) -> Style {
  self.kw("textDecorationColor", v)
}

///|
/// ⚠️ 这个键**只有 iOS** 实现 —— Android 上静默不生效（它在 RN 的登记表里，但安卓侧没有对应物）。判据：`tools/style_platform_check.mjs`。
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
