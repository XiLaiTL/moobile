///|
/// 外部模块使用 moobile 的最小例子 —— 证明「库 + 公开 style 包」在**模块外**可用。
///
/// 它被 `_tools/check_external.sh` 拷进一个临时工作区，与本模块一起
/// 由 `moon.work` 解析；`demo/` 在模块内部，证明不了这件事。
///
/// 注意库本体的包名是 `moobile/moobile/moobile`（模块名 + 目录名），
/// 见 `moon.pkg`。
struct Model {
  n : Int
} derive(Eq)

///|
priv enum Msg {
  Bump
}

///|
fn update(m : Model, _msg : Msg) -> Model {
  { n: m.n + 1 }
}

///|
/// 真实 `@html` DSL + 公开样式包 + `emit(Msg)` 处理器 —— 与 `interest/yi` 的写法一致。
fn view(m : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build().styles(
      @style.Style::new().font_size(16.0).padding_horizontal(@style.px(12.0)),
    ),
    [
      @html.button(
        on_click=emit(Bump),
        [
          @html.span(
            attrs=@html.Attrs::build().styles(
              @style.Style::new().color("#8a2518"),
            ),
            "计数 \{m.n}",
          ),
        ],
      ),
    ],
  )
}

///|
/// 公开 API 的两个关键点：`@moobile.mount`（库）与 `@style.Style`（公开包）。
pub fn start() -> @moobile.Mount {
  @moobile.mount({ n: 0 }, update, view)
}

///|
/// 回归探针：`render_node` 的公开签名里含 `@vdom.VNode`（internal 包）。
/// 这里**有意**引用它 —— 只要它还能编译，就说明那条泄漏不阻断外部使用者
/// （外部没法给那个参数类型命名，但也不影响用这套 API 写应用）。
/// 哪天它变成错误，说明 internal 的可见性规则收紧了，得去看 `FORK.md` §3 第 4 条。
pub fn probe_internal_type_leak() -> Unit {
  ignore(@moobile.render_node)
}
