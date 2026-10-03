// canvas-native.web.js —— **web 平台用的空实现**（RN 的"平台文件"惯例：同名 + `.web.js`）。
//
// 为什么必须有它：`@shopify/react-native-skia` 是原生专用包，**Metro 在打包 web 时就连解析都会失败**
// （`UnableToResolveError: Unable to resolve module ./animation`）——运行期的
// `if (Platform.OS !== 'web')` 挡不住打包期的解析。所以 web 端要有一个同名文件把那半边顶掉，
// 让 `App.js` 保持**一份**、且不去碰原生依赖。
//
// web 的画布后端是另一条：`moobile-host/canvas-web`（DOM 2D 重放，零依赖），
// 由 `App.js` 直接注册。

/** 什么都不做 —— web 上用的是 `canvas-web.js` 那条后端。 */
export function registerNativeCanvas() {
  return [];
}
