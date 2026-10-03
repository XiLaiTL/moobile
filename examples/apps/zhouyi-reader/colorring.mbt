///|
/// 卦爻色环：两仪 / 四象 / 八卦 / 六十四卦（阴黑阳白 · 等面积环带 · 内圈初爻）

///|
/// 色环层级
enum RingLevel {
  LiangYi
  SiXiang
  BaGua
  LiuShiSi
} derive(Eq)

///|
/// 四象排序
enum Order4 {
  ErJin // 二进制：太阴→少阳→少阴→太阳
  XiaoZhang // 阴阳消长：老阳→少阴→老阴→少阳
  FangWei // 方位季节：老阴北→少阳东→老阳南→少阴西
  ShengCheng // 生成次序：太阳→少阴→少阳→太阴
} derive(Eq)

///|
/// 八卦 / 六十四卦排序
enum Order8 {
  Xian
  HouTian
  JingFang
} derive(Eq)

///|
/// 色环状态
struct RingState {
  level : RingLevel
  order4 : Order4
  order8 : Order8
} derive(Eq)

///|
/// 色环扇区条目
struct RingItem {
  lines : Array[Int]
  label : String
  symbol : String
  number : Int // 导航卦序号（0=无导航）
}

///|
let c_yang = "#fdfaf0"

///|
let c_gold = "#b8902f"

///|
/// 三画卦：符号 / 爻码（自下而上）/ 纯卦序号
fn tri_meta(name : String) -> (String, String, Int) {
  match name {
    "乾" => ("☰", "111", 1)
    "兑" => ("☱", "110", 58)
    "离" => ("☲", "101", 30)
    "震" => ("☳", "100", 51)
    "巽" => ("☴", "011", 57)
    "坎" => ("☵", "010", 29)
    "艮" => ("☶", "001", 52)
    _ => ("☷", "000", 2)
  }
}

///|
/// 爻码串（'1'/'0'，自下而上）→ 爻数组
fn code_lines(code : String) -> Array[Int] {
  let arr : Array[Int] = []
  for ch in code {
    arr.push(if ch == '1' { 1 } else { 0 })
  }
  arr
}

///|
/// 四象条目（初爻为内圈）
fn four_items(order : Order4) -> Array[RingItem] {
  let no_symbol = ""
  match order {
    ErJin =>
      [
        { lines: [0, 0], label: "太阴", symbol: no_symbol, number: 0, },
        { lines: [0, 1], label: "少阳", symbol: no_symbol, number: 0, },
        { lines: [1, 0], label: "少阴", symbol: no_symbol, number: 0, },
        { lines: [1, 1], label: "太阳", symbol: no_symbol, number: 0, },
      ]
    XiaoZhang =>
      [
        { lines: [1, 1], label: "老阳", symbol: no_symbol, number: 0, },
        { lines: [1, 0], label: "少阴", symbol: no_symbol, number: 0, },
        { lines: [0, 0], label: "老阴", symbol: no_symbol, number: 0, },
        { lines: [0, 1], label: "少阳", symbol: no_symbol, number: 0, },
      ]
    FangWei =>
      [
        { lines: [0, 0], label: "老阴", symbol: no_symbol, number: 0, },
        { lines: [0, 1], label: "少阳", symbol: no_symbol, number: 0, },
        { lines: [1, 1], label: "老阳", symbol: no_symbol, number: 0, },
        { lines: [1, 0], label: "少阴", symbol: no_symbol, number: 0, },
      ]
    ShengCheng =>
      [
        { lines: [1, 1], label: "太阳", symbol: no_symbol, number: 0, },
        { lines: [1, 0], label: "少阴", symbol: no_symbol, number: 0, },
        { lines: [0, 1], label: "少阳", symbol: no_symbol, number: 0, },
        { lines: [0, 0], label: "太阴", symbol: no_symbol, number: 0, },
      ]
  }
}

///|
/// 八卦名序（顺时针，自乾/离起）
fn bagua_names(order : Order8) -> Array[String] {
  match order {
    Xian => ["乾", "兑", "离", "震", "坤", "艮", "坎", "巽"]
    HouTian => ["离", "坤", "兑", "乾", "坎", "艮", "震", "巽"]
    JingFang => ["乾", "震", "坎", "艮", "坤", "巽", "离", "兑"]
  }
}

///|
/// 八卦条目（含卦符与纯卦序号）
fn bagua_items(order : Order8) -> Array[RingItem] {
  let out : Array[RingItem] = []
  for n in bagua_names(order) {
    let (sym, code, num) = tri_meta(n)
    out.push({ lines: code_lines(code), label: n, symbol: sym, number: num, })
  }
  out
}

///|
/// 六十四卦序号序（先天圆图 / 文王卦序 / 京房八宫）
fn hexagram_order(order : Order8) -> Array[Int] {
  match order {
    Xian => xiantian_ring
    HouTian => {
      let arr : Array[Int] = []
      for i in 0..<64 {
        arr.push(i + 1)
      }
      arr
    }
    JingFang => jingfang_ring
  }
}

///|
/// 六十四卦条目（爻画取自阅读数据）
fn liushisi_items(data : @shared.ReaderData, order : Order8) -> Array[RingItem] {
  let out : Array[RingItem] = []
  for n in hexagram_order(order) {
    let h = data.hexagrams[n - 1]
    out.push({
      lines: code_lines(h.卦画),
      label: h.卦名,
      symbol: "",
      number: n,
    })
  }
  out
}

///|
/// 色环数据：(扇区数, 环数, 条目)
fn ring_items(
  data : @shared.ReaderData,
  ring : RingState,
) -> (Int, Int, Array[RingItem]) {
  match ring.level {
    LiangYi =>
      (
        2,
        1,
        [
          { lines: [1], label: "阳", symbol: "", number: 0, },
          { lines: [0], label: "阴", symbol: "", number: 0, },
        ],
      )
    SiXiang => (4, 2, four_items(ring.order4))
    BaGua => (8, 3, bagua_items(ring.order8))
    LiuShiSi => (64, 6, liushisi_items(data, ring.order8))
  }
}

///|
/// 环带扇区（外弧顺、内弧逆）
fn annulus_sector(
  ctx : @canvas.OpCtx,
  cx : Double,
  cy : Double,
  start : Double,
  end : Double,
  r_in : Double,
  r_out : Double,
  color : String,
) -> Unit {
  if r_in >= r_out {
    return
  }
  ctx.begin_path()
  let isx = cx + r_in * @math.cos(start)
  let isy = cy + r_in * @math.sin(start)
  let osx = cx + r_out * @math.cos(start)
  let osy = cy + r_out * @math.sin(start)
  let iex = cx + r_in * @math.cos(end)
  let iey = cy + r_in * @math.sin(end)
  ctx.move_to(isx, isy)
  ctx.line_to(osx, osy)
  ctx.arc(cx, cy, r_out, start, end, anticlockwise=false)
  ctx.line_to(iex, iey)
  ctx.arc(cx, cy, r_in, end, start, anticlockwise=true)
  ctx.close_path()
  c_fill(ctx, color)
  ctx.fill()
  c_stroke(ctx, "rgba(184,144,47,0.28)")
  ctx.set_line_width(0.4)
  ctx.stroke()
}

///|
/// 标签（切向文字；六十四卦小字，四正朱砂）
fn ring_labels(
  ctx : @canvas.OpCtx,
  cx : Double,
  cy : Double,
  r_max : Double,
  level : RingLevel,
  sectors : Int,
  items : Array[RingItem],
) -> Unit {
  let sa = 2.0 * @math.PI / sectors.to_double()
  for i in 0..<sectors {
    let mid = -@math.PI / 2.0 + (i.to_double() + 0.5) * sa
    let deg = mid * 180.0 / @math.PI
    let item = items[i]
    match level {
      LiangYi | SiXiang =>
        ttext(ctx, cx, cy, deg, r_max + 16.0, item.label, 14, c_vermilion)
      BaGua => {
        ttext(ctx, cx, cy, deg, r_max + 16.0, item.label, 12, c_vermilion)
        if item.symbol != "" {
          ttext(ctx, cx, cy, deg, r_max + 30.0, item.symbol, 13, c_gold)
        }
      }
      LiuShiSi =>
        ttext(
          ctx,
          cx,
          cy,
          deg,
          r_max + 14.0,
          item.label,
          10,
          if is_zheng_gua(item.label) {
            c_vermilion
          } else {
            c_ink3
          },
        )
    }
  }
}

///|
/// 色环主绘图：纸底 · 等面积环带（内圈初爻）· 经纬线 · 外圈 · 标签
fn ring_draw(
  ctx : @canvas.OpCtx,
  data : @shared.ReaderData,
  ring : RingState,
) -> Unit {
  let cx = 360.0
  let cy = 360.0
  let pi = @math.PI
  let r_max = 300.0
  c_fill(ctx, c_paper)
  ctx.fill_rect(0.0, 0.0, 720.0, 720.0)
  let (sectors, rings, items) = ring_items(data, ring)
  let sa = 2.0 * pi / sectors.to_double()
  // 等面积环带半径：r_k = R·√(k/rings)
  let radii : Array[Double] = []
  for k in 0..<=rings {
    radii.push(r_max * (k.to_double() / rings.to_double()).sqrt())
  }
  // 扇区填充
  for i in 0..<sectors {
    let start = -pi / 2.0 + i.to_double() * sa
    let end = start + sa
    let item = items[i]
    for j in 0..<rings {
      let is_yang = item.lines[j] == 1
      annulus_sector(
        ctx,
        cx,
        cy,
        start,
        end,
        radii[j],
        radii[j + 1],
        if is_yang {
          c_yang
        } else {
          c_ink
        },
      )
    }
  }
  // 经线（扇区边界）
  c_stroke(ctx, c_gold)
  ctx.set_line_width(1.2)
  for i in 0..<sectors {
    let a = -pi / 2.0 + i.to_double() * sa
    ctx.begin_path()
    ctx.move_to(cx, cy)
    ctx.line_to(cx + r_max * @math.cos(a), cy + r_max * @math.sin(a))
    ctx.stroke()
  }
  // 纬线（环带边界）
  for k in 1..<(radii.length() - 1) {
    ctx.begin_path()
    ctx.arc(cx, cy, radii[k], 0.0, 2.0 * pi)
    ctx.stroke()
  }
  // 外圈
  ctx.set_line_width(2.5)
  ctx.begin_path()
  ctx.arc(cx, cy, r_max, 0.0, 2.0 * pi)
  ctx.stroke()
  // 标签
  ring_labels(ctx, cx, cy, r_max, ring.level, sectors, items)
}

///|
/// 色环点击命中：扇区 → 卦序号（两仪/四象无导航）
fn ring_hit(
  data : @shared.ReaderData,
  ring : RingState,
  press_x : Double,
  press_y : Double,
) -> Int? {
  let dx = press_x - 360.0
  let dy = press_y - 360.0
  let d2 = dx * dx + dy * dy
  if d2 > 300.0 * 300.0 {
    return None
  }
  let (sectors, _rings, items) = ring_items(data, ring)
  let sa = 360.0 / sectors.to_double()
  let theta = @math.atan2(dy, dx) * 180.0 / @math.PI
  let theta_norm = if theta < 0.0 { theta + 360.0 } else { theta }
  let rel = pos_mod(theta_norm - 270.0, 360.0)
  let i = @math.floor(rel / sa).to_int() % sectors
  let item = items[i]
  if item.number == 0 {
    None
  } else {
    Some(item.number)
  }
}

///|
/// 色环控制面板：层级 + 排序
fn ring_panel(ring : RingState, emit : @cmd.Emit[Msg]) -> Html {
  let lv : Array[Html] = []
  let levels = [
    (LiangYi, "两仪"),
    (SiXiang, "四象"),
    (BaGua, "八卦"),
    (LiuShiSi, "六十四卦"),
  ]
  for x in levels {
    lv.push(
      button(
        attrs=if ring.level == x.0 { @styles.att(@styles.button_bagua_mode_on()) } else { @styles.att(@styles.button_bagua_mode()) },
        on_click=emit(SetRingLevel(x.0)),
        x.1,
      ),
    )
  }
  let ord : Html = match ring.level {
    LiangYi => nothing
    SiXiang => {
      let b : Array[Html] = []
      let os = [
        (ErJin, "二进制"),
        (XiaoZhang, "消长"),
        (FangWei, "方位"),
        (ShengCheng, "生成"),
      ]
      for x in os {
        b.push(
          button(
            attrs=if ring.order4 == x.0 {
              @styles.att(@styles.button_bagua_mode_on())
            } else {
              @styles.att(@styles.button_bagua_mode())
            },
            on_click=emit(SetOrder4(x.0)),
            x.1,
          ),
        )
      }
      div(attrs=@styles.att(@styles.div_ring_row()), b)
    }
    BaGua | LiuShiSi => {
      let b : Array[Html] = []
      let os = [(Xian, "先天"), (HouTian, "后天"), (JingFang, "京房")]
      for x in os {
        b.push(
          button(
            attrs=if ring.order8 == x.0 {
              @styles.att(@styles.button_bagua_mode_on())
            } else {
              @styles.att(@styles.button_bagua_mode())
            },
            on_click=emit(SetOrder8(x.0)),
            x.1,
          ),
        )
      }
      div(attrs=@styles.att(@styles.div_ring_row()), b)
    }
  }
  div(attrs=@styles.att(@styles.div_ring_ctrls()), [div(attrs=@styles.att(@styles.div_ring_ctrls_div_ring_row()), lv), ord])
}

///|
/// 色环图例
fn ring_legend() -> Html {
  let empty : Array[Html] = []
  div(attrs=@styles.att(@styles.div_ring_legend()), [
    span(attrs=@styles.att(@styles.div_ring_legend_span_lg()), [span(attrs=@styles.att(@styles.div_ring_legend_span_lg_span_sw_yang()), empty), span("阳爻 · 白")]),
    span(attrs=@styles.att(@styles.div_ring_legend_span_lg()), [span(attrs=@styles.att(@styles.div_ring_legend_span_lg_span_sw_yin()), empty), span("阴爻 · 黑")]),
    span(attrs=@styles.att(@styles.div_ring_legend_span_lg()), [span(attrs=@styles.att(@styles.div_ring_legend_span_lg_span_grid_sw()), empty), span("经纬线")]),
  ])
}
