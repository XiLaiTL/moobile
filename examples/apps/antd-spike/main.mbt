///|
/// **React 组件库接入的试金石** —— 一份视图里同时压上四件事：
///
/// 1. **内置标签**（`div` / `span`）→ 宿主的基础组件（老路径，必须没被影响）；
/// 2. **命名空间直通标签**（`antd:Card` / `antd:Button`）→ 宿主注册的第三方组件；
/// 3. **四条 prop 通道**：字符串（`type`）、布尔（`danger`）、数值（`percent`）、
///    **结构化 JSON**（Table 的 `columns` / `dataSource`）；
/// 4. **事件**：`on_click` 经宿主覆盖落到 antd 的 `onClick`，回到 `update`。
///
/// 判据（由 `host/verify.mjs` 断言，见 `host/README.md`）：
/// 少了任何一条，试金石就得红 —— 而不是"看起来渲染出来了"。
pub struct Model {
  count : Int
  clicks : Int
  /// 受控组件的值（I1 的判据：它必须真的来自用户输入，而不是我们写死的）
  draft : String
} derive(Eq)

///|
pub enum Msg {
  Bump
  Reset
  /// 载荷通道：antd `Input` 的 `onChange` 递回来的**文本**
  SetDraft(String)
}

///|
pub fn initial() -> Model {
  { count: 3, clicks: 0, draft: "" }
}

///|
pub fn update(
  model : Model,
  msg : Msg,
  _emit : @cmd.Emit[Msg],
) -> (Model, @cmd.Cmd) {
  match msg {
    Bump => ({ ..model, count: model.count + 1, clicks: model.clicks + 1 }, @cmd.none)
    Reset => ({ ..model, count: 0, clicks: model.clicks + 1 }, @cmd.none)
    SetDraft(text) => ({ ..model, draft: text }, @cmd.none)
  }
}

///|
/// antd `Table` 的 `columns` —— **结构化 prop**，走 JSON 文本通道。
///
/// 为什么它必须是常量字符串而不是类型：`Attrs` 的值域只有 String / Bool / Int / Double
/// （`variant` 的 4 个构造器），对象与数组进不来。要真做类型化，得先有
/// "结构化值"的构造器与跨端序列化约定 —— 这是设计稿里 N3 那条待办。
let columns_json : String = "[{\"title\":\"序号\",\"dataIndex\":\"id\"},{\"title\":\"分数\",\"dataIndex\":\"score\"}]"

///|
pub fn rows_json(model : Model) -> String {
  let parts : Array[String] = []
  for i = 1; i <= model.count; i = i + 1 {
    parts.push("{\"id\":\{i},\"score\":\{i * 10}}")
  }
  "[" + parts.join(",") + "]"
}

///|
pub fn progress(model : Model) -> Double {
  let p = model.count * 20
  if p > 100 {
    100.0
  } else {
    p.to_double()
  }
}

///|
/// 直通标签的 attrs 写法：在 `Attrs::build()` 上挂**任意** prop。
///
/// `prop_str` / `prop_bool` / `prop_int` / `prop_num` / `prop_json` 是本次为组件库
/// 新开的通道（`vendor/rabbita/html/attrs.mbt`）—— 在此之前 `Attrs` 的公开面是
/// 几百个**按 HTML 属性命名**的方法，`danger` / `loading` 这类组件库词汇一个都传不进去。
pub fn button_attrs(
  kind : String,
  danger : Bool,
  emit : @cmd.Emit[Msg],
  msg : Msg,
) -> @html.Attrs {
  @html.Attrs::build()
  .prop_str("type", kind)
  .prop_bool("danger", danger)
  .on_click(_ => emit(msg))
}

///|
pub fn view(model : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build().styles(
      @style.Style::new().padding(@style.px(24.0)).background_color("#f0f2f5"),
    ),
    [
      @html.node(
        "antd:Card",
        @html.Attrs::build()
        .prop_str("title", "moobile × antd")
        .styles(@style.Style::new().margin_bottom(@style.px(16.0))),
        [
          // ── **受控组件**（I1 的判据）：值来自 Model、事件带回新值。
          //    在此之前 `onChange` 会触发但**读不到值** —— 也就是"能画、能点、不能用"。
          //    写法上刻意用 `on_raw`（载荷是真实值）而不是 `on_change`（载荷是零值）。
          @html.node(
            "antd:Input",
            @html.Attrs::build()
            .prop_str("placeholder", "在这里打字")
            .prop_str("value", model.draft)
            .on_raw("change", e => emit(SetDraft(e.text()))),
            ([] : Array[@html.Html]),
          ),
          @html.node(
            "antd:Space",
            @html.Attrs::build().prop_bool("wrap", true),
            [
              @html.node(
                "antd:Button",
                button_attrs("primary", false, emit, Bump),
                "加一条",
              ),
              @html.node(
                "antd:Button",
                button_attrs("default", true, emit, Reset),
                "清空",
              ),
              @html.node(
                "antd:Tag",
                @html.Attrs::build().prop_str("color", "blue"),
                "条数 \{model.count}",
              ),
            ],
          ),
        ],
      ),
      @html.node(
        "antd:Progress",
        @html.Attrs::build().prop_num("percent", progress(model)),
        ([] : Array[@html.Html]),
      ),
      @html.node(
        "antd:Table",
        @html.Attrs::build()
        .prop_json("columns", columns_json)
        .prop_json("dataSource", rows_json(model))
        .prop_str("rowKey", "id")
        .prop_bool("pagination", false),
        ([] : Array[@html.Html]),
      ),
      // ── 控制组：内置标签路径。这一段与组件库无关，用来证明老路径没被改动影响
      //    （内置 `button` → 宿主的 `Pressable`，事件走宿主 `"*"` 那条覆盖）。
      @html.div(
        attrs=@html.Attrs::build().styles(
          @style.Style::new().margin_top(@style.px(16.0)),
        ),
        [
          @html.button(
            attrs=@html.Attrs::build().styles(
              @style.Style::new().padding_vertical(@style.px(4.0)),
            ),
            on_click=emit(Bump),
            "内置按钮",
          ),
          @html.span(
            attrs=@html.Attrs::build().styles(
              @style.Style::new().font_size(14.0),
            ),
            "内置标签仍在：点击 \{model.clicks} 次",
          ),
          @html.span(
            attrs=@html.Attrs::build().styles(
              @style.Style::new().font_size(14.0),
            ),
            "回显：\{model.draft}",
          ),
        ],
      ),
    ],
  )
}

///|
/// 应用入口（单导出）：交出句柄表，宿主拿到就能挂。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~)
}

///|
/// **负例**：组件名写错时的行为（`Botton` 少了一个 `u`）。
///
/// 期望：`start()` 抛错，并把 `antd:Botton` 与"已注册了哪些"一起报出来。
/// 会被否定掉的那个设计选择是"查不到就回落成 `View`"—— 那会渲染出一个空盒子，
/// 报错信息离真因十万八千里。`host/verify.mjs` 的负例断言就是钉住这个选择的。
pub fn app_typo() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view=view_typo)
}

///|
fn view_typo(_model : Model, _emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.node("antd:Botton", @html.Attrs::build(), "名字写错的组件")
}
