# 文档导览 —— 三类读者，三条路线

这个仓库的文档不少，但只需要读你关心的那条线。分工原则：**同一件事只在一处讲** ——
架构讲"是什么 / 为什么"，`FINDINGS` 讲"实测到了什么"，`PLAN` 讲"接下来做什么"。

> 一句话背景：moobile 是给 [rabbita](https://github.com/moonbit-community/rabbita)（MoonBit 的 TEA UI 框架）
> **换渲染后端**的库 —— 保留 `Model` / `Msg` / `update` / `view` 与 `@html` DSL，
> 把最后一跳从"操作 DOM"换成"产出 React 元素"。

---

## 一、想用它写应用

| 文档 | 讲什么 |
|---|---|
| [`../README.md`](../README.md) | 这是什么、最小接入（MoonBit 一行 + 宿主四行）、能力边界 |
| [`../npm/moobile-host/README.md`](../npm/moobile-host/README.md) | 宿主包：`MOBILE_HOST` 契约、能力注册表 `regen`、版本兼容表 |
| [`../DEV.md`](../DEV.md) | 环境变量、跑起来、跑真机、排错、**禁区** |

最小可跑的例子就是本仓库的 [`../examples/apps/todo-app/`](../examples/apps/todo-app/)：
本地数据库 + 网络同步 + 多页面 + 一个 MoonBit 写的后端（[`../examples/services/todo-server/`](../examples/services/todo-server/)）。

## 二、想改这个库

| 文档 | 讲什么 |
|---|---|
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | 改完必须跑什么、写文档的规矩（负面清单为主）、怎么发版 |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 分层（L0 宿主 … L6 应用）、宿主契约、发布形态、已知瑕疵 |
| [`../FORK.md`](../FORK.md) | 我们 fork 了 rabbita 的什么、为什么、14 个 patch 各改了什么、怎么升级 |
| [`../DEV.md`](../DEV.md) | 构建、验证脚本清单、第三方 fork 怎么重建 |

## 三、想理解"为什么这么设计 / 当初试过什么"

| 文档 | 讲什么 |
|---|---|
| [`FINDINGS.md`](FINDINGS.md) | **实测记录**（R1 排版 / R2 把真应用跑起来 / R3 仓库治理）：每条带命令与输出，含踩过的坑与真因 |
| [`design/DESIGN.md`](design/DESIGN.md) | 设计文档（**草案 / 待验证**状态，保留原始判断） |
| [`design/SCAFFOLD.md`](design/SCAFFOLD.md) | **脚手架设计**：生成什么、工具用什么语言写（对外的 `.mjs` / 对内的 MoonBit）、验收判据"零 Python" |
| [`design/DESIGN-FEASIBILITY.md`](design/DESIGN-FEASIBILITY.md) | 设计期的可行性实测（写代码之前做的那些验证） |
| [`design/DESIGN-README.md`](design/DESIGN-README.md) | 设计阶段的草案 README —— **已过时**，现行版本是 [`../README.md`](../README.md) |
| [`../PLAN.md`](../PLAN.md) | 当前生效的计划：轨道 A–N、决策点、里程碑 |
| [`plan/PLAN-2026Q3-yi-port.md`](plan/PLAN-2026Q3-yi-port.md) | 归档的旧计划（**T0.x–T7.x 编号只在那份文件里有效**） |
| [`evidence/`](evidence/) | 测量数据与截图（`r1/` 是排版判决那一批；`shot-*.png` 由 `tools/verify_web.js` 生成） |

---

## 三条约定

1. **有数字的地方就有命令** —— 找不到命令的数字，按"未验证"对待。
2. **结论被推翻要留痕** —— 例如"fork 必须铺在模块根"被 R3 推翻：旧结论与推翻过程都留在原处，
   而不是悄悄改掉（`FORK.md` §0.1 里还专门写了"这一节推翻了本文件此前的说法"）。
3. **状态用符号标**：✅ 已完成并验证 / 🟡 部分完成 / ❌ 试过不行（附原因）。

链接是否还有效由 `python3 ../tools/check_links.py` 保证（它也是 `tools/verify_all.sh` 的一项）。
