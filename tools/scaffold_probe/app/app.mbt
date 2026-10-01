///|
/// 入口 —— 与模板里那一行**一模一样**（这是契约，也是本探针要证明的东西：
/// 应用长到多文件之后，交给宿主的东西**没有变**）。
///
/// 探针的三份源码（`model.mbt` / `ui.mbt` / 本文件）会被**覆盖到**一个刚由
/// `moobile-host init` 生成出来的项目上 —— 也就是"用户拿到项目之后写的第一版代码"。
/// 见 `tools/scaffold_probe.mjs`。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~, subscriptions~)
}
