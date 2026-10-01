'use strict';
// react-attrs.js —— **React 公共属性**小表（兜底用）。
//
// 为什么需要它（`PLAN.md` §3.8 I2 的实测结论）：
//   antd 的 33/73 个 Props 接口 `extends` 了 React 的属性面，而 `onClick` / `className` /
//   `href` / `aria-*` 这些**最常用的 prop 根本不在场** —— 它们定义在 `@types/react` 里，
//   而 **antd 不依赖它、纯 JS 应用也不会有**（实测：typescript / @types/react /
//   @types/react-dom 三者皆不存在）。
//
// 两条路（本文件是第二条）：
//   ① 应用里**有** `@types/react` → 走真类型解析（更准，含 aria-*）；
//   ② 没有 → 用这张表。表的内容是**有意收窄**的：`on*` 事件 + 一小撮最常用的非事件属性。
//      **`data-*` 故意不列**（它是索引签名，列不完）—— 那一类走 `attrs?` 逃生口，
//      生成物的文件头会写明这件事。
//
// ⚠️ 表里的类型文本刻意写成 `React.XxxEventHandler<...>` 的形态：这样它和真实
//    `.d.ts` 里读出来的字段**走同一条分类路径**（`resolve.js` 的家族识别），
//    于是"有 @types/react"与"没有"两条路不会给出互相矛盾的分类。
//    反面做法是这里手写一套 { name, kind } —— 那等于同一件事两处实现，等着漂。

// 事件家族 → 我们的判定。signal = 只当信号（`@cmd.Cmd`）；value = 带值（`(Payload) -> Cmd`）。
// 判据不是"我想不想给值"，而是**载荷里到底有没有值**：
//   · Mouse/Keyboard/Focus/Pointer/…Event → 坐标、按键这类信息，视图层极少要；
//   · Change/Input → `target.value` / `target.checked` 就是**这个组件的值**，受控组件全靠它。
const DOM_EVENTS = {
  onCopy: 'React.ClipboardEventHandler',
  onCut: 'React.ClipboardEventHandler',
  onPaste: 'React.ClipboardEventHandler',
  onCompositionEnd: 'React.CompositionEventHandler',
  onCompositionStart: 'React.CompositionEventHandler',
  onCompositionUpdate: 'React.CompositionEventHandler',
  onFocus: 'React.FocusEventHandler',
  onBlur: 'React.FocusEventHandler',
  onChange: 'React.ChangeEventHandler',
  onBeforeInput: 'React.InputEventHandler',
  onInput: 'React.InputEventHandler',
  onInvalid: 'React.FormEventHandler',
  onReset: 'React.FormEventHandler',
  onSubmit: 'React.FormEventHandler',
  onLoad: 'React.SyntheticEventHandler',
  onError: 'React.SyntheticEventHandler',
  onKeyDown: 'React.KeyboardEventHandler',
  onKeyPress: 'React.KeyboardEventHandler',
  onKeyUp: 'React.KeyboardEventHandler',
  onGotPointerCapture: 'React.PointerEventHandler',
  onLostPointerCapture: 'React.PointerEventHandler',
  onPointerCancel: 'React.PointerEventHandler',
  onPointerDown: 'React.PointerEventHandler',
  onPointerEnter: 'React.PointerEventHandler',
  onPointerLeave: 'React.PointerEventHandler',
  onPointerMove: 'React.PointerEventHandler',
  onPointerOut: 'React.PointerEventHandler',
  onPointerOver: 'React.PointerEventHandler',
  onPointerUp: 'React.PointerEventHandler',
  onAuxClick: 'React.MouseEventHandler',
  onClick: 'React.MouseEventHandler',
  onContextMenu: 'React.MouseEventHandler',
  onDoubleClick: 'React.MouseEventHandler',
  onMouseDown: 'React.MouseEventHandler',
  onMouseEnter: 'React.MouseEventHandler',
  onMouseLeave: 'React.MouseEventHandler',
  onMouseMove: 'React.MouseEventHandler',
  onMouseOut: 'React.MouseEventHandler',
  onMouseOver: 'React.MouseEventHandler',
  onMouseUp: 'React.MouseEventHandler',
  onSelect: 'React.SyntheticEventHandler',
  onTouchCancel: 'React.TouchEventHandler',
  onTouchEnd: 'React.TouchEventHandler',
  onTouchMove: 'React.TouchEventHandler',
  onTouchStart: 'React.TouchEventHandler',
  onScroll: 'React.UIEventHandler',
  onWheel: 'React.WheelEventHandler',
  onAnimationStart: 'React.AnimationEventHandler',
  onAnimationEnd: 'React.AnimationEventHandler',
  onAnimationIteration: 'React.AnimationEventHandler',
  onTransitionEnd: 'React.TransitionEventHandler',
  onToggle: 'React.SyntheticEventHandler',
};

const HTML_ATTRS_BASE = {
  // ⚠️ `children` 必须在这里。React 的 `DOMAttributes` 里声明了 `children?: ReactNode`，
  //    而 `HTMLAttributes extends AriaAttributes, DOMAttributes<T>` —— 于是**每一个**
  //    转发 DOM 属性的组件都"有 children"。antd 自己的 `.d.ts` 大多不重复声明它，
  //    所以只在组件自己的 Props 里找 `children` 会得出"这个组件不能有 children"的错误结论
  //    （实测：`Tag` / `Image` / `Statistic` / `Divider` / `Avatar` 全被判成"没有 children"）。
  children: 'React.ReactNode',
  className: 'string',
  style: 'React.CSSProperties',
  id: 'string',
  title: 'string',
  lang: 'string',
  dir: 'string',
  role: 'string',
  slot: 'string',
  nonce: 'string',
  accessKey: 'string',
  inputMode: 'string',
  enterKeyHint: 'string',
  autoCapitalize: 'string',
  autoCorrect: 'string',
  translate: "'yes' | 'no'",
  contentEditable: "boolean | 'true' | 'false' | 'inherit' | 'plaintext-only'",
  draggable: "boolean | 'true' | 'false'",
  spellCheck: "boolean | 'true' | 'false'",
  hidden: 'boolean',
  tabIndex: 'number',
  autoFocus: 'boolean',
  suppressContentEditableWarning: 'boolean',
  suppressHydrationWarning: 'boolean',
  color: 'string',
  itemID: 'string',
  itemProp: 'string',
  itemRef: 'string',
  itemScope: 'boolean',
  itemType: 'string',
  about: 'string',
  datatype: 'string',
  inlist: 'string',
  prefix: 'string',
  property: 'string',
  resource: 'string',
  rev: 'string',
  typeof: 'string',
  vocab: 'string',
  unselectable: "'on' | 'off'",
};

const ARIA_ATTRS = {
  'aria-activedescendant': 'string',
  'aria-atomic': "boolean | 'true' | 'false'",
  'aria-autocomplete': "'none' | 'inline' | 'list' | 'both'",
  'aria-busy': "boolean | 'true' | 'false'",
  'aria-checked': "boolean | 'true' | 'false' | 'mixed'",
  'aria-colcount': 'number',
  'aria-colindex': 'number',
  'aria-colspan': 'number',
  'aria-controls': 'string',
  'aria-current': "boolean | 'true' | 'false' | 'page' | 'step' | 'location' | 'date' | 'time'",
  'aria-describedby': 'string',
  'aria-details': 'string',
  'aria-disabled': "boolean | 'true' | 'false'",
  'aria-errormessage': 'string',
  'aria-expanded': "boolean | 'true' | 'false'",
  'aria-flowto': 'string',
  'aria-haspopup': "boolean | 'true' | 'false' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'",
  'aria-hidden': "boolean | 'true' | 'false'",
  'aria-invalid': "boolean | 'true' | 'false' | 'grammar' | 'spelling'",
  'aria-keyshortcuts': 'string',
  'aria-label': 'string',
  'aria-labelledby': 'string',
  'aria-level': 'number',
  'aria-live': "'off' | 'assertive' | 'polite'",
  'aria-modal': "boolean | 'true' | 'false'",
  'aria-multiline': "boolean | 'true' | 'false'",
  'aria-multiselectable': "boolean | 'true' | 'false'",
  'aria-orientation': "'horizontal' | 'vertical'",
  'aria-owns': 'string',
  'aria-placeholder': 'string',
  'aria-posinset': 'number',
  'aria-pressed': "boolean | 'true' | 'false' | 'mixed'",
  'aria-readonly': "boolean | 'true' | 'false'",
  'aria-relevant': 'string',
  'aria-required': "boolean | 'true' | 'false'",
  'aria-roledescription': 'string',
  'aria-rowcount': 'number',
  'aria-rowindex': 'number',
  'aria-rowspan': 'number',
  'aria-selected': "boolean | 'true' | 'false'",
  'aria-setsize': 'number',
  'aria-sort': "'none' | 'ascending' | 'descending' | 'other'",
  'aria-valuemax': 'number',
  'aria-valuemin': 'number',
  'aria-valuenow': 'number',
  'aria-valuetext': 'string',
  'aria-role': 'string',
};

const BUTTON_ATTRS = {
  disabled: 'boolean',
  form: 'string',
  formAction: 'string',
  formEncType: 'string',
  formMethod: 'string',
  formNoValidate: 'boolean',
  formTarget: 'string',
  name: 'string',
  type: "'submit' | 'reset' | 'button'",
  value: 'string | readonly string[] | number',
};

const ANCHOR_ATTRS = {
  download: 'any',
  href: 'string',
  hrefLang: 'string',
  media: 'string',
  ping: 'string',
  referrerPolicy: 'string',
  rel: 'string',
  target: 'string',
  type: 'string',
};

const INPUT_ATTRS = {
  accept: 'string',
  alt: 'string',
  autoComplete: 'string',
  capture: "boolean | 'user' | 'environment'",
  checked: 'boolean',
  disabled: 'boolean',
  form: 'string',
  height: 'number | string',
  list: 'string',
  max: 'number | string',
  maxLength: 'number',
  min: 'number | string',
  minLength: 'number',
  multiple: 'boolean',
  name: 'string',
  pattern: 'string',
  placeholder: 'string',
  readOnly: 'boolean',
  required: 'boolean',
  size: 'number',
  src: 'string',
  step: 'number | string',
  type: 'string',
  value: 'string | readonly string[] | number',
  width: 'number | string',
};

const TEXTAREA_ATTRS = {
  autoComplete: 'string',
  cols: 'number',
  dirName: 'string',
  disabled: 'boolean',
  form: 'string',
  maxLength: 'number',
  minLength: 'number',
  name: 'string',
  placeholder: 'string',
  readOnly: 'boolean',
  required: 'boolean',
  rows: 'number',
  value: 'string | readonly string[] | number',
  wrap: 'string',
};

const SELECT_ATTRS = {
  autoComplete: 'string',
  disabled: 'boolean',
  form: 'string',
  multiple: 'boolean',
  name: 'string',
  required: 'boolean',
  size: 'number',
  value: 'string | readonly string[] | number',
};

const IMG_ATTRS = {
  alt: 'string',
  crossOrigin: "'anonymous' | 'use-credentials' | ''",
  decoding: "'async' | 'auto' | 'sync'",
  height: 'number | string',
  loading: "'eager' | 'lazy'",
  referrerPolicy: 'string',
  sizes: 'string',
  src: 'string',
  srcSet: 'string',
  useMap: 'string',
  width: 'number | string',
};

const FORM_ATTRS = {
  acceptCharset: 'string',
  action: 'string',
  autoComplete: 'string',
  encType: 'string',
  method: 'string',
  name: 'string',
  noValidate: 'boolean',
  target: 'string',
};

const MEDIA_ATTRS = {
  autoPlay: 'boolean',
  controls: 'boolean',
  crossOrigin: 'string',
  loop: 'boolean',
  media: 'string',
  muted: 'boolean',
  playsInline: 'boolean',
  preload: 'string',
  src: 'string',
};

// ⚠️⚠️ **这张表必须是"继承链"，不能是"平铺的几张小表"。**
//
// 真实的 `@types/react` 里是层层继承的：
//
//     interface DOMAttributes<T> { children?; onClick?; onChange?; … }
//     interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> { className?; style?; … }
//     interface InputHTMLAttributes<T> extends HTMLAttributes<T> { value?; placeholder?; … }
//
// 第一版这里把每个接口写成**只有自己那几条**，于是 `React.InputHTMLAttributes` 里
// **没有 `onChange`** —— 而 rc-input 的 props 正是 `Omit<React.InputHTMLAttributes<…>, …>`，
// 于是 `Input.onChange` 从清单里整条消失。症状特别坏：**受控输入是 I1 的招牌用例**，
// 而它在生成物里"就是没有这个参数"，编译报错是"没有 on_change 这个标签" ——
// 离真因（我漏了继承）隔了三层。
const HTML_ATTRS_FULL = { ...HTML_ATTRS_BASE, ...DOM_EVENTS, ...ARIA_ATTRS };

const PER_INTERFACE = {
  ButtonHTMLAttributes: { ...HTML_ATTRS_FULL, ...BUTTON_ATTRS },
  AnchorHTMLAttributes: { ...HTML_ATTRS_FULL, ...ANCHOR_ATTRS },
  InputHTMLAttributes: { ...HTML_ATTRS_FULL, ...INPUT_ATTRS },
  TextareaHTMLAttributes: { ...HTML_ATTRS_FULL, ...TEXTAREA_ATTRS },
  SelectHTMLAttributes: { ...HTML_ATTRS_FULL, ...SELECT_ATTRS },
  ImgHTMLAttributes: { ...HTML_ATTRS_FULL, ...IMG_ATTRS },
  FormHTMLAttributes: { ...HTML_ATTRS_FULL, ...FORM_ATTRS },
  MediaHTMLAttributes: { ...HTML_ATTRS_FULL, ...MEDIA_ATTRS },
  AriaAttributes: ARIA_ATTRS,
  DOMAttributes: DOM_EVENTS,
  HTMLAttributes: HTML_ATTRS_FULL,
  HTMLProps: HTML_ATTRS_FULL,
  AllHTMLAttributes: {
    ...HTML_ATTRS_FULL,
    ...BUTTON_ATTRS,
    ...ANCHOR_ATTRS,
    ...INPUT_ATTRS,
    ...TEXTAREA_ATTRS,
    ...SELECT_ATTRS,
    ...IMG_ATTRS,
    ...FORM_ATTRS,
  },
};

/**
 * 取一个 React 属性接口名对应的字段表（`React.HTMLAttributes` / `ButtonHTMLAttributes` …）。
 *
 * @returns {Array<{name:string,type:string,optional:boolean,from:string}>|null}
 *          null 表示"这张表不认识这个名字"——**必须与"认识但没有属性"区分开**：
 *          前者要走真类型解析或标 unresolved，后者是合法的空集。
 */
function reactAttrsFor(name) {
  const table = PER_INTERFACE[name];
  if (!table) return null;
  return Object.entries(table).map(([n, t]) => ({
    name: n,
    type: t,
    optional: true,
    from: `react-common-table:${name}`,
  }));
}

/** 表认得的接口名（供 resolve 判断"这是 React 的属性面"）。 */
function isReactAttrsName(name) {
  return Object.prototype.hasOwnProperty.call(PER_INTERFACE, name);
}

module.exports = { reactAttrsFor, isReactAttrsName, PER_INTERFACE, DOM_EVENTS };
