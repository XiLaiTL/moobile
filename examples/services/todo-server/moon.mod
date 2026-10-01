// Todo 示例的后端模块。
//
// ⚠️ **必须是独立（嵌套）module**：父模块 `XiLaiTL/moobile` 声明了
// `supported_targets = "+js"`，而服务端要 native 目标。有自己的 `moon.mod`
// 才会被当成独立模块（否则会被当成父模块的一个包，native 构建起不来）。
name = "XiLaiTL/moobile-todo-server"

version = "0.1.0"

license = "Apache-2.0"

description = "moobile Todo demo 的后端：MoonBit + moonbitlang/async 的最小 REST 服务端"

preferred_target = "native"

import {
  "moonbitlang/async@0.21.0",
}
