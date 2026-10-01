///|
/// gallery 之三：**反馈 + 导航**（14 个组件）。
///
/// 这一段把"弹层类"集中起来：`Modal` / `Drawer` / `Popconfirm` / `Dropdown` / `Tour`
/// 渲染到 **portal**（React 的 SSR 不支持 portal，`renderToStaticMarkup` 拿不到它们）。
/// 所以 `host/verify.mjs` 对它们的断言分两段：
///   · SSR 阶段：格子存在、组件没把整棵树搞崩；
///   · jsdom 阶段：`open` 的那几个**真的**在 `document.body` 里出现了 `ant-modal` / `ant-drawer`。
///
/// 判据这样切是因为"SSR 里没有"和"根本没渲染"是两件事 —— 不分开就会把前者误判成后者。
fn feedback_cells(model : Model, emit : @cmd.Emit[Msg]) -> Array[@html.Html] {
  [
    cell("Alert", [
      @antd.alert(
        message="这条是 Alert",
        description="描述文本",
        type_="info",
        show_icon=true,
        closable=json_true_str,
      ),
    ]),
    cell("Modal", [
      @antd.button("打开 Modal", on_click=emit(SetModal(true))),
      @antd.modal(
        title="一个 Modal",
        open=model.modal_open,
        on_ok=emit(SetModal(false)),
        on_cancel=emit(SetModal(false)),
        [
          @html.div(attrs=@html.Attrs::build(), "Modal 的内容"),
        ],
      ),
    ]),
    cell("Drawer", [
      @antd.button("打开 Drawer", on_click=emit(SetDrawer(true))),
      @antd.drawer(
        title="一个 Drawer",
        open=model.drawer_open,
        on_close=emit(SetDrawer(false)),
        [
          @html.div(attrs=@html.Attrs::build(), "Drawer 的内容"),
        ],
      ),
    ]),
    cell("Popconfirm", [
      @antd.popconfirm(
        title=json_popconfirm_title,
        ok_text="确定",
        cancel_text="取消",
        [
          @antd.button("删除"),
        ],
      ),
    ]),
    cell("Dropdown", [
      @antd.dropdown(menu=json_dropdown_menu, [
        @antd.button("下拉菜单"),
      ]),
    ]),
    cell("Result", [
      @antd.result(
        status="success",
        title="成功了",
        sub_title="副标题在这里",
        ([] : Array[@html.Html]),
      ),
    ]),
    cell("Pagination", [
      @antd.pagination(
        current=model.page.to_double(),
        total=120.0,
        page_size=10.0,
        on_change=e => emit(SetPage(e.num().to_int())),
      ),
    ]),
    cell("Steps", [
      @antd.steps(
        items=json_steps,
        current=model.step.to_double(),
        on_change=e => emit(SetStep(e.num().to_int())),
      ),
    ]),
    cell("Breadcrumb", [
      @antd.breadcrumb(items=json_breadcrumb, separator="/", ([] : Array[@html.Html])),
    ]),
    cell("Menu", [
      @antd.menu(items=json_menu, mode="horizontal", selected_keys=json_menu_selected, ([] : Array[@html.Html])),
    ]),
    cell("Anchor", [
      @antd.anchor(items=json_anchor_items, ([] : Array[@html.Html])),
    ]),
    cell("Affix", [
      @antd.affix(offset_top=8.0, [
        @antd.button("吸顶按钮"),
      ]),
    ]),
    cell("BackTop", [
      @antd.back_top(visibility_height=100.0),
    ]),
    cell("FloatButton", [
      @antd.float_button(icon="★", description="浮球", type_="primary"),
    ]),
  ]
}

/// 喂 `Popconfirm`：`title`
let json_popconfirm_title : String = "确定要删除吗？"

/// 喂 `Dropdown`：`menu.items`
let json_dropdown_menu : String = "{\"items\":[{\"key\":\"d1\",\"label\":\"动作一\"},{\"key\":\"d2\",\"label\":\"动作二\"}]}"

/// 喂 `Menu`：`selectedKeys`
let json_menu_selected : String = "[\"m1\"]"

/// 喂 `Anchor`：`items`
let json_anchor_items : String = "[{\"key\":\"a1\",\"href\":\"#top\",\"title\":\"顶部\"}]"
