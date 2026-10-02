// 性能基准负载（D1）—— ⚠️ **它不是示例，是测量仪器**。
//
// 为什么必须存在：`PLAN.md` §4.1 的 D1 要"长列表 100 / 1000 / 5000 项"，
// 而现有示例的规模是**写死在代码里**的 —— 改规模就要改 `.mbt` 再重编，
// 于是"改前 / 改后"两次测的**不是同一份产物**（编译差异、常量折叠差异都会混进读数）。
// 这里把 N 做成**宿主在挂载之前注入的运行时输入**（`globalThis.__MOBILE_BENCH_N__`，
// 见 `app.mbt` 的 `bench_n()`）：同一份产物、同一个哈希，跑三档规模。
//
// ⚠️ 它不进 `template`：模板是"用户会拿到什么"的唯一真源（SCAFFOLD §3.4），
//    没有人会想要一份基准仪器 —— 与 canvas / gesture / SSE 各带自己示例同一个理由。
//
// ⚠️ 应用是**独立模块**（不是库模块里的一个包）：`moon.mod` 的 import 是模块粒度
//    且**随包发布**，塞进库模块就会变成所有使用者的下载量（FINDINGS 的 R3）。
name = "XiLaiTL/moobile-perf-bench"

version = "0.1.0"

license = "Apache-2.0"

description = "moobile 性能基准负载（D1/D2 用；N 由宿主注入，见 tools/perf_bench.mjs）"

preferred_target = "js"

import {
  "XiLaiTL/moobile@0.4.0",
}
