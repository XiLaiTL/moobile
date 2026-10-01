///|
/// **应用入口 —— 全部就这一行（H2 的单导出）。**
///
/// 交出的是整张句柄表 `{contract, start, snapshot, subscribe, element, …诊断}`，
/// 宿主（`moobile-host` 的 `mountApp`）拿到它就能把应用挂起来 ——
/// 宿主不需要知道 `Model` / `Msg` 是什么，也不需要逐个 import 导出名。
///
/// 用的是 `mount_with_init`：首帧之前先去本地库把清单读回来
/// （`init` 返回的命令由 rabbita 运行时排队执行，不阻塞挂载）。
///
/// ⚠️ 为什么 0.1.0 里做不到这一行：那时 `Mount` 的四个入口要应用自己写四个导出
/// （因为 `mount` 对 `Model`/`Msg` 泛型）。而 `Mount` 本身是**非泛型**的具体类型，
/// 于是"泛型只存在于构造那一刻"—— 库替应用把这件事做掉了。见 `PLAN.md` §3.7。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers_with_init(init=init_app, update~, view~, subscriptions~)
}
