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
/// 查表。**没有默认兜底成 `View`** —— 未收录会被计数并回报。
pub fn map_tag(tag : String) -> String {
  for entry in tag_table() {
    if entry.0 == tag {
      return entry.1
    }
  }
  g_unmapped.n = g_unmapped.n + 1
  if g_unmapped.names.length() < 20 {
    g_unmapped.names.push(tag)
  }
  // 兜底仍是 View（不崩），但计数会暴露它
  "View"
}

///|
/// 事件映射。**必须知道目标标签**，不能只看事件名：
/// 同一个 `click` 落到 `Pressable` 上是 `onPress`，落到别处未必；
/// 而 `input` 落到 `TextInput` 上是 `onChangeText`。
fn map_event(tag : String, event : String) -> String {
  match (tag, event) {
    ("input", "input") => "onChangeText"
    ("input", "change") => "onChangeText"
    ("input", "focus") => "onFocus"
    ("input", "blur") => "onBlur"
    (_, "click") => "onPress"
    (_, "long_click") => "onLongPress"
    (_, other) => "on" + other
  }
}

///|
/// 类型化样式 → RN 的 `style` 对象。
///
/// **长度与无单位量必须是数字**（RN 不接受 `"16px"`），其余必须是字符串
/// （`fontWeight: "700"` 一旦被 `Number()` 吃掉变成数字 `700` 就非法）。
///
/// 这个区分现在由**类型**保证 —— 不再需要运行时键白名单。
fn styles_to_js(styles : Map[String, @style.StyleValue]) -> JsValue {
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
  for key, value in styles {
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
  for k, v in props.attrs_map() {
    js_obj_set(o, k, js_str(v))
  }
  for k, v in props.props_map() {
    match v {
      @variant.Variant::Boolean(b) => js_obj_set(o, k, js_bool(b))
      @variant.Variant::Integer(i) => js_obj_set(o, k, js_int(i))
      @variant.Variant::Floating(d) => js_obj_set(o, k, js_num(d))
      @variant.Variant::String(s) => js_obj_set(o, k, js_str(s))
    }
  }
  // 处理器已由 vdom 侧适配成"只吃一个 JS 值"（`Event` 是包内私有类型，
  // 这一步只能在包内做）。React 给 `onPress` / `onChangeText` 都恰好递一个
  // 参数，所以这里不需要再包一层。
  props.each_handler(sched, (event, f) => {
    g_handlers.n = g_handlers.n + 1
    js_obj_set(o, map_event(tag, event), js_as_handler(f))
  })
  js_obj_set(o, "style", styles_to_js(props.styles_map()))
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
