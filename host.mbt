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
/// 把 MoonBit 闭包包成**原生 JS 箭头函数**（零参 / 返回 Int / 返回 JS 值 / 收一个回调）。
///
/// 为什么要显式包而不用 `%identity`：与 `js_as_handler` 同一个理由 —— 函数类型的值经过
/// 泛型 `%identity` 不一定以 JS 认得的形态到达。**H2 的单导出（`handlers`）就是靠这四个
/// 包装把整张句柄表交给宿主的**（PLAN §3.7）。
extern "js" fn js_closure0(f : () -> Unit) -> JsValue =
  #| (f) => () => f()

///|
extern "js" fn js_closure_int(f : () -> Int) -> JsValue =
  #| (f) => () => f()

///|
extern "js" fn js_closure_value(f : () -> JsValue) -> JsValue =
  #| (f) => () => f()

///|
extern "js" fn js_closure_string(f : () -> String) -> JsValue =
  #| (f) => () => f()

///|
extern "js" fn js_closure_sub(f : ((Int) -> Unit) -> (() -> Unit)) -> JsValue =
  #| (f) => (cb) => f(cb)

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
///
/// ★ 0.3.0 起它还负责**点名报错**：查不到就抛，并把已注册的名字列出来。
/// 为什么不能再返回 `undefined` 了事：`undefined` 到了 React 那里只会变成
/// `Element type is invalid`（看不出是谁的错），而 `antd:Botton` 这种手滑
/// 或者"宿主忘了注册"，会一路渲染成白屏 + 一句与组件名无关的报错。
/// 这与宿主能力注册表的做法一致（`installCapabilities` 也是点名报错）。
///
/// 注意分界：**只有带命名空间的标签会抛**。表外的普通标签（`img`/`table`…）
/// 仍按老规矩回落 `View` 并计数 —— 那是迁移诊断，不能变成崩溃。
extern "js" fn js_host_component(name : String) -> JsValue =
  #| (n) => {
  #|   const h = globalThis.MOBILE_HOST;
  #|   const table = h && h.components ? h.components : null;
  #|   const c = table ? table[n] : undefined;
  #|   if (c === undefined) {
  #|     const names = table ? Object.keys(table) : [];
  #|     const shown = names.slice(0, 10).join(', ');
  #|     throw new Error(
  #|       'moobile: 宿主没有注册组件 "' + n + '"（MOBILE_HOST.components 里没有这个键）。' +
  #|         '\n  已注册 ' + names.length + ' 个：' + shown + (names.length > 10 ? ', …' : '') +
  #|         '\n  · 内置标签（div / span / button …）由 render.mbt 的标签表映射，不需要注册；' +
  #|         '\n  · 带命名空间的标签（如 antd:Button）要由宿主注册：mountApp 的 components 选项，' +
  #|         '或 moobile-host 的 registerLibrary()。'
  #|     );
  #|   }
  #|   return c;
  #| }

///|
/// 宿主的事件名覆盖查询，**三级优先**：
/// 1. `events[标签]`（精确到组件，如 `antd:Button`）；
/// 2. `events["<库>:*"]`（整个组件库一把，如 `antd:*`）—— 同一库的组件
///    往往遵守同一套 prop 命名，逐个写是重复劳动；
/// 3. `events["*"]`（整个宿主一把）。
///
/// 返回 `""` 表示"宿主没有意见，按默认表来"。
///
/// 为什么这层必须在宿主：`click` 落在 RN 的基础组件上是 `onPress`、落在 Web 组件上是
/// `onClick` —— 这不是"事件语义"的差别，而是"**手里这个组件对象接受什么 prop**"的差别，
/// 只有拿着组件对象的宿主回答得了（我们这边只有个组件名，见 `render.mbt` 的 `map_tag`）。
extern "js" fn js_event_override(tag : String, event : String) -> String =
  #| (tag, e) => {
  #|   const ev = globalThis.MOBILE_HOST && globalThis.MOBILE_HOST.events;
  #|   if (!ev) return '';
  #|   const pick = (m) => (m && typeof m[e] === 'string' ? m[e] : '');
  #|   const exact = pick(ev[tag]);
  #|   if (exact) return exact;
  #|   const i = tag.indexOf(':');
  #|   if (i > 0) {
  #|     const lib = pick(ev[tag.slice(0, i) + ':*']);
  #|     if (lib) return lib;
  #|   }
  #|   return pick(ev['*']);
  #| }


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
