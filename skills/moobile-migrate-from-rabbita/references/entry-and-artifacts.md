---
title: 迁移入口与三件产物
description: create --from-rabbita 的全部选项、每次都会产出的三件东西，以及"入口包的文件被摊到模块根"这条容易忽略的约定。
---

# 迁移入口与三件产物

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、入口与选项

```bash
npx moobile-host create --from-rabbita <既有项目> <新项目目录> [--name X] [--rn 0.83]
```

| 选项 | 它的实际作用（`npm/moobile-host/lib/migrate/create.js` 的 `parseArgs` / `USAGE`） |
|---|---|
| `<既有项目>` | 一个能读到 `moon.mod` 的 MoonBit 项目根；读不到就以**退出码 2** 拒绝 |
| `<新项目目录>` | 不存在就建；已存在且非空要 `--force`（`.git` 不算内容） |
| `--name` | 应用名，默认取目录名；同时被当成新的**模块名** |
| `--rn <档位>` | 宿主档，默认 `0.86`；档位与 npm 版本的对应表在 `create.js` 的 `RN_PROFILES`（**别抄版本号**） |
| `--host-dep <spec>` | 宿主 npm 包怎么写进 `package.json`。**在 moobile 仓库里跑自己的应用必须写** `file:../../../npm/moobile-host`，否则会去 registry 拿一个**还没发布**的版本 |
| `--dry-run` | 只打印将写什么与摘要（UI 包、样式函数数、TODO 数），**不落盘** |
| `--force` | 目标目录非空时也写。⚠️ 它会**覆盖**生成物（见主文档 `SKILL.md` 的"迁移之后要跑什么"） |

> 迁移是**换依赖**，不是两个 rabbita 并存：产物里只能剩 `XiLaiTL/moobile` 一条 rabbita 来源
> （`docs/design/SCAFFOLD.md` §3.7.2）。

## 二、三件产物（一件都不能省）

| 产物 | 是什么 |
|---|---|
| ① `MIGRATION.md` ＋ `migration.generated.json` | 同一份报告的**两个形态**：人读的、机器读的（后者能被门对账） |
| ② 新项目 | 宿主四件套 + 改过的 `moon.mod` / `moon.pkg` + **尽量原样搬运的视图** + `styles/` |
| ③ TODO 清单 | 就住在报告 §4 里，**每一项都有下一步**（判据 S9-5） |

## 三、一条容易忽略的约定：入口包的文件被摊到模块根

- `frontend/main.mbt` → `main.mbt`。
- **为什么**：`moobile-host build` 找的是"以模块命名的那个产物"，入口留在子包里产物就叫别的名字，
  `build` 直接报"**找不到产物**"（`create.js` 的注释，**实测踩过**）。
