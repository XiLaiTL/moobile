---
title: 目录形状：程序 / 内容 / 站点实例三个根
description: 程序在旁边那个仓库（`interest/skillpress`，自己的 git 仓库）、内容在 `skills`、站点实例在 skillpress 那份 skill 的 scripts/ 里；三个根怎么定位、为什么这么分、便携版怎么打（还没做）。
---

# 目录形状：程序 / 内容 / 站点实例

**什么时候读它**：你要搬动引擎、要回答"程序在哪、内容在哪、站点在哪"、
要做便携版（一个 skill 单独拿走也能出站），或者要把这套东西挂进别的项目。

## 一、三个根（别混）

**程序与内容仓是兄弟**：程序在旁边那个仓库 `interest/skillpress/`（它自己一个 git 仓库），
内容仓是 `interest/moobile/`，实例住在内容里：

```
interest/                                     ← 平级：程序与内容仓都在这一层
├── skillpress/                               ★ **程序**（自己的 git 仓库）
│   ├── bin/skillpress.mjs                      门面（press / check / facts / audit / verify）
│   ├── lib/*.mjs                               实现：内容管线 / 上色 / 三道门 / 站点判据
│   │   └── roots.mjs                           ★ **四个根的唯一算法**（别再各写一遍"往上几层"）
│   ├── grammars/                               vendor 的语法资产（wasm + highlights.scm + PROVENANCE）
│   └── SPEC.md / SKILLS.md / DRIFT.md / PLAN.md 规范、账本与计划（跟着程序走 = 对外契约）
└── moobile/                                  ★ **内容仓**（一进来就看得到的那层）
    └── skills/                       ★ **内容**：7 份 skill（`SKILL.md` 的形态不变）
        ├── moobile-*/{SKILL.md,references/}
        └── skillpress/{SKILL.md, references/, scripts/.skillpress/}   ← 站点实例在 scripts/ 里
             实例 = moon.mod + content/（生成物）+ 宿主三件 + package.json
```

> ⚠️ 这条路走过两遍，**第二次的理由和第一次不一样**：一度搬出去又搬回来，因为"平级带来的
> 是一整套毫无收益的相对路径改写"；**2026-10-06 再搬出去** —— 这次要的是程序**独立成一个
> git 仓库**（自己的版本、发布与协作），那是"待在内容仓里"给不了的。
> `roots.mjs` **两种布局都认**（先找"旁边的 moobile"，找不到退回"往上三层"），所以再动也不用改路径。
> 代价写在明处：内容里的命令多一层 `../skillpress/`，且 G3 现在按**两个根**查（内容仓 + 程序根）。

三个根各管一件事：**程序**是能拿走、能发布的那份；**内容**是 skill 本身；
**实例**是"这一套内容 + 这个程序"编出来的那个站点工程。`press` 把内容读出来、写进实例的 `content/`。

> ⚠️ **命令看在哪个仓跑**：在内容仓根（`moobile/`）是 `node ../skillpress/bin/skillpress.mjs …`；
> 在程序根是 `node bin/skillpress.mjs …`。`bin/skillpress.mjs --help` 里两条都写了。

## 二、引擎怎么找到这三个根

| 根 | 命令行 | 环境变量 | 默认 |
|---|---|---|---|
| 程序 | （由文件位置决定） | — | `lib/` 的上一层 |
| 仓库 | `--repo <目录>` | `SKILLPRESS_REPO` | **旁边那个 `moobile/`**；找不到才退回"程序往上 3 层"（搬家前的布局） |
| 内容 | `--skills <目录>` | `SKILLPRESS_SKILLS` | `<仓库>/skills` |
| 实例 | `--app <目录>` | `SKILLPRESS_APP_DIR` | `<内容>/skillpress/scripts/.skillpress` |

**不猜**是刻意的：猜错的表现是"站点没更新"—— 页面照常渲染，只是旧内容，最难查的一类症状。

⚠️ 这四条现在**只有一处实现**：`skillpress/lib/roots.mjs`。以前它们在 5 个文件里各写了一遍
（`gen-content` / `check` / `docfacts` / `highlight` / `verify-site`），家规改一次要改五处，
漏一处就是"某个门在查别的目录"——而且**门不会报错**：搬家那天实测 `check` 报出
「moobile 根：`D:\`」、遍历整个盘、然后说"skills/ 下还没有 skill"。修法就是那个模块。

## 三、为什么这样分（三条理由）

1. **程序要能发布**：它将来是 npm 包 / moonbit 包，所以不能把"这一份内容"焊在里面；
   规范与账本跟着程序走，因为它们是**机制的契约**。
2. **内容要能被人看见**：`skills/` 是仓库里看得见的一级目录 —— 翻仓库的人一眼就看到它，
   也会跟着发布包走（`.moonignore` 放行即可）。形态没变：bundle 是 `<name>/SKILL.md`、
   `name` 必须 kebab-case。
   ⚠️ **代价写在明处**（2026-10-06 搬家时定的）：内容根原先在 **`.agents` 下的 `skills`**（点目录），
   那正是 **harness 的项目扫描根**（rank 200）—— 放在那儿的好处是"agent 一进仓库就带 7 份 skill"。
   搬到 `skills/` 之后 harness **不再自动加载**它们（DSH 的扫描根只有 `.dsh/skills` rank 100
   与 `.agents` 下的 `skills` rank 200 这两个）。要同时要"看得见"和"自动加载"，只有两条路：
   配 DSH 的 `customSkillDirs`（本机全局设置），或者把内容根要回扫描根里。
   ⚠️ **别两边各放一份** —— 两份内容就是两份会漂的真相，而门只会查其中一份。
3. **实例要能被单独特化**：它有自己的 `moon.mod`、宿主三件与依赖表，换主题 / 加页面不用碰程序；
   程序升级 = 升级它的依赖。

## 四、规范上为什么合规

| 设计 | 规范怎么接 |
|---|---|
| 实例住在 `scripts/.skillpress/` 里 | `SPEC.md` §3：`scripts/*` 是"随 skill 一起发的工具"，**不设体量上限**；目录（不是文件）也不会被渲成站点子页 |
| 引擎天天改，别天天触发 G8 | 指纹只算 `SKILL.md` / `references/*.md` / `FAQ.md` —— **`scripts/` 不进指纹** |
| 程序里的路径要被门查 | G3 / G4 的候选根有**程序根**（`bin/` `lib/` `grammars/` 能对上账）—— 2026-10-06 搬家时补的；在那之前它们**一个都不查**（静默的死链） |
| 程序与实例里的路径要被门查 | G3 / G4 的候选根里还有**仓库根**（`docs/**` `examples/**` 能对上账）与**这个 skill 自己的目录**（`scripts/**` 能对上账） |

## 五、产物与依赖的归属

- 程序：`node_modules` 里只有高亮那一个依赖（`web-tree-sitter`）—— 放 `dependencies` 而不是 dev：
  `npm config get omit=dev` 时 dev 依赖会被静默跳过，引擎缺了高亮就悄悄没了。
- 实例：`node_modules`、`_build/`、`dist/`、`moobile.js` 都在 `.gitignore` 里；
  `content/content.generated.mbt` **要进仓库**（实例得能独立编译），新鲜度由 `press --check` 保证。
- 实例对宿主用 **`file:` 依赖**（这仓库的老规矩，见 `moobile-host` 那套）：改了宿主之后那份副本要刷新
  —— 更糟的是**验证脚本会悄悄测旧代码**，所以这仓库有 `tools/check_npm_fresh.mjs` 在数副本。

## 六、还没做（别当成已支持）

> 这份清单会变。已经做完的那几条**从这里划掉**，而不是留着当"还是这样" —— 一条过期的"还没做"
> 与一句假话是同一类东西。2026-10-06 划掉：**界面抽包**（界面现在住在程序包的 `shell/` 里，
> 实例的 `app.mbt` 只剩十几行接线；判据是 `acceptance.sh` 的 A2，它盯着"实例 `app.mbt` ≤20 行、
> 依赖在 `moon.mod` 里、实例里没有界面副本"）。

- **`skillpress pack`**：把一个 / 一组 skill 打成**便携目录**（自带程序副本 + 生成的首页 skill）。
- **`skillpress attach`**：挂进一个**已有**的 moobile 项目（写 `skills/` 骨架 + 实例 + npm scripts）。
- **moobile 那边的钩子**：计划给 `moobile-host init` 加通用扩展点（`--with <包或路径>`），
  skillpress 做第一个插件 —— 但 `moobile-host` 的子命令面在那个仓库是**冻结**的，
  改要先动它的设计文档与门，所以这条排在最后。
