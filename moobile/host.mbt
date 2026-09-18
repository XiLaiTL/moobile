///|
/// JS 侧的不透明值。整套后端只经由这一层与宿主对话。
#external
pub type JsValue

///|
extern "js" fn js_obj_new() -> JsValue =
  #| () => ({})

///|
extern "js" fn js_obj_set(o : JsValue, k : String, v : JsValue) -> Unit =
  #| (o, k, v) => { o[k] = v }

///|
extern "js" fn js_str(s : String) -> JsValue =
  #| (s) => s

///|
extern "js" fn js_num(d : Double) -> JsValue =
  #| (d) => d

///|
extern "js" fn js_int(i : Int) -> JsValue =
  #| (i) => i

///|
extern "js" fn js_bool(b : Bool) -> JsValue =
  #| (b) => b

///|
extern "js" fn js_arr_new() -> JsValue =
  #| () => []

///|
/// 真正的 JS `null`。用它在"还没有内容"时占位 —— 比 `Option[JsValue]`
/// 更可靠，因为 React 能直接渲染 `null`。
pub extern "js" fn js_null() -> JsValue =
  #| () => null

///|
extern "js" fn js_arr_push(a : JsValue, v : JsValue) -> Unit =
  #| (a, v) => { a.push(v) }

///|
/// 宿主组件查找：宿主把 `View` / `Text` / `Pressable` / `TextInput`
/// 挂到 `globalThis.MOBILE_HOST.components`。
///
/// 分工：**"哪个 HTML 标签映射到哪个组件"是 MoonBit 的决定（见 `render.mbt`
/// 的 `map_tag`）**，这一行只负责把名字翻成宿主手里的那个对象。
extern "js" fn js_host_component(name : String) -> JsValue =
  #| (n) => globalThis.MOBILE_HOST.components[n]

///|
extern "js" fn js_fragment() -> JsValue =
  #| () => globalThis.MOBILE_HOST.react.Fragment

///|
extern "js" fn js_create_element(
  tag : JsValue,
  props : JsValue,
  children : JsValue,
) -> JsValue =
  #| (tag, props, children) => globalThis.MOBILE_HOST.react.createElement(tag, props, ...children)

///|
/// `Children::Map` 是**带 key 的子节点** —— rabbita 本来就维护着 key。
/// 把它交给 React 的 `key`，diff 才不会退化成"整列重建"。
extern "js" fn js_with_key(el : JsValue, key : String) -> JsValue =
  #| (el, key) => globalThis.MOBILE_HOST.react.cloneElement(el, { key })

///|
/// MoonBit 闭包 ↔ JS 值。MoonBit 编到 JS 后闭包就是普通函数，这一层零成本。
fn[T] to_js(v : T) -> JsValue = "%identity"

///|
/// 把 MoonBit 闭包包成**原生 JS 箭头函数**再交给 React。
///
/// 为什么不能只靠 `%identity`：函数类型的值经过泛型 `%identity` 不一定
/// 以 React 认得的形态到达（实测 `handlers` 注册了 22 个，React 却一个都不调）。
/// 这里显式产出一个 JS 闭包，把不确定性关在这一行里。
///
/// 参数是 `@vdom.Event` —— 现在它是 `pub` 的后端无关类型，可以命名了。
extern "js" fn js_as_handler(f : (@vdom.Event) -> Unit) -> JsValue =
  #| (f) => (v) => f(v)

///|
/// 把一个不透明的 JS 值当 `String` 用。
///
/// **这是本方案唯一集中的不安全性，而且是已知缺口的一部分**：
/// `Event` 是 `internal/vdom` 的**非 pub** 类型，外部包无法命名它。
/// 而 `TextInput` 的 `onChangeText` 递过来的是**文本**、
/// `Pressable` 的 `onPress` 递过来的是**事件对象** ——
/// 两者只能塞进同一个不透明槽位，由应用层决定怎么解释。
///
/// 根治办法是把 `Event` 从 `@dom.Event` 解耦成 moobile 自己的事件类型
/// （README 的「档二」）。
fn[T] payload_as_string(v : T) -> String = "%identity"

///|
/// 不透明的 JS 值之间互转。用于把 RN 递来的合成事件**原样**当作
/// `@dom.MouseEvent` 用（见 `html/attrs_event.mbt` 的 `mouse_event_from_dom`）。
fn[T, U] cast_opaque(v : T) -> U = "%identity"
