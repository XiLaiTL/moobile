// moobile —— 一个 MoonBit 模块，同时包含：
//   * vendor fork 的 rabbita（模块根下的 html/cmd/sub/... 与 internal/）
//   * 我们自己写的 moobile 后端（moobile/）
//   * 公开的样式包（style/，使用者写视图的入口）
//   * 演示应用（demo/）
//
// 为什么 vendor 进同一个模块：`internal` 包的可见性是**按模块**判的，
// 只有同模块才能 import `internal/vdom`。详见 README「fork 配方」。
//
// 来源：moonbit-community/rabbita@0.15.4（Apache-2.0）；
// 我们对它的全部改动见 FORK.md（模块根的 README.mbt.md 是 vendor 自带的）。
name = "XiLaiTL/moobile"

version = "0.1.0"

license = "Apache-2.0"

readme = "README.md"

repository = "https://github.com/XiLaiTL/moobile.git"

description = "moobile：MoonBit 写 UI，React / React Native 渲染（内含 rabbita vendor fork）"

keywords = [ "moonbit", "moobile", "react-native", "rabbita" ]

preferred_target = "js"

import {
  "moonbitlang/async@0.21.0",
  "hackwaly/moonback@0.8.1",
  "moonbitlang/x@0.5.1",
}
