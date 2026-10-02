///|
/// 状态与逻辑。**对渲染后端一无所知** —— 纯 MoonBit。
///
/// 与 0.1.0 的样本比，这里多了两样东西，都是 0.2.0 才有的能力：
/// 1. **`init` 带命令**（`mount_with_init`）：首帧之前先去本地库读清单；
/// 2. **`update` 返回命令**：所有写库都是副作用，走 `Cmd` 而不是直接改内存。
pub enum Filter {
  All
  Active
  Done
} derive(Eq)

///|
pub struct Todo {
  id : Int
  text : String
  done : Bool
} derive(Eq)

///|
/// 页面。
///
/// `Edit(Int)` 是"详情/编辑页"，`R1` 是排版可行性样本
/// （按 `interest/yi` 的真实 CSS 移植的那段）。
pub enum Page {
  List
  Edit(Int)
  R1
} derive(Eq)

///|
/// 与服务器的同步状态（UI 直接显示它）。
///
/// `Dirty` 与 `Offline` 的区别值得留一档：**"从没同步过"和"有本地改动待同步"
/// 是两件事**，用户看到的提示也该不一样。
pub enum SyncState {
  Offline
  Dirty
  Syncing
  Synced
  Fail(String)
} derive(Eq)

///|
pub struct Model {
  items : Array[Todo]
  draft : String
  filter : Filter
  page : Page
  editing : String
  loaded : Bool
  error : String?
  sync : SyncState
  pending : Int
  ticks : Int
  /// 收到过几次可见性变化（`PLAN.md` §3.6 的 N2 真机判据要断言它）。
  vis_events : Int
  /// 最近一次可见性：`true` = 不可见。语义与 DOM 的 `document.hidden` 一致 ——
  /// 于是同一份应用代码在 Web（回退 DOM）与安卓（宿主能力 → AppState）上看到的是同一个量。
  hidden : Bool
  /// 收到过几次尺寸变化 + 最近一次收到的尺寸（`PLAN.md` §3.6 的 N5b 真机判据要断言它们）。
  ///
  /// 为什么值得进 Model：`on_resize` 原来在 RN 上是**静默给 0** 那一类
  /// （`window.innerWidth` 是 `undefined` 却不抛），现在改走宿主能力
  /// （`native.geometry` ← `Dimensions`）。计数 + 数值一起进界面，
  /// 才拦得住"收到了但解成 0"那类 bug。
  resize_events : Int
  vp_w : Int
  vp_h : Int
} derive(Eq)

///|
pub enum Msg {
  // —— 数据通道：本地库把结果统一从这里送回来 ——
  Loaded(Array[Todo])
  Failed(String)
  // —— 交互 ——
  SetDraft(String)
  Add
  Toggle(Int)
  Remove(Int)
  SetFilter(Filter)
  SetPage(Page)
  OpenEdit(Int)
  SetEditing(String)
  SaveEdit(Int)
  // —— 同步（网络链路）——
  Sync
  SyncPlan(Array[TodoRow])
  Pushed(Int, ServerTodo)
  PushDeleted(Int)
  PushFailed(Int, String)
  Pulled(Array[ServerTodo])
  SyncFailed(String)
  // —— 订阅（Sub）：运行时**推**过来的消息，不由用户交互产生 ——
  Tick
  VisibilityChanged(Bool)
  SizeChanged(Int, Int)
}

///|
/// 初始模型：**清单是空的、`loaded = false`** —— 真正的清单由 `load_cmd` 从本地库读回来。
pub fn initial() -> Model {
  {
    items: [],
    draft: "",
    filter: All,
    page: List,
    editing: "",
    loaded: false,
    error: None,
    sync: Offline,
    pending: 0,
    ticks: 0,
    vis_events: 0,
    hidden: false,
    resize_events: 0,
    vp_w: 0,
    vp_h: 0,
  }
}

///|
/// 启动：建表 / 播种 / 读回，全部在首帧之前排队执行。
///
/// ⚠️ **不能叫 `init`** —— 在 MoonBit 里 `init` 是保留形状（模块初始化函数，
/// 必须无参无返回值）。踩过一次：报错是 "`init` function must have no arguments and no return value"。
pub fn init_app(emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  (initial(), load_cmd(emit))
}

///|
/// TEA 的 `update`：形状与上游 `elmish` 一致 —— `(Model, Msg, Emit) -> (Model, Cmd)`。
///
/// 关键约定：**清单只在 `Loaded` 这一处被改写**。其余分支最多改草稿 / 过滤 / 页面，
/// 需要写库就返回一个 `Cmd`，写完之后库层会重读并送回 `Loaded`。
/// 于是"界面显示的清单"与"库里的清单"不可能不一致。
pub fn update(
  model : Model,
  msg : Msg,
  emit : @cmd.Emit[Msg],
) -> (Model, @cmd.Cmd) {
  match msg {
    Loaded(items) => ({ ..model, items, loaded: true, error: None }, @cmd.none)
    Failed(e) => ({ ..model, error: Some(e), loaded: true }, @cmd.none)
    SetDraft(s) => ({ ..model, draft: s }, @cmd.none)
    SetFilter(f) => ({ ..model, filter: f }, @cmd.none)
    SetPage(p) => ({ ..model, page: p }, @cmd.none)
    Add =>
      if model.draft == "" {
        (model, @cmd.none)
      } else {
        ({ ..model, draft: "", sync: Dirty }, add_cmd(emit, model.draft))
      }
    Toggle(id) =>
      match find_item(model.items, id) {
        Some(t) => ({ ..model, sync: Dirty }, toggle_cmd(emit, id, !t.done))
        None => (model, @cmd.none)
      }
    Remove(id) => ({ ..model, sync: Dirty }, remove_cmd(emit, id))
    OpenEdit(id) =>
      match find_item(model.items, id) {
        Some(t) => ({ ..model, page: Edit(id), editing: t.text }, @cmd.none)
        None => (model, @cmd.none)
      }
    SetEditing(s) => ({ ..model, editing: s }, @cmd.none)
    SaveEdit(id) => {
      let text = model.editing
      if text == "" {
        ({ ..model, page: List }, @cmd.none)
      } else {
        ({ ..model, page: List, sync: Dirty }, set_text_cmd(emit, id, text))
      }
    }
    // ---------- 同步 ----------
    // 三步走：读待推送 → 全推出去 → 拉全量合并。
    // 中间只有一个计数器（pending）来知道"推完了没有"，这也是 TEA 里做顺序副作用的常规办法。
    Sync => ({ ..model, sync: Syncing, pending: 0 }, sync_plan_cmd(emit))
    SyncPlan(rows) =>
      (
        { ..model, pending: rows.length() },
        if rows.length() == 0 {
          pull_cmd(emit)
        } else {
          push_all_cmd(rows, emit)
        },
      )
    Pushed(local_id, t) => {
      let pending = model.pending - 1
      let adopt = adopt_cmd(emit, local_id, t)
      (
        { ..model, pending },
        if pending <= 0 {
          @cmd.batch([adopt, pull_cmd(emit)])
        } else {
          adopt
        },
      )
    }
    PushDeleted(local_id) => {
      let pending = model.pending - 1
      let purge = purge_cmd(emit, local_id)
      (
        { ..model, pending },
        if pending <= 0 {
          @cmd.batch([purge, pull_cmd(emit)])
        } else {
          purge
        },
      )
    }
    PushFailed(_id, e) => (
      { ..model, sync: Fail(e), pending: model.pending - 1 },
      @cmd.none,
    )
    Pulled(rows) => ({ ..model, sync: Synced }, merge_cmd(emit, rows))
    SyncFailed(e) => ({ ..model, sync: Fail(e) }, @cmd.none)
    // 订阅送来的心跳：只改一个计数 —— 它证明"运行时在**主动**推进状态"，
    // 而不是只有用户点击才动。这是 N1 补的那半条 TEA（`subscriptions?`）的验收点。
    Tick => ({ ..model, ticks: model.ticks + 1 }, @cmd.none)
    // 可见性变化（`PLAN.md` §3.6 的 N2 真机判据）：**两端同一条应用代码** ——
    // Web 上进/出标签页走 DOM 回退，安卓上按 Home / 回前台走宿主能力（AppState）。
    // 只记一个计数与最近值，不发起任何副作用 —— 断言才不会被别的状态干扰。
    VisibilityChanged(hidden) => (
      { ..model, vis_events: model.vis_events + 1, hidden },
      @cmd.none,
    )
    // 尺寸变化（`PLAN.md` §3.6 的 N5b 真机判据）：走宿主能力 `native.geometry`
    // → RN 的 `Dimensions`。**同时也记数值** —— 只记"收到了"拦不住"解成 0"那类 bug。
    SizeChanged(w, h) => (
      { ..model, resize_events: model.resize_events + 1, vp_w: w, vp_h: h },
      @cmd.none,
    )
  }
}

///|
/// **订阅**：每 1 秒由运行时推一个 `Tick` 回来。
///
/// 为什么先拿 `every` 验：它是内置订阅里最不依赖平台的一个（`setInterval` 两端都有），
/// 所以能先把"`subscriptions?` 这条线通不通"和"某个 RN emitter 接得对不对"两件事分开。
///
/// ⚠️ **间隔是 5 秒而不是 1 秒**，这是被安卓验证工具逼出来的：`uiautomator dump`
/// 要等界面进入 **idle**，一秒一跳会让它永远等不到 —— 表现是
/// `ERROR: could not get idle state.`，而失败时它**会把上一次的 xml 留在原地**，
/// 于是验证脚本读到陈旧 UI、给出莫名其妙的结论（踩过，记在 FINDINGS.md 的 R2）。
/// 真正的原生持续流（AppState / NetInfo / 传感器）走 `@sub.custom_sub`，见 `PLAN.md` 的 N4。
///
/// `on_visibility_change` 是**第一条走宿主能力通道的订阅**（`PLAN.md` §3.6 的 N2 / N5）：
/// 安卓上宿主登记了 `native.visibility`（`AppState`），Web 上不登记、自动回退 DOM。
/// 它**只在真的变化时推**，不参与 idle 问题 —— 所以放进来不影响上面的 5 秒约定。
pub fn subscriptions(_model : Model, emit : @cmd.Emit[Msg]) -> @sub.Sub {
  @sub.batch([
    @sub.every(5000, emit(Tick)),
    @sub.on_visibility_change(hidden => emit(VisibilityChanged(hidden))),
    // ⚠️ 0.16 起 `@common.Viewport` 的 width/height 是 `Double`（上游改的），
    // 而本应用的 `SizeChanged` 收的是 `Int` 像素 —— 在边界显式转，别把类型的松紧改掉。
    @sub.on_resize(v => emit(SizeChanged(v.width.to_int(), v.height.to_int()))),
  ])
}

///|
/// 按 id 找一条。
pub fn find_item(items : Array[Todo], id : Int) -> Todo? {
  for t in items {
    if t.id == id {
      return Some(t)
    }
  }
  None
}

///|
pub fn visible(model : Model) -> Array[Todo] {
  match model.filter {
    All => model.items
    Active => model.items.filter(t => !t.done)
    Done => model.items.filter(t => t.done)
  }
}

///|
pub fn remaining(model : Model) -> Int {
  model.items.filter(t => !t.done).length()
}
