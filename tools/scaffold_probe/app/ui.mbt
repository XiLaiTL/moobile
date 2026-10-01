///|
/// 视图（探针应用）。写法与模板/示例一致：`@html` DSL + 类型化样式。
///
/// 这里刻意比模板多两样东西，因为它们是"生成出来的项目撑不撑得住一个像样应用"的关键：
/// **多页面切换**（`Page` 上的一条分发）与**过滤后的列表**（同一个 Model 的另一种读法）。

///|
let c_bg : String = "#f6efe0"

///|
let c_card : String = "#fffaf0"

///|
let c_ink : String = "#1a1410"

///|
let c_ink3 : String = "#7a6851"

///|
let c_accent : String = "#8a2518"

///|
let c_line : String = "#e0d5c0"

///|
fn attrs(s : @style.Style) -> @html.Attrs {
  @html.Attrs::build().styles(s)
}

///|
fn chip(name : String, on : Bool, msg : Msg, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.button(
    attrs=attrs(
      @style.Style::new()
      .padding_horizontal(@style.px(14.0))
      .padding_vertical(@style.px(6.0))
      .border_radius(999.0)
      .border_width(1.0)
      .margin_right(@style.px(8.0))
      .background_color(if on { c_accent } else { "transparent" })
      .border_color(if on { c_accent } else { c_line }),
    ),
    on_click=emit(msg),
    [
      @html.span(
        attrs=attrs(@style.Style::new().font_size(13.0).color(if on { c_card } else { c_ink3 })),
        name,
      ),
    ],
  )
}

///|
fn item_row(t : Todo, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex_direction(@style.FlexDirection::Row)
      .align_items(@style.Align::Center)
      .background_color(c_card)
      .border_radius(12.0)
      .border_width(1.0)
      .border_color(c_line)
      .padding_horizontal(@style.px(14.0))
      .padding_vertical(@style.px(12.0))
      .margin_bottom(@style.px(8.0)),
    ),
    [
      @html.button(
        attrs=attrs(
          @style.Style::new()
          .width(@style.px(22.0))
          .height(@style.px(22.0))
          .border_radius(6.0)
          .border_width(1.5)
          .align_items(@style.Align::Center)
          .justify_content(@style.Justify::Center)
          .margin_right(@style.px(12.0))
          .background_color(if t.done { c_accent } else { "transparent" })
          .border_color(if t.done { c_accent } else { c_line }),
        ),
        on_click=emit(Toggle(t.id)),
        [
          @html.span(
            attrs=attrs(
              @style.Style::new().font_size(13.0).color(c_card).font_weight(
                @style.FontWeight::W700,
              ),
            ),
            if t.done { "✓" } else { "" },
          ),
        ],
      ),
      // 文字本身可点 → 进编辑页（多页面那条链路的入口）
      @html.button(
        attrs=attrs(@style.Style::new().flex(1.0)),
        on_click=emit(OpenEdit(t.id)),
        [
          @html.span(
            attrs=attrs(
              @style.Style::new()
              .font_size(15.0)
              .color(if t.done { c_ink3 } else { c_ink })
              .text_decoration_line(
                if t.done {
                  @style.TextDecorationLine::LineThrough
                } else {
                  @style.TextDecorationLine::None
                },
              ),
            ),
            t.text,
          ),
        ],
      ),
      @html.button(
        attrs=attrs(@style.Style::new().padding_horizontal(@style.px(6.0))),
        on_click=emit(Remove(t.id)),
        [
          @html.span(
            attrs=attrs(@style.Style::new().font_size(13.0).color(c_ink3)),
            "✕",
          ),
        ],
      ),
    ],
  )
}

///|
fn input_row(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex_direction(@style.FlexDirection::Row)
      .align_items(@style.Align::Center)
      .background_color(c_card)
      .border_radius(14.0)
      .border_width(1.0)
      .border_color(c_line)
      .padding_horizontal(@style.px(14.0)),
    ),
    [
      @html.input(
        value=model.draft,
        placeholder="要做点什么？",
        on_input=emit.map(s => SetDraft(s)),
        attrs=attrs(
          @style.Style::new()
          .flex(1.0)
          .font_size(16.0)
          .color(c_ink)
          .padding_vertical(@style.px(10.0)),
        ),
      ),
      @html.button(
        attrs=attrs(
          @style.Style::new()
          .background_color(c_accent)
          .border_radius(10.0)
          .padding_horizontal(@style.px(16.0))
          .padding_vertical(@style.px(9.0))
          .margin_left(@style.px(10.0)),
        ),
        on_click=emit(Add),
        [
          @html.span(
            attrs=attrs(
              @style.Style::new().font_size(15.0).color(c_card).font_weight(
                @style.FontWeight::W600,
              ),
            ),
            "添加",
          ),
        ],
      ),
    ],
  )
}

///|
fn list_screen(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  let rows = visible(model).map(t => item_row(t, emit))
  let body = if rows.length() == 0 {
    [
      @html.span(
        attrs=attrs(@style.Style::new().font_size(14.0).color(c_ink3)),
        "这里空着。",
      ),
    ]
  } else {
    rows
  }
  @html.div(
    attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Column).gap(12.0)),
    [
      @html.div(
        attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Row)),
        [
          @html.span(
            attrs=attrs(
              @style.Style::new().font_size(22.0).color(c_ink).font_weight(
                @style.FontWeight::W700,
              ),
            ),
            "待办",
          ),
          @html.span(
            attrs=attrs(
              @style.Style::new().font_size(13.0).color(c_ink3).margin_left(
                @style.px(10.0),
              ),
            ),
            "还有 \{left_count(model)} 件",
          ),
        ],
      ),
      @html.div(
        attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Row)),
        [
          chip("全部", model.filter == All, SetFilter(All), emit),
          chip("未完成", model.filter == Active, SetFilter(Active), emit),
          chip("已完成", model.filter == Done, SetFilter(Done), emit),
        ],
      ),
      input_row(model, emit),
      @html.div(attrs=attrs(@style.Style::new()), body),
      @html.span(
        attrs=attrs(@style.Style::new().font_size(12.0).color(c_ink3)),
        "本次会话 \{model.ticks * 5} 秒",
      ),
    ],
  )
}

///|
fn edit_screen(model : Model, id : Int, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Column).gap(12.0)),
    [
      @html.button(
        attrs=attrs(@style.Style::new().padding_vertical(@style.px(6.0))),
        on_click=emit(Back),
        [
          @html.span(
            attrs=attrs(@style.Style::new().font_size(14.0).color(c_ink3)),
            "← 返回清单",
          ),
        ],
      ),
      @html.span(
        attrs=attrs(
          @style.Style::new().font_size(20.0).color(c_ink).font_weight(
            @style.FontWeight::W700,
          ),
        ),
        "编辑这一条",
      ),
      @html.input(
        value=model.editing,
        placeholder="内容",
        on_input=emit.map(s => SetEditing(s)),
        attrs=attrs(
          @style.Style::new()
          .font_size(16.0)
          .color(c_ink)
          .background_color(c_card)
          .border_radius(12.0)
          .border_width(1.0)
          .border_color(c_line)
          .padding(@style.px(12.0)),
        ),
      ),
      @html.button(
        attrs=attrs(
          @style.Style::new()
          .background_color(c_accent)
          .border_radius(10.0)
          .padding_horizontal(@style.px(16.0))
          .padding_vertical(@style.px(9.0))
          .align_items(@style.Align::Center),
        ),
        on_click=emit(SaveEdit(id)),
        [
          @html.span(
            attrs=attrs(@style.Style::new().font_size(15.0).color(c_card)),
            "保存",
          ),
        ],
      ),
    ],
  )
}

///|
pub fn view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  let inner = match model.page {
    List => list_screen(model, emit)
    Edit(id) => edit_screen(model, id, emit)
  }
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex(1.0)
      .padding(@style.px(20.0))
      .background_color(c_bg),
    ),
    [inner],
  )
}
