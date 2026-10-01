#!/usr/bin/env node
'use strict';
// `moobile-host libgen` —— 从**应用装好的组件库**生成三份东西（PLAN §3.8 的 I2 / I5 / I3）。
//
//   npx moobile-host libgen                 # 生成
//   npx moobile-host libgen --check         # 只校验（进 CI：产物被手改就红）
//   npx moobile-host libgen --lib antd      # 多库时选一个（见 libgen.config.json）
//
// 三段一条流水线：
//   node_modules/<lib>/**/*.d.ts → manifest（JSON，入库）→ ① 宿主注册调用 ② MoonBit DSL 包
//
// **为什么这个工具住在 Node 侧**（而不是 MoonBit CLI）：它的输入是 `.d.ts` 与 `node_modules`，
// 这两样只有 Node 侧拿得到（`PLAN.md` §3.8 的"位置必须是 Node 侧的一条硬理由"）。

// 走 `main` 而不是 `run`：`main` 会把"库没装 / 没有类型定义"这类**预期内的失败**
// 转成一句能照着做的话，而不是把堆栈甩给用户。
const { main } = require('../libgen');

main(process.argv.slice(2));
