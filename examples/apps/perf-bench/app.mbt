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
/// 于是 **每个 row = 4 个元素 + 1 个 handler**、**N 行 = 4N+5 个元素左右**
/// （harness 会把实测的元素数报出来自证）。行内既有文本、又有样式、又有 handler ——
/// `PLAN.md` §4.2 的三个嫌疑点（`map_tag` 查表、`styles_to_js` 分配、handler 闭包）
/// 各自都被这个负载覆盖到。
///
/// ## N 从哪来
///
/// **宿主在 `app()` 之前注入** `globalThis.__MOBILE_BENCH_N__`。
/// 这样"改前 / 改后"量的是**同一份产物**（见 `app.mbt` 里 `bench_n()` 的注释）。

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
        model.rows.map(r => row_html(r, emit)),
      ),
    ],
  )
}

///|
/// 交出句柄表（与模板同款的一行导出）。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~)
}
