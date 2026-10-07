---
title: 发版顺序与禁区
description: 两个包为什么必须同代发、发布的完整命令序列、.moonignore 与 .gitignore 的关系，以及改库之前先问自己的那几条禁区。
---

# 发版顺序与禁区

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、发版：**月亮包先，宿主包后**

```bash
bash tools/py.sh tools/check_public_leaks.py     # 泄漏闸门：本机绝对路径 / 凭据
moon package --list                              # 发布包 = .moonignore 过滤后的产物，先看清单
bash tools/py.sh tools/readme_probe.py --zip _build/publish/XiLaiTL-moobile-<版本>.zip
moon publish                                     # 1) 月亮包
bash npm/moobile-host/publish.sh <6位码>          # 2) npm 宿主包（本机默认 registry 是只读镜像）
bash tools/check_published.sh                    # 3) 从"用户视角"验，两个包都验
```

- **两个包必须同代发**：只发一边会让线上是**错配的一对**，用户挂载时同时报出两个契约版本号；
  `tools/check_published.sh` 从两个 registry 各拉一份比对契约版本
  （出处 `CONTRIBUTING.md` §3、`CHANGELOG.md`）。
- npm 服务端是**异步受理**：刚查还是旧版本 ≠ 没发出去 —— 要么等，要么**轮询**。
- 打包自检：`bash npm/moobile-host/publish.sh --dry-run`（真打 tarball + 真安装 +
  用装好的 CLI 生成一个项目）。
- 发布范围只看 `.moonignore`：它会**替换**同目录的 `.gitignore`，**不是叠加** —— 所以 fork 目录
  （在 `.gitignore` 里被排除）必须**不列**在 `.moonignore` 里（不列 = 包含）。
  改它之后一定再看一遍 `moon package --list`。
- 版本：`moon.mod` 主版本**必须是 `0`**（CLI 硬要求）；破坏性改动抬次版本。

## 二、禁区（改之前先问）

- **不往库本体的 `moon.mod` 加依赖**：依赖是**模块级且随包发布**，会连带所有使用者；
  先问"能不能放到独立模块里"（`tools/mbtools/` 与各应用就是这么隔离的）。
- **不擅自 `git commit` / `git push`**，除非用户明确要求。
- **不放宽断言让门变绿**（那是把 bug 藏起来，注释里写清为什么放宽才算合格）；
  也**不改被测物**去凑绿灯。
- **不在没跑验证的情况下说"已完成"**。
- **不手改生成物**（见 `references/vendor-host-and-generated.md`）；
  **不把验收进度写进 `README.md`** —— 它是使用者第一屏，也是 registry 落地页。
- `DEV.md` §7 的 Android 那几条：不升 Gradle 9.x；不给 `node_modules` 里"包自带的 `build/`"建联接；
  不设 `GRADLE_USER_HOME`；跑过 `npx expo prebuild` 就必须重跑 `bash tools/android_env_setup.sh`。
  写 `.ps1` 只用 ASCII。
