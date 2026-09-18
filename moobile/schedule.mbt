///|
/// 把"稍后执行"的调度交给宿主。
///
/// 为什么不能直接用 `@dom.window().request_animation_frame`：
/// **React Native 里没有 `window`**。宿主在 `MOBILE_HOST` 上提供这两个钩子，
/// 浏览器用 rAF + queueMicrotask，RN 用 setTimeout / setImmediate。
extern "js" fn js_microtask(f : () -> Unit) -> Unit =
  #| (f) => globalThis.MOBILE_HOST.scheduleTask(f)

///|
extern "js" fn js_frame(f : () -> Unit) -> Unit =
  #| (f) => globalThis.MOBILE_HOST.scheduleFrame(f)
