///|
/// # perf-bench —— 性能基准负载（**测量仪器，不是示例**）
///
/// 它只有一个职责：**给"每帧成本"造一个规模可控、形状稳定的负载**。
///
/// ## 负载形状（刻意固定，改它必须同步改 `docs/PERF.md` 的口径）
///
/// ```
/// div(root, 4 条样式)
///   ├ div(header)
///   │   ├ span("perf-bench N=… tick=…")        ← 每帧文本都变，逼 React 真的重渲
///   │   └ button("+1")  on_click=emit(Tick)    ← ★ harness 靠这个按钮驱动帧
///   └ div(list)
///       └ N × div(row, 6 条样式)               ← 每行 1 个 handler
///             ├ span(text, 3 条样式)           ← 长文本（真实文本节点）
///             ├ span(id, 3 条样式)
///             └ button("·") on_click=emit(Bump(id))
/// ```
///
/// 于是 **每个 row = 4 个作者元素 + 3 个文本包层 = 7 个元素 + 1 个 handler**、
/// **N 行 + 固定 7 个 = `7N+7` 个元素**（harness 会把实测的元素数报出来自证；
/// 那个式子是**口径**，改这张图就必须同步改 `tools/perf_bench.mjs` 与 `docs/PERF.md`）。
/// ⚠️ 这里以前写的是 `4N+5` —— 那是**漏算了 `VNode::Text` 给每个文本节点多包的那层 `Text`**
/// （RN 的硬约束：裸字符串不能当 `View` 的子节点）。仪器那边一直是对的，是这段注释错了。
/// 行内既有文本、又有样式、又有 handler ——
/// `PLAN.md` §4.2 的三个嫌疑点（`map_tag` 查表、`styles_to_js` 分配、handler 闭包）
/// 各自都被这个负载覆盖到。
///
/// ## 两个宿主注入的开关
///
/// | 键 | 作用 |
/// |---|---|
/// | `globalThis.__MOBILE_BENCH_N__` | 行数 N（默认 100） |
/// | `globalThis.__MOBILE_BENCH_MEMO__` | **消融开关**：每行是否包一层 `@html.memo_by`（默认关） |
///
/// 两个都**在 `app()` 之前注入**，于是"改前 / 改后"量的是**同一份产物** ——
/// 连"编译差异"这一项都被消掉了（见 `bench_n()` / `bench_memo()` 的注释）。

///|
/// 行数 N。宿主没注入时退到 100（不是 0 —— 空负载会让"每帧成本"看起来漂亮得可疑）。
///
/// ⚠️ 读的是 `globalThis` 上的**基准专用**键，**不碰 `MOBILE_HOST`** ——
/// 契约里不该出现"基准"这种东西（它要跟着库发出去）。
extern "js" fn bench_n() -> Int =
  #| () => {
  #|   const v = globalThis.__MOBILE_BENCH_N__;
  #|   return typeof v === 'number' && v > 0 ? (v | 0) : 100;
  #| }

///|
/// **消融开关**（宿主在 `app()` 之前注入，默认关）：每一行是否包一层 `@html.memo_by`。
///
/// 为什么把开关做进负载、而不是另建一个应用：**"改前 / 改后"必须是同一份产物**
/// （这是 `--artifact` 那套 A/B 的前提）。同一个哈希、只换宿主注入的那个布尔值，
/// 就没有"两次编译差异混进读数"这件事。
///
/// 键的取值：`id * 2 + hot`。契约要求"键相同 ⇒ HTML 与 handler 等价"——
/// 本负载里行的 HTML 只依赖 `id` / `text` / `hot`，而 `text` 由 `id` 决定
/// （`row_text(i)`），所以这个键是**完备**的。
extern "js" fn bench_memo() -> Bool =
  #| () => globalThis.__MOBILE_BENCH_MEMO__ === true

///|
/// 模块初始化时读一次（**不是每行每帧读**）：读一次的话两种变体的负载形状一致，
/// 差别只在"包没包 memo"这一件事上。
let g_memo : Bool = bench_memo()

///|
/// 一行。`hot` 用来让"点某一行"这件事真的改变那一行的外观（否则 React 会被
/// 完全相同的 props 挡住，量到的就不是重渲成本）。
struct Row {
  id : Int
  text : String
  hot : Bool
} derive(Eq)

///|
struct Model {
  n : Int
  tick : Int
  rows : Array[Row]
} derive(Eq)

///|
pub enum Msg {
  /// 驱动一帧（harness 反复调它）：只改 header 上的一个数字。
  Tick
  /// 点某一行（真实交互那一路：只改一行的 `hot`）。
  Bump(Int)
}

///|
/// 一段**中等长度的中文**：真实应用的文本节点不会只有两个字符，
/// 而 `render.mbt` 的 `VNode::Text` 是**每个文本节点都包一层 `Text`**（RN 的硬约束），
/// 所以文本长度会直接影响元素数与字符串分配。
fn row_text(i : Int) -> String {
  "行 \{i} · 一段中等长度的中文文本，用来让每行都有真实的文本节点与样式"
}

///|
fn initial() -> Model {
  let n = bench_n()
  let rows : Array[Row] = []
  for i = 0; i < n; i = i + 1 {
    rows.push({ id: i, text: row_text(i), hot: false })
  }
  { n, tick: 0, rows }
}

///|
fn update(model : Model, msg : Msg, _emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  match msg {
    Tick => ({ n: model.n, tick: model.tick + 1, rows: model.rows }, @cmd.none)
    Bump(id) =>
      (
        {
          n: model.n,
          tick: model.tick,
          rows: model.rows.map(r =>
            if r.id == id {
              { id: r.id, text: r.text, hot: !r.hot }
            } else {
              r
            }
          ),
        },
        @cmd.none,
      )
  }
}

///|
let c_bg : String = "#f6efe0"

///|
let c_card : String = "#fffaf0"

///|
let c_hot : String = "#ffe9c9"

///|
let c_ink : String = "#1a1410"

///|
let c_ink3 : String = "#7a6851"

///|
let c_accent : String = "#8a2518"

///|
fn attrs(s : @style.Style) -> @html.Attrs {
  @html.Attrs::build().styles(s)
}

///|
/// 一行视图。**4 个元素 + 1 个 handler**（见文件头那张图）。
fn row_html(r : Row, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex_direction(@style.FlexDirection::Row)
      .align_items(@style.Align::Center)
      .background_color(if r.hot { c_hot } else { c_card })
      .border_radius(10.0)
      .padding_horizontal(@style.px(12.0))
      .padding_vertical(@style.px(10.0))
      .margin_bottom(@style.px(6.0)),
    ),
    [
      @html.span(
        attrs=attrs(
          @style.Style::new().flex(1.0).font_size(14.0).color(c_ink),
        ),
        r.text,
      ),
      @html.span(
        attrs=attrs(
          @style.Style::new().font_size(12.0).color(c_ink3).margin_right(
            @style.px(8.0),
          ),
        ),
        "\{r.id}",
      ),
      @html.button(
        attrs=attrs(
          @style.Style::new().padding_horizontal(@style.px(10.0)).padding_vertical(
            @style.px(4.0),
          ),
        ),
        on_click=emit(Bump(r.id)),
        "·",
      ),
    ],
  )
}

///|
/// 一行的**外壳**：`g_memo` 打开时包一层 `@html.memo_by`，否则就是原来那个 `row_html`。
///
/// 键 = `id * 2 + hot`：本负载里行的 HTML 完全由这两个字段决定，所以"键相同 ⇒ 内容与
/// handler 等价"这条契约成立（`text` 由 `id` 推出来）。
fn rows_html(model : Model, emit : @cmd.Emit[Msg]) -> Array[@html.Html] {
  if g_memo {
    // ★ 走**公开的一行式入口**（`@moobile.memo_list`）—— 这样基准量到的就是
    // "应用照文档写会走的那条路"，而不是这里手搓的另一条。键 = `id*2+hot`。
    @moobile.memo_list(
      model.rows,
      by=r => r.id * 2 + (if r.hot { 1 } else { 0 }),
      f=r => row_html(r, emit),
    )
  } else {
    model.rows.map(r => row_html(r, emit))
  }
}

///|
fn view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new()
      .flex(1.0)
      .flex_direction(@style.FlexDirection::Column)
      .padding(@style.px(10.0))
      .background_color(c_bg),
    ),
    [
      @html.div(
        attrs=attrs(
          @style.Style::new()
          .flex_direction(@style.FlexDirection::Row)
          .align_items(@style.Align::Center)
          .margin_bottom(@style.px(8.0)),
        ),
        [
          @html.span(
            attrs=attrs(
              @style.Style::new().flex(1.0).font_size(15.0).color(c_ink).font_weight(
                @style.FontWeight::W700,
              ),
            ),
            // ★ 含 `tick` —— 每帧这串文本都不同，于是 React **必须**真的重渲（不会整体 bail out）。
            "perf-bench N=\{model.n} tick=\{model.tick}",
          ),
          // ★ harness 靠这段文本（`+1`）在元素树里找到它并调它的处理器来驱动帧。
          //   改这段文本必须同步改 `tools/perf_bench.mjs` 的 `DRIVER_TEXT`。
          @html.button(
            attrs=attrs(
              @style.Style::new()
              .background_color(c_accent)
              .border_radius(8.0)
              .padding_horizontal(@style.px(12.0))
              .padding_vertical(@style.px(6.0)),
            ),
            on_click=emit(Tick),
            "+1",
          ),
        ],
      ),
      @html.div(
        attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Column)),
        rows_html(model, emit),
      ),
    ],
  )
}

///|
/// 交出句柄表（与模板同款的一行导出）。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~)
}
