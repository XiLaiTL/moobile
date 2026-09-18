///|
/// **R1 可行性样本** —— 按 `interest/yi` 的真实 CSS 与标记逐条移植。
///
/// 要回答的问题：**RN 能接受 yi 那种文本排版吗？** 判定标准是"可接受"，不是"像素一致"。
///
/// 样本取材自 yi 中内联排版最密集的一段（`.m-yao` 系列：爻题 / 爻辞 / 小象 / 折叠箭头），
/// 数据是乾卦六爻的真实内容（`assets/reader_data.json`）。
///
/// 移植时**故意不迁就 RN**：CSS 怎么写就怎么映射，让冲突暴露出来。
/// 冲突点已在下面逐条标 `⚠️ R1-`。
///
/// 颜色取自 yi 的 `:root`（`_r1/yi_root_vars.txt`），CSS 规则取自
/// `_r1/yi_yao_css.txt`。
let r_paper0 : String = "#f6efe0"

///|
let r_paper1 : String = "#efe5d0"

///|
let r_paper2 : String = "#e6d8bc"

///|
let r_paper3 : String = "#d9c69f"

///|
let r_ink0 : String = "#1a1410"

///|
let r_ink1 : String = "#2a1f17"

///|
let r_ink2 : String = "#4a3b2e"

///|
let r_ink3 : String = "#7a6851"

///|
let r_verm0 : String = "#8a2518"

///|
let r_verm1 : String = "#a82a1f"

///|
let r_gold1 : String = "#b8902f"

///|
/// 一爻的展示数据。
pub struct R1Yao {
  title : String
  ci : String
  xiang : String
  note : String
}

///|
/// 乾卦六爻（爻题 / 爻辞 / 小象 / 本义）。文本为真实内容，注疏截到手机屏可读的长度。
pub fn r1_data() -> Array[R1Yao] {
  [
    {
      title: "初九",
      ci: "潜龙勿用。",
      xiang: "潜龙勿用，阳在下也。",
      note: "初九者，卦下阳爻之名。凡画卦者，自下而上，故以下爻为初。“潜”，藏也。“龙”，阳物也。初阳在下，未可施用，故其象为“潜龙”，其占曰“勿用”。",
    },
    {
      title: "九二",
      ci: "见龙在田，利见大人。",
      xiang: "见龙在田，德施普也。",
      note: "二，谓自下而上第二爻也。九二刚健中正，出潜离隐，泽及于物，物所“利见”，故其象为“见龙在田”，其占为“利见大人”。",
    },
    {
      title: "九三",
      ci: "君子终日乾乾，夕惕若厉，无咎。",
      xiang: "终日乾乾，反复道也。",
      note: "九，阳爻。三，阳位。重刚不中，居下之上，乃危地也。然性体刚健，有能乾乾惕厉之象，故其占如此。",
    },
    {
      title: "九四",
      ci: "或跃在渊，无咎。",
      xiang: "或跃在渊，进无咎也。",
      note: "“或”者，疑而未定之辞。“跃”者，无所缘而绝于地，特未飞尔。“渊”者，上空下洞，深昧不测之所。九阳四阴，居上之下，改革之际，进退未定之时也。",
    },
    {
      title: "九五",
      ci: "飞龙在天，利见大人。",
      xiang: "飞龙在天，大人造也。",
      note: "刚健中正，以居尊位，如以圣人之德，居圣人之位，故其象如此，而占法与九二同。",
    },
    {
      title: "上九",
      ci: "亢龙有悔。",
      xiang: "亢龙有悔，盈不可久也。",
      note: "“上”者，最上一爻之名。“亢”者，过于上而不能下之意也。阳极于上，动必“有悔”，故其象占如此。",
    },
  ]
}

///|
/// 爻画。阳爻是一条实心横；阴爻在 CSS 里是 `linear-gradient` 中间断开。
///
/// ⚠️ **R1-1**：RN 没有 `linear-gradient`（要 `expo-linear-gradient` 或自己画）。
/// 这里用"两段 View + 中间留空"的等价做法，无依赖。
/// 但注意：yi 的 `linear-gradient(90deg, ink 0 42%, transparent 42% 58%, ink 58% 100%)`
/// 意味着左右两段各 42%、中间 16%，**必须用百分比**才能在不同宽度下一致。
fn yao_bar(yang : Bool, bian : Bool, hl : Bool, label : String) -> @html.Html {
  let none : Array[@html.Html] = []
  let color = if bian {
    r_verm0
  } else if hl {
    "#8a6a2a"
  } else {
    r_ink0
  }
  let seg = @html.div(
    attrs=attrs(
      @style.Style::new()
      .height(@style.pct(100.0))
      .width(@style.pct(42.0))
      .background_color(color)
      .border_radius(3.0),
    ),
    none,
  )
  let inner = if yang {
    [@html.div(
      attrs=attrs(
        @style.Style::new()
        .height(@style.pct(100.0))
        .width(@style.pct(100.0))
        .background_color(color)
        .border_radius(3.0),
      ),
      none,
    )]
  } else {
    [
      @html.div(
        attrs=attrs(
          @style.Style::new()
          .flex_direction(@style.FlexDirection::Row)
          .justify_content(@style.Justify::SpaceBetween)
          .height(@style.pct(100.0))
          .width(@style.pct(100.0)),
        ),
        [seg, seg],
      ),
    ]
  }
  // ⚠️ R1-2：`.m-mark` 是 `position:absolute; left:-22px`（画在爻左边的变爻记号）。
  // RN 支持 absolute，但需要父级是定位上下文；这里先不做，留待验证。
  ignore(label)
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .width(@style.px(160.0))
      .height(@style.px(32.0)),
    ),
    inner,
  )
}

///|
/// 一爻。**结构逐条对齐 yi 的 `main.mbt`**：
/// `div.m-yao` = `[ div.m-yao-line, div.m-yao-txt-wrap ]`
fn r1_yao(y : R1Yao, idx : Int) -> @html.Html {
  // `.m-yao-head` = flex, align-items: baseline, gap: 10px, flex-wrap: wrap
  let head = @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex_direction(@style.FlexDirection::Row)
      .flex_wrap(@style.FlexWrap::Wrap)
      .align_items(@style.Align::Baseline)
      .gap(10.0),
    ),
    [
      // `.m-fold { font-size:11px; color:verm1; min-width:10px; text-align:center }`
      // 它是 flex item，所以 min-width 生效 —— 这是关键对照点。
      @html.span(
        attrs=attrs(
          @style.Style::new()
          .font_size(11.0)
          .color(r_verm1)
          .min_width(@style.px(10.0))
          .text_align(@style.TextAlign::Center),
        ),
        if idx == 0 { "▾" } else { "▸" },
      ),
      // `.m-yao-title { font-size:16.5px; font-weight:700; color:verm0; letter-spacing:.1em }`
      // ⚠️ R1-3：CSS 的 `em` 是相对单位，RN 的 `letterSpacing` 只认点数。
      // 这里手工换算：16.5 × 0.1 = 1.65。**样式层缺 `Em` 这个单位。**
      @html.span(
        attrs=attrs(
          @style.Style::new()
          .font_size(16.5)
          .font_weight(@style.FontWeight::W700)
          .color(r_verm0)
          .letter_spacing_em(0.1),
        ),
        y.title,
      ),
      // `.m-yao-ci { font-size:16px; letter-spacing:.05em; color:ink0 }`
      @html.span(
        attrs=attrs(
          @style.Style::new()
          .font_size(16.0)
          .color(r_ink0)
          .letter_spacing_em(0.05),
        ),
        y.ci,
      ),
    ],
  )
  // `.m-yao-xiang` —— 这里是**真正的行内流**：`<p>` 里嵌两个 `<span>`，
  // 小象文可以跨行断开，而"小象"标签留在行首。
  // ⚠️ R1-4：`.xlab { margin-right: 7px }` —— **盒属性加在嵌套文本上**。
  // RN 的嵌套 `<Text>` 只吃文字类样式，margin/padding 会被忽略。
  // 这里先用一个全角空格替代，验证"排版会退化但不崩"。
  let xiang = @html.p(
    attrs=attrs(
      @style.Style::new()
      .font_size(13.5)
      .color(r_ink2)
      .letter_spacing_em(0.04)
      .margin_top(@style.px(4.0)),
    ),
    [
      @html.span(
        attrs=attrs(
          @style.Style::new()
          .font_size(12.0)
          .color(r_verm1)
          .letter_spacing_em(0.2),
        ),
        "小象",
      ),
      @html.span(attrs=attrs(@style.Style::new()), "　" + y.xiang),
    ],
  )
  // `.m-weny-box { margin-top:8px; padding:6px 10px; background:bg-elev;
  //                border-left:2px solid verm1; border-top:1px dashed paper3 }`
  let note = @html.div(
    attrs=attrs(
      @style.Style::new()
      .margin_top(@style.px(8.0))
      .padding_horizontal(@style.px(10.0))
      .padding_vertical(@style.px(6.0))
      .background_color(r_paper0)
      .border_left_width(2.0)
      .border_color(r_verm1)
      .border_top_width(1.0)
      .border_style(@style.BorderStyle::Dashed),
    ),
    [
      @html.p(
        attrs=attrs(
          @style.Style::new().font_size(13.5).color(r_ink1).margin_top(@style.px(2.0)),
        ),
        y.note,
      ),
    ],
  )
  // `.m-yao` = grid 160px + 1fr, gap 26px
  // ⚠️ R1-5：CSS **Grid** 在 RN 上没有稳定对应（Yoga 的 grid 未 stable）。
  // 改用 flex row + 固定宽首列 —— 这正是设计文档 §7 阶段 2 说的降级策略。
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex_direction(@style.FlexDirection::Row)
      .align_items(@style.Align::Center)
      .gap(26.0)
      .padding_vertical(@style.px(13.0))
      .border_bottom_width(1.0)
      .border_color(r_paper3)
      .border_style(@style.BorderStyle::Dashed),
    ),
    [
      yao_bar(true, false, idx == 2, ""),
      @html.div(
        attrs=attrs(
          // `.m-yao-txt-wrap { min-width: 0 }` —— 让长文本能收缩换行，不是撑开
          @style.Style::new().flex(1.0).min_width(@style.px(0.0)),
        ),
        [
          @html.div(
            attrs=attrs(@style.Style::new().min_width(@style.px(0.0))),
            [head, xiang, note],
          ),
        ],
      ),
    ],
  )
}

///|
/// R1 样本页。
pub fn r1_view() -> @html.Html {
  let kids : Array[@html.Html] = []
  kids.push(
    @html.h2(
      attrs=attrs(
        @style.Style::new()
        .font_size(20.0)
        .font_weight(@style.FontWeight::W700)
        .color(r_ink0),
      ),
      "R1 样本 · 乾",
    ),
  )
  kids.push(
    @html.p(
      attrs=attrs(
        @style.Style::new()
        .font_size(12.0)
        .color(r_ink3)
        .margin_top(@style.px(4.0))
        .margin_bottom(@style.px(14.0)),
      ),
      "按 yi 的真实 CSS 逐条移植，故意不迁就 RN",
    ),
  )
  for i, y in r1_data() {
    kids.push(r1_yao(y, i))
  }
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .background_color(r_paper1)
      .padding_top(@style.px(16.0))
      .padding_horizontal(@style.px(16.0))
      .padding_bottom(@style.px(24.0)),
    ),
    kids,
  )
}
