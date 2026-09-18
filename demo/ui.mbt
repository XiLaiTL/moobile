///|
/// 视图。**用的是真实 `@html` DSL，处理器就是 `emit(Msg)`** ——
/// 与 `interest/yi` 的写法一致，不是 moobile 自造的 DSL。
///
/// 唯一与 Web 不同的地方是样式：`class=` 换成了类型化的
/// `attrs=Attrs::build().styles(...)`。这是设计文档 §7 阶段 5 预期的那次改写。
///
/// 配色沿用 `yi` 的纸墨色。
let c_paper : String = "#f6efe0"

///|
let c_card : String = "#fffaf0"

///|
let c_ink : String = "#1a1410"

///|
let c_ink3 : String = "#7a6851"

///|
let c_vermilion : String = "#8a2518"

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
      .background_color(if on { c_vermilion } else { "transparent" })
      .border_color(if on { c_vermilion } else { c_line }),
    ),
    on_click=emit(msg),
    [
      @html.span(
        attrs=attrs(
          @style.Style::new()
          .font_size(13.0)
          .color(if on { c_card } else { c_ink3 }),
        ),
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
      .align_items(@style.Align::Center)
      .background_color(c_card)
      .border_radius(12.0)
      .border_width(1.0)
      .border_color(c_line)
      .padding_horizontal(@style.px(14.0))
      .padding_vertical(@style.px(12.0))
      .margin_bottom(@style.px(8.0))
      .flex_direction(@style.FlexDirection::Row),
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
          .background_color(if t.done { c_vermilion } else { "transparent" })
          .border_color(if t.done { c_vermilion } else { c_line }),
        ),
        on_click=emit(Toggle(t.id)),
        [
          @html.span(
            attrs=attrs(
              @style.Style::new()
              .font_size(13.0)
              .font_weight(@style.FontWeight::W700)
              .color(c_card),
            ),
            if t.done { "✓" } else { "" },
          ),
        ],
      ),
      @html.span(
        attrs=attrs(
          @style.Style::new()
          .flex(1.0)
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
      @html.button(
        attrs=attrs(
          @style.Style::new()
          .padding_horizontal(@style.px(8.0))
          .padding_vertical(@style.px(4.0))
          .margin_left(@style.px(8.0)),
        ),
        on_click=emit(Remove(t.id)),
        [
          @html.span(
            attrs=attrs(@style.Style::new().font_size(14.0).color(c_ink3)),
            "✕",
          ),
        ],
      ),
    ],
  )
}

///|
/// 输入行。`on_input=emit.map(SetDraft)` —— `@html` 的 `on_input` 收
/// `Emit[String]`，而我们的 `emit` 是 `Emit[Msg]`，所以要 `map` 一下。
/// 这就是 yi 里 `on_input` 的标准用法。
fn input_row(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .align_items(@style.Align::Center)
      .background_color(c_card)
      .border_radius(14.0)
      .border_width(1.0)
      .border_color(c_line)
      .padding_horizontal(@style.px(14.0))
      .flex_direction(@style.FlexDirection::Row),
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
          .background_color(c_vermilion)
          .border_radius(10.0)
          .padding_horizontal(@style.px(16.0))
          .padding_vertical(@style.px(9.0))
          .margin_left(@style.px(10.0)),
        ),
        on_click=emit(Add),
        [
          @html.span(
            attrs=attrs(
              @style.Style::new()
              .font_size(15.0)
              .font_weight(@style.FontWeight::W600)
              .color(c_card),
            ),
            "添加",
          ),
        ],
      ),
    ],
  )
}

///|
/// 顶层视图。两个屏共用同一套 moobile 后端 —— 换屏只换这里。
pub fn view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  if model.screen == R1 {
    return r1_screen(emit)
  }
  todo_screen(model, emit)
}

///|
/// R1 样本屏。
///
/// ⚠️ **必须包一层滚动容器**：实测这一页在 390 宽下有 **1640px 高**，
/// 远超 844 的视口。RN 的 `View` 不滚动，所以不套 `ScrollView` 的话
/// 手机上只能看到第一屏（README 的 F7）。
///
/// `@html` 里没有滚动标签（HTML 靠 `overflow`），所以用 `node("scroll", …)`，
/// 由 moobile 的标签表映射到 RN 的 `ScrollView`。
fn r1_screen(emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(@style.Style::new().flex(1.0).background_color(r_paper1)),
    [
      @html.node(
        "scroll",
        attrs(@style.Style::new().flex(1.0)),
        [r1_view()],
      ),
      @html.div(
        attrs=attrs(
          @style.Style::new()
          .flex_direction(@style.FlexDirection::Row)
          .padding_horizontal(@style.px(16.0))
          .padding_vertical(@style.px(10.0)),
        ),
        [chip("← 回待办清单", false, SetScreen(Todo), emit)],
      ),
    ],
  )
}

///|
pub fn todo_screen(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  let kids : Array[@html.Html] = []
  kids.push(
    @html.div(
      attrs=attrs(
        @style.Style::new()
        .flex_direction(@style.FlexDirection::Row)
        .margin_bottom(@style.px(10.0)),
      ),
      [chip("R1 样本 →", false, SetScreen(R1), emit)],
    ),
  )
  kids.push(
    @html.h1(
      attrs=attrs(
        @style.Style::new()
        .font_size(34.0)
        .font_weight(@style.FontWeight::W700)
        .color(c_ink),
      ),
      "moobile",
    ),
  )
  kids.push(
    @html.p(
      attrs=attrs(
        @style.Style::new()
        .font_size(13.0)
        .color(c_ink3)
        .margin_top(@style.px(6.0))
        .margin_bottom(@style.px(24.0)),
      ),
      "MoonBit 写 UI · React Native 渲染",
    ),
  )
  kids.push(input_row(model, emit))
  kids.push(
    @html.div(
      attrs=attrs(
        @style.Style::new()
        .margin_top(@style.px(18.0))
        .margin_bottom(@style.px(12.0))
        .flex_direction(@style.FlexDirection::Row),
      ),
      [
        chip("全部", model.filter == All, SetFilter(All), emit),
        chip("未完成", model.filter == Active, SetFilter(Active), emit),
        chip("已完成", model.filter == Done, SetFilter(Done), emit),
      ],
    ),
  )
  let shown = visible(model)
  if shown.length() == 0 {
    kids.push(
      @html.p(
        attrs=attrs(
          @style.Style::new()
          .font_size(14.0)
          .color(c_ink3)
          .text_align(@style.TextAlign::Center)
          .margin_top(@style.px(28.0)),
        ),
        "这里空着。",
      ),
    )
  } else {
    for t in shown {
      kids.push(item_row(t, emit))
    }
  }
  kids.push(
    @html.p(
      attrs=attrs(
        @style.Style::new()
        .font_size(12.0)
        .color(c_ink3)
        .margin_top(@style.px(16.0)),
      ),
      "\{remaining(model)} 项未完成 · 共 \{model.items.length()} 项",
    ),
  )
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex(1.0)
      .background_color(c_paper)
      .padding_top(@style.px(64.0))
      .padding_horizontal(@style.px(20.0))
      .padding_bottom(@style.px(24.0)),
    ),
    kids,
  )
}
