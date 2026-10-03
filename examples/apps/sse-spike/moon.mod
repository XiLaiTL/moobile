// SSE（流式）通道的**试金石** —— 独立模块，不是库里的一个包。
//
// 为什么独立：`moon.mod` 的 import 是**模块粒度**且随包发布 —— 应用若塞进库模块，
// 应用的依赖就变成**所有使用者的下载量**（`docs/FINDINGS.md` 的 R3）。
//
// ⚠️ 在仓库里它由根上的 `moon.work` 连到库本地的源码（所以 `moon check` 能编）；
//    它验的正是**还没发布**的 `sse/` 包，所以必须吃本地源码。
name = "sse-spike"

version = "0.1.0"

license = "Apache-2.0"

description = "SSE 流式通道的试金石（边收边显示；含分帧边界、错误路径、停止）"

preferred_target = "js"

import {
  "XiLaiTL/moobile@0.4.0",
}
