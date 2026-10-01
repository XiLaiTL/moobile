///|
/// gallery 之二：**数据展示**（28 个组件）。
///
/// 这一段压的是**结构化 prop（JSON 通道）**：`Table.columns/dataSource`、
/// `Descriptions.items`、`Collapse.items`、`Timeline.items`、`Tabs.items`…
/// 它们的形状是对象与数组，而 `Attrs` 的值域只有 String / Bool / Int / Double，
/// 所以必须序列化成 JSON 文本 —— 宿主按 manifest 的 `jsonProps` 做 `JSON.parse`。
///
/// 判据落在"**数据真的进去了**"上（不是"组件出现了"）：
/// `verify.mjs` 断言表格里能看到 `10 / 20 / 30` 这些**来自 MoonBit 的**数字，
/// 并且行数跟着 `Model.rows` 走（点一下 `Button` 加一行）。
fn display_cells(model : Model, emit : @cmd.Emit[Msg]) -> Array[@html.Html] {
  [
    // ── 表格：JSON 通道最典型的一个 ────────────────────────────────────────
    cell("Table", [
      @antd.table(
        columns=json_columns,
        data_source=json_rows(model),
        row_key="id",
        pagination=json_no_pagination,
        scroll=json_table_scroll,
        bordered=true,
        size="small",
        ([] : Array[@html.Html]),
      ),
    ]),
    // ── 列表：`List.Item` 是复合子组件（`renderItem` 是回调，通不过 prop 通道）──
    cell("List", [
      @antd.list(
        header="列表头",
        bordered=true,
        [
          @antd.list_item("第一项"),
          @antd.list_item("第二项"),
        ],
      ),
    ]),
    cell("Listy", [
      label("⚠️ 没有传 items：这两个组件的渲染由**回调**决定（itemRender），"),
      label("   而回调型 prop 过不了我们的 prop 通道 —— 见 README 的已知限制。"),
      @antd.listy(height=120.0),
    ]),
    cell("Masonry", [
      @antd.masonry(columns=json_two),
    ]),
    // ── 卡片 ──────────────────────────────────────────────────────────────
    cell("Card", [
      @antd.card(
        title="moobile × antd",
        hoverable=true,
        extra="更多",
        [
          @antd.card_meta(title="卡片标题", description="卡片描述"),
          @html.div(attrs=@html.Attrs::build(), "卡片内容"),
        ],
      ),
    ]),
    cell("Collapse", [
      @antd.collapse(items=json_collapse, default_active_key=json_c1, ([] : Array[@html.Html])),
    ]),
    cell("Descriptions", [
      @antd.descriptions(items=json_descriptions, bordered=true, column=json_two, ([] : Array[@html.Html])),
    ]),
    cell("Statistic", [
      @antd.statistic(value="\{model.rows * 10}", title="总分", suffix="分"),
    ]),
    cell("Badge", [
      @antd.badge(count="5", [
        @antd.avatar(shape="square", "M"),
      ]),
      @antd.badge(status="success", text="在线", ([] : Array[@html.Html])),
    ]),
    cell("Avatar", [
      @antd.avatar(size=jstr("large"), "A"),
      @antd.avatar(shape="circle", "B"),
    ]),
    cell("Tag", [
      @antd.tag(color="blue", "标签一"),
      @antd.tag(color="green", closable=json_true_str, "可关闭"),
    ]),
    cell("Image", [
      @antd.image(src=data_uri, width="80", alt="一个内联 SVG", ([] : Array[@html.Html])),
    ]),
    cell("QRCode", [
      @antd.qr_code(value=jstr("https://moonbitlang.com"), size=96.0, ([] : Array[@html.Html])),
    ]),
    cell("Typography", [
      @antd.typography_title(level=1.0, "标题一"),
      @antd.typography_paragraph("这是一段正文，用 `@antd.typography_paragraph` 写。"),
      @antd.typography_text(type_="success", "成功文本"),
    ]),
    cell("Empty", [
      @antd.empty(description="空空如也", ([] : Array[@html.Html])),
    ]),
    cell("Skeleton", [
      @antd.skeleton(active=true, paragraph=json_skeleton),
    ]),
    cell("Spin", [
      @antd.spin(spinning=true, size="small", ([] : Array[@html.Html])),
    ]),
    cell("Progress", [
      @antd.progress(percent=model.num, type_="circle", size="80", ([] : Array[@html.Html])),
      @antd.progress(percent=40.0, status="active", ([] : Array[@html.Html])),
    ]),
    cell("Timeline", [
      @antd.timeline(items=json_timeline, mode="left", ([] : Array[@html.Html])),
    ]),
    cell("Tree", [
      @antd.tree(tree_data=json_tree, default_expand_all=true, show_line=json_true_str, ([] : Array[@html.Html])),
    ]),
    cell("Calendar", [
      @antd.calendar(fullscreen=false),
    ]),
    cell("Carousel", [
      @antd.carousel(
        autoplay=json_false_str,
        [
          @html.div(attrs=@html.Attrs::build(), "第一屏"),
          @html.div(attrs=@html.Attrs::build(), "第二屏"),
        ],
      ),
    ]),
    cell("Tabs", [
      @antd.tabs(
        items=json_tabs,
        active_key=model.tab,
        on_change=e => emit(SetTab(e.text())),
        ([] : Array[@html.Html]),
      ),
    ]),
    cell("Watermark", [
      @antd.watermark(content=json_watermark, [
        @html.div(attrs=@html.Attrs::build().styles(@style.Style::new().height(@style.px(60.0))), "水印区域"),
      ]),
    ]),
    // ── 三个弹层类（它们渲染到 portal，断言在 jsdom 阶段）────────────────────
    cell("Tooltip", [
      @antd.tooltip(title=jstr("这是提示"), [
        @antd.button("悬停我"),
      ]),
    ]),
    cell("Popover", [
      @antd.popover(title=json_popover_title, content=json_popover_body, [
        @antd.button("点我弹层"),
      ]),
    ]),
    cell("Tour", [
      @antd.tour(steps=json_tour, open=true),
    ]),
    cell("BorderBeam", [
      @antd.border_beam(count=2.0, [
        @antd.button("带光束"),
      ]),
    ]),
  ]
}

///|
/// 一张**内联 SVG** 当图片源：demo 不联网，也不往仓库里塞二进制文件。
/// （`Image` 的 `src` 本来就是字符串，data URI 一样走 prop 通道。）
let data_uri : String = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Crect width='80' height='40' fill='%231677ff'/%3E%3C/svg%3E"
