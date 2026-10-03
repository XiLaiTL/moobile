///|
/// 《御纂周易折中》阅读器前端（RabbiTa）：64 卦列表 + 卦详情
using @html {
  div,
  p,
  h2,
  span,
  button,
  input,
  aside,
  nothing,
  canvas,
}

///|
using @html {type Html}

///|
/// 页面
enum Page {
  ListPage
  Detail(Int)
} derive(Eq)

///|
/// 罗盘模式：伏羲先天 / 后天文王卦气 / 京房八宫 / 卦爻色环
enum BaguaMode {
  Fuxi
  GuaQi
  JingFang
  ColorRing
} derive(Eq)

///|
/// 应用状态
struct Model {
  data : @shared.ReaderData?
  page : Page
  query : String
  error : String?
  mode : BaguaMode
  ring : RingState
  rot : Double
  sim : Bool
  pressing : Bool
  dragging : Bool
  press_x : Double
  press_y : Double
  drag_last : Double
  press_time : Double
  /// 视口宽度（`@sub.on_resize`）。原来的响应式排版是 CSS 干的（`min(94vw,720px)`），
  /// RN 没有 CSS —— 而且画布边长**还决定手势坐标怎么换算**，所以它必须进模型。
  vp_w : Double
  bian : Array[Bool] // 变爻标记：六爻 0=初爻 … 5=上爻
  open_yao : Array[Bool] // 各爻注疏展开（点爻辞切换）
  open_ci : Bool // 卦辞注疏展开（点卦辞文本切换）
  open_xiang : Array[Bool] // 大象各句注疏展开
  open_tuan : Array[Bool] // 彖辞各句注疏展开（点句子切换）
  open_xiaoxiang : Array[Bool] // 各爻小象注疏展开（点小象行切换）
  /// 底部三个折叠区块的开合（0=文言 / 1=传文关联 / 2=义例归类）。
  /// 原实现用 `<details>` 的**自身状态**，而 RN 没有那个语义 —— 状态进 Model 才可测。
  open_more : Array[Bool]
  preview : Int? // 错/综/互 选中预览的卦序号（None=未选中）
} derive(Eq)

///|
/// 消息
enum Msg {
  DataOk(String)
  DataFailed
  Open(Int)
  Back
  Prev
  Next
  Search(String)
  BaguaOpen(Int)
  SetMode(BaguaMode)
  SetRingLevel(RingLevel)
  SetOrder4(Order4)
  SetOrder8(Order8)
  SetSim(Bool)
  DragStart(Double, Double, Double, Double)
  DragMove(Double, Double, Double, Double)
  DragEnd
  /// 手势通道给"轻点"（`on_tap`）—— 与拖动分开报，所以不用再靠时长/位移自己判
  TapAt(Double, Double)
  /// 视口尺寸变了（`@sub.on_resize`）
  Viewport(Int, Int)
  ToggleBian(Int) // 点击爻线：标记/取消变爻（0=初爻 … 5=上爻）
  ToggleYaoOpen(Int) // 点击爻辞：展开/折叠该爻注疏
  ToggleCiOpen // 点击卦辞文本：展开/折叠卦辞注疏
  ToggleXiangOpen(Int) // 点击大象句子：展开/折叠该句注疏
  ToggleTuanOpen(Int) // 点击彖辞句子：展开/折叠该句注疏
  ToggleXiaoxiangOpen(Int) // 点击小象行：展开/折叠小象注疏
  ToggleMore(Int) // 点击底部区块标题：展开/折叠（0=文言 / 1=传文关联 / 2=义例归类）
  RelSelect(Int) // 错/综/互：第一次点选中预览，再点跳转
  RelClear // 取消预览选中（点 ×）
}

///|
/// 初始化：装载阅读数据
///
/// **数据是编译期嵌进产物的**（见 `data_reader.mbt`），所以这里没有网络、没有异步、
/// 也没有"同源"这回事 —— 三端（web / 桌面 / Android）走同一条路。
///
/// 迁移时为什么必须这么改（两条都是实测出来的）：
///   ① 原项目靠自己的后端在 `/reader_data.json` 提供数据，而**原生端没有"站点根"**；
///   ② moobile 的 http 走 `moonbitlang/async`，它**只认完整 URL**，相对路径直接
///      `InvalidFormat` —— 界面只显示"无法加载数据"，真因是在浏览器控制台逼出来的。
fn init_app(emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  debug_log("阅读数据已装载：" + raw_json.length().to_string() + " 字符")
  let cmd = emit(DataOk(raw_json))
  ignore(cmd)
  // ── 先**读一次**当前视口，再进首帧 ────────────────────────────────────────────
  //
  // `@sub.on_resize` 只推"变化"：浏览器不拖窗口、手机不转屏，它一次都不推
  // （两端**都不补发**初始值）。而画布边长按"窗口宽度的 94%"算 —— 读不到就是**没有布局**。
  // 实测（第十轮）：web 上它一直是**回落值 360**，在 1400px 的浏览器里罗盘小得离谱，
  // 而且没有任何报错；真机上则要等一次转屏才正确。
  // 这一句是库侧第十一轮补的 API：宿主能力优先（RN → `Dimensions.get('window')`），
  // 问不到再回退 DOM（`window.innerWidth`），两端语义一致。
  let vp_w = match @sub.current_viewport() {
    // ⚠️ 0.16 起 `@common.Viewport` 的 width/height **就是 `Double`**（上游改的）——
    // 这里原来那句 `.to_double()` 是 0.15.4 时代的（那时是 `Int`），现在多余了。
    Some(v) => v.width
    None =>
      // 拿不到（SSR / 宿主没实现）就**明确回落到 0**：`canvas_side(0)` 那条分支
      // 会给一个"哪端都不溢出"的保守尺寸，并且它的注释里写了为什么。
      0.0
  }
  debug_log("初始视口宽度：" + vp_w.to_string())
  (
    {
      data: None,
      page: ListPage,
      query: "",
      error: None,
      mode: GuaQi,
      ring: { level: BaGua, order4: ErJin, order8: Xian, },
      rot: 0.0,
      sim: false,
      pressing: false,
      dragging: false,
      press_x: 0.0,
      press_y: 0.0,
      drag_last: 0.0,
      press_time: 0.0,
      vp_w,

      bian: fresh_bian(),
      open_yao: fresh_open(),
      open_ci: false,
      open_xiang: [],
      open_tuan: [],
      open_xiaoxiang: fresh_open(),
      open_more: [false, false, false],
      preview: None,
    },
    cmd,
  )
}

///|
/// 状态更新
fn update(model : Model, msg : Msg, emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  match msg {
    DataOk(raw) => {
      let data = @shared.parse_reader_data(raw)
      (
        { ..model, data: Some(data), },
        @cmd.none,
      )
    }
    DataFailed => ({ ..model, error: Some("无法加载数据"), }, @cmd.none)
    Open(n) => (reset_ui({ ..model, page: Detail(n), }), @cmd.none)
    BaguaOpen(n) => (reset_ui({ ..model, page: Detail(n), }), @cmd.none)
    ToggleBian(i) =>
      if model.page is Detail(_) {
        let b = model.bian.copy()
        if i >= 0 && i < 6 {
          b[i] = !b[i]
        }
        // 变爻变化后变卦目标可能变，清掉预览选中
        ({ ..model, bian: b, preview: None, }, @cmd.none)
      } else {
        (model, @cmd.none)
      }
    RelSelect(n) =>
      if model.page is Detail(_) {
        // 已选中同一卦：第二次按 → 跳转
        if model.preview == Some(n) {
          (reset_ui({ ..model, page: Detail(n), }), @cmd.none)
        } else {
          ({ ..model, preview: Some(n), }, @cmd.none)
        }
      } else {
        (model, @cmd.none)
      }
    RelClear => ({ ..model, preview: None, }, @cmd.none)
    ToggleYaoOpen(i) =>
      if model.page is Detail(_) {
        let b = toggle_flag(model.open_yao, i)
        ({ ..model, open_yao: b, }, @cmd.none)
      } else {
        (model, @cmd.none)
      }
    ToggleCiOpen => ({ ..model, open_ci: !model.open_ci, }, @cmd.none)
    ToggleXiangOpen(i) =>
      ({ ..model, open_xiang: toggle_flag(model.open_xiang, i), }, @cmd.none)
    ToggleTuanOpen(i) =>
      ({ ..model, open_tuan: toggle_flag(model.open_tuan, i), }, @cmd.none)
    ToggleMore(i) => ({ ..model, open_more: toggle_flag(model.open_more, i) }, @cmd.none)
    ToggleXiaoxiangOpen(i) =>
      if model.page is Detail(_) {
        let b = toggle_flag(model.open_xiaoxiang, i)
        ({ ..model, open_xiaoxiang: b, }, @cmd.none)
      } else {
        (model, @cmd.none)
      }
    Back =>
      match model.data {
        Some(data) =>
          (
            reset_ui({ ..model, page: ListPage, }),
            @cmd.none,
          )
        None => (reset_ui({ ..model, page: ListPage, }), @cmd.none)
      }
    Search(q) =>
      match model.data {
        Some(data) =>
          (
            { ..model, query: q, },
            @cmd.none,
          )
        None => ({ ..model, query: q, }, @cmd.none)
      }
    SetMode(m) =>
      match model.data {
        Some(data) =>
          (
            { ..model, mode: m, },
            @cmd.none,
          )
        None => ({ ..model, mode: m, }, @cmd.none)
      }
    SetRingLevel(l) =>
      match model.data {
        Some(data) =>
          (
            { ..model, ring: { ..model.ring, level: l, }, },
            @cmd.none,
          )
        None => ({ ..model, ring: { ..model.ring, level: l, }, }, @cmd.none)
      }
    SetOrder4(o) =>
      match model.data {
        Some(data) =>
          (
            { ..model, ring: { ..model.ring, order4: o, }, },
            @cmd.none,
          )
        None => ({ ..model, ring: { ..model.ring, order4: o, }, }, @cmd.none)
      }
    SetOrder8(o) =>
      match model.data {
        Some(data) =>
          (
            { ..model, ring: { ..model.ring, order8: o, }, },
            @cmd.none,
          )
        None => ({ ..model, ring: { ..model.ring, order8: o, }, }, @cmd.none)
      }
    SetSim(b) =>
      match model.data {
        Some(data) =>
          (
            { ..model, sim: b, pressing: false, dragging: false, },
            @cmd.none,
          )
        None =>
          ({ ..model, sim: b, pressing: false, dragging: false, }, @cmd.none)
      }
    DragStart(a, x, y, t) =>
      (
        {
          ..model,
          pressing: true,
          dragging: false,
          drag_last: a,
          press_x: x,
          press_y: y,
          press_time: t,
        },
        @cmd.none,
      )
    DragMove(a, x, y, t) =>
      // 长按（≥300ms）后才可拨动轮盘；移动超过阈值记为拖动（非点击）。
      // 色环为静态图谱：不随拖动旋转，仅跟踪拖动状态以区分点击。
      if !model.pressing {
        (model, @cmd.none)
      } else if model.mode == ColorRing {
        let moved = ((x - model.press_x) * (x - model.press_x) +
        (y - model.press_y) * (y - model.press_y)).sqrt()
        let is_drag = model.dragging || moved >= 8.0
        ({ ..model, dragging: is_drag, drag_last: a, }, @cmd.none)
      } else {
        let moved = ((x - model.press_x) * (x - model.press_x) +
        (y - model.press_y) * (y - model.press_y)).sqrt()
        let is_drag = model.dragging || moved >= 8.0
        // ⚠️ 原来这里还有一道"长按 ≥300ms 才可拨动"的闸（`t - model.press_time >= 300.0`）。
        //    手势通道**已经把拖动与轻点分开了**（`on_pan` / `on_tap`）—— 走到这里就是拖，
        //    再叠一层时长判断，只会让"拖了但没转"变成一个说不清的现象。
        if is_drag {
          let d = a - model.drag_last
          let dd = if d > 180.0 {
            d - 360.0
          } else if d < -180.0 {
            d + 360.0
          } else {
            d
          }
          let rot = model.rot + dd
          match model.data {
            Some(data) =>
              (
                { ..model, dragging: true, rot, drag_last: a, },
                @cmd.none,
              )
            None => ({ ..model, dragging: true, rot, drag_last: a, }, @cmd.none)
          }
        } else {
          // 尚未长按到位：仅跟踪角度基准与拖动状态，不转
          ({ ..model, dragging: is_drag, drag_last: a, }, @cmd.none)
        }
      }
    TapAt(x, y) =>
      // 轻点：先把"按下点"记进模型，再把 `DragEnd` **重新发一遍** ——
      // 判卦导航那套逻辑（按半径/角度算落在哪一卦）一个字都不用重写，也不会有两份实现。
      (
        { ..model, pressing: true, dragging: false, press_x: x, press_y: y },
        emit(DragEnd),
      )
    Viewport(w, _h) => ({ ..model, vp_w: w.to_double() }, @cmd.none)
    DragEnd => {
      let clicked = model.pressing && !model.dragging
      let base = { ..model, pressing: false, dragging: false, }
      if !clicked {
        (base, @cmd.none)
      } else if model.mode == ColorRing {
        // 色环轻点：两仪/四象无卦可入，八卦/六十四卦按扇区进卦
        match model.data {
          Some(data) =>
            match ring_hit(data, model.ring, model.press_x, model.press_y) {
              Some(n) => (base, emit(BaguaOpen(n)))
              None => (base, @cmd.none)
            }
          None => (base, @cmd.none)
        }
      } else {
        // 轻点（未拖动）：按按下位置判卦导航
        let dx = model.press_x - 360.0
        let dy = model.press_y - 360.0
        let d2 = dx * dx + dy * dy
        let theta = @math.atan2(dy, dx) * 180.0 / @math.PI
        let theta_norm = if theta < 0.0 { theta + 360.0 } else { theta }
        if d2 >= 222.0 * 222.0 && d2 <= 300.0 * 300.0 {
          // 环随轮盘旋转过 rot，点击角度须先换算回盘面角度
          let theta_disk = pos_mod(theta_norm - model.rot, 360.0)
          let rel = if theta_disk >= 90.0 {
            theta_disk - 90.0
          } else {
            theta_disk + 270.0
          }
          let n = match model.mode {
            Fuxi => xiantian_ring[@math.round(rel / 5.625).to_int() % 64]
            GuaQi => gua_qi_ring()[@math.round(rel / 6.0).to_int() % 60]
            JingFang =>
              jingfang_ring[@math.round(theta_disk / 5.625).to_int() % 64]
            ColorRing => 0
          }
          (base, emit(BaguaOpen(n)))
        } else if d2 >= 125.0 * 125.0 && d2 <= 185.0 * 185.0 {
          let theta_disk = pos_mod(theta_norm - model.rot, 360.0)
          let ti = (@math.round((theta_disk + 90.0) / 45.0).to_int() % 8 + 8) %
            8
          let btable = match model.mode {
            Fuxi => xiantian_bagua
            GuaQi | JingFang => bagua_table
            ColorRing => bagua_table
          }
          (base, emit(BaguaOpen(btable[ti].2)))
        } else {
          (base, @cmd.none)
        }
      }
    }
    Prev =>
      match model.page {
        Detail(n) =>
          (
            reset_ui({ ..model, page: Detail(if n <= 1 { 64 } else { n - 1 }), }),
            @cmd.none,
          )
        ListPage => (model, @cmd.none)
      }
    Next =>
      match model.page {
        Detail(n) =>
          (
            reset_ui({ ..model, page: Detail(if n >= 64 { 1 } else { n + 1 }), }),
            @cmd.none,
          )
        ListPage => (model, @cmd.none)
      }
  }
}

///|
/// 可选经文块取文
fn block_text(b : @shared.Block?) -> String {
  match b {
    Some(x) => x.文
    None => ""
  }
}

///|
/// 空白变爻表（导航后清空）
fn fresh_bian() -> Array[Bool] {
  [false, false, false, false, false, false]
}

///|
/// 空白爻展开表（导航后清空）
fn fresh_open() -> Array[Bool] {
  [false, false, false, false, false, false]
}

///|
/// 导航/切卦时重置全部展开与变爻状态
fn reset_ui(model : Model) -> Model {
  {
    ..model,
    bian: fresh_bian(),
    open_yao: fresh_open(),
    open_ci: false,
    open_xiang: [],
    open_tuan: [],
    open_xiaoxiang: fresh_open(),
    preview: None,
  }
}

///|
/// 按序切换数组内第 i 项（不足自动补 false）
fn toggle_flag(flags : Array[Bool], i : Int) -> Array[Bool] {
  let b = flags.copy()
  while b.length() <= i {
    b.push(false)
  }
  b[i] = !b[i]
  b
}

///|
/// 注疏渲染
fn commentary_view(c : @shared.Commentary) -> Html {
  let items : Array[Html] = []
  match c.本义 {
    Some(t) =>
      items.push(
        p(attrs=@styles.att(@styles.p_ann()), [span(attrs=@styles.att(@styles.p_ann_span_a_label_benyi()), "本义"), span(t)]),
      )
    None => ()
  }
  match c.程传 {
    Some(t) =>
      items.push(
        p(attrs=@styles.att(@styles.p_ann()), [span(attrs=@styles.att(@styles.p_ann_span_a_label_cheng()), "程传"), span(t)]),
      )
    None => ()
  }
  match c.案 {
    Some(t) =>
      items.push(p(attrs=@styles.att(@styles.p_ann()), [span(attrs=@styles.att(@styles.p_ann_span_a_label_an()), "案"), span(t)]))
    None => ()
  }
  match c.总论 {
    Some(t) =>
      items.push(p(attrs=@styles.att(@styles.p_ann()), [span(attrs=@styles.att(@styles.p_ann_span_a_label()), "总论"), span(t)]))
    None => ()
  }
  match c.集说 {
    Some(cites) =>
      for cite in cites {
        let who = match (cite.家, cite.书) {
          (Some(j), _) if j != "" => j
          (_, Some(s)) => s
          _ => ""
        }
        let head = if who == "" { "" } else { "\{who}：" }
        items.push(
          p(attrs=@styles.att(@styles.p_ann_jishuo_item()), [span(attrs=@styles.att(@styles.p_ann_jishuo_item_span_who()), head), span(cite.文)]),
        )
      }
    None => ()
  }
  div(items)
}

///|
/// 经文区块：每条句子可点击展开自己的注疏（卦辞/大象/彖辞通用）
fn text_sec(
  title : String,
  blocks : Array[@shared.Block],
  opens : Array[Bool],
  on_toggle : (Int) -> @cmd.Cmd,
) -> Html {
  let kids : Array[Html] = []
  for i in 0..<blocks.length() {
    let b = blocks[i]
    match b.注疏 {
      Some(c) => {
        let open = i < opens.length() && opens[i]
        kids.push(
          button(
            attrs=@styles.att(@styles.div_m_click_txt()),
            title="点击展开/折叠注疏",
            on_click=on_toggle(i),
            [
              span(attrs=@styles.att(@styles.div_m_click_txt_span_m_fold()), if open { "▾" } else { "▸" }),
              span(attrs=@styles.att(@styles.div_m_click_txt_span_m_jtext()), b.文),
            ],
          ),
        )
        if open {
          kids.push(div(attrs=@styles.att(@styles.div_m_ann_body()), [commentary_view(c)]))
        }
      }
      None => kids.push(p(attrs=@styles.att(@styles.p_m_jtext()), b.文))
    }
  }
  div(attrs=@styles.att(@styles.div_m_sec()), [h2(title), div(kids)])
}

// ---------- 后天八卦 Canvas（测影成鱼 · 八卦内圈 · 二十四节气 · 六十四卦环 · 七十二候） ----------

///|
let c_paper = "#f6efe0"

///|
let c_ink = "#1a1410"

///|
let c_ink3 = "#7a6851"

///|
let c_vermilion = "#8a2518"

///|
/// 后天八卦方位：画布角度（0=右/西，90=下/北，180=左/东，270=上/南），第三项为纯卦序号
let bagua_table : Array[(String, Int, Int)] = [
  ("离", 270, 30),
  ("坤", 315, 2),
  ("兑", 0, 58),
  ("乾", 45, 1),
  ("坎", 90, 29),
  ("艮", 135, 52),
  ("震", 180, 51),
  ("巽", 225, 57),
]

///|
/// 先天伏羲八卦方位（乾南坤北 · 离东坎西 · 兑东南艮西北 · 震东北巽西南）
let xiantian_bagua : Array[(String, Int, Int)] = [
  ("乾", 270, 1),
  ("兑", 315, 58),
  ("坎", 0, 29),
  ("艮", 45, 52),
  ("坤", 90, 2),
  ("震", 135, 51),
  ("离", 180, 30),
  ("巽", 225, 57),
]

///|
/// 伏羲先天六十四卦圆图序（复当冬至/北起，顺时针；左半复→乾三十二阳卦，右半姤→坤三十二阴卦）
let xiantian_ring : Array[Int] = [
  24, 27, 3, 42, 51, 21, 17, 25, 36, 22, 63, 37, 55, 30, 49, 13, 19, 41, 60, 61,
  54, 38, 58, 10, 11, 26, 5, 9, 34, 14, 43, 1, 44, 28, 50, 32, 57, 48, 18, 46, 6,
  47, 64, 40, 59, 29, 4, 7, 33, 31, 56, 62, 53, 39, 52, 15, 12, 45, 35, 16, 20, 8,
  23, 2,
]

///|
/// 京房八宫卦序（八宫各八卦：本宫→一世…五世→游魂→归魂；顺时针自西/兑宫起，
/// 八宫本宫卦恰落于后天八卦方位：兑西·乾西北·坎北·艮东北·震东·巽东南·离南·坤西南）
let jingfang_ring : Array[Int] = [
  58, 47, 45, 31, 39, 15, 62, 54, 1, 44, 33, 12, 20, 23, 35, 14, 29, 60, 3, 63, 49,
  55, 36, 7, 52, 22, 26, 41, 38, 10, 61, 53, 51, 16, 40, 32, 46, 48, 28, 17, 57,
  9, 37, 42, 25, 21, 27, 18, 30, 56, 50, 64, 4, 59, 6, 13, 2, 24, 19, 11, 34, 43,
  5, 8,
]

///|
/// 四正卦（乾坤坎离）
fn is_zheng_gua(name : String) -> Bool {
  match name {
    "乾" | "坤" | "坎" | "离" => true
    _ => false
  }
}

///|
/// 二十四节气：0 号在冬至（画布 90°=北/坎位），顺时针每 15° 一个
let solar_terms : Array[String] = [
  "冬至", "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明",
  "谷雨", "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋",
  "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪",
]

///|
/// 十二辟卦（卦气主爻）
fn is_pi_gua(name : String) -> Bool {
  match name {
    "复"
    | "临"
    | "泰"
    | "大壮"
    | "夬"
    | "乾"
    | "姤"
    | "遯"
    | "否"
    | "观"
    | "剥"
    | "坤" => true
    _ => false
  }
}

///|
/// 卦气六十卦环（京房六日七分法）：每卦 6°，共 60 槽，顺时针；
/// 十二辟卦应十二月，每月首一卦（复卦 24 当冬至/北，此后每 30° 一卦：
/// 复、临、泰、大壮、夬、乾、姤、遯、否、观、剥、坤）；
/// 其余四十八杂卦依文王卦序环列。
/// 四正卦坎离震兑不入环（卦气主四时，由八卦环置于四正）。
/// 返回 60 槽数组，每槽为卦序号（1–64）。
fn gua_qi_ring() -> Array[Int] {
  let pi_guas = [24, 19, 11, 34, 43, 1, 44, 33, 12, 20, 23, 2]
  let ring = Array::make(60, 0)
  let mut i = 0
  while i < 12 {
    ring[i * 5] = pi_guas[i]
    i = i + 1
  }
  let mut s = 0
  let mut n = 1
  while s < 60 {
    if ring[s] != 0 {
      s = s + 1
    } else {
      while n <= 64 &&
            (pi_guas.contains(n) || n == 29 || n == 30 || n == 51 || n == 58) {
        n = n + 1
      }
      if n <= 64 {
        ring[s] = n
        n = n + 1
      }
      s = s + 1
    }
  }
  ring
}

///|
/// 文本宽度估算（无 measure_text，CJK 按 1em/字）
fn label_w(s : String, size : Int) -> Double {
  s.length().to_double() * size.to_double() * 1.02
}

///|
/// set_fill_style 字符串便捷包装
fn c_fill(ctx : @canvas.OpCtx, color : String) -> Unit {
  ctx.set_fill_style(color)
}

///|
/// set_stroke_style 字符串便捷包装
fn c_stroke(ctx : @canvas.OpCtx, color : String) -> Unit {
  ctx.set_stroke_style(color)
}

///|
/// 切向文字：基线垂直于半径（沿圆周方向），字头朝外，下方（北/冬至侧）文字倒转
fn ttext(
  ctx : @canvas.OpCtx,
  cx : Double,
  cy : Double,
  deg : Double,
  r : Double,
  text : String,
  size : Int,
  color : String,
) -> Unit {
  let rad = deg * @math.PI / 180.0
  ctx.save()
  ctx.translate(cx + r * @math.cos(rad), cy + r * @math.sin(rad))
  ctx.rotate(rad + @math.PI / 2.0)
  ctx.set_font("\{size}px 'Kaiti TC','STKaiti',serif")
  c_fill(ctx, color)
  ctx.fill_text(text, -label_w(text, size) / 2.0, 4.0)
  ctx.restore()
}

///|
/// 中央"测影成鱼"（阴阳双表）：阴表杆在盘缘夏至点（随盘转动），阳表杆在圆心。
/// 夏至→冬至，圆盘转过右半缘：阴表影自盘缘所在点向圆心扫（长 0→R，冬至恰及圆心），
/// 覆盖外带 [R(1-t), R]；冬至→夏至，阳表影自圆心向盘外扫（长 R→0），覆盖内带 [0, R(1-t)]。
/// yin_frac/yang_frac ∈ [0,1]：各自影带已扫过的比例（模拟时画/消影按此绘制）；rod_deg 为阴表杆方位；
/// erase=true 时消影：阴表自夏至端（杆端、最短贴边之影）向冬至端消去。
fn draw_shadow_fish(
  ctx : @canvas.OpCtx,
  cx : Double,
  cy : Double,
  yin_frac : Double,
  yang_frac : Double,
  rod_deg : Double,
  erase : Bool,
) -> Unit {
  let pi = @math.PI
  let rad = 75.0
  let pt = fn(deg : Double, rr : Double) -> (Double, Double) {
    let a = deg * pi / 180.0
    (cx + rr * @math.cos(a), cy + rr * @math.sin(a))
  }
  // 圆盘
  c_stroke(ctx, c_ink)
  ctx.set_line_width(2.0)
  ctx.begin_path()
  ctx.arc(cx, cy, rad, 0.0, 2.0 * pi)
  ctx.stroke()
  // 阴表（盘缘夏至杆随盘转，夏至→冬至沿右半缘）：θ 270°→450°，外带 [R(1-t), R]
  // 生影自夏至端（270°）向冬至端（450°）长；消影反之：自夏至端（最短贴边之影）向冬至端消
  let yin_start = if erase { 270.0 + (1.0 - yin_frac) * 180.0 } else { 270.0 }
  let yin_end = if erase { 450.0 } else { 270.0 + yin_frac * 180.0 }
  if yin_end > yin_start + 0.0001 {
    c_fill(ctx, c_ink)
    ctx.begin_path()
    let mut d1 = yin_start
    let mut first1 = true
    while d1 <= yin_end {
      let (px, py) = pt(d1, rad)
      if first1 {
        ctx.move_to(px, py)
        first1 = false
      } else {
        ctx.line_to(px, py)
      }
      d1 = d1 + 1.0
    }
    let mut d2 = yin_end
    while d2 >= yin_start {
      let t = (d2 - 270.0) / 180.0
      let (px, py) = pt(d2, rad * (1.0 - t))
      ctx.line_to(px, py)
      d2 = d2 - 1.0
    }
    ctx.close_path()
    ctx.fill()
  }
  // 阳表（圆心杆，冬至→夏至沿左半）：θ 90°→270°，内带 [0, R(1-t)]
  // 生影自冬至端（90°，长影）向夏至端（270°，短影）长；消影反之：自冬至端（长影）向夏至端消
  let yang_start = if erase { 90.0 + (1.0 - yang_frac) * 180.0 } else { 90.0 }
  let yang_end = if erase { 270.0 } else { 90.0 + yang_frac * 180.0 }
  if yang_end > yang_start + 0.0001 {
    c_fill(ctx, c_ink)
    ctx.begin_path()
    let mut d3 = yang_start
    let mut first3 = true
    while d3 <= yang_end {
      let t = (d3 - 90.0) / 180.0
      let (px, py) = pt(d3, rad * (1.0 - t))
      if first3 {
        ctx.move_to(px, py)
        first3 = false
      } else {
        ctx.line_to(px, py)
      }
      d3 = d3 + 1.0
    }
    ctx.line_to(cx, cy)
    ctx.close_path()
    ctx.fill()
  }
  // 二至二分（盘缘四正，随盘转）
  c_fill(ctx, c_vermilion)
  let marks = [90.0, 180.0, 270.0, 0.0]
  for m in marks {
    let (px, py) = pt(m, rad)
    ctx.begin_path()
    ctx.arc(px, py, 3.0, 0.0, 2.0 * pi)
    ctx.close_path()
    ctx.fill()
  }
  // 杆标：阴表杆（盘外夏至点外，随盘转）、阳表杆（圆心）
  let (rx, ry) = pt(rod_deg, rad + 8.0)
  ctx.begin_path()
  ctx.arc(rx, ry, 3.0, 0.0, 2.0 * pi)
  ctx.close_path()
  ctx.fill()
  ctx.begin_path()
  ctx.arc(cx, cy, 3.0, 0.0, 2.0 * pi)
  ctx.close_path()
  ctx.fill()
}

///|
/// 画布坐标 → 极角（度，0=右，90=下，逆时针为负则补 360）
fn canvas_angle(x : Double, y : Double) -> Double {
  let t = @math.atan2(y - 360.0, x - 360.0) * 180.0 / @math.PI
  if t < 0.0 {
    t + 360.0
  } else {
    t
  }
}

///|
/// 三画卦爻码（自下而上：初→上）
fn trigram_code(name : String) -> String {
  match name {
    "乾" => "111"
    "兑" => "110"
    "离" => "101"
    "震" => "100"
    "巽" => "011"
    "坎" => "010"
    "艮" => "001"
    "坤" => "000"
    _ => "000"
  }
}

///|
/// 画一条与半径垂直（切线方向）的爻线；yang=true 实线，false 中缝断线
fn draw_yao_bar(
  ctx : @canvas.OpCtx,
  cx : Double,
  cy : Double,
  deg : Double,
  r : Double,
  half_len : Double,
  thick : Double,
  yang : Bool,
  color : String,
) -> Unit {
  let rad = deg * @math.PI / 180.0
  let ux = @math.cos(rad)
  let uy = @math.sin(rad)
  let tx = -uy
  let ty = ux
  let px = cx + r * ux
  let py = cy + r * uy
  c_stroke(ctx, color)
  ctx.set_line_width(thick)
  let seg = fn(f0 : Double, f1 : Double) {
    ctx.begin_path()
    ctx.move_to(px + tx * half_len * f0, py + ty * half_len * f0)
    ctx.line_to(px + tx * half_len * f1, py + ty * half_len * f1)
    ctx.stroke()
  }
  if yang {
    seg(-1.0, 1.0)
  } else {
    seg(-1.0, -0.2)
    seg(0.2, 1.0)
  }
}

///|
/// 三画卦：3 爻自内（初）向外（上）径向排布，爻与半径垂直
fn draw_trigram_bars(
  ctx : @canvas.OpCtx,
  cx : Double,
  cy : Double,
  deg : Double,
  r_in : Double,
  r_out : Double,
  code : String,
  color : String,
) -> Unit {
  let slot = (r_out - r_in) / 3.0
  let mut i = 0
  while i < 3 {
    let r = r_in + slot * (i.to_double() + 0.5)
    let yang = code[i:i + 1].to_owned() == "1"
    draw_yao_bar(ctx, cx, cy, deg, r, 14.0, 6.0, yang, color)
    i = i + 1
  }
}

///|
/// 六画卦：6 爻自内（初）向外（上）径向排布，爻与半径垂直
fn draw_hexagram_bars(
  ctx : @canvas.OpCtx,
  cx : Double,
  cy : Double,
  deg : Double,
  r_in : Double,
  r_out : Double,
  code : String,
  color : String,
) -> Unit {
  let slot = (r_out - r_in) / 6.0
  let mut i = 0
  while i < 6 {
    let r = r_in + slot * (i.to_double() + 0.5)
    let yang = code[i:i + 1].to_owned() == "1"
    draw_yao_bar(ctx, cx, cy, deg, r, 10.0, 4.5, yang, color)
    i = i + 1
  }
}

///|
/// 测影成鱼（阴阳双表）· 八卦（先天/后天，爻画于内圈）· 四正 · 二十四节气 · 六十四卦环（爻画于节气外）· 七十二候（最外）
/// rot：测影模拟旋转角（自夏至起，可多圈）；sim：模拟模式（画/消影子）
/// 卦爻色环模式：改绘色环（两仪/四象/八卦/六十四卦，等面积环带）
fn bagua_draw(
  ctx : @canvas.OpCtx,
  data : @shared.ReaderData,
  mode : BaguaMode,
  ring : RingState,
  rot : Double,
  sim : Bool,
) -> Unit {
  if mode == ColorRing {
    ring_draw(ctx, data, ring)
    return
  }
  let cx = 360.0
  let cy = 360.0
  let pi = @math.PI
  c_fill(ctx, c_paper)
  ctx.fill_rect(0.0, 0.0, 720.0, 720.0)
  // 外圈（罗盘边框）填充：先铺满外圆，再覆纸色内圆成环
  c_fill(ctx, c_ink3)
  ctx.begin_path()
  ctx.arc(cx, cy, 346.0, 0.0, 2.0 * pi)
  ctx.close_path()
  ctx.fill()
  c_fill(ctx, c_paper)
  ctx.begin_path()
  ctx.arc(cx, cy, 330.0, 0.0, 2.0 * pi)
  ctx.close_path()
  ctx.fill()
  // 罗盘双外圈
  c_stroke(ctx, c_vermilion)
  ctx.set_line_width(2.0)
  ctx.begin_path()
  ctx.arc(cx, cy, 346.0, 0.0, 2.0 * pi)
  ctx.stroke()
  ctx.begin_path()
  ctx.arc(cx, cy, 336.0, 0.0, 2.0 * pi)
  ctx.stroke()
  // 整盘随轮盘旋转（默认拖拽即可转动；四正方位固定，消影圈鱼固定）
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot * pi / 180.0)
  ctx.translate(-cx, -cy)
  // 七十二候刻线（最外圈，每 5°；节气处加长加粗）
  let mut k = 0
  while k < 72 {
    let deg = 90.0 + k.to_double() * 5.0
    let rad = deg * pi / 180.0
    let long = k % 3 == 0
    let r0 = if long { 296.0 } else { 304.0 }
    c_stroke(ctx, if long { c_vermilion } else { c_ink3 })
    ctx.set_line_width(if long { 2.0 } else { 1.0 })
    ctx.begin_path()
    ctx.move_to(cx + r0 * @math.cos(rad), cy + r0 * @math.sin(rad))
    ctx.line_to(cx + 326.0 * @math.cos(rad), cy + 326.0 * @math.sin(rad))
    ctx.stroke()
    k = k + 1
  }
  // 二十四节气标签（切向）
  let mut i = 0
  while i < solar_terms.length() {
    let deg = 90.0 + i.to_double() * 15.0
    ttext(ctx, cx, cy, deg, 210.0, solar_terms[i], 12, c_ink3)
    i = i + 1
  }
  // 八卦内圈（爻画 + 卦名象，水平）：先天模式用伏羲方位，其余用后天方位
  let btable = match mode {
    Fuxi => xiantian_bagua
    GuaQi | JingFang => bagua_table
    ColorRing => bagua_table
  }
  for bt in btable {
    let deg = bt.1.to_double()
    let name = bt.0
    let mut xiang = ""
    for h in data.hexagrams {
      if h.序号 == bt.2 {
        xiang = h.上卦.象
        break
      }
    }
    draw_trigram_bars(ctx, cx, cy, deg, 132.0, 160.0, trigram_code(name), c_ink)
    ttext(ctx, cx, cy, deg, 174.0, "\{name}\{xiang}", 12, c_ink3)
  }
  // 六十四卦环（节气之外，爻画 + 卦名，水平）
  match mode {
    Fuxi => {
      // 伏羲先天圆图序：复卦(24)当冬至/北，顺时针每卦 5.625°；红=四正卦（乾离坎坤）
      let mut s = 0
      while s < 64 {
        let h = data.hexagrams[xiantian_ring[s] - 1]
        let deg = 90.0 + s.to_double() * 5.625
        let special = is_zheng_gua(h.卦名)
        let color = if special { c_vermilion } else { c_ink }
        draw_hexagram_bars(ctx, cx, cy, deg, 232.0, 276.0, h.卦画, color)
        ttext(
          ctx,
          cx,
          cy,
          deg,
          282.0,
          h.卦名,
          11,
          if special {
            c_vermilion
          } else {
            c_ink3
          },
        )
        s = s + 1
      }
    }
    GuaQi => {
      // 卦气六十卦环（京房六日七分 · 每卦 6° · 复卦 24 锚定冬至/北 · 顺时针 · 红=十二辟卦应十二月）
      let ring = gua_qi_ring()
      let mut s = 0
      while s < ring.length() {
        let h = data.hexagrams[ring[s] - 1]
        let deg = 90.0 + s.to_double() * 6.0
        let special = is_pi_gua(h.卦名)
        let color = if special { c_vermilion } else { c_ink }
        draw_hexagram_bars(ctx, cx, cy, deg, 232.0, 276.0, h.卦画, color)
        ttext(
          ctx,
          cx,
          cy,
          deg,
          282.0,
          h.卦名,
          11,
          if special {
            c_vermilion
          } else {
            c_ink3
          },
        )
        s = s + 1
      }
    }
    JingFang => {
      // 京房八宫卦序：自西/兑宫起顺时针每卦 5.625°，八宫各 45°；红=八宫本宫卦
      let mut s = 0
      while s < 64 {
        let h = data.hexagrams[jingfang_ring[s] - 1]
        let deg = s.to_double() * 5.625
        let special = s % 8 == 0
        let color = if special { c_vermilion } else { c_ink }
        draw_hexagram_bars(ctx, cx, cy, deg, 232.0, 276.0, h.卦画, color)
        ttext(
          ctx,
          cx,
          cy,
          deg,
          282.0,
          h.卦名,
          11,
          if special {
            c_vermilion
          } else {
            c_ink3
          },
        )
        s = s + 1
      }
    }
    ColorRing => ()
  }
  // 中央测影成鱼图（阴阳双表）：模拟时按画/消影比例绘制（阴表先画先消）
  let (yin_frac, yang_frac) = if sim {
    sim_fish_fractions(rot)
  } else {
    (1.0, 1.0)
  }
  let ph = pos_mod(rot, 720.0)
  let erase = sim && ph >= 360.0
  let rod_deg = if erase { pos_mod(270.0 + rot, 360.0) } else { 270.0 }
  // 测影圈（或非模拟完整鱼）：鱼随盘转（生影由盘缘扫出，方向正确）
  if !erase {
    draw_shadow_fish(ctx, cx, cy, yin_frac, yang_frac, rod_deg, erase)
  }
  // 恢复旋转
  ctx.restore()
  // 消影圈：鱼固定于圈一末位（先消最短贴边之影，不随盘转）
  if erase {
    draw_shadow_fish(ctx, cx, cy, yin_frac, yang_frac, rod_deg, erase)
  }
  // 四正方位（固定，不随盘转）
  ttext(ctx, cx, cy, 270.0, 100.0, "南", 12, c_vermilion)
  ttext(ctx, cx, cy, 0.0, 100.0, "西", 12, c_vermilion)
  ttext(ctx, cx, cy, 90.0, 100.0, "北", 12, c_vermilion)
  ttext(ctx, cx, cy, 180.0, 100.0, "东", 12, c_vermilion)
}


///|
/// 当前毫秒时间戳（长按判定用）
extern "js" fn now_ms() -> Double = "() => (Date.now() || 0)"

///|
/// 正模（结果 ∈ [0, m)）
fn pos_mod(x : Double, m : Double) -> Double {
  let r = x - m * @math.floor(x / m)
  if r >= m {
    r - m
  } else {
    r
  }
}

///|
/// 测影模拟：rot 每 720° 一循环。
/// 第一圈（0–360°）测影：夏至→冬至先长阴表，冬至→夏至再长阳表；
/// 第二圈（360–720°）消影：先消阴表，再消阳表；第三圈又先生阴表——可一直转。
/// 返回 (阴表比例, 阳表比例) ∈ [0,1]。
fn sim_fish_fractions(rot : Double) -> (Double, Double) {
  let ph = pos_mod(rot, 720.0)
  if ph < 360.0 {
    if ph < 180.0 {
      (ph / 180.0, 0.0)
    } else {
      (1.0, (ph - 180.0) / 180.0)
    }
  } else {
    let e = ph - 360.0
    if e < 180.0 {
      (1.0 - e / 180.0, 1.0)
    } else {
      (0.0, 1.0 - (e - 180.0) / 180.0)
    }
  }
}

///|
/// 由模型算出**罗盘的绘制指令** —— 迁移后的核心改动：画布不再是"渲染完再去 DOM 里找元素画"，
/// 而是**视图里的纯函数**（同一份模型 → 同一份指令，可测、可断言）。
///
/// `k` 是缩放比：绘制坐标写死 720（原来也是），实际边长按视口算，
/// 于是同一份绘制代码在手机与桌面上都能铺满。
fn bagua_ops(
  data : @shared.ReaderData,
  mode : BaguaMode,
  ring : RingState,
  rot : Double,
  sim : Bool,
  k : Double,
) -> Array[@canvas.DrawOp] {
  let ctx = @canvas.OpCtx::new()
  ctx.save()
  ctx.scale(k, k)
  bagua_draw(ctx, data, mode, ring, rot, sim)
  ctx.restore()
  ctx.take()
}

///|
/// 画布边长：跟随窗口宽度（原实现是 CSS `min(94vw, 720px)`；RN 没有 CSS，所以在这里算）。
/// ⚠️ 它与 `720` 的比就是 `k` —— **边长的意义不只是排版**：手势给的是"元素内坐标"，
/// 只有"画布的逻辑单位 = 屏幕单位"时，那个坐标才能直接当画布坐标用。
fn canvas_side(vp_w : Double) -> Double {
  if vp_w <= 0.0 {
    // ⚠️ **真机上这条分支一定会走到**：`@sub.on_resize` 刻意**不补发初始值**
    //    （"与 DOM 一致"，见库文档），而手机不转屏就永远不会触发 resize ——
    //    于是"读不到视口宽度"是**常态**，不是异常。
    //    实测：vp_w 恒为 0，画布按 720 画，在 392dp 宽的屏上**右边被裁掉一半**
    //    （截图里墨色横跨 x 90→1074，而屏宽 1080，圆心已经在屏外）。
    //    所以这里的回落值必须"**哪端都不溢出**"：360 放得进任何手机，桌面上小一点但完整。
    //    📌 想要真正的响应式，库里需要一个"**读当前视口**"的能力（现在只有订阅）——
    //       记在 FINDINGS 的 Android 补记里。
    360.0
  } else if (vp_w * 0.94) > 720.0 {
    720.0
  } else if (vp_w * 0.94) < 280.0 {
    280.0
  } else {
    @math.floor(vp_w * 0.94)
  }
}
///|
/// 罗盘首页：Canvas 罗盘（测影成鱼 → 四正 → 八卦内圈 → 二十四节气 → 六十四卦环 → 七十二候）或卦爻色环，
/// 可切换先天/卦气/京房/色环，点击卦名直达
fn bagua_view(
  data : @shared.ReaderData,
  mode : BaguaMode,
  ring : RingState,
  sim : Bool,
  rot : Double,
  vp_w : Double,
  emit : @cmd.Emit[Msg],
) -> Html {
  let size = canvas_side(vp_w)
  let k = size / 720.0
  let ops = bagua_ops(data, mode, ring, rot, sim, k)

  div(attrs=@styles.att(@styles.div_bagua_wrap()), [
    h2(
      attrs=@styles.att(@styles.div_bagua_wrap_h2_hex_index_title()),
      if mode == ColorRing {
        "卦爻色环"
      } else {
        "八卦罗盘 · 六十四卦总览"
      },
    ),
    div(attrs=@styles.att(@styles.div_bagua_wrap_div_bagua_modes()), [
      button(
        attrs=if mode == Fuxi { @styles.att(@styles.div_bagua_wrap_div_bagua_modes_button_bagua_mode_on()) } else { @styles.att(@styles.div_bagua_wrap_div_bagua_modes_button_bagua_mode()) },
        on_click=emit(SetMode(Fuxi)),
        "伏羲先天",
      ),
      button(
        attrs=if mode == GuaQi { @styles.att(@styles.div_bagua_wrap_div_bagua_modes_button_bagua_mode_on()) } else { @styles.att(@styles.div_bagua_wrap_div_bagua_modes_button_bagua_mode()) },
        on_click=emit(SetMode(GuaQi)),
        "后天文王 · 卦气",
      ),
      button(
        attrs=if mode == JingFang { @styles.att(@styles.div_bagua_wrap_div_bagua_modes_button_bagua_mode_on()) } else { @styles.att(@styles.div_bagua_wrap_div_bagua_modes_button_bagua_mode()) },
        on_click=emit(SetMode(JingFang)),
        "京房八宫",
      ),
      button(
        attrs=if mode == ColorRing { @styles.att(@styles.div_bagua_wrap_div_bagua_modes_button_bagua_mode_on()) } else { @styles.att(@styles.div_bagua_wrap_div_bagua_modes_button_bagua_mode()) },
        on_click=emit(SetMode(ColorRing)),
        "卦爻色环",
      ),
    ]),
    if mode == ColorRing {
      ring_panel(ring, emit)
    } else {
      nothing
    },
    // 画布：走**组件通道**（`@canvas.canvas` → 宿主的 Skia），
    // 外面那层 div 挂**手势通道**（`@gesture`）—— 两者都不是"自己实现渲染"，见 DESIGN 原则 1。
    div(
      attrs=@gesture.attrs(
        on_pan=p => {
          let x = p.x / k
          let y = p.y / k
          match p.phase {
            @gesture.Phase::Start => emit(DragStart(canvas_angle(x, y), x, y, 0.0))
            @gesture.Phase::Move => emit(DragMove(canvas_angle(x, y), x, y, 0.0))
            _ => emit(DragEnd)
          }
        },
        on_tap=t => emit(TapAt(t.x / k, t.y / k)),
      ).styles(
        // ⚠️ **手势元素必须与画布同尺寸** —— 这条不是排版，是**正确性**。
        //    `@gesture` 给的 `x/y` 是"**承载手势的那个元素**内的坐标"，
        //    而我们的角度/命中判定用的是"画布坐标"（720 那一套）。
        //    如果手势挂在外层 box 上（box 是整行宽、画布在里面居中），
        //    两者会差一个**居中的偏移** —— 实测差 48px：web 上点外环 260 的位置，
        //    应用算出来是 356（跑到环外，于是"点了没反应"）；Android 上表现为
        //    "拖 45° 只转 5°、环上命中不跟手"（同一根因，两端都栽）。
        //    修法就是这一行：给手势元素钉上与画布一样的边长。
        @style.Style::new()
        .width(@style.px(size))
        .height(@style.px(size))
        .align_items(@style.Align::Center)
        .justify_content(@style.Justify::Center),
      ),
      [@canvas.canvas(ops, size, size)],
    ),
    if mode == ColorRing {
      ring_legend()
    } else {
      div(attrs=@styles.att(@styles.div_bagua_wrap_div_bagua_sim()), [
        button(
          attrs=if sim { @styles.att(@styles.div_bagua_wrap_div_bagua_sim_button_bagua_mode_on()) } else { @styles.att(@styles.div_bagua_wrap_div_bagua_sim_button_bagua_mode()) },
          on_click=emit(SetSim(!sim)),
          if sim {
            "立竿测影 · 开"
          } else {
            "立竿测影 · 关"
          },
        ),
      ])
    },
  ])

}
///|
/// 搜索网格（上经/下经）
fn grid_view(
  data : @shared.ReaderData,
  q : String,
  emit : @cmd.Emit[Msg],
) -> Html {
  let shang : Array[Html] = []
  let xia : Array[Html] = []
  for h in data.hexagrams {
    if q != "" &&
      h.卦名.contains(q) == false &&
      h.象名.contains(q) == false &&
      block_text(h.卦辞).contains(q) == false {
      continue
    }
    let card = button(attrs=@styles.att(@styles.div_hex_card()), on_click=emit(Open(h.序号)), [
      span(attrs=@styles.att(@styles.div_hex_card_span_idx()), "\{h.序号}"),
      span(attrs=@styles.att(@styles.div_hex_card_span_name()), "\{gua_symbol(h.序号)} \{h.卦名}"),
      span(attrs=@styles.att(@styles.div_hex_card_span_xiang()), h.象名),
    ])
    if h.经 == "上经" {
      shang.push(card)
    } else {
      xia.push(card)
    }
  }
  div(attrs=@styles.att(@styles.div_hex_index()), [
    h2(attrs=@styles.att(@styles.div_hex_index_h2_hex_index_title()), "六十四卦速查"),
    p(
      attrs=@styles.att(@styles.div_hex_index_p_hex_index_hint()),
      "文王卦序 · 点击进入卦象详情 · 《御纂周易折中》",
    ),
    div(attrs=@styles.att(@styles.div_hex_index_div_hex_index_section()), [
      div(attrs=@styles.att(@styles.div_hex_index_div_hex_index_section_div_hex_index_section_label()), "上经 · 第 1–30 卦"),
      div(attrs=@styles.att(@styles.div_hex_index_div_hex_index_section_div_hex_index_grid()), shang),
    ]),
    div(attrs=@styles.att(@styles.div_hex_index_div_hex_index_section()), [
      div(attrs=@styles.att(@styles.div_hex_index_div_hex_index_section_div_hex_index_section_label()), "下经 · 第 31–64 卦"),
      div(attrs=@styles.att(@styles.div_hex_index_div_hex_index_section_div_hex_index_grid()), xia),
    ]),
  ])
}

///|
/// 列表页：无搜索词显示八卦罗盘图，有搜索词显示过滤网格
fn list_view(model : Model, emit : @cmd.Emit[Msg]) -> Html {
  match model.data {
    None => div(attrs=@styles.att(@styles.div_loading()), "載入中…")
    Some(data) => {
      let q = model.query.trim().to_owned()
      if q == "" {
        bagua_view(data, model.mode, model.ring, model.sim, model.rot, model.vp_w, emit)
      } else {
        grid_view(data, q, emit)
      }
    }
  }
}

///|
/// 传文关联折叠体（序卦 / 杂卦 / 说卦 / 系辞）
fn relations_view(rel : @shared.Relations) -> Html {
  let groups : Array[Html] = []
  let add_group = fn(name : String, blocks : Array[@shared.Block]) {
    if blocks.length() > 0 {
      let texts : Array[Html] = []
      for b in blocks {
        texts.push(p(attrs=@styles.att(@styles.p_m_txt()), b.文))
        match b.注疏 {
          Some(c) => texts.push(commentary_view(c))
          None => ()
        }
      }
      groups.push(
        div(attrs=@styles.att(@styles.div_m_group()), [div(attrs=@styles.att(@styles.div_m_group_div_m_group_name()), name), div(texts)]),
      )
    }
  }
  match rel.序卦 {
    Some(b) => add_group("序卦", b)
    None => ()
  }
  match rel.杂卦 {
    Some(b) => add_group("杂卦", b)
    None => ()
  }
  match rel.说卦 {
    Some(b) => add_group("说卦", b)
    None => ()
  }
  match rel.系辞 {
    Some(b) => add_group("系辞", b)
    None => ()
  }
  div(groups)
}

///|
/// 一爻行：大爻线（点击标记变爻）+ 右侧爻辞（点击展开/折叠注疏）
fn yao_view(
  y : @shared.Yao,
  yang : Bool,
  is_bian : Bool,
  hl : Bool,
  is_open : Bool,
  xiao_open : Bool,
  /// 窄屏（<760px）：原 `@media` 在这个断点下把爻线改成 27 高 / 120 宽
  narrow : Bool,
  emit : @cmd.Emit[Msg],
) -> Html {
  // ── 爻线：**这一段原来是 `class="m-yao-line yang|yin …"`（动态拼的）** ────────────
  //
  // 迁移时它是报告里那条 `dynamic-class` TODO（"动态 class 只能靠人工"），一直没做 ——
  // 后果不是"样式差一点"，而是**这根爻线根本不存在**：`class=` 在 moobile 里是**静默失效**的，
  // 而它的内容只有那个 ○/× 标记（不选变爻时是空的）⇒ 量出来 **0×0**，
  // 于是**变爻标记在 web 与真机上都点不到**（十轮实测：`elementsFromPoint` 在那个点上根本
  // 拿不到这个元素，○ 的个数点了也是 0 → 0）。
  //
  // 修法：把条件**搬进样式**（原 CSS 的选择器语义就是"按状态选颜色"）：
  //   `.m-yao-line` 高 32（窄屏 27）/ 圆角 3 / 垂直居中；`.yang` 实心、`.yin` 断成两段；
  //   `.hl`（错综互预览的变动爻）金色、`.bian`（已标记变爻）朱砂色。
  // ⚠️ `.yin` 原来是 `linear-gradient` 中间透明 —— `@style` 表达不了渐变，
  //    改画**两根横条**（视觉等价：断口一样在中间 42%–58%）。
  let line_color = if is_bian {
    "#8a2518" // --vermilion-0
  } else if hl {
    "#8a6a2a" // --gold-0
  } else {
    "#1a1410" // --ink-0
  }
  let line_h = if narrow { 27.0 } else { 32.0 } // 原 `.m-yao-line { height: 32px }` + 窄屏 27
  let line_w = if narrow { 120.0 } else { 160.0 } // 原网格列宽 `160px 1fr` + 窄屏 120
  let bar = fn(w : @style.Style) -> Html {
    div(
      attrs=@styles.att(w.height(@style.px(line_h)).border_radius(3.0).background_color(line_color)),
      ([] : Array[Html]),
    )
  }
  let line_body : Array[Html] = if yang {
    [bar(@style.Style::new().flex(1.0))]
  } else {
    // 阴爻：两段 + 中间 16% 的断口（原渐变是 42%–58%）
    [
      div(
        attrs=@styles.att(
          @style.Style::new()
            .flex_direction(@style.FlexDirection::Row)
            .gap(0.0)
            .height(@style.px(line_h))
            .width(@style.pct(100.0)),
        ),
        [
          bar(@style.Style::new().flex(0.42)),
          div(attrs=@styles.att(@style.Style::new().flex(0.16)), ([] : Array[Html])),
          bar(@style.Style::new().flex(0.42)),
        ],
      ),
    ]
  }
  let line_kids : Array[Html] = line_body.copy()
  if is_bian {
    line_kids.push(span(attrs=@styles.att(@styles.span_m_mark()), if yang { "○" } else { "×" }))
  }
  let line = button(
    attrs=@styles.att(
      @style.Style::new()
        // 宽度**确定**（原网格列宽），高度确定，内容横向铺开
        .width(@style.px(line_w))
        .height(@style.px(line_h))
        .flex_direction(@style.FlexDirection::Row)
        .align_items(@style.Align::Center),
    ),
    title="点击标记变爻（阳→老阳 ○，阴→老阴 ×）",
    on_click=emit(ToggleBian(y.位 - 1)),
    line_kids,
  )
  // 右侧内容：爻辞（可点展开爻注疏）+ 小象（可点展开小象注疏）
  let body : Array[Html] = []
  let has_yao_extra = match y.注疏 {
    Some(_) => true
    None =>
      match y.文言 {
        Some(ws) if ws.length() > 0 => true
        _ =>
          match y.系辞引述 {
            Some(cs) if cs.length() > 0 => true
            _ => false
          }
      }
  }
  // 爻题 + 爻辞（点击切换爻注疏）
  let head_kids : Array[Html] = []
  if has_yao_extra {
    head_kids.push(span(attrs=@styles.att(@styles.span_m_fold()), if is_open { "▾" } else { "▸" }))
  }
  head_kids.push(span(attrs=@styles.att(@styles.span_m_yao_title()), y.爻题))
  head_kids.push(span(attrs=@styles.att(@styles.span_m_yao_ci()), y.爻辞))
  let head = if has_yao_extra {
    button(
      attrs=@styles.att(@styles.div_m_yao_txt()),
      title="点击展开/折叠注疏",
      on_click=emit(ToggleYaoOpen(y.位 - 1)),
      [div(attrs=@styles.att(@styles.div_m_yao_txt_div_m_yao_head()), head_kids)],
    )
  } else {
    div(attrs=@styles.att(@styles.div_m_yao_txt()), [div(attrs=@styles.att(@styles.div_m_yao_txt_div_m_yao_head()), head_kids)])
  }
  body.push(head)
  // 爻注疏 + 文言 + 系辞引述
  if is_open {
    match y.注疏 {
      Some(c) => body.push(commentary_view(c))
      None => ()
    }
    match y.文言 {
      Some(ws) =>
        for w in ws {
          let wbox : Array[Html] = [p(attrs=@styles.att(@styles.p_m_weny()), w.文)]
          match w.注疏 {
            Some(c) => wbox.push(commentary_view(c))
            None => ()
          }
          body.push(div(attrs=@styles.att(@styles.div_m_weny_box()), wbox))
        }
      None => ()
    }
    match y.系辞引述 {
      Some(cites) =>
        for c in cites {
          let mut txt = c.引文
          match c.子曰 {
            Some(z) => txt = txt + " " + z
            None => ()
          }
          match c.引文前 {
            Some(pre) => txt = pre + " " + txt
            None => ()
          }
          match c.引文后 {
            Some(post) => txt = txt + " " + post
            None => ()
          }
          body.push(
            div(attrs=@styles.att(@styles.div_m_cite()), [span(attrs=@styles.att(@styles.div_m_cite_span_c_src()), "\{c.来源} "), span(txt)]),
          )
        }
      None => ()
    }
  }
  // 小象行：有注疏则可点击展开
  match y.小象 {
    Some(xs) => {
      let mut has_xiao_comm = false
      for x in xs {
        match x.注疏 {
          Some(_) => has_xiao_comm = true
          None => ()
        }
      }
      if has_xiao_comm {
        body.push(
          button(
            attrs=@styles.att(@styles.div_click_m_yao_xiang()),
            title="点击展开/折叠小象注疏",
            on_click=emit(ToggleXiaoxiangOpen(y.位 - 1)),
            [
              span(attrs=@styles.att(@styles.div_click_m_yao_xiang_span_m_fold()), if xiao_open { "▾" } else { "▸" }),
              span(attrs=@styles.att(@styles.div_click_m_yao_xiang_span_xlab()), "小象"),
              span(xs.map(x => x.文).join("　")),
            ],
          ),
        )
        if xiao_open {
          for x in xs {
            match x.注疏 {
              Some(c) =>
                body.push(div(attrs=@styles.att(@styles.div_m_ann_body()), [commentary_view(c)]))
              None => ()
            }
          }
        }
      } else {
        for x in xs {
          body.push(
            p(attrs=@styles.att(@styles.p_m_yao_xiang()), [span(attrs=@styles.att(@styles.p_m_yao_xiang_span_xlab()), "小象"), span(x.文)]),
          )
        }
      }
    }
    None => ()
  }
  // ⚠️★ **必须显式写 `flex_direction(Row)`**：RN 的默认方向是 `column`（CSS 是 `row`），
  //    而原 `.m-yao` 是网格 `160px 1fr`。不写的话爻线与文本**竖着堆**，而爻线是 `flex:1` +
  //    无固有宽度 ⇒ 在 column 容器里被量成 **0×0**（实测：`w:0 h:0`）——
  //    于是"能看见爻线"和"点得到爻线"两件事同时不成立。
  div(
    attrs=@styles.att(@styles.div_m_yao().flex_direction(@style.FlexDirection::Row)),
    [line, div(attrs=@styles.att(@styles.div_m_yao_div_m_yao_txt_wrap().flex(1.0)), body)],
  )
}

///|
/// 按变爻表翻转卦画（bian[i]=true 则第 i 爻阴阳互换；卦画自下而上）
fn flip_with_bian(code : String, bian : Array[Bool]) -> String {
  let mut out = ""
  for i in 0..<6 {
    let ch = code[i:i + 1].to_owned()
    let flipped = if bian[i] { if ch == "1" { "0" } else { "1" } } else { ch }
    out = out + flipped
  }
  out
}

///|
/// 六十四卦 Unicode 卦象（U+4DC0 起，按文王卦序：1 乾 → 64 未济）
let hex_symbols = "䷀䷁䷂䷃䷄䷅䷆䷇䷈䷉䷊䷋䷌䷍䷎䷏䷐䷑䷒䷓䷔䷕䷖䷗䷘䷙䷚䷛䷜䷝䷞䷟䷠䷡䷢䷣䷤䷥䷦䷧䷨䷩䷪䷫䷬䷭䷮䷯䷰䷱䷲䷳䷴䷵䷶䷷䷸䷹䷺䷻䷼䷽䷾䷿"

///|
/// 按卦序号取 Unicode 卦象（MoonBit 字符串切片按字符索引：1 乾 → 64 未济）
fn gua_symbol(n : Int) -> String {
  hex_symbols[n - 1:n].to_owned()
}

///|
/// 按卦画（6位码）查卦（64 卦码与序号一一对应，必有结果）
fn hexagram_by_code(
  data : @shared.ReaderData,
  code : String,
) -> @shared.Hexagram? {
  for g in data.hexagrams {
    if g.卦画 == code {
      return Some(g)
    }
  }
  None
}

///|
/// 错/综/互/变卦 一排按钮：
/// 错/综/互 —— 第一次按选中（高亮+×，爻图金线标出变动爻），第二次按跳转；自卦置灰
/// 变卦 —— 有变爻时出现，一键跳转
fn relation_links(
  h : @shared.Hexagram,
  data : @shared.ReaderData,
  bian : Array[Bool],
  preview : Int?,
  emit : @cmd.Emit[Msg],
) -> Html {
  let rels = [
    ("错卦", @shared.opposite(h.卦画)),
    ("综卦", @shared.reversed(h.卦画)),
    ("互卦", @shared.mutual(h.卦画)),
  ]
  let links : Array[Html] = []
  for rel in rels {
    let label = rel.0
    let c = rel.1
    match hexagram_by_code(data, c) {
      Some(g) => {
        let self = g.序号 == h.序号
        if self {
          links.push(
            button(attrs=@styles.att(@styles.button_rel_link_self()), disabled=true, [
              span(attrs=@styles.att(@styles.button_rel_link_self_span_rl_label()), label),
              span(attrs=@styles.att(@styles.button_rel_link_self_span_rl_name()), "\{g.卦名} \{g.象名}"),
            ]),
          )
        } else {
          let selected = preview == Some(g.序号)
          links.push(
            div(attrs=@styles.att(@styles.div_rel_wrap()), [
              button(
                attrs=if selected { @styles.att(@styles.div_rel_wrap_button_rel_link_sel()) } else { @styles.att(@styles.div_rel_wrap_button_rel_link()) },
                title=if selected {
                  "再按一次跳转"
                } else {
                  "按一下预览变动 · 再按跳转"
                },
                on_click=emit(RelSelect(g.序号)),
                [
                  span(class="rl-label", label),
                  span(
                    class="rl-name",
                    "\{gua_symbol(g.序号)} \{g.卦名} \{g.象名}",
                  ),
                ],
              ),
              if selected {
                button(
                  attrs=@styles.att(@styles.div_rel_wrap_button_rel_x()),
                  title="取消预览",
                  on_click=emit(RelClear),
                  "×",
                )
              } else {
                nothing
              },
            ]),
          )
        }
      }
      None => ()
    }
  }
  // 变卦按钮：有变爻才出现，一键跳转
  let mut any_bian = false
  for i in 0..<6 {
    if bian[i] {
      any_bian = true
    }
  }
  if any_bian {
    match hexagram_by_code(data, flip_with_bian(h.卦画, bian)) {
      Some(to) =>
        links.push(
          button(
            attrs=@styles.att(@styles.button_bian_rel_link()),
            title="跳转到变卦",
            on_click=emit(Open(to.序号)),
            [
              span(attrs=@styles.att(@styles.button_bian_rel_link_span_rl_label()), "变卦"),
              span(
                attrs=@styles.att(@styles.button_bian_rel_link_span_rl_name()),
                "\{gua_symbol(to.序号)} \{to.卦名} \{to.象名}",
              ),
            ],
          ),
        )
      None => ()
    }
  }
  match preview {
    Some(_) =>
      links.push(
        span(
          attrs=@styles.att(@styles.span_rel_hint()),
          "金线＝变动爻 · 再按一次跳转 · × 取消",
        ),
      )
    None => ()
  }
  div(attrs=@styles.att(@styles.div_hex_rels()), links)
}

///|
/// 义例归类（时 / 应比四组）
fn guilei_view(gl : @shared.Guilei) -> Html {
  let chips : Array[Html] = []
  match gl.时 {
    Some(ts) =>
      for t in ts {
        chips.push(span(attrs=@styles.att(@styles.span_chip()), t))
      }
    None => ()
  }
  let flags = [
    ("六四承九五", gl.六四承九五),
    ("九四承六五", gl.九四承六五),
    ("九二应六五", gl.九二应六五),
    ("六二应九五", gl.六二应九五),
  ]
  for f in flags {
    let label = f.0
    let v = f.1
    match v {
      Some(true) => chips.push(span(attrs=@styles.att(@styles.span_chip()), label))
      Some(false) => ()
      None => ()
    }
  }
  if chips.length() == 0 {
    nothing
  } else {
    div(attrs=@styles.att(@styles.div_chips()), chips)
  }
}

// ── 原 `TODO(migrate)` 的那一条**已经做完了**（10-02）：`more_view` 的实现曾经迁不过来
//    （`<details>/<summary>` 在标签表里是**排除**的），所以迁移时留了个保底桩。
//    现在它按"受控折叠"重写了（见下），判据在 `verify.mjs`（21 条）与
//    `device_check.mjs`（9 条，真机）—— 桩体里的原实现注释已删，历史在 git 里。
///|
/// 底部折叠区块（**受控**）。
///
/// 迁移改动：原实现用 `<details>/<summary>` —— 那两个标签在 moobile 的标签表里是**明确排除**的
/// （RN 没有那个语义；而且开合状态本来就在 Model 里），所以改成"按钮 + 条件渲染"，
/// 点击发一条 `ToggleMore(i)`。**折叠不是装饰**：它决定内容在不在树上（因此可断言）。
///
/// ⚠️ 标题那份样式是**手工补的**：原 CSS 里它挂在 `.m-more details > summary`
/// （后代选择器 + 标签选择器），机械映射到不了元素上 —— 报告里归在「真损失」那一类
/// （`MIGRATION.md` §2.1）。这里按原值补回来：`padding: 12px 18px; font-size: 14.5px;
/// letter-spacing: .2em; color: var(--ink-2)`。
fn more_head_style() -> @style.Style {
  @style.Style::new()
    .padding_horizontal(@style.px(18.0))
    .padding_vertical(@style.px(12.0))
    .font_size(14.5)
    .letter_spacing_em(0.2)
    .color("#4a3b2e")
}

///|
/// 一个底部折叠区块：标题按钮（带 ▸/▾）+ 展开时的内容。
fn more_section(
  title : String,
  i : Int,
  open_more : Array[Bool],
  emit : @cmd.Emit[Msg],
  body : Array[Html],
) -> Html {
  let open = i < open_more.length() && open_more[i]
  div(attrs=@styles.att(@styles.details_m_more()), [
    button(
      attrs=@html.Attrs::build().styles(more_head_style()),
      title="点击展开/折叠",
      on_click=emit(ToggleMore(i)),
      [span(attrs=@styles.att(@styles.span_m_fold()), if open { "▾" } else { "▸" }), span(title)],
    ),
    if open {
      div(attrs=@styles.att(@styles.details_m_more_div_m_more_body()), body)
    } else {
      nothing
    },
  ])
}

///|
/// 底部综合区：彖辞（逐句可点注疏）+ 文言（卦）/ 传文关联 / 卦主·总论·用·义例归类
fn more_view(
  h : @shared.Hexagram,
  open_tuan : Array[Bool],
  open_more : Array[Bool],
  emit : @cmd.Emit[Msg],
) -> Html {

  let kids : Array[Html] = []
  // 彖辞：常显，每条句子可点展开自己的注疏
  match h.彖传 {
    Some(blocks) =>
      kids.push(
        text_sec("彖辞", blocks, open_tuan, i => emit(ToggleTuanOpen(i))),
      )
    None => ()
  }
  match h.文言 {
    Some(ws) if ws.length() > 0 => {
      let body : Array[Html] = []
      for w in ws {
        let wbox : Array[Html] = [p(attrs=@styles.att(@styles.p_m_txt()), w.文)]
        match w.注疏 {
          Some(c) => wbox.push(commentary_view(c))
          None => ()
        }
        body.push(div(attrs=@styles.att(@styles.div_m_weny_box()), wbox))
      }
      kids.push(more_section("文言（卦）", 0, open_more, emit, body))
    }
    _ => ()
  }
  match h.传文关联 {
    Some(rel) =>
      kids.push(
        more_section("传文关联 · 序卦 / 杂卦 / 说卦 / 系辞", 1, open_more, emit, [relations_view(rel)]),
      )
    None => ()
  }
  let meta : Array[Html] = []
  match h.卦主 {
    Some(gz) if gz.length() > 0 => {
      let txt : Array[String] = []
      for g in gz {
        txt.push("\{g.爻题}（\{g.类型}）")
      }
      meta.push(p(attrs=@styles.att(@styles.p_m_txt()), "卦主：" + txt.join("　")))
    }
    _ => ()
  }
  match h.总论 {
    Some(t) => meta.push(p(attrs=@styles.att(@styles.p_m_txt()), t))
    None => ()
  }
  match h.用 {
    Some(b) => {
      let title = match b.类型 {
        Some(t) => t
        None => "用"
      }
      meta.push(p(attrs=@styles.att(@styles.p_m_txt()), "\{title}：\{b.文}"))
      match b.注疏 {
        Some(c) => meta.push(commentary_view(c))
        None => ()
      }
    }
    None => ()
  }
  match h.义例归类 {
    Some(gl) =>
      meta.push(
        div(attrs=@styles.att(@styles.div_m_meta()), [
          div(attrs=@styles.att(@styles.div_m_meta_div_m_group_name()), "义例归类"),
          guilei_view(gl),
        ]),
      )
    None => ()
  }
  if meta.length() > 0 {
    kids.push(
      more_section("卦主 · 总论 · 用 · 义例归类", 2, open_more, emit, meta),
    )
  }
  div(attrs=@styles.att(@styles.div_m_bottom()), kids)

}
///|
/// 左栏：大字卦名 + 上/下卦 + 卦辞/大象（点文本展开注疏）
fn side_view(
  h : @shared.Hexagram,
  open_ci : Bool,
  open_xiang : Array[Bool],
  emit : @cmd.Emit[Msg],
) -> Html {
  let tri_txt = if h.上卦.名 == h.下卦.名 {
    "\{h.上卦.名}卦（\{h.上卦.象}）"
  } else {
    "上\{h.上卦.名}下\{h.下卦.名}"
  }
  let kids : Array[Html] = [
    div(attrs=@styles.att(@styles.div_m_gua_name()), h.卦名),
    div(
      attrs=@styles.att(@styles.div_m_gua_sub()),
      "\{gua_symbol(h.序号)}　\{h.象名} · 第\{h.序号}卦 · \{h.经}",
    ),
    div(attrs=@styles.att(@styles.div_m_tags()), [
      span(attrs=@styles.att(@styles.div_m_tags_span_m_tag()), tri_txt),
      span(attrs=@styles.att(@styles.div_m_tags_span_m_tag()), h.卦画),
      span(attrs=@styles.att(@styles.div_m_tags_span_m_tag()), h.卷),
    ]),
  ]
  match h.卦辞 {
    Some(b) =>
      kids.push(text_sec("卦辞", [b], [open_ci], _ => emit(ToggleCiOpen)))
    None => ()
  }
  match h.大象 {
    Some(blocks) =>
      kids.push(
        text_sec("大象", blocks, open_xiang, i => emit(ToggleXiangOpen(i))),
      )
    None => ()
  }
  // ⚠️ 侧栏**不再用 `aside_m_side()`**：那个样式是 `.m-side { position: sticky; top: 70px }`
  //    退化的产物（只剩 `top: 70px`），而 RN 里没有 sticky —— 只留 `top` 会变成相对定位、
  //    **把侧栏往下挪 70px 压住下一栏**（见 detail_view 里那段）。这里给网格列宽本身（250px）。
  aside(
    attrs=@styles.att(@style.Style::new().width(@style.px(250.0)).flex_shrink(0.0)),
    kids,
  )
}

///|
/// 详情页（极简版）：上 左卦名/卦辞/大象 · 中 大爻线+爻辞 · 下 彖辞等综合区
fn detail_view(
  h : @shared.Hexagram,
  data : @shared.ReaderData,
  model : Model,
  emit : @cmd.Emit[Msg],
) -> Html {
  // ── 窄屏断点（原 CSS 的 `@media (max-width: 760px)`）─────────────────────────
  //
  // ⚠️ 这一句在**第十轮是写不出来的**：`model.vp_w` 从 `@sub.on_resize` 来，而它
  // **刻意不补发初始值** ⇒ 不转屏 / 不拖窗口就恒为 0 ⇒ 拿它做布局判断等于**永不生效**
  // （那一轮实测：`layoutStyle` 里压根没有那个分支）。于是当时改成**结构性**表达
  // （`flex_wrap` + `min_width`，见下面的布局容器）。
  // **第十一轮库侧补了 `@sub.current_viewport()`**（读一次，两端语义一致），
  // 所以这里可以把原 CSS 在窄屏下真正改过的那几件（爻线 32→27、宽度 160→120）按原样做出来。
  // 保留 `flex_wrap` 那条兜底：窗口被拖到极窄时它仍然保证不重叠。
  let narrow = model.vp_w > 0.0 && model.vp_w < 760.0
  let rows : Array[Html] = []
  // 错/综/互 预览：与目标卦不同的爻位标金线
  //
  // 原 CSS 是 `.m-layout { display: grid; grid-template-columns: 250px 1fr }` +
  // `@media (max-width: 760px) { grid-template-columns: 1fr }`。迁移时两件事都没表达出来：
  //   ① `display: grid` → RN 里没有，转换器只留下了 `gap` 与 `align-items`
  //      ⇒ 容器是 RN 的**默认方向 column**（竖着堆），而**侧栏的 `.m-side { position: sticky;
  //      top: 70px }` 退化成了 `position: relative; top: 70px`** —— 相对定位只挪**画**的位置、
  //      不占布局位置，于是侧栏**下移 70px 压到了下一栏上**；
  //      实测：大象那一行的中心点上 `elementsFromPoint` 拿到的是下一栏那句提示
  //      ⇒ **大象点不开**（十轮实测，先按"少媒体查询"猜，量了矩形才看清真因是 sticky 退化）。
  //   ② 媒体查询没法表达 —— 但这里**不需要**知道窗口宽度：两栏 + `flex_wrap: Wrap` +
  //      右栏 `min_width(320)` ⇒ 放得下就并排、放不下就自动换行成单栏，
  //      效果与原断点一致（757px 时换行，和原来的 760px 断点几乎同一条线）。
  //      ★ 为什么不去读 `model.vp_w`（它有，而且罗盘用得上）：`@sub.on_resize` **刻意不补发初始值**
  //      （"与 DOM 一致"），不转屏 / 不拖窗口它**恒为 0** —— 拿它做布局判断等于永不生效。
  //      库侧缺一个"读当前视口"的能力，见 FINDINGS。
  let rows : Array[Html] = []
  // 错/综/互 预览：与目标卦不同的爻位标金线
  let diff : Array[Bool] = [false, false, false, false, false, false]
  match model.preview {
    Some(n) =>
      match @shared.hexagram_by_number(data, n) {
        Some(g) =>
          for i in 0..<6 {
            diff[i] = g.卦画[i:i + 1] != h.卦画[i:i + 1]
          }
        None => ()
      }
    None => ()
  }
  let mut i = 5
  while i >= 0 {
    let y = h.六爻[i]
    let yang = h.卦画[i:i + 1].to_owned() == "1"
    rows.push(
      yao_view(
        y,
        yang,
        model.bian[i],
        diff[i],
        model.open_yao[i],
        model.open_xiaoxiang[i],
        narrow,
        emit,
      ),
    )
    i = i - 1
  }
  div(class="m-detail", [
    div(attrs=@styles.att(@styles.div_m_detail_div_m_top()), [
      button(attrs=@styles.att(@styles.div_m_detail_div_m_top_button_m_nav()), on_click=emit(Back), "‹ 六十四卦"),
      div(attrs=@styles.att(@styles.div_m_detail_div_m_top_div_m_crumb()), [
        span(h.卦名),
        span(
          attrs=@styles.att(@styles.div_m_detail_div_m_top_div_m_crumb_span_m_crumb_sub()),
          "\{gua_symbol(h.序号)} \{h.象名} · 第\{h.序号}卦 · \{h.经}",
        ),
      ]),
      button(attrs=@styles.att(@styles.div_m_detail_div_m_top_button_m_nav()), on_click=emit(Prev), "‹ 上一卦"),
      button(attrs=@styles.att(@styles.div_m_detail_div_m_top_button_m_nav()), on_click=emit(Next), "下一卦 ›"),
    ]),
    div(
      attrs=@styles.att(
        @styles.div_m_detail_div_m_layout().flex_direction(@style.FlexDirection::Row).flex_wrap(
          @style.FlexWrap::Wrap,
        ),
      ),
      [
        side_view(h, model.open_ci, model.open_xiang, emit),
        div(
          attrs=@styles.att(
            @styles.div_m_detail_div_m_layout_div_m_lines().flex(1.0).min_width(@style.px(320.0)),
          ),
          [
          p(
            attrs=@styles.att(@styles.div_m_detail_div_m_layout_div_m_lines_p_m_hint()),
            "点击爻线标记变爻（阳→老阳 ○，阴→老阴 ×）；点击文本展开/折叠注疏",
          ),
        div(class="m-yaos", rows),
          div(
            attrs=@styles.att(@styles.div_m_detail_div_m_layout_div_m_lines_div_m_rels()),
            relation_links(h, data, model.bian, model.preview, emit),
          ),
        ]),
      ],
    ),
    more_view(h, model.open_tuan, model.open_more, emit),
  ])
}

///|
/// 顶层视图
fn view(model : Model, emit : @cmd.Emit[Msg]) -> Html {
  match model.error {
    Some(e) => div(attrs=@styles.att(@styles.div_error()), "加载失败：\{e}")
    None => {
      let content = match model.page {
        ListPage => list_view(model, emit)
        Detail(n) =>
          match model.data {
            Some(data) => {
              let h = data.hexagrams[n - 1]
              detail_view(h, data, model, emit)
            }
            None => div(attrs=@styles.att(@styles.div_loading()), "載入中…")
          }
      }
      // ⚠️ 根容器这两层是**真机判据抓出来的**（web 上永远看不见 —— DOM 自己会滚、
      //    `body` 样式也自带，所以这两条在浏览器里"看起来是对的"）：
      //   ① `page()`（源 CSS 里的 `body`/`html`）：`#efe5d0` 纸色底 + 衬线族 + 行高。
      //      迁移生成器**给它单独立了函数**，却没人把它挂到任何元素上（生成物的根 `div` 是裸的）
      //      —— 于是"页面底色"只剩各区块自己的背景色在撑。
      //   ② `"scroll"` 伪标签 → RN 的 `ScrollView`：HTML 靠 `overflow` 做**文档级滚动**，
      //      而 RN 的 `View` **不滚动**。不套它，手机上详情页过了第一屏就**再也够不着**
      //      （文言 / 传文关联 / 卦主·总论 全在下面）—— 实测：滚 30 次、界面纹丝不动。
      //   根还要 `flex(1)`：`ScrollView` 的 `flex:1` 得有**确定的父高**才量得出视口，
      //   父级是 auto 高时它会被量成 0（RN 的 flex 语义，不是 CSS 里 `flex-grow` 在块级
      //   上下文里无效那回事）。web 上这两条都不改变观感。
      div(attrs=@styles.att(@styles.page().flex(1.0)), [
        @html.node(
          "scroll",
          @styles.att(@style.Style::new().flex(1.0)),
          [
            div(attrs=@styles.att(@styles.div_div_topnav()), [
              button(attrs=@styles.att(@styles.div_div_topnav_button_brand()), on_click=emit(Back), "御纂周易折中"),
              div(attrs=@styles.att(@styles.div_div_topnav_div_sub()), "康熙御定 · 折中程朱"),
              div(attrs=@styles.att(@styles.div_div_topnav_div_search()), [
                input(
                  input_type=Text,
                  value=model.query,
                  placeholder="搜索卦名 / 象名",
                  on_input=t => emit(Search(t)),
                ),
              ]),
            ]),
            div(attrs=@styles.att(@styles.div_div_container()), content),
            div(attrs=@styles.att(@styles.div_div_footer()), [
              div(attrs=@styles.att(@styles.div_div_footer_div_seal()), "誠正貞"),
              div("岁次丙午 · 御纂周易折中 精编套装全三册"),
            ]),
          ],
        ),
      ])
    }
  }
}

///|
/// 订阅：**视口尺寸**。
///
/// 为什么它进了模型：画布边长按窗口宽度算（原来这条是 CSS `min(94vw,720px)`），
/// 而边长又决定手势坐标到画布坐标的换算 —— 所以"窗口多宽"是这个应用**必须知道**的事实，
/// 不能像原来那样交给 CSS。走的是库的既有通道 `@sub.on_resize`（平台替代物在
/// `MOBILE_HOST.native.geometry`，web 上回退 DOM）。
fn subscriptions(_model : Model, emit : @cmd.Emit[Msg]) -> @sub.Sub {
  // ⚠️ 同上：`Viewport` 载荷（本应用自己的 `Viewport(Int, Int)`）收的是整数像素。
  @sub.on_resize(v => emit(Viewport(v.width.to_int(), v.height.to_int())))
}

///|
/// 应用交给宿主的全部东西（迁移生成：原来的 `app()` + `fn main` 合成这一个导出）。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers_with_init(
    init=init_app, update~,
    view~, subscriptions~,
  )
}




///|
/// 迁移期的诊断出口：把错误送进浏览器 / 原生控制台（`console.error`）。
///
/// 为什么要有它：迁移前的失败路径只 `emit(DataFailed)`，界面上一句"无法加载数据"
/// 什么都说明不了 —— 实测为这一句卡掉整整一轮（网络面板里明明是 200）。
extern "js" fn debug_error(msg : String) -> Unit =
  #| (m) => { try { console.error("[zhouyi-reader] " + m) } catch (_) {} }

///|
/// 正常路径的日志（不是错误）—— 验证脚本靠它确认"数据真的进了应用"。
extern "js" fn debug_log(msg : String) -> Unit =
  #| (m) => { try { console.log("[zhouyi-reader] " + m) } catch (_) {} }
