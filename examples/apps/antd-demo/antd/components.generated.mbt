// 由 `moobile-host libgen` 生成 —— **不要手改**。
//
// 组件库：antd@6.6.4（命名空间 `antd:`）
// 生成器：moobile-host libgen 0.4.0｜manifest 版本 1
// 组件 71 个｜生成的参数 4965 个｜未生成 4354 个
//
// ## 怎么用
//
// ```moonbit
// @antd.button(type_="primary", danger=true, on_click=emit(Bump), "加一条")
// @antd.input(value=model.draft, on_change=e => emit(SetDraft(e.text())))
// ```
//
// ## 五条边界（都是实测的，不是猜测）
//
// 1. **写错 prop 名 = 编译错误**（这正是生成这套东西的主要收益）。
// 2. 名字**必须小写**：`pub fn Button(...)` 是 parse error（大写开头是类型名）。
// 3. 事件的两种参数形态：
//    · `on_click? : @cmd.Cmd` —— **信号**（鼠标/键盘/焦点…，载荷里没有"组件的值"）；
//    · `on_change? : (@html.Payload) -> @cmd.Cmd` —— **带值**（`e.text()` / `e.bool()` / `e.json()`）。
//    分类逐条写在 manifest 的 `event_kind` / `event_reason` 里，可复核。
// 4. **逃生口是 `attrs?`**：
//    · 没生成的 prop（React 公共属性的长尾、`aria-*`、`data-*`）→ `attrs=@html.Attrs::build().prop_str(...)`；
//    · 信号事件想读载荷（例如 `onKeyDown` 的按键）→ `attrs=@html.Attrs::build().on_raw("onKeyDown", …)`；
//    · 继承链解不开的基类 prop 也只能这么写。
// 5. **`children` 有两种形态**：默认是子节点（`children : C`，`C : @html.IsChildren`），
//    而"把 children 当数据用"的组件（markdown 渲染器这类）是**原始字符串** ——
//    那些函数的参数写成 `children : String`，字符串原样落到组件的 prop 上。
//    哪些组件属于后者写在 manifest 的 `content` 里（类型定义多半看不出这件事）。
//
// 底层仍然是"字符串标签 + 命名空间"（`@html.node("antd:X", …)`）：
// 生成器只是把这层写法抹掉了。名字指向哪个真实实现，仍然由宿主注册表决定 ——
// 这正是平台矩阵（同一命名空间按平台注册不同实现）还能成立的原因。

// ── 包内私有助手：把 `match Some/None` 收进一个地方 ─────────────────────────
// 为什么要它们：不加的话，2693 个参数要摊开 1.5 万行 `match`。
// 它们**不是**公开 API（没有 `pub`），所以不会变成"我们承诺的接口面"。

///|
fn opt_str(a : @html.Attrs, key : String, v : String?) -> @html.Attrs {
  match v {
    Some(x) => a.prop_str(key, x)
    None => a
  }
}

///|
fn opt_bool(a : @html.Attrs, key : String, v : Bool?) -> @html.Attrs {
  match v {
    Some(x) => a.prop_bool(key, x)
    None => a
  }
}

///|
fn opt_num(a : @html.Attrs, key : String, v : Double?) -> @html.Attrs {
  match v {
    Some(x) => a.prop_num(key, x)
    None => a
  }
}

///|
/// 结构化值走 **JSON 文本**（`Payload` 之外的既有限制：`Attrs` 的值域只有
/// String / Bool / Int / Double）。宿主按 manifest 的 `jsonProps` 做 `JSON.parse`。
fn opt_json(a : @html.Attrs, key : String, v : String?) -> @html.Attrs {
  match v {
    Some(x) => a.prop_json(key, x)
    None => a
  }
}

///|
fn opt_cmd(a : @html.Attrs, key : String, v : @cmd.Cmd?) -> @html.Attrs {
  match v {
    Some(c) => a.on_raw(key, _ => c)
    None => a
  }
}

///|
fn opt_payload(a : @html.Attrs, key : String, v : ((@html.Payload) -> @cmd.Cmd)?) -> @html.Attrs {
  match v {
    Some(f) => a.on_raw(key, f)
    None => a
  }
}
///|
/// 组件库 `antd:Affix`（Props 接口 `AffixProps`）。
///
/// 参数 6 个（清单里另有 3 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] affix(
  offset_top? : Double,
  offset_bottom? : Double,
  style? : String,
  target? : String,
  class_name? : String,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_num(a, "offsetTop", offset_top)
  a = opt_num(a, "offsetBottom", offset_bottom)
  a = opt_json(a, "style", style)
  a = opt_str(a, "target", target)
  a = opt_str(a, "className", class_name)
  a = opt_payload(a, "onChange", on_change)
  @html.node("antd:Affix", a, children)
}

///|
/// 组件库 `antd:Alert`（Props 接口 `AlertProps`）。
///
/// 参数 20 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn alert(
  type_? : String,
  variant? : String,
  closable? : String,
  close_text? : String,
  title? : String,
  message? : String,
  description? : String,
  show_icon? : Bool,
  role? : String,
  style? : String,
  class_name? : String,
  banner? : Bool,
  icon? : String,
  close_icon? : String,
  action? : String,
  id? : String,
  on_close? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "type", type_)
  a = opt_str(a, "variant", variant)
  a = opt_json(a, "closable", closable)
  a = opt_str(a, "closeText", close_text)
  a = opt_str(a, "title", title)
  a = opt_str(a, "message", message)
  a = opt_str(a, "description", description)
  a = opt_bool(a, "showIcon", show_icon)
  a = opt_str(a, "role", role)
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "banner", banner)
  a = opt_str(a, "icon", icon)
  a = opt_str(a, "closeIcon", close_icon)
  a = opt_str(a, "action", action)
  a = opt_str(a, "id", id)
  a = opt_cmd(a, "onClose", on_close)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onClick", on_click)
  @html.node("antd:Alert", a, ([] : Array[@html.Html]))
}

///|
/// 复合子组件 `antd:Alert.ErrorBoundary`（Props 接口 `ErrorBoundaryProps`）。
///
/// 参数 4 个（清单里另有 1 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] alert_error_boundary(
  title? : String,
  message? : String,
  description? : String,
  id? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "title", title)
  a = opt_str(a, "message", message)
  a = opt_str(a, "description", description)
  a = opt_str(a, "id", id)
  @html.node("antd:Alert.ErrorBoundary", a, children)
}

///|
/// 组件库 `antd:Anchor`（Props 接口 `AnchorProps`）。
///
/// 参数 11 个（清单里另有 8 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] anchor(
  class_name? : String,
  style? : String,
  offset_top? : Double,
  bounds? : Double,
  affix? : String,
  show_ink_in_fixed? : Bool,
  target_offset? : Double,
  items? : String,
  replace? : Bool,
  on_click? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_num(a, "offsetTop", offset_top)
  a = opt_num(a, "bounds", bounds)
  a = opt_json(a, "affix", affix)
  a = opt_bool(a, "showInkInFixed", show_ink_in_fixed)
  a = opt_num(a, "targetOffset", target_offset)
  a = opt_json(a, "items", items)
  a = opt_bool(a, "replace", replace)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_payload(a, "onChange", on_change)
  @html.node("antd:Anchor", a, children)
}

///|
/// 复合子组件 `antd:Anchor.Link`（Props 接口 `AnchorLinkProps`）。
///
/// 参数 6 个（清单里另有 2 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] anchor_link(
  href? : String,
  target? : String,
  title? : String,
  class_name? : String,
  replace? : Bool,
  target_offset? : Double,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "href", href)
  a = opt_str(a, "target", target)
  a = opt_str(a, "title", title)
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "replace", replace)
  a = opt_num(a, "targetOffset", target_offset)
  @html.node("antd:Anchor.Link", a, children)
}

///|
/// 组件库 `antd:App`（Props 接口 `AppProps`）。
///
/// 参数 4 个（清单里另有 4 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] app(
  message? : String,
  notification? : String,
  style? : String,
  class_name? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "message", message)
  a = opt_json(a, "notification", notification)
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  @html.node("antd:App", a, children)
}

///|
/// 组件库 `antd:AutoComplete`（Props 接口 `AutoCompleteProps`）。
///
/// 参数 83 个（清单里另有 65 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] auto_complete(
  id? : String,
  omit_dom_props? : String,
  display_values? : String,
  active_value? : String,
  active_descendant_id? : String,
  search_value? : String,
  auto_clear_search_value? : Bool,
  option_list? : String,
  empty_options? : Bool,
  role? : String,
  class_name? : String,
  style? : String,
  auto_focus? : Bool,
  placeholder? : String,
  max_count? : Double,
  title? : String,
  tab_index? : Double,
  not_found_content? : String,
  max_length? : Double,
  show_scroll_bar? : String,
  choice_transition_name? : String,
  disabled? : Bool,
  open? : Bool,
  default_open? : Bool,
  max_tag_text_length? : Double,
  max_tag_count? : String,
  max_tag_placeholder? : String,
  token_separators? : String,
  allow_clear? : String,
  prefix? : String,
  suffix_icon? : String,
  suffix? : String,
  clear_icon? : String,
  remove_icon? : String,
  animation? : String,
  transition_name? : String,
  popup_match_select_width? : Double,
  popup_align? : String,
  placement? : String,
  builtin_placements? : String,
  show_action? : String,
  components? : String,
  backfill? : Bool,
  field_names? : String,
  filter_option? : Bool,
  options? : String,
  default_active_first_option? : Bool,
  virtual? : Bool,
  list_height? : Double,
  list_item_height? : Double,
  menu_item_selected_icon? : String,
  value? : String,
  default_value? : String,
  size? : String,
  bordered? : Bool,
  show_arrow? : Bool,
  variant? : String,
  loading_icon? : String,
  data_source? : String,
  status? : String,
  dropdown_match_select_width? : Double,
  show_search? : String,
  on_display_values_change? : (@html.Payload) -> @cmd.Cmd,
  on_active_value_change? : (@html.Payload) -> @cmd.Cmd,
  on_search? : (@html.Payload) -> @cmd.Cmd,
  on_search_split? : (@html.Payload) -> @cmd.Cmd,
  on_clear? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_popup_scroll? : @cmd.Cmd,
  on_input_key_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_select? : (@html.Payload) -> @cmd.Cmd,
  on_deselect? : (@html.Payload) -> @cmd.Cmd,
  on_active? : (@html.Payload) -> @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_dropdown_visible_change? : (@html.Payload) -> @cmd.Cmd,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "id", id)
  a = opt_json(a, "omitDomProps", omit_dom_props)
  a = opt_json(a, "displayValues", display_values)
  a = opt_str(a, "activeValue", active_value)
  a = opt_str(a, "activeDescendantId", active_descendant_id)
  a = opt_str(a, "searchValue", search_value)
  a = opt_bool(a, "autoClearSearchValue", auto_clear_search_value)
  a = opt_json(a, "OptionList", option_list)
  a = opt_bool(a, "emptyOptions", empty_options)
  a = opt_str(a, "role", role)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "placeholder", placeholder)
  a = opt_num(a, "maxCount", max_count)
  a = opt_str(a, "title", title)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_str(a, "notFoundContent", not_found_content)
  a = opt_num(a, "maxLength", max_length)
  a = opt_str(a, "showScrollBar", show_scroll_bar)
  a = opt_str(a, "choiceTransitionName", choice_transition_name)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "open", open)
  a = opt_bool(a, "defaultOpen", default_open)
  a = opt_num(a, "maxTagTextLength", max_tag_text_length)
  a = opt_str(a, "maxTagCount", max_tag_count)
  a = opt_str(a, "maxTagPlaceholder", max_tag_placeholder)
  a = opt_json(a, "tokenSeparators", token_separators)
  a = opt_json(a, "allowClear", allow_clear)
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffixIcon", suffix_icon)
  a = opt_str(a, "suffix", suffix)
  a = opt_str(a, "clearIcon", clear_icon)
  a = opt_str(a, "removeIcon", remove_icon)
  a = opt_str(a, "animation", animation)
  a = opt_str(a, "transitionName", transition_name)
  a = opt_num(a, "popupMatchSelectWidth", popup_match_select_width)
  a = opt_json(a, "popupAlign", popup_align)
  a = opt_str(a, "placement", placement)
  a = opt_json(a, "builtinPlacements", builtin_placements)
  a = opt_json(a, "showAction", show_action)
  a = opt_json(a, "components", components)
  a = opt_bool(a, "backfill", backfill)
  a = opt_json(a, "fieldNames", field_names)
  a = opt_bool(a, "filterOption", filter_option)
  a = opt_json(a, "options", options)
  a = opt_bool(a, "defaultActiveFirstOption", default_active_first_option)
  a = opt_bool(a, "virtual", virtual)
  a = opt_num(a, "listHeight", list_height)
  a = opt_num(a, "listItemHeight", list_item_height)
  a = opt_str(a, "menuItemSelectedIcon", menu_item_selected_icon)
  a = opt_json(a, "value", value)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "bordered", bordered)
  a = opt_bool(a, "showArrow", show_arrow)
  a = opt_str(a, "variant", variant)
  a = opt_str(a, "loadingIcon", loading_icon)
  a = opt_json(a, "dataSource", data_source)
  a = opt_str(a, "status", status)
  a = opt_num(a, "dropdownMatchSelectWidth", dropdown_match_select_width)
  a = opt_json(a, "showSearch", show_search)
  a = opt_payload(a, "onDisplayValuesChange", on_display_values_change)
  a = opt_payload(a, "onActiveValueChange", on_active_value_change)
  a = opt_payload(a, "onSearch", on_search)
  a = opt_payload(a, "onSearchSplit", on_search_split)
  a = opt_cmd(a, "onClear", on_clear)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onPopupScroll", on_popup_scroll)
  a = opt_cmd(a, "onInputKeyDown", on_input_key_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_payload(a, "onSelect", on_select)
  a = opt_payload(a, "onDeselect", on_deselect)
  a = opt_payload(a, "onActive", on_active)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onDropdownVisibleChange", on_dropdown_visible_change)
  a = opt_payload(a, "onOpenChange", on_open_change)
  @html.node("antd:AutoComplete", a, children)
}

///|
/// 复合子组件 `antd:AutoComplete.Option`（Props 接口 `无（只有 attrs?）`）。
///
/// 参数 0 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 这个子组件**没找到 props 接口**（生成器只在它自己的模块里找，不跨组件猜）——
/// 于是只有 `attrs?`：prop 得手写（`@html.Attrs::build().prop_str(…)`），没有编译期检查。
pub fn[C : @html.IsChildren] auto_complete_option(
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  @html.node("antd:AutoComplete.Option", a, children)
}

///|
/// 组件库 `antd:Avatar`（Props 接口 `AvatarProps`）。
///
/// 参数 13 个（清单里另有 3 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] avatar(
  shape? : String,
  size? : String,
  gap? : Double,
  src? : String,
  src_set? : String,
  draggable? : String,
  icon? : String,
  style? : String,
  class_name? : String,
  alt? : String,
  cross_origin? : String,
  on_click? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "shape", shape)
  a = opt_json(a, "size", size)
  a = opt_num(a, "gap", gap)
  a = opt_str(a, "src", src)
  a = opt_str(a, "srcSet", src_set)
  a = opt_str(a, "draggable", draggable)
  a = opt_str(a, "icon", icon)
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "alt", alt)
  a = opt_str(a, "crossOrigin", cross_origin)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onError", on_error)
  @html.node("antd:Avatar", a, children)
}

///|
/// 复合子组件 `antd:Avatar.Group`（Props 接口 `AvatarGroupProps`）。
///
/// 参数 9 个（清单里另有 3 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] avatar_group(
  class_name? : String,
  style? : String,
  max_count? : Double,
  max_style? : String,
  max_popover_placement? : String,
  max_popover_trigger? : String,
  max? : String,
  size? : String,
  shape? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_num(a, "maxCount", max_count)
  a = opt_json(a, "maxStyle", max_style)
  a = opt_str(a, "maxPopoverPlacement", max_popover_placement)
  a = opt_str(a, "maxPopoverTrigger", max_popover_trigger)
  a = opt_json(a, "max", max)
  a = opt_json(a, "size", size)
  a = opt_str(a, "shape", shape)
  @html.node("antd:Avatar.Group", a, children)
}

///|
/// 组件库 `antd:BackTop`（Props 接口 `BackTopProps`）。
///
/// 参数 5 个（清单里另有 4 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] back_top(
  visibility_height? : Double,
  class_name? : String,
  style? : String,
  duration? : Double,
  on_click? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_num(a, "visibilityHeight", visibility_height)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_num(a, "duration", duration)
  a = opt_cmd(a, "onClick", on_click)
  @html.node("antd:BackTop", a, children)
}

///|
/// 组件库 `antd:Badge`（Props 接口 `BadgeProps`）。
///
/// 参数 72 个（清单里另有 80 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] badge(
  class_name? : String,
  style? : String,
  id? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  color? : String,
  count? : String,
  show_zero? : Bool,
  overflow_count? : Double,
  dot? : Bool,
  scroll_number_prefix_cls? : String,
  status? : String,
  text? : String,
  size? : String,
  offset? : String,
  title? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "color", color)
  a = opt_str(a, "count", count)
  a = opt_bool(a, "showZero", show_zero)
  a = opt_num(a, "overflowCount", overflow_count)
  a = opt_bool(a, "dot", dot)
  a = opt_str(a, "scrollNumberPrefixCls", scroll_number_prefix_cls)
  a = opt_str(a, "status", status)
  a = opt_str(a, "text", text)
  a = opt_str(a, "size", size)
  a = opt_json(a, "offset", offset)
  a = opt_str(a, "title", title)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Badge", a, children)
}

///|
/// 复合子组件 `antd:Badge.Ribbon`（Props 接口 `RibbonProps`）。
///
/// 参数 5 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] badge_ribbon(
  class_name? : String,
  style? : String,
  text? : String,
  color? : String,
  placement? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "text", text)
  a = opt_str(a, "color", color)
  a = opt_str(a, "placement", placement)
  @html.node("antd:Badge.Ribbon", a, children)
}

///|
/// 组件库 `antd:BorderBeam`（Props 接口 `BorderBeamProps`）。
///
/// 参数 8 个（清单里另有 2 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] border_beam(
  class_name? : String,
  style? : String,
  color? : String,
  count? : Double,
  duration? : Double,
  line_width? : String,
  outset? : String,
  size? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_json(a, "color", color)
  a = opt_num(a, "count", count)
  a = opt_num(a, "duration", duration)
  a = opt_str(a, "lineWidth", line_width)
  a = opt_str(a, "outset", outset)
  a = opt_str(a, "size", size)
  @html.node("antd:BorderBeam", a, children)
}

///|
/// 组件库 `antd:Breadcrumb`（Props 接口 `BreadcrumbProps`）。
///
/// 参数 7 个（清单里另有 6 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] breadcrumb(
  params? : String,
  separator? : String,
  dropdown_icon? : String,
  style? : String,
  class_name? : String,
  routes? : String,
  items? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "params", params)
  a = opt_str(a, "separator", separator)
  a = opt_str(a, "dropdownIcon", dropdown_icon)
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "routes", routes)
  a = opt_json(a, "items", items)
  @html.node("antd:Breadcrumb", a, children)
}

///|
/// 复合子组件 `antd:Breadcrumb.Item`（Props 接口 `BreadcrumbItemProps`）。
///
/// 参数 8 个（清单里另有 3 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] breadcrumb_item(
  separator? : String,
  href? : String,
  menu? : String,
  dropdown_props? : String,
  dropdown_icon? : String,
  class_name? : String,
  style? : String,
  on_click? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "separator", separator)
  a = opt_str(a, "href", href)
  a = opt_json(a, "menu", menu)
  a = opt_json(a, "dropdownProps", dropdown_props)
  a = opt_str(a, "dropdownIcon", dropdown_icon)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_cmd(a, "onClick", on_click)
  @html.node("antd:Breadcrumb.Item", a, children)
}

///|
/// 复合子组件 `antd:Breadcrumb.Separator`（Props 接口 `无（只有 attrs?）`）。
///
/// 参数 0 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 这个子组件**没找到 props 接口**（生成器只在它自己的模块里找，不跨组件猜）——
/// 于是只有 `attrs?`：prop 得手写（`@html.Attrs::build().prop_str(…)`），没有编译期检查。
pub fn[C : @html.IsChildren] breadcrumb_separator(
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  @html.node("antd:Breadcrumb.Separator", a, children)
}

///|
/// 组件库 `antd:Button`（Props 接口 `ButtonProps`）。
///
/// 参数 83 个（清单里另有 91 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] button(
  type_? : String,
  color? : String,
  variant? : String,
  icon? : String,
  icon_position? : String,
  icon_placement? : String,
  shape? : String,
  size? : String,
  disabled? : Bool,
  loading? : String,
  class_name? : String,
  ghost? : Bool,
  danger? : Bool,
  block? : Bool,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  name? : String,
  value? : String,
  download? : String,
  href? : String,
  rel? : String,
  target? : String,
  html_type? : String,
  auto_insert_space? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "type", type_)
  a = opt_str(a, "color", color)
  a = opt_str(a, "variant", variant)
  a = opt_str(a, "icon", icon)
  a = opt_str(a, "iconPosition", icon_position)
  a = opt_str(a, "iconPlacement", icon_placement)
  a = opt_str(a, "shape", shape)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "disabled", disabled)
  a = opt_json(a, "loading", loading)
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "ghost", ghost)
  a = opt_bool(a, "danger", danger)
  a = opt_bool(a, "block", block)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "name", name)
  a = opt_json(a, "value", value)
  a = opt_json(a, "download", download)
  a = opt_str(a, "href", href)
  a = opt_str(a, "rel", rel)
  a = opt_str(a, "target", target)
  a = opt_str(a, "htmlType", html_type)
  a = opt_bool(a, "autoInsertSpace", auto_insert_space)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Button", a, children)
}

///|
/// 组件库 `antd:Calendar`（Props 接口 `CalendarProps`）。
///
/// 参数 11 个（清单里另有 13 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn calendar(
  class_name? : String,
  style? : String,
  valid_range? : String,
  value? : String,
  default_value? : String,
  mode? : String,
  fullscreen? : Bool,
  show_week? : Bool,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_panel_change? : (@html.Payload) -> @cmd.Cmd,
  on_select? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_json(a, "validRange", valid_range)
  a = opt_json(a, "value", value)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_str(a, "mode", mode)
  a = opt_bool(a, "fullscreen", fullscreen)
  a = opt_bool(a, "showWeek", show_week)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onPanelChange", on_panel_change)
  a = opt_payload(a, "onSelect", on_select)
  @html.node("antd:Calendar", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Card`（Props 接口 `CardProps`）。
///
/// 参数 79 个（清单里另有 81 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] card(
  class_name? : String,
  style? : String,
  id? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  title? : String,
  extra? : String,
  bordered? : Bool,
  head_style? : String,
  body_style? : String,
  loading? : Bool,
  hoverable? : Bool,
  size? : String,
  type_? : String,
  cover? : String,
  actions? : String,
  tab_list? : String,
  tab_bar_extra_content? : String,
  active_tab_key? : String,
  default_active_tab_key? : String,
  tab_props? : String,
  variant? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_tab_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "title", title)
  a = opt_str(a, "extra", extra)
  a = opt_bool(a, "bordered", bordered)
  a = opt_json(a, "headStyle", head_style)
  a = opt_json(a, "bodyStyle", body_style)
  a = opt_bool(a, "loading", loading)
  a = opt_bool(a, "hoverable", hoverable)
  a = opt_str(a, "size", size)
  a = opt_str(a, "type", type_)
  a = opt_str(a, "cover", cover)
  a = opt_json(a, "actions", actions)
  a = opt_json(a, "tabList", tab_list)
  a = opt_json(a, "tabBarExtraContent", tab_bar_extra_content)
  a = opt_str(a, "activeTabKey", active_tab_key)
  a = opt_str(a, "defaultActiveTabKey", default_active_tab_key)
  a = opt_json(a, "tabProps", tab_props)
  a = opt_str(a, "variant", variant)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_payload(a, "onTabChange", on_tab_change)
  @html.node("antd:Card", a, children)
}

///|
/// 复合子组件 `antd:Card.Grid`（Props 接口 `CardGridProps`）。
///
/// 参数 63 个（清单里另有 78 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] card_grid(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  hoverable? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_bool(a, "hoverable", hoverable)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Card.Grid", a, children)
}

///|
/// 复合子组件 `antd:Card.Meta`（Props 接口 `CardMetaProps`）。
///
/// 参数 5 个（清单里另有 3 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn card_meta(
  style? : String,
  class_name? : String,
  avatar? : String,
  title? : String,
  description? : String,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "avatar", avatar)
  a = opt_str(a, "title", title)
  a = opt_str(a, "description", description)
  @html.node("antd:Card.Meta", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Carousel`（Props 接口 `CarouselProps`）。
///
/// 参数 53 个（清单里另有 8 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] carousel(
  accessibility? : String,
  adaptive_height? : String,
  arrows? : String,
  as_nav_for? : String,
  autoplay_speed? : String,
  center_mode? : String,
  center_padding? : String,
  class_name? : String,
  css_ease? : String,
  draggable? : String,
  easing? : String,
  edge_friction? : String,
  fade? : String,
  focus_on_select? : String,
  infinite? : String,
  initial_slide? : String,
  lazy_load? : String,
  next_arrow? : String,
  pause_on_dots_hover? : String,
  pause_on_focus? : String,
  pause_on_hover? : String,
  prev_arrow? : String,
  responsive? : String,
  rows? : String,
  rtl? : String,
  slide? : String,
  slides_per_row? : String,
  slides_to_scroll? : String,
  slides_to_show? : String,
  speed? : String,
  swipe_to_slide? : String,
  swipe? : String,
  touch_move? : String,
  touch_threshold? : String,
  use_css? : String,
  use_transform? : String,
  variable_width? : String,
  vertical? : String,
  vertical_swiping? : String,
  wait_for_animate? : Bool,
  effect? : String,
  style? : String,
  id? : String,
  slick_go_to? : Double,
  dot_position? : String,
  dot_placement? : String,
  dots? : String,
  autoplay? : String,
  on_edge? : (@html.Payload) -> @cmd.Cmd,
  on_init? : @cmd.Cmd,
  on_lazy_load? : (@html.Payload) -> @cmd.Cmd,
  on_re_init? : @cmd.Cmd,
  on_swipe? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "accessibility", accessibility)
  a = opt_str(a, "adaptiveHeight", adaptive_height)
  a = opt_str(a, "arrows", arrows)
  a = opt_str(a, "asNavFor", as_nav_for)
  a = opt_str(a, "autoplaySpeed", autoplay_speed)
  a = opt_str(a, "centerMode", center_mode)
  a = opt_str(a, "centerPadding", center_padding)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "cssEase", css_ease)
  a = opt_str(a, "draggable", draggable)
  a = opt_str(a, "easing", easing)
  a = opt_str(a, "edgeFriction", edge_friction)
  a = opt_str(a, "fade", fade)
  a = opt_str(a, "focusOnSelect", focus_on_select)
  a = opt_str(a, "infinite", infinite)
  a = opt_str(a, "initialSlide", initial_slide)
  a = opt_str(a, "lazyLoad", lazy_load)
  a = opt_str(a, "nextArrow", next_arrow)
  a = opt_str(a, "pauseOnDotsHover", pause_on_dots_hover)
  a = opt_str(a, "pauseOnFocus", pause_on_focus)
  a = opt_str(a, "pauseOnHover", pause_on_hover)
  a = opt_str(a, "prevArrow", prev_arrow)
  a = opt_json(a, "responsive", responsive)
  a = opt_str(a, "rows", rows)
  a = opt_str(a, "rtl", rtl)
  a = opt_str(a, "slide", slide)
  a = opt_str(a, "slidesPerRow", slides_per_row)
  a = opt_str(a, "slidesToScroll", slides_to_scroll)
  a = opt_str(a, "slidesToShow", slides_to_show)
  a = opt_str(a, "speed", speed)
  a = opt_str(a, "swipeToSlide", swipe_to_slide)
  a = opt_str(a, "swipe", swipe)
  a = opt_str(a, "touchMove", touch_move)
  a = opt_str(a, "touchThreshold", touch_threshold)
  a = opt_str(a, "useCSS", use_css)
  a = opt_str(a, "useTransform", use_transform)
  a = opt_str(a, "variableWidth", variable_width)
  a = opt_str(a, "vertical", vertical)
  a = opt_str(a, "verticalSwiping", vertical_swiping)
  a = opt_bool(a, "waitForAnimate", wait_for_animate)
  a = opt_str(a, "effect", effect)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_num(a, "slickGoTo", slick_go_to)
  a = opt_str(a, "dotPosition", dot_position)
  a = opt_str(a, "dotPlacement", dot_placement)
  a = opt_json(a, "dots", dots)
  a = opt_json(a, "autoplay", autoplay)
  a = opt_payload(a, "onEdge", on_edge)
  a = opt_cmd(a, "onInit", on_init)
  a = opt_payload(a, "onLazyLoad", on_lazy_load)
  a = opt_cmd(a, "onReInit", on_re_init)
  a = opt_payload(a, "onSwipe", on_swipe)
  @html.node("antd:Carousel", a, children)
}

///|
/// 组件库 `antd:Cascader`（Props 接口 `CascaderProps`）。
///
/// 参数 78 个（清单里另有 68 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] cascader(
  id? : String,
  omit_dom_props? : String,
  display_values? : String,
  active_value? : String,
  active_descendant_id? : String,
  search_value? : String,
  auto_clear_search_value? : Bool,
  option_list? : String,
  empty_options? : Bool,
  role? : String,
  class_name? : String,
  style? : String,
  auto_focus? : Bool,
  placeholder? : String,
  max_count? : Double,
  title? : String,
  tab_index? : Double,
  not_found_content? : String,
  max_length? : Double,
  show_scroll_bar? : String,
  choice_transition_name? : String,
  disabled? : Bool,
  loading? : Bool,
  open? : Bool,
  default_open? : Bool,
  max_tag_text_length? : Double,
  max_tag_count? : String,
  max_tag_placeholder? : String,
  allow_clear? : String,
  prefix? : String,
  suffix_icon? : String,
  suffix? : String,
  clear_icon? : String,
  remove_icon? : String,
  animation? : String,
  transition_name? : String,
  popup_match_select_width? : Double,
  popup_align? : String,
  placement? : String,
  builtin_placements? : String,
  show_action? : String,
  components? : String,
  field_names? : String,
  change_on_select? : Bool,
  show_search? : String,
  expand_trigger? : String,
  options? : String,
  popup_menu_column_style? : String,
  expand_icon? : String,
  loading_icon? : String,
  value? : String,
  default_value? : String,
  multiple? : String,
  size? : String,
  show_arrow? : Bool,
  bordered? : Bool,
  status? : String,
  dropdown_menu_column_style? : String,
  variant? : String,
  on_display_values_change? : (@html.Payload) -> @cmd.Cmd,
  on_active_value_change? : (@html.Payload) -> @cmd.Cmd,
  on_search? : (@html.Payload) -> @cmd.Cmd,
  on_search_split? : (@html.Payload) -> @cmd.Cmd,
  on_clear? : @cmd.Cmd,
  on_popup_visible_change? : (@html.Payload) -> @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_popup_scroll? : @cmd.Cmd,
  on_input_key_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_dropdown_visible_change? : (@html.Payload) -> @cmd.Cmd,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "id", id)
  a = opt_json(a, "omitDomProps", omit_dom_props)
  a = opt_json(a, "displayValues", display_values)
  a = opt_str(a, "activeValue", active_value)
  a = opt_str(a, "activeDescendantId", active_descendant_id)
  a = opt_str(a, "searchValue", search_value)
  a = opt_bool(a, "autoClearSearchValue", auto_clear_search_value)
  a = opt_json(a, "OptionList", option_list)
  a = opt_bool(a, "emptyOptions", empty_options)
  a = opt_str(a, "role", role)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "placeholder", placeholder)
  a = opt_num(a, "maxCount", max_count)
  a = opt_str(a, "title", title)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_str(a, "notFoundContent", not_found_content)
  a = opt_num(a, "maxLength", max_length)
  a = opt_str(a, "showScrollBar", show_scroll_bar)
  a = opt_str(a, "choiceTransitionName", choice_transition_name)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "loading", loading)
  a = opt_bool(a, "open", open)
  a = opt_bool(a, "defaultOpen", default_open)
  a = opt_num(a, "maxTagTextLength", max_tag_text_length)
  a = opt_str(a, "maxTagCount", max_tag_count)
  a = opt_str(a, "maxTagPlaceholder", max_tag_placeholder)
  a = opt_json(a, "allowClear", allow_clear)
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffixIcon", suffix_icon)
  a = opt_str(a, "suffix", suffix)
  a = opt_str(a, "clearIcon", clear_icon)
  a = opt_str(a, "removeIcon", remove_icon)
  a = opt_str(a, "animation", animation)
  a = opt_str(a, "transitionName", transition_name)
  a = opt_num(a, "popupMatchSelectWidth", popup_match_select_width)
  a = opt_json(a, "popupAlign", popup_align)
  a = opt_str(a, "placement", placement)
  a = opt_json(a, "builtinPlacements", builtin_placements)
  a = opt_json(a, "showAction", show_action)
  a = opt_json(a, "components", components)
  a = opt_json(a, "fieldNames", field_names)
  a = opt_bool(a, "changeOnSelect", change_on_select)
  a = opt_json(a, "showSearch", show_search)
  a = opt_str(a, "expandTrigger", expand_trigger)
  a = opt_json(a, "options", options)
  a = opt_json(a, "popupMenuColumnStyle", popup_menu_column_style)
  a = opt_str(a, "expandIcon", expand_icon)
  a = opt_str(a, "loadingIcon", loading_icon)
  a = opt_json(a, "value", value)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_json(a, "multiple", multiple)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "showArrow", show_arrow)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "status", status)
  a = opt_json(a, "dropdownMenuColumnStyle", dropdown_menu_column_style)
  a = opt_str(a, "variant", variant)
  a = opt_payload(a, "onDisplayValuesChange", on_display_values_change)
  a = opt_payload(a, "onActiveValueChange", on_active_value_change)
  a = opt_payload(a, "onSearch", on_search)
  a = opt_payload(a, "onSearchSplit", on_search_split)
  a = opt_cmd(a, "onClear", on_clear)
  a = opt_payload(a, "onPopupVisibleChange", on_popup_visible_change)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onPopupScroll", on_popup_scroll)
  a = opt_cmd(a, "onInputKeyDown", on_input_key_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onDropdownVisibleChange", on_dropdown_visible_change)
  a = opt_payload(a, "onOpenChange", on_open_change)
  @html.node("antd:Cascader", a, children)
}

///|
/// 复合子组件 `antd:Cascader.SHOW_PARENT`（Props 接口 `无（只有 attrs?）`）。
///
/// 参数 0 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 这个子组件**没找到 props 接口**（生成器只在它自己的模块里找，不跨组件猜）——
/// 于是只有 `attrs?`：prop 得手写（`@html.Attrs::build().prop_str(…)`），没有编译期检查。
pub fn[C : @html.IsChildren] cascader_show_parent(
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  @html.node("antd:Cascader.SHOW_PARENT", a, children)
}

///|
/// 复合子组件 `antd:Cascader.SHOW_CHILD`（Props 接口 `无（只有 attrs?）`）。
///
/// 参数 0 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 这个子组件**没找到 props 接口**（生成器只在它自己的模块里找，不跨组件猜）——
/// 于是只有 `attrs?`：prop 得手写（`@html.Attrs::build().prop_str(…)`），没有编译期检查。
pub fn[C : @html.IsChildren] cascader_show_child(
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  @html.node("antd:Cascader.SHOW_CHILD", a, children)
}

///|
/// 复合子组件 `antd:Cascader.Panel`（Props 接口 `CascaderPanelProps`）。
///
/// 参数 0 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn cascader_panel(
  attrs? : @html.Attrs,
) -> @html.Html {
  let a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  @html.node("antd:Cascader.Panel", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Checkbox`（Props 接口 `CheckboxProps`）。
///
/// 参数 23 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] checkbox(
  class_name? : String,
  default_checked? : Bool,
  checked? : Bool,
  style? : String,
  disabled? : Bool,
  title? : String,
  value? : String,
  tab_index? : Double,
  name? : String,
  id? : String,
  auto_focus? : Bool,
  type_? : String,
  skip_group? : Bool,
  required? : Bool,
  indeterminate? : Bool,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "defaultChecked", default_checked)
  a = opt_bool(a, "checked", checked)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "title", title)
  a = opt_json(a, "value", value)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_str(a, "name", name)
  a = opt_str(a, "id", id)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "type", type_)
  a = opt_bool(a, "skipGroup", skip_group)
  a = opt_bool(a, "required", required)
  a = opt_bool(a, "indeterminate", indeterminate)
  a = opt_payload(a, "onChange", on_change)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  @html.node("antd:Checkbox", a, children)
}

///|
/// 复合子组件 `antd:Checkbox.Group`（Props 接口 `CheckboxGroupProps`）。
///
/// 参数 9 个（清单里另有 50 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] checkbox_group(
  role? : String,
  class_name? : String,
  options? : String,
  disabled? : Bool,
  style? : String,
  name? : String,
  default_value? : String,
  value? : String,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "role", role)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "options", options)
  a = opt_bool(a, "disabled", disabled)
  a = opt_json(a, "style", style)
  a = opt_str(a, "name", name)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_json(a, "value", value)
  a = opt_payload(a, "onChange", on_change)
  @html.node("antd:Checkbox.Group", a, children)
}

///|
/// 组件库 `antd:Col`（Props 接口 `ColProps`）。
///
/// 参数 68 个（清单里另有 78 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 继承链有 1 环解不开（Partial<Record<Breakpoint, ColSpanType | ColSize>>）——
/// 这些基类上的 prop **不在**参数表里，需要时用 `attrs?` 手写。
pub fn[C : @html.IsChildren] col(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  flex? : String,
  span? : String,
  order? : String,
  offset? : String,
  push? : String,
  pull? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "flex", flex)
  a = opt_str(a, "span", span)
  a = opt_str(a, "order", order)
  a = opt_str(a, "offset", offset)
  a = opt_str(a, "push", push)
  a = opt_str(a, "pull", pull)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Col", a, children)
}

///|
/// 组件库 `antd:Collapse`（Props 接口 `CollapseProps`）。
///
/// 参数 15 个（清单里另有 6 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] collapse(
  items? : String,
  active_key? : String,
  default_active_key? : String,
  accordion? : Bool,
  destroy_inactive_panel? : Bool,
  destroy_on_hidden? : Bool,
  style? : String,
  class_name? : String,
  bordered? : Bool,
  expand_icon_placement? : String,
  expand_icon_position? : String,
  ghost? : Bool,
  size? : String,
  collapsible? : String,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "items", items)
  a = opt_json(a, "activeKey", active_key)
  a = opt_json(a, "defaultActiveKey", default_active_key)
  a = opt_bool(a, "accordion", accordion)
  a = opt_bool(a, "destroyInactivePanel", destroy_inactive_panel)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "expandIconPlacement", expand_icon_placement)
  a = opt_str(a, "expandIconPosition", expand_icon_position)
  a = opt_bool(a, "ghost", ghost)
  a = opt_str(a, "size", size)
  a = opt_str(a, "collapsible", collapsible)
  a = opt_payload(a, "onChange", on_change)
  @html.node("antd:Collapse", a, children)
}

///|
/// 组件库 `antd:ColorPicker`（Props 接口 `ColorPickerProps`）。
///
/// 参数 24 个（清单里另有 9 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] color_picker(
  disabled? : Bool,
  class_name? : String,
  style? : String,
  mode? : String,
  value? : String,
  default_value? : String,
  open? : Bool,
  placement? : String,
  trigger? : String,
  allow_clear? : Bool,
  presets? : String,
  arrow? : String,
  show_text? : Bool,
  size? : String,
  disabled_alpha? : Bool,
  disabled_format? : Bool,
  auto_adjust_overflow? : String,
  destroy_on_hidden? : Bool,
  destroy_tooltip_on_hide? : String,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  on_format_change? : (@html.Payload) -> @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_clear? : @cmd.Cmd,
  on_change_complete? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_json(a, "mode", mode)
  a = opt_json(a, "value", value)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_bool(a, "open", open)
  a = opt_str(a, "placement", placement)
  a = opt_str(a, "trigger", trigger)
  a = opt_bool(a, "allowClear", allow_clear)
  a = opt_json(a, "presets", presets)
  a = opt_json(a, "arrow", arrow)
  a = opt_bool(a, "showText", show_text)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "disabledAlpha", disabled_alpha)
  a = opt_bool(a, "disabledFormat", disabled_format)
  a = opt_json(a, "autoAdjustOverflow", auto_adjust_overflow)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  a = opt_json(a, "destroyTooltipOnHide", destroy_tooltip_on_hide)
  a = opt_payload(a, "onOpenChange", on_open_change)
  a = opt_payload(a, "onFormatChange", on_format_change)
  a = opt_payload(a, "onChange", on_change)
  a = opt_cmd(a, "onClear", on_clear)
  a = opt_payload(a, "onChangeComplete", on_change_complete)
  @html.node("antd:ColorPicker", a, children)
}

///|
/// 组件库 `antd:ConfigProvider`（Props 接口 `ConfigProviderProps`）。
///
/// 参数 90 个（清单里另有 6 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] config_provider(
  icon_prefix_cls? : String,
  csp? : String,
  auto_insert_space_in_button? : Bool,
  variant? : String,
  form? : String,
  input? : String,
  input_password? : String,
  input_search? : String,
  otp? : String,
  input_number? : String,
  text_area? : String,
  select? : String,
  pagination? : String,
  locale? : String,
  component_size? : String,
  component_disabled? : Bool,
  space? : String,
  splitter? : String,
  virtual? : Bool,
  dropdown_match_select_width? : Bool,
  popup_match_select_width? : Bool,
  popup_overflow? : String,
  theme? : String,
  warning? : String,
  alert? : String,
  affix? : String,
  anchor? : String,
  app? : String,
  button? : String,
  calendar? : String,
  carousel? : String,
  cascader? : String,
  tree_select? : String,
  collapse? : String,
  divider? : String,
  drawer? : String,
  typography? : String,
  skeleton? : String,
  spin? : String,
  segmented? : String,
  statistic? : String,
  steps? : String,
  image? : String,
  layout? : String,
  list? : String,
  listy? : String,
  mentions? : String,
  modal? : String,
  progress? : String,
  result? : String,
  slider? : String,
  masonry? : String,
  breadcrumb? : String,
  menu? : String,
  float_button? : String,
  float_button_group? : String,
  checkbox? : String,
  descriptions? : String,
  empty? : String,
  badge? : String,
  border_beam? : String,
  radio? : String,
  rate? : String,
  ribbon? : String,
  switch? : String,
  transfer? : String,
  avatar? : String,
  message? : String,
  tag? : String,
  table? : String,
  card? : String,
  card_meta? : String,
  tabs? : String,
  timeline? : String,
  time_picker? : String,
  upload? : String,
  notification? : String,
  tree? : String,
  color_picker? : String,
  date_picker? : String,
  range_picker? : String,
  dropdown? : String,
  flex? : String,
  wave? : String,
  tour? : String,
  tooltip? : String,
  popover? : String,
  popconfirm? : String,
  watermark? : String,
  qrcode? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "iconPrefixCls", icon_prefix_cls)
  a = opt_json(a, "csp", csp)
  a = opt_bool(a, "autoInsertSpaceInButton", auto_insert_space_in_button)
  a = opt_str(a, "variant", variant)
  a = opt_json(a, "form", form)
  a = opt_json(a, "input", input)
  a = opt_json(a, "inputPassword", input_password)
  a = opt_json(a, "inputSearch", input_search)
  a = opt_json(a, "otp", otp)
  a = opt_json(a, "inputNumber", input_number)
  a = opt_json(a, "textArea", text_area)
  a = opt_json(a, "select", select)
  a = opt_json(a, "pagination", pagination)
  a = opt_json(a, "locale", locale)
  a = opt_str(a, "componentSize", component_size)
  a = opt_bool(a, "componentDisabled", component_disabled)
  a = opt_json(a, "space", space)
  a = opt_json(a, "splitter", splitter)
  a = opt_bool(a, "virtual", virtual)
  a = opt_bool(a, "dropdownMatchSelectWidth", dropdown_match_select_width)
  a = opt_bool(a, "popupMatchSelectWidth", popup_match_select_width)
  a = opt_str(a, "popupOverflow", popup_overflow)
  a = opt_json(a, "theme", theme)
  a = opt_json(a, "warning", warning)
  a = opt_json(a, "alert", alert)
  a = opt_json(a, "affix", affix)
  a = opt_json(a, "anchor", anchor)
  a = opt_json(a, "app", app)
  a = opt_json(a, "button", button)
  a = opt_json(a, "calendar", calendar)
  a = opt_json(a, "carousel", carousel)
  a = opt_json(a, "cascader", cascader)
  a = opt_json(a, "treeSelect", tree_select)
  a = opt_json(a, "collapse", collapse)
  a = opt_json(a, "divider", divider)
  a = opt_json(a, "drawer", drawer)
  a = opt_json(a, "typography", typography)
  a = opt_json(a, "skeleton", skeleton)
  a = opt_json(a, "spin", spin)
  a = opt_json(a, "segmented", segmented)
  a = opt_json(a, "statistic", statistic)
  a = opt_json(a, "steps", steps)
  a = opt_json(a, "image", image)
  a = opt_json(a, "layout", layout)
  a = opt_json(a, "list", list)
  a = opt_json(a, "listy", listy)
  a = opt_json(a, "mentions", mentions)
  a = opt_json(a, "modal", modal)
  a = opt_json(a, "progress", progress)
  a = opt_json(a, "result", result)
  a = opt_json(a, "slider", slider)
  a = opt_json(a, "masonry", masonry)
  a = opt_json(a, "breadcrumb", breadcrumb)
  a = opt_json(a, "menu", menu)
  a = opt_json(a, "floatButton", float_button)
  a = opt_json(a, "floatButtonGroup", float_button_group)
  a = opt_json(a, "checkbox", checkbox)
  a = opt_json(a, "descriptions", descriptions)
  a = opt_json(a, "empty", empty)
  a = opt_json(a, "badge", badge)
  a = opt_json(a, "borderBeam", border_beam)
  a = opt_json(a, "radio", radio)
  a = opt_json(a, "rate", rate)
  a = opt_json(a, "ribbon", ribbon)
  a = opt_json(a, "switch", switch)
  a = opt_json(a, "transfer", transfer)
  a = opt_json(a, "avatar", avatar)
  a = opt_json(a, "message", message)
  a = opt_json(a, "tag", tag)
  a = opt_json(a, "table", table)
  a = opt_json(a, "card", card)
  a = opt_json(a, "cardMeta", card_meta)
  a = opt_json(a, "tabs", tabs)
  a = opt_json(a, "timeline", timeline)
  a = opt_json(a, "timePicker", time_picker)
  a = opt_json(a, "upload", upload)
  a = opt_json(a, "notification", notification)
  a = opt_json(a, "tree", tree)
  a = opt_json(a, "colorPicker", color_picker)
  a = opt_json(a, "datePicker", date_picker)
  a = opt_json(a, "rangePicker", range_picker)
  a = opt_json(a, "dropdown", dropdown)
  a = opt_json(a, "flex", flex)
  a = opt_json(a, "wave", wave)
  a = opt_json(a, "tour", tour)
  a = opt_json(a, "tooltip", tooltip)
  a = opt_json(a, "popover", popover)
  a = opt_json(a, "popconfirm", popconfirm)
  a = opt_json(a, "watermark", watermark)
  a = opt_json(a, "qrcode", qrcode)
  @html.node("antd:ConfigProvider", a, children)
}

///|
/// 复合子组件 `antd:ConfigProvider.ConfigContext`（Props 接口 `ConfigComponentProps`）。
///
/// 参数 77 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn config_provider_config_context(
  input? : String,
  input_password? : String,
  input_search? : String,
  text_area? : String,
  otp? : String,
  input_number? : String,
  pagination? : String,
  space? : String,
  splitter? : String,
  form? : String,
  select? : String,
  alert? : String,
  affix? : String,
  anchor? : String,
  app? : String,
  button? : String,
  divider? : String,
  drawer? : String,
  calendar? : String,
  carousel? : String,
  cascader? : String,
  tree_select? : String,
  collapse? : String,
  float_button? : String,
  float_button_group? : String,
  typography? : String,
  skeleton? : String,
  spin? : String,
  segmented? : String,
  steps? : String,
  statistic? : String,
  image? : String,
  layout? : String,
  list? : String,
  listy? : String,
  mentions? : String,
  modal? : String,
  progress? : String,
  result? : String,
  slider? : String,
  breadcrumb? : String,
  masonry? : String,
  menu? : String,
  checkbox? : String,
  descriptions? : String,
  empty? : String,
  badge? : String,
  border_beam? : String,
  radio? : String,
  rate? : String,
  switch? : String,
  transfer? : String,
  avatar? : String,
  message? : String,
  tag? : String,
  table? : String,
  card? : String,
  card_meta? : String,
  tabs? : String,
  timeline? : String,
  time_picker? : String,
  tour? : String,
  tooltip? : String,
  popover? : String,
  popconfirm? : String,
  upload? : String,
  notification? : String,
  tree? : String,
  color_picker? : String,
  date_picker? : String,
  range_picker? : String,
  ribbon? : String,
  dropdown? : String,
  flex? : String,
  wave? : String,
  qrcode? : String,
  watermark? : String,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "input", input)
  a = opt_json(a, "inputPassword", input_password)
  a = opt_json(a, "inputSearch", input_search)
  a = opt_json(a, "textArea", text_area)
  a = opt_json(a, "otp", otp)
  a = opt_json(a, "inputNumber", input_number)
  a = opt_json(a, "pagination", pagination)
  a = opt_json(a, "space", space)
  a = opt_json(a, "splitter", splitter)
  a = opt_json(a, "form", form)
  a = opt_json(a, "select", select)
  a = opt_json(a, "alert", alert)
  a = opt_json(a, "affix", affix)
  a = opt_json(a, "anchor", anchor)
  a = opt_json(a, "app", app)
  a = opt_json(a, "button", button)
  a = opt_json(a, "divider", divider)
  a = opt_json(a, "drawer", drawer)
  a = opt_json(a, "calendar", calendar)
  a = opt_json(a, "carousel", carousel)
  a = opt_json(a, "cascader", cascader)
  a = opt_json(a, "treeSelect", tree_select)
  a = opt_json(a, "collapse", collapse)
  a = opt_json(a, "floatButton", float_button)
  a = opt_json(a, "floatButtonGroup", float_button_group)
  a = opt_json(a, "typography", typography)
  a = opt_json(a, "skeleton", skeleton)
  a = opt_json(a, "spin", spin)
  a = opt_json(a, "segmented", segmented)
  a = opt_json(a, "steps", steps)
  a = opt_json(a, "statistic", statistic)
  a = opt_json(a, "image", image)
  a = opt_json(a, "layout", layout)
  a = opt_json(a, "list", list)
  a = opt_json(a, "listy", listy)
  a = opt_json(a, "mentions", mentions)
  a = opt_json(a, "modal", modal)
  a = opt_json(a, "progress", progress)
  a = opt_json(a, "result", result)
  a = opt_json(a, "slider", slider)
  a = opt_json(a, "breadcrumb", breadcrumb)
  a = opt_json(a, "masonry", masonry)
  a = opt_json(a, "menu", menu)
  a = opt_json(a, "checkbox", checkbox)
  a = opt_json(a, "descriptions", descriptions)
  a = opt_json(a, "empty", empty)
  a = opt_json(a, "badge", badge)
  a = opt_json(a, "borderBeam", border_beam)
  a = opt_json(a, "radio", radio)
  a = opt_json(a, "rate", rate)
  a = opt_json(a, "switch", switch)
  a = opt_json(a, "transfer", transfer)
  a = opt_json(a, "avatar", avatar)
  a = opt_json(a, "message", message)
  a = opt_json(a, "tag", tag)
  a = opt_json(a, "table", table)
  a = opt_json(a, "card", card)
  a = opt_json(a, "cardMeta", card_meta)
  a = opt_json(a, "tabs", tabs)
  a = opt_json(a, "timeline", timeline)
  a = opt_json(a, "timePicker", time_picker)
  a = opt_json(a, "tour", tour)
  a = opt_json(a, "tooltip", tooltip)
  a = opt_json(a, "popover", popover)
  a = opt_json(a, "popconfirm", popconfirm)
  a = opt_json(a, "upload", upload)
  a = opt_json(a, "notification", notification)
  a = opt_json(a, "tree", tree)
  a = opt_json(a, "colorPicker", color_picker)
  a = opt_json(a, "datePicker", date_picker)
  a = opt_json(a, "rangePicker", range_picker)
  a = opt_json(a, "ribbon", ribbon)
  a = opt_json(a, "dropdown", dropdown)
  a = opt_json(a, "flex", flex)
  a = opt_json(a, "wave", wave)
  a = opt_json(a, "qrcode", qrcode)
  a = opt_json(a, "watermark", watermark)
  @html.node("antd:ConfigProvider.ConfigContext", a, ([] : Array[@html.Html]))
}

///|
/// 复合子组件 `antd:ConfigProvider.SizeContext`（Props 接口 `SizeContextProps`）。
///
/// 参数 1 个（清单里另有 1 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] config_provider_size_context(
  size? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "size", size)
  @html.node("antd:ConfigProvider.SizeContext", a, children)
}

///|
/// 组件库 `antd:DatePicker`（Props 接口 `DatePickerProps`）。
///
/// 参数 62 个（清单里另有 29 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 继承链有 1 环解不开（React.RefAttributes<PickerRef>）——
/// 这些基类上的 prop **不在**参数表里，需要时用 `attrs?` 手写。
pub fn date_picker(
  prev_icon? : String,
  next_icon? : String,
  super_prev_icon? : String,
  super_next_icon? : String,
  class_name? : String,
  style? : String,
  show_time? : String,
  show_week? : Bool,
  format? : String,
  prefix? : String,
  suffix_icon? : String,
  allow_clear? : String,
  clear_icon? : String,
  input_read_only? : Bool,
  order? : Bool,
  default_open? : Bool,
  open? : Bool,
  popup_align? : String,
  placement? : String,
  builtin_placements? : String,
  need_confirm? : Bool,
  change_on_blur? : Bool,
  preserve_invalid_on_blur? : Bool,
  preview_value? : String,
  transition_name? : String,
  components? : String,
  show_now? : Bool,
  show_today? : Bool,
  id? : String,
  multiple? : String,
  remove_icon? : String,
  max_tag_count? : String,
  placeholder? : String,
  default_picker_value? : String,
  picker_value? : String,
  presets? : String,
  disabled? : Bool,
  mode? : String,
  show_hour? : Bool,
  show_minute? : Bool,
  show_second? : Bool,
  show_millisecond? : Bool,
  use12_hours? : Bool,
  hide_disabled_options? : Bool,
  change_on_scroll? : Bool,
  locale? : String,
  size? : String,
  bordered? : Bool,
  status? : String,
  variant? : String,
  default_value? : String,
  value? : String,
  on_clear? : (@html.Payload) -> @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  on_calendar_change? : (@html.Payload) -> @cmd.Cmd,
  on_picker_value_change? : (@html.Payload) -> @cmd.Cmd,
  on_panel_change? : (@html.Payload) -> @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_ok? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "prevIcon", prev_icon)
  a = opt_str(a, "nextIcon", next_icon)
  a = opt_str(a, "superPrevIcon", super_prev_icon)
  a = opt_str(a, "superNextIcon", super_next_icon)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_json(a, "showTime", show_time)
  a = opt_bool(a, "showWeek", show_week)
  a = opt_json(a, "format", format)
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffixIcon", suffix_icon)
  a = opt_json(a, "allowClear", allow_clear)
  a = opt_str(a, "clearIcon", clear_icon)
  a = opt_bool(a, "inputReadOnly", input_read_only)
  a = opt_bool(a, "order", order)
  a = opt_bool(a, "defaultOpen", default_open)
  a = opt_bool(a, "open", open)
  a = opt_json(a, "popupAlign", popup_align)
  a = opt_str(a, "placement", placement)
  a = opt_json(a, "builtinPlacements", builtin_placements)
  a = opt_bool(a, "needConfirm", need_confirm)
  a = opt_bool(a, "changeOnBlur", change_on_blur)
  a = opt_bool(a, "preserveInvalidOnBlur", preserve_invalid_on_blur)
  a = opt_str(a, "previewValue", preview_value)
  a = opt_str(a, "transitionName", transition_name)
  a = opt_json(a, "components", components)
  a = opt_bool(a, "showNow", show_now)
  a = opt_bool(a, "showToday", show_today)
  a = opt_str(a, "id", id)
  a = opt_json(a, "multiple", multiple)
  a = opt_str(a, "removeIcon", remove_icon)
  a = opt_str(a, "maxTagCount", max_tag_count)
  a = opt_str(a, "placeholder", placeholder)
  a = opt_str(a, "defaultPickerValue", default_picker_value)
  a = opt_str(a, "pickerValue", picker_value)
  a = opt_json(a, "presets", presets)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "mode", mode)
  a = opt_bool(a, "showHour", show_hour)
  a = opt_bool(a, "showMinute", show_minute)
  a = opt_bool(a, "showSecond", show_second)
  a = opt_bool(a, "showMillisecond", show_millisecond)
  a = opt_bool(a, "use12Hours", use12_hours)
  a = opt_bool(a, "hideDisabledOptions", hide_disabled_options)
  a = opt_bool(a, "changeOnScroll", change_on_scroll)
  a = opt_json(a, "locale", locale)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "status", status)
  a = opt_str(a, "variant", variant)
  a = opt_str(a, "defaultValue", default_value)
  a = opt_str(a, "value", value)
  a = opt_payload(a, "onClear", on_clear)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_payload(a, "onOpenChange", on_open_change)
  a = opt_payload(a, "onCalendarChange", on_calendar_change)
  a = opt_payload(a, "onPickerValueChange", on_picker_value_change)
  a = opt_payload(a, "onPanelChange", on_panel_change)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onOk", on_ok)
  @html.node("antd:DatePicker", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Descriptions`（Props 接口 `DescriptionsProps`）。
///
/// 参数 71 个（清单里另有 81 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] descriptions(
  class_name? : String,
  style? : String,
  id? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  bordered? : Bool,
  size? : String,
  title? : String,
  extra? : String,
  column? : String,
  layout? : String,
  colon? : Bool,
  label_style? : String,
  content_style? : String,
  items? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "size", size)
  a = opt_str(a, "title", title)
  a = opt_str(a, "extra", extra)
  a = opt_json(a, "column", column)
  a = opt_str(a, "layout", layout)
  a = opt_bool(a, "colon", colon)
  a = opt_json(a, "labelStyle", label_style)
  a = opt_json(a, "contentStyle", content_style)
  a = opt_json(a, "items", items)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Descriptions", a, children)
}

///|
/// 复合子组件 `antd:Descriptions.Item`（Props 接口 `DescriptionsItemProps`）。
///
/// 参数 6 个（清单里另有 4 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] descriptions_item(
  class_name? : String,
  style? : String,
  label? : String,
  label_style? : String,
  content_style? : String,
  span? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "label", label)
  a = opt_json(a, "labelStyle", label_style)
  a = opt_json(a, "contentStyle", content_style)
  a = opt_json(a, "span", span)
  @html.node("antd:Descriptions.Item", a, children)
}

///|
/// 组件库 `antd:Divider`（Props 接口 `DividerProps`）。
///
/// 参数 11 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] divider(
  type_? : String,
  orientation? : String,
  vertical? : Bool,
  title_placement? : String,
  orientation_margin? : String,
  class_name? : String,
  dashed? : Bool,
  variant? : String,
  style? : String,
  size? : String,
  plain? : Bool,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "type", type_)
  a = opt_str(a, "orientation", orientation)
  a = opt_bool(a, "vertical", vertical)
  a = opt_str(a, "titlePlacement", title_placement)
  a = opt_str(a, "orientationMargin", orientation_margin)
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "dashed", dashed)
  a = opt_str(a, "variant", variant)
  a = opt_json(a, "style", style)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "plain", plain)
  @html.node("antd:Divider", a, children)
}

///|
/// 组件库 `antd:Drawer`（Props 接口 `DrawerProps`）。
///
/// 参数 48 个（清单里另有 8 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] drawer(
  open? : Bool,
  push? : String,
  force_render? : Bool,
  keyboard? : Bool,
  auto_focus? : Bool,
  focus_trap? : Bool,
  root_style? : String,
  z_index? : Double,
  placement? : String,
  id? : String,
  class_name? : String,
  style? : String,
  width? : String,
  height? : String,
  size? : String,
  max_size? : Double,
  mask_closable? : Bool,
  mask_class_name? : String,
  motion? : String,
  mask_motion? : String,
  default_size? : String,
  destroy_on_hidden? : Bool,
  get_container? : String,
  focus_trigger_after_close? : Bool,
  title? : String,
  footer? : String,
  extra? : String,
  closable? : String,
  close_icon? : String,
  loading? : Bool,
  header_style? : String,
  body_style? : String,
  footer_style? : String,
  content_wrapper_style? : String,
  mask_style? : String,
  drawer_style? : String,
  resizable? : String,
  destroy_on_close? : Bool,
  mask? : String,
  focusable? : String,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_close? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_bool(a, "open", open)
  a = opt_json(a, "push", push)
  a = opt_bool(a, "forceRender", force_render)
  a = opt_bool(a, "keyboard", keyboard)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_bool(a, "focusTrap", focus_trap)
  a = opt_json(a, "rootStyle", root_style)
  a = opt_num(a, "zIndex", z_index)
  a = opt_str(a, "placement", placement)
  a = opt_str(a, "id", id)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "width", width)
  a = opt_str(a, "height", height)
  a = opt_str(a, "size", size)
  a = opt_num(a, "maxSize", max_size)
  a = opt_bool(a, "maskClosable", mask_closable)
  a = opt_str(a, "maskClassName", mask_class_name)
  a = opt_json(a, "motion", motion)
  a = opt_json(a, "maskMotion", mask_motion)
  a = opt_str(a, "defaultSize", default_size)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  a = opt_str(a, "getContainer", get_container)
  a = opt_bool(a, "focusTriggerAfterClose", focus_trigger_after_close)
  a = opt_str(a, "title", title)
  a = opt_str(a, "footer", footer)
  a = opt_str(a, "extra", extra)
  a = opt_json(a, "closable", closable)
  a = opt_str(a, "closeIcon", close_icon)
  a = opt_bool(a, "loading", loading)
  a = opt_json(a, "headerStyle", header_style)
  a = opt_json(a, "bodyStyle", body_style)
  a = opt_json(a, "footerStyle", footer_style)
  a = opt_json(a, "contentWrapperStyle", content_wrapper_style)
  a = opt_json(a, "maskStyle", mask_style)
  a = opt_json(a, "drawerStyle", drawer_style)
  a = opt_json(a, "resizable", resizable)
  a = opt_bool(a, "destroyOnClose", destroy_on_close)
  a = opt_json(a, "mask", mask)
  a = opt_json(a, "focusable", focusable)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onClose", on_close)
  @html.node("antd:Drawer", a, children)
}

///|
/// 组件库 `antd:Dropdown`（Props 接口 `DropdownProps`）。
///
/// 参数 20 个（清单里另有 8 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] dropdown(
  menu? : String,
  auto_focus? : Bool,
  arrow? : String,
  trigger? : String,
  open? : Bool,
  disabled? : Bool,
  destroy_popup_on_hide? : Bool,
  destroy_on_hidden? : Bool,
  align? : String,
  class_name? : String,
  transition_name? : String,
  placement? : String,
  overlay_class_name? : String,
  overlay_style? : String,
  force_render? : Bool,
  mouse_enter_delay? : Double,
  mouse_leave_delay? : Double,
  open_class_name? : String,
  auto_adjust_overflow? : String,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "menu", menu)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "arrow", arrow)
  a = opt_json(a, "trigger", trigger)
  a = opt_bool(a, "open", open)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "destroyPopupOnHide", destroy_popup_on_hide)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  a = opt_json(a, "align", align)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "transitionName", transition_name)
  a = opt_str(a, "placement", placement)
  a = opt_str(a, "overlayClassName", overlay_class_name)
  a = opt_json(a, "overlayStyle", overlay_style)
  a = opt_bool(a, "forceRender", force_render)
  a = opt_num(a, "mouseEnterDelay", mouse_enter_delay)
  a = opt_num(a, "mouseLeaveDelay", mouse_leave_delay)
  a = opt_str(a, "openClassName", open_class_name)
  a = opt_json(a, "autoAdjustOverflow", auto_adjust_overflow)
  a = opt_payload(a, "onOpenChange", on_open_change)
  @html.node("antd:Dropdown", a, children)
}

///|
/// 复合子组件 `antd:Dropdown.Button`（Props 接口 `DropdownButtonProps`）。
///
/// 参数 30 个（清单里另有 9 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] dropdown_button(
  size? : String,
  style? : String,
  class_name? : String,
  menu? : String,
  auto_focus? : Bool,
  arrow? : String,
  trigger? : String,
  open? : Bool,
  disabled? : Bool,
  destroy_popup_on_hide? : Bool,
  destroy_on_hidden? : Bool,
  align? : String,
  transition_name? : String,
  placement? : String,
  overlay_class_name? : String,
  overlay_style? : String,
  force_render? : Bool,
  mouse_enter_delay? : Double,
  mouse_leave_delay? : Double,
  open_class_name? : String,
  auto_adjust_overflow? : String,
  type_? : String,
  html_type? : String,
  danger? : Bool,
  loading? : String,
  icon? : String,
  href? : String,
  title? : String,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  on_click? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "size", size)
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "menu", menu)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "arrow", arrow)
  a = opt_json(a, "trigger", trigger)
  a = opt_bool(a, "open", open)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "destroyPopupOnHide", destroy_popup_on_hide)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  a = opt_json(a, "align", align)
  a = opt_str(a, "transitionName", transition_name)
  a = opt_str(a, "placement", placement)
  a = opt_str(a, "overlayClassName", overlay_class_name)
  a = opt_json(a, "overlayStyle", overlay_style)
  a = opt_bool(a, "forceRender", force_render)
  a = opt_num(a, "mouseEnterDelay", mouse_enter_delay)
  a = opt_num(a, "mouseLeaveDelay", mouse_leave_delay)
  a = opt_str(a, "openClassName", open_class_name)
  a = opt_json(a, "autoAdjustOverflow", auto_adjust_overflow)
  a = opt_str(a, "type", type_)
  a = opt_str(a, "htmlType", html_type)
  a = opt_bool(a, "danger", danger)
  a = opt_json(a, "loading", loading)
  a = opt_str(a, "icon", icon)
  a = opt_str(a, "href", href)
  a = opt_str(a, "title", title)
  a = opt_payload(a, "onOpenChange", on_open_change)
  a = opt_cmd(a, "onClick", on_click)
  @html.node("antd:Dropdown.Button", a, children)
}

///|
/// 组件库 `antd:Empty`（Props 接口 `EmptyProps`）。
///
/// 参数 5 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] empty(
  class_name? : String,
  style? : String,
  image_style? : String,
  image? : String,
  description? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_json(a, "imageStyle", image_style)
  a = opt_str(a, "image", image)
  a = opt_str(a, "description", description)
  @html.node("antd:Empty", a, children)
}

///|
/// 组件库 `antd:Flex`（Props 接口 `FlexProps`）。
///
/// 参数 66 个（清单里另有 83 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] flex(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  vertical? : Bool,
  orientation? : String,
  wrap? : Bool,
  gap? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_bool(a, "vertical", vertical)
  a = opt_str(a, "orientation", orientation)
  a = opt_bool(a, "wrap", wrap)
  a = opt_str(a, "gap", gap)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Flex", a, children)
}

///|
/// 组件库 `antd:FloatButton`（Props 接口 `FloatButtonProps`）。
///
/// 参数 64 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn float_button(
  class_name? : String,
  style? : String,
  icon? : String,
  description? : String,
  content? : String,
  type_? : String,
  shape? : String,
  tooltip? : String,
  href? : String,
  badge? : String,
  disabled? : Bool,
  html_type? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "icon", icon)
  a = opt_str(a, "description", description)
  a = opt_str(a, "content", content)
  a = opt_str(a, "type", type_)
  a = opt_str(a, "shape", shape)
  a = opt_json(a, "tooltip", tooltip)
  a = opt_str(a, "href", href)
  a = opt_json(a, "badge", badge)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "htmlType", html_type)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:FloatButton", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Form`（Props 接口 `FormProps`）。
///
/// 参数 87 个（清单里另有 88 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] form(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  auto_complete? : String,
  name? : String,
  target? : String,
  initial_values? : String,
  fields? : String,
  validate_messages? : String,
  validate_trigger? : String,
  preserve? : Bool,
  clear_on_destroy? : Bool,
  colon? : Bool,
  layout? : String,
  label_align? : String,
  label_wrap? : Bool,
  label_col? : String,
  wrapper_col? : String,
  form? : String,
  size? : String,
  disabled? : Bool,
  scroll_to_first_error? : String,
  required_mark? : String,
  variant? : String,
  tooltip? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_values_change? : (@html.Payload) -> @cmd.Cmd,
  on_fields_change? : (@html.Payload) -> @cmd.Cmd,
  on_finish? : (@html.Payload) -> @cmd.Cmd,
  on_finish_failed? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "autoComplete", auto_complete)
  a = opt_str(a, "name", name)
  a = opt_str(a, "target", target)
  a = opt_json(a, "initialValues", initial_values)
  a = opt_json(a, "fields", fields)
  a = opt_json(a, "validateMessages", validate_messages)
  a = opt_json(a, "validateTrigger", validate_trigger)
  a = opt_bool(a, "preserve", preserve)
  a = opt_bool(a, "clearOnDestroy", clear_on_destroy)
  a = opt_bool(a, "colon", colon)
  a = opt_str(a, "layout", layout)
  a = opt_str(a, "labelAlign", label_align)
  a = opt_bool(a, "labelWrap", label_wrap)
  a = opt_json(a, "labelCol", label_col)
  a = opt_json(a, "wrapperCol", wrapper_col)
  a = opt_json(a, "form", form)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "disabled", disabled)
  a = opt_json(a, "scrollToFirstError", scroll_to_first_error)
  a = opt_str(a, "requiredMark", required_mark)
  a = opt_str(a, "variant", variant)
  a = opt_json(a, "tooltip", tooltip)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_payload(a, "onValuesChange", on_values_change)
  a = opt_payload(a, "onFieldsChange", on_fields_change)
  a = opt_payload(a, "onFinish", on_finish)
  a = opt_payload(a, "onFinishFailed", on_finish_failed)
  @html.node("antd:Form", a, children)
}

///|
/// 复合子组件 `antd:Form.Item`（Props 接口 `FormItemProps`）。
///
/// 参数 34 个（清单里另有 9 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] form_item(
  colon? : Bool,
  html_for? : String,
  label? : String,
  label_align? : String,
  label_col? : String,
  tooltip? : String,
  vertical? : Bool,
  wrapper_col? : String,
  extra? : String,
  status? : String,
  help? : String,
  field_id? : String,
  dependencies? : String,
  rules? : String,
  should_update? : Bool,
  trigger? : String,
  validate_trigger? : String,
  validate_debounce? : Double,
  validate_first? : String,
  value_prop_name? : String,
  message_variables? : String,
  initial_value? : String,
  preserve? : Bool,
  no_style? : Bool,
  style? : String,
  class_name? : String,
  id? : String,
  has_feedback? : String,
  validate_status? : String,
  required? : Bool,
  hidden? : Bool,
  layout? : String,
  on_reset? : @cmd.Cmd,
  on_meta_change? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_bool(a, "colon", colon)
  a = opt_str(a, "htmlFor", html_for)
  a = opt_str(a, "label", label)
  a = opt_str(a, "labelAlign", label_align)
  a = opt_json(a, "labelCol", label_col)
  a = opt_json(a, "tooltip", tooltip)
  a = opt_bool(a, "vertical", vertical)
  a = opt_json(a, "wrapperCol", wrapper_col)
  a = opt_str(a, "extra", extra)
  a = opt_str(a, "status", status)
  a = opt_str(a, "help", help)
  a = opt_str(a, "fieldId", field_id)
  a = opt_json(a, "dependencies", dependencies)
  a = opt_json(a, "rules", rules)
  a = opt_bool(a, "shouldUpdate", should_update)
  a = opt_str(a, "trigger", trigger)
  a = opt_json(a, "validateTrigger", validate_trigger)
  a = opt_num(a, "validateDebounce", validate_debounce)
  a = opt_str(a, "validateFirst", validate_first)
  a = opt_str(a, "valuePropName", value_prop_name)
  a = opt_json(a, "messageVariables", message_variables)
  a = opt_json(a, "initialValue", initial_value)
  a = opt_bool(a, "preserve", preserve)
  a = opt_bool(a, "noStyle", no_style)
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "id", id)
  a = opt_json(a, "hasFeedback", has_feedback)
  a = opt_str(a, "validateStatus", validate_status)
  a = opt_bool(a, "required", required)
  a = opt_bool(a, "hidden", hidden)
  a = opt_str(a, "layout", layout)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onMetaChange", on_meta_change)
  @html.node("antd:Form.Item", a, children)
}

///|
/// 复合子组件 `antd:Form.List`（Props 接口 `FormListProps`）。
///
/// 参数 3 个（清单里另有 2 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] form_list(
  name? : String,
  rules? : String,
  initial_value? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "name", name)
  a = opt_json(a, "rules", rules)
  a = opt_json(a, "initialValue", initial_value)
  @html.node("antd:Form.List", a, children)
}

///|
/// 复合子组件 `antd:Form.ErrorList`（Props 接口 `ErrorListProps`）。
///
/// 参数 7 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn form_error_list(
  field_id? : String,
  help? : String,
  help_status? : String,
  errors? : String,
  warnings? : String,
  class_name? : String,
  on_visible_changed? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "fieldId", field_id)
  a = opt_str(a, "help", help)
  a = opt_str(a, "helpStatus", help_status)
  a = opt_json(a, "errors", errors)
  a = opt_json(a, "warnings", warnings)
  a = opt_str(a, "className", class_name)
  a = opt_payload(a, "onVisibleChanged", on_visible_changed)
  @html.node("antd:Form.ErrorList", a, ([] : Array[@html.Html]))
}

///|
/// 复合子组件 `antd:Form.Provider`（Props 接口 `FormProviderProps`）。
///
/// 参数 2 个（清单里另有 2 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] form_provider(
  on_form_change? : (@html.Payload) -> @cmd.Cmd,
  on_form_finish? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_payload(a, "onFormChange", on_form_change)
  a = opt_payload(a, "onFormFinish", on_form_finish)
  @html.node("antd:Form.Provider", a, children)
}

///|
/// 组件库 `antd:Image`（Props 接口 `ImageProps`）。
///
/// 参数 71 个（清单里另有 88 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] image(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  alt? : String,
  height? : String,
  src? : String,
  width? : String,
  preview_prefix_cls? : String,
  fallback? : String,
  preview? : String,
  wrapper_style? : String,
  placeholder? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "alt", alt)
  a = opt_str(a, "height", height)
  a = opt_str(a, "src", src)
  a = opt_str(a, "width", width)
  a = opt_str(a, "previewPrefixCls", preview_prefix_cls)
  a = opt_str(a, "fallback", fallback)
  a = opt_json(a, "preview", preview)
  a = opt_json(a, "wrapperStyle", wrapper_style)
  a = opt_json(a, "placeholder", placeholder)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  @html.node("antd:Image", a, children)
}

///|
/// 复合子组件 `antd:Image.PreviewGroup`（Props 接口 `PreviewGroupProps`）。
///
/// 参数 1 个（清单里另有 2 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 继承链有 1 环解不开（Omit<RcPreviewGroupProps, 'preview' | 'styles' | 'classNames'>）——
/// 这些基类上的 prop **不在**参数表里，需要时用 `attrs?` 手写。
pub fn image_preview_group(
  preview? : String,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "preview", preview)
  @html.node("antd:Image.PreviewGroup", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Input`（Props 接口 `InputProps`）。
///
/// 参数 97 个（清单里另有 83 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] input(
  prefix? : String,
  suffix? : String,
  addon_before? : String,
  addon_after? : String,
  allow_clear? : String,
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  accept? : String,
  alt? : String,
  auto_complete? : String,
  checked? : Bool,
  disabled? : Bool,
  height? : String,
  max? : String,
  max_length? : Double,
  min? : String,
  min_length? : Double,
  multiple? : Bool,
  name? : String,
  pattern? : String,
  placeholder? : String,
  read_only? : Bool,
  required? : Bool,
  src? : String,
  step? : String,
  width? : String,
  value? : String,
  type_? : String,
  show_count? : String,
  html_size? : Double,
  count? : String,
  size? : String,
  status? : String,
  bordered? : Bool,
  variant? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_press_enter? : @cmd.Cmd,
  on_clear? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffix", suffix)
  a = opt_str(a, "addonBefore", addon_before)
  a = opt_str(a, "addonAfter", addon_after)
  a = opt_json(a, "allowClear", allow_clear)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "accept", accept)
  a = opt_str(a, "alt", alt)
  a = opt_str(a, "autoComplete", auto_complete)
  a = opt_bool(a, "checked", checked)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "height", height)
  a = opt_str(a, "max", max)
  a = opt_num(a, "maxLength", max_length)
  a = opt_str(a, "min", min)
  a = opt_num(a, "minLength", min_length)
  a = opt_bool(a, "multiple", multiple)
  a = opt_str(a, "name", name)
  a = opt_str(a, "pattern", pattern)
  a = opt_str(a, "placeholder", placeholder)
  a = opt_bool(a, "readOnly", read_only)
  a = opt_bool(a, "required", required)
  a = opt_str(a, "src", src)
  a = opt_str(a, "step", step)
  a = opt_str(a, "width", width)
  a = opt_json(a, "value", value)
  a = opt_str(a, "type", type_)
  a = opt_json(a, "showCount", show_count)
  a = opt_num(a, "htmlSize", html_size)
  a = opt_json(a, "count", count)
  a = opt_str(a, "size", size)
  a = opt_str(a, "status", status)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "variant", variant)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_cmd(a, "onPressEnter", on_press_enter)
  a = opt_cmd(a, "onClear", on_clear)
  @html.node("antd:Input", a, children)
}

///|
/// 复合子组件 `antd:Input.Group`（Props 接口 `GroupProps`）。
///
/// 参数 8 个（清单里另有 2 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] input_group(
  class_name? : String,
  size? : String,
  style? : String,
  compact? : Bool,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "size", size)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "compact", compact)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  @html.node("antd:Input.Group", a, children)
}

///|
/// 复合子组件 `antd:Input.Search`（Props 接口 `SearchProps`）。
///
/// 参数 102 个（清单里另有 83 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] input_search(
  prefix? : String,
  suffix? : String,
  addon_before? : String,
  addon_after? : String,
  allow_clear? : String,
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  accept? : String,
  alt? : String,
  auto_complete? : String,
  checked? : Bool,
  disabled? : Bool,
  height? : String,
  max? : String,
  max_length? : Double,
  min? : String,
  min_length? : Double,
  multiple? : Bool,
  name? : String,
  pattern? : String,
  placeholder? : String,
  read_only? : Bool,
  required? : Bool,
  src? : String,
  step? : String,
  width? : String,
  value? : String,
  type_? : String,
  show_count? : String,
  html_size? : Double,
  count? : String,
  size? : String,
  status? : String,
  bordered? : Bool,
  variant? : String,
  input_prefix_cls? : String,
  search_icon? : String,
  enter_button? : String,
  loading? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_press_enter? : (@html.Payload) -> @cmd.Cmd,
  on_clear? : @cmd.Cmd,
  on_search? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffix", suffix)
  a = opt_str(a, "addonBefore", addon_before)
  a = opt_str(a, "addonAfter", addon_after)
  a = opt_json(a, "allowClear", allow_clear)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "accept", accept)
  a = opt_str(a, "alt", alt)
  a = opt_str(a, "autoComplete", auto_complete)
  a = opt_bool(a, "checked", checked)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "height", height)
  a = opt_str(a, "max", max)
  a = opt_num(a, "maxLength", max_length)
  a = opt_str(a, "min", min)
  a = opt_num(a, "minLength", min_length)
  a = opt_bool(a, "multiple", multiple)
  a = opt_str(a, "name", name)
  a = opt_str(a, "pattern", pattern)
  a = opt_str(a, "placeholder", placeholder)
  a = opt_bool(a, "readOnly", read_only)
  a = opt_bool(a, "required", required)
  a = opt_str(a, "src", src)
  a = opt_str(a, "step", step)
  a = opt_str(a, "width", width)
  a = opt_json(a, "value", value)
  a = opt_str(a, "type", type_)
  a = opt_json(a, "showCount", show_count)
  a = opt_num(a, "htmlSize", html_size)
  a = opt_json(a, "count", count)
  a = opt_str(a, "size", size)
  a = opt_str(a, "status", status)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "variant", variant)
  a = opt_str(a, "inputPrefixCls", input_prefix_cls)
  a = opt_str(a, "searchIcon", search_icon)
  a = opt_str(a, "enterButton", enter_button)
  a = opt_bool(a, "loading", loading)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_payload(a, "onPressEnter", on_press_enter)
  a = opt_cmd(a, "onClear", on_clear)
  a = opt_payload(a, "onSearch", on_search)
  @html.node("antd:Input.Search", a, children)
}

///|
/// 复合子组件 `antd:Input.TextArea`（Props 接口 `TextAreaProps`）。
///
/// 参数 84 个（清单里另有 84 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] input_text_area(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  auto_complete? : String,
  cols? : Double,
  disabled? : Bool,
  max_length? : Double,
  min_length? : Double,
  name? : String,
  placeholder? : String,
  read_only? : Bool,
  required? : Bool,
  rows? : Double,
  value? : String,
  auto_size? : String,
  allow_clear? : String,
  show_count? : String,
  count? : String,
  bordered? : Bool,
  size? : String,
  status? : String,
  variant? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_press_enter? : @cmd.Cmd,
  on_resize? : (@html.Payload) -> @cmd.Cmd,
  on_clear? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "autoComplete", auto_complete)
  a = opt_num(a, "cols", cols)
  a = opt_bool(a, "disabled", disabled)
  a = opt_num(a, "maxLength", max_length)
  a = opt_num(a, "minLength", min_length)
  a = opt_str(a, "name", name)
  a = opt_str(a, "placeholder", placeholder)
  a = opt_bool(a, "readOnly", read_only)
  a = opt_bool(a, "required", required)
  a = opt_num(a, "rows", rows)
  a = opt_json(a, "value", value)
  a = opt_json(a, "autoSize", auto_size)
  a = opt_json(a, "allowClear", allow_clear)
  a = opt_json(a, "showCount", show_count)
  a = opt_json(a, "count", count)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "size", size)
  a = opt_str(a, "status", status)
  a = opt_str(a, "variant", variant)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_cmd(a, "onPressEnter", on_press_enter)
  a = opt_payload(a, "onResize", on_resize)
  a = opt_cmd(a, "onClear", on_clear)
  @html.node("antd:Input.TextArea", a, children)
}

///|
/// 复合子组件 `antd:Input.Password`（Props 接口 `PasswordProps`）。
///
/// 参数 100 个（清单里另有 84 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] input_password(
  prefix? : String,
  suffix? : String,
  addon_before? : String,
  addon_after? : String,
  allow_clear? : String,
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  accept? : String,
  alt? : String,
  auto_complete? : String,
  checked? : Bool,
  disabled? : Bool,
  height? : String,
  max? : String,
  max_length? : Double,
  min? : String,
  min_length? : Double,
  multiple? : Bool,
  name? : String,
  pattern? : String,
  placeholder? : String,
  read_only? : Bool,
  required? : Bool,
  src? : String,
  step? : String,
  width? : String,
  value? : String,
  type_? : String,
  show_count? : String,
  html_size? : Double,
  count? : String,
  size? : String,
  status? : String,
  bordered? : Bool,
  variant? : String,
  input_prefix_cls? : String,
  action? : String,
  visibility_toggle? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_press_enter? : @cmd.Cmd,
  on_clear? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffix", suffix)
  a = opt_str(a, "addonBefore", addon_before)
  a = opt_str(a, "addonAfter", addon_after)
  a = opt_json(a, "allowClear", allow_clear)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "accept", accept)
  a = opt_str(a, "alt", alt)
  a = opt_str(a, "autoComplete", auto_complete)
  a = opt_bool(a, "checked", checked)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "height", height)
  a = opt_str(a, "max", max)
  a = opt_num(a, "maxLength", max_length)
  a = opt_str(a, "min", min)
  a = opt_num(a, "minLength", min_length)
  a = opt_bool(a, "multiple", multiple)
  a = opt_str(a, "name", name)
  a = opt_str(a, "pattern", pattern)
  a = opt_str(a, "placeholder", placeholder)
  a = opt_bool(a, "readOnly", read_only)
  a = opt_bool(a, "required", required)
  a = opt_str(a, "src", src)
  a = opt_str(a, "step", step)
  a = opt_str(a, "width", width)
  a = opt_json(a, "value", value)
  a = opt_str(a, "type", type_)
  a = opt_json(a, "showCount", show_count)
  a = opt_num(a, "htmlSize", html_size)
  a = opt_json(a, "count", count)
  a = opt_str(a, "size", size)
  a = opt_str(a, "status", status)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "variant", variant)
  a = opt_str(a, "inputPrefixCls", input_prefix_cls)
  a = opt_str(a, "action", action)
  a = opt_json(a, "visibilityToggle", visibility_toggle)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_cmd(a, "onPressEnter", on_press_enter)
  a = opt_cmd(a, "onClear", on_clear)
  @html.node("antd:Input.Password", a, children)
}

///|
/// 复合子组件 `antd:Input.OTP`（Props 接口 `OTPProps`）。
///
/// 参数 72 个（清单里另有 83 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] input_otp(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  length? : Double,
  variant? : String,
  size? : String,
  default_value? : String,
  value? : String,
  separator? : String,
  disabled? : Bool,
  status? : String,
  mask? : String,
  auto_complete? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_num(a, "length", length)
  a = opt_str(a, "variant", variant)
  a = opt_str(a, "size", size)
  a = opt_str(a, "defaultValue", default_value)
  a = opt_str(a, "value", value)
  a = opt_str(a, "separator", separator)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "status", status)
  a = opt_str(a, "mask", mask)
  a = opt_str(a, "autoComplete", auto_complete)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onInput", on_input)
  @html.node("antd:Input.OTP", a, children)
}

///|
/// 组件库 `antd:InputNumber`（Props 接口 `InputNumberProps`）。
///
/// 参数 103 个（清单里另有 86 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] input_number(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  accept? : String,
  alt? : String,
  auto_complete? : String,
  checked? : Bool,
  disabled? : Bool,
  height? : String,
  max? : String,
  max_length? : Double,
  min? : String,
  min_length? : Double,
  multiple? : Bool,
  name? : String,
  pattern? : String,
  placeholder? : String,
  read_only? : Bool,
  required? : Bool,
  src? : String,
  step? : String,
  width? : String,
  string_mode? : Bool,
  mode? : String,
  default_value? : String,
  value? : String,
  suffix? : String,
  up_handler? : String,
  down_handler? : String,
  keyboard? : Bool,
  change_on_wheel? : Bool,
  precision? : Double,
  decimal_separator? : String,
  change_on_blur? : Bool,
  addon_before? : String,
  addon_after? : String,
  prefix? : String,
  size? : String,
  bordered? : Bool,
  status? : String,
  controls? : String,
  variant? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_press_enter? : @cmd.Cmd,
  on_step? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "accept", accept)
  a = opt_str(a, "alt", alt)
  a = opt_str(a, "autoComplete", auto_complete)
  a = opt_bool(a, "checked", checked)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "height", height)
  a = opt_json(a, "max", max)
  a = opt_num(a, "maxLength", max_length)
  a = opt_json(a, "min", min)
  a = opt_num(a, "minLength", min_length)
  a = opt_bool(a, "multiple", multiple)
  a = opt_str(a, "name", name)
  a = opt_str(a, "pattern", pattern)
  a = opt_str(a, "placeholder", placeholder)
  a = opt_bool(a, "readOnly", read_only)
  a = opt_bool(a, "required", required)
  a = opt_str(a, "src", src)
  a = opt_str(a, "step", step)
  a = opt_str(a, "width", width)
  a = opt_bool(a, "stringMode", string_mode)
  a = opt_str(a, "mode", mode)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_json(a, "value", value)
  a = opt_str(a, "suffix", suffix)
  a = opt_str(a, "upHandler", up_handler)
  a = opt_str(a, "downHandler", down_handler)
  a = opt_bool(a, "keyboard", keyboard)
  a = opt_bool(a, "changeOnWheel", change_on_wheel)
  a = opt_num(a, "precision", precision)
  a = opt_str(a, "decimalSeparator", decimal_separator)
  a = opt_bool(a, "changeOnBlur", change_on_blur)
  a = opt_str(a, "addonBefore", addon_before)
  a = opt_str(a, "addonAfter", addon_after)
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "status", status)
  a = opt_json(a, "controls", controls)
  a = opt_str(a, "variant", variant)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_payload(a, "onInput", on_input)
  a = opt_payload(a, "onChange", on_change)
  a = opt_cmd(a, "onPressEnter", on_press_enter)
  a = opt_payload(a, "onStep", on_step)
  @html.node("antd:InputNumber", a, children)
}

///|
/// 组件库 `antd:Layout`（Props 接口 `BasicProps`）。
///
/// 参数 64 个（清单里另有 79 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] layout(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  suffix_cls? : String,
  has_sider? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "suffixCls", suffix_cls)
  a = opt_bool(a, "hasSider", has_sider)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Layout", a, children)
}

///|
/// 复合子组件 `antd:Layout.Header`（Props 接口 `BasicProps`）。
///
/// 参数 64 个（清单里另有 79 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] layout_header(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  suffix_cls? : String,
  has_sider? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "suffixCls", suffix_cls)
  a = opt_bool(a, "hasSider", has_sider)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Layout.Header", a, children)
}

///|
/// 复合子组件 `antd:Layout.Footer`（Props 接口 `BasicProps`）。
///
/// 参数 64 个（清单里另有 79 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] layout_footer(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  suffix_cls? : String,
  has_sider? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "suffixCls", suffix_cls)
  a = opt_bool(a, "hasSider", has_sider)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Layout.Footer", a, children)
}

///|
/// 复合子组件 `antd:Layout.Content`（Props 接口 `BasicProps`）。
///
/// 参数 64 个（清单里另有 79 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] layout_content(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  suffix_cls? : String,
  has_sider? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "suffixCls", suffix_cls)
  a = opt_bool(a, "hasSider", has_sider)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Layout.Content", a, children)
}

///|
/// 复合子组件 `antd:Layout.Sider`（Props 接口 `SiderProps`）。
///
/// 参数 74 个（清单里另有 80 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] layout_sider(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  collapsible? : Bool,
  collapsed? : Bool,
  default_collapsed? : Bool,
  reverse_arrow? : Bool,
  zero_width_trigger_style? : String,
  trigger? : String,
  width? : String,
  collapsed_width? : String,
  breakpoint? : String,
  theme? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_collapse? : (@html.Payload) -> @cmd.Cmd,
  on_breakpoint? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_bool(a, "collapsible", collapsible)
  a = opt_bool(a, "collapsed", collapsed)
  a = opt_bool(a, "defaultCollapsed", default_collapsed)
  a = opt_bool(a, "reverseArrow", reverse_arrow)
  a = opt_json(a, "zeroWidthTriggerStyle", zero_width_trigger_style)
  a = opt_str(a, "trigger", trigger)
  a = opt_str(a, "width", width)
  a = opt_str(a, "collapsedWidth", collapsed_width)
  a = opt_str(a, "breakpoint", breakpoint)
  a = opt_str(a, "theme", theme)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_payload(a, "onCollapse", on_collapse)
  a = opt_payload(a, "onBreakpoint", on_breakpoint)
  @html.node("antd:Layout.Sider", a, children)
}

///|
/// 组件库 `antd:List`（Props 接口 `ListProps`）。
///
/// 参数 16 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] list(
  bordered? : Bool,
  class_name? : String,
  style? : String,
  data_source? : String,
  extra? : String,
  grid? : String,
  id? : String,
  item_layout? : String,
  loading? : String,
  load_more? : String,
  pagination? : String,
  size? : String,
  split? : Bool,
  header? : String,
  footer? : String,
  locale? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_json(a, "dataSource", data_source)
  a = opt_str(a, "extra", extra)
  a = opt_json(a, "grid", grid)
  a = opt_str(a, "id", id)
  a = opt_str(a, "itemLayout", item_layout)
  a = opt_json(a, "loading", loading)
  a = opt_str(a, "loadMore", load_more)
  a = opt_json(a, "pagination", pagination)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "split", split)
  a = opt_str(a, "header", header)
  a = opt_str(a, "footer", footer)
  a = opt_json(a, "locale", locale)
  @html.node("antd:List", a, children)
}

///|
/// 复合子组件 `antd:List.Item`（Props 接口 `ListItemProps`）。
///
/// 参数 65 个（清单里另有 80 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] list_item(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  extra? : String,
  actions? : String,
  col_style? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "extra", extra)
  a = opt_json(a, "actions", actions)
  a = opt_json(a, "colStyle", col_style)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:List.Item", a, children)
}

///|
/// 组件库 `antd:Listy`（Props 接口 `ListyProps`）。
///
/// 参数 8 个（清单里另有 6 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn listy(
  items? : String,
  sticky? : Bool,
  height? : Double,
  group? : String,
  virtual? : Bool,
  class_name? : String,
  style? : String,
  on_scroll? : @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "items", items)
  a = opt_bool(a, "sticky", sticky)
  a = opt_num(a, "height", height)
  a = opt_json(a, "group", group)
  a = opt_bool(a, "virtual", virtual)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_cmd(a, "onScroll", on_scroll)
  @html.node("antd:Listy", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Masonry`（Props 接口 `MasonryProps`）。
///
/// 参数 7 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn masonry(
  class_name? : String,
  style? : String,
  gutter? : String,
  items? : String,
  columns? : String,
  fresh? : Bool,
  on_layout_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_json(a, "gutter", gutter)
  a = opt_json(a, "items", items)
  a = opt_json(a, "columns", columns)
  a = opt_bool(a, "fresh", fresh)
  a = opt_payload(a, "onLayoutChange", on_layout_change)
  @html.node("antd:Masonry", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Mentions`（Props 接口 `MentionsProps`）。
///
/// 参数 93 个（清单里另有 89 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] mentions(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  auto_complete? : String,
  cols? : Double,
  disabled? : Bool,
  max_length? : Double,
  min_length? : Double,
  name? : String,
  placeholder? : String,
  read_only? : Bool,
  required? : Bool,
  rows? : Double,
  value? : String,
  auto_size? : String,
  allow_clear? : String,
  count? : String,
  default_value? : String,
  not_found_content? : String,
  split? : String,
  transition_name? : String,
  placement? : String,
  prefix? : String,
  silent? : Bool,
  options? : String,
  loading? : Bool,
  status? : String,
  variant? : String,
  size? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_press_enter? : @cmd.Cmd,
  on_resize? : (@html.Payload) -> @cmd.Cmd,
  on_clear? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_select? : (@html.Payload) -> @cmd.Cmd,
  on_search? : (@html.Payload) -> @cmd.Cmd,
  on_popup_scroll? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "autoComplete", auto_complete)
  a = opt_num(a, "cols", cols)
  a = opt_bool(a, "disabled", disabled)
  a = opt_num(a, "maxLength", max_length)
  a = opt_num(a, "minLength", min_length)
  a = opt_str(a, "name", name)
  a = opt_str(a, "placeholder", placeholder)
  a = opt_bool(a, "readOnly", read_only)
  a = opt_bool(a, "required", required)
  a = opt_num(a, "rows", rows)
  a = opt_str(a, "value", value)
  a = opt_json(a, "autoSize", auto_size)
  a = opt_json(a, "allowClear", allow_clear)
  a = opt_json(a, "count", count)
  a = opt_str(a, "defaultValue", default_value)
  a = opt_str(a, "notFoundContent", not_found_content)
  a = opt_str(a, "split", split)
  a = opt_str(a, "transitionName", transition_name)
  a = opt_str(a, "placement", placement)
  a = opt_json(a, "prefix", prefix)
  a = opt_bool(a, "silent", silent)
  a = opt_json(a, "options", options)
  a = opt_bool(a, "loading", loading)
  a = opt_str(a, "status", status)
  a = opt_str(a, "variant", variant)
  a = opt_str(a, "size", size)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_cmd(a, "onPressEnter", on_press_enter)
  a = opt_payload(a, "onResize", on_resize)
  a = opt_cmd(a, "onClear", on_clear)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onSelect", on_select)
  a = opt_payload(a, "onSearch", on_search)
  a = opt_cmd(a, "onPopupScroll", on_popup_scroll)
  @html.node("antd:Mentions", a, children)
}

///|
/// 复合子组件 `antd:Mentions.Option`（Props 接口 `OptionProps`）。
///
/// 参数 1 个（清单里另有 1 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] mentions_option(
  value? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "value", value)
  @html.node("antd:Mentions.Option", a, children)
}

///|
/// 组件库 `antd:Menu`（Props 接口 `MenuProps`）。
///
/// 参数 86 个（清单里另有 89 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] menu(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  disabled? : Bool,
  mode? : String,
  inline_collapsed? : Bool,
  default_open_keys? : String,
  open_keys? : String,
  selectable? : Bool,
  multiple? : Bool,
  default_selected_keys? : String,
  selected_keys? : String,
  inline_indent? : Double,
  motion? : String,
  default_motions? : String,
  sub_menu_open_delay? : Double,
  sub_menu_close_delay? : Double,
  force_sub_menu_render? : Bool,
  trigger_sub_menu_action? : String,
  builtin_placements? : String,
  item_icon? : String,
  expand_icon? : String,
  overflowed_indicator? : String,
  theme? : String,
  tooltip? : String,
  items? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_select? : (@html.Payload) -> @cmd.Cmd,
  on_deselect? : (@html.Payload) -> @cmd.Cmd,
  on_click? : (@html.Payload) -> @cmd.Cmd,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "mode", mode)
  a = opt_bool(a, "inlineCollapsed", inline_collapsed)
  a = opt_json(a, "defaultOpenKeys", default_open_keys)
  a = opt_json(a, "openKeys", open_keys)
  a = opt_bool(a, "selectable", selectable)
  a = opt_bool(a, "multiple", multiple)
  a = opt_json(a, "defaultSelectedKeys", default_selected_keys)
  a = opt_json(a, "selectedKeys", selected_keys)
  a = opt_num(a, "inlineIndent", inline_indent)
  a = opt_json(a, "motion", motion)
  a = opt_json(a, "defaultMotions", default_motions)
  a = opt_num(a, "subMenuOpenDelay", sub_menu_open_delay)
  a = opt_num(a, "subMenuCloseDelay", sub_menu_close_delay)
  a = opt_bool(a, "forceSubMenuRender", force_sub_menu_render)
  a = opt_str(a, "triggerSubMenuAction", trigger_sub_menu_action)
  a = opt_json(a, "builtinPlacements", builtin_placements)
  a = opt_str(a, "itemIcon", item_icon)
  a = opt_str(a, "expandIcon", expand_icon)
  a = opt_str(a, "overflowedIndicator", overflowed_indicator)
  a = opt_str(a, "theme", theme)
  a = opt_json(a, "tooltip", tooltip)
  a = opt_json(a, "items", items)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_payload(a, "onSelect", on_select)
  a = opt_payload(a, "onDeselect", on_deselect)
  a = opt_payload(a, "onClick", on_click)
  a = opt_payload(a, "onOpenChange", on_open_change)
  @html.node("antd:Menu", a, children)
}

///|
/// 复合子组件 `antd:Menu.Item`（Props 接口 `MenuItemProps`）。
///
/// 参数 68 个（清单里另有 80 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] menu_item(
  style? : String,
  class_name? : String,
  type_? : String,
  disabled? : Bool,
  item_icon? : String,
  extra? : String,
  id? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  attribute? : String,
  icon? : String,
  danger? : Bool,
  title? : String,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_click? : (@html.Payload) -> @cmd.Cmd,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "type", type_)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "itemIcon", item_icon)
  a = opt_str(a, "extra", extra)
  a = opt_str(a, "id", id)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "attribute", attribute)
  a = opt_str(a, "icon", icon)
  a = opt_bool(a, "danger", danger)
  a = opt_str(a, "title", title)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_payload(a, "onClick", on_click)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Menu.Item", a, children)
}

///|
/// 复合子组件 `antd:Menu.SubMenu`（Props 接口 `SubMenuProps`）。
///
/// 参数 3 个（清单里另有 1 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] menu_sub_menu(
  icon? : String,
  theme? : String,
  title? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "icon", icon)
  a = opt_str(a, "theme", theme)
  a = opt_str(a, "title", title)
  @html.node("antd:Menu.SubMenu", a, children)
}

///|
/// 复合子组件 `antd:Menu.Divider`（Props 接口 `MenuDividerProps`）。
///
/// 参数 63 个（清单里另有 78 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] menu_divider(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  dashed? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_bool(a, "dashed", dashed)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Menu.Divider", a, children)
}

///|
/// 复合子组件 `antd:Menu.ItemGroup`（Props 接口 `MenuItemGroupProps`）。
///
/// 参数 3 个（清单里另有 4 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] menu_item_group(
  style? : String,
  class_name? : String,
  title? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "title", title)
  @html.node("antd:Menu.ItemGroup", a, children)
}

///|
/// 组件库 `antd:Modal`（Props 接口 `ModalProps`）。
///
/// 参数 41 个（清单里另有 11 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] modal(
  class_name? : String,
  keyboard? : Bool,
  style? : String,
  root_style? : String,
  closable? : String,
  mask_closable? : Bool,
  visible? : Bool,
  destroy_on_hidden? : Bool,
  mouse_position? : String,
  title? : String,
  body_style? : String,
  mask_style? : String,
  height? : String,
  z_index? : Double,
  body_props? : String,
  mask_props? : String,
  wrap_props? : String,
  get_container? : String,
  close_icon? : String,
  force_render? : Bool,
  focus_trigger_after_close? : Bool,
  focus_trap? : Bool,
  scroll_lock? : Bool,
  footer? : String,
  open? : Bool,
  confirm_loading? : Bool,
  centered? : Bool,
  width? : String,
  ok_text? : String,
  ok_type? : String,
  cancel_text? : String,
  ok_button_props? : String,
  cancel_button_props? : String,
  destroy_on_close? : Bool,
  mask_transition_name? : String,
  transition_name? : String,
  mask? : String,
  loading? : Bool,
  focusable? : String,
  on_ok? : @cmd.Cmd,
  on_cancel? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "keyboard", keyboard)
  a = opt_json(a, "style", style)
  a = opt_json(a, "rootStyle", root_style)
  a = opt_json(a, "closable", closable)
  a = opt_bool(a, "maskClosable", mask_closable)
  a = opt_bool(a, "visible", visible)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  a = opt_json(a, "mousePosition", mouse_position)
  a = opt_str(a, "title", title)
  a = opt_json(a, "bodyStyle", body_style)
  a = opt_json(a, "maskStyle", mask_style)
  a = opt_str(a, "height", height)
  a = opt_num(a, "zIndex", z_index)
  a = opt_json(a, "bodyProps", body_props)
  a = opt_json(a, "maskProps", mask_props)
  a = opt_json(a, "wrapProps", wrap_props)
  a = opt_str(a, "getContainer", get_container)
  a = opt_str(a, "closeIcon", close_icon)
  a = opt_bool(a, "forceRender", force_render)
  a = opt_bool(a, "focusTriggerAfterClose", focus_trigger_after_close)
  a = opt_bool(a, "focusTrap", focus_trap)
  a = opt_bool(a, "scrollLock", scroll_lock)
  a = opt_str(a, "footer", footer)
  a = opt_bool(a, "open", open)
  a = opt_bool(a, "confirmLoading", confirm_loading)
  a = opt_bool(a, "centered", centered)
  a = opt_json(a, "width", width)
  a = opt_str(a, "okText", ok_text)
  a = opt_str(a, "okType", ok_type)
  a = opt_str(a, "cancelText", cancel_text)
  a = opt_json(a, "okButtonProps", ok_button_props)
  a = opt_json(a, "cancelButtonProps", cancel_button_props)
  a = opt_bool(a, "destroyOnClose", destroy_on_close)
  a = opt_str(a, "maskTransitionName", mask_transition_name)
  a = opt_str(a, "transitionName", transition_name)
  a = opt_json(a, "mask", mask)
  a = opt_bool(a, "loading", loading)
  a = opt_json(a, "focusable", focusable)
  a = opt_cmd(a, "onOk", on_ok)
  a = opt_cmd(a, "onCancel", on_cancel)
  @html.node("antd:Modal", a, children)
}

///|
/// 组件库 `antd:Pagination`（Props 接口 `PaginationProps`）。
///
/// 参数 31 个（清单里另有 53 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn pagination(
  class_name? : String,
  select_prefix_cls? : String,
  current? : Double,
  default_current? : Double,
  total? : Double,
  total_boundary_show_size_changer? : Double,
  page_size? : Double,
  default_page_size? : Double,
  hide_on_single_page? : Bool,
  align? : String,
  show_less_items? : Bool,
  show_prev_next_jumpers? : Bool,
  show_quick_jumper? : String,
  show_title? : Bool,
  simple? : String,
  disabled? : Bool,
  locale? : String,
  style? : String,
  prev_icon? : String,
  next_icon? : String,
  jump_prev_icon? : String,
  jump_next_icon? : String,
  role? : String,
  size? : String,
  responsive? : Bool,
  components? : String,
  show_size_changer? : String,
  select_component_class? : String,
  page_size_options? : String,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_show_size_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "selectPrefixCls", select_prefix_cls)
  a = opt_num(a, "current", current)
  a = opt_num(a, "defaultCurrent", default_current)
  a = opt_num(a, "total", total)
  a = opt_num(a, "totalBoundaryShowSizeChanger", total_boundary_show_size_changer)
  a = opt_num(a, "pageSize", page_size)
  a = opt_num(a, "defaultPageSize", default_page_size)
  a = opt_bool(a, "hideOnSinglePage", hide_on_single_page)
  a = opt_str(a, "align", align)
  a = opt_bool(a, "showLessItems", show_less_items)
  a = opt_bool(a, "showPrevNextJumpers", show_prev_next_jumpers)
  a = opt_json(a, "showQuickJumper", show_quick_jumper)
  a = opt_bool(a, "showTitle", show_title)
  a = opt_json(a, "simple", simple)
  a = opt_bool(a, "disabled", disabled)
  a = opt_json(a, "locale", locale)
  a = opt_json(a, "style", style)
  a = opt_str(a, "prevIcon", prev_icon)
  a = opt_str(a, "nextIcon", next_icon)
  a = opt_str(a, "jumpPrevIcon", jump_prev_icon)
  a = opt_str(a, "jumpNextIcon", jump_next_icon)
  a = opt_str(a, "role", role)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "responsive", responsive)
  a = opt_json(a, "components", components)
  a = opt_json(a, "showSizeChanger", show_size_changer)
  a = opt_json(a, "selectComponentClass", select_component_class)
  a = opt_json(a, "pageSizeOptions", page_size_options)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onShowSizeChange", on_show_size_change)
  @html.node("antd:Pagination", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Popconfirm`（Props 接口 `PopconfirmProps`）。
///
/// 参数 26 个（清单里另有 9 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] popconfirm(
  style? : String,
  class_name? : String,
  color? : String,
  placement? : String,
  open_class_name? : String,
  arrow? : String,
  auto_adjust_overflow? : String,
  destroy_on_hidden? : Bool,
  destroy_tooltip_on_hide? : String,
  overlay_style? : String,
  overlay_inner_style? : String,
  overlay_class_name? : String,
  title? : String,
  description? : String,
  disabled? : Bool,
  ok_text? : String,
  ok_type? : String,
  cancel_text? : String,
  ok_button_props? : String,
  cancel_button_props? : String,
  show_cancel? : Bool,
  icon? : String,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  on_confirm? : @cmd.Cmd,
  on_cancel? : @cmd.Cmd,
  on_popup_click? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "color", color)
  a = opt_str(a, "placement", placement)
  a = opt_str(a, "openClassName", open_class_name)
  a = opt_json(a, "arrow", arrow)
  a = opt_json(a, "autoAdjustOverflow", auto_adjust_overflow)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  a = opt_json(a, "destroyTooltipOnHide", destroy_tooltip_on_hide)
  a = opt_json(a, "overlayStyle", overlay_style)
  a = opt_json(a, "overlayInnerStyle", overlay_inner_style)
  a = opt_str(a, "overlayClassName", overlay_class_name)
  a = opt_str(a, "title", title)
  a = opt_str(a, "description", description)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "okText", ok_text)
  a = opt_str(a, "okType", ok_type)
  a = opt_str(a, "cancelText", cancel_text)
  a = opt_json(a, "okButtonProps", ok_button_props)
  a = opt_json(a, "cancelButtonProps", cancel_button_props)
  a = opt_bool(a, "showCancel", show_cancel)
  a = opt_str(a, "icon", icon)
  a = opt_payload(a, "onOpenChange", on_open_change)
  a = opt_cmd(a, "onConfirm", on_confirm)
  a = opt_cmd(a, "onCancel", on_cancel)
  a = opt_cmd(a, "onPopupClick", on_popup_click)
  @html.node("antd:Popconfirm", a, children)
}

///|
/// 组件库 `antd:Popover`（Props 接口 `PopoverProps`）。
///
/// 参数 15 个（清单里另有 9 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] popover(
  style? : String,
  class_name? : String,
  color? : String,
  placement? : String,
  open_class_name? : String,
  arrow? : String,
  auto_adjust_overflow? : String,
  destroy_on_hidden? : Bool,
  destroy_tooltip_on_hide? : String,
  overlay_style? : String,
  overlay_inner_style? : String,
  overlay_class_name? : String,
  title? : String,
  content? : String,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "color", color)
  a = opt_str(a, "placement", placement)
  a = opt_str(a, "openClassName", open_class_name)
  a = opt_json(a, "arrow", arrow)
  a = opt_json(a, "autoAdjustOverflow", auto_adjust_overflow)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  a = opt_json(a, "destroyTooltipOnHide", destroy_tooltip_on_hide)
  a = opt_json(a, "overlayStyle", overlay_style)
  a = opt_json(a, "overlayInnerStyle", overlay_inner_style)
  a = opt_str(a, "overlayClassName", overlay_class_name)
  a = opt_str(a, "title", title)
  a = opt_str(a, "content", content)
  a = opt_payload(a, "onOpenChange", on_open_change)
  @html.node("antd:Popover", a, children)
}

///|
/// 组件库 `antd:Progress`（Props 接口 `ProgressProps`）。
///
/// 参数 19 个（清单里另有 9 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] progress(
  class_name? : String,
  type_? : String,
  percent? : Double,
  status? : String,
  show_info? : Bool,
  stroke_width? : Double,
  stroke_linecap? : String,
  stroke_color? : String,
  trail_color? : String,
  rail_color? : String,
  width? : Double,
  success? : String,
  style? : String,
  gap_degree? : Double,
  gap_placement? : String,
  gap_position? : String,
  size? : String,
  steps? : String,
  percent_position? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "type", type_)
  a = opt_num(a, "percent", percent)
  a = opt_str(a, "status", status)
  a = opt_bool(a, "showInfo", show_info)
  a = opt_num(a, "strokeWidth", stroke_width)
  a = opt_str(a, "strokeLinecap", stroke_linecap)
  a = opt_json(a, "strokeColor", stroke_color)
  a = opt_str(a, "trailColor", trail_color)
  a = opt_str(a, "railColor", rail_color)
  a = opt_num(a, "width", width)
  a = opt_json(a, "success", success)
  a = opt_json(a, "style", style)
  a = opt_num(a, "gapDegree", gap_degree)
  a = opt_str(a, "gapPlacement", gap_placement)
  a = opt_str(a, "gapPosition", gap_position)
  a = opt_json(a, "size", size)
  a = opt_json(a, "steps", steps)
  a = opt_json(a, "percentPosition", percent_position)
  @html.node("antd:Progress", a, children)
}

///|
/// 组件库 `antd:QRCode`（Props 接口 `QRCodeProps`）。
///
/// 参数 78 个（清单里另有 83 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] qr_code(
  value? : String,
  boost_level? : Bool,
  size? : Double,
  level? : String,
  bg_color? : String,
  fg_color? : String,
  style? : String,
  include_margin? : Bool,
  margin_size? : Double,
  title? : String,
  min_version? : Double,
  class_name? : String,
  id? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  type_? : String,
  icon? : String,
  icon_size? : String,
  bordered? : Bool,
  error_level? : String,
  status? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_refresh? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "value", value)
  a = opt_bool(a, "boostLevel", boost_level)
  a = opt_num(a, "size", size)
  a = opt_str(a, "level", level)
  a = opt_str(a, "bgColor", bg_color)
  a = opt_str(a, "fgColor", fg_color)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "includeMargin", include_margin)
  a = opt_num(a, "marginSize", margin_size)
  a = opt_str(a, "title", title)
  a = opt_num(a, "minVersion", min_version)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "id", id)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "type", type_)
  a = opt_str(a, "icon", icon)
  a = opt_json(a, "iconSize", icon_size)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "errorLevel", error_level)
  a = opt_str(a, "status", status)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_cmd(a, "onRefresh", on_refresh)
  @html.node("antd:QRCode", a, children)
}

///|
/// 组件库 `antd:Radio`（Props 接口 `RadioProps`）。
///
/// 参数 22 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] radio(
  class_name? : String,
  default_checked? : Bool,
  checked? : Bool,
  style? : String,
  disabled? : Bool,
  title? : String,
  value? : String,
  tab_index? : Double,
  name? : String,
  id? : String,
  auto_focus? : Bool,
  type_? : String,
  skip_group? : Bool,
  required? : Bool,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "defaultChecked", default_checked)
  a = opt_bool(a, "checked", checked)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "title", title)
  a = opt_json(a, "value", value)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_str(a, "name", name)
  a = opt_str(a, "id", id)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "type", type_)
  a = opt_bool(a, "skipGroup", skip_group)
  a = opt_bool(a, "required", required)
  a = opt_payload(a, "onChange", on_change)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  @html.node("antd:Radio", a, children)
}

///|
/// 复合子组件 `antd:Radio.Group`（Props 接口 `RadioGroupProps`）。
///
/// 参数 20 个（清单里另有 50 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] radio_group(
  role? : String,
  class_name? : String,
  options? : String,
  disabled? : Bool,
  style? : String,
  default_value? : String,
  value? : String,
  size? : String,
  name? : String,
  id? : String,
  option_type? : String,
  orientation? : String,
  button_style? : String,
  block? : Bool,
  vertical? : Bool,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "role", role)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "options", options)
  a = opt_bool(a, "disabled", disabled)
  a = opt_json(a, "style", style)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_json(a, "value", value)
  a = opt_str(a, "size", size)
  a = opt_str(a, "name", name)
  a = opt_str(a, "id", id)
  a = opt_str(a, "optionType", option_type)
  a = opt_str(a, "orientation", orientation)
  a = opt_str(a, "buttonStyle", button_style)
  a = opt_bool(a, "block", block)
  a = opt_bool(a, "vertical", vertical)
  a = opt_payload(a, "onChange", on_change)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  @html.node("antd:Radio.Group", a, children)
}

///|
/// 复合子组件 `antd:Radio.Button`（Props 接口 `RadioButtonProps`）。
///
/// 参数 22 个（清单里另有 3 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] radio_button(
  class_name? : String,
  default_checked? : Bool,
  checked? : Bool,
  style? : String,
  disabled? : Bool,
  title? : String,
  value? : String,
  tab_index? : Double,
  name? : String,
  id? : String,
  auto_focus? : Bool,
  type_? : String,
  skip_group? : Bool,
  required? : Bool,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "defaultChecked", default_checked)
  a = opt_bool(a, "checked", checked)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "title", title)
  a = opt_json(a, "value", value)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_str(a, "name", name)
  a = opt_str(a, "id", id)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "type", type_)
  a = opt_bool(a, "skipGroup", skip_group)
  a = opt_bool(a, "required", required)
  a = opt_payload(a, "onChange", on_change)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  @html.node("antd:Radio.Button", a, children)
}

///|
/// 组件库 `antd:Rate`（Props 接口 `RateProps`）。
///
/// 参数 22 个（清单里另有 4 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn rate(
  allow_half? : Bool,
  disabled? : Bool,
  character? : String,
  count? : Double,
  value? : Double,
  default_value? : Double,
  allow_clear? : Bool,
  style? : String,
  class_name? : String,
  tab_index? : Double,
  id? : String,
  auto_focus? : Bool,
  keyboard? : Bool,
  tooltips? : String,
  size? : String,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_hover_change? : (@html.Payload) -> @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_bool(a, "allowHalf", allow_half)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "character", character)
  a = opt_num(a, "count", count)
  a = opt_num(a, "value", value)
  a = opt_num(a, "defaultValue", default_value)
  a = opt_bool(a, "allowClear", allow_clear)
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_str(a, "id", id)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_bool(a, "keyboard", keyboard)
  a = opt_json(a, "tooltips", tooltips)
  a = opt_str(a, "size", size)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onHoverChange", on_hover_change)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  @html.node("antd:Rate", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Result`（Props 接口 `ResultProps`）。
///
/// 参数 8 个（清单里另有 52 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] result(
  role? : String,
  icon? : String,
  status? : String,
  title? : String,
  sub_title? : String,
  extra? : String,
  class_name? : String,
  style? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "role", role)
  a = opt_str(a, "icon", icon)
  a = opt_str(a, "status", status)
  a = opt_str(a, "title", title)
  a = opt_str(a, "subTitle", sub_title)
  a = opt_str(a, "extra", extra)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  @html.node("antd:Result", a, children)
}

///|
/// 组件库 `antd:Row`（Props 接口 `RowProps`）。
///
/// 参数 66 个（清单里另有 78 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] row(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  gutter? : String,
  align? : String,
  justify? : String,
  wrap? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "gutter", gutter)
  a = opt_json(a, "align", align)
  a = opt_json(a, "justify", justify)
  a = opt_bool(a, "wrap", wrap)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Row", a, children)
}

///|
/// 组件库 `antd:Segmented`（Props 接口 `SegmentedProps`）。
///
/// 参数 73 个（清单里另有 82 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] segmented(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  default_value? : String,
  value? : String,
  disabled? : Bool,
  motion_name? : String,
  vertical? : Bool,
  name? : String,
  options? : String,
  block? : Bool,
  size? : String,
  orientation? : String,
  shape? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_json(a, "value", value)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "motionName", motion_name)
  a = opt_bool(a, "vertical", vertical)
  a = opt_str(a, "name", name)
  a = opt_json(a, "options", options)
  a = opt_bool(a, "block", block)
  a = opt_str(a, "size", size)
  a = opt_str(a, "orientation", orientation)
  a = opt_str(a, "shape", shape)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_payload(a, "onChange", on_change)
  @html.node("antd:Segmented", a, children)
}

///|
/// 组件库 `antd:Select`（Props 接口 `SelectProps`）。
///
/// 参数 86 个（清单里另有 64 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] select(
  id? : String,
  omit_dom_props? : String,
  display_values? : String,
  active_value? : String,
  active_descendant_id? : String,
  search_value? : String,
  auto_clear_search_value? : Bool,
  option_list? : String,
  empty_options? : Bool,
  role? : String,
  class_name? : String,
  style? : String,
  auto_focus? : Bool,
  placeholder? : String,
  max_count? : Double,
  title? : String,
  tab_index? : Double,
  not_found_content? : String,
  max_length? : Double,
  show_scroll_bar? : String,
  choice_transition_name? : String,
  disabled? : Bool,
  loading? : Bool,
  open? : Bool,
  default_open? : Bool,
  max_tag_text_length? : Double,
  max_tag_count? : String,
  max_tag_placeholder? : String,
  token_separators? : String,
  allow_clear? : String,
  prefix? : String,
  suffix_icon? : String,
  suffix? : String,
  clear_icon? : String,
  remove_icon? : String,
  animation? : String,
  transition_name? : String,
  popup_match_select_width? : Double,
  popup_align? : String,
  builtin_placements? : String,
  show_action? : String,
  components? : String,
  field_names? : String,
  show_search? : String,
  filter_option? : Bool,
  option_filter_prop? : String,
  option_label_prop? : String,
  options? : String,
  default_active_first_option? : Bool,
  virtual? : Bool,
  list_height? : Double,
  list_item_height? : Double,
  menu_item_selected_icon? : String,
  label_in_value? : Bool,
  value? : String,
  default_value? : String,
  size? : String,
  bordered? : Bool,
  show_arrow? : Bool,
  variant? : String,
  loading_icon? : String,
  placement? : String,
  mode? : String,
  status? : String,
  dropdown_match_select_width? : Double,
  on_display_values_change? : (@html.Payload) -> @cmd.Cmd,
  on_active_value_change? : (@html.Payload) -> @cmd.Cmd,
  on_search? : (@html.Payload) -> @cmd.Cmd,
  on_search_split? : (@html.Payload) -> @cmd.Cmd,
  on_clear? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_popup_scroll? : @cmd.Cmd,
  on_input_key_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_select? : (@html.Payload) -> @cmd.Cmd,
  on_deselect? : (@html.Payload) -> @cmd.Cmd,
  on_active? : (@html.Payload) -> @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_dropdown_visible_change? : (@html.Payload) -> @cmd.Cmd,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "id", id)
  a = opt_json(a, "omitDomProps", omit_dom_props)
  a = opt_json(a, "displayValues", display_values)
  a = opt_str(a, "activeValue", active_value)
  a = opt_str(a, "activeDescendantId", active_descendant_id)
  a = opt_str(a, "searchValue", search_value)
  a = opt_bool(a, "autoClearSearchValue", auto_clear_search_value)
  a = opt_json(a, "OptionList", option_list)
  a = opt_bool(a, "emptyOptions", empty_options)
  a = opt_str(a, "role", role)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "placeholder", placeholder)
  a = opt_num(a, "maxCount", max_count)
  a = opt_str(a, "title", title)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_str(a, "notFoundContent", not_found_content)
  a = opt_num(a, "maxLength", max_length)
  a = opt_str(a, "showScrollBar", show_scroll_bar)
  a = opt_str(a, "choiceTransitionName", choice_transition_name)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "loading", loading)
  a = opt_bool(a, "open", open)
  a = opt_bool(a, "defaultOpen", default_open)
  a = opt_num(a, "maxTagTextLength", max_tag_text_length)
  a = opt_str(a, "maxTagCount", max_tag_count)
  a = opt_str(a, "maxTagPlaceholder", max_tag_placeholder)
  a = opt_json(a, "tokenSeparators", token_separators)
  a = opt_json(a, "allowClear", allow_clear)
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffixIcon", suffix_icon)
  a = opt_str(a, "suffix", suffix)
  a = opt_str(a, "clearIcon", clear_icon)
  a = opt_str(a, "removeIcon", remove_icon)
  a = opt_str(a, "animation", animation)
  a = opt_str(a, "transitionName", transition_name)
  a = opt_num(a, "popupMatchSelectWidth", popup_match_select_width)
  a = opt_json(a, "popupAlign", popup_align)
  a = opt_json(a, "builtinPlacements", builtin_placements)
  a = opt_json(a, "showAction", show_action)
  a = opt_json(a, "components", components)
  a = opt_json(a, "fieldNames", field_names)
  a = opt_json(a, "showSearch", show_search)
  a = opt_bool(a, "filterOption", filter_option)
  a = opt_json(a, "optionFilterProp", option_filter_prop)
  a = opt_str(a, "optionLabelProp", option_label_prop)
  a = opt_json(a, "options", options)
  a = opt_bool(a, "defaultActiveFirstOption", default_active_first_option)
  a = opt_bool(a, "virtual", virtual)
  a = opt_num(a, "listHeight", list_height)
  a = opt_num(a, "listItemHeight", list_item_height)
  a = opt_str(a, "menuItemSelectedIcon", menu_item_selected_icon)
  a = opt_bool(a, "labelInValue", label_in_value)
  a = opt_json(a, "value", value)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "bordered", bordered)
  a = opt_bool(a, "showArrow", show_arrow)
  a = opt_str(a, "variant", variant)
  a = opt_str(a, "loadingIcon", loading_icon)
  a = opt_str(a, "placement", placement)
  a = opt_str(a, "mode", mode)
  a = opt_str(a, "status", status)
  a = opt_num(a, "dropdownMatchSelectWidth", dropdown_match_select_width)
  a = opt_payload(a, "onDisplayValuesChange", on_display_values_change)
  a = opt_payload(a, "onActiveValueChange", on_active_value_change)
  a = opt_payload(a, "onSearch", on_search)
  a = opt_payload(a, "onSearchSplit", on_search_split)
  a = opt_cmd(a, "onClear", on_clear)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onPopupScroll", on_popup_scroll)
  a = opt_cmd(a, "onInputKeyDown", on_input_key_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_payload(a, "onSelect", on_select)
  a = opt_payload(a, "onDeselect", on_deselect)
  a = opt_payload(a, "onActive", on_active)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onDropdownVisibleChange", on_dropdown_visible_change)
  a = opt_payload(a, "onOpenChange", on_open_change)
  @html.node("antd:Select", a, children)
}

///|
/// 复合子组件 `antd:Select.Option`（Props 接口 `OptionProps`）。
///
/// 参数 4 个（清单里另有 1 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] select_option(
  disabled? : Bool,
  class_name? : String,
  title? : String,
  value? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "title", title)
  a = opt_str(a, "value", value)
  @html.node("antd:Select.Option", a, children)
}

///|
/// 复合子组件 `antd:Select.OptGroup`（Props 接口 `无（只有 attrs?）`）。
///
/// 参数 0 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 这个子组件**没找到 props 接口**（生成器只在它自己的模块里找，不跨组件猜）——
/// 于是只有 `attrs?`：prop 得手写（`@html.Attrs::build().prop_str(…)`），没有编译期检查。
pub fn[C : @html.IsChildren] select_opt_group(
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  @html.node("antd:Select.OptGroup", a, children)
}

///|
/// 组件库 `antd:Skeleton`（Props 接口 `SkeletonProps`）。
///
/// 参数 8 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] skeleton(
  active? : Bool,
  loading? : Bool,
  class_name? : String,
  style? : String,
  avatar? : String,
  title? : String,
  paragraph? : String,
  round? : Bool,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_bool(a, "active", active)
  a = opt_bool(a, "loading", loading)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_json(a, "avatar", avatar)
  a = opt_json(a, "title", title)
  a = opt_json(a, "paragraph", paragraph)
  a = opt_bool(a, "round", round)
  @html.node("antd:Skeleton", a, children)
}

///|
/// 组件库 `antd:Slider`（Props 接口 `SliderProps`）。
///
/// 参数 38 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn slider(
  class_name? : String,
  style? : String,
  id? : String,
  disabled? : String,
  keyboard? : Bool,
  auto_focus? : Bool,
  range? : String,
  count? : Double,
  min? : Double,
  max? : Double,
  step? : String,
  value? : String,
  default_value? : String,
  allow_cross? : Bool,
  pushable? : Double,
  reverse? : Bool,
  vertical? : Bool,
  included? : Bool,
  start_point? : Double,
  track_style? : String,
  handle_style? : String,
  rail_style? : String,
  dot_style? : String,
  active_dot_style? : String,
  marks? : String,
  dots? : Bool,
  track? : Bool,
  tab_index? : String,
  aria_label_for_handle? : String,
  aria_labelled_by_for_handle? : String,
  aria_required? : Bool,
  aria_value_text_formatter_for_handle? : String,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_change? : (@html.Payload) -> @cmd.Cmd,
  on_after_change? : (@html.Payload) -> @cmd.Cmd,
  on_change_complete? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_json(a, "disabled", disabled)
  a = opt_bool(a, "keyboard", keyboard)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "range", range)
  a = opt_num(a, "count", count)
  a = opt_num(a, "min", min)
  a = opt_num(a, "max", max)
  a = opt_str(a, "step", step)
  a = opt_json(a, "value", value)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_bool(a, "allowCross", allow_cross)
  a = opt_num(a, "pushable", pushable)
  a = opt_bool(a, "reverse", reverse)
  a = opt_bool(a, "vertical", vertical)
  a = opt_bool(a, "included", included)
  a = opt_num(a, "startPoint", start_point)
  a = opt_json(a, "trackStyle", track_style)
  a = opt_json(a, "handleStyle", handle_style)
  a = opt_json(a, "railStyle", rail_style)
  a = opt_json(a, "dotStyle", dot_style)
  a = opt_json(a, "activeDotStyle", active_dot_style)
  a = opt_json(a, "marks", marks)
  a = opt_bool(a, "dots", dots)
  a = opt_bool(a, "track", track)
  a = opt_json(a, "tabIndex", tab_index)
  a = opt_json(a, "ariaLabelForHandle", aria_label_for_handle)
  a = opt_json(a, "ariaLabelledByForHandle", aria_labelled_by_for_handle)
  a = opt_bool(a, "ariaRequired", aria_required)
  a = opt_json(a, "ariaValueTextFormatterForHandle", aria_value_text_formatter_for_handle)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeChange", on_before_change)
  a = opt_payload(a, "onAfterChange", on_after_change)
  a = opt_payload(a, "onChangeComplete", on_change_complete)
  @html.node("antd:Slider", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Space`（Props 接口 `SpaceProps`）。
///
/// 参数 69 个（清单里另有 82 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] space(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  size? : String,
  vertical? : Bool,
  orientation? : String,
  align? : String,
  split? : String,
  separator? : String,
  wrap? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "size", size)
  a = opt_bool(a, "vertical", vertical)
  a = opt_str(a, "orientation", orientation)
  a = opt_str(a, "align", align)
  a = opt_str(a, "split", split)
  a = opt_str(a, "separator", separator)
  a = opt_bool(a, "wrap", wrap)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Space", a, children)
}

///|
/// 复合子组件 `antd:Space.Compact`（Props 接口 `SpaceCompactProps`）。
///
/// 参数 66 个（清单里另有 80 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] space_compact(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  size? : String,
  orientation? : String,
  vertical? : Bool,
  block? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "size", size)
  a = opt_str(a, "orientation", orientation)
  a = opt_bool(a, "vertical", vertical)
  a = opt_bool(a, "block", block)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Space.Compact", a, children)
}

///|
/// 复合子组件 `antd:Space.Addon`（Props 接口 `SpaceCompactCellProps`）。
///
/// 参数 65 个（清单里另有 78 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] space_addon(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  variant? : String,
  disabled? : Bool,
  status? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "variant", variant)
  a = opt_bool(a, "disabled", disabled)
  a = opt_str(a, "status", status)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Space.Addon", a, children)
}

///|
/// 组件库 `antd:Spin`（Props 接口 `SpinProps`）。
///
/// 参数 11 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] spin(
  class_name? : String,
  spinning? : Bool,
  style? : String,
  size? : String,
  tip? : String,
  description? : String,
  delay? : Double,
  wrapper_class_name? : String,
  indicator? : String,
  fullscreen? : Bool,
  percent? : String,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "spinning", spinning)
  a = opt_json(a, "style", style)
  a = opt_str(a, "size", size)
  a = opt_str(a, "tip", tip)
  a = opt_str(a, "description", description)
  a = opt_num(a, "delay", delay)
  a = opt_str(a, "wrapperClassName", wrapper_class_name)
  a = opt_str(a, "indicator", indicator)
  a = opt_bool(a, "fullscreen", fullscreen)
  a = opt_str(a, "percent", percent)
  @html.node("antd:Spin", a, children)
}

///|
/// 组件库 `antd:Splitter`（Props 接口 `SplitterProps`）。
///
/// 参数 15 个（清单里另有 4 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn splitter(
  class_name? : String,
  collapsible? : String,
  style? : String,
  layout? : String,
  orientation? : String,
  vertical? : Bool,
  destroy_on_hidden? : Bool,
  dragger_icon? : String,
  collapsible_icon? : String,
  lazy? : Bool,
  on_dragger_double_click? : (@html.Payload) -> @cmd.Cmd,
  on_resize_start? : (@html.Payload) -> @cmd.Cmd,
  on_resize? : (@html.Payload) -> @cmd.Cmd,
  on_resize_end? : (@html.Payload) -> @cmd.Cmd,
  on_collapse? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "collapsible", collapsible)
  a = opt_json(a, "style", style)
  a = opt_str(a, "layout", layout)
  a = opt_str(a, "orientation", orientation)
  a = opt_bool(a, "vertical", vertical)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  a = opt_str(a, "draggerIcon", dragger_icon)
  a = opt_json(a, "collapsibleIcon", collapsible_icon)
  a = opt_bool(a, "lazy", lazy)
  a = opt_payload(a, "onDraggerDoubleClick", on_dragger_double_click)
  a = opt_payload(a, "onResizeStart", on_resize_start)
  a = opt_payload(a, "onResize", on_resize)
  a = opt_payload(a, "onResizeEnd", on_resize_end)
  a = opt_payload(a, "onCollapse", on_collapse)
  @html.node("antd:Splitter", a, ([] : Array[@html.Html]))
}

///|
/// 复合子组件 `antd:Splitter.Panel`（Props 接口 `PanelProps`）。
///
/// 参数 9 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn splitter_panel(
  class_name? : String,
  style? : String,
  min? : String,
  max? : String,
  size? : String,
  collapsible? : String,
  resizable? : Bool,
  default_size? : String,
  destroy_on_hidden? : Bool,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "min", min)
  a = opt_str(a, "max", max)
  a = opt_str(a, "size", size)
  a = opt_json(a, "collapsible", collapsible)
  a = opt_bool(a, "resizable", resizable)
  a = opt_str(a, "defaultSize", default_size)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  @html.node("antd:Splitter.Panel", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Statistic`（Props 接口 `StatisticProps`）。
///
/// 参数 15 个（清单里另有 52 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn statistic(
  role? : String,
  formatter? : String,
  decimal_separator? : String,
  group_separator? : String,
  precision? : Double,
  class_name? : String,
  style? : String,
  value? : String,
  value_style? : String,
  title? : String,
  prefix? : String,
  suffix? : String,
  loading? : Bool,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "role", role)
  a = opt_str(a, "formatter", formatter)
  a = opt_str(a, "decimalSeparator", decimal_separator)
  a = opt_str(a, "groupSeparator", group_separator)
  a = opt_num(a, "precision", precision)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "value", value)
  a = opt_json(a, "valueStyle", value_style)
  a = opt_str(a, "title", title)
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffix", suffix)
  a = opt_bool(a, "loading", loading)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  @html.node("antd:Statistic", a, ([] : Array[@html.Html]))
}

///|
/// 复合子组件 `antd:Statistic.Countdown`（Props 接口 `CountdownProps`）。
///
/// 参数 18 个（清单里另有 52 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn statistic_countdown(
  role? : String,
  formatter? : String,
  decimal_separator? : String,
  group_separator? : String,
  precision? : Double,
  class_name? : String,
  style? : String,
  value? : String,
  value_style? : String,
  title? : String,
  prefix? : String,
  suffix? : String,
  loading? : Bool,
  format? : String,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_finish? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "role", role)
  a = opt_str(a, "formatter", formatter)
  a = opt_str(a, "decimalSeparator", decimal_separator)
  a = opt_str(a, "groupSeparator", group_separator)
  a = opt_num(a, "precision", precision)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "value", value)
  a = opt_json(a, "valueStyle", value_style)
  a = opt_str(a, "title", title)
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffix", suffix)
  a = opt_bool(a, "loading", loading)
  a = opt_str(a, "format", format)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onFinish", on_finish)
  a = opt_payload(a, "onChange", on_change)
  @html.node("antd:Statistic.Countdown", a, ([] : Array[@html.Html]))
}

///|
/// 复合子组件 `antd:Statistic.Timer`（Props 接口 `StatisticTimerProps`）。
///
/// 参数 19 个（清单里另有 52 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn statistic_timer(
  formatter? : String,
  decimal_separator? : String,
  group_separator? : String,
  precision? : Double,
  role? : String,
  class_name? : String,
  style? : String,
  value? : String,
  value_style? : String,
  title? : String,
  prefix? : String,
  suffix? : String,
  loading? : Bool,
  type_? : String,
  format? : String,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_finish? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "formatter", formatter)
  a = opt_str(a, "decimalSeparator", decimal_separator)
  a = opt_str(a, "groupSeparator", group_separator)
  a = opt_num(a, "precision", precision)
  a = opt_str(a, "role", role)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "value", value)
  a = opt_json(a, "valueStyle", value_style)
  a = opt_str(a, "title", title)
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffix", suffix)
  a = opt_bool(a, "loading", loading)
  a = opt_str(a, "type", type_)
  a = opt_str(a, "format", format)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onFinish", on_finish)
  a = opt_payload(a, "onChange", on_change)
  @html.node("antd:Statistic.Timer", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Steps`（Props 接口 `StepsProps`）。
///
/// 参数 19 个（清单里另有 6 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn steps(
  class_name? : String,
  variant? : String,
  size? : String,
  type_? : String,
  orientation? : String,
  label_placement? : String,
  title_placement? : String,
  progress_dot? : Bool,
  responsive? : Bool,
  ellipsis? : Bool,
  max_count? : Double,
  offset? : Double,
  current? : Double,
  initial? : Double,
  items? : String,
  percent? : Double,
  status? : String,
  style? : String,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "variant", variant)
  a = opt_str(a, "size", size)
  a = opt_str(a, "type", type_)
  a = opt_str(a, "orientation", orientation)
  a = opt_str(a, "labelPlacement", label_placement)
  a = opt_str(a, "titlePlacement", title_placement)
  a = opt_bool(a, "progressDot", progress_dot)
  a = opt_bool(a, "responsive", responsive)
  a = opt_bool(a, "ellipsis", ellipsis)
  a = opt_num(a, "maxCount", max_count)
  a = opt_num(a, "offset", offset)
  a = opt_num(a, "current", current)
  a = opt_num(a, "initial", initial)
  a = opt_json(a, "items", items)
  a = opt_num(a, "percent", percent)
  a = opt_str(a, "status", status)
  a = opt_json(a, "style", style)
  a = opt_payload(a, "onChange", on_change)
  @html.node("antd:Steps", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Switch`（Props 接口 `SwitchProps`）。
///
/// 参数 17 个（清单里另有 4 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn switch(
  size? : String,
  class_name? : String,
  checked? : Bool,
  default_checked? : Bool,
  value? : Bool,
  default_value? : Bool,
  checked_children? : String,
  un_checked_children? : String,
  disabled? : Bool,
  loading? : Bool,
  auto_focus? : Bool,
  style? : String,
  title? : String,
  tab_index? : Double,
  id? : String,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_click? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "size", size)
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "checked", checked)
  a = opt_bool(a, "defaultChecked", default_checked)
  a = opt_bool(a, "value", value)
  a = opt_bool(a, "defaultValue", default_value)
  a = opt_str(a, "checkedChildren", checked_children)
  a = opt_str(a, "unCheckedChildren", un_checked_children)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "loading", loading)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "style", style)
  a = opt_str(a, "title", title)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_str(a, "id", id)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onClick", on_click)
  @html.node("antd:Switch", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Table`（Props 接口 `TableProps`）。
///
/// 参数 39 个（清单里另有 16 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] table(
  expanded_row_keys? : String,
  default_expanded_row_keys? : String,
  expand_row_by_click? : Bool,
  default_expand_all_rows? : Bool,
  indent_size? : Double,
  expand_icon_column_index? : Double,
  children_column_name? : String,
  class_name? : String,
  style? : String,
  row_key? : String,
  table_layout? : String,
  expandable? : String,
  row_class_name? : String,
  caption? : String,
  id? : String,
  show_header? : Bool,
  components? : String,
  on_row? : String,
  on_header_row? : String,
  sticky? : String,
  row_hoverable? : Bool,
  dropdown_prefix_cls? : String,
  data_source? : String,
  column? : String,
  columns? : String,
  pagination? : String,
  loading? : String,
  size? : String,
  bordered? : Bool,
  locale? : String,
  row_selection? : String,
  scroll? : String,
  sort_directions? : String,
  show_sorter_tooltip? : String,
  virtual? : Bool,
  on_expand? : (@html.Payload) -> @cmd.Cmd,
  on_expanded_rows_change? : (@html.Payload) -> @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "expandedRowKeys", expanded_row_keys)
  a = opt_json(a, "defaultExpandedRowKeys", default_expanded_row_keys)
  a = opt_bool(a, "expandRowByClick", expand_row_by_click)
  a = opt_bool(a, "defaultExpandAllRows", default_expand_all_rows)
  a = opt_num(a, "indentSize", indent_size)
  a = opt_num(a, "expandIconColumnIndex", expand_icon_column_index)
  a = opt_str(a, "childrenColumnName", children_column_name)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "rowKey", row_key)
  a = opt_str(a, "tableLayout", table_layout)
  a = opt_json(a, "expandable", expandable)
  a = opt_str(a, "rowClassName", row_class_name)
  a = opt_str(a, "caption", caption)
  a = opt_str(a, "id", id)
  a = opt_bool(a, "showHeader", show_header)
  a = opt_json(a, "components", components)
  a = opt_json(a, "onRow", on_row)
  a = opt_json(a, "onHeaderRow", on_header_row)
  a = opt_json(a, "sticky", sticky)
  a = opt_bool(a, "rowHoverable", row_hoverable)
  a = opt_str(a, "dropdownPrefixCls", dropdown_prefix_cls)
  a = opt_json(a, "dataSource", data_source)
  a = opt_json(a, "column", column)
  a = opt_json(a, "columns", columns)
  a = opt_json(a, "pagination", pagination)
  a = opt_json(a, "loading", loading)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "bordered", bordered)
  a = opt_json(a, "locale", locale)
  a = opt_json(a, "rowSelection", row_selection)
  a = opt_json(a, "scroll", scroll)
  a = opt_json(a, "sortDirections", sort_directions)
  a = opt_json(a, "showSorterTooltip", show_sorter_tooltip)
  a = opt_bool(a, "virtual", virtual)
  a = opt_payload(a, "onExpand", on_expand)
  a = opt_payload(a, "onExpandedRowsChange", on_expanded_rows_change)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_payload(a, "onChange", on_change)
  @html.node("antd:Table", a, children)
}

///|
/// 组件库 `antd:Tabs`（Props 接口 `TabsProps`）。
///
/// 参数 87 个（清单里另有 85 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] tabs(
  type_? : String,
  size? : String,
  hide_add? : Bool,
  centered? : Bool,
  class_name? : String,
  tab_position? : String,
  tab_placement? : String,
  indicator_size? : Double,
  items? : String,
  destroy_inactive_tab_pane? : Bool,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  active_key? : String,
  default_active_key? : String,
  animated? : String,
  tab_bar_extra_content? : String,
  tab_bar_gutter? : Double,
  tab_bar_style? : String,
  destroy_on_hidden? : Bool,
  locale? : String,
  more? : String,
  indicator? : String,
  add_icon? : String,
  more_icon? : String,
  remove_icon? : String,
  on_edit? : (@html.Payload) -> @cmd.Cmd,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_tab_click? : (@html.Payload) -> @cmd.Cmd,
  on_tab_scroll? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "type", type_)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "hideAdd", hide_add)
  a = opt_bool(a, "centered", centered)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "tabPosition", tab_position)
  a = opt_str(a, "tabPlacement", tab_placement)
  a = opt_num(a, "indicatorSize", indicator_size)
  a = opt_json(a, "items", items)
  a = opt_bool(a, "destroyInactiveTabPane", destroy_inactive_tab_pane)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "activeKey", active_key)
  a = opt_str(a, "defaultActiveKey", default_active_key)
  a = opt_json(a, "animated", animated)
  a = opt_json(a, "tabBarExtraContent", tab_bar_extra_content)
  a = opt_num(a, "tabBarGutter", tab_bar_gutter)
  a = opt_json(a, "tabBarStyle", tab_bar_style)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  a = opt_json(a, "locale", locale)
  a = opt_json(a, "more", more)
  a = opt_json(a, "indicator", indicator)
  a = opt_str(a, "addIcon", add_icon)
  a = opt_str(a, "moreIcon", more_icon)
  a = opt_str(a, "removeIcon", remove_icon)
  a = opt_payload(a, "onEdit", on_edit)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onTabClick", on_tab_click)
  a = opt_payload(a, "onTabScroll", on_tab_scroll)
  @html.node("antd:Tabs", a, children)
}

///|
/// 复合子组件 `antd:Tabs.TabPane`（Props 接口 `TabPaneProps`）。
///
/// 参数 14 个（清单里另有 2 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] tabs_tab_pane(
  destroy_inactive_tab_pane? : Bool,
  tab? : String,
  class_name? : String,
  style? : String,
  disabled? : Bool,
  force_render? : Bool,
  closable? : Bool,
  close_icon? : String,
  icon? : String,
  tab_key? : String,
  id? : String,
  animated? : Bool,
  active? : Bool,
  destroy_on_hidden? : Bool,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_bool(a, "destroyInactiveTabPane", destroy_inactive_tab_pane)
  a = opt_str(a, "tab", tab)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "forceRender", force_render)
  a = opt_bool(a, "closable", closable)
  a = opt_str(a, "closeIcon", close_icon)
  a = opt_str(a, "icon", icon)
  a = opt_str(a, "tabKey", tab_key)
  a = opt_str(a, "id", id)
  a = opt_bool(a, "animated", animated)
  a = opt_bool(a, "active", active)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  @html.node("antd:Tabs.TabPane", a, children)
}

///|
/// 组件库 `antd:Tag`（Props 接口 `TagProps`）。
///
/// 参数 72 个（清单里另有 80 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] tag(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  color? : String,
  variant? : String,
  closable? : String,
  close_icon? : String,
  icon? : String,
  bordered? : Bool,
  href? : String,
  target? : String,
  disabled? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_close? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "color", color)
  a = opt_str(a, "variant", variant)
  a = opt_json(a, "closable", closable)
  a = opt_str(a, "closeIcon", close_icon)
  a = opt_str(a, "icon", icon)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "href", href)
  a = opt_str(a, "target", target)
  a = opt_bool(a, "disabled", disabled)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_cmd(a, "onClose", on_close)
  @html.node("antd:Tag", a, children)
}

///|
/// 复合子组件 `antd:Tag.CheckableTag`（Props 接口 `CheckableTagProps`）。
///
/// 参数 8 个（清单里另有 2 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] tag_checkable_tag(
  class_name? : String,
  style? : String,
  checked? : Bool,
  icon? : String,
  disabled? : Bool,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "checked", checked)
  a = opt_str(a, "icon", icon)
  a = opt_bool(a, "disabled", disabled)
  a = opt_payload(a, "onChange", on_change)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  @html.node("antd:Tag.CheckableTag", a, children)
}

///|
/// 复合子组件 `antd:Tag.CheckableTagGroup`（Props 接口 `CheckableTagGroupProps`）。
///
/// 参数 9 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn tag_checkable_tag_group(
  options? : String,
  disabled? : Bool,
  value? : String,
  default_value? : String,
  class_name? : String,
  style? : String,
  id? : String,
  role? : String,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "options", options)
  a = opt_bool(a, "disabled", disabled)
  a = opt_json(a, "value", value)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "role", role)
  a = opt_payload(a, "onChange", on_change)
  @html.node("antd:Tag.CheckableTagGroup", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:TimePicker`（Props 接口 `TimePickerProps`）。
///
/// 参数 12 个（清单里另有 7 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn time_picker(
  locale? : String,
  size? : String,
  placement? : String,
  bordered? : Bool,
  status? : String,
  variant? : String,
  multiple? : String,
  default_value? : String,
  value? : String,
  on_select? : (@html.Payload) -> @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_ok? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "locale", locale)
  a = opt_str(a, "size", size)
  a = opt_str(a, "placement", placement)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "status", status)
  a = opt_str(a, "variant", variant)
  a = opt_json(a, "multiple", multiple)
  a = opt_str(a, "defaultValue", default_value)
  a = opt_str(a, "value", value)
  a = opt_payload(a, "onSelect", on_select)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onOk", on_ok)
  @html.node("antd:TimePicker", a, ([] : Array[@html.Html]))
}

///|
/// 复合子组件 `antd:TimePicker.RangePicker`（Props 接口 `RangePickerProps`）。
///
/// 参数 133 个（清单里另有 105 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] time_picker_range_picker(
  class_name? : String,
  style? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  accept? : String,
  alt? : String,
  auto_complete? : String,
  checked? : Bool,
  height? : String,
  max_length? : Double,
  min_length? : Double,
  multiple? : Bool,
  name? : String,
  pattern? : String,
  read_only? : Bool,
  required? : Bool,
  src? : String,
  step? : String,
  width? : String,
  prev_icon? : String,
  next_icon? : String,
  super_prev_icon? : String,
  super_next_icon? : String,
  show_week? : Bool,
  format? : String,
  prefix? : String,
  suffix_icon? : String,
  allow_clear? : String,
  clear_icon? : String,
  input_read_only? : Bool,
  order? : Bool,
  min_date? : String,
  max_date? : String,
  default_open_value? : String,
  default_open? : Bool,
  open? : Bool,
  popup_align? : String,
  placement? : String,
  builtin_placements? : String,
  need_confirm? : Bool,
  change_on_blur? : Bool,
  preserve_invalid_on_blur? : Bool,
  preview_value? : String,
  transition_name? : String,
  components? : String,
  show_now? : Bool,
  show_today? : Bool,
  id? : String,
  separator? : String,
  value? : String,
  default_value? : String,
  placeholder? : String,
  default_picker_value? : String,
  picker_value? : String,
  presets? : String,
  ranges? : String,
  disabled? : String,
  allow_empty? : String,
  show_time? : String,
  mode? : String,
  show_hour? : Bool,
  show_minute? : Bool,
  show_second? : Bool,
  show_millisecond? : Bool,
  use12_hours? : Bool,
  hide_disabled_options? : Bool,
  change_on_scroll? : Bool,
  locale? : String,
  size? : String,
  bordered? : Bool,
  status? : String,
  variant? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_clear? : (@html.Payload) -> @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_calendar_change? : (@html.Payload) -> @cmd.Cmd,
  on_ok? : (@html.Payload) -> @cmd.Cmd,
  on_picker_value_change? : (@html.Payload) -> @cmd.Cmd,
  on_panel_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "accept", accept)
  a = opt_str(a, "alt", alt)
  a = opt_str(a, "autoComplete", auto_complete)
  a = opt_bool(a, "checked", checked)
  a = opt_str(a, "height", height)
  a = opt_num(a, "maxLength", max_length)
  a = opt_num(a, "minLength", min_length)
  a = opt_bool(a, "multiple", multiple)
  a = opt_str(a, "name", name)
  a = opt_str(a, "pattern", pattern)
  a = opt_bool(a, "readOnly", read_only)
  a = opt_bool(a, "required", required)
  a = opt_str(a, "src", src)
  a = opt_str(a, "step", step)
  a = opt_str(a, "width", width)
  a = opt_str(a, "prevIcon", prev_icon)
  a = opt_str(a, "nextIcon", next_icon)
  a = opt_str(a, "superPrevIcon", super_prev_icon)
  a = opt_str(a, "superNextIcon", super_next_icon)
  a = opt_bool(a, "showWeek", show_week)
  a = opt_json(a, "format", format)
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffixIcon", suffix_icon)
  a = opt_json(a, "allowClear", allow_clear)
  a = opt_str(a, "clearIcon", clear_icon)
  a = opt_bool(a, "inputReadOnly", input_read_only)
  a = opt_bool(a, "order", order)
  a = opt_json(a, "minDate", min_date)
  a = opt_json(a, "maxDate", max_date)
  a = opt_json(a, "defaultOpenValue", default_open_value)
  a = opt_bool(a, "defaultOpen", default_open)
  a = opt_bool(a, "open", open)
  a = opt_json(a, "popupAlign", popup_align)
  a = opt_str(a, "placement", placement)
  a = opt_json(a, "builtinPlacements", builtin_placements)
  a = opt_bool(a, "needConfirm", need_confirm)
  a = opt_bool(a, "changeOnBlur", change_on_blur)
  a = opt_bool(a, "preserveInvalidOnBlur", preserve_invalid_on_blur)
  a = opt_str(a, "previewValue", preview_value)
  a = opt_str(a, "transitionName", transition_name)
  a = opt_json(a, "components", components)
  a = opt_bool(a, "showNow", show_now)
  a = opt_bool(a, "showToday", show_today)
  a = opt_json(a, "id", id)
  a = opt_str(a, "separator", separator)
  a = opt_json(a, "value", value)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_json(a, "placeholder", placeholder)
  a = opt_json(a, "defaultPickerValue", default_picker_value)
  a = opt_json(a, "pickerValue", picker_value)
  a = opt_json(a, "presets", presets)
  a = opt_json(a, "ranges", ranges)
  a = opt_json(a, "disabled", disabled)
  a = opt_json(a, "allowEmpty", allow_empty)
  a = opt_json(a, "showTime", show_time)
  a = opt_json(a, "mode", mode)
  a = opt_bool(a, "showHour", show_hour)
  a = opt_bool(a, "showMinute", show_minute)
  a = opt_bool(a, "showSecond", show_second)
  a = opt_bool(a, "showMillisecond", show_millisecond)
  a = opt_bool(a, "use12Hours", use12_hours)
  a = opt_bool(a, "hideDisabledOptions", hide_disabled_options)
  a = opt_bool(a, "changeOnScroll", change_on_scroll)
  a = opt_json(a, "locale", locale)
  a = opt_str(a, "size", size)
  a = opt_bool(a, "bordered", bordered)
  a = opt_str(a, "status", status)
  a = opt_str(a, "variant", variant)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_payload(a, "onClear", on_clear)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_payload(a, "onOpenChange", on_open_change)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onCalendarChange", on_calendar_change)
  a = opt_payload(a, "onOk", on_ok)
  a = opt_payload(a, "onPickerValueChange", on_picker_value_change)
  a = opt_payload(a, "onPanelChange", on_panel_change)
  @html.node("antd:TimePicker.RangePicker", a, children)
}

///|
/// 组件库 `antd:Timeline`（Props 接口 `TimelineProps`）。
///
/// 参数 10 个（清单里另有 5 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] timeline(
  class_name? : String,
  style? : String,
  variant? : String,
  mode? : String,
  orientation? : String,
  title_span? : String,
  items? : String,
  pending? : String,
  pending_dot? : String,
  reverse? : Bool,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "variant", variant)
  a = opt_str(a, "mode", mode)
  a = opt_str(a, "orientation", orientation)
  a = opt_str(a, "titleSpan", title_span)
  a = opt_json(a, "items", items)
  a = opt_str(a, "pending", pending)
  a = opt_str(a, "pendingDot", pending_dot)
  a = opt_bool(a, "reverse", reverse)
  @html.node("antd:Timeline", a, children)
}

///|
/// 组件库 `antd:Tooltip`（Props 接口 `TooltipProps`）。
///
/// 参数 15 个（清单里另有 9 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] tooltip(
  style? : String,
  class_name? : String,
  color? : String,
  placement? : String,
  open_class_name? : String,
  arrow? : String,
  auto_adjust_overflow? : String,
  destroy_on_hidden? : Bool,
  destroy_tooltip_on_hide? : String,
  overlay_style? : String,
  overlay_inner_style? : String,
  overlay_class_name? : String,
  title? : String,
  overlay? : String,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_str(a, "color", color)
  a = opt_str(a, "placement", placement)
  a = opt_str(a, "openClassName", open_class_name)
  a = opt_json(a, "arrow", arrow)
  a = opt_json(a, "autoAdjustOverflow", auto_adjust_overflow)
  a = opt_bool(a, "destroyOnHidden", destroy_on_hidden)
  a = opt_json(a, "destroyTooltipOnHide", destroy_tooltip_on_hide)
  a = opt_json(a, "overlayStyle", overlay_style)
  a = opt_json(a, "overlayInnerStyle", overlay_inner_style)
  a = opt_str(a, "overlayClassName", overlay_class_name)
  a = opt_str(a, "title", title)
  a = opt_str(a, "overlay", overlay)
  a = opt_payload(a, "onOpenChange", on_open_change)
  @html.node("antd:Tooltip", a, children)
}

///|
/// 复合子组件 `antd:Tooltip.UniqueProvider`（Props 接口 `无（只有 attrs?）`）。
///
/// 参数 0 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 这个子组件**没找到 props 接口**（生成器只在它自己的模块里找，不跨组件猜）——
/// 于是只有 `attrs?`：prop 得手写（`@html.Attrs::build().prop_str(…)`），没有编译期检查。
pub fn[C : @html.IsChildren] tooltip_unique_provider(
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  @html.node("antd:Tooltip.UniqueProvider", a, children)
}

///|
/// 组件库 `antd:Tour`（Props 接口 `TourProps`）。
///
/// 参数 24 个（清单里另有 7 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn tour(
  class_name? : String,
  style? : String,
  steps? : String,
  open? : Bool,
  keyboard? : Bool,
  default_open? : Bool,
  default_current? : Double,
  current? : Double,
  close_icon? : String,
  closable? : String,
  mask? : String,
  arrow? : String,
  placement? : String,
  gap? : String,
  animated? : String,
  scroll_into_view_options? : Bool,
  z_index? : Double,
  builtin_placements? : String,
  disabled_interaction? : Bool,
  type_? : String,
  on_popup_align? : (@html.Payload) -> @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_close? : (@html.Payload) -> @cmd.Cmd,
  on_finish? : @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_json(a, "steps", steps)
  a = opt_bool(a, "open", open)
  a = opt_bool(a, "keyboard", keyboard)
  a = opt_bool(a, "defaultOpen", default_open)
  a = opt_num(a, "defaultCurrent", default_current)
  a = opt_num(a, "current", current)
  a = opt_str(a, "closeIcon", close_icon)
  a = opt_json(a, "closable", closable)
  a = opt_json(a, "mask", mask)
  a = opt_json(a, "arrow", arrow)
  a = opt_str(a, "placement", placement)
  a = opt_json(a, "gap", gap)
  a = opt_json(a, "animated", animated)
  a = opt_bool(a, "scrollIntoViewOptions", scroll_into_view_options)
  a = opt_num(a, "zIndex", z_index)
  a = opt_json(a, "builtinPlacements", builtin_placements)
  a = opt_bool(a, "disabledInteraction", disabled_interaction)
  a = opt_str(a, "type", type_)
  a = opt_payload(a, "onPopupAlign", on_popup_align)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onClose", on_close)
  a = opt_cmd(a, "onFinish", on_finish)
  @html.node("antd:Tour", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Transfer`（Props 接口 `TransferProps`）。
///
/// 参数 81 个（清单里另有 85 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] transfer(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  list_style? : String,
  operation_style? : String,
  disabled? : Bool,
  data_source? : String,
  target_keys? : String,
  selected_keys? : String,
  titles? : String,
  operations? : String,
  actions? : String,
  show_search? : String,
  locale? : String,
  show_select_all? : Bool,
  select_all_labels? : String,
  one_way? : Bool,
  pagination? : String,
  status? : String,
  selections_icon? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_select_change? : (@html.Payload) -> @cmd.Cmd,
  on_search? : (@html.Payload) -> @cmd.Cmd,
  on_scroll? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "listStyle", list_style)
  a = opt_json(a, "operationStyle", operation_style)
  a = opt_bool(a, "disabled", disabled)
  a = opt_json(a, "dataSource", data_source)
  a = opt_json(a, "targetKeys", target_keys)
  a = opt_json(a, "selectedKeys", selected_keys)
  a = opt_json(a, "titles", titles)
  a = opt_json(a, "operations", operations)
  a = opt_json(a, "actions", actions)
  a = opt_json(a, "showSearch", show_search)
  a = opt_json(a, "locale", locale)
  a = opt_bool(a, "showSelectAll", show_select_all)
  a = opt_json(a, "selectAllLabels", select_all_labels)
  a = opt_bool(a, "oneWay", one_way)
  a = opt_json(a, "pagination", pagination)
  a = opt_str(a, "status", status)
  a = opt_str(a, "selectionsIcon", selections_icon)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onSelectChange", on_select_change)
  a = opt_payload(a, "onSearch", on_search)
  a = opt_payload(a, "onScroll", on_scroll)
  @html.node("antd:Transfer", a, children)
}

///|
/// 复合子组件 `antd:Transfer.List`（Props 接口 `TransferListProps`）。
///
/// 参数 27 个（清单里另有 10 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn transfer_list(
  titles? : String,
  not_found_content? : String,
  search_placeholder? : String,
  item_unit? : String,
  items_unit? : String,
  remove? : String,
  select_all? : String,
  deselect_all? : String,
  select_current? : String,
  select_invert? : String,
  remove_all? : String,
  remove_current? : String,
  style? : String,
  title_text? : String,
  data_source? : String,
  checked_keys? : String,
  show_search? : String,
  disabled? : Bool,
  show_select_all? : Bool,
  select_all_label? : String,
  show_remove? : Bool,
  pagination? : String,
  selections_icon? : String,
  on_item_select? : (@html.Payload) -> @cmd.Cmd,
  on_item_select_all? : (@html.Payload) -> @cmd.Cmd,
  on_item_remove? : (@html.Payload) -> @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_json(a, "titles", titles)
  a = opt_json(a, "notFoundContent", not_found_content)
  a = opt_str(a, "searchPlaceholder", search_placeholder)
  a = opt_str(a, "itemUnit", item_unit)
  a = opt_str(a, "itemsUnit", items_unit)
  a = opt_str(a, "remove", remove)
  a = opt_str(a, "selectAll", select_all)
  a = opt_str(a, "deselectAll", deselect_all)
  a = opt_str(a, "selectCurrent", select_current)
  a = opt_str(a, "selectInvert", select_invert)
  a = opt_str(a, "removeAll", remove_all)
  a = opt_str(a, "removeCurrent", remove_current)
  a = opt_json(a, "style", style)
  a = opt_str(a, "titleText", title_text)
  a = opt_json(a, "dataSource", data_source)
  a = opt_json(a, "checkedKeys", checked_keys)
  a = opt_json(a, "showSearch", show_search)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "showSelectAll", show_select_all)
  a = opt_str(a, "selectAllLabel", select_all_label)
  a = opt_bool(a, "showRemove", show_remove)
  a = opt_json(a, "pagination", pagination)
  a = opt_str(a, "selectionsIcon", selections_icon)
  a = opt_payload(a, "onItemSelect", on_item_select)
  a = opt_payload(a, "onItemSelectAll", on_item_select_all)
  a = opt_payload(a, "onItemRemove", on_item_remove)
  a = opt_cmd(a, "onScroll", on_scroll)
  @html.node("antd:Transfer.List", a, ([] : Array[@html.Html]))
}

///|
/// 复合子组件 `antd:Transfer.Search`（Props 接口 `TransferSearchProps`）。
///
/// 参数 4 个（清单里另有 2 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn transfer_search(
  placeholder? : String,
  value? : String,
  disabled? : Bool,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "placeholder", placeholder)
  a = opt_str(a, "value", value)
  a = opt_bool(a, "disabled", disabled)
  a = opt_payload(a, "onChange", on_change)
  @html.node("antd:Transfer.Search", a, ([] : Array[@html.Html]))
}

///|
/// 复合子组件 `antd:Transfer.Operation`（Props 接口 `TransferOperationProps`）。
///
/// 参数 7 个（清单里另有 3 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn transfer_operation(
  class_name? : String,
  actions? : String,
  left_active? : Bool,
  right_active? : Bool,
  style? : String,
  disabled? : Bool,
  one_way? : Bool,
  attrs? : @html.Attrs,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "actions", actions)
  a = opt_bool(a, "leftActive", left_active)
  a = opt_bool(a, "rightActive", right_active)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "oneWay", one_way)
  @html.node("antd:Transfer.Operation", a, ([] : Array[@html.Html]))
}

///|
/// 组件库 `antd:Tree`（Props 接口 `TreeProps`）。
///
/// 参数 59 个（清单里另有 11 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] tree(
  class_name? : String,
  style? : String,
  focusable? : Bool,
  active_key? : String,
  tab_index? : Double,
  tree_data? : String,
  field_names? : String,
  show_icon? : Bool,
  selectable? : Bool,
  expand_action? : String,
  disabled? : Bool,
  multiple? : Bool,
  checkable? : Bool,
  check_strictly? : Bool,
  default_expand_parent? : Bool,
  auto_expand_parent? : Bool,
  default_expand_all? : Bool,
  default_expanded_keys? : String,
  expanded_keys? : String,
  default_checked_keys? : String,
  checked_keys? : String,
  default_selected_keys? : String,
  selected_keys? : String,
  loaded_keys? : String,
  motion? : String,
  height? : Double,
  item_height? : Double,
  scroll_width? : Double,
  item_scroll_offset? : Double,
  virtual? : Bool,
  show_line? : String,
  root_style? : String,
  draggable? : String,
  icon? : String,
  switcher_icon? : String,
  switcher_loading_icon? : String,
  block_node? : Bool,
  on_mouse_down? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_expand? : (@html.Payload) -> @cmd.Cmd,
  on_check? : (@html.Payload) -> @cmd.Cmd,
  on_select? : (@html.Payload) -> @cmd.Cmd,
  on_load? : (@html.Payload) -> @cmd.Cmd,
  on_mouse_enter? : (@html.Payload) -> @cmd.Cmd,
  on_mouse_leave? : (@html.Payload) -> @cmd.Cmd,
  on_right_click? : (@html.Payload) -> @cmd.Cmd,
  on_drag_start? : (@html.Payload) -> @cmd.Cmd,
  on_drag_enter? : (@html.Payload) -> @cmd.Cmd,
  on_drag_over? : (@html.Payload) -> @cmd.Cmd,
  on_drag_leave? : (@html.Payload) -> @cmd.Cmd,
  on_drag_end? : (@html.Payload) -> @cmd.Cmd,
  on_drop? : (@html.Payload) -> @cmd.Cmd,
  on_active_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "focusable", focusable)
  a = opt_str(a, "activeKey", active_key)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_json(a, "treeData", tree_data)
  a = opt_json(a, "fieldNames", field_names)
  a = opt_bool(a, "showIcon", show_icon)
  a = opt_bool(a, "selectable", selectable)
  a = opt_str(a, "expandAction", expand_action)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "multiple", multiple)
  a = opt_bool(a, "checkable", checkable)
  a = opt_bool(a, "checkStrictly", check_strictly)
  a = opt_bool(a, "defaultExpandParent", default_expand_parent)
  a = opt_bool(a, "autoExpandParent", auto_expand_parent)
  a = opt_bool(a, "defaultExpandAll", default_expand_all)
  a = opt_json(a, "defaultExpandedKeys", default_expanded_keys)
  a = opt_json(a, "expandedKeys", expanded_keys)
  a = opt_json(a, "defaultCheckedKeys", default_checked_keys)
  a = opt_json(a, "checkedKeys", checked_keys)
  a = opt_json(a, "defaultSelectedKeys", default_selected_keys)
  a = opt_json(a, "selectedKeys", selected_keys)
  a = opt_json(a, "loadedKeys", loaded_keys)
  a = opt_json(a, "motion", motion)
  a = opt_num(a, "height", height)
  a = opt_num(a, "itemHeight", item_height)
  a = opt_num(a, "scrollWidth", scroll_width)
  a = opt_num(a, "itemScrollOffset", item_scroll_offset)
  a = opt_bool(a, "virtual", virtual)
  a = opt_json(a, "showLine", show_line)
  a = opt_json(a, "rootStyle", root_style)
  a = opt_json(a, "draggable", draggable)
  a = opt_str(a, "icon", icon)
  a = opt_str(a, "switcherIcon", switcher_icon)
  a = opt_str(a, "switcherLoadingIcon", switcher_loading_icon)
  a = opt_bool(a, "blockNode", block_node)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_payload(a, "onExpand", on_expand)
  a = opt_payload(a, "onCheck", on_check)
  a = opt_payload(a, "onSelect", on_select)
  a = opt_payload(a, "onLoad", on_load)
  a = opt_payload(a, "onMouseEnter", on_mouse_enter)
  a = opt_payload(a, "onMouseLeave", on_mouse_leave)
  a = opt_payload(a, "onRightClick", on_right_click)
  a = opt_payload(a, "onDragStart", on_drag_start)
  a = opt_payload(a, "onDragEnter", on_drag_enter)
  a = opt_payload(a, "onDragOver", on_drag_over)
  a = opt_payload(a, "onDragLeave", on_drag_leave)
  a = opt_payload(a, "onDragEnd", on_drag_end)
  a = opt_payload(a, "onDrop", on_drop)
  a = opt_payload(a, "onActiveChange", on_active_change)
  @html.node("antd:Tree", a, children)
}

///|
/// 复合子组件 `antd:Tree.TreeNode`（Props 接口 `TreeNodeProps`）。
///
/// 参数 28 个（清单里另有 3 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] tree_tree_node(
  event_key? : String,
  class_name? : String,
  style? : String,
  id? : String,
  tree_id? : String,
  expanded? : Bool,
  selected? : Bool,
  checked? : Bool,
  loaded? : Bool,
  loading? : Bool,
  half_checked? : Bool,
  title? : String,
  drag_over? : Bool,
  drag_over_gap_top? : Bool,
  drag_over_gap_bottom? : Bool,
  pos? : String,
  data? : String,
  is_start? : String,
  is_end? : String,
  active? : Bool,
  is_leaf? : Bool,
  checkable? : Bool,
  selectable? : Bool,
  disabled? : Bool,
  disable_checkbox? : Bool,
  icon? : String,
  switcher_icon? : String,
  on_mouse_move? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "eventKey", event_key)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "treeId", tree_id)
  a = opt_bool(a, "expanded", expanded)
  a = opt_bool(a, "selected", selected)
  a = opt_bool(a, "checked", checked)
  a = opt_bool(a, "loaded", loaded)
  a = opt_bool(a, "loading", loading)
  a = opt_bool(a, "halfChecked", half_checked)
  a = opt_str(a, "title", title)
  a = opt_bool(a, "dragOver", drag_over)
  a = opt_bool(a, "dragOverGapTop", drag_over_gap_top)
  a = opt_bool(a, "dragOverGapBottom", drag_over_gap_bottom)
  a = opt_str(a, "pos", pos)
  a = opt_json(a, "data", data)
  a = opt_json(a, "isStart", is_start)
  a = opt_json(a, "isEnd", is_end)
  a = opt_bool(a, "active", active)
  a = opt_bool(a, "isLeaf", is_leaf)
  a = opt_bool(a, "checkable", checkable)
  a = opt_bool(a, "selectable", selectable)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "disableCheckbox", disable_checkbox)
  a = opt_str(a, "icon", icon)
  a = opt_str(a, "switcherIcon", switcher_icon)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  @html.node("antd:Tree.TreeNode", a, children)
}

///|
/// 复合子组件 `antd:Tree.DirectoryTree`（Props 接口 `DirectoryTreeProps`）。
///
/// 参数 59 个（清单里另有 11 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] tree_directory_tree(
  class_name? : String,
  style? : String,
  focusable? : Bool,
  active_key? : String,
  tab_index? : Double,
  tree_data? : String,
  field_names? : String,
  show_icon? : Bool,
  selectable? : Bool,
  expand_action? : String,
  disabled? : Bool,
  multiple? : Bool,
  checkable? : Bool,
  check_strictly? : Bool,
  default_expand_parent? : Bool,
  auto_expand_parent? : Bool,
  default_expand_all? : Bool,
  default_expanded_keys? : String,
  expanded_keys? : String,
  default_checked_keys? : String,
  checked_keys? : String,
  default_selected_keys? : String,
  selected_keys? : String,
  loaded_keys? : String,
  motion? : String,
  height? : Double,
  item_height? : Double,
  scroll_width? : Double,
  item_scroll_offset? : Double,
  virtual? : Bool,
  show_line? : String,
  root_style? : String,
  draggable? : String,
  icon? : String,
  switcher_icon? : String,
  switcher_loading_icon? : String,
  block_node? : Bool,
  on_mouse_down? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_expand? : (@html.Payload) -> @cmd.Cmd,
  on_check? : (@html.Payload) -> @cmd.Cmd,
  on_select? : (@html.Payload) -> @cmd.Cmd,
  on_load? : (@html.Payload) -> @cmd.Cmd,
  on_mouse_enter? : (@html.Payload) -> @cmd.Cmd,
  on_mouse_leave? : (@html.Payload) -> @cmd.Cmd,
  on_right_click? : (@html.Payload) -> @cmd.Cmd,
  on_drag_start? : (@html.Payload) -> @cmd.Cmd,
  on_drag_enter? : (@html.Payload) -> @cmd.Cmd,
  on_drag_over? : (@html.Payload) -> @cmd.Cmd,
  on_drag_leave? : (@html.Payload) -> @cmd.Cmd,
  on_drag_end? : (@html.Payload) -> @cmd.Cmd,
  on_drop? : (@html.Payload) -> @cmd.Cmd,
  on_active_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "focusable", focusable)
  a = opt_str(a, "activeKey", active_key)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_json(a, "treeData", tree_data)
  a = opt_json(a, "fieldNames", field_names)
  a = opt_bool(a, "showIcon", show_icon)
  a = opt_bool(a, "selectable", selectable)
  a = opt_str(a, "expandAction", expand_action)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "multiple", multiple)
  a = opt_bool(a, "checkable", checkable)
  a = opt_bool(a, "checkStrictly", check_strictly)
  a = opt_bool(a, "defaultExpandParent", default_expand_parent)
  a = opt_bool(a, "autoExpandParent", auto_expand_parent)
  a = opt_bool(a, "defaultExpandAll", default_expand_all)
  a = opt_json(a, "defaultExpandedKeys", default_expanded_keys)
  a = opt_json(a, "expandedKeys", expanded_keys)
  a = opt_json(a, "defaultCheckedKeys", default_checked_keys)
  a = opt_json(a, "checkedKeys", checked_keys)
  a = opt_json(a, "defaultSelectedKeys", default_selected_keys)
  a = opt_json(a, "selectedKeys", selected_keys)
  a = opt_json(a, "loadedKeys", loaded_keys)
  a = opt_json(a, "motion", motion)
  a = opt_num(a, "height", height)
  a = opt_num(a, "itemHeight", item_height)
  a = opt_num(a, "scrollWidth", scroll_width)
  a = opt_num(a, "itemScrollOffset", item_scroll_offset)
  a = opt_bool(a, "virtual", virtual)
  a = opt_json(a, "showLine", show_line)
  a = opt_json(a, "rootStyle", root_style)
  a = opt_json(a, "draggable", draggable)
  a = opt_str(a, "icon", icon)
  a = opt_str(a, "switcherIcon", switcher_icon)
  a = opt_str(a, "switcherLoadingIcon", switcher_loading_icon)
  a = opt_bool(a, "blockNode", block_node)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_payload(a, "onExpand", on_expand)
  a = opt_payload(a, "onCheck", on_check)
  a = opt_payload(a, "onSelect", on_select)
  a = opt_payload(a, "onLoad", on_load)
  a = opt_payload(a, "onMouseEnter", on_mouse_enter)
  a = opt_payload(a, "onMouseLeave", on_mouse_leave)
  a = opt_payload(a, "onRightClick", on_right_click)
  a = opt_payload(a, "onDragStart", on_drag_start)
  a = opt_payload(a, "onDragEnter", on_drag_enter)
  a = opt_payload(a, "onDragOver", on_drag_over)
  a = opt_payload(a, "onDragLeave", on_drag_leave)
  a = opt_payload(a, "onDragEnd", on_drag_end)
  a = opt_payload(a, "onDrop", on_drop)
  a = opt_payload(a, "onActiveChange", on_active_change)
  @html.node("antd:Tree.DirectoryTree", a, children)
}

///|
/// 组件库 `antd:TreeSelect`（Props 接口 `TreeSelectProps`）。
///
/// 参数 98 个（清单里另有 65 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] tree_select(
  id? : String,
  omit_dom_props? : String,
  display_values? : String,
  active_value? : String,
  active_descendant_id? : String,
  search_value? : String,
  auto_clear_search_value? : Bool,
  option_list? : String,
  empty_options? : Bool,
  role? : String,
  class_name? : String,
  style? : String,
  auto_focus? : Bool,
  placeholder? : String,
  max_count? : Double,
  title? : String,
  tab_index? : Double,
  not_found_content? : String,
  max_length? : Double,
  show_scroll_bar? : String,
  choice_transition_name? : String,
  disabled? : Bool,
  loading? : Bool,
  open? : Bool,
  default_open? : Bool,
  max_tag_text_length? : Double,
  max_tag_count? : String,
  max_tag_placeholder? : String,
  token_separators? : String,
  allow_clear? : String,
  prefix? : String,
  suffix_icon? : String,
  suffix? : String,
  clear_icon? : String,
  remove_icon? : String,
  animation? : String,
  transition_name? : String,
  popup_match_select_width? : Double,
  popup_align? : String,
  placement? : String,
  builtin_placements? : String,
  show_action? : String,
  components? : String,
  value? : String,
  default_value? : String,
  show_search? : String,
  input_value? : String,
  filter_tree_node? : Bool,
  tree_node_filter_prop? : String,
  tree_node_label_prop? : String,
  field_names? : String,
  multiple? : Bool,
  tree_checkable? : String,
  tree_check_strictly? : Bool,
  label_in_value? : Bool,
  tree_data? : String,
  tree_data_simple_mode? : String,
  tree_loaded_keys? : String,
  tree_default_expand_all? : Bool,
  tree_expanded_keys? : String,
  tree_default_expanded_keys? : String,
  tree_expand_action? : String,
  virtual? : Bool,
  list_height? : Double,
  list_item_height? : Double,
  list_item_scroll_offset? : Double,
  tree_icon? : String,
  size? : String,
  status? : String,
  variant? : String,
  bordered? : Bool,
  tree_line? : String,
  switcher_icon? : String,
  dropdown_match_select_width? : Double,
  show_arrow? : Bool,
  on_display_values_change? : (@html.Payload) -> @cmd.Cmd,
  on_active_value_change? : (@html.Payload) -> @cmd.Cmd,
  on_search? : (@html.Payload) -> @cmd.Cmd,
  on_search_split? : (@html.Payload) -> @cmd.Cmd,
  on_clear? : @cmd.Cmd,
  on_popup_visible_change? : (@html.Payload) -> @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_popup_scroll? : @cmd.Cmd,
  on_input_key_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_select? : (@html.Payload) -> @cmd.Cmd,
  on_deselect? : (@html.Payload) -> @cmd.Cmd,
  on_tree_load? : (@html.Payload) -> @cmd.Cmd,
  on_tree_expand? : (@html.Payload) -> @cmd.Cmd,
  on_dropdown_visible_change? : (@html.Payload) -> @cmd.Cmd,
  on_open_change? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "id", id)
  a = opt_json(a, "omitDomProps", omit_dom_props)
  a = opt_json(a, "displayValues", display_values)
  a = opt_str(a, "activeValue", active_value)
  a = opt_str(a, "activeDescendantId", active_descendant_id)
  a = opt_str(a, "searchValue", search_value)
  a = opt_bool(a, "autoClearSearchValue", auto_clear_search_value)
  a = opt_json(a, "OptionList", option_list)
  a = opt_bool(a, "emptyOptions", empty_options)
  a = opt_str(a, "role", role)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_str(a, "placeholder", placeholder)
  a = opt_num(a, "maxCount", max_count)
  a = opt_str(a, "title", title)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_str(a, "notFoundContent", not_found_content)
  a = opt_num(a, "maxLength", max_length)
  a = opt_str(a, "showScrollBar", show_scroll_bar)
  a = opt_str(a, "choiceTransitionName", choice_transition_name)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "loading", loading)
  a = opt_bool(a, "open", open)
  a = opt_bool(a, "defaultOpen", default_open)
  a = opt_num(a, "maxTagTextLength", max_tag_text_length)
  a = opt_str(a, "maxTagCount", max_tag_count)
  a = opt_str(a, "maxTagPlaceholder", max_tag_placeholder)
  a = opt_json(a, "tokenSeparators", token_separators)
  a = opt_json(a, "allowClear", allow_clear)
  a = opt_str(a, "prefix", prefix)
  a = opt_str(a, "suffixIcon", suffix_icon)
  a = opt_str(a, "suffix", suffix)
  a = opt_str(a, "clearIcon", clear_icon)
  a = opt_str(a, "removeIcon", remove_icon)
  a = opt_str(a, "animation", animation)
  a = opt_str(a, "transitionName", transition_name)
  a = opt_num(a, "popupMatchSelectWidth", popup_match_select_width)
  a = opt_json(a, "popupAlign", popup_align)
  a = opt_str(a, "placement", placement)
  a = opt_json(a, "builtinPlacements", builtin_placements)
  a = opt_json(a, "showAction", show_action)
  a = opt_json(a, "components", components)
  a = opt_json(a, "value", value)
  a = opt_json(a, "defaultValue", default_value)
  a = opt_json(a, "showSearch", show_search)
  a = opt_str(a, "inputValue", input_value)
  a = opt_bool(a, "filterTreeNode", filter_tree_node)
  a = opt_str(a, "treeNodeFilterProp", tree_node_filter_prop)
  a = opt_str(a, "treeNodeLabelProp", tree_node_label_prop)
  a = opt_json(a, "fieldNames", field_names)
  a = opt_bool(a, "multiple", multiple)
  a = opt_json(a, "treeCheckable", tree_checkable)
  a = opt_bool(a, "treeCheckStrictly", tree_check_strictly)
  a = opt_bool(a, "labelInValue", label_in_value)
  a = opt_json(a, "treeData", tree_data)
  a = opt_json(a, "treeDataSimpleMode", tree_data_simple_mode)
  a = opt_json(a, "treeLoadedKeys", tree_loaded_keys)
  a = opt_bool(a, "treeDefaultExpandAll", tree_default_expand_all)
  a = opt_json(a, "treeExpandedKeys", tree_expanded_keys)
  a = opt_json(a, "treeDefaultExpandedKeys", tree_default_expanded_keys)
  a = opt_str(a, "treeExpandAction", tree_expand_action)
  a = opt_bool(a, "virtual", virtual)
  a = opt_num(a, "listHeight", list_height)
  a = opt_num(a, "listItemHeight", list_item_height)
  a = opt_num(a, "listItemScrollOffset", list_item_scroll_offset)
  a = opt_str(a, "treeIcon", tree_icon)
  a = opt_str(a, "size", size)
  a = opt_str(a, "status", status)
  a = opt_str(a, "variant", variant)
  a = opt_bool(a, "bordered", bordered)
  a = opt_json(a, "treeLine", tree_line)
  a = opt_str(a, "switcherIcon", switcher_icon)
  a = opt_num(a, "dropdownMatchSelectWidth", dropdown_match_select_width)
  a = opt_bool(a, "showArrow", show_arrow)
  a = opt_payload(a, "onDisplayValuesChange", on_display_values_change)
  a = opt_payload(a, "onActiveValueChange", on_active_value_change)
  a = opt_payload(a, "onSearch", on_search)
  a = opt_payload(a, "onSearchSplit", on_search_split)
  a = opt_cmd(a, "onClear", on_clear)
  a = opt_payload(a, "onPopupVisibleChange", on_popup_visible_change)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onPopupScroll", on_popup_scroll)
  a = opt_cmd(a, "onInputKeyDown", on_input_key_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onSelect", on_select)
  a = opt_payload(a, "onDeselect", on_deselect)
  a = opt_payload(a, "onTreeLoad", on_tree_load)
  a = opt_payload(a, "onTreeExpand", on_tree_expand)
  a = opt_payload(a, "onDropdownVisibleChange", on_dropdown_visible_change)
  a = opt_payload(a, "onOpenChange", on_open_change)
  @html.node("antd:TreeSelect", a, children)
}

///|
/// 复合子组件 `antd:TreeSelect.TreeNode`（Props 接口 `无（只有 attrs?）`）。
///
/// 参数 0 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 这个子组件**没找到 props 接口**（生成器只在它自己的模块里找，不跨组件猜）——
/// 于是只有 `attrs?`：prop 得手写（`@html.Attrs::build().prop_str(…)`），没有编译期检查。
pub fn[C : @html.IsChildren] tree_select_tree_node(
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  @html.node("antd:TreeSelect.TreeNode", a, children)
}

///|
/// 复合子组件 `antd:TreeSelect.SHOW_ALL`（Props 接口 `无（只有 attrs?）`）。
///
/// 参数 0 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 这个子组件**没找到 props 接口**（生成器只在它自己的模块里找，不跨组件猜）——
/// 于是只有 `attrs?`：prop 得手写（`@html.Attrs::build().prop_str(…)`），没有编译期检查。
pub fn[C : @html.IsChildren] tree_select_show_all(
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  @html.node("antd:TreeSelect.SHOW_ALL", a, children)
}

///|
/// 复合子组件 `antd:TreeSelect.SHOW_PARENT`（Props 接口 `无（只有 attrs?）`）。
///
/// 参数 0 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 这个子组件**没找到 props 接口**（生成器只在它自己的模块里找，不跨组件猜）——
/// 于是只有 `attrs?`：prop 得手写（`@html.Attrs::build().prop_str(…)`），没有编译期检查。
pub fn[C : @html.IsChildren] tree_select_show_parent(
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  @html.node("antd:TreeSelect.SHOW_PARENT", a, children)
}

///|
/// 复合子组件 `antd:TreeSelect.SHOW_CHILD`（Props 接口 `无（只有 attrs?）`）。
///
/// 参数 0 个（清单里另有 0 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
///
/// ⚠️ 这个子组件**没找到 props 接口**（生成器只在它自己的模块里找，不跨组件猜）——
/// 于是只有 `attrs?`：prop 得手写（`@html.Attrs::build().prop_str(…)`），没有编译期检查。
pub fn[C : @html.IsChildren] tree_select_show_child(
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  @html.node("antd:TreeSelect.SHOW_CHILD", a, children)
}

///|
/// 组件库 `antd:Typography`（Props 接口 `TypographyProps`）。
///
/// 参数 62 个（清单里另有 83 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] typography(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Typography", a, children)
}

///|
/// 复合子组件 `antd:Typography.Text`（Props 接口 `TextProps`）。
///
/// 参数 75 个（清单里另有 83 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] typography_text(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  actions? : String,
  editable? : String,
  copyable? : String,
  type_? : String,
  disabled? : Bool,
  ellipsis? : String,
  code? : Bool,
  mark? : Bool,
  underline? : Bool,
  delete? : Bool,
  strong? : Bool,
  keyboard? : Bool,
  italic? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "actions", actions)
  a = opt_json(a, "editable", editable)
  a = opt_json(a, "copyable", copyable)
  a = opt_str(a, "type", type_)
  a = opt_bool(a, "disabled", disabled)
  a = opt_json(a, "ellipsis", ellipsis)
  a = opt_bool(a, "code", code)
  a = opt_bool(a, "mark", mark)
  a = opt_bool(a, "underline", underline)
  a = opt_bool(a, "delete", delete)
  a = opt_bool(a, "strong", strong)
  a = opt_bool(a, "keyboard", keyboard)
  a = opt_bool(a, "italic", italic)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Typography.Text", a, children)
}

///|
/// 复合子组件 `antd:Typography.Link`（Props 接口 `LinkProps`）。
///
/// 参数 79 个（清单里另有 87 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] typography_link(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  actions? : String,
  editable? : String,
  copyable? : String,
  type_? : String,
  disabled? : Bool,
  ellipsis? : Bool,
  code? : Bool,
  mark? : Bool,
  underline? : Bool,
  delete? : Bool,
  strong? : Bool,
  keyboard? : Bool,
  italic? : Bool,
  download? : String,
  href? : String,
  rel? : String,
  target? : String,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "actions", actions)
  a = opt_json(a, "editable", editable)
  a = opt_json(a, "copyable", copyable)
  a = opt_str(a, "type", type_)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "ellipsis", ellipsis)
  a = opt_bool(a, "code", code)
  a = opt_bool(a, "mark", mark)
  a = opt_bool(a, "underline", underline)
  a = opt_bool(a, "delete", delete)
  a = opt_bool(a, "strong", strong)
  a = opt_bool(a, "keyboard", keyboard)
  a = opt_bool(a, "italic", italic)
  a = opt_json(a, "download", download)
  a = opt_str(a, "href", href)
  a = opt_str(a, "rel", rel)
  a = opt_str(a, "target", target)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Typography.Link", a, children)
}

///|
/// 复合子组件 `antd:Typography.Title`（Props 接口 `TitleProps`）。
///
/// 参数 75 个（清单里另有 83 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] typography_title(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  actions? : String,
  editable? : String,
  copyable? : String,
  type_? : String,
  disabled? : Bool,
  ellipsis? : String,
  code? : Bool,
  mark? : Bool,
  underline? : Bool,
  delete? : Bool,
  keyboard? : Bool,
  italic? : Bool,
  level? : Double,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "actions", actions)
  a = opt_json(a, "editable", editable)
  a = opt_json(a, "copyable", copyable)
  a = opt_str(a, "type", type_)
  a = opt_bool(a, "disabled", disabled)
  a = opt_json(a, "ellipsis", ellipsis)
  a = opt_bool(a, "code", code)
  a = opt_bool(a, "mark", mark)
  a = opt_bool(a, "underline", underline)
  a = opt_bool(a, "delete", delete)
  a = opt_bool(a, "keyboard", keyboard)
  a = opt_bool(a, "italic", italic)
  a = opt_num(a, "level", level)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Typography.Title", a, children)
}

///|
/// 复合子组件 `antd:Typography.Paragraph`（Props 接口 `ParagraphProps`）。
///
/// 参数 75 个（清单里另有 83 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] typography_paragraph(
  class_name? : String,
  style? : String,
  id? : String,
  title? : String,
  lang? : String,
  dir? : String,
  role? : String,
  hidden? : Bool,
  tab_index? : Double,
  auto_focus? : Bool,
  actions? : String,
  editable? : String,
  copyable? : String,
  type_? : String,
  disabled? : Bool,
  ellipsis? : String,
  code? : Bool,
  mark? : Bool,
  underline? : Bool,
  delete? : Bool,
  strong? : Bool,
  keyboard? : Bool,
  italic? : Bool,
  on_copy? : @cmd.Cmd,
  on_cut? : @cmd.Cmd,
  on_paste? : @cmd.Cmd,
  on_composition_end? : @cmd.Cmd,
  on_composition_start? : @cmd.Cmd,
  on_composition_update? : @cmd.Cmd,
  on_focus? : @cmd.Cmd,
  on_blur? : @cmd.Cmd,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_before_input? : (@html.Payload) -> @cmd.Cmd,
  on_input? : (@html.Payload) -> @cmd.Cmd,
  on_invalid? : @cmd.Cmd,
  on_reset? : @cmd.Cmd,
  on_submit? : @cmd.Cmd,
  on_load? : @cmd.Cmd,
  on_error? : @cmd.Cmd,
  on_key_down? : @cmd.Cmd,
  on_key_press? : @cmd.Cmd,
  on_key_up? : @cmd.Cmd,
  on_got_pointer_capture? : @cmd.Cmd,
  on_lost_pointer_capture? : @cmd.Cmd,
  on_pointer_cancel? : @cmd.Cmd,
  on_pointer_down? : @cmd.Cmd,
  on_pointer_enter? : @cmd.Cmd,
  on_pointer_leave? : @cmd.Cmd,
  on_pointer_move? : @cmd.Cmd,
  on_pointer_out? : @cmd.Cmd,
  on_pointer_over? : @cmd.Cmd,
  on_pointer_up? : @cmd.Cmd,
  on_aux_click? : @cmd.Cmd,
  on_click? : @cmd.Cmd,
  on_context_menu? : @cmd.Cmd,
  on_double_click? : @cmd.Cmd,
  on_mouse_down? : @cmd.Cmd,
  on_mouse_enter? : @cmd.Cmd,
  on_mouse_leave? : @cmd.Cmd,
  on_mouse_move? : @cmd.Cmd,
  on_mouse_out? : @cmd.Cmd,
  on_mouse_over? : @cmd.Cmd,
  on_mouse_up? : @cmd.Cmd,
  on_select? : @cmd.Cmd,
  on_touch_cancel? : @cmd.Cmd,
  on_touch_end? : @cmd.Cmd,
  on_touch_move? : @cmd.Cmd,
  on_touch_start? : @cmd.Cmd,
  on_scroll? : @cmd.Cmd,
  on_wheel? : @cmd.Cmd,
  on_animation_start? : @cmd.Cmd,
  on_animation_end? : @cmd.Cmd,
  on_animation_iteration? : @cmd.Cmd,
  on_transition_end? : @cmd.Cmd,
  on_toggle? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "style", style)
  a = opt_str(a, "id", id)
  a = opt_str(a, "title", title)
  a = opt_str(a, "lang", lang)
  a = opt_str(a, "dir", dir)
  a = opt_str(a, "role", role)
  a = opt_bool(a, "hidden", hidden)
  a = opt_num(a, "tabIndex", tab_index)
  a = opt_bool(a, "autoFocus", auto_focus)
  a = opt_json(a, "actions", actions)
  a = opt_json(a, "editable", editable)
  a = opt_json(a, "copyable", copyable)
  a = opt_str(a, "type", type_)
  a = opt_bool(a, "disabled", disabled)
  a = opt_json(a, "ellipsis", ellipsis)
  a = opt_bool(a, "code", code)
  a = opt_bool(a, "mark", mark)
  a = opt_bool(a, "underline", underline)
  a = opt_bool(a, "delete", delete)
  a = opt_bool(a, "strong", strong)
  a = opt_bool(a, "keyboard", keyboard)
  a = opt_bool(a, "italic", italic)
  a = opt_cmd(a, "onCopy", on_copy)
  a = opt_cmd(a, "onCut", on_cut)
  a = opt_cmd(a, "onPaste", on_paste)
  a = opt_cmd(a, "onCompositionEnd", on_composition_end)
  a = opt_cmd(a, "onCompositionStart", on_composition_start)
  a = opt_cmd(a, "onCompositionUpdate", on_composition_update)
  a = opt_cmd(a, "onFocus", on_focus)
  a = opt_cmd(a, "onBlur", on_blur)
  a = opt_payload(a, "onChange", on_change)
  a = opt_payload(a, "onBeforeInput", on_before_input)
  a = opt_payload(a, "onInput", on_input)
  a = opt_cmd(a, "onInvalid", on_invalid)
  a = opt_cmd(a, "onReset", on_reset)
  a = opt_cmd(a, "onSubmit", on_submit)
  a = opt_cmd(a, "onLoad", on_load)
  a = opt_cmd(a, "onError", on_error)
  a = opt_cmd(a, "onKeyDown", on_key_down)
  a = opt_cmd(a, "onKeyPress", on_key_press)
  a = opt_cmd(a, "onKeyUp", on_key_up)
  a = opt_cmd(a, "onGotPointerCapture", on_got_pointer_capture)
  a = opt_cmd(a, "onLostPointerCapture", on_lost_pointer_capture)
  a = opt_cmd(a, "onPointerCancel", on_pointer_cancel)
  a = opt_cmd(a, "onPointerDown", on_pointer_down)
  a = opt_cmd(a, "onPointerEnter", on_pointer_enter)
  a = opt_cmd(a, "onPointerLeave", on_pointer_leave)
  a = opt_cmd(a, "onPointerMove", on_pointer_move)
  a = opt_cmd(a, "onPointerOut", on_pointer_out)
  a = opt_cmd(a, "onPointerOver", on_pointer_over)
  a = opt_cmd(a, "onPointerUp", on_pointer_up)
  a = opt_cmd(a, "onAuxClick", on_aux_click)
  a = opt_cmd(a, "onClick", on_click)
  a = opt_cmd(a, "onContextMenu", on_context_menu)
  a = opt_cmd(a, "onDoubleClick", on_double_click)
  a = opt_cmd(a, "onMouseDown", on_mouse_down)
  a = opt_cmd(a, "onMouseEnter", on_mouse_enter)
  a = opt_cmd(a, "onMouseLeave", on_mouse_leave)
  a = opt_cmd(a, "onMouseMove", on_mouse_move)
  a = opt_cmd(a, "onMouseOut", on_mouse_out)
  a = opt_cmd(a, "onMouseOver", on_mouse_over)
  a = opt_cmd(a, "onMouseUp", on_mouse_up)
  a = opt_cmd(a, "onSelect", on_select)
  a = opt_cmd(a, "onTouchCancel", on_touch_cancel)
  a = opt_cmd(a, "onTouchEnd", on_touch_end)
  a = opt_cmd(a, "onTouchMove", on_touch_move)
  a = opt_cmd(a, "onTouchStart", on_touch_start)
  a = opt_cmd(a, "onScroll", on_scroll)
  a = opt_cmd(a, "onWheel", on_wheel)
  a = opt_cmd(a, "onAnimationStart", on_animation_start)
  a = opt_cmd(a, "onAnimationEnd", on_animation_end)
  a = opt_cmd(a, "onAnimationIteration", on_animation_iteration)
  a = opt_cmd(a, "onTransitionEnd", on_transition_end)
  a = opt_cmd(a, "onToggle", on_toggle)
  @html.node("antd:Typography.Paragraph", a, children)
}

///|
/// 组件库 `antd:Upload`（Props 接口 `UploadProps`）。
///
/// 参数 30 个（清单里另有 12 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] upload(
  has_control_inside? : Bool,
  pastable? : Bool,
  type_? : String,
  name? : String,
  default_file_list? : String,
  file_list? : String,
  action? : String,
  directory? : Bool,
  data? : String,
  method? : String,
  headers? : String,
  show_upload_list? : String,
  multiple? : Bool,
  accept? : String,
  list_type? : String,
  class_name? : String,
  support_server_render? : Bool,
  style? : String,
  disabled? : Bool,
  with_credentials? : Bool,
  open_file_dialog_on_click? : Bool,
  locale? : String,
  id? : String,
  progress? : String,
  max_count? : Double,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_drop? : @cmd.Cmd,
  on_preview? : (@html.Payload) -> @cmd.Cmd,
  on_download? : (@html.Payload) -> @cmd.Cmd,
  on_remove? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_bool(a, "hasControlInside", has_control_inside)
  a = opt_bool(a, "pastable", pastable)
  a = opt_str(a, "type", type_)
  a = opt_str(a, "name", name)
  a = opt_json(a, "defaultFileList", default_file_list)
  a = opt_json(a, "fileList", file_list)
  a = opt_str(a, "action", action)
  a = opt_bool(a, "directory", directory)
  a = opt_json(a, "data", data)
  a = opt_str(a, "method", method)
  a = opt_json(a, "headers", headers)
  a = opt_json(a, "showUploadList", show_upload_list)
  a = opt_bool(a, "multiple", multiple)
  a = opt_json(a, "accept", accept)
  a = opt_str(a, "listType", list_type)
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "supportServerRender", support_server_render)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "withCredentials", with_credentials)
  a = opt_bool(a, "openFileDialogOnClick", open_file_dialog_on_click)
  a = opt_json(a, "locale", locale)
  a = opt_str(a, "id", id)
  a = opt_json(a, "progress", progress)
  a = opt_num(a, "maxCount", max_count)
  a = opt_payload(a, "onChange", on_change)
  a = opt_cmd(a, "onDrop", on_drop)
  a = opt_payload(a, "onPreview", on_preview)
  a = opt_payload(a, "onDownload", on_download)
  a = opt_payload(a, "onRemove", on_remove)
  @html.node("antd:Upload", a, children)
}

///|
/// 复合子组件 `antd:Upload.Dragger`（Props 接口 `DraggerProps`）。
///
/// 参数 31 个（清单里另有 12 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] upload_dragger(
  has_control_inside? : Bool,
  pastable? : Bool,
  type_? : String,
  name? : String,
  default_file_list? : String,
  file_list? : String,
  action? : String,
  directory? : Bool,
  data? : String,
  method? : String,
  headers? : String,
  show_upload_list? : String,
  multiple? : Bool,
  accept? : String,
  list_type? : String,
  class_name? : String,
  support_server_render? : Bool,
  style? : String,
  disabled? : Bool,
  with_credentials? : Bool,
  open_file_dialog_on_click? : Bool,
  locale? : String,
  id? : String,
  progress? : String,
  max_count? : Double,
  height? : Double,
  on_change? : (@html.Payload) -> @cmd.Cmd,
  on_drop? : @cmd.Cmd,
  on_preview? : (@html.Payload) -> @cmd.Cmd,
  on_download? : (@html.Payload) -> @cmd.Cmd,
  on_remove? : (@html.Payload) -> @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_bool(a, "hasControlInside", has_control_inside)
  a = opt_bool(a, "pastable", pastable)
  a = opt_str(a, "type", type_)
  a = opt_str(a, "name", name)
  a = opt_json(a, "defaultFileList", default_file_list)
  a = opt_json(a, "fileList", file_list)
  a = opt_str(a, "action", action)
  a = opt_bool(a, "directory", directory)
  a = opt_json(a, "data", data)
  a = opt_str(a, "method", method)
  a = opt_json(a, "headers", headers)
  a = opt_json(a, "showUploadList", show_upload_list)
  a = opt_bool(a, "multiple", multiple)
  a = opt_json(a, "accept", accept)
  a = opt_str(a, "listType", list_type)
  a = opt_str(a, "className", class_name)
  a = opt_bool(a, "supportServerRender", support_server_render)
  a = opt_json(a, "style", style)
  a = opt_bool(a, "disabled", disabled)
  a = opt_bool(a, "withCredentials", with_credentials)
  a = opt_bool(a, "openFileDialogOnClick", open_file_dialog_on_click)
  a = opt_json(a, "locale", locale)
  a = opt_str(a, "id", id)
  a = opt_json(a, "progress", progress)
  a = opt_num(a, "maxCount", max_count)
  a = opt_num(a, "height", height)
  a = opt_payload(a, "onChange", on_change)
  a = opt_cmd(a, "onDrop", on_drop)
  a = opt_payload(a, "onPreview", on_preview)
  a = opt_payload(a, "onDownload", on_download)
  a = opt_payload(a, "onRemove", on_remove)
  @html.node("antd:Upload.Dragger", a, children)
}

///|
/// 组件库 `antd:Watermark`（Props 接口 `WatermarkProps`）。
///
/// 参数 13 个（清单里另有 2 个没有生成：内部 prop / 回调 / React 公共属性的长尾 —— 逐条理由见 manifest 的 `exposed_reason`）。
pub fn[C : @html.IsChildren] watermark(
  z_index? : Double,
  rotate? : Double,
  width? : Double,
  height? : Double,
  image? : String,
  content? : String,
  font? : String,
  style? : String,
  class_name? : String,
  gap? : String,
  offset? : String,
  inherit? : Bool,
  on_remove? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = opt_num(a, "zIndex", z_index)
  a = opt_num(a, "rotate", rotate)
  a = opt_num(a, "width", width)
  a = opt_num(a, "height", height)
  a = opt_str(a, "image", image)
  a = opt_json(a, "content", content)
  a = opt_json(a, "font", font)
  a = opt_json(a, "style", style)
  a = opt_str(a, "className", class_name)
  a = opt_json(a, "gap", gap)
  a = opt_json(a, "offset", offset)
  a = opt_bool(a, "inherit", inherit)
  a = opt_cmd(a, "onRemove", on_remove)
  @html.node("antd:Watermark", a, children)
}
