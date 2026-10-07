---
title: vendor fork、宿主包与生成物
description: 第三方代码不进仓时真相存在哪、改 fork 的两条硬规矩、宿主包的多份副本为什么要先刷新，以及哪些生成物不许手改。
---

# vendor fork、宿主包与生成物

主文档（`SKILL.md`）只挑最贵的几条上了桌；**逐条细则**在这儿。

## 一、vendor fork：`vendor/rabbita/`

第三方代码**不进仓**（整个 `vendor/` 在 `.gitignore` 里），
真相 = `tools/vendor.lock` 的版本 + `tools/patches/` 的 patch 系列。

- **`git status` 不会提醒你漏了回写** —— 提交前一定 `--capture` 再 `--check`，否则改动静默丢失。
- 改完 `vendor/rabbita/**` 还要 `python3 tools/gen_forwarders.py`：根上的 `html/` `cmd/` `sub/`
  `http/` 是**转发包**，名字清单从 vendor 的 `pkg.generated.mbti` 生成；忘了重跑，
  消费者 import 的 `XiLaiTL/moobile/html` 会**缺名字**。
- 行尾先归一：CRLF 会打乱 patch 上下文 ⇒ `bash tools/lf_normalize.sh`，再 `--check`。
- 换了基准版本：`bash tools/vendor_sync.sh --from <版本> --check` 先看冲突落在哪几个 patch。
  **判冲突必须实跑重放** —— 按文件级 diff 预估"两次都不准"（出处 `FORK.md` §4.1）。
- 重做冲突 patch 走**三方合并**（`git merge-file`），**别手改 patch 文本**（`FORK.md` §4.3 末尾）。
- 两条硬规矩：基准树必须是 **pristine 的独立目录**（否则把我们自己的改动当上游已有的，**静默丢掉**）；
  **`--check` 全绿不构成"改动完整"的证据**（fuzz 会丢掉打不上的上下文行还报成功）⇒
  另做**点名断言**核对。
- `vendor/` 不在 git 里 ⇒ "切分支"**保护不了它**，升级前自己备份。

## 二、宿主包：`npm/moobile-host/`

- 应用用 `file:` 依赖 ⇒ npm 是**拷贝**，仓库里存在**多份副本**。改完**先**
  `bash tools/refresh_host_copies.sh`，再 `node tools/check_npm_fresh.mjs`
  （副本数它自己会数，**别抄**）。
- **不刷新不只是门红**：验证脚本会**悄悄测旧代码**（真发生过，症状是"两次跑出来一模一样"）。
- 动过 `node_modules/**` 之后，跑真机 / 界面判据前**必须 `--clear` 重启 Metro** ——
  Metro 缓存模块解析与转换，症状是"改动看起来完全没生效"，而**读数是真的、测的不是这次的代码**。

## 三、生成物：哪些不许手改

- **入库的生成物一律不许手改**：`html/forward.generated.mbt`（`cmd/` `sub/` `http/` 同款）、
  宿主侧 `regen` 出来的 `registry.generated.js`。改了就重跑生成器
  （`python3 tools/gen_forwarders.py` / `npx moobile-host regen`），门会报漂移。
- **例外**：迁移产物的 `styles.mbt` **允许人改**，但改动必须能被
  `node tools/regen_styles_check.mjs` 逐函数抓出来。`MIGRATION.md` 分**生成区**（可覆盖）与
  **手写区**（永不被覆盖）—— 人的补记写错区，下次重生成就**没了**。
- 动生成器本身的组装顺序 / 映射表时，对应的那几条专项门要重跑
  （例：`node tools/press_order_check.mjs`、`node tools/border_fold_check.mjs`）——
  它们守的是"数量对了但语义反了"这类洞。
