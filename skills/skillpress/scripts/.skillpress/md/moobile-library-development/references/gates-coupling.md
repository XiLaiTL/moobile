---
title: 改完必须跑什么（隐藏耦合）
description: 动哪一块就必须跑哪几条门、顺序为什么有意义，以及"web 上全绿 ≠ 真机能跑"这条反复栽过的边界。
---

# 改完必须跑什么（隐藏耦合）

主文档（`SKILL.md`）只列最容易忘的那几条，**完整表在这儿**。
完整对照表另有 `CONTRIBUTING.md` §1（**不复制**）＋ `docs/HANDOVER.md` §5。

| 你动了 | 必须跑（**顺序有意义**） |
|---|---|
| 库本体（根包 / `style/` / `sqlite/`） | `bash tools/verify_all.sh`；动了渲染路径再加 `--with-e2e` |
| `vendor/rabbita/**` | `bash tools/vendor_sync.sh --capture` → `--check` → `python3 tools/gen_forwarders.py` |
| `npm/moobile-host/**` | `bash tools/refresh_host_copies.sh` **先** → `verify_all.sh` |
| 模板 `examples/apps/template/` 或 `npm/moobile-host/lib/**` | `node tools/template_check.mjs` + `node tools/scaffold_probe.mjs` |
| `examples/apps/todo-app/` 或 `tools/template/deltas.txt` | `node tools/template_compare.mjs`（同源门，差异不在清单上就红） |
| 往 `style/style.mbt` 加样式键 | `node tools/style_platform_check.mjs`（新键的挡板：库能产的键 vs 原生 RN 真认的键） |
| `gesture/` 或 `gesture-rn.js` | `examples/apps/gesture-spike/host/verify.mjs` **和** `examples/apps/gesture-edges/device_check.mjs`，**两套都要** |
| 画布：`canvas/` 或宿主 `canvas-*.js` 的变换 | `examples/apps/canvas-spike/host/verify.mjs` **和**真机 `examples/apps/zhouyi-reader/device_check.mjs` |
| 宿主表 / 宿主文件集：`npm/moobile-host/lib/hosts.js`、`npm/moobile-host/hosts/` | `node tools/host_probe.mjs`（守"换宿主不改应用"） |
| 组件库生成器 `npm/moobile-host/libgen/` | `node tools/libgen_probe.mjs` + 对应应用里 `npx moobile-host libgen --check` |

## 「web 上全绿 ≠ 真机能跑」

- **手势通道**在这一条上栽过三次（`AGENTS.md` §3）；**画布变换**也有同款边界
  （`CONTRIBUTING.md` §1：判据全绿 ≠ 真机上画对）。
- ⇒ 动了这两条通道，**浏览器判据与真机判据两套都跑**；只跑一边等于没验。
- 动过 `node_modules/**` 之后，跑真机 / 界面判据前**必须 `--clear` 重启 Metro**：
  Metro 缓存模块解析与转换，症状是"改动看起来完全没生效"，而**读数是真的、测的不是这次的代码**
  （详见 `references/vendor-host-and-generated.md`）。
