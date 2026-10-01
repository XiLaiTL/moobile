///|
/// canvas 包的白盒测试。
///
/// 压三件事，**都不是"跑通就算"**：
///
/// 1. **载荷 JSON 逐字**：对面是 JS 的 `JSON.parse`，所以格式是**契约**不是实现细节。
/// 2. **数字与转义的边界**（整数值不写小数点、`-0` 归零、引号/反斜杠/控制字符）。
/// 3. **节点形状**：标签名与 `ops` prop 必须真的落在 VNode 上 —— 光有编码器不算接线。

///|
/// 一条 op 的 JSON 逐字断言（把"契约"写在测试里，而不是只写在注释里）。
test "payload: 18 条 op 的 JSON 逐字" {
  assert_eq(ops_to_json([BeginPath]), "[[\"begin_path\"]]")
  assert_eq(ops_to_json([MoveTo(1.0, 2.0)]), "[[\"move_to\",1,2]]")
  assert_eq(ops_to_json([LineTo(3.0, 4.0)]), "[[\"line_to\",3,4]]")
  assert_eq(
    ops_to_json([Arc(5.0, 6.0, 7.0, 0.5, 1.5, false)]),
    "[[\"arc\",5,6,7,0.5,1.5,false]]",
  )
  assert_eq(
    ops_to_json([Arc(5.0, 6.0, 7.0, 0.5, 1.5, true)]),
    "[[\"arc\",5,6,7,0.5,1.5,true]]",
  )
  assert_eq(ops_to_json([ClosePath]), "[[\"close_path\"]]")
  assert_eq(ops_to_json([FillRect(0.0, 0.0, 720.0, 720.0)]), "[[\"fill_rect\",0,0,720,720]]")
  assert_eq(ops_to_json([Fill]), "[[\"fill\"]]")
  assert_eq(ops_to_json([Stroke]), "[[\"stroke\"]]")
  assert_eq(ops_to_json([SetLineWidth(1.5)]), "[[\"set_line_width\",1.5]]")
  assert_eq(ops_to_json([SetFillStyle("#fdfaf0")]), "[[\"set_fill_style\",\"#fdfaf0\"]]")
  assert_eq(ops_to_json([SetStrokeStyle("#b8902f")]), "[[\"set_stroke_style\",\"#b8902f\"]]")
  assert_eq(ops_to_json([SetFont("12px serif")]), "[[\"set_font\",\"12px serif\"]]")
  assert_eq(ops_to_json([FillText("乾", -5.0, 4.0)]), "[[\"fill_text\",\"乾\",-5,4]]")
  assert_eq(ops_to_json([Save]), "[[\"save\"]]")
  assert_eq(ops_to_json([Restore]), "[[\"restore\"]]")
  assert_eq(ops_to_json([Translate(10.0, 20.0)]), "[[\"translate\",10,20]]")
  assert_eq(ops_to_json([Rotate(1.5)]), "[[\"rotate\",1.5]]")
  assert_eq(ops_to_json([Scale(2.0, 3.0)]), "[[\"scale\",2,3]]")
}

///|
/// 词汇表恰好 18 条 —— 与 yi 实测的 18 个 canvas 调用一一对应。
/// 多一条意味着我们凭空发明了 canvas 没有的语义；少一条意味着迁移时会缺东西。
///
/// 断言的是**整段 JSON 逐字**（而不是"数一数 tag 出现几次"）：
/// 逐字相等同时锁住了**顺序**与**每个 tag 只出现一次**，而且不需要字符串搜索 API。
test "payload: 词汇表 18 条（整段 JSON 逐字）" {
  let all : Array[DrawOp] = [
    BeginPath,
    MoveTo(0.0, 0.0),
    LineTo(0.0, 0.0),
    Arc(0.0, 0.0, 0.0, 0.0, 0.0, false),
    ClosePath,
    FillRect(0.0, 0.0, 0.0, 0.0),
    Fill,
    Stroke,
    SetLineWidth(0.0),
    SetFillStyle(""),
    SetStrokeStyle(""),
    SetFont(""),
    FillText("", 0.0, 0.0),
    Save,
    Restore,
    Translate(0.0, 0.0),
    Rotate(0.0),
    Scale(0.0, 0.0),
  ]
  assert_eq(all.length(), 18)
  assert_eq(
    ops_to_json(all),
    "[[\"begin_path\"],[\"move_to\",0,0],[\"line_to\",0,0],[\"arc\",0,0,0,0,0,false]," +
    "[\"close_path\"],[\"fill_rect\",0,0,0,0],[\"fill\"],[\"stroke\"],[\"set_line_width\",0]," +
    "[\"set_fill_style\",\"\"],[\"set_stroke_style\",\"\"],[\"set_font\",\"\"]," +
    "[\"fill_text\",\"\",0,0],[\"save\"],[\"restore\"],[\"translate\",0,0],[\"rotate\",0]," +
    "[\"scale\",0,0]]",
  )
}

///|
/// 数字的**跨语言契约**（三条都写进测试，因为它们在对面（JS）是另一套实现）。
test "payload: 数字格式的三条契约" {
  // ① 整数值不写小数点 —— 与 JS 的 JSON.stringify(360) 一致
  assert_eq(ops_to_json([MoveTo(360.0, 720.0)]), "[[\"move_to\",360,720]]")
  // ② -0.0 归零（JSON 里 -0 合法但两边写法容易不一致）
  assert_eq(ops_to_json([MoveTo(-0.0, 0.0)]), "[[\"move_to\",0,0]]")
  // ③ 小数字段保持小数
  assert_eq(ops_to_json([SetLineWidth(0.4)]), "[[\"set_line_width\",0.4]]")
  assert_eq(ops_to_json([Rotate(-1.25)]), "[[\"rotate\",-1.25]]")
}

///|
/// ⚠️ **未测**：非有限值（NaN / Infinity）会 `abort`。
/// MoonBit 这边没有"断言某个调用会 panic"的设施（`moon ide doc "assert_panic"` 查不到），
/// 所以这条只记在文档里，**别当已验**。
test "payload: 字符串转义（引号 / 反斜杠 / 换行）" {
  assert_eq(ops_to_json([SetFont("a\"b")]), "[[\"set_font\",\"a\\\"b\"]]")
  assert_eq(ops_to_json([SetFont("a\\b")]), "[[\"set_font\",\"a\\\\b\"]]")
  assert_eq(ops_to_json([FillText("a\nb", 0.0, 0.0)]), "[[\"fill_text\",\"a\\nb\",0,0]]")
}

///|
/// 收集器：18 个方法一条不落，且 `take()` 真的取走（清空）。
test "OpCtx: 18 个方法各记一条，take 后清空" {
  let ctx = OpCtx::new()
  ctx.begin_path()
  ctx.move_to(1.0, 2.0)
  ctx.line_to(3.0, 4.0)
  ctx.arc(0.0, 0.0, 5.0, 0.0, 1.0)
  ctx.close_path()
  ctx.fill_rect(0.0, 0.0, 1.0, 1.0)
  ctx.fill()
  ctx.stroke()
  ctx.set_line_width(1.0)
  ctx.set_fill_style("#000")
  ctx.set_stroke_style("#fff")
  ctx.set_font("10px serif")
  ctx.fill_text("x", 0.0, 0.0)
  ctx.save()
  ctx.restore()
  ctx.translate(1.0, 1.0)
  ctx.rotate(0.5)
  ctx.scale(2.0, 2.0)
  assert_eq(ctx.len(), 18)
  let taken = ctx.take()
  assert_eq(taken.length(), 18)
  assert_eq(ctx.len(), 0)
  assert_eq(taken[3], Arc(0.0, 0.0, 5.0, 0.0, 1.0, false))
}

///|
/// `arc` 的 `anticlockwise` 默认值与 DOM 一致（`false`）——
/// 罗盘的内弧显式传 `true`，外弧不传；默认值错了会让整个扇区翻面。
test "OpCtx: arc 的 anticlockwise 默认 false" {
  let ctx = OpCtx::new()
  ctx.arc(0.0, 0.0, 1.0, 0.0, 1.0)
  ctx.arc(0.0, 0.0, 1.0, 1.0, 0.0, anticlockwise=true)
  assert_eq(ctx.take(), [
    Arc(0.0, 0.0, 1.0, 0.0, 1.0, false),
    Arc(0.0, 0.0, 1.0, 1.0, 0.0, true),
  ])
}

///|
/// **接线**：`canvas()` 必须真的把载荷挂到一个组件通道标签上。
/// 只测编码器是不够的 —— 标签名写错、prop 名写错、忘了 `prop_json`，
/// 编码器全都测不出来（而宿主会 fail-fast，离出错的地方已经很远）。
test "node: canvas() 产出 moobile:Canvas，且 ops 与编码器逐字一致" {
  let ops : Array[DrawOp] = [FillRect(0.0, 0.0, 8.0, 8.0), Fill]
  match canvas(ops, 720.0, 240.0).to_virtual_dom() {
    @vdom.Elem(tag, props, _, ..) => {
      assert_eq(tag, canvas_tag)
      let m = props.props_map()
      match m.get(ops_prop) {
        Some(@variant.String(s)) => assert_eq(s, ops_to_json(ops))
        _ => fail("`\{ops_prop}` 应该是 JSON 字符串（`prop_json` 的契约）")
      }
      // 尺寸走数字通道（不是字符串）—— 宿主直接拿去当 style
      match m.get("width") {
        Some(@variant.Floating(w)) => assert_eq(w, 720.0)
        _ => fail("`width` 应该是数字")
      }
      match m.get("height") {
        Some(@variant.Floating(h)) => assert_eq(h, 240.0)
        _ => fail("`height` 应该是数字")
      }
    }
    _ => fail("canvas() 应该产出一个 Elem 节点")
  }
}
