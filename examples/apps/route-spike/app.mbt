///|
/// # route-spike —— **路由地基**的试金石（三条订阅在现役宿主上到底推不推值）
///
/// ## 它要回答的问题（只有这三个）
///
/// | 通道 | 问什么 |
/// |---|---|
/// | `@sub.on_url_changed` | 真浏览器里**什么动作**能让它推值（`pushState` / 改 hash / 返回键）？载荷长什么样？**首屏**推不推？ |
/// | `@sub.on_url_request` | 它在 web 上**有没有人调**？（它靠"宿主注入器"，而注入器要有人 `inject_url_request`） |
/// | `@sub.on_visibility_change` | DOM 的 `visibilitychange` 接上了没有？载荷方向对不对（`true` = 隐藏）？ |
///
/// ## 这个应用**刻意只做两件事**
///
/// 1. **订**三条通道，把每一次收到的都**记成一行可见文字**（读数从 DOM 里抠，不靠肉眼看）；
/// 2. 什么都不**做**（不 push、不拦截）—— 所有动作都由外部驱动脚本（`drive.mjs`）用 CDP 发。
///
/// 为什么不把动作也写进应用里：那样验的就变成"我自己的代码能不能跑"，而不是"通道通不通"。
/// 驱动在外、只订在内 ⇒ 读到的每一条都只能是宿主/浏览器推上来的。
///
/// ⚠️ 本文件**不 import `@url`**（根上没有它的转发包，消费者根本 import 不到）——
/// 于是这里能拿到的载荷只有"方法能调出来的那部分"（`to_string()`）。**这本身是一条读数**：
/// 消费者能对载荷做什么，取决于它能不能命名那个类型。

///|
/// 一条收到的事件。`chan` = 哪个通道，`body` = 载荷的可读形状。
struct Hit {
  chan : String
  body : String
} derive(Eq)

///|
struct Model {
  hits : Array[Hit] // 最新的在前
  n_url : Int
  n_req : Int
  n_vis : Int
  vis_last : String
  /// 「PUSH」按钮被点了几次 —— 用它把"点击没到"与"点了但 push 没生效"分开
  n_push : Int
  /// **首屏那一次同步读**（`@sub.current_url()`）：`on_url_changed` 首屏不推，
  /// 所以"进来时我在哪"只能靠它 —— 这一格就是那条读数的落点。
  boot_url : String
} derive(Eq)

///|
enum Msg {
  /// `on_url_changed` 推上来的 URL
  Url(String)
  /// `on_url_request` 推上来的请求
  Req(String)
  /// `on_visibility_change`：`true` = 隐藏
  Vis(Bool)
  /// 点那个「PUSH（@sub.push_url）」按钮 —— 试的是**应用侧有没有 push 通道**
  /// （2026-10-07 起走的是**库自己新加的动作通道**：`@sub.push_url`，见 DESIGN-ROUTER §6.5）
  Push
  /// 定时器跳一下：**第一跳**走一次动作通道 push（读数不依赖"点得着"——
  /// 这个 spike 里那个按钮在 DOM 上没有 `tabindex="0"`，点不通，见设计稿 §8 的未查实项）
  Tick
}

///|
/// `Option[String]` → 可读文本（`-` = 没有）。载荷的字段名与有无，是路由设计要用的读数。
fn opt(o : String?) -> String {
  match o {
    Some(s) => s
    None => "-"
  }
}

///|
/// 首屏同步读一次当前 URL（`@sub.current_url()`）。拿不到就写 `-`（**不编**）。
fn boot_url() -> String {
  match @sub.current_url() {
    Some(u) => u
    None => "-"
  }
}

///|
fn initial() -> Model {
  { hits: [], n_url: 0, n_req: 0, n_vis: 0, vis_last: "-", n_push: 0, boot_url: boot_url() }
}

///|
/// 记一条（最新的在前，最多留 40 条 —— 读数是给人看形状的，不是日志系统）。
fn push(m : Model, chan : String, body : String) -> Array[Hit] {
  let out : Array[Hit] = [{ chan, body }]
  for h in m.hits {
    out.push(h)
  }
  if out.length() > 40 {
    out.truncate(40)
  }
  out
}

///|
fn update(m : Model, msg : Msg, _emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  match msg {
    Url(u) => ({ ..m, hits: push(m, "url_changed", u), n_url: m.n_url + 1 }, @cmd.none)
    Req(r) => ({ ..m, hits: push(m, "url_request", r), n_req: m.n_req + 1 }, @cmd.none)
    Push => ({ ..m, n_push: m.n_push + 1 }, @sub.push_url("#/s/from-cmd"))
    // **第一跳就推一次**（用 `n_push` 兼当"我推过没有"的标记，省一个字段）
    Tick =>
      if m.n_push == 0 {
        ({ ..m, n_push: 1 }, @sub.push_url("#/s/from-cmd"))
      } else {
        ({ ..m, n_push: m.n_push + 1 }, @cmd.none)
      }
    Vis(hidden) => {
      let s = if hidden { "隐藏" } else { "可见" }
      ({ ..m, hits: push(m, "visibility", s), n_vis: m.n_vis + 1, vis_last: s }, @cmd.none)
    }
  }
}

///|
/// 一份样式 → 一个 `Attrs`（模板里那一行；这里自己写一份，别依赖模板的内部函数）。
fn attrs(s : @style.Style) -> @html.Attrs {
  @html.Attrs::build().styles(s)
}

///|
fn line(s : String, size : Double, color : String) -> @html.Html {
  @html.div(
    attrs=attrs(@style.Style::new().font_size(size).color(color).padding_vertical(@style.px(1.0))),
    s,
  )
}

///|
fn view(m : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  let rows : Array[@html.Html] = []
  // 三个计数先摆出来 —— 驱动脚本抠这几行最稳（不怕文字里有多余空白）
  rows.push(line("COUNT url_changed=\{m.n_url}", 14.0, "#1a1410"))
  rows.push(line("COUNT url_request=\{m.n_req}", 14.0, "#1a1410"))
  rows.push(line("COUNT visibility=\{m.n_vis}", 14.0, "#1a1410"))
  rows.push(line("VIS_LAST \{m.vis_last}", 12.0, "#5b4f3f"))
  rows.push(line("BOOT_URL \{m.boot_url}", 12.0, "#1a1410"))
  rows.push(line("COUNT push=\{m.n_push}", 14.0, "#1a1410"))
  rows.push(line("HITS \{m.hits.length()}", 12.0, "#5b4f3f"))
  for h in m.hits {
    rows.push(line("\{h.chan} | \{h.body}", 11.0, "#5b4f3f"))
  }
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex_direction(@style.FlexDirection::Column)
      .padding(@style.px(16.0))
      .background_color("#fffdf8"),
    ),
    [
      line("route-spike：三条通道的读数（动作由 drive.mjs 从外部发）", 16.0, "#1a1410"),
      // 应用侧 push 的通道：`@sub.push_url`（库自己新加的动作通道，根上**已转发**）。
      // ⚠️ 早先试过 fork 里的 `@nav.push_url`（`vendor/rabbita/nav`）：它内部直调
      //    `@dom.window().push_url`，在 RN 上会抛 —— 正是这条动作通道要取代的东西。
      @html.div(
        attrs=attrs(
          @style.Style::new()
          .padding(@style.px(8.0))
          .background_color("#eee6d8")
          .color("#1a1410")
          .font_size(13.0),
        )
        .on_click(fn(_) { emit(Push) }),
        "PUSH(@sub.push_url)",
      ),
      @html.div(
        attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Column)),
        rows,
      ),
    ],
  )
}

///|
/// **只订、不做**（见文件头）。
///
/// ⚠️ 载荷的处理方式本身就是一条读数：两个 URL 通道给的 `@url.Url` / `@url.UrlRequest`
///    在**根上没有转发包** ⇒ 应用**命名不了**这两个类型，只能调它们的方法（`to_string()`）。
fn subscriptions(_m : Model, emit : @cmd.Emit[Msg]) -> @sub.Sub {
  @sub.batch([
    @sub.on_url_changed(url =>
      // 两条都记：整串（浏览器给的形状）+ **拆开的字段**（路由该读哪一格）
      emit(Url("full=\{url.to_string()} path=\{url.path} frag=\{opt(url.fragment)} query=\{opt(url.query)}"))
    ),
    @sub.on_url_request(req => emit(Req(req.to_string()))),
    @sub.on_visibility_change(hidden => emit(Vis(hidden))),
    // 每 1.5s 跳一次；`update` 只在**第一跳**上真的推一次地址（见那里的注释）
    @sub.every(1500, emit(Tick)),
  ])
}

///|
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~, subscriptions~)
}
