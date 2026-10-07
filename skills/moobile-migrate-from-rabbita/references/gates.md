---
title: 迁移器自己的门，各守什么
description: 八道门逐条说明 + "改 scan.js 必须同时改 MoonBit 那份"这条硬耦合。主文档 §七 的细则。
---

# 迁移器自己的门，各守什么

主文档 §七 只留了"合集入口 + 那条硬耦合"，细则在这儿。**什么时候读它**：
某道门红了、或者你要动迁移器本身（`lib/migrate/**` 或 `tools/mbtools/**`）的时候。

| 门 | 守什么 |
|---|---|
| `tools/migrate_scan_reconcile.mjs` | F1 的**两份实现**（MoonBit 真源 `tools/mbtools/src/migrate_scan.mbt` 与随包发布的 `scan.js`）逐 finding、逐 hit 一致 |
| `tools/migrate_click_scan.mjs` | `click.on-view` 这一条 + 诱饵（`button`/`a` 的正确写法**一条都不许报**） |
| `tools/migrate_ledger_check.mjs` | 每条源声明进一个有名字的桶；`silentEmpty` 在真实应用上是 0 |
| `tools/migrate_facts_check.mjs` | `migration.generated.json` 的 `facts` 与"从源重算"逐字段一致 |
| `tools/migrate_app_audit.mjs` | 生成物自查的两条规则 + 故意做坏的样本 |
| `tools/regen_styles_check.mjs` | `styles/styles.mbt` 与重算逐函数一致（源项目不在本机 ⇒ SKIP，不是通过） |
| `tools/report_region_check.mjs` | 报告两区：重生成不许冲掉手写区，老格式不许丢东西 |
| `bash tools/verify_all.sh` | 上面这些的合集入口（离线全集） |

## 那条硬耦合

⚠️ **改 `scan.js` 必须同时改 MoonBit 那份** —— "两份实现 = 一个必然的漂移点"，
对账门就是钉这件事的。两侧的文案与判据**逐字节一致**才算数（判据是 `migrate_scan_reconcile.mjs`，
它比到每个 finding 的 `next` 字段）。

## 一个连带的坑（重生成产物时）

改了 `scan.js` 的文案，已产出的 `MIGRATION.md` / `migration.generated.json` 里那份**副本**也要跟着变。
但**不要对真实应用目录跑 `create --force`**：

- `create.js` 的 `writeProject` 会先写 **18 个文件**（含人改过的 `main.mbt`），而生成后自查 `auditApp`
  跑在**写完之后** ⇒ ① 冲掉应用的手改；② 报告的自查那一节会写出**假声明**。
  实测：临时目录重生成得到"2 条必须处理"，而 `node tools/migrate_app_audit.mjs` 对**真**应用是"干净"。

正确做法：在**仓库外**的暂存根里重跑生成器（让报告里的 `from`/`to` 与原报告逐字相同），
**只把生成器刚算出的那一条**移植进产物，并断言：报告恰好改 1 行、JSON 恰好改 1 行、
**手写区逐字节不变**、其余字段逐条相同。
