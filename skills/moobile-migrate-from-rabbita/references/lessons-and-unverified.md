---
title: 实测教训与"未验 / 别当已支持"
description: 迁移特有的五个坑（样式来源与视图来源不是一个集合、服务端包搬不得、点不动、三处改写易漏、@media 不进产物），以及尚未验证的诚实清单。
---

# 实测教训与"未验 / 别当已支持"

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、实测教训（迁移特有的坑）

- **样式表的来源与视图的来源不是同一个集合**：CSS 常常躺在别处（`interest/yi` 的样式在
  `backend/index.html` 的内联 `<style>` 里，而 `backend/` **根本不进 UI 包闭包**）。
  只喂 UI 包 ⇒ 样式函数**少生成**，而**报告里看不出来**。
- **源项目里的服务端 / 脚本包不能被搬**：判据用"**被 UI 包 import 的本地包**"，不是目录名。
  搬进来会让新项目**连 js 都编不过**，而错误信息**完全指不到原因**。
- **`on_click` 挂在 `div` / `span` / `p` 上 = 点不动**：只有 `button` / `a` 落到 `Pressable`，
  其余落到没有 `onPress` 的组件，点击被丢掉、**不报错**、`moon check` **全绿**。
  修法是**换标签**，不是加样式（**实测 5 处**）。
- **入口 / 依赖那三处改写**容易漏：`moon.pkg` 少了 `@styles` 会有成片的
  `Package "styles" not found`；`link.exports` 挂错包会**编过但导不出** `app`
  （宿主拿到 `undefined`）；`pkgtype(kind:"executable")` 留着 moon 会去找 `fn main`。
- **`@media` 里的值不进产物**：只能取"无媒体查询"那一份，窄屏那条照旧点名
  （RN 没有媒体查询，断点在 Model 里用 `@sub.on_resize` 表达）—— 见 `docs/design/LAYERS.md` §2。

## 二、未验 / 别当已支持

| 事实 | 状态 |
|---|---|
| 画布文字字形 | ✅ 已在真机**量到像素**（墨点连通块 790 → 2191），证据图 `docs/evidence/zhouyi-compass-cjk-after.png` |
| 真机字形 vs web / 桌面的**差异** | ❌ **没有判据**：真机回退字体与源 CSS 想要的族不是同一个，差多少**没人量过** |
| 画布 `devicePixelRatio` 换算 | ❌ 未验（`docs/STATUS.md` §4 仍挂着这条） |
| `facts` 块的覆盖范围 | 只覆盖**样式层与 F1 动检**两组数字 —— 改写统计 / TODO 清单 / 生成后自查**不在**门里 |
| 迁移后效果 | **不承诺一致**，必须重新验（见主文档的"迁移之后要跑什么"） |

> 现状、分数、已发布版本**只看** `docs/STATUS.md`；项数（动检几类、样式函数几个）以
> **工具自己打的汇总行**为准。

## 三、去哪看细节

| 要看什么 | 去哪 |
|---|---|
| 入口与全部纪律（最权威的一段注释） | `npm/moobile-host/lib/migrate/create.js` 文件头 |
| 迁移矩阵：哪些照搬、哪些必须改 | `docs/design/SCAFFOLD.md` §3.7.3 |
| 判据 S9-1…S9-6 与生成后自查 | `docs/design/SCAFFOLD.md` §3.7.6 |
| 一条能力该进库/生成器/应用的三条判据 | `docs/design/LAYERS.md` §2 |
| 真实迁移案例与阶段判据 | `docs/plan/PLAN-yi-port-2026-10.md` §4、`examples/apps/zhouyi-reader/` |
| F1 动检的规则与"有意不覆盖" | `npm/moobile-host/lib/migrate/scan.js` 文件头与文件末尾 |
| 有损清单怎么读（CSS 子集边界） | `npm/moobile-host/lib/migrate/css.js`、`style-map.js` 的文件头 |
| 观感缺口的类别与影响等级 | `npm/moobile-host/lib/migrate/motion-gap.js` |
| 不报错但错的坑（通用） | `docs/FINDINGS.md`、`AGENTS.md` §3 |
