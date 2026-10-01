///|
/// gallery 的公共骨架：**格子**（判据的落点）＋ 共用的 JSON 常量。
///
/// `cell` 上的 `data-demo="<组件名>"` 是整个 demo 判据的支点：
/// `host/verify.mjs` 会**读 manifest 的组件名单**，逐个去 DOM 里找对应的格子，
/// 并断言格子里面确实有 antd 渲染出来的 DOM。于是：
///   · 少写一个组件 → 找不到格子 → 红；
///   · 组件名写错（manifest 里没有）→ 生成物里也不会有这个函数，编译期就红；
///   · 组件渲染成空盒子（例如名字没接上宿主注册表）→ 格子是空的 → 红。
fn[C : @html.IsChildren] cell(name : String, children : C) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build()
      .data_set("demo", name)
      .styles(
        @style.Style::new()
          .margin_bottom(@style.px(12.0))
          .padding(@style.px(8.0))
          .border_width(1.0)
          .border_style(@style.BorderStyle::Solid)
          .border_color("#eee"),
      ),
    children,
  )
}

///|
/// 一个小标题（用**内置标签**写 —— 老路径的对照）
fn label(text : String) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build().styles(
      @style.Style::new().font_size(12.0).color("#888"),
    ),
    text,
  )
}

///|
fn section(title : String, children : Array[@html.Html]) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build().styles(
      @style.Style::new().margin_bottom(@style.px(24.0)),
    ),
    [
      @antd.divider(orientation="left", @html.span(
        attrs=@html.Attrs::build().styles(
          @style.Style::new().font_size(18.0).font_weight(@style.FontWeight::W600),
        ),
        title,
      )),
      @html.div(attrs=@html.Attrs::build(), children),
    ],
  )
}

// ── 共用的 JSON 常量 ─────────────────────────────────────────────────────────
//
// 结构化 prop 走 `prop_json`（`Attrs` 的值域只有 String / Bool / Int / Double，
// 对象与数组必须序列化过去；宿主按 manifest 的 `jsonProps` 做 `JSON.parse`）。
// 手写 JSON 文本是这套机制的**已知代价**：改了字段名，编译器不会说话 ——
// 所以下面每一条都写清了它喂给哪个组件（至少让人能查）。
//
// 为什么不用 JSON 里的中文以外的写法：antd 的示例文案本来就是中文，直接照抄。

/// 喂 `Select` / `AutoComplete` / `Cascader`…：`options`
let json_options : String = "[{\"value\":\"sh\",\"label\":\"上海\"},{\"value\":\"bj\",\"label\":\"北京\"},{\"value\":\"gz\",\"label\":\"广州\"}]"

/// 喂 `Radio.Group` / `Segmented`：`options`
let json_radio_options : String = "[{\"label\":\"上海\",\"value\":\"sh\"},{\"label\":\"北京\",\"value\":\"bj\"},{\"label\":\"广州\",\"value\":\"gz\"}]"

/// 喂 `Table`：`columns`
let json_columns : String = "[{\"title\":\"序号\",\"dataIndex\":\"id\"},{\"title\":\"分数\",\"dataIndex\":\"score\"}]"

/// 喂 `Table`：`dataSource`（**跟着 Model 走** —— 这样"表格行数"能断言 JSON 通道是活的）
fn json_rows(model : Model) -> String {
  let parts : Array[String] = []
  for i = 1; i <= model.rows; i = i + 1 {
    parts.push("{\"id\":\{i},\"score\":\{i * 10}}")
  }
  "[" + parts.join(",") + "]"
}

/// 喂 `Tree` / `TreeSelect`：`treeData`
let json_tree : String = "[{\"title\":\"父节点\",\"key\":\"p\",\"children\":[{\"title\":\"子节点\",\"key\":\"c\"}]}]"

/// 喂 `Tabs`：`items`（`children` 在 JSON 里就是一段文本，React 会当文本渲染）
let json_tabs : String = "[{\"key\":\"one\",\"label\":\"第一页\",\"children\":\"第一页的内容\"},{\"key\":\"two\",\"label\":\"第二页\",\"children\":\"第二页的内容\"}]"

/// 喂 `Menu`：`items`
let json_menu : String = "[{\"key\":\"m1\",\"label\":\"菜单一\"},{\"key\":\"m2\",\"label\":\"菜单二\"}]"

/// 喂 `Steps`：`items`
let json_steps : String = "[{\"title\":\"第一步\",\"description\":\"说明一\"},{\"title\":\"第二步\",\"description\":\"说明二\"},{\"title\":\"第三步\",\"description\":\"说明三\"}]"

/// 喂 `Timeline`：`items`
let json_timeline : String = "[{\"children\":\"创建于 2026\"},{\"children\":\"接入 antd\"},{\"children\":\"跑通 71 个组件\"}]"

/// 喂 `Collapse`：`items`
let json_collapse : String = "[{\"key\":\"c1\",\"label\":\"折叠面板一\",\"children\":\"面板一的内容\"},{\"key\":\"c2\",\"label\":\"折叠面板二\",\"children\":\"面板二的内容\"}]"

/// 喂 `Descriptions`：`items`
let json_descriptions : String = "[{\"key\":\"1\",\"label\":\"项目\",\"children\":\"moobile antd demo\"},{\"key\":\"2\",\"label\":\"组件数\",\"children\":\"71\"}]"

/// 喂 `Breadcrumb`：`items`
let json_breadcrumb : String = "[{\"title\":\"首页\"},{\"title\":\"组件\"},{\"title\":\"antd\"}]"

/// 喂 `Transfer`：`dataSource`
let json_transfer : String = "[{\"key\":\"1\",\"title\":\"候选项一\"},{\"key\":\"2\",\"title\":\"候选项二\"}]"

/// 喂 `Tour`：`steps`
let json_tour : String = "[{\"title\":\"欢迎\",\"description\":\"这是 Tour 的一步\"}]"

/// 喂 `Watermark`：`content`
let json_watermark : String = "[\"moobile\"]"

/// 喂 `Skeleton`：`title` / `paragraph` / `avatar`
let json_skeleton : String = "{\"rows\":2}"

/// 喂 `Progress`：`steps`
let json_progress_steps : String = "{\"count\":5,\"gap\":4}"

/// 喂 `Pagination`：`showSizeChanger`
let json_true : String = "true"

/// 喂 `Table`：`scroll`
let json_table_scroll : String = "{\"x\":\"max-content\"}"

/// 喂 `Table`：`pagination`（关掉分页，行数断言才好写）
let json_no_pagination : String = "false"

/// 喂 `Slider`：`marks`
let json_marks : String = "{\"0\":\"0\",\"30\":\"30\",\"70\":\"70\",\"100\":\"100\"}"

/// 喂 `Rate` 之外那些"字符串枚举"的 json prop：`Cascader.options` 等的兜底空值
let json_empty_array : String = "[]"

/// 喂 `Cascader`：`options`（带 children 的层级）
let json_cascader : String = "[{\"value\":\"zj\",\"label\":\"浙江\",\"children\":[{\"value\":\"hz\",\"label\":\"杭州\"}]},{\"value\":\"js\",\"label\":\"江苏\",\"children\":[{\"value\":\"nj\",\"label\":\"南京\"}]}]"

/// 喂 `Transfer`：`titles` / `operations`
let json_transfer_titles : String = "[\"待选\",\"已选\"]"

/// 喂 `Listy`：`items`
let json_listy_items : String = "[{\"key\":\"1\",\"title\":\"第一行\"},{\"key\":\"2\",\"title\":\"第二行\"}]"

/// 喂 `Masonry`：`items`（形状见 `MasonryItemType`：`key` 必填，其余可选）
let json_masonry_items : String = "[{\"key\":\"1\",\"height\":60,\"children\":\"砖一\"},{\"key\":\"2\",\"height\":90,\"children\":\"砖二\"}]"

/// 喂 `Collapse`：`defaultActiveKey`（**数组**，不是字符串）
let json_c1 : String = "[\"c1\"]"

/// 喂 `Descriptions`：`column`
let json_two : String = "2"

/// 喂 `Typography.Title`：`level`
let json_one : String = "1"

/// 字面量 `true` / `false` 的 JSON 文本（有些 prop 走 JSON 通道但只是布尔）
let json_true_str : String = "true"
let json_false_str : String = "false"

/// 喂 `Popover`：`title` / `content`
let json_popover_title : String = "标题"
let json_popover_body : String = "这是 Popover 的内容"
