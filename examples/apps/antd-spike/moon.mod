// antd 试金石 —— **独立模块**。
//
// 为什么独立（与 todo-app 同一个理由）：`moon.mod` 的 `import` 是模块粒度且随发布包走的，
// demo 需要的东西不该变成"每个使用者都要下载的东西"。
//
// 开发时由仓库根的 `moon.work` 工作区连到库本体；用法见 `host/README.md`。
name = "XiLaiTL/moobile-antd-spike"

version = "0.1.0"

license = "Apache-2.0"

description = "React 组件库接入的试金石：把 antd 的组件当 moobile 标签用（Web 宿主）"

preferred_target = "js"

import {
  "XiLaiTL/moobile@0.4.0",
}
