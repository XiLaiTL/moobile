// canvas 试金石 —— **独立模块**（与 antd-spike 同一个理由：demo 需要的依赖不该
// 变成"每个使用者都要下载的东西"）。
//
// 它刻意走**公开路径** `XiLaiTL/moobile/canvas`（消费者看到的就是这个名字），
// 而不是 `vendor/rabbita/...` —— 试金石必须和消费者同路。
name = "XiLaiTL/moobile-canvas-spike"

version = "0.1.0"

license = "Apache-2.0"

description = "canvas 通道试金石：绘制指令 → Skia（跨语言对账 + 真引擎出图）"

preferred_target = "js"

import {
  "XiLaiTL/moobile@0.2.2",
}
