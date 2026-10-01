///|
/// **antd 全组件 demo** —— 用 `libgen` 生成的 `@antd` DSL 把组件库的每个组件都渲染出来。
///
/// 与 [`antd-spike`](../antd-spike/) 的分工（别把两者读成同一个东西）：
///   · `antd-spike` 是**判据**（库本体接得对不对：标签直通 / 契约 / 载荷通道），条目少、进 `verify_all`；
///   · 这里是**用法示例**（生成的 DSL 覆盖多少组件、交互到底能不能用），判据在
///     `host/verify.mjs` 里，**不进**那条门 —— 它跟着 antd 的版本走。
///
/// ## 这份 demo 的判据是什么
///
/// 不是"页面能打开"，而是：**清单里的 71 个组件，每一个都真的被 antd 渲染出了 DOM**。
/// 做法见 `host/verify.mjs`：gallery 里每个组件都套在一个带 `data-demo="<组件名>"`
/// 的格子里，而那份组件名单**直接读 `generated/antd.manifest.json`**
/// （也就是生成 DSL 与宿主注册表的那**同一份**清单）。于是"漏了一个组件"是断言失败，
/// 而不是"看起来挺全"。
///
/// ## 骨架：布局与文案
///
/// 视图刻意拆成四段（data entry / display / feedback+nav / layout），每段一个文件 ——
/// 71 个组件塞一个文件会到上千行，改一处要滚很久。
///
/// ## ⚠️ 三个**不知道也不假装知道**的地方
///
/// 1. **样式**：antd 的 CSS-in-JS 在真浏览器里才真正生效，这里只断言结构（类名 / 文本 / 数据）。
/// 2. **弹层类组件**（Modal / Drawer / Tooltip / Popover / Dropdown / Popconfirm / Tour）：
///    它们渲染到 portal 里，**SSR 阶段拿不到**，所以断言放在 jsdom 挂载之后（那时 portal 是真的）。
/// 3. **`message` / `notification` / `theme` / `version` / `Grid` / `unstableSetRender`**：
///    它们**不是组件**（是命令式 API 或门面对象），所以既不在 manifest 里、也不在这里。
///    要弹一条 message 得走宿主侧的 JS —— 那是另一条通道，本 demo 不假装覆盖。
pub struct Model {
  /// 交互计数（内置标签那条老路径的对照）
  clicks : Int
  /// 受控文本（`Input`）
  draft : String
  /// 受控数值（`InputNumber` / `Slider`）
  num : Double
  /// 受控开关（`Switch`）
  on : Bool
  /// 受控勾选（`Checkbox`）
  agree : Bool
  /// 受控单选（`Radio.Group` / `Segmented`）
  picked : String
  /// 受控下拉（`Select`）
  city : String
  /// 受控评分（`Rate`）
  rate : Double
  /// 受控页签（`Tabs`）
  tab : String
  /// 受控页码（`Pagination`）
  page : Int
  /// 受控步进（`Steps`）
  step : Int
  /// 表格行数（跟着 `Bump` 走，用来证明 JSON prop 是"活的"）
  rows : Int
  /// 弹层开关（`Modal` / `Drawer`）
  modal_open : Bool
  drawer_open : Bool
  /// 事件回执：每一次回调都往这里追加一句，便于人肉核对"回调到底回没回来"
  log : String
} derive(Eq)

///|
pub enum Msg {
  Bump
  Reset
  /// 载荷通道：文本（`Input`）
  SetDraft(String)
  /// 载荷通道：文本（`Select` 的 value）
  SetCity(String)
  /// 载荷通道：数值（`Slider` / `InputNumber` / `Rate`）
  SetNum(Double)
  /// 载荷通道：布尔（`Switch`）
  SetOn(Bool)
  /// 载荷通道：事件对象里挖出来的布尔（`Checkbox` 的 `e.target.checked`）
  SetAgree(Bool)
  /// 载荷通道：单选（`Radio.Group` / `Segmented`）
  SetPicked(String)
  SetTab(String)
  SetPage(Int)
  SetStep(Int)
  SetModal(Bool)
  SetDrawer(Bool)
  /// 事件本身没有可读的载荷时的回执（`DatePicker` 是多参数回调，见 README 的已知限制）
  Fired(String)
}

///|
pub fn initial() -> Model {
  {
    clicks: 0,
    draft: "",
    num: 30.0,
    on: false,
    agree: false,
    picked: "b",
    city: "sh",
    rate: 3.0,
    tab: "one",
    page: 1,
    step: 0,
    rows: 3,
    modal_open: false,
    drawer_open: false,
    log: "",
  }
}

///|
/// 记一条回执：让"回调回来了"在界面上**看得见**（验证脚本也断言它）。
fn with_log(model : Model, what : String) -> Model {
  { ..model, log: model.log + (if model.log == "" { "" } else { " ｜ " }) + what }
}

///|
pub fn update(
  model : Model,
  msg : Msg,
  _emit : @cmd.Emit[Msg],
) -> (Model, @cmd.Cmd) {
  match msg {
    Bump => ({ ..with_log(model, "Bump"), clicks: model.clicks, rows: model.rows + 1 }, @cmd.none)
    Reset => ({ ..model, clicks: model.clicks, rows: 3, log: "" }, @cmd.none)
    SetDraft(t) => (with_log({ ..model, draft: t }, "Input.onChange"), @cmd.none)
    SetCity(v) => (with_log({ ..model, city: v }, "Select.onChange"), @cmd.none)
    SetNum(v) => (with_log({ ..model, num: v }, "Slider/InputNumber.onChange"), @cmd.none)
    SetOn(v) => (with_log({ ..model, on: v }, "Switch.onChange"), @cmd.none)
    SetAgree(v) => (with_log({ ..model, agree: v }, "Checkbox.onChange"), @cmd.none)
    SetPicked(v) => (with_log({ ..model, picked: v }, "Radio/Segmented.onChange"), @cmd.none)
    SetTab(v) => (with_log({ ..model, tab: v }, "Tabs.onChange"), @cmd.none)
    SetPage(v) => (with_log({ ..model, page: v }, "Pagination.onChange"), @cmd.none)
    SetStep(v) => (with_log({ ..model, step: v }, "Steps.onChange"), @cmd.none)
    SetModal(v) => (with_log({ ..model, modal_open: v }, "Modal.onCancel/onOk"), @cmd.none)
    SetDrawer(v) => (with_log({ ..model, drawer_open: v }, "Drawer.onClose"), @cmd.none)
    Fired(what) => (with_log(model, what), @cmd.none)
  }
}

///|
/// 应用入口（单导出）。
///
/// 宿主拿到的 `element()` 就是下面这棵树 —— 它里面**同时**有 `@html`（内置标签）
/// 与 `@antd`（组件库）两种写法，证明两者混在一棵树里没有任何特殊处理。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~)
}
