///|
/// gallery 之四：**布局 + 起点**（10 个组件）。
///
/// `Button` 放在这里当"起点"：它是所有 demo 的第一个按钮，也是 `verify.mjs` 用来
/// 断言"事件回到 update"的那个（点一下 → 表格多一行 → 顺带证明 JSON 通道是活的）。
///
/// `ConfigProvider` 与 `App` 是**环境类**组件：它们没有自己的视觉产出
/// （`ConfigProvider` 只包一层 context；`App` 提供一个 `.ant-app` 容器）。
/// 它们在这份 demo 里的用法就是"真的用上一次" —— 判据是"没把树搞崩 + 有 `ant-app`"。
fn layout_cells(model : Model, emit : @cmd.Emit[Msg]) -> Array[@html.Html] {
  [
    cell("Button", [
      label("点它：事件回到 update，表格跟着多一行（结构化 prop 是活的）"),
      @antd.button(type_="primary", danger=false, on_click=emit(Bump), "加一条"),
      @antd.button(type_="default", danger=true, on_click=emit(Reset), "清空"),
      @antd.button(loading=json_true_str, "载入中"),
      @antd.button(disabled=true, "禁用"),
    ]),
    cell("Space", [
      @antd.space(size=jstr("middle"), wrap=true, [
        @antd.button("一"),
        @antd.button("二"),
        @antd.button("三"),
      ]),
    ]),
    cell("Flex", [
      @antd.flex(vertical=false, gap="8px", wrap=true, [
        @antd.tag(color="blue", "弹性甲"),
        @antd.tag(color="green", "弹性乙"),
      ]),
    ]),
    cell("Row", [
      @antd.row(gutter=json_gutter, [
        @antd.col(span=json_8, [@html.div(attrs=@html.Attrs::build(), "栅格 8")]),
        @antd.col(span=json_8, [@html.div(attrs=@html.Attrs::build(), "栅格 8")]),
      ]),
    ]),
    cell("Col", [
      @antd.row(gutter=json_gutter, [
        @antd.col(span=json_12, [@html.div(attrs=@html.Attrs::build(), "12 栏")]),
        @antd.col(span=json_12, [@html.div(attrs=@html.Attrs::build(), "12 栏")]),
      ]),
    ]),
    cell("Layout", [
      @antd.layout([
        @antd.layout_header([@html.div(attrs=@html.Attrs::build(), "Header")]),
        @antd.layout_content([@html.div(attrs=@html.Attrs::build(), "Content")]),
        @antd.layout_footer([@html.div(attrs=@html.Attrs::build(), "Footer")]),
      ]),
    ]),
    cell("Splitter", [
      label("⚠️ 这一格**没有面板**：antd 把 children 声明在组件类型上（不在 SplitterProps 里），"),
      label("   而生成器按 props 接口取 —— 见 README 的已知限制。壳仍然由 antd 渲染。"),
      @antd.splitter(layout="horizontal"),
    ]),
    cell("Divider", [
      @antd.divider(orientation="left", "左对齐的分隔线"),
      @antd.divider("默认分隔线"),
    ]),
    cell("App", [
      label("antd 6 的 App 组件（提供 message / notification 的上下文）"),
      @antd.app(message=json_app_context, [
        @html.div(
          attrs=@html.Attrs::build().styles(@style.Style::new().padding(@style.px(4.0))),
          "App 的内容",
        ),
      ]),
    ]),
    cell("ConfigProvider", [
      label("环境类组件：包一层 context，自己不出 DOM"),
      @antd.config_provider(component_size="middle", [
        @html.div(attrs=@html.Attrs::build(), "ConfigProvider 的内容"),
      ]),
    ]),
  ]
}

/// 喂 `Row` / `Col`：`gutter`
let json_gutter : String = "8"

/// 喂 `Col`：`span`
let json_8 : String = "8"
let json_12 : String = "12"

/// 喂 `App`：`message`（一个 context 配置对象；留空对象即可）
let json_app_context : String = "{}"
