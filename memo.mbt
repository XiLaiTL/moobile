///|
/// # memo —— 长列表"一行就能用对"的记忆化入口
///
/// 上游 0.16 给了 `@html.memo` / `@html.memo_by`（产物是 `VNode::Thunk(hash, f)`），
/// 语义是：**键不变就复用上一次那棵子树**（连元素一起复用，React 于是能整片跳过）。
///
/// ⚠️ **它原本在我们这条 React 通道上是空转的** —— 翻译层把哈希直接丢掉了，
/// 开不开 `memo` 一模一样。2026-10-03 接通（`render.mbt` 的 `MCtx`），实测：
///
/// | 档（N=1000，本机安静） | 不开 memo | 开 memo |
/// |---|---|---|
/// | `translate`（只翻译层） | 3.548 ms | **0.090 ms（−97.5%）** |
/// | `dom`（真 React + jsdom） | 10.29 ms | **0.32 ms（−96.9%）** |
///
/// 数字、证据与边界见 `docs/PERF.md` §11 / §13.4。**但那两个数字是"每帧只有表头在变"的上界** ——
/// 真实应用每帧改的东西更多、命中更少。可迁移的是机制，不是这个百分比。

///|
/// **把一列行包成记忆化的行**（`@html.memo_by` 的列表版）。
///
/// ```moonbit
/// fn view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
///   @html.div(
///     @moobile.memo_list(
///       model.rows,
///       by=row => row.id,                  // ← 键：**完备**才安全（见下）
///       f=row => row_html(row, emit),
///     ),
///   )
/// }
/// ```
///
/// ## 键的契约（**这一条错了会画出旧内容**，比"没省下时间"严重得多）
///
/// `memo` 的契约是上游写死的：**键相同必须蕴含"HTML 与 handler 等价"**。
/// 直白说就是：
///
/// 1. **键要把这行的渲染依赖全都包含进去** —— `id` / 文案 / 高亮 / 选中态 / 任何会影响它长相的东西。
///    只按 `id` 取键、而行里还有个 `hot` 会变 ⇒ **那行的变化永远画不出来**。
/// 2. **别用"第几行"当键**（`by = (row, i) => i` 那种）。列表头部插一行，所有位置整体错位：
///    同键的已经不是同一行内容了 ⇒ 静默错配。（`@html.memo` 的文档同样警告这一点。）
/// 3. 行里的 handler 也是被复用的那一份 —— 若它捕获了"每次渲染都会变"的东西，同样要进键。
///
/// ## 什么时候**不要**用
///
/// - **每帧几乎每一行都在变**：命中率接近 0，白搭一层 thunk；
/// - **行数很少**（屏幕上一屏十几行的虚拟化列表）：省下的本来就有限；
/// - 想靠它掩盖"每帧重建整个模型"：那是 `update` 该修的事，不是 `view` 的。
///
/// ## 它省下的到底是什么（机制，不是魔法）
///
/// 键命中 ⇒ 那一行的**子树不重建、元素不重造**，React 拿到的是**同一个元素引用**，
/// 于是整片跳过（连 diff 都不用做）。库侧靠 `render.mbt` 的 `MCtx`（按孩子序号路径定位）兑现它。
pub fn[T] memo_list(
  xs : Array[T],
  by~ : (T) -> Int,
  f~ : (T) -> @html.Html,
) -> Array[@html.Html] {
  xs.map(x => @html.memo_by(x, f, by~))
}

///|
/// **带序号的版本**（`memo_list_i`）—— 行的渲染常常依赖"它是第几条"，
/// 例如"最后一条 + 正在生成"要画光标、或者交替行色。
///
/// ```moonbit
/// @moobile.memo_list_i(
///   model.bubbles,
///   by=(i, b) => bubble_key(b, sending && i == n - 1),
///   f=(i, b) => bubble_row(b, sending && i == n - 1),
/// )
/// ```
///
/// ⚠️ **序号一旦进了渲染，就必须进键**：`f` 用了 `i` 而 `by` 没用 `i`，
/// 就会出现"第几条挪了位置、内容却没重算"的错配（症状是**画面停在旧内容上**）。
/// 判据与 `memo_list` 一样：这一行的 `by` 必须把它在 `f` 里用到的**每一个**会变的东西都装进去。
pub fn[T] memo_list_i(
  xs : Array[T],
  by~ : (Int, T) -> Int,
  f~ : (Int, T) -> @html.Html,
) -> Array[@html.Html] {
  xs.mapi((i, x) => {
    // 键在**建 thunk 时**算一次（不是每次命中都算）
    let key = by(i, x)
    @html.memo_by((i, x), p => f(p.0, p.1), by=_ => key)
  })
}

///|
/// **带 React key 的版本**（`memo_list_keyed`）—— 把**同一个** `by` 也交给 React 当 key。
///
/// ```moonbit
/// // `by` 只算一次：既是库的缓存键，也是 React 的 key —— 两处不会漂
/// @html.div(attrs=attrs(...), @moobile.memo_list_keyed(model.rows, by=r => r.id, f=row_html))
/// ```
///
/// ## 为什么要有它（`memo_list` 缺的那一半）
///
/// `memo_list` 返回的是 `Array[Html]`，而 React **看不到任何 key** ⇒ 它只能**按位置**更新。
/// 于是"**头部插一行**"这类操作里：库这一侧的位置定位全部落空（重算），React 那一侧也只能
/// 按位置逐个改。返回 `Map[String, Html]` 则走 `Children::Map` 那条通道
/// （`render.mbt` 的 `js_with_key`），**React 拿到 key** ⇒ 已有节点可以被**搬动**而不是重建。
///
/// ## ⚠️ 它的契约比 `memo_list` **更严**：键必须**唯一**
///
/// 返回的是 `Map`（React 的 key 本来就要求唯一），所以**重复键会被折叠 ⇒ 直接少一行**
/// （后一条覆盖前一条）。而 `memo_list` 在同样情况下最坏只是"**不省**"（各位置各自算自己的，
/// 行还是在的）。这是两个入口唯一的取舍，也是 `memo_list` 仍是默认入口的原因。
///
/// | 情况 | `memo_list`（数组） | `memo_list_keyed`（keyed） |
/// |---|---|---|
/// | 键**完备**且唯一 | 命中即复用 | 命中即复用 ＋ **React 能搬动节点** |
/// | 键**不完备** | 画旧内容（`memo` 自己的契约） | 画旧内容（同左） |
/// | 键**重复** | 最坏只是不省，行还在 | ⚠️ **少一行** |
///
/// ⇒ **只在你确定键唯一时用它**（`id` / 主键那种）。不确定就用 [`memo_list`]。
///
/// ⚠️ 键的**完备性**要求与 `memo_list` 逐条相同（见 `memo_list` 的文档）：
/// 键相同必须蕴含"这一行的 HTML 与 handler 等价"。
pub fn[T] memo_list_keyed(
  xs : Array[T],
  by~ : (T) -> Int,
  f~ : (T) -> @html.Html,
) -> Map[String, @html.Html] {
  let m : Map[String, @html.Html] = Map([])
  for x in xs {
    // ★ `by` **只在这里算一次**：同一个值既当库的缓存键（`Int`）、又当 React 的 key（`String`）。
    //   两处共用一处派生 —— 这正是 keyed 版相对"自己再传一个 key=" 的价值。
    let key = by(x)
    m.set(key.to_string(), @html.memo_by(x, f, by=_ => key))
  }
  m
}
