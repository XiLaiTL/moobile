// moobile —— 一个 MoonBit 模块（模块名就是包名，库本体在**模块根包**）：
//   * 根上的 `html/` `cmd/` `sub/` `http/` —— **转发包**（生成物），让消费者的 import 保持简短
//   * `style/` —— 类型化样式层（写视图的入口）
//   * `sqlite/` —— 本地数据库能力包（宿主侧 expo-sqlite）
//   * `vendor/rabbita/` —— vendor fork 的 rabbita（含 vdom / runtime / html / cmd / …）
//   * 演示应用在 `examples/apps/todo-app/`（**独立模块**，不进发布包）
//
// 为什么 fork 与库在同一个模块：`internal` 包的可见性是**按模块**判的（只认路径段恰好等于
// `internal`），同模块才拿得到 `vdom`；fork 因此以"摊平改名"的方式落在 `vendor/rabbita/`
// （`internal/vdom` → `vendor/rabbita/vdom`）。详见 README「fork 配方」与 FORK.md。
//
// ⚠️ `import` 里加依赖会**连带所有使用者**（模块级、随包发布，声明了就会被下载）——
//    所以要加东西先问"能不能放到独立模块里"（demo 就是这么处理的）。
//
// 来源：moonbit-community/rabbita@0.15.4（Apache-2.0）；
// 我们对它的全部改动见 FORK.md 与 THIRD-PARTY-NOTICE.md。
name = "XiLaiTL/moobile"

version = "0.4.0"

license = "Apache-2.0"

readme = "README.md"

repository = "https://github.com/XiLaiTL/moobile.git"

// 给 registry 列表/搜索看的那一行：**不重复包名、不自夸、不提内部实现**（对照上游 rabbita 的
// "functional Web UI framework for MoonBit"）。搜索词见 keywords —— mobile/Android/iOS/Web
// 是使用者最先会搜的词，所以放在最前面。
description = "MoonBit UI for mobile: Android, iOS and Web from one rabbita (TEA) app, rendered by React Native"

keywords = [ "moonbit", "mobile", "android", "ios", "web", "cross-platform", "react-native", "rabbita", "UI", "TEA" ]

preferred_target = "js"

import {
  "moonbitlang/async@0.21.0",
}
