///|
/// **设计探针：`I3`（生成"与 `@svg` 平级的组件库 DSL 包"）的形状可行性。**
///
/// 这不是产品代码，是**判据**：它被 `moon check` 编译，所以"这个形状能不能编过"
/// 是一句可以被机器重复验证的话，而不是设计文档里的乐观推断。
///
/// 结论（2026-09 实测，`moon check --target js` **0 错误**）：四条全部成立 ——
/// 1. 消费方能用 `@html.IsChildren` 当 **trait 约束**；
/// 2. `attrs?` + 具名可选参数 + `children : C` 的签名（与 `@html.button` **同款**）能编；
/// 3. 可选参数能用 `match` 逐条落到 `Attrs::prop_*`；
/// 4. 产出的 `@html.Html` 能直接塞进 `@html.div([...])`。
///
/// 于是"生成之后写法与 `@html` 平起平坐"这件事**可行**（剩下的是生成器本身，PLAN §3.8 I3）。
///
/// ⚠️ 一条语法硬约束（同批实测）：**大写开头的函数名不合法** ——
/// `pub fn Button(...)` 是 parse error（`unexpected token '(', you may expect '::'`），
/// 因为大写开头在 MoonBit 里是**类型名**；要大写只能先 `pub struct Button` 再 `Button::new(...)`，
/// 写起来更长。所以生成物的名字**必须小写**，与 `@html.div` / `@svg.rect` 一致。
pub fn[C : @html.IsChildren] antd_button(
  type_? : String,
  danger? : Bool,
  loading? : Bool,
  on_click? : @cmd.Cmd,
  attrs? : @html.Attrs,
  children : C,
) -> @html.Html {
  let mut a = match attrs {
    Some(x) => x.copy()
    None => @html.Attrs::build()
  }
  a = match type_ {
    Some(t) => a.prop_str("type", t)
    None => a
  }
  a = match danger {
    Some(d) => a.prop_bool("danger", d)
    None => a
  }
  a = match loading {
    Some(l) => a.prop_bool("loading", l)
    None => a
  }
  a = match on_click {
    Some(c) => a.on_click(_ => c)
    None => a
  }
  @html.node("antd:Button", a, children)
}

///|
/// 探针的调用点：应写成 `antd_button(type_="primary", on_click=..., "文字")`，
/// 与 `@html.button(...)` 的写法**完全同款**。
pub fn probe_usage(emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build(),
    [
      antd_button(type_="primary", danger=true, on_click=emit(Bump), "加一条"),
      antd_button(loading=true, "载入中"),
    ],
  )
}
