///|
/// 由 `moobile-host create --from-rabbita` 生成 —— **不要手改**。
///
/// 源：backend/index.html:7
///     共 476 行 / 198 条规则 → 这里 104 个样式函数。
///
/// 每个函数对应**源码里真实用到的一个类组合**（`class="a b"` 就是 `a_b`）。
/// 有损的条目在函数头上以 `TODO(migrate)` 列出 —— 那些是 `@style` 明确不表达的东西
/// （grid / sticky / transform / box-shadow / 伪类…），不是生成器漏了。

///|
/// `Style` → `Attrs` 的桥。视图里的写法：`attrs=@styles.att(@styles.<类>())`。
pub fn att(s : @style.Style) -> @html.Attrs {
  @html.Attrs::build().styles(s)
}

///|
/// 页面根样式（源 CSS 里的 `body` / `html`）—— 挂在最外层容器上。
///   · background 简写只取到了颜色那一部分
///   · font-family 只取回退链的第一项（Charter）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
///   · TODO(migrate) font-feature-settings:"palt" —— 原生字体渲染由平台决定  （backend/index.html:22）
///   · TODO(migrate) -webkit-font-smoothing:antialiased —— 原生字体渲染由平台决定  （backend/index.html:24）
pub fn page() -> @style.Style {
  @style.Style::new()
    .margin(@style.px(0.0))
    .padding(@style.px(0.0))
    .background_color("#efe5d0")
    .color("#2a1f17")
    .font_family("Charter")
    .line_height(1.65)
}

///|
/// `class="aside.m-side"` —— backend/index.html:310
///   · TODO(migrate) position:sticky —— `@style` 只有 Relative / Absolute；sticky / fixed 在 RN 上没有对应物  （backend/index.html:310）
pub fn aside_m_side() -> @style.Style {
  @style.Style::new()
    .top(@style.px(70.0))
}

///|
/// `class="button.bagua-mode"` —— backend/index.html:160 （另见 backend/index.html:160、backend/index.html:160）
///   · background 简写只取到了颜色那一部分
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:167）
///   · TODO(migrate) transition:border-color .15s, color .15s, background .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated  （backend/index.html:168）
pub fn button_bagua_mode() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(16.0))
    .padding_vertical(@style.px(5.0))
    .background_color("#e6d8bc")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .color("#4a3b2e")
    .font_family("Kaiti TC")
    .font_size(13.0)
    .letter_spacing_em(0.1)
}

///|
/// `class="button.bagua-mode.on"` —— backend/index.html:160 （另见 backend/index.html:160、backend/index.html:160、backend/index.html:172、backend/index.html:172、backend/index.html:172）
///   · background 简写只取到了颜色那一部分
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:167）
///   · TODO(migrate) transition:border-color .15s, color .15s, background .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated  （backend/index.html:168）
pub fn button_bagua_mode_on() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(16.0))
    .padding_vertical(@style.px(5.0))
    .background_color("#8a2518")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .color("#f6efe0")
    .font_family("Kaiti TC")
    .font_size(13.0)
    .letter_spacing_em(0.1)
    .border_color("#8a2518")
}

///|
/// `class="button.bian.rel-link"` —— backend/index.html:113 （另见 backend/index.html:128）
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) display:inline-flex —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:113）
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:116）
///   · TODO(migrate) font-family:inherit —— RN 的字体不继承  （backend/index.html:116）
///   · TODO(migrate) transition:border-color .15s, color .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated  （backend/index.html:117）
pub fn button_bian_rel_link() -> @style.Style {
  @style.Style::new()
    .align_items(@style.Align::Baseline)
    .gap(6.0)
    .padding_horizontal(@style.px(12.0))
    .padding_vertical(@style.px(5.0))
    .background_color("#e6d8bc")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .color("#2a1f17")
    .font_size(13.0)
    .border_color("#8a6a2a")
}

///|
/// `class="button.bian.rel-link>span.rl-label"` —— backend/index.html:129 （另见 backend/index.html:144）
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn button_bian_rel_link_span_rl_label() -> @style.Style {
  @style.Style::new()
    .color("#8a2518")
    .font_family("Kaiti TC")
    .font_size(12.0)
}

///|
/// `class="button.bian.rel-link>span.rl-name"` —— backend/index.html:146
///   · em 字距要靠同一样式里的 font-size 换算，而这一条规则里没有 font-size
pub fn button_bian_rel_link_span_rl_name() -> @style.Style {
  @style.Style::new()
    .letter_spacing_em(0.05)
}

///|
/// `class="button.rel-link.self"` —— backend/index.html:113 （另见 backend/index.html:121）
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) display:inline-flex —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:113）
///   · TODO(migrate) cursor:default —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:121）
///   · TODO(migrate) font-family:inherit —— RN 的字体不继承  （backend/index.html:116）
///   · TODO(migrate) transition:border-color .15s, color .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated  （backend/index.html:117）
pub fn button_rel_link_self() -> @style.Style {
  @style.Style::new()
    .align_items(@style.Align::Baseline)
    .gap(6.0)
    .padding_horizontal(@style.px(12.0))
    .padding_vertical(@style.px(5.0))
    .background_color("#e6d8bc")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .color("#2a1f17")
    .font_size(13.0)
    .opacity(0.45)
}

///|
/// `class="button.rel-link.self>span.rl-label"` —— backend/index.html:144
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn button_rel_link_self_span_rl_label() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(12.0)
    .color("#8a2518")
}

///|
/// `class="button.rel-link.self>span.rl-name"` —— backend/index.html:146
///   · em 字距要靠同一样式里的 font-size 换算，而这一条规则里没有 font-size
pub fn button_rel_link_self_span_rl_name() -> @style.Style {
  @style.Style::new()
    .letter_spacing_em(0.05)
}

///|
/// `class="details.m-more"` —— backend/index.html:443 （另见 backend/index.html:443、backend/index.html:443）
pub fn details_m_more() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(30.0))
}

///|
/// `class="details.m-more>div.m-more-body"` —— backend/index.html:456 （另见 backend/index.html:456、backend/index.html:456）
pub fn details_m_more_div_m_more_body() -> @style.Style {
  @style.Style::new()
    .padding_top(@style.px(4.0))
    .padding_horizontal(@style.px(22.0))
    .padding_bottom(@style.px(18.0))
    .border_top_width(1.0)
    .border_top_style(@style.BorderStyle::Dashed)
    .border_top_color("#d9c69f")
}

///|
/// `class="div.bagua-wrap"` —— backend/index.html:154
pub fn div_bagua_wrap() -> @style.Style {
  @style.Style::new()
    .text_align(@style.TextAlign::Center)
}

///|
/// `class="div.bagua-wrap>div.bagua-canvas-box"` —— backend/index.html:204
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) width:min(94vw, 720px) —— 只支持 px / % / auto（`calc` `min` `max` `vw` `vh` 与 em 在 RN 上没有对应物）  （backend/index.html:204）
///   · TODO(migrate) box-shadow:0 2px 10px rgba(26,20,16,.10) —— RN 要拆成 shadowColor/shadowOffset/shadowOpacity/shadowRadius（Android 还要 elevation），需要复合助手  （backend/index.html:206）
pub fn div_bagua_wrap_div_bagua_canvas_box() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(4.0))
    .margin_horizontal(@style.auto())
    .margin_bottom(@style.px(6.0))
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .background_color("#f6efe0")
}

///|
/// `class="div.bagua-wrap>div.bagua-modes"` —— backend/index.html:156
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
pub fn div_bagua_wrap_div_bagua_modes() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .justify_content(@style.Justify::Center)
    .gap(10.0)
    .margin_top(@style.px(0.0))
    .margin_horizontal(@style.px(0.0))
    .margin_bottom(@style.px(12.0))
}

///|
/// `class="div.bagua-wrap>div.bagua-modes>button.bagua-mode"` —— backend/index.html:160 （另见 backend/index.html:160、backend/index.html:160、backend/index.html:160）
///   · background 简写只取到了颜色那一部分
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:167）
///   · TODO(migrate) transition:border-color .15s, color .15s, background .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated  （backend/index.html:168）
pub fn div_bagua_wrap_div_bagua_modes_button_bagua_mode() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(16.0))
    .padding_vertical(@style.px(5.0))
    .background_color("#e6d8bc")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .color("#4a3b2e")
    .font_family("Kaiti TC")
    .font_size(13.0)
    .letter_spacing_em(0.1)
}

///|
/// `class="div.bagua-wrap>div.bagua-modes>button.bagua-mode.on"` —— backend/index.html:160 （另见 backend/index.html:160、backend/index.html:160、backend/index.html:160、backend/index.html:172、backend/index.html:172、backend/index.html:172、backend/index.html:172）
///   · background 简写只取到了颜色那一部分
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:167）
///   · TODO(migrate) transition:border-color .15s, color .15s, background .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated  （backend/index.html:168）
pub fn div_bagua_wrap_div_bagua_modes_button_bagua_mode_on() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(16.0))
    .padding_vertical(@style.px(5.0))
    .background_color("#8a2518")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .color("#f6efe0")
    .font_family("Kaiti TC")
    .font_size(13.0)
    .letter_spacing_em(0.1)
    .border_color("#8a2518")
}

///|
/// `class="div.bagua-wrap>div.bagua-sim"` —— backend/index.html:177
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
pub fn div_bagua_wrap_div_bagua_sim() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .justify_content(@style.Justify::Center)
    .margin_top(@style.px(2.0))
    .margin_horizontal(@style.px(0.0))
    .margin_bottom(@style.px(10.0))
}

///|
/// `class="div.bagua-wrap>div.bagua-sim>button.bagua-mode"` —— backend/index.html:160
///   · background 简写只取到了颜色那一部分
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:167）
///   · TODO(migrate) transition:border-color .15s, color .15s, background .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated  （backend/index.html:168）
pub fn div_bagua_wrap_div_bagua_sim_button_bagua_mode() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(16.0))
    .padding_vertical(@style.px(5.0))
    .background_color("#e6d8bc")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .color("#4a3b2e")
    .font_family("Kaiti TC")
    .font_size(13.0)
    .letter_spacing_em(0.1)
}

///|
/// `class="div.bagua-wrap>div.bagua-sim>button.bagua-mode.on"` —— backend/index.html:160 （另见 backend/index.html:172）
///   · background 简写只取到了颜色那一部分
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:167）
///   · TODO(migrate) transition:border-color .15s, color .15s, background .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated  （backend/index.html:168）
pub fn div_bagua_wrap_div_bagua_sim_button_bagua_mode_on() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(16.0))
    .padding_vertical(@style.px(5.0))
    .background_color("#8a2518")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .color("#f6efe0")
    .font_family("Kaiti TC")
    .font_size(13.0)
    .letter_spacing_em(0.1)
    .border_color("#8a2518")
}

///|
/// `class="div.bagua-wrap>h2.hex-index-title"` —— backend/index.html:51
pub fn div_bagua_wrap_h2_hex_index_title() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(0.0))
    .margin_horizontal(@style.px(0.0))
    .margin_bottom(@style.px(4.0))
    .font_size(16.0)
    .font_weight(@style.FontWeight::W700)
    .letter_spacing_em(0.32)
    .color("#8a2518")
}

///|
/// `class="div.chips"` —— backend/index.html:147
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
pub fn div_chips() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .flex_wrap(@style.FlexWrap::Wrap)
    .gap(6.0)
}

///|
/// `class="div.click.m-yao-xiang"` —— backend/index.html:396 （另见 backend/index.html:403）
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:403）
pub fn div_click_m_yao_xiang() -> @style.Style {
  @style.Style::new()
    .font_size(13.5)
    .color("#4a3b2e")
    .margin_top(@style.px(4.0))
    .margin_horizontal(@style.px(0.0))
    .margin_bottom(@style.px(0.0))
    .letter_spacing_em(0.04)
}

///|
/// `class="div.click.m-yao-xiang>span.m-fold"` —— backend/index.html:390
///   · TODO(migrate) letter-spacing:0  （backend/index.html:391）
pub fn div_click_m_yao_xiang_span_m_fold() -> @style.Style {
  @style.Style::new()
    .font_size(11.0)
    .color("#a82a1f")
    .min_width(@style.px(10.0))
    .text_align(@style.TextAlign::Center)
}

///|
/// `class="div.click.m-yao-xiang>span.xlab"` —— backend/index.html:399
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn div_click_m_yao_xiang_span_xlab() -> @style.Style {
  @style.Style::new()
    .color("#a82a1f")
    .margin_right(@style.px(7.0))
    .font_size(12.0)
    .letter_spacing_em(0.2)
    .font_family("Kaiti TC")
}

///|
/// `class="div.error"` —— backend/index.html:280 （另见 backend/index.html:281）
pub fn div_error() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(0.0))
    .padding_vertical(@style.px(60.0))
    .text_align(@style.TextAlign::Center)
    .color("#c43a2a")
    .font_size(15.0)
}

///|
/// `class="div.hex-card"` —— backend/index.html:69
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:73）
///   · TODO(migrate) transition:border-color .15s, transform .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated  （backend/index.html:74）
pub fn div_hex_card() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Column)
    .gap(2.0)
    .padding_horizontal(@style.px(12.0))
    .padding_vertical(@style.px(8.0))
    .background_color("#e6d8bc")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
}

///|
/// `class="div.hex-card>span.idx"` —— backend/index.html:78
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn div_hex_card_span_idx() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(11.0)
    .color("#7a6851")
}

///|
/// `class="div.hex-card>span.name"` —— backend/index.html:79
pub fn div_hex_card_span_name() -> @style.Style {
  @style.Style::new()
    .font_size(15.0)
    .font_weight(@style.FontWeight::W600)
    .letter_spacing_em(0.12)
    .color("#1a1410")
}

///|
/// `class="div.hex-card>span.xiang"` —— backend/index.html:80
pub fn div_hex_card_span_xiang() -> @style.Style {
  @style.Style::new()
    .font_size(12.0)
    .color("#7a6851")
}

///|
/// `class="div.hex-index"` —— backend/index.html:45
///   · background 简写只取到了颜色那一部分
pub fn div_hex_index() -> @style.Style {
  @style.Style::new()
    .background_color("#f6efe0")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .border_top_width(3.0)
    .border_top_style(@style.BorderStyle::Solid)
    .border_top_color("#8a2518")
    .padding_top(@style.px(24.0))
    .padding_horizontal(@style.px(28.0))
    .padding_bottom(@style.px(28.0))
}

///|
/// `class="div.hex-index>div.hex-index-section"` —— backend/index.html:59 （另见 backend/index.html:59）
pub fn div_hex_index_div_hex_index_section() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(18.0))
}

///|
/// `class="div.hex-index>div.hex-index-section>div.hex-index-grid"` —— backend/index.html:64 （另见 backend/index.html:64）
///   · TODO(migrate) display:grid —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:64）
///   · TODO(migrate) grid-template-columns:repeat(auto-fill, minmax(116px, 1fr)) —— RN 没有 grid 布局（`@style` 只有 flex）。降级成 flex 需要**人来决定**列宽策略  （backend/index.html:65）
pub fn div_hex_index_div_hex_index_section_div_hex_index_grid() -> @style.Style {
  @style.Style::new()
    .gap(6.0)
}

///|
/// `class="div.hex-index>div.hex-index-section>div.hex-index-section-label"` —— backend/index.html:60 （另见 backend/index.html:60）
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn div_hex_index_div_hex_index_section_div_hex_index_section_label() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(12.0)
    .letter_spacing_em(0.3)
    .color("#4a3b2e")
    .margin_bottom(@style.px(10.0))
}

///|
/// `class="div.hex-index>h2.hex-index-title"` —— backend/index.html:51
pub fn div_hex_index_h2_hex_index_title() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(0.0))
    .margin_horizontal(@style.px(0.0))
    .margin_bottom(@style.px(4.0))
    .font_size(16.0)
    .font_weight(@style.FontWeight::W700)
    .letter_spacing_em(0.32)
    .color("#8a2518")
}

///|
/// `class="div.hex-index>p.hex-index-hint"` —— backend/index.html:55
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn div_hex_index_p_hex_index_hint() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(0.0))
    .margin_horizontal(@style.px(0.0))
    .margin_bottom(@style.px(18.0))
    .font_family("Kaiti TC")
    .font_size(12.0)
    .letter_spacing_em(0.18)
    .color("#7a6851")
}

///|
/// `class="div.hex-rels"` —— backend/index.html:112
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
pub fn div_hex_rels() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .flex_wrap(@style.FlexWrap::Wrap)
    .gap(8.0)
    .margin_top(@style.px(12.0))
}

///|
/// `class="div.loading"` —— backend/index.html:280 （另见 backend/index.html:280）
pub fn div_loading() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(0.0))
    .padding_vertical(@style.px(60.0))
    .text_align(@style.TextAlign::Center)
    .color("#7a6851")
    .font_size(15.0)
}

///|
/// `class="div.m-ann-body"` —— backend/index.html:346 （另见 backend/index.html:346）
pub fn div_m_ann_body() -> @style.Style {
  @style.Style::new()
    .padding_top(@style.px(8.0))
    .padding_horizontal(@style.px(0.0))
    .padding_bottom(@style.px(2.0))
}

///|
/// `class="div.m-bottom"` —— backend/index.html:439
pub fn div_m_bottom() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(34.0))
}

///|
/// `class="div.m-cite"` —— backend/index.html:411
///   · background 简写只取到了颜色那一部分
pub fn div_m_cite() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(6.0))
    .padding_horizontal(@style.px(10.0))
    .padding_vertical(@style.px(6.0))
    .background_color("#e6d8bc")
    .border_left_width(2.0)
    .border_left_style(@style.BorderStyle::Solid)
    .border_left_color("#b8902f")
    .font_size(13.0)
    .color("#4a3b2e")
}

///|
/// `class="div.m-cite>span.c-src"` —— backend/index.html:416
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn div_m_cite_span_c_src() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(11.5)
    .color("#7a6851")
}

///|
/// `class="div.m-click-txt"` —— backend/index.html:330
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:330）
pub fn div_m_click_txt() -> @style.Style {
  @style.Style::new()
  // ↑ 这个类有 1 条声明没有对应物，逐条列在上面（别当它已经迁好了）
}

///|
/// `class="div.m-click-txt>span.m-fold"` —— backend/index.html:390
///   · TODO(migrate) letter-spacing:0  （backend/index.html:391）
pub fn div_m_click_txt_span_m_fold() -> @style.Style {
  @style.Style::new()
    .font_size(11.0)
    .color("#a82a1f")
    .min_width(@style.px(10.0))
    .text_align(@style.TextAlign::Center)
}

///|
/// `class="div.m-click-txt>span.m-jtext"` —— backend/index.html:332
///   · TODO(migrate) display:inline —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:332）
pub fn div_m_click_txt_span_m_jtext() -> @style.Style {
  @style.Style::new()
    .margin(@style.px(0.0))
    .font_size(15.5)
    .color("#1a1410")
    .letter_spacing_em(0.06)
    .white_space(@style.WhiteSpace::PreWrap)
}

///|
/// `class="div.m-detail>div.m-layout"` —— backend/index.html:309
///   · TODO(migrate) display:grid —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:309）
///   · TODO(migrate) grid-template-columns:250px 1fr —— RN 没有 grid 布局（`@style` 只有 flex）。降级成 flex 需要**人来决定**列宽策略  （backend/index.html:309）
pub fn div_m_detail_div_m_layout() -> @style.Style {
  @style.Style::new()
    .gap(44.0)
    .align_items(@style.Align::FlexStart)
}

///|
/// `class="div.m-detail>div.m-layout>div.m-lines"` —— backend/index.html:349
pub fn div_m_detail_div_m_layout_div_m_lines() -> @style.Style {
  @style.Style::new()
    .min_width(@style.px(0.0))
}

///|
/// `class="div.m-detail>div.m-layout>div.m-lines>div.m-rels"` —— backend/index.html:347
pub fn div_m_detail_div_m_layout_div_m_lines_div_m_rels() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(22.0))
}

///|
/// `class="div.m-detail>div.m-layout>div.m-lines>p.m-hint"` —— backend/index.html:350
pub fn div_m_detail_div_m_layout_div_m_lines_p_m_hint() -> @style.Style {
  @style.Style::new()
    .font_size(12.0)
    .color("#7a6851")
    .letter_spacing_em(0.14)
    .margin_top(@style.px(0.0))
    .margin_horizontal(@style.px(0.0))
    .margin_bottom(@style.px(8.0))
    .text_align(@style.TextAlign::Right)
}

///|
/// `class="div.m-detail>div.m-top"` —— backend/index.html:294
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
pub fn div_m_detail_div_m_top() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .align_items(@style.Align::Center)
    .gap(12.0)
    .margin_bottom(@style.px(22.0))
}

///|
/// `class="div.m-detail>div.m-top>button.m-nav"` —— backend/index.html:295 （另见 backend/index.html:295、backend/index.html:295）
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:297）
///   · TODO(migrate) font-family:inherit —— RN 的字体不继承  （backend/index.html:297）
pub fn div_m_detail_div_m_top_button_m_nav() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(14.0))
    .padding_vertical(@style.px(6.0))
    .background_color("#e6d8bc")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .color("#2a1f17")
    .font_size(13.5)
    .letter_spacing_em(0.08)
    .white_space(@style.WhiteSpace::NoWrap)
}

///|
/// `class="div.m-detail>div.m-top>div.m-crumb"` —— backend/index.html:301
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
pub fn div_m_detail_div_m_top_div_m_crumb() -> @style.Style {
  @style.Style::new()
    .flex(1.0)
    .text_align(@style.TextAlign::Center)
    .font_size(17.0)
    .letter_spacing_em(0.14)
    .color("#1a1410")
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .align_items(@style.Align::Baseline)
    .justify_content(@style.Justify::Center)
    .gap(10.0)
}

///|
/// `class="div.m-detail>div.m-top>div.m-crumb>span.m-crumb-sub"` —— backend/index.html:305
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn div_m_detail_div_m_top_div_m_crumb_span_m_crumb_sub() -> @style.Style {
  @style.Style::new()
    .font_size(12.5)
    .color("#7a6851")
    .letter_spacing_em(0.2)
    .font_family("Kaiti TC")
}

///|
/// `class="div.m-group"` —— backend/index.html:458
pub fn div_m_group() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(8.0))
}

///|
/// `class="div.m-group>div.m-group-name"` —— backend/index.html:459
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn div_m_group_div_m_group_name() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(12.5)
    .color("#8a2518")
    .letter_spacing_em(0.15)
    .margin_top(@style.px(10.0))
}

///|
/// `class="div.m-gua-name"` —— backend/index.html:311
pub fn div_m_gua_name() -> @style.Style {
  @style.Style::new()
    .font_size(96.0)
    .line_height(1.02)
    .font_weight(@style.FontWeight::W700)
    .letter_spacing_em(0.04)
    .color("#1a1410")
}

///|
/// `class="div.m-gua-sub"` —— backend/index.html:315
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn div_m_gua_sub() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(8.0))
    .font_size(14.0)
    .letter_spacing_em(0.26)
    .color("#7a6851")
    .font_family("Kaiti TC")
}

///|
/// `class="div.m-meta"` —— backend/index.html:463
pub fn div_m_meta() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(8.0))
}

///|
/// `class="div.m-meta>div.m-group-name"` —— backend/index.html:459
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn div_m_meta_div_m_group_name() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(12.5)
    .color("#8a2518")
    .letter_spacing_em(0.15)
    .margin_top(@style.px(10.0))
}

///|
/// `class="div.m-sec"` —— backend/index.html:325
pub fn div_m_sec() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(26.0))
}

///|
/// `class="div.m-tags"` —— backend/index.html:319
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
pub fn div_m_tags() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .flex_wrap(@style.FlexWrap::Wrap)
    .gap(6.0)
    .margin_top(@style.px(14.0))
}

///|
/// `class="div.m-tags>span.m-tag"` —— backend/index.html:320 （另见 backend/index.html:320、backend/index.html:320）
pub fn div_m_tags_span_m_tag() -> @style.Style {
  @style.Style::new()
    .font_size(12.0)
    .color("#4a3b2e")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .border_radius(99.0)
    .padding_horizontal(@style.px(11.0))
    .padding_vertical(@style.px(2.0))
    .letter_spacing_em(0.1)
}

///|
/// `class="div.m-weny-box"` —— backend/index.html:405 （另见 backend/index.html:405）
///   · background 简写只取到了颜色那一部分
pub fn div_m_weny_box() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(8.0))
    .padding_horizontal(@style.px(10.0))
    .padding_vertical(@style.px(6.0))
    .background_color("#f6efe0")
    .border_left_width(2.0)
    .border_left_style(@style.BorderStyle::Solid)
    .border_left_color("#a82a1f")
    .border_top_width(1.0)
    .border_top_style(@style.BorderStyle::Dashed)
    .border_top_color("#d9c69f")
}

///|
/// `class="div.m-yao"` —— backend/index.html:354
///   · TODO(migrate) display:grid —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:354）
///   · TODO(migrate) grid-template-columns:160px 1fr —— RN 没有 grid 布局（`@style` 只有 flex）。降级成 flex 需要**人来决定**列宽策略  （backend/index.html:355）
pub fn div_m_yao() -> @style.Style {
  @style.Style::new()
    .gap(26.0)
    .align_items(@style.Align::Center)
    .padding_horizontal(@style.px(0.0))
    .padding_vertical(@style.px(13.0))
    .border_bottom_width(1.0)
    .border_bottom_style(@style.BorderStyle::Dashed)
    .border_bottom_color("#d9c69f")
}

///|
/// `class="div.m-yao-txt"` —— backend/index.html:387 （另见 backend/index.html:387）
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:387）
pub fn div_m_yao_txt() -> @style.Style {
  @style.Style::new()
    .min_width(@style.px(0.0))
}

///|
/// `class="div.m-yao-txt>div.m-yao-head"` —— backend/index.html:389 （另见 backend/index.html:389）
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
pub fn div_m_yao_txt_div_m_yao_head() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .align_items(@style.Align::Baseline)
    .gap(10.0)
    .flex_wrap(@style.FlexWrap::Wrap)
}

///|
/// `class="div.m-yao>div.m-yao-txt-wrap"` —— backend/index.html:386
pub fn div_m_yao_div_m_yao_txt_wrap() -> @style.Style {
  @style.Style::new()
    .min_width(@style.px(0.0))
}

///|
/// `class="div.rel-wrap"` —— backend/index.html:130
///   · TODO(migrate) display:inline-flex —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:130）
pub fn div_rel_wrap() -> @style.Style {
  @style.Style::new()
    .position(@style.Position::Relative)
}

///|
/// `class="div.rel-wrap>button.rel-link"` —— backend/index.html:113
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) display:inline-flex —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:113）
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:116）
///   · TODO(migrate) font-family:inherit —— RN 的字体不继承  （backend/index.html:116）
///   · TODO(migrate) transition:border-color .15s, color .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated  （backend/index.html:117）
pub fn div_rel_wrap_button_rel_link() -> @style.Style {
  @style.Style::new()
    .align_items(@style.Align::Baseline)
    .gap(6.0)
    .padding_horizontal(@style.px(12.0))
    .padding_vertical(@style.px(5.0))
    .background_color("#e6d8bc")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .color("#2a1f17")
    .font_size(13.0)
}

///|
/// `class="div.rel-wrap>button.rel-link.sel"` —— backend/index.html:113 （另见 backend/index.html:123）
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) display:inline-flex —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:113）
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:116）
///   · TODO(migrate) font-family:inherit —— RN 的字体不继承  （backend/index.html:116）
///   · TODO(migrate) transition:border-color .15s, color .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated  （backend/index.html:117）
pub fn div_rel_wrap_button_rel_link_sel() -> @style.Style {
  @style.Style::new()
    .align_items(@style.Align::Baseline)
    .gap(6.0)
    .padding_horizontal(@style.px(12.0))
    .padding_vertical(@style.px(5.0))
    .background_color("#8a2518")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .color("#f6efe0")
    .font_size(13.0)
    .border_color("#8a2518")
}

///|
/// `class="div.rel-wrap>button.rel-x"` —— backend/index.html:131
///   · CSS 的 px 行高与 RN 的 lineHeight 都是点数，但断行规则不同 —— 排版要重新验
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) border-radius:50% —— RN 的圆角只收点数，"圆形"要用一个大点数（如 999）来表达  （backend/index.html:133）
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:136）
pub fn div_rel_wrap_button_rel_x() -> @style.Style {
  @style.Style::new()
    .position(@style.Position::Absolute)
    .top(@style.px(-9.0))
    .right_(@style.px(-9.0))
    .width(@style.px(17.0))
    .height(@style.px(17.0))
    .line_height(15.0)
    .text_align(@style.TextAlign::Center)
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#8a2518")
    .background_color("#f6efe0")
    .color("#8a2518")
    .font_size(13.0)
    .font_weight(@style.FontWeight::W700)
    .padding(@style.px(0.0))
}

///|
/// `class="div.ring-ctrls"` —— backend/index.html:182
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
pub fn div_ring_ctrls() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Column)
    .gap(6.0)
    .margin_top(@style.px(0.0))
    .margin_horizontal(@style.px(0.0))
    .margin_bottom(@style.px(12.0))
}

///|
/// `class="div.ring-ctrls>div.ring-row"` —— backend/index.html:186
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
pub fn div_ring_ctrls_div_ring_row() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .justify_content(@style.Justify::Center)
    .gap(8.0)
    .flex_wrap(@style.FlexWrap::Wrap)
}

///|
/// `class="div.ring-legend"` —— backend/index.html:190
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn div_ring_legend() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .justify_content(@style.Justify::Center)
    .align_items(@style.Align::Center)
    .gap(18.0)
    .margin_top(@style.px(10.0))
    .margin_horizontal(@style.px(0.0))
    .margin_bottom(@style.px(2.0))
    .font_family("Kaiti TC")
    .font_size(12.0)
    .letter_spacing_em(0.12)
    .color("#7a6851")
}

///|
/// `class="div.ring-legend>span.lg"` —— backend/index.html:196 （另见 backend/index.html:196、backend/index.html:196）
///   · TODO(migrate) display:inline-flex —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:196）
pub fn div_ring_legend_span_lg() -> @style.Style {
  @style.Style::new()
    .align_items(@style.Align::Center)
    .gap(6.0)
}

///|
/// `class="div.ring-legend>span.lg>span.grid.sw"` —— backend/index.html:197 （另见 backend/index.html:203）
///   · TODO(migrate) display:inline-block —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:197）
///   · TODO(migrate) border-radius:50% —— RN 的圆角只收点数，"圆形"要用一个大点数（如 999）来表达  （backend/index.html:198）
///   · TODO(migrate) background:transparent —— 只支持纯色（渐变 / 图片 / 多重背景在 RN 上没有对应物）  （backend/index.html:203）
pub fn div_ring_legend_span_lg_span_grid_sw() -> @style.Style {
  @style.Style::new()
    .width(@style.px(15.0))
    .height(@style.px(15.0))
    .border_width(2.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#b8902f")
}

///|
/// `class="div.ring-legend>span.lg>span.sw.yang"` —— backend/index.html:197 （另见 backend/index.html:201）
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) display:inline-block —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:197）
///   · TODO(migrate) border-radius:50% —— RN 的圆角只收点数，"圆形"要用一个大点数（如 999）来表达  （backend/index.html:198）
pub fn div_ring_legend_span_lg_span_sw_yang() -> @style.Style {
  @style.Style::new()
    .width(@style.px(15.0))
    .height(@style.px(15.0))
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .background_color("#fdfaf0")
}

///|
/// `class="div.ring-legend>span.lg>span.sw.yin"` —— backend/index.html:197 （另见 backend/index.html:202）
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) display:inline-block —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:197）
///   · TODO(migrate) border-radius:50% —— RN 的圆角只收点数，"圆形"要用一个大点数（如 999）来表达  （backend/index.html:198）
pub fn div_ring_legend_span_lg_span_sw_yin() -> @style.Style {
  @style.Style::new()
    .width(@style.px(15.0))
    .height(@style.px(15.0))
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .background_color("#1a1410")
}

///|
/// `class="div.ring-row"` —— backend/index.html:186 （另见 backend/index.html:186）
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
pub fn div_ring_row() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .justify_content(@style.Justify::Center)
    .gap(8.0)
    .flex_wrap(@style.FlexWrap::Wrap)
}

///|
/// `class="div>div.container"` —— backend/index.html:44
pub fn div_div_container() -> @style.Style {
  @style.Style::new()
    .max_width(@style.px(1180.0))
    .margin_horizontal(@style.auto())
    .margin_vertical(@style.px(24.0))
    .padding_top(@style.px(0.0))
    .padding_horizontal(@style.px(20.0))
    .padding_bottom(@style.px(80.0))
}

///|
/// `class="div>div.footer"` —— backend/index.html:282
pub fn div_div_footer() -> @style.Style {
  @style.Style::new()
    .text_align(@style.TextAlign::Center)
    .padding(@style.px(24.0))
    .color("#7a6851")
    .font_size(12.5)
    .letter_spacing_em(0.1)
    .border_top_width(1.0)
    .border_top_style(@style.BorderStyle::Solid)
    .border_top_color("#d9c69f")
}

///|
/// `class="div>div.footer>div.seal"` —— backend/index.html:287
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) display:inline-block —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:287）
///   · TODO(migrate) box-shadow:inset 0 0 0 2px #8a2518, inset 0 0 0 4px #f6efe0 —— RN 要拆成 shadowColor/shadowOffset/shadowOpacity/shadowRadius（Android 还要 elevation），需要复合助手  （backend/index.html:290）
pub fn div_div_footer_div_seal() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(8.0))
    .padding_vertical(@style.px(6.0))
    .margin_bottom(@style.px(8.0))
    .background_color("#8a2518")
    .color("#f6efe0")
    .font_weight(@style.FontWeight::W800)
    .letter_spacing_em(0.2)
    .font_size(13.0)
}

///|
/// `class="div>div.topnav"` —— backend/index.html:27
///   · display:flex 补写了 flex_direction(Row)：CSS 的默认主轴是 row，RN 的默认是 column
///   · background 简写只取到了颜色那一部分
///   · TODO(migrate) position:sticky —— `@style` 只有 Relative / Absolute；sticky / fixed 在 RN 上没有对应物  （backend/index.html:31）
pub fn div_div_topnav() -> @style.Style {
  @style.Style::new()
    .display(@style.Display::Flex)
    .flex_direction(@style.FlexDirection::Row)
    .align_items(@style.Align::Center)
    .gap(16.0)
    .padding_horizontal(@style.px(24.0))
    .padding_vertical(@style.px(10.0))
    .background_color("#f6efe0")
    .border_bottom_width(1.0)
    .border_bottom_style(@style.BorderStyle::Solid)
    .border_bottom_color("#d9c69f")
    .top(@style.px(0.0))
    .z_index(10.0)
}

///|
/// `class="div>div.topnav>button.brand"` —— backend/index.html:34
///   · em 字距要靠同一样式里的 font-size 换算，而这一条规则里没有 font-size
///   · TODO(migrate) cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）  （backend/index.html:34）
pub fn div_div_topnav_button_brand() -> @style.Style {
  @style.Style::new()
    .font_weight(@style.FontWeight::W700)
    .letter_spacing_em(0.18)
    .color("#8a2518")
}

///|
/// `class="div>div.topnav>div.search"` —— backend/index.html:36
pub fn div_div_topnav_div_search() -> @style.Style {
  @style.Style::new()
    .flex(1.0)
    .max_width(@style.px(320.0))
    .margin_left(@style.auto())
}

///|
/// `class="div>div.topnav>div.sub"` —— backend/index.html:35
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn div_div_topnav_div_sub() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(12.0)
    .color("#7a6851")
}

///|
/// `class="p.ann"` —— backend/index.html:237 （另见 backend/index.html:237、backend/index.html:237、backend/index.html:237）
pub fn p_ann() -> @style.Style {
  @style.Style::new()
    .margin_top(@style.px(6.0))
    .margin_right(@style.px(0.0))
    .margin_bottom(@style.px(6.0))
    .margin_left(@style.px(14.0))
    .font_size(13.5)
    .color("#4a3b2e")
}

///|
/// `class="p.ann.jishuo-item"` —— backend/index.html:237 （另见 backend/index.html:246）
pub fn p_ann_jishuo_item() -> @style.Style {
  @style.Style::new()
    .margin_horizontal(@style.px(0.0))
    .margin_vertical(@style.px(4.0))
    .font_size(13.5)
    .color("#4a3b2e")
}

///|
/// `class="p.ann.jishuo-item>span.who"` —— backend/index.html:247
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn p_ann_jishuo_item_span_who() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(12.5)
    .color("#7a6851")
}

///|
/// `class="p.ann>span.a-label"` —— backend/index.html:238
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
///   · TODO(migrate) display:inline-block —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:238）
///   · TODO(migrate) min-width:3.2em —— 只支持 px / % / auto（`calc` `min` `max` `vw` `vh` 与 em 在 RN 上没有对应物）  （backend/index.html:239）
pub fn p_ann_span_a_label() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(12.0)
    .color("#8a2518")
    .letter_spacing_em(0.1)
}

///|
/// `class="p.ann>span.a-label.an"` —— backend/index.html:238 （另见 backend/index.html:245）
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
///   · TODO(migrate) display:inline-block —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:238）
///   · TODO(migrate) min-width:3.2em —— 只支持 px / % / auto（`calc` `min` `max` `vw` `vh` 与 em 在 RN 上没有对应物）  （backend/index.html:239）
pub fn p_ann_span_a_label_an() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(12.0)
    .color("#8a6a2a")
    .letter_spacing_em(0.1)
}

///|
/// `class="p.ann>span.a-label.benyi"` —— backend/index.html:238 （另见 backend/index.html:243）
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
///   · TODO(migrate) display:inline-block —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:238）
///   · TODO(migrate) min-width:3.2em —— 只支持 px / % / auto（`calc` `min` `max` `vw` `vh` 与 em 在 RN 上没有对应物）  （backend/index.html:239）
pub fn p_ann_span_a_label_benyi() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(12.0)
    .color("#a82a1f")
    .letter_spacing_em(0.1)
}

///|
/// `class="p.ann>span.a-label.cheng"` —— backend/index.html:238 （另见 backend/index.html:244）
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
///   · TODO(migrate) display:inline-block —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:238）
///   · TODO(migrate) min-width:3.2em —— 只支持 px / % / auto（`calc` `min` `max` `vw` `vh` 与 em 在 RN 上没有对应物）  （backend/index.html:239）
pub fn p_ann_span_a_label_cheng() -> @style.Style {
  @style.Style::new()
    .font_family("Kaiti TC")
    .font_size(12.0)
    .color("#7a6851")
    .letter_spacing_em(0.1)
}

///|
/// `class="p.m-jtext"` —— backend/index.html:332
///   · TODO(migrate) display:inline —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）  （backend/index.html:332）
pub fn p_m_jtext() -> @style.Style {
  @style.Style::new()
    .margin(@style.px(0.0))
    .font_size(15.5)
    .color("#1a1410")
    .letter_spacing_em(0.06)
    .white_space(@style.WhiteSpace::PreWrap)
}

///|
/// `class="p.m-txt"` —— backend/index.html:457 （另见 backend/index.html:457、backend/index.html:457、backend/index.html:457、backend/index.html:457）
pub fn p_m_txt() -> @style.Style {
  @style.Style::new()
    .font_size(14.5)
    .color("#2a1f17")
    .margin_horizontal(@style.px(0.0))
    .margin_vertical(@style.px(4.0))
    .letter_spacing_em(0.04)
}

///|
/// `class="p.m-weny"` —— backend/index.html:410
pub fn p_m_weny() -> @style.Style {
  @style.Style::new()
    .font_size(13.5)
    .color("#2a1f17")
    .margin_horizontal(@style.px(0.0))
    .margin_vertical(@style.px(2.0))
}

///|
/// `class="p.m-yao-xiang"` —— backend/index.html:396
pub fn p_m_yao_xiang() -> @style.Style {
  @style.Style::new()
    .font_size(13.5)
    .color("#4a3b2e")
    .margin_top(@style.px(4.0))
    .margin_horizontal(@style.px(0.0))
    .margin_bottom(@style.px(0.0))
    .letter_spacing_em(0.04)
}

///|
/// `class="p.m-yao-xiang>span.xlab"` —— backend/index.html:399
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn p_m_yao_xiang_span_xlab() -> @style.Style {
  @style.Style::new()
    .color("#a82a1f")
    .margin_right(@style.px(7.0))
    .font_size(12.0)
    .letter_spacing_em(0.2)
    .font_family("Kaiti TC")
}

///|
/// `class="span.chip"` —— backend/index.html:148 （另见 backend/index.html:148）
///   · background 简写只取到了颜色那一部分
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn span_chip() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(10.0))
    .padding_vertical(@style.px(3.0))
    .font_size(12.0)
    .color("#4a3b2e")
    .background_color("#e6d8bc")
    .border_width(1.0)
    .border_style(@style.BorderStyle::Solid)
    .border_color("#d9c69f")
    .font_family("Kaiti TC")
    .letter_spacing_em(0.08)
}

///|
/// `class="span.m-fold"` —— backend/index.html:390
///   · TODO(migrate) letter-spacing:0  （backend/index.html:391）
pub fn span_m_fold() -> @style.Style {
  @style.Style::new()
    .font_size(11.0)
    .color("#a82a1f")
    .min_width(@style.px(10.0))
    .text_align(@style.TextAlign::Center)
}

///|
/// `class="span.m-mark"` —— backend/index.html:381
///   · CSS 的 px 行高与 RN 的 lineHeight 都是点数，但断行规则不同 —— 排版要重新验
///   · TODO(migrate) transform:translateY(-50%) —— RN 要结构化数组，而 `Style` 的条目是扁平 (key, StyleValue)，装不下  （backend/index.html:382）
pub fn span_m_mark() -> @style.Style {
  @style.Style::new()
    .position(@style.Position::Absolute)
    .left(@style.px(-22.0))
    .top(@style.pct(50.0))
    .width(@style.px(18.0))
    .text_align(@style.TextAlign::Center)
    .color("#8a2518")
    .font_size(15.0)
    .font_weight(@style.FontWeight::W700)
    .line_height(16.0)
}

///|
/// `class="span.m-yao-ci"` —— backend/index.html:395
pub fn span_m_yao_ci() -> @style.Style {
  @style.Style::new()
    .font_size(16.0)
    .letter_spacing_em(0.05)
    .color("#1a1410")
}

///|
/// `class="span.m-yao-title"` —— backend/index.html:394
pub fn span_m_yao_title() -> @style.Style {
  @style.Style::new()
    .font_size(16.5)
    .font_weight(@style.FontWeight::W700)
    .color("#8a2518")
    .letter_spacing_em(0.1)
}

///|
/// `class="span.rel-hint"` —— backend/index.html:139
///   · font-family 只取回退链的第一项（Kaiti TC）：RN 没有回退链，**设备上必须真有这个字**，其余候选已丢弃
pub fn span_rel_hint() -> @style.Style {
  @style.Style::new()
    .align_self(@style.AlignSelf::Center)
    .font_size(11.5)
    .color("#7a6851")
    .letter_spacing_em(0.1)
    .margin_left(@style.px(6.0))
    .font_family("Kaiti TC")
}
