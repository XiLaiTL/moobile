///|
/// # node-spike —— 「节点寻址」的试金石
///
/// ## 它要回答的问题（只有四个）
///
/// | # | 问什么 | 为什么必须真浏览器 |
/// |---|---|---|
/// | ① | `Attrs::id("sec-3")` 真的落到 DOM 的 `id` 上了吗？ | 这是整条通道的**地基**：RNW 有严格的 props 白名单，属性被丢掉是**静默**的 |
/// | ② | `@sub.scroll_to_node("sec-3")` 真的把那一节**滚到容器上沿**了吗？ | 语义是「顶到容器上沿」，不是「scrollTop 大于 0」—— 后者在容器滚错元素时也成立 |
/// | ③ | `@sub.node_rect("sec-3")` 的数与浏览器自己量的**对不对得上**？ | 库量的是自己找的那个节点；**找错节点**会表现成"高亮总是偏一节" |
/// | ④ | `@nav.scroll_to("sec-3")`（**fork 里已有的那个**）到底有没有用？ | **第一跑就否掉了我的预判**：我原以为它走的是没有实现的那条 op 路（route-spike 量到 `@nav.push_url` 是静默 no-op），实测它**真的滚了**（scrollTop 0 → 1000）。真因：`@nav` 里**滚**那几个 op 是库侧自己实现的（`AfterLayout` + DOM），**`push` / `load` 那几个才没有实现**。这一格留着当"别把两件事混成一句"的常设对照 |
///
/// ## 这个应用**刻意只做三件事**
///
/// 1. 画一个**自己滚**的容器（`id="pane"`）+ 三个各 500px 高的具名小节；
/// 2. 每个动作都挂在一个**具名按钮**上（`id="go-3"` 这种），由**外部驱动脚本**
///    `drive.mjs` 用 **CDP 真鼠标**点 —— 应用自己不调、也不猜；
/// 3. 把每次动作的读数渲染成**一行可抠的文字**（`RECT …` / `SCROLLTOP …`）。
///
/// 为什么不把动作写进应用内部定时器里（route-spike 那种做法）：这里验的是"**点了之后
/// 真的滚了没有**"，动作必须来自外面，读数才干净；而且真鼠标能顺带证明"这句文案所在的
/// 可点元素真的可点"。
///
/// ⚠️ 本文件 import 了 `@nav`（`XiLaiTL/moobile/vendor/rabbita/nav`）**只为了那格对照**：
///    根上**没有** `nav/` 转发包，消费者 import 不到它 —— 这本身就是"别指望它"的理由之一。

///|
/// 三个小节的 id（与 `view` 里写下的、以及驱动脚本里读的**同一串**）。
/// ⚠️ 这里**不能用 `const`**：`Array[String]` 不是合法常量类型
///（常量只允许不可变基本类型 —— 2026-10-07 实测报 "Array[String] is not a valid constant type"）。
///| 外链的地址（试金石用一条固定的：驱动脚本断言"记录器收到的就是这一条"）。
const EXT_URL : String = "https://example.com/moobile-ext-link"

///| 试金石用的图片：**内联的 data: URI**（2×2 的红点 PNG，base64）。
/// 用内联而不是外部文件：判据不依赖任何外部资源，且它**真的能被解码**（驱动读 `naturalWidth`）。
const PIC_DATA : String = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQ0AAB0jAgHnPmcSAAAAAElFTkSuQmCC"

///|
fn sections() -> Array[String] {
  ["sec-1", "sec-2", "sec-3"]
}

///|
priv struct Model {
  /// `@sub.scroll_to_node` 调了几次
  n_scroll : Int
  /// `@nav.scroll_to`（对照那格）调了几次
  n_nav : Int
  /// `@sub.node_rect` 调了几次
  n_measure : Int
  /// `@sub.node_scroll_top` 调了几次
  n_top : Int
  /// 最近一次测量的读数行（驱动脚本抠这行，与它自己量的值对账）
  rect : String
  /// 最近一次「量哪个节点」的名字（防止把"量了但量错节点"读成"量对了"）
  rect_node : String
  /// 最近一次滚动位置读数
  top : String
  /// `on_node_scroll` 收到几次（**订阅**读数）
  n_sub : Int
  /// 最近一次订阅推上来的 scrollTop
  sub_last : String
  /// **装载后补的那一次**（"首帧就有值"那条账的落点）：只记第一次，之后不再改
  sub_boot : String
  /// 一句人类可读的现场说明（动作走到哪一步了）
  note : String
} derive(Eq)

///|
priv enum Msg {
  /// 点「GO-n」：走**新**通道 `@sub.scroll_to_node`
  Go(String)
  /// 点「GO-NAV-n」：走**fork 里已有的** `@nav.scroll_to`（对照）
  GoNav(String)
  /// 点「MEASURE-n」：`@sub.node_rect`
  Measure(String)
  /// 周期读一次 `/pane` 的滚动位置（也能被按钮触发）
  ReadTop
  /// 点「READ-TOP」
  ReadTopNow
  /// **订阅**推上来的一次滚动（`@sub.on_node_scroll("pane", …)`，载荷 = 当前 scrollTop）
  ScrollEv(Double)
  /// 点「OPEN-EXT」：走 `@sub.open_url`（**动作型**：外链开新窗口）。
  /// ⚠️ 站点那边今天**内容里没有外链** ⇒ 这条分支在站点上**没有端到端读数**，
  ///    所以它的读数落在这个试金石上（驱动脚本把 `window.open` 换成记录器）。
  OpenExt
}

///|
fn initial() -> Model {
  {
    n_scroll: 0,
    n_nav: 0,
    n_measure: 0,
    n_top: 0,
    rect: "-",
    rect_node: "-",
    top: "-",
    n_sub: 0,
    sub_last: "-",
    // ⚠️ "还没收到" 与 "收到了 0" 必须分得开：这一格用 `-` 表示前者
    sub_boot: "-",
    note: "就绪",
  }
}

///|
/// `Double?` → 一行可读文本（`-` = 问不到）。**不四舍五入**：驱动脚本要拿它与
/// `getBoundingClientRect()` 逐位对账，抹掉精度就等于把容忍度藏起来。
fn num(v : Double?) -> String {
  match v {
    Some(d) => "\{d}"
    None => "-"
  }
}

///|
/// 一次测量的读数行：`RECT <node> x=… y=… w=… h=…`（与驱动脚本抠读的口径绑死）。
fn rect_line(node : String, r : @sub.NodeRect?) -> String {
  match r {
    Some(v) => "RECT \{node} x=\{v.x} y=\{v.y} w=\{v.width} h=\{v.height}"
    None => "RECT \{node} x=- y=- w=- h=-"
  }
}

///|
fn update(m : Model, msg : Msg, _emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  match msg {
    Go(node) => ({ ..m, n_scroll: m.n_scroll + 1, note: "点了 scroll_to_node(\{node})" }, @sub.scroll_to_node(node, block="start"))
    GoNav(node) => ({ ..m, n_nav: m.n_nav + 1, note: "点了 @nav.scroll_to(\{node})（对照：死通道）" }, @nav.scroll_to(node))
    Measure(node) => (
      { ..m, n_measure: m.n_measure + 1, rect: rect_line(node, @sub.node_rect(node)), rect_node: node, note: "量了 \{node}" },
      @cmd.none,
    )
    OpenExt => (m, @sub.open_url(EXT_URL))
    ReadTop => (
      { ..m, n_top: m.n_top + 1, top: num(@sub.node_scroll_top("pane")) },
      @cmd.none,
    )
    ScrollEv(v) =>
      // `sub_boot` 只写第一次 —— 它就是"装载后补的那一次"（首帧就有值）。
      (
        {
          ..m,
          n_sub: m.n_sub + 1,
          sub_last: "\{v}",
          sub_boot: if m.sub_boot == "-" { "\{v}" } else { m.sub_boot },
        },
        @cmd.none,
      )
    ReadTopNow => (
      { ..m, n_top: m.n_top + 1, top: num(@sub.node_scroll_top("pane")), note: "手动读了 /pane 的 scrollTop" },
      @cmd.none,
    )
  }
}

///|
fn attrs(s : @style.Style) -> @html.Attrs {
  @html.Attrs::build().styles(s)
}

///|
/// 一行普通文字。
fn line(s : String, size : Double, color : String) -> @html.Html {
  @html.div(
    attrs=attrs(@style.Style::new().font_size(size).color(color)),
    s,
  )
}

///|
/// 一个**具名**按钮：`id` 是驱动脚本点它的凭据（也就是本试金石要验的那条通道）。
///
/// ⚠️ 必须是 `@html.button`（→ RN 的 `Pressable`），**不能**是挂了 `.on_click` 的 `div` ——
/// 实测（本轮第一次跑就撞上，站点那边早有同一笔账）：`on_click` 在 web 上映射成 **`onPress`**
/// （见 `render.mbt` 的 `default_event_prop`），只有 `Pressable` 接得住；挂在 `div` 上就是
/// **死处理器** —— 点了什么都不发生、也不报错。那正是本试金石最怕的失效形状：
/// 读数全 0，而你分不清"功能没做"与"点击没到"。
fn button(id : String, label : String, msg : Msg, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.button(
    attrs=attrs(
      @style.Style::new()
      .padding(@style.px(6.0))
      .margin_right(@style.px(6.0))
      .background_color("#eee6d8")
      .color("#1a1410")
      .font_size(13.0),
    )
    .id(id),
    on_click=emit(msg),
    label,
  )
}

///|
/// 一个具名小节：**高**是刻意的（500px）——要让容器真的滚得动。
fn section(name : String, label : String, bg : String) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .height(@style.px(500.0))
      .padding(@style.px(12.0))
      .background_color(bg)
      .color("#1a1410")
      .font_size(15.0),
    )
    .id(name),
    label,
  )
}

///|
fn view(m : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  let rows : Array[@html.Html] = []
  rows.push(line("COUNT scroll=\{m.n_scroll}", 14.0, "#1a1410"))
  rows.push(line("COUNT nav=\{m.n_nav}", 14.0, "#1a1410"))
  rows.push(line("COUNT measure=\{m.n_measure}", 14.0, "#1a1410"))
  rows.push(line("COUNT top=\{m.n_top}", 14.0, "#1a1410"))
  rows.push(line(m.rect, 12.0, "#1a1410"))
  rows.push(line("SCROLLTOP \{m.top}", 12.0, "#1a1410"))
  rows.push(line("COUNT sub=\{m.n_sub}", 14.0, "#1a1410"))
  rows.push(line("SUB_LAST \{m.sub_last}", 12.0, "#1a1410"))
  rows.push(line("SUB_BOOT \{m.sub_boot}", 12.0, "#1a1410"))
  rows.push(line("NOTE \{m.note}", 12.0, "#5b4f3f"))
  let navs : Array[@html.Html] = []
  let goes : Array[@html.Html] = []
  let measures : Array[@html.Html] = []
  for name in sections() {
    goes.push(button("go-\{name}", "GO \{name}", Go(name), emit))
    navs.push(button("go-nav-\{name}", "GO-NAV \{name}", GoNav(name), emit))
    measures.push(button("measure-\{name}", "MEASURE \{name}", Measure(name), emit))
  }
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex_direction(@style.FlexDirection::Column)
      .padding(@style.px(12.0))
      .background_color("#fffdf8"),
    ),
    [
      line("node-spike：节点寻址（动作由 drive.mjs 用真鼠标发）", 16.0, "#1a1410"),
      @html.div(attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Row)), goes),
      @html.div(attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Row)), navs),
      @html.div(attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Row)), measures),
      @html.div(
        attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Row)),
        [
          button("read-top", "READ-TOP", ReadTopNow, emit),
          // 外链动作（`@sub.open_url`）：点了应当**调一次 window.open**、载荷是 EXT_URL
          button("open-ext", "OPEN-EXT", OpenExt, emit),
        ],
      ),
      @html.div(attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Column)), rows),
      // ── **图片**（`img → RN Image`）：内容侧写标准 markdown，两端各自落到自己的组件上 ----
      //    src 用 **data: URI**（1×1 的 GIF/PNG）：不引外部资源 ⇒ 判据只依赖产物自己，
      //    而且 `naturalWidth` 能证明"浏览器**真的解码**了它"（不只是一个空的 <img> 壳）。
      line("图片：img → RN 的 Image（src 改写成一个结构化 source）", 13.0, "#5b4f3f"),
      @html.img(
        attrs=attrs(
          @style.Style::new()
          .width(@style.px(24.0))
          .height(@style.px(24.0))
          .margin_bottom(@style.px(8.0)),
        )
        .id("pic-1"),
        src=PIC_DATA,
        alt="一张试金石图",
      ),
      // ── 变换（`Style::transform`）：**顺序敏感**那一条要在浏览器里证 ----
      //    tf-a 与 tf-b 的动作**一样、顺序不同**：先移后缩 ⇒ 位移**不被缩放**；
      //    先缩后移 ⇒ 位移**被缩放**（40 → 80）。两个矩阵必须不同，否则说明顺序被丢了。
      line("CSS transform 的三个读数（矩阵由浏览器算）", 13.0, "#5b4f3f"),
      @html.div(
        attrs=attrs(
          @style.Style::new()
          .height(@style.px(40.0))
          .width(@style.px(200.0))
          .margin_bottom(@style.px(8.0))
          .background_color("#dbe4ff")
          .transform([
            @style.Transform::Translate(40.0, 0.0),
            @style.Transform::Scale(2.0),
          ]),
        )
        .id("tf-a"),
        "",
      ),
      @html.div(
        attrs=attrs(
          @style.Style::new()
          .height(@style.px(40.0))
          .width(@style.px(200.0))
          .margin_bottom(@style.px(8.0))
          .background_color("#ffe3e3")
          .transform([
            @style.Transform::Scale(2.0),
            @style.Transform::Translate(40.0, 0.0),
          ]),
        )
        .id("tf-b"),
        "",
      ),
      @html.div(
        attrs=attrs(
          @style.Style::new()
          .height(@style.px(40.0))
          .width(@style.px(200.0))
          .margin_bottom(@style.px(8.0))
          .background_color("#e6f4ea")
          .transform([@style.Transform::Rotate(90.0)]),
        )
        .id("tf-c"),
        "",
      ),
      // ── 自己滚的容器（id="pane"）：站点正文栏就是这种形状 ----
      @html.div(
        attrs=attrs(
          @style.Style::new()
          .height(@style.px(320.0))
          .overflow(@style.Overflow::Scroll)
          .background_color("#f6f3ec"),
        )
        .id("pane"),
        [
          section("sec-1", "第一节 · SEC-1（500px 高）", "#fdf6e3"),
          section("sec-2", "第二节 · SEC-2（500px 高）", "#eef6f0"),
          section("sec-3", "第三节 · SEC-3（500px 高）", "#f3eefb"),
        ],
      ),
    ],
  )
}

///|
/// 每 400ms 读一次 `/pane` 的滚动位置 —— 驱动脚本据此看"滚了没有"，
/// 也顺带是 `node_scroll_top` 的**重复读数**（老读数按值得留着）。
fn subscriptions(_m : Model, emit : @cmd.Emit[Msg]) -> @sub.Sub {
  @sub.batch([
    // 每 400ms 读一次 `/pane` 的滚动位置（**一次性读**那条通道）
    @sub.every(400, emit(ReadTop)),
    // **订阅**那条通道（本轮新加）：载荷 = 那个节点当前的 scrollTop。
    // ⚠️ 装载时会**先补一次**（订阅只报"变化"，而滚动事件不会在挂载时补发）——
    //    所以 `SUB_BOOT` 那一格**不用等任何人滚**就该有值。
    @sub.on_node_scroll("pane", v => emit(ScrollEv(v))),
  ])
}

///|
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~, subscriptions~)
}
