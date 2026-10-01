// 由 `moobile-host libgen` 生成 —— **不要手改**。
//
// 组件库：react-native-markdown-display@7.0.2（命名空间 `md:`）
// 生成器：moobile-host libgen 0.3.0｜manifest 版本 1
// 组件 1 个｜生成的参数 4 个｜未生成 4 个
//
// ## 怎么用
//
// ```moonbit
// @md.button(type_="primary", danger=true, on_click=emit(Bump), "加一条")
// @md.input(value=model.draft, on_change=e => emit(SetDraft(e.text())))
// ```
//
// ## 五条边界（都是实测的，不是猜测）
//
// 1. **写错 prop 名 = 编译错误**（这正是生成这套东西的主要收益）。
// 2. 名字**必须小写**：`pub fn Button(...)` 是 parse error（大写开头是类型名）。
// 3. 事件的两种参数形态：
//    · `on_click? : @cmd.Cmd` —— **信号**（鼠标/键盘/焦点…，载荷里没有"组件的值"）；
//    · `on_change? : (@html.Payload) -> @cmd.Cmd` —— **带值**（`e.text()` / `e.bool()` / `e.json()`）。
//    分类逐条写在 manifest 的 `event_kind` / `event_reason` 里，可复核。
// 4. **逃生口是 `attrs?`**：
//    · 没生成的 prop（React 公共属性的长尾、`aria-*`、`data-*`）→ `attrs=@html.Attrs::build().prop_str(...)`；
//    · 信号事件想读载荷（例如 `onKeyDown` 的按键）→ `attrs=@html.Attrs::build().on_raw("onKeyDown", …)`；
//    · 继承链解不开的基类 prop 也只能这么写。
// 5. **`children` 有两种形态**：默认是子节点（`children : C`，`C : @html.IsChildren`），
//    而"把 children 当数据用"的组件（markdown 渲染器这类）是**原始字符串** ——
//    那些函数的参数写成 `children : String`，字符串原样落到组件的 prop 上。
//    哪些组件属于后者写在 manifest 的 `content` 里（类型定义多半看不出这件事）。
//
// 底层仍然是"字符串标签 + 命名空间"（`@html.node("md:X", …)`）：
// 生成器只是把这层写法抹掉了。名字指向哪个真实实现，仍然由宿主注册表决定 ——
// 这正是平台矩阵（同一命名空间按平台注册不同实现）还能成立的原因。

// ── 包内私有助手：把 `match Some/None` 收进一个地方 ─────────────────────────
// 为什么要它们：不加的话，2693 个参数要摊开 1.5 万行 `match`。
// 它们**不是**公开 API（没有 `pub`），所以不会变成"我们承诺的接口面"。

///|
fn opt_bool(a : @html.Attrs, key : String, v : Bool?) -> @html.Attrs {
  match v {
    Some(x) => a.prop_bool(key, x)
    None => a
  }
}

///|
/// 结构化值走 **JSON 文本**（`Payload` 之外的既有限制：`Attrs` 的值域只有
/// String / Bool / Int / Double）。宿主按 manifest 的 `jsonProps` 做 `JSON.parse`。
fn opt_json(a : @html.Attrs, key : String, v : String?) -> @html.Attrs {
  match v {
    Some(x) => a.prop_json(key, x)
    None => a
  }
}

///|
fn opt_payload(a : @html.Attrs, key : String, v : ((@html.Payload) -> @cmd.Cmd)?) -> @html.Attrs {
  match v {
    Some(f) => a.on_raw(key, f)
    None => a
  }
}
///|
/// 组件库 `md:Markdown`（Props 接口 `MarkdownProps`）。
///
/// 参数 4 个（清单里另有 4 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 这个组件的 `children` 是**原始字符串**（不是子树）：参数写成 `children : String`，
/// 落到宿主侧的 `children` prop（判据：`config:content`）。
/// 为什么不能给子节点：MoonBit 的字符串子节点会渲染成 `<Text>` **元素**，而把 children
/// 当数据用的组件拿到元素就崩（实测：markdown-it 报 `Input data should be a String`，
/// 且**每个字符一次**）。传进来的字符串原样就是组件拿到的那份内容。
pub fn markdown(
  rules? : String,
  merge_style? : Bool,
  debug_print_tree? : Bool,
  on_link_press? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : String,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "rules", rules)
  a = opt_bool(a, "mergeStyle", merge_style)
  a = opt_bool(a, "debugPrintTree", debug_print_tree)
  a = opt_payload(a, "onLinkPress", on_link_press)
  a = a.prop_str("children", children)
  @html.node("md:Markdown", a, ([] : Array[@html.Html]))
}
