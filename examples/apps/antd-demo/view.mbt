///|
/// 根视图：把四段 gallery 拼成一页，并在最上面放**交互状态面板**。
///
/// 状态面板不是装饰：它是"回调真的回来了"的**人眼可见证据**
/// （`Model.log` 里每次回调追加一句），而 `verify.mjs` 会断言其中几条。
/// 只断言"DOM 变了"是不够的 —— 那种断言在"值传错了"时照样通过。
pub fn view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @antd.config_provider(
    component_size="middle",
    [
      @html.div(
        attrs=@html.Attrs::build()
          .styles(@style.Style::new().padding(@style.px(16.0)).background_color("#f5f5f5")),
        [
          @antd.typography_title(level=1.0, "moobile × antd 全组件 demo"),
          @antd.typography_paragraph(
            "71 个组件，全部由 libgen 生成的 @antd DSL 渲染；名单读的是同一份 manifest。",
          ),
          status_panel(model),
          section("数据录入（19 个）", entry_cells(model, emit)),
          section("数据展示（28 个）", display_cells(model, emit)),
          section("反馈与导航（14 个）", feedback_cells(model, emit)),
          section("布局与起点（10 个）", layout_cells(model, emit)),
        ],
      ),
    ],
  )
}

///|
/// 交互状态面板：把 Model 里每一个"应变而变"的字段摆出来。
///
/// 用**内置标签**（`@html.div` / `@html.span`）写 —— 顺带证明老路径没被组件库影响。
fn status_panel(model : Model) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build()
      .data_set("demo-state", "1")
      .styles(
        @style.Style::new()
          .padding(@style.px(8.0))
          .margin_bottom(@style.px(16.0))
          .background_color("#fff"),
      ),
    [
      line("draft", model.draft),
      line("num", "\{model.num}"),
      line("on", if model.on { "true" } else { "false" }),
      line("agree", if model.agree { "true" } else { "false" }),
      line("picked", model.picked),
      line("city", model.city),
      line("tab", model.tab),
      line("page", "\{model.page}"),
      line("step", "\{model.step}"),
      line("rows", "\{model.rows}"),
      line("log", model.log),
    ],
  )
}

///|
fn line(key : String, value : String) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build().styles(
      @style.Style::new().font_size(13.0).font_family("monospace"),
    ),
    [
      @html.span(
        attrs=@html.Attrs::build().styles(
          @style.Style::new().color("#888").width(@style.px(64.0)),
        ),
        key + " = ",
      ),
      @html.span(
        attrs=@html.Attrs::build().data_set("state", key),
        value,
      ),
    ],
  )
}
