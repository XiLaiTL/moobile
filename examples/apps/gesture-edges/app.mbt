///|
/// # 手势边界 —— 只有真机能回答的那几条
///
/// ## 为什么要有这个应用
///
/// `examples/apps/gesture-spike/` 在 **web 宿主（RNW）** 上把边界验到了 40/40
/// （嵌套归属、深层子元素的参照系、多指、同挂、无处理器、相位状态机）。
/// 但其中有四条**web 上根本问不出来**，而且它们恰好是最可能在真机上翻车的：
///
/// 1. **深层子元素的参照系**：RNW 给的是"挂手势那个元素"的局部坐标（契约要的正是这个），
///    而 Android 的 `locationX` 按文档是相对**最深的被触摸 view** —— 若真机如此，
///    契约里那句"`x`/`y` 是元素内坐标"在**最重要的平台上就是假的**。
///    这条不是猜的：`canvas-demo` 里 `dx=155 dy=51`（横滑 80px）那次事故，
///    真因就是参照系在手势中途换掉了。所以必须真机量。
/// 2. **嵌套归属**：web 上验的是 RNW 的 responder 协商；原生走的是另一套
///    （Android 的触摸分发 + RN 的 responder），结论不能平移。
/// 3. **滚动容器抢响应者**：web 上鼠标拖动**不滚** `overflow` 容器，
///    所以"滚动 vs 手势谁赢"在浏览器里压根不成立。
/// 4. **只挂 `on_tap` 的元素不该锁死滚动**：同上，只有真机有真滚动。
///
/// ⚠️ **多指（pointers）这条真机验不了**：`adb shell input` 只能发单指，
///    多指要 `sendevent` 原始事件（机型相关、不可移植）。所以那条只有 web 证据，
///    这一点在 README 与 `docs/STATUS.md` 里都写明，不假装覆盖。
///
/// ## 页面布局（每一块都留着给脚本当抓手，尺寸是算过的，别随手改）
///
/// ```text
/// ① 嵌套      外盒 358×120，内盒 120×64 居中（内盒在外盒坐标里 119..239 / 28..92）
/// ② 深层      盒 358×110；子元素 margin(60,24)、140×52
///             → 子元素中心在**盒坐标系**里是 (130,50)，在**子坐标系**里是 (70,26)
///             ⇒ 从子元素中心按下，`x` 落在哪一对就把参照系定死了
/// ③ 两个滚动   各 170×190 的 `scroll`，内容 90+150+30=270 > 190 ⇒ 能滚
///             左：内容首块挂 `on_pan`（`拖A`）  右：内容首块只挂 `on_tap`（`点B`）
///             底部各有一个 `底A 见` / `底B 见` 哨兵 —— 它在初始视口**之外**，
///             所以"它出现了" == "内容真的滚了"，不需要应用读滚动位置
///             （`on_scroll` 在 RN 上还是缺口，读不到，见 `npm/moobile-host/native-rn.js`）
/// ```
///
/// ③ 那对哨兵是**唯一能证明"滚动没被手势吞掉"的抓手**：应用侧拿不到滚动位置，
/// 于是把"滚没滚"翻译成"视口外的节点进没进 UI 树"，脚本用 `uiautomator dump` 就能读。
/// 这个思路与 `canvas-demo` 用 token 当抓手是同一个套路：**别猜坐标，读界面自己说的话**。

// ── TEA 四件套 ────────────────────────────────────────────────────────────────

///|
/// 哪个元素收到的手势。用枚举而不是四个 `Msg`，是因为四个元素的处理逻辑同构
/// （计数 + 记一次起末坐标），分开写会让 `update` 里出现四段几乎相同的代码。
pub(all) enum Which {
  Outer
  Inner
  Deep
  DragA
} derive(Eq)

///|
pub enum Msg {
  /// `(谁, 相位, 元素内 x, 元素内 y, 屏幕 x)`。
  /// `ax` 是给诊断用的：两个元素如果拿到的是**同一次触摸**，它们的 `ax` 区间会完全重合 ——
  /// 这是"外盒到底有没有真的收到事件"唯一的硬证据（只看条数会被巧合骗）。
  Pan(Which, @gesture.Phase, Int, Int, Int)
  Tap(Which)
}

///|
/// 应用状态。**全是计数器与最后一次坐标** —— 这个应用的目的不是好看，
/// 是让每一种边界都留下一个能被外部读到的数字。
struct Model {
  outer_n : Int
  inner_n : Int
  inner_c : Int
  deep_n : Int
  /// 深层那条：`start` 时的元素内坐标（参照系之争的那一对数）。
  deep_x0 : Int
  deep_y0 : Int
  /// 深层那条：**最后一条非 start 事件**的坐标（用来验"整条拖动都在同一个参照系里"）。
  deep_x1 : Int
  deep_y1 : Int
  /// 滚动容器里挂 `on_pan` 的那块：收到几条、其中几条是 `cancel`。
  drag_a_n : Int
  drag_a_c : Int
  /// 滚动容器里只挂 `on_tap` 的那块：收到几次点按（大幅滑动**不该**算点按）。
  tap_b_n : Int
  /// ── 诊断：相位序列（`s`/`m`/`e`/`c`）与屏幕 `ax` 区间 ──
  /// 用途：①「谁拿到了这次触摸」光看条数会误判，序列 + `ax` 区间才能把事实钉死。
  inner_seq : String
  outer_seq : String
  inner_ax : (Int, Int)
  outer_ax : (Int, Int)
  /// ② 深层那条：每个事件的 `x`（最多留 8 个）—— 参照系有没有**中途换掉**，看它最直接。
  deep_xs : Array[Int]
} derive(Eq)

///|
fn initial() -> Model {
  {
    outer_n: 0,
    inner_n: 0,
    inner_c: 0,
    deep_n: 0,
    deep_x0: 0,
    deep_y0: 0,
    deep_x1: 0,
    deep_y1: 0,
    drag_a_n: 0,
    drag_a_c: 0,
    tap_b_n: 0,
    inner_seq: "",
    outer_seq: "",
    inner_ax: (0, 0),
    outer_ax: (0, 0),
    deep_xs: [],
  }
}

///|
/// 相位 → 一个字母（诊断串用）。`cancel` 用 `c` 而不是 `x`，因为 `x` 在这个应用里
/// 到处都是坐标，撞上读起来会乱。
fn phase_ch(p : @gesture.Phase) -> String {
  match p {
    @gesture.Phase::Start => "s"
    @gesture.Phase::Move => "m"
    @gesture.Phase::End => "e"
    @gesture.Phase::Cancel => "c"
  }
}

///|
fn update(
  model : Model,
  msg : Msg,
  _emit : @cmd.Emit[Msg],
) -> (Model, @cmd.Cmd) {
  match msg {
    Pan(w, phase, x, y, ax) => {
      let is_start = phase == @gesture.Phase::Start
      let is_cancel = phase == @gesture.Phase::Cancel
      let ch = phase_ch(phase)
      let m = match w {
        Outer => {
          let (lo, hi) = model.outer_ax
          {
            ..model,
            outer_n: model.outer_n + 1,
            outer_seq: model.outer_seq + ch,
            outer_ax: (
              if model.outer_n == 0 { ax } else { if ax < lo { ax } else { lo } },
              if ax > hi { ax } else { hi },
            ),
          }
        }
        Inner => {
          let (lo, hi) = model.inner_ax
          {
            ..model,
            inner_n: model.inner_n + 1,
            inner_c: if is_cancel { model.inner_c + 1 } else { model.inner_c },
            inner_seq: model.inner_seq + ch,
            inner_ax: (
              if model.inner_n == 0 { ax } else { if ax < lo { ax } else { lo } },
              if ax > hi { ax } else { hi },
            ),
          }
        }
        DragA => {
          ..model,
          drag_a_n: model.drag_a_n + 1,
          drag_a_c: if is_cancel { model.drag_a_c + 1 } else { model.drag_a_c },
        }
        Deep => {
          // 冒泡顺序：先按相位把 x/y 记到该记的地方，再把 x 追进诊断数组。
          let base = if is_start {
            { ..model, deep_n: model.deep_n + 1, deep_x0: x, deep_y0: y }
          } else {
            { ..model, deep_n: model.deep_n + 1, deep_x1: x, deep_y1: y }
          }
          // 只留前 8 个：够看出参照系在哪一步换掉，又不会把 token 撑爆。
          if base.deep_xs.length() < 8 {
            { ..base, deep_xs: base.deep_xs + [x] }
          } else {
            base
          }
        }
      }
      (m, @cmd.none)
    }
    Tap(_) => ({ ..model, tap_b_n: model.tap_b_n + 1 }, @cmd.none)
  }
}

// ── 视图 ──────────────────────────────────────────────────────────────────────

///|
fn attrs(s : @style.Style) -> @html.Attrs {
  @html.Attrs::build().styles(s)
}

///|
fn tok(text : String) -> @html.Html {
  @html.span(attrs=attrs(@style.Style::new().font_size(12.0).color("#1a1410")), text)
}

///|
fn label(text : String) -> @html.Html {
  @html.span(attrs=attrs(@style.Style::new().font_size(11.0).color("#7a6851")), text)
}

///|
/// ① 嵌套：外盒与内盒**都**挂 `on_pan`。
///
/// 期望：**内盒赢**，外盒一条事件都不收（`外 n=0`）。
/// 若外盒收了，说明"按下时更具体的元素优先"这条在原生上不成立。
fn nested(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Column)),
    [
      label("① 嵌套：内外都挂 on_pan（期望：内赢，外为 0）"),
      @html.div(
        attrs=@gesture.attrs(
          on_pan=p => emit(Pan(Outer, p.phase, p.x.to_int(), p.y.to_int(), p.abs_x.to_int())),
        ).styles(
          @style.Style::new()
            .width(@style.px(358.0))
            .height(@style.px(120.0))
            .background_color("#6b4fa0")
            .border_radius(12.0)
            .align_items(@style.Align::Center)
            .justify_content(@style.Justify::Center),
        ),
        [
          @html.div(
            attrs=@gesture.attrs(
              on_pan=p => emit(Pan(Inner, p.phase, p.x.to_int(), p.y.to_int(), p.abs_x.to_int())),
            ).styles(
              @style.Style::new()
                .width(@style.px(120.0))
                .height(@style.px(64.0))
                .background_color("#d8c7f0")
                .border_radius(8.0)
                .align_items(@style.Align::Center)
                .justify_content(@style.Justify::Center),
            ),
            [tok("内 n=\{model.inner_n} c=\{model.inner_c}")],
          ),
        ],
      ),
      tok(
        "外 n=\{model.outer_n} 序内=\{model.inner_seq} 序外=\{model.outer_seq}",
      ),
      tok(
        "ax内=\{model.inner_ax.0}..\{model.inner_ax.1} ax外=\{model.outer_ax.0}..\{model.outer_ax.1}",
      ),
    ],
  )
}

///|
/// ② 深层子元素：从**子元素**上按下拖动，`x`/`y` 相对谁？
///
/// 子元素在盒子里 `margin(60,24)`、尺寸 140×52，所以从子元素中心按下时：
/// - 相对**盒**（契约要的）→ `x≈130 y≈50`
/// - 相对**子元素**（Android `locationX` 的老语义）→ `x≈70 y≈26`
///
/// 两对数字差得很开，所以这一条**不需要知道盒子在屏幕上的位置**就能判 ——
/// 脚本只知道"从 `子` 这个 token 上按下"，而那个 token 正好在子元素中心。
fn deep(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Column)),
    [
      label("② 深层子元素：从子元素按下（期望 起≈130,50；若 ≈70,26 即相对子元素）"),
      @html.div(
        attrs=@gesture.attrs(
          on_pan=p => emit(Pan(Deep, p.phase, p.x.to_int(), p.y.to_int(), p.abs_x.to_int())),
        ).styles(
          @style.Style::new()
            .width(@style.px(358.0))
            .height(@style.px(110.0))
            .background_color("#1f6f8b")
            .border_radius(12.0),
        ),
        [
          @html.div(
            attrs=attrs(
              @style.Style::new()
                .margin_left(@style.px(60.0))
                .margin_top(@style.px(24.0))
                .width(@style.px(140.0))
                .height(@style.px(52.0))
                .background_color("#bfe6f2")
                .border_radius(8.0)
                .align_items(@style.Align::Center)
                .justify_content(@style.Justify::Center),
            ),
            [tok("子")],
          ),
        ],
      ),
      tok(
        "深 n=\{model.deep_n} 起=\{model.deep_x0},\{model.deep_y0} 末=\{model.deep_x1},\{model.deep_y1}",
      ),
      tok("深xs=\{model.deep_xs}"),
    ],
  )
}

///|
/// 一个滚动容器：内容 = 首块（挂手势） + 垫高 + 哨兵。
///
/// 哨兵在初始视口之外（内容 270 > 视口 190），所以"哨兵进 UI 树了"就是"内容滚了"。
fn scroll_box(title : String, first : @html.Html, sentinel : String, pad_token : String) -> @html.Html {
  @html.div(
    attrs=attrs(
      @style.Style::new().flex_direction(@style.FlexDirection::Column).width(
        @style.px(170.0),
      ),
    ),
    [
      label(title),
      @html.node(
        "scroll",
        attrs(
          @style.Style::new()
            .width(@style.px(170.0))
            .height(@style.px(190.0))
            .background_color("#e8e8e8")
            .border_radius(8.0),
        ),
        [
          first,
          @html.div(
            attrs=attrs(
              @style.Style::new()
                .width(@style.px(170.0))
                .height(@style.px(150.0))
                .background_color("#cccccc")
                .align_items(@style.Align::Center)
                .justify_content(@style.Justify::Center),
            ),
            // ⚠️ 这个垫高块里的 token 是 ④ 的**正对照**抓手：它**没有任何手势**，
            //    滑它必须能滚。没有这个对照，"可点元素那块没滚"就分不清是
            //    "手势挡了滚动"还是"这个容器本来就滚不动 / 我的滑动姿势不对"。
            [tok(pad_token)],
          ),
          @html.div(
            attrs=attrs(
              @style.Style::new()
                .width(@style.px(170.0))
                .height(@style.px(30.0))
                .align_items(@style.Align::Center)
                .justify_content(@style.Justify::Center)
                .background_color("#8a2518"),
            ),
            [
              @html.span(
                attrs=attrs(@style.Style::new().font_size(12.0).color("#ffffff")),
                sentinel,
              ),
            ],
          ),
        ],
      ),
    ],
  )
}

///|
/// ③ 滚动 vs 手势：左块挂 `on_pan`，右块**只**挂 `on_tap`。
///
/// 期望（这是取舍，不是观察）：
/// - 左：`on_pan` 的元素在按下时就判定"这次是拖动"，**不让**外层滚动抢走
///   → 内容**不滚**（`底A 见` 不出现）、`拖A n` 增加、`c`（cancel）为 0。
/// - 右：只挂 `on_tap` 的元素**让** → 竖滑应当滚起来（`底B 见` 出现），
///   且 `点B` 不增加（大幅滑动不算点按）。
fn scrolls(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Column).gap(6.0)),
    [
      @html.div(
        attrs=attrs(@style.Style::new().flex_direction(@style.FlexDirection::Row).gap(12.0)),
        [
          scroll_box(
            "③ 可拖 + 滚（期望：不滚）",
            @html.div(
              attrs=@gesture.attrs(
                on_pan=p => emit(Pan(DragA, p.phase, p.x.to_int(), p.y.to_int(), p.abs_x.to_int())),
              ).styles(
                @style.Style::new()
                  .width(@style.px(170.0))
                  .height(@style.px(90.0))
                  .background_color("#2f7d5f")
                  .align_items(@style.Align::Center)
                  .justify_content(@style.Justify::Center),
              ),
              [
                @html.span(
                  attrs=attrs(@style.Style::new().font_size(12.0).color("#ffffff")),
                  "拖A n=\{model.drag_a_n} c=\{model.drag_a_c}",
                ),
              ],
            ),
            "底A 见",
            "垫A",
          ),
          scroll_box(
            "只点按 + 滚（期望：滚）",
            @html.div(
              attrs=@gesture.attrs(on_tap=_ => emit(Tap(DragA))).styles(
                @style.Style::new()
                  .width(@style.px(170.0))
                  .height(@style.px(90.0))
                  .background_color("#c98a2f")
                  .align_items(@style.Align::Center)
                  .justify_content(@style.Justify::Center),
              ),
              [
                @html.span(
                  attrs=attrs(@style.Style::new().font_size(12.0).color("#ffffff")),
                  "点B n=\{model.tap_b_n}",
                ),
              ],
            ),
            "底B 见",
            "垫B",
          ),
        ],
      ),
      tok("滚A n=\{model.drag_a_n} c=\{model.drag_a_c} · 点B n=\{model.tap_b_n}"),
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
        .gap(10.0)
        .padding(@style.px(16.0))
        .background_color("#f6efe0"),
    ),
    [
      @html.span(
        attrs=attrs(
          @style.Style::new().font_size(18.0).color("#1a1410").font_weight(
            @style.FontWeight::W700,
          ),
        ),
        "手势边界（真机）",
      ),
      nested(model, emit),
      deep(model, emit),
      scrolls(model, emit),
    ],
  )
}

///|
/// ⚠️ **不给 `subscriptions`**（与 `canvas-demo` 同一个理由，而且这里是必需的）：
/// 定时推送会让界面一直"不空闲"，`uiautomator dump` 会报
/// `could not get idle state.`，而它失败时**不会清掉上一次的 xml** ——
/// 读到陈旧界面就会得出完全错误的结论（模板与 `docs/FINDINGS.md` 都记过）。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~)
}
