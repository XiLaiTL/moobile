///|
/// **可移植标签表 —— HTML 标签 → 宿主组件名。**
///
/// 这就是 DESIGN §4.1 里的 `tags/` 层。`rabbita/html` 有 **116** 个标签，
/// 其中不少在 RN 上没有对应物，所以 moobile 自己维护这张表。
///
/// 收不收的判据只有一条：**两端都有等价物**。
pub fn tag_table() -> Array[(String, String)] {
  [
    // ── 文本类：RN 里这类内容**必须**是 `Text`（裸字符串不能当 `View` 的子节点）
    ("span", "Text"),
    ("p", "Text"),
    ("h1", "Text"),
    ("h2", "Text"),
    ("h3", "Text"),
    ("h4", "Text"),
    ("h5", "Text"),
    ("h6", "Text"),
    ("label", "Text"),
    ("strong", "Text"),
    ("b", "Text"),
    ("em", "Text"),
    ("i", "Text"),
    ("small", "Text"),
    ("code", "Text"),
    ("pre", "Text"),
    ("blockquote", "Text"),
    ("cite", "Text"),
    ("q", "Text"),
    ("abbr", "Text"),
    ("time", "Text"),
    ("figcaption", "Text"),
    // ── 容器类：RN 的默认容器
    ("div", "View"),
    ("section", "View"),
    ("article", "View"),
    ("aside", "View"),
    ("header", "View"),
    ("footer", "View"),
    ("main", "View"),
    ("nav", "View"),
    ("figure", "View"),
    ("ul", "View"),
    ("ol", "View"),
    ("li", "View"),
    ("dl", "View"),
    ("dt", "View"),
    ("dd", "View"),
    ("fieldset", "View"),
    ("form", "View"),
    // ── 交互类
    ("button", "Pressable"),
    ("a", "Pressable"),
    ("input", "TextInput"),
    ("textarea", "TextInput"),
    // ── 滚动（HTML 靠 overflow，RN 需要真容器；由 moobile 的 `scroll` 伪标签表达）
    ("scroll", "ScrollView"),
  ]
}

///|
/// **刻意不收的标签 + 理由。**
///
/// 这张表的存在意义：不把"其实不能跑"的东西默默映射成 `View` 让它看起来能跑。
/// 想用这些能力，得走 RN 生态的对应组件，而不是假装标签表能覆盖。
pub fn excluded_tags() -> Array[(String, String)] {
  [
    ("img", "RN 的 Image 需要结构化 `source={{uri}}`，字符串属性通道表达不了"),
    ("video", "要 `expo-av`，且控件语义两端完全不同"),
    ("audio", "同上"),
    ("canvas", "RN 无 canvas —— 接 `react-native-skia`（设计文档阶段 4）"),
    ("svg", "要 `react-native-svg`，且 rabbita 的 svg 是 2915 行独立包"),
    ("table", "RN 无表格语义；且 yi 里用 Grid 表达，本来就要改 flex"),
    ("iframe", "RN 无"),
    ("select", "RN 无原生下拉，要 `@react-native-picker/picker`"),
    ("details", "`<details>` 的开关语义 RN 没有 —— 状态本来就在 Model 里，改用真实组件"),
    ("summary", "同 `details`"),
    ("dialog", "RN 无；用 Modal 或自绘"),
    ("marquee", "无对应物且已废弃"),
  ]
}

///|
/// 未收录标签的计数（诊断 + 可断言）。
///
/// **为什么要有它**：标签表不认识一个标签时不能"静默当 View" ——
/// 那正是 README 说的"看起来能跑"。计数为 0 才算标签表覆盖住了这棵树。
priv struct TagCounter {
  mut n : Int
  names : Array[String]
}

///|
let g_unmapped : TagCounter = { n: 0, names: [] }

///|
pub fn unmapped_tag_count() -> Int {
  g_unmapped.n
}

///|
pub fn unmapped_tag_names() -> String {
  g_unmapped.names.join(",")
}

///|
/// **外部组件库的命名空间分隔符**（`antd:Button`、`paper:Card`）。
///
/// 为什么用冒号，而不是 `x-` 这种前缀：`x-foo` 在 HTML 里是**自定义元素**的既有写法，
/// 而本层的取舍恰恰是"表外的 HTML 语义一律回落 `View` 并计数"（迁移诊断的依据就在这个计数上）。
/// 冒号在 HTML 标签名里不合法 —— 于是"这是不是外部组件"**看一眼就知道**，
/// 也不必去动那 42 条表的语义。
pub let component_namespace_sep : String = ":"

///|
/// 这个标签是不是"外部组件库的组件"。判据只有一条：**含冒号**。
pub fn is_library_tag(tag : String) -> Bool {
  tag.contains(component_namespace_sep)
}

///|
/// **标签索引：模块初始化时建一次**（D3 的落地处，`PLAN.md` §4.3）。
///
/// 为什么必须有它：`tag_table()` 返回的是**字面量数组** —— 每调一次就新建 44 个元组，
/// 然后线性扫一遍。而 `map_tag` 是**每个元素每帧**一次：基准负载 N=1000 时每帧 7007 个元素
/// ⇒ 每帧三十万次元组构造 + 三十万次比较。实测收益见 `docs/PERF.md`。
///
/// ⚠️ **表本身没有搬家**，这是刻意的：`tag_table()` 仍是那张可读的字面量表，
/// 因为 `tools/mbtools/src/migrate_scan.mbt` 是**按文本行**读它的（认 `("tag", …)` 形状），
/// 把字面量挪成别的形状会让 F1 报告数出 0 条 —— 那条门会红（这是它该有的行为，不是障碍）。
/// 所以这里只加**索引**，不动真源。
let g_tag_index : Map[String, String] = build_tag_index()

///|
fn build_tag_index() -> Map[String, String] {
  let m : Map[String, String] = Map([])
  for entry in tag_table() {
    m[entry.0] = entry.1
  }
  m
}

///|
/// 查表 → 外部组件直通 → 计数回落。
///
/// 三档的顺序是刻意的：
/// 1. **命中原表**（44 条）→ 老行为，交出宿主基础组件名；
/// 2. **带命名空间**（`antd:Button`）→ **原样直通**，交由宿主的组件注册表解析
///    （`MOBILE_HOST.components["antd:Button"]`）。名字写错、或那个库没装，
///    由宿主**点名报错**（见 `host.mbt` 的 `js_host_component`），而不是悄悄回落成 `View`
///    —— 后者的表现是"渲染出一个空盒子"，最难查；
/// 3. **其余**（`img` / `table` 这类）→ 回落 `View` + 计数：不崩，但计数会暴露它。
pub fn map_tag(tag : String) -> String {
  match g_tag_index.get(tag) {
    Some(name) => name
    None =>
      if is_library_tag(tag) {
        tag
      } else {
        g_unmapped.n = g_unmapped.n + 1
        if g_unmapped.names.length() < 20 {
          g_unmapped.names.push(tag)
        }
        // 兜底仍是 View（不崩），但计数会暴露它
        "View"
      }
  }
}

///|
/// 多词事件名 → React prop 名。
///
/// **为什么必须逐个列名**：rabbita 的事件键是 `mouseleave` 这种小写无分隔的写法，
/// 词边界信息已经丢了 —— `mouseleave` 恢复不出 `onMouseLeave`。单词事件（`change`）
/// 可靠首字母大写救回来，多词事件不能猜，只能列。
fn multi_word_event_props() -> Array[(String, String)] {
  [
    ("dblclick", "onDoubleClick"),
    ("contextmenu", "onContextMenu"),
    ("mousedown", "onMouseDown"),
    ("mouseup", "onMouseUp"),
    ("mousemove", "onMouseMove"),
    ("mouseenter", "onMouseEnter"),
    ("mouseleave", "onMouseLeave"),
    ("mouseover", "onMouseOver"),
    ("mouseout", "onMouseOut"),
    ("keydown", "onKeyDown"),
    ("keyup", "onKeyUp"),
    ("beforeinput", "onBeforeInput"),
    ("compositionstart", "onCompositionStart"),
    ("compositionupdate", "onCompositionUpdate"),
    ("compositionend", "onCompositionEnd"),
    ("dragstart", "onDragStart"),
    ("dragend", "onDragEnd"),
    ("dragenter", "onDragEnter"),
    ("dragleave", "onDragLeave"),
    ("dragover", "onDragOver"),
    ("pointerdown", "onPointerDown"),
    ("pointermove", "onPointerMove"),
    ("pointerup", "onPointerUp"),
    ("pointercancel", "onPointerCancel"),
    ("touchstart", "onTouchStart"),
    ("touchmove", "onTouchMove"),
    ("touchend", "onTouchEnd"),
    ("long_click", "onLongPress"),
  ]
}

///|
/// 兜底：事件键 → React 的 camelCase prop 名。
///
/// ⚠️ 这里曾经是 `"on" + event`，也就是**原样小写拼上去**。实测代价很具体：
/// `change` 产出 `onchange`，而 React 对这种情况是**明确拒绝**的
/// （`react-dom` 的文案：`Invalid event handler property \`onchange\`. Did you mean \`onChange\`?`）
/// —— 也就是说那些处理器**根本不会被接上**，不是"载荷是零值"那么轻。
fn fallback_event_prop(event : String) -> String {
  for entry in multi_word_event_props() {
    if entry.0 == event {
      return entry.1
    }
  }
  if event.length() == 0 {
    return "on"
  }
  "on" +
  event.unsafe_substring(start=0, end=1).to_upper() +
  event.unsafe_substring(start=1, end=event.length())
}

///|
/// **默认事件映射**（`@html` 的事件键 → React 的 prop 名）。
///
/// ⚠️ 这是**默认策略，不是唯一策略**：宿主可以按 (标签, 事件) 覆盖它 —— 见 `map_event`。
/// 为什么必须能覆盖：同一个 `click`，落到 RN 的基础组件上是 `onPress`，
/// 落到 Web / antd 的组件上却是 `onClick`；而"手里这个组件是哪种"**只有宿主知道**
/// （组件对象就在它手上，我们这边只有组件名）。
fn default_event_prop(tag : String, event : String) -> String {
  match (tag, event) {
    ("input", "input") => "onChangeText"
    ("input", "change") => "onChangeText"
    ("input", "focus") => "onFocus"
    ("input", "blur") => "onBlur"
    (_, "click") => "onPress"
    (_, "long_click") => "onLongPress"
    (_, other) => fallback_event_prop(other)
  }
}

///|
/// 事件映射。**必须知道目标标签**，不能只看事件名。
///
/// 三段式，前一段优先：
/// 1. **宿主覆盖**（`MOBILE_HOST.events`，支持 `'*'` 通配）—— 组件库的落点由宿主/适配器声明；
/// 2. **默认表**（`default_event_prop`）—— RN 基础组件的语义；
/// 3. 默认表内部再兜底到 camelCase。
pub fn map_event(tag : String, event : String) -> String {
  let host_prop = js_event_override(tag, event)
  if host_prop != "" {
    return host_prop
  }
  default_event_prop(tag, event)
}

///|
/// 类型化样式 → RN 的 `style` 对象。
///
/// **长度与无单位量必须是数字**（RN 不接受 `"16px"`），其余必须是字符串
/// （`fontWeight: "700"` 一旦被 `Number()` 吃掉变成数字 `700` 就非法）。
///
/// 这个区分现在由**类型**保证 —— 不再需要运行时键白名单。
fn styles_to_js(styles : @vdom.Styles) -> JsValue {
  let o = js_obj_new()
  // `Em` 是相对单位，RN 没有这个概念，必须按字号换算。
  // 字号取自**同一条样式**里的 `fontSize`；取不到时退回 16（CSS 默认字号），
  // 这是一个**已知的近似**：真正的 `em` 应该沿继承链上溯，而我们的样式表
  // 没有继承概念（设计文档 §3.2 明确说明）。实践中 `letter-spacing: .1em`
  // 总是和 `font-size` 写在一起，所以这条近似成立。
  let font_size = match styles.get("fontSize") {
    Some(@style.StyleValue::Px(d)) | Some(@style.StyleValue::Unitless(d)) => d
    _ => 16.0
  }
  // ★ 按序号遍历（不是 `for k, v in styles` 的闭包迭代器）—— 见 `Styles::at` 的注释。
  let n = styles.length()
  for i = 0; i < n; i = i + 1 {
    let (key, value) = styles.at(i)
    let v = match value.resolve_em(font_size) {
      @style.StyleValue::Unitless(d) | @style.StyleValue::Px(d) => js_num(d)
      @style.StyleValue::Pct(d) => js_str("\{d}%")
      @style.StyleValue::Em(d) => js_str("\{d}em")
      @style.StyleValue::Auto => js_str("auto")
      @style.StyleValue::Str(s) => js_str(s)
    }
    js_obj_set(o, key, v)
  }
  o
}

///|
/// 不可移植节点的计数。
///
/// `Children::RawHtml` 在 RN 上没有等价物。我们**丢弃并计数**，
/// 而不是静默吞掉 —— 验证脚本会断言它是 0。
priv struct Counter {
  mut n : Int
}

///|
let g_unsupported : Counter = { n: 0 }

///|
pub fn unsupported_count() -> Int {
  g_unsupported.n
}

///|
/// 注册到宿主上的事件处理器数（诊断用）。
priv struct HCounter {
  mut n : Int
}

///|
let g_handlers : HCounter = { n: 0 }

///|
pub fn handler_count() -> Int {
  g_handlers.n
}

///|
/// `sched` 必须是**真正跑着的那个 host**。
///
/// ★ 这里踩过一个坑：最初传的是一个空 Scheduler stub，于是
/// 处理器里的 `scheduler.add(cmd)` 悄悄变成 no-op —— 界面能渲染、
/// 点击不报错、但状态永远不变。**调度器必须是 ReactHost 自己。**
fn render_props(
  tag : String,
  props : @vdom.Props,
  sched : &@cmd.Scheduler,
) -> JsValue {
  let o = js_obj_new()
  // ★ 两处"空表不建迭代器"：这两张表在**大多数元素上是空的**（本负载里 7007 个元素全空），
  // 而 `for k, v in 表` 每次都要**先构造一个迭代器**（含时归因里 `render_props` 自身那 8.1%
  // 主要就是这些"什么也没做但建了对象"的开销）。`is_empty()` 现在是 O(1)（§12.2）。
  let attrs = props.attrs_map()
  if !attrs.is_empty() {
    for k, v in attrs {
      js_obj_set(o, k, js_str(v))
    }
  }
  let values = props.props_map()
  if !values.is_empty() {
    for k, v in values {
      match v {
        @variant.Variant::Boolean(b) => js_obj_set(o, k, js_bool(b))
        @variant.Variant::Integer(i) => js_obj_set(o, k, js_int(i))
        @variant.Variant::Floating(d) => js_obj_set(o, k, js_num(d))
        @variant.Variant::String(s) => js_obj_set(o, k, js_str(s))
      }
    }
  }
  // 处理器已由 vdom 侧适配成"只吃一个 JS 值"（`Event` 是包内私有类型，
  // 这一步只能在包内做）。React 给 `onPress` / `onChangeText` 都恰好递一个
  // 参数，所以这里不需要再包一层。
  // ★ 没有 handler 就别进这个循环：`each_handler` 会为每次调用构造一个 HAMT 迭代器，
  // 而绝大多数元素没有 handler（本负载 7007 个里只有 1001 个）。`has_handlers()` 是 O(1)。
  if props.has_handlers() {
    props.each_handler(sched, (event, f) => {
      g_handlers.n = g_handlers.n + 1
      js_obj_set(o, map_event(tag, event), js_as_handler(f))
    })
  }
  // 空样式**不写 `style` 键**：以前无脑写 `style: {}`，对 RN 无害，
  // 但对第三方组件库是"凭空多一个 prop"（有的库会拿 `style != null` 做判断，
  // 有的库会把它当受控样式覆盖自己的默认值）。少一个键，少一类边界情况。
  let styles = props.styles_map()
  if !styles.is_empty() {
    js_obj_set(o, "style", styles_to_js(styles))
  }
  o
}

///|
fn render_children(
  c : @vdom.Children[@vdom.VNode],
  sched : &@cmd.Scheduler,
) -> JsValue {
  let arr = js_arr_new()
  match c {
    @vdom.Children::Array(kids) => {
      for k in kids {
        js_arr_push(arr, render_node(k, sched))
      }
    }
    @vdom.Children::Map(m) => {
      for key, k in m {
        js_arr_push(arr, js_with_key(render_node(k, sched), key))
      }
    }
    @vdom.Children::RawHtml(_) => {
      g_unsupported.n = g_unsupported.n + 1
    }
  }
  arr
}

///|
/// **翻译层的核心：一个 4 分支递归 —— 对真实的 rabbita `VNode`。**
///
/// - `Elem`  → 查标签表；`Children` 有 Array / Map / RawHtml 三个构造器，都要管
/// - `Text`  → 包一层 `Text`（RN 里裸字符串不能当 `View` 的子节点）
/// - `Frag`  → `React.Fragment`
/// - `Thunk` → 强制求值后继续
///
/// 注意这里**没有** diff、没有布局、没有文字排版 —— 那些都是 React / RN 的活。
pub fn render_node(v : @vdom.VNode, sched : &@cmd.Scheduler) -> JsValue {
  match v {
    @vdom.VNode::Elem(tag, props, kids, ..) =>
      js_create_element(
        js_host_component(map_tag(tag)),
        render_props(tag, props, sched),
        render_children(kids, sched),
      )
    @vdom.VNode::Text(s) => {
      let arr = js_arr_new()
      js_arr_push(arr, js_str(s))
      js_create_element(js_host_component("Text"), js_obj_new(), arr)
    }
    @vdom.VNode::Frag(kids) =>
      js_create_element(
        js_fragment(),
        js_obj_new(),
        render_children(@vdom.Children::Array(kids), sched),
      )
    @vdom.VNode::Thunk(_, f) => render_node(f(), sched)
  }
}

///|
/// 真实 `@html.Html` → 一个 React 元素。
pub fn render_html(html : @html.Html, sched : &@cmd.Scheduler) -> JsValue {
  render_node(html.to_virtual_dom(), sched)
}

// ── memo：把 `VNode::Thunk` 的哈希**当回事**（2026-10-03）──────────────────────
//
// ## 为什么需要这一段（实测出来的真因，不是读代码猜的）
//
// 上游 0.16 给了 `@html.memo` / `memo_by`，它们的产物是 `VNode::Thunk(hash, f)`。
// DOM 那条路（`vendor/rabbita/vdom/diff.mbt`）**会比对 hash、命中就复用旧子树**；
// 而**我们这条 React 通道原先是**：
//
//     @vdom.VNode::Thunk(_, f) => render_node(f(), sched)     // ← hash 被丢掉了
//
// ⇒ `memo` 在这里**完全空转**：每帧照样重建整棵子树、照样交给 React 一整套新元素，
// React 也就没有机会跳过任何东西。三层证据（源码 / 编译产物里 `_Thunk._0` 从未被引用 /
// 实跑：开不开 memo，每帧新建元素数都是 7007）见 `docs/PERF.md` §6.3。
//
// ## 这一格是什么
//
// **与 VNode 树同形**的一棵"格子树"：每个结构位置一格，格子里记住"这个位置如果是 thunk，
// 上一次的 (哈希, 元素) 是什么"。哈希相同 ⇒ **原样返回那个元素对象** —— React 拿到同一个
// 元素引用，自己就会跳过整棵子树（这才是省下 React 那部分的原因）。
//
// 三条设计决定，逐条都有理由：
/// 1. **同形（而不是"一个哈希表 + 路径"）**：位置只会和"上一次占这个位置的 thunk"比哈希。
///    扁平表会在结构变动时把**不相干的两个 thunk** 对到一起，那类错配会静默地画出旧内容。
///    同形结构下，结构一动（多一行少一行）就是"哈希不同 ⇒ 重算"，最坏只是**不省**，不是画错。
/// 2. **惰性分配**：格子只在**真的遇到 `Thunk` 孩子**时才建/才长。不用 `memo` 的应用
///    （现在绝大多数）每帧的额外开销是"每个孩子多一次判变体"，**没有分配**——
///    否则这一段就会给所有人加一份 7N/帧 的开销，那是拿大多数人的性能换少数人的。
/// 3. **未命中时带着这一格往下画**：这样 thunk 内部的 thunk（嵌套 memo）也有格子，
///    内层照样能命中。
///
/// ⚠️ **安全边界（这是 memo 自己的契约，不是我们的）**：键相同必须蕴含"HTML 与 handler 等价"
/// （上游 `html.mbt` 的文档原话）。所以**键给错的后果是画旧内容** ——
/// 例如 `by=r => 行号` 这种位置键，在列表头部插入一行之后就会错配。这条写进 `docs/FORK.md`。
/// ⚠️ **为什么这个结构是 `pub` 而字段是私有的**：`Frame`（`app.mbt`）是公开类型，
/// 而 MoonBit 不允许"公开定义依赖私有类型"（`Error [4046]`）。所以这里把**类型名**公开、
/// **字段全私有** —— 外部拿不到也构造不出，它是个不透明的实现细节。
/// （同一形状的先例：`store.mbt` 的 `Store`。）
///
/// ## 怎么定位"同一个位置"
///
/// 用**从根下来的孩子序号路径**（`MCtx.path`）：`[1, 5]` = 根的第 1 个孩子的第 5 个孩子。
/// 路径只在**真的遇到 `Thunk`** 时才用来查/建缓存节点（`MCtx::here`），
/// 所以**不用 `memo` 的应用：零分配、零哈希表操作**，每帧只多几次"把序号写进路径数组"。
/// 这一点是刻意的：不能拿大多数人的性能去换少数人的功能（`PERF.md` §10 的纪律 7）。
///
/// 为什么不用"一个扁平的 `(哈希, 元素)` 表 + 遍历序号"：那样在结构变动时会把
/// **不相干的两个 thunk** 对到一起，错配会**静默地画出旧内容**。路径定位下，
/// 结构一动就是"这个路径上的键不同 ⇒ 重算"，最坏只是**不省**。
pub struct MCache {
  /// 这个路径上的 thunk：上一次的哈希 / 元素 / 有没有存过。
  mut t_hash : Int
  mut t_ok : Bool
  mut t_el : JsValue
  /// 这个路径上容器的孩子们（按孩子序号，**惰性**建）。
  kids : Map[Int, MCache]
}

///|
/// 一个挂载点的 memo 上下文（放在 `Frame` 里，**不是模块全局**：
/// 全局的话同一进程里挂两个应用会互相冲掉对方的缓存）。
pub struct MCtx {
  root : MCache
  /// 复用的路径数组 —— 递归进出时写/回退，**不分配**。
  path : Array[Int]
  mut depth : Int
  /// **这棵树里已知有 `memo`** 吗？（`VNode::Thunk`）
  ///
  /// 为什么要这一位：路径记账（每个孩子一次 `enter`/`leave`）**只有 thunk 用得上**，
  /// 而它是**每帧每个元素**都要付的。不用 `memo` 的应用（大多数）本来可以一分不付：
  /// 于是先走**不记账的快路**，一旦真的遇到 thunk，就把这一帧作废、`armed = true` 并重画
  /// （只发生一次）。之后一直走记账路，行为与从前完全一致。
  ///
  /// ⚠️ 这里**不做"猜"**：不是根据上一次的形状猜这一次有没有 thunk，而是**真的走一遍** ——
  /// 遇到就是遇到。所以不存在"某次换屏之后 memo 静默失效"那种失败模式。
  mut armed : Bool
  /// 本次快路里有没有见到 thunk（每帧置回）。
  mut saw_thunk : Bool
}

///|
/// **memo 命中/未命中的诊断计数**（只给验证脚本与自查用；与 `handler_count()` 同一档定位）。
///
/// 为什么值得有：这一层的失败模式是"看起来包了 memo、其实没有"（上游 0.16 的 `memo`
/// 在我们这条通道上曾经**整段空转** —— 哈希被丢掉，见 `docs/PERF.md` §11.2）。
/// 有了这两个数，"包没包对"就从**读代码猜**变成**可断言**：
/// 开了 memo 的那一档，命中率应当接近 100%；没开的应当是 0。
///
/// ⚠️ 与 `handler_count()` / `unmapped_tag_count()` 一样是**模块级**计数（一个进程一个应用时才有意义）。
priv struct MemoCounter {
  mut hits : Int
  mut misses : Int
}

///|
let g_memo_count : MemoCounter = { hits: 0, misses: 0 }

///|
/// memo 命中次数（复用旧子树）。
pub fn memo_hit_count() -> Int {
  g_memo_count.hits
}

///|
/// memo 未命中次数（重算并换掉缓存）。
pub fn memo_miss_count() -> Int {
  g_memo_count.misses
}

///|
fn MCache::new() -> MCache {
  { t_hash: 0, t_ok: false, t_el: js_null(), kids: Map([]) }
}

///|
fn MCtx::new() -> MCtx {
  {
    root: MCache::new(),
    path: [0, 0, 0, 0, 0, 0, 0, 0],
    depth: 0,
    armed: false,
    saw_thunk: false,
  }
}

///|
fn MCtx::enter(self : MCtx, i : Int) -> Unit {
  if self.depth == self.path.length() {
    self.path.push(0)
  }
  self.path[self.depth] = i
  self.depth = self.depth + 1
}

///|
fn MCtx::leave(self : MCtx) -> Unit {
  self.depth = self.depth - 1
}

///|
/// 当前路径对应的缓存节点（缺就沿路建出来）。**只在遇到 `Thunk` 时调用**。
fn MCtx::here(self : MCtx) -> MCache {
  let mut node = self.root
  for i = 0; i < self.depth; i = i + 1 {
    let idx = self.path[i]
    match node.kids.get(idx) {
      Some(c) => node = c
      None => {
        let c = MCache::new()
        node.kids.set(idx, c)
        node = c
      }
    }
  }
  node
}

///|
/// 带记忆化的翻译：语义与 `render_node` **逐条相同**，只多了"`Thunk` 命中就复用旧元素"。
/// 唯一的行为差异就是 `memo` 想让你省下的那部分工作。
fn render_memo(
  v : @vdom.VNode,
  sched : &@cmd.Scheduler,
  ctx : MCtx,
) -> JsValue {
  match v {
    @vdom.VNode::Thunk(hash, f) => {
      let node = ctx.here()
      if node.t_ok && node.t_hash == hash {
        g_memo_count.hits = g_memo_count.hits + 1
        node.t_el
      } else {
        g_memo_count.misses = g_memo_count.misses + 1
        // 未命中：**原地**往下画（内层 memo 会走到更深一层的路径上）
        let el = render_memo(f(), sched, ctx)
        node.t_ok = true
        node.t_hash = hash
        node.t_el = el
        el
      }
    }
    @vdom.VNode::Elem(tag, props, kids, ..) =>
      js_create_element(
        js_host_component(map_tag(tag)),
        render_props(tag, props, sched),
        render_children_memo(kids, sched, ctx),
      )
    @vdom.VNode::Text(s) => {
      let arr = js_arr_new()
      js_arr_push(arr, js_str(s))
      js_create_element(js_host_component("Text"), js_obj_new(), arr)
    }
    @vdom.VNode::Frag(kids) =>
      js_create_element(
        js_fragment(),
        js_obj_new(),
        render_children_memo(@vdom.Children::Array(kids), sched, ctx),
      )
  }
}

///|
/// `render_children` 的记忆化版本。
///
/// ⚠️ **`Children::Map`（keyed 孩子）也按"第几个"定位**，不按 key 定位：
/// 结构位置才是"同一个位置"的判据，key 只是 React 那边的提示。
/// 重排会让路径上的键对不上 ⇒ **重算**（安全的那一侧）。
fn render_children_memo(
  c : @vdom.Children[@vdom.VNode],
  sched : &@cmd.Scheduler,
  ctx : MCtx,
) -> JsValue {
  let arr = js_arr_new()
  match c {
    @vdom.Children::Array(kids) => {
      for i, k in kids {
        ctx.enter(i)
        js_arr_push(arr, render_memo(k, sched, ctx))
        ctx.leave()
      }
    }
    @vdom.Children::Map(m) => {
      let mut i = 0
      for key, k in m {
        ctx.enter(i)
        js_arr_push(arr, js_with_key(render_memo(k, sched, ctx), key))
        ctx.leave()
        i = i + 1
      }
    }
    @vdom.Children::RawHtml(_) => {
      g_unsupported.n = g_unsupported.n + 1
    }
  }
  arr
}

///|
/// 一个已挂载应用"当前帧"的 React 元素（**带 memo 记忆化**）。
///|
/// **不记账的快路**：语义与 `render_memo` **逐条相同**（thunk 照样强制求值、元素照样建），
/// 只做两件不同的事：① 不走 `ctx.enter/leave` 的路径记账；② 见到 thunk 就举起 `saw_thunk`。
///
/// 它是"这棵树里没有 memo"时那条路 —— 于是**不用 memo 的应用每帧一分记账都不付**。
fn render_fast(
  v : @vdom.VNode,
  sched : &@cmd.Scheduler,
  ctx : MCtx,
) -> JsValue {
  match v {
    @vdom.VNode::Thunk(_, f) => {
      // 见到就是见到 —— 这一帧会被作废，改走记账路重画
      ctx.saw_thunk = true
      render_fast(f(), sched, ctx)
    }
    @vdom.VNode::Elem(tag, props, kids, ..) =>
      js_create_element(
        js_host_component(map_tag(tag)),
        render_props(tag, props, sched),
        render_children_fast(kids, sched, ctx),
      )
    @vdom.VNode::Text(s) => {
      let arr = js_arr_new()
      js_arr_push(arr, js_str(s))
      js_create_element(js_host_component("Text"), js_obj_new(), arr)
    }
    @vdom.VNode::Frag(kids) =>
      js_create_element(
        js_fragment(),
        js_obj_new(),
        render_children_fast(@vdom.Children::Array(kids), sched, ctx),
      )
  }
}

///|
fn render_children_fast(
  c : @vdom.Children[@vdom.VNode],
  sched : &@cmd.Scheduler,
  ctx : MCtx,
) -> JsValue {
  let arr = js_arr_new()
  match c {
    @vdom.Children::Array(kids) => {
      for k in kids {
        js_arr_push(arr, render_fast(k, sched, ctx))
      }
    }
    @vdom.Children::Map(m) => {
      for key, k in m {
        js_arr_push(arr, js_with_key(render_fast(k, sched, ctx), key))
      }
    }
    @vdom.Children::RawHtml(_) => {
      g_unsupported.n = g_unsupported.n + 1
    }
  }
  arr
}

///|
/// 一帧的入口：**先按"这棵树有没有 memo"决定走哪条路**。
///
/// ```
/// armed = false（还不知道）→ 走快路（零记账）
///    ├─ 全程没见到 thunk  ⇒ 这一帧就这么交了（零记账，省下全部路径记账）
///    └─ 见到了 thunk      ⇒ 作废、armed = true、重画这一帧（**只发生一次**）
/// armed = true          → 一直走记账路（与从前完全一致）
/// ```
///
/// 为什么"重画"是安全的：`render_*` **只有建对象这一个副作用**（不碰 DOM、不碰 store），
/// 丢掉的那棵树只是垃圾；被丢掉的那一帧里 `render_props` 的 `g_handlers` 计数会多算一次
/// —— 那是诊断计数（`handler_count()`），不参与任何判据。
fn render_root(
  v : @vdom.VNode,
  sched : &@cmd.Scheduler,
  ctx : MCtx,
) -> JsValue {
  if ctx.armed {
    return render_memo(v, sched, ctx)
  }
  ctx.saw_thunk = false
  let el = render_fast(v, sched, ctx)
  if !ctx.saw_thunk {
    return el
  }
  ctx.armed = true
  render_memo(v, sched, ctx)
}
