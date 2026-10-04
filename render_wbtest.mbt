///|
/// **判据：`entries_to_styles` 不许按名字过滤键。**
///
/// 为什么值得一条测试（2026-10-23 实测）：这个函数里曾经内嵌一张 **5 键**白名单
/// （`fontFamily` / `fontSize` / `lineHeight` / `letterSpacing` / `color`），
/// 而它的**调用方已经用 `is_text_key` 筛过一遍**了 —— 而 `is_text_key` 认 **9** 个键。
/// 于是 `fontWeight` / `fontStyle` / `textAlign` / `textTransform` 这 4 个键
/// 安静地掉进 `_ =>` 兜底分支（返回空 `Style`）。
///
/// 这一层的失败模式**看不见**：不报错、不崩、判据全绿，只是"样式没生效"。
///
/// 这条判据证明的是"**键被丢掉了**"（下面断言的就是这个），**不是**"页面看上去不对"。
/// 两者的差别要写清，别混成一句（本仓库的规矩：没量过的别写成结论）：
///   · **原生 RN** —— `View` 上根本没有 `fontWeight` / `textAlign` 这些文字属性，
///     `TextRef.near` 这条通道**就是**为"把它们送到 `Text` 上"而存在的；
///     它丢键 ⇒ 叶子文字拿不到 ⇒ 真机上必然少这一层效果（`div.error` 的 `.text_align(Center)`、
///     `div.m-gua-name` 的 `.font_weight(W700)`；见 `examples/apps/zhouyi-reader` 的
///     `styles.mbt:380` / `main.mbt:2100`，以及 `styles.mbt` 里 20 处这类键）。
///   · **web（react-native-web）** —— `text-align` / `font-weight` 在 CSS 里**会继承**，
///     所以父 `div` 上写的那条有可能把叶子兜住，观感上看不出来。
///     ★ 也就是说这一类洞**天然是"web 绿、真机红"** —— 而当前 103 条应用判据全是在
///       web 上跑的，所以它绿着。真机上的可见程度**尚未量过**（要一条"量叶子文字
///       计算样式"的真机判据才能钉死）。
///
/// 断言到"**逐个键都在**"这一层，才拦得住"静默丢键"这类 bug
/// （只断言"样式表非空"是拦不住的：丢 4 个键之后它依然非空）。
test "entries_to_styles：is_text_key 认下的每一个键都必须原样还原" {
  let all : Array[(String, @style.StyleValue)] = [
    ("fontFamily", @style.StyleValue::Str("Charter")),
    ("fontSize", @style.StyleValue::Px(13.0)),
    ("fontWeight", @style.StyleValue::Str("700")),
    ("fontStyle", @style.StyleValue::Str("italic")),
    ("lineHeight", @style.StyleValue::Em(1.65)),
    ("letterSpacing", @style.StyleValue::Em(0.1)),
    ("color", @style.StyleValue::Str("#2a1f17")),
    ("textAlign", @style.StyleValue::Str("center")),
    ("textTransform", @style.StyleValue::Str("uppercase")),
  ]
  let kept = all.filter(e => is_text_key(e.0))
  // 前提自查：这张夹具必须**恰好**覆盖 `is_text_key` 认的全部 9 个键。
  // （否则将来有人往 `is_text_key` 里加键，这条判据会悄悄变松。）
  assert_eq(kept.length(), 9)
  let out = entries_to_styles(kept)
  let missing : Array[String] = []
  for e in kept {
    if out.get(e.0) is None {
      missing.push(e.0)
    }
  }
  if missing.length() > 0 {
    fail(
      "entries_to_styles 丢了 \{missing.length()} 个键（第一个是 \{missing[0]}）—— 它不该认识名字，只该做类型还原",
    )
  }
}

///|
/// 同上，但走**真正的那条路**：`set_text_style` 收的是应用级默认样式
/// （源 CSS 的 `body`/`html`）。它内部同样过一遍 `entries_to_styles`。
test "set_text_style：应用默认里的 fontWeight/textAlign 也要活下来" {
  let page = @style.Style::new()
    .font_family("Charter")
    .font_size(15.0)
    .font_weight(@style.FontWeight::W700)
    .text_align(@style.TextAlign::Center)
  set_text_style_of(page)
  let app = match g_text.app {
    Some(s) => s
    None => {
      fail("page() 里有字体键，g_text.app 不该是 None")
      return
    }
  }
  let missing : Array[String] = []
  for k in ["fontFamily", "fontSize", "fontWeight", "textAlign"] {
    if app.get(k) is None {
      missing.push(k)
    }
  }
  g_text.app = None
  if missing.length() > 0 {
    fail("应用级默认样式在 set_text_style 里丢了 \{missing.length()} 个键（第一个是 \{missing[0]}）")
  }
}

///|
/// **判据：`Style::press` 只给**它前面**的键加前缀（库这一侧的语义）。**
///
/// 为什么这条留在 MoonBit 里：它断言的是**库自己的行为**（`style/style.mbt` 的
/// `Style::press`），而**不是**生成器的行为 —— 判据要放在它真正断言的那一层。
///
/// 生成器那一半（"三段排的先后对不对"）已经挪到 **`tools/press_order_check.mjs`**
/// （那条门拿真的 `emitModule` 跑夹具、自带两组证伪，且不依赖仓库外的源项目）。
/// 2026-10-23 第十八轮曾经把生成器的产出**手抄**成一条 MoonBit 判据
/// （`.background_color("#111").press().background_color("#f00")`，然后断言常态该是 `#111`）——
/// 那条断言的是**生成器**的形状，却写在这一层，于是生成器修好之后它**只会一直红**，
/// 变成一条说谎的判据。所以它被**删掉并移到生成器侧**，而不是"改到它能过"。
///
/// 顺序为什么必须是这样（`Style::press` 的语义：只给**它前面**的键加前缀）：
///   ① 源 CSS 的 `:hover` 写在最前 ⇒ 被前缀 ⇒ 成为按下态 ✅
///   ② 源 CSS 的常态写在最后     ⇒ 不被前缀 ⇒ 仍是常态 ✅
/// 顺带这一条也把 grid 子项的 `min_width` 保住了（它是常态调用，落在最后 ⇒ 常态生效）——
/// 这是"网格只在按住时才是网格"那条洞的直接防线。
test "Style::press：只给它前面的键加前缀（hover 在前、.press() 居中、常态在后）" {
  let s = @style.Style::new()
    // ① 源 CSS 的 `:hover` 声明
    .border_color("#8a2518")
    // ② 分界线
    .press()
    // ③ 源 CSS 的常态声明（button.bagua-mode 的真实形状）
    .padding_horizontal(@style.px(16.0))
    .background_color("#e6d8bc")
    .border_color("#d9c69f")
    .font_size(13.0)
    .min_width(@style.px(116.0))
  let plain : Array[String] = []
  let pressed : Array[String] = []
  for e in s.entries() {
    (if e.0.has_prefix(@style.press_prefix) { pressed } else { plain }).push(e.0)
  }
  // 常态：四种键都在，且**不含** hover 那条
  assert_eq(plain.length(), 5)
  assert_eq(pressed.length(), 1)
  assert_eq(pressed[0], "press:borderColor")
  // 常态里必须有网格列宽 —— 这是 2026-10-23 那次"网格塌成单列"的直接防线
  let mut has_min_width = false
  for k in plain {
    if k == "minWidth" {
      has_min_width = true
    }
  }
  if !has_min_width {
    fail("minWidth 不在常态里 —— 网格列宽又变成\"只在按住时生效\"了")
  }
}

///|
/// **判据：`apply_key` 也不许按名字过滤键。**
///
/// 为什么单独一条 —— 这是**同一个 bug 的第二道闸门**，而且它很容易被漏掉：
/// 只把 `entries_to_styles` 修好，`g_text.app` 里就**有** `fontWeight` 了，
/// 但裸文本最后还要过 `make_text` 里那段"用应用默认补 `near` 没写的键"的回环，
/// 而它调的是 `apply_key` —— 那里有一张**一模一样的 5 键白名单副本**，
/// 于是键在最后一米又被丢掉。两道闸门必须一起修，否则"看起来修好了、其实没生效"。
test "apply_key：补应用默认时也不许丢键" {
  let dst = @vdom.Styles::empty()
  apply_key(dst, "fontWeight", @style.StyleValue::Str("700"))
  apply_key(dst, "textAlign", @style.StyleValue::Str("center"))
  apply_key(dst, "fontFamily", @style.StyleValue::Str("Charter"))
  let missing : Array[String] = []
  for k in ["fontWeight", "textAlign", "fontFamily"] {
    if dst.get(k) is None {
      missing.push(k)
    }
  }
  if missing.length() > 0 {
    fail("apply_key 丢了 \{missing.length()} 个键（第一个是 \{missing[0]}）—— 白名单在最后一米又把键吃掉了")
  }
}
