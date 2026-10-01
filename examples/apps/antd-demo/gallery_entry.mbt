///|
/// gallery 之一：**数据录入**（19 个组件）。
///
/// 这一段的重点是**受控组件**：`value` 从 `Model` 来、`on_change` 把值带回去。
/// 在 I1（事件载荷通道）之前，`onChange` 会触发但**读不到值** ——
/// 也就是"能画、能点、不能用"，所以这里的每一格都配了一句"回调回来了"的回执。
///
/// ⚠️ 一处**已知代价**（写在这里，免得下一个人以为是笔误）：`value` 这个 prop
/// 在 `.d.ts` 里的类型是 `string | number | readonly string[]`（React 的公共属性面），
/// 而"含数组的联合"按规则走 **JSON 通道** —— 于是传字符串要写成 `jstr(model.draft)`。
/// 名单里那条规则本身是对的（`string[]` 真能传），代价是常见的单值场景要包一层。
fn entry_cells(model : Model, emit : @cmd.Emit[Msg]) -> Array[@html.Html] {
  [
    // ── 受控单值：Input / InputNumber / Mentions ──────────────────────────
    cell("Input", [
      label("受控：value 从 Model 来，change 把**真实文本**带回去"),
      @antd.input(
        placeholder="在这里打字",
        value=jstr(model.draft),
        on_change=e => emit(SetDraft(e.text())),
        ([] : Array[@html.Html]),
      ),
      label("Model.draft = \{model.draft}"),
    ]),
    cell("InputNumber", [
      @antd.input_number(
        value=jstr_num(model.num),
        min="0",
        max="100",
        on_change=e => emit(SetNum(e.num())),
        ([] : Array[@html.Html]),
      ),
    ]),
    cell("Mentions", [
      @antd.mentions(
        placeholder="@ 一个人",
        value=model.draft,
        options=json_options,
        rows=1,
        on_change=e => emit(SetDraft(e.text())),
        ([] : Array[@html.Html]),
      ),
    ]),
    // ── 选择类：Select / AutoComplete / Cascader / TreeSelect / Segmented / Radio ──
    cell("Select", [
      @antd.select(
        value=jstr(model.city),
        options=json_options,
        on_change=e => emit(SetCity(e.text())),
        ([] : Array[@html.Html]),
      ),
      label("Model.city = \{model.city}"),
    ]),
    cell("AutoComplete", [
      @antd.auto_complete(
        options=json_options,
        placeholder="输入试试",
        ([] : Array[@html.Html]),
      ),
    ]),
    cell("Cascader", [
      @antd.cascader(
        options=json_cascader,
        placeholder="请选择",
        ([] : Array[@html.Html]),
      ),
    ]),
    cell("TreeSelect", [
      @antd.tree_select(
        tree_data=json_tree,
        placeholder="请选择",
        ([] : Array[@html.Html]),
      ),
    ]),
    cell("Segmented", [
      @antd.segmented(
        options=json_radio_options,
        value=jstr(model.picked),
        on_change=e => emit(SetPicked(e.text())),
        ([] : Array[@html.Html]),
      ),
    ]),
    cell("Radio", [
      @antd.radio_group(
        options=json_radio_options,
        value=jstr(model.picked),
        on_change=e => emit(SetPicked(e.text())),
        ([] : Array[@html.Html]),
      ),
    ]),
    // ── 开关 / 勾选 / 滑块 / 评分 ──────────────────────────────────────────
    cell("Switch", [
      @antd.switch(
        checked=model.on,
        checked_children="开",
        un_checked_children="关",
        on_change=e => emit(SetOn(e.bool())),
      ),
      label("Model.on = \{model.on}"),
    ]),
    cell("Checkbox", [
      @antd.checkbox(
        checked=model.agree,
        on_change=e => emit(SetAgree(checked_of(e))),
        "我同意",
      ),
      label("Model.agree = \{model.agree}"),
    ]),
    cell("Slider", [
      @antd.slider(
        value=jstr_num(model.num),
        on_change=e => emit(SetNum(e.num())),
        marks=json_marks,
      ),
    ]),
    cell("Rate", [
      @antd.rate(
        value=model.rate,
        allow_half=true,
        on_change=e => emit(SetNum(e.num())),
      ),
    ]),
    // ── 日期与时间 ────────────────────────────────────────────────────────
    cell("DatePicker", [
      label("占位文案；值要在真浏览器里点开面版才有 —— 见 README 的已知限制"),
      @antd.date_picker(
        placeholder="选个日期",
        on_change=_ => emit(Fired("DatePicker.onChange")),
      ),
    ]),
    cell("TimePicker", [
      @antd.time_picker(
        on_change=_ => emit(Fired("TimePicker.onChange")),
      ),
    ]),
    cell("ColorPicker", [
      @antd.color_picker(
        value=jstr("#1677ff"),
        on_change=_ => emit(Fired("ColorPicker.onChange")),
        ([] : Array[@html.Html]),
      ),
    ]),
    cell("Upload", [
      @antd.upload(
        list_type="picture",
        multiple=true,
        on_change=_ => emit(Fired("Upload.onChange")),
        [
          @antd.button(icon="↑", "选择文件"),
        ],
      ),
    ]),
    cell("Transfer", [
      @antd.transfer(
        data_source=json_transfer,
        target_keys=json_empty_array,
        titles=json_transfer_titles,
        ([] : Array[@html.Html]),
      ),
    ]),
    // ── 表单：**复合子组件** `Form.Item` 在这里第一次派上用场 ────────────────
    cell("Form", [
      @antd.form(
        layout="vertical",
        on_finish=_ => emit(Fired("Form.onFinish")),
        [
          @antd.form_item(label="姓名", [
            @antd.input(placeholder="姓名", ([] : Array[@html.Html])),
          ]),
          @antd.form_item([
            @antd.button(html_type="submit", type_="primary", "提交表单"),
          ]),
        ],
      ),
    ]),
  ]
}

///|
/// `Checkbox` 的 `onChange` 递回来的是**事件对象**（`CheckboxChangeEvent`），
/// 于是要按字段挖：`e.target.checked`。
///
/// 这一条是"载荷不透明 + 只给提取器"那个设计的**兑现点**：
/// 同一份提取器代码在 DOM 上是 `e.target.checked`、在 RN 上可能是直接的 `Bool`，
/// 而这里两种形态都能读出来（`Payload::field` 走不到时给 `false`，不抛）。
fn checked_of(e : @html.Payload) -> Bool {
  e.field("target").field("checked").bool()
}

///|
/// `prop_json` 要求**合法的 JSON 文本**。字符串要加引号并按 JSON 规则转义。
///
/// 为什么要转义而不是 `"\"" + s + "\""`：`Input.value` 的内容是**用户输入的**
/// （demo 里就是自己打进去的字），用户打一个引号就会生成非法 JSON ——
/// 而非法 JSON 的表现是宿主那边 `JSON.parse` 抛错，离现场已经隔了整整一层。
///
/// 为什么不用 `moonbitlang/core/json`：本仓库的 `moon.pkg` 里 `@json` 这个名字取不到
/// （`moon check` 报 "The type/trait @json.Json is not found"），而这里要的只是
/// 一个**字符串字面量编码**，五条转义规则就是全部，没必要为它去动包的依赖面。
fn jstr(s : String) -> String {
  let buf = StringBuilder::new()
  buf.write_char('"')
  for c in s {
    match c {
      '"' => buf.write_string("\\\"")
      '\\' => buf.write_string("\\\\")
      '\n' => buf.write_string("\\n")
      '\r' => buf.write_string("\\r")
      '\t' => buf.write_string("\\t")
      _ => buf.write_char(c)
    }
  }
  buf.write_char('"')
  buf.to_string()
}

///|
/// 数值走 JSON 通道时的编码（`Slider.value` 的类型是 `number | number[]`）。
fn jstr_num(d : Double) -> String {
  "\{d}"
}
