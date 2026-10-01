///|
/// **外部使用者视角的最小例子** —— 这是 `tools/check_published.sh` 用的模板。
///
/// 它按 0.2 的公开 API 写：单导出 `handlers_with_init`、`update` 返回 `(Model, Cmd)`、
/// `subscriptions?`（内置 `@sub.every`）、以及能力包 `sqlite`。
/// 这个文件存在的意义：**证明 registry 上那一版对外真的可用**（不是"本地工作区能编"）。
struct Model {
  n : Int
} derive(Eq)

///|
enum Msg {
  Bump
  Tick
}

///|
fn init_app(_emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  (Model::{ n: 0 }, @cmd.none)
}

///|
fn update(m : Model, msg : Msg, _emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  match msg {
    Bump => ({ n: m.n + 1 }, @cmd.none)
    Tick => ({ n: m.n }, @cmd.none)
  }
}

///|
fn subscriptions(_m : Model, emit : @cmd.Emit[Msg]) -> @sub.Sub {
  @sub.every(5000, emit(Tick))
}

///|
fn view(m : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build().styles(@style.Style::new().font_size(16.0)),
    [
      @html.button(on_click=emit(Bump), "点了 \{m.n} 次"),
    ],
  )
}

///|
/// 单导出（H2）。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers_with_init(init=init_app, update~, view~, subscriptions~)
}

///|
/// 能力包也能从外部引用（仅编译期检查：确认 `sqlite/` 进了发布包）。
fn probe_capability() -> String {
  @sqlite.params([@sqlite.p_str("x")])
}
