// antd 全组件 demo —— **独立模块**（与 antd-spike / todo-app 同一个理由）。
//
// 为什么和「试金石」分成两个应用（而不是一个）：
//   · `antd-spike` 是**判据**：它压的是"库本体接得对不对"（标签直通 / 契约 / 载荷通道），
//     条目少、跑得快、进了 `tools/verify_all.sh` 那条门；
//   · 这里是**用法示例**：压的是"生成出来的 DSL 能覆盖多少组件、交互到底能不能用"，
//     它跟着 antd 的版本走，所以判据待在它自己的 `host/verify.mjs` 里，不进那条门。
//   两者的判据读者不同，混在一起会让"门红了"分不清是库退化了还是 antd 升级了。
name = "XiLaiTL/moobile-antd-demo"

version = "0.1.0"

license = "Apache-2.0"

description = "antd 全组件 demo：用 libgen 生成的 @antd DSL 把组件库的每个组件都渲染出来"

preferred_target = "js"

import {
  "XiLaiTL/moobile@0.2.2",
}
