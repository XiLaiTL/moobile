---
name: moobile-library-development
description: 在 moobile 仓库里改库本体的操作规程：一条能力该进库 / 生成器 / 应用的三条判据、改动与必须跑的验证之间的隐藏耦合、vendor fork 与宿主包的纪律、发版顺序与禁区。
whenToUse: 任务落在 moobile 仓库内且要求「改这个库」时加载：加能力、修 bug、提 PR、动 `vendor/rabbita` fork、改 `npm/moobile-host` 宿主包、改生成器、发版。用库写应用（不改库）时不要用这份——那用 `moobile-app-development`。
---

# moobile 库开发

**解决什么**：在 `moobile` 里**改库**（加能力 / 修 bug / 提 PR / 动 fork / 发版）时，
一条能力该写进哪一层、改完必须跑什么、哪些动作之间有**隐藏耦合**、哪些线不能碰。
**用库写应用的写法不在这里**（那是 `moobile-app-development`）。

本仓库的规矩是"**没跑验证不许说已完成**"，所以下面每条尽量带出处。
**先跑这一条**（不需要 Metro / 模拟器 / 后端）：

```bash
bash tools/verify_all.sh              # 离线全套；项数会漂，以它自己打的汇总行为准
bash tools/verify_all.sh --with-e2e   # 再加 Web 端到端（要 Metro 在 8081 + 后端）
python3 tools/verify_android.py       # 真机（要模拟器 + APK，不进 CI）
```

分数与"还剩什么"**只在一处**：以 `docs/STATUS.md` §2 为准 —— 别把项数 / 版本抄进任何地方。

## 一、一条能力该写在哪（三个问题顺序不能反）

1. **它在源码里有没有答案？** 有 ⇒ **生成器**。没有 ⇒ 后两级。
2. **它对所有应用都成立吗？** 成立 ⇒ **库**；只对这个应用成立 ⇒ **应用**。
3. **认错了会不会静默出错？** 会 ⇒ 宁可**点名**（进迁移报告的 TODO），**不要猜**。

每一层收什么、正例反例、以及"落错层"的实测代价 → `references/capability-levels.md`。

## 二、改动落在哪一层，决定必须跑哪几条门

**最容易忘的几条**（完整对照表在 `CONTRIBUTING.md` §1，**不复制**）：

| 你动了 | 必须跑（**顺序有意义**） |
|---|---|
| `vendor/rabbita/**` | `--capture` → `--check` → `python3 tools/gen_forwarders.py`（漏了消费者 import 会缺名字） |
| `npm/moobile-host/**` | `bash tools/refresh_host_copies.sh` **先** → `verify_all.sh` |
| 库本体（含渲染路径） | `verify_all.sh`；动了渲染路径再加 `--with-e2e` |
| `gesture/` 或画布变换 | 浏览器判据 **和** 真机判据，**两套都要** |

- ⚠️ **"web 上全绿 ≠ 真机能跑"**：手势通道栽过三次、画布变换有同款边界 ⇒ 只跑一边等于没验。
- 你动的每一块分别对应哪条命令（十行完整表）→ `references/gates-coupling.md`。

## 三、四条硬约束（每条都有实测代价）

| 约束 | 为什么 |
|---|---|
| 改完 `vendor/rabbita/**` **必须**回写：`--capture` 再 `--check` | `vendor/` 在 `.gitignore` 里，**`git status` 不会提醒你**，改动静默丢失 |
| 改完 `npm/moobile-host/**` **先**刷新副本再验 | 仓库里有多份 `file:` 副本；不刷新不只是门红 —— 验证脚本会**悄悄测旧代码** |
| 入库的生成物**不许手改** | 门会点名漂移；例外只有迁移产物的 `styles.mbt`（要能被逐函数抓出来） |
| 验证脚本要能识别"拿到的是不是这次的" | 否则产出**读数真实但结论错误**的报告（`AGENTS.md` §4） |

## 四、禁区（改之前先问）

- **不往库本体的 `moon.mod` 加依赖**（模块级且随包发布，会连带所有使用者）—— 先问能不能放进独立模块。
- **不放宽断言让门变绿**，也**不改被测物**去凑绿灯；**不在没跑验证的情况下说"已完成"**。
- **不擅自 `git commit` / `git push`**。
- **不把验收进度写进 `README.md`**（它是使用者第一屏，也是 registry 落地页）。
- 发版：**月亮包先、宿主包后**，两个包**必须同代发**；`.moonignore` 是**替换** `.gitignore` 不是叠加。
  完整命令序列与 Android 那几条环境禁区 → `references/release-and-rules.md`。

## 五、去哪看细节

| 要看什么 | 去哪 |
|---|---|
| 三条判据的展开与正反例 | `references/capability-levels.md` |
| 改完必须跑什么（十行对照表） | `references/gates-coupling.md` |
| vendor fork / 宿主包 / 生成物 | `references/vendor-host-and-generated.md` |
| 发版序列与禁区 | `references/release-and-rules.md` |
| 写作规矩、`moon ide`、工具链迁移 | `references/writing-and-tooling.md` |
| 一条能力该进哪一层的原文 | `docs/design/LAYERS.md` §0–§3 |
| 现状 / 分数 / 剩余工作 / 未验证清单 | `docs/STATUS.md`、`docs/HANDOVER.md` §6 |
