---
name: skillpress
description: 这套工具自己的一份说明书：这个内容仓库里一份 skill 怎么写、怎么验、怎么变成站点上的一页（收录判据、固定结构、八道门、坑与指针）。站点的首页另有其源（`WEBSITE.md`），不是这份文件。
whenToUse: 你要写、改或审这个仓库的一份 skill（`skills/<name>/` 下的 SKILL.md / references / FAQ），要跑或改那几道门（check / facts / press / audit / verify），或者要动内容管线与站点的时候。
---

# skillpress —— 写一份能用的 skill

**只解决一件事**：这份仓库里的一份 skill 怎么写、怎么验、怎么变成站点上的一页。
下面三条都在**内容仓根**跑（`skills` 就在它下面），而**程序是它旁边的兄弟**
（`../skillpress/`，它自己是一个 git 仓库）：

```bash
node ../skillpress/bin/skillpress.mjs check      # 门：skill 自己（G1–G8）
node ../skillpress/bin/skillpress.mjs press      # 内容源 → 站点内容包
node ../skillpress/bin/skillpress.mjs verify     # 判据：真 Chrome 无头
```

> **角色分工**（别混）：**程序**在旁边的 `skillpress/`（引擎 + 门 + 语法资产；
> 它单独一个仓库，将来发 npm / moonbit 包）；
> **内容**就是你这种目录（`SKILL.md` + `references/`）；**站点实例**在
> `skills/skillpress/scripts/.skillpress/`（一个"**用**程序"的 MoonBit 工程，界面在程序包里）。
> 整套形状、以及"程序为什么在仓库外面"见 `references/layout.md`。
>
> 这份 skill **自己不上书架**（它在仓库根的 `skillpress.ignore.md` 里 —— 读者是改内容的人，
> 不是来看站点的人）。站点的**首页**另有其源：`skills/skillpress/WEBSITE.md`。
>
> 中间那条最容易漏：**改了任何内容源就必须重跑 `press`**，否则站点还是旧内容。
> `press --check` 会红并指出**第一处差异** —— 它就是为此存在的。

## 一、收录判据

什么进正文、什么只留指针 —— 判据一共十条（进五类 / 不进五类），逐条的理由与反例见程序的 `SPEC.md` §2：

| 进（五类） | 不进（五类） |
|---|---|
| 不可推导的约定（猜错要付代价） | 会漂的数字（版本 / 分数 / 项数 / 状态） |
| 反面清单（尤其"写了不报错但没效果"） | 动机与历史 |
| 确切命令（可复制、写清在哪跑） | 超过 ~15 行的长代码 |
| 判据（哪条命令的输出能证明这句话） | 编译器 / 类型系统已经会拦的事 |
| 指针（去哪个文件的哪一节看） | 一眼 grep 得到的（签名、目录清单） |

**最省 token 的一条**：编译器不说的那些话才值钱。

## 二、一个 skill 的结构

```
skills/<name>/
├── SKILL.md     必填。门禁 + 指针：读完就能动手；细则给 references/ 的路径
├── references/*.md    可选，一个主题一份。长表 / 逐条清单 / 证据链，按需读
├── scripts/*    可选。随 skill 一起发的可跑小工具（**站点实例就住在这种目录里**）
├── FAQ.md       可选。人看的问答（站点上作为子页）
└── _meta.json   可选。发布元数据
```

四条规矩（程序的 `SPEC.md` §3）：SKILL.md 必须自足到"能动手"，但**判据不许外置**；外置要留**路径**指针；
`references/**` / `FAQ.md` **同样过门**；`_meta.json` 只管打包、不是事实的家。
预算：`SKILL.md` 与**单个 ref** 都是 **400 行 / 20 KB**，代码块 ≤15 行，表 ≤12 行 —— 超了不是删，是**拆**。

> 这份目录同时在**两个地方**被读：写 skill 的人（与 AI）读它，站点也把 `skills/**` 渲成文档区
> —— `references/` 会变成树上可展开的子页。所以**目录结构就是站点结构**，不用额外配置。
> ⚠️ 首页源（`skillpress/WEBSITE.md`）**不算子页**：它既不进树，也不进页面索引（D20）。

## 三、门：八条

| # | 判据 |
|---|---|
| G1 | frontmatter 三字段齐全；`name` == 目录名；都是单行标量 |
| G2 | 体量预算 + **行尾必须 LF**（CRLF 会让 frontmatter 静默失效） |
| G3 | 反引号里的**仓库内路径**必须存在（按仓库根 / **这个 skill 自己的目录**查） |
| G4 | 命令里引用的脚本路径必须存在（`examples/**`、`tools/**`、`scripts/**`…） |
| G5 | `@html.` / `@style.` / `@cmd.` / `@sub.` 的 API 名必须在 moobile 源码里存在 |
| G6 | `docs/**.md` 这类链接的 `§N` 节号必须真的存在 |
| G7 | 禁语表（程序的 `claims.txt`）出现即红：不许把"未做"写成"已支持" |
| G8 | 体量 / 条目数指纹变了就红：**复核**这次变化，然后 `--update-lock <名字>` |

```bash
node ../skillpress/bin/skillpress.mjs check --selftest   # 门自己的判据：诱饵必须全被点名
node ../skillpress/bin/skillpress.mjs facts             # 另一道门：查事实来源（docs 有没有撒谎）
node ../skillpress/bin/skillpress.mjs audit             # 上色的闸门：召回率 / 漏色比例
```

> 被 `skillpress.ignore.md` 列上的那份 skill，**门也跳过**（R4）—— 但它每次都会被点名
> "跳过了几份 + 理由"，不是悄悄不见了。站点的首页源**不豁免**：它照过 G2 / G3 / G7（D20）。

## 四、改完做什么

| 改了什么 | 必须跑 | 红了怎么办 |
|---|---|---|
| `skills/**`（任何一份） | `check` | G8 会要你复核体量 → 看过再 `--update-lock <名字>` |
| `skills/**` | 再跑 `press` + 站点重建 | 生成物与源不一致时**别手改生成物** |
| 首页源 `skills/skillpress/WEBSITE.md` | `check` + `press` | 它同样过门（体量 / 路径 / 禁语），改了也要重印 |
| 内容里的代码块 / 程序的 `grammars/**` | `audit` | 闸门是召回率与漏色比例 —— **不许把阈值调松了事** |
| 程序的门与引擎 | 它自己的 `--selftest`，或 `verify` | **先修门**，再让 skill 变绿 |
| 程序的 `SPEC.md` / `SKILLS.md` | 看有没有被引用的路径与 `§` 号（G3 / G6） | 改引用，别改判据本身 |

站点重建（实例在内容侧；它用 `file:` 依赖指向程序）：

```bash
cd skills/skillpress/scripts/.skillpress
npm install && npm run press && npm run build && npm run serve   # → http://127.0.0.1:8123/
node verify.mjs                                     # 委托给程序那份判据
```

> 门存在的唯一理由：**一个说谎的 skill 比没有 skill 更糟**。
> 顺序永远是：**先改事实的家**（moobile 的 `docs/**`），**再改投影**。

## 五、站点怎么长出来

- **首页源是 `skills/skillpress/WEBSITE.md`**（R2；没有它才回退 `SKILL.md`，回退时会**打印**用了哪个）：
  H1 = 站名，首个 `##` 之前 = 首屏引言，**每个 `##` 自动变成顶栏的一栏** ——
  ⚠️ 所以**首页的 `##` 要写成短名**（细则放正文第一句），长标题会把顶栏挤爆。
- 两种分栏，长一样但点下去不一样：

| 写法 | 点那一栏 |
|---|---|
| `## 三、门：八条`（普通分栏） | 换正文，显示这一节 |
| `## [名字](目标)`（**纯链接节**） | **直接渲染那个目标页** —— 目标得是已收录的页（某份 skill 的主文档，或它的子页） |

  ⚠️ 纯链接节的目标**认不出来就报错**（不给你一个静默的死链）；这一节如果还带着正文，
  生成时会提示一句"点它会跳到 X"（正文只在"不跳"时才看得到）。
- **文档区**（顶栏那条「文档 / SKILL」）：内容源是 `skills/**`，左侧树 = skill → 它的 `references/`、`scripts/`。
- 为什么在**构建期**算：运行期的 markdown 渲染规则**过不了 prop 通道**（`rules` 是函数），
  而代码高亮恰恰要靠它；构建期还换来"产物可 diff、可 `--check`"。

管线的内部形状（数据类型、解析边界、两种模式、判据怎么加、上色的坑）见 `references/site-pipeline.md`。

## 六、坑

| 现象 | 真因 | 处置 |
|---|---|---|
| 段落里"文字 + 加粗 + 行内代码"各占一行 | RN 里每个 `Text` 是独立 flex item，铺成兄弟节点就是几行 | 整段嵌进**一个** `Text`（子片段嵌在它里面） |
| 手机上只看得到第一屏 | RN 的 `View` **不滚动**（HTML 靠 `overflow`） | 整栏包 `@html.node("scroll", …)` |
| frontmatter 三字段"突然全没了" | 文件是 CRLF，`(.*)$` 匹配不到行尾的 `\r` | 一律 LF（G2 会拦） |
| "点了要换内容"这条判据永远绿 | 用 `element.click()`，而 `Pressable` 在 web 上走 responder 事件 | 用 CDP 的 `Input.dispatchMouseEvent`（真鼠标） |
| 改了内容源，站点没变 | 忘了重跑 `press` | 跑 `press --check`，它指出第一处差异 |
| 忽略了某份 skill，它照常上桌 | 清单里**名字打错**（忽略静默失效） | 清单里的名字必须是内容根下真有的目录，写错就红 |
| 审计里某个语言的漏色**突然**变多 | tree-sitter 的 `Parser` 是**有状态**的：`setLanguage` 只在按需加载时调一次，最后装载的语言会污染之后所有解析 | **每种语言一个 `Parser`** |
| 文档里的代码块一大片上不了色 | 片段不是合法代码，ERROR 区域里拿不到 capture | 试几种**包装**（函数体 / let / 调用参数…），挑"未上色最少"的那个 |
| 判据"绿着"放过去了 | 一个块都没数到时 `NaN < 阈值` 是 false | **空集合不许算通过**；出口一律 `process.exitCode`，别调 `process.exit()` |
| 「页面上有 X 这条」永远绿 | 判据用的是**整页子串**匹配，被别处一句话蒙过去（实测：首页 CTA「文档 / SKILL →」把顶栏那条蒙绿，而顶栏其实写着「首页」） | 按**元素整条文本**查，且与点击判据**同口径**；"找不到元素"不许退化成跳过（总数也是读数） |

## 七、指针

| 要什么 | 去哪 |
|---|---|
| 投影规范：收录判据 / 结构 / 预算 / 门的逐条判据 | 程序的 `SPEC.md` |
| 集合划分、边界、产出顺序 | 程序的 `SKILLS.md` |
| 漂移账本：文档 ↔ 代码的对账方法与政策 | 程序的 `DRIFT.md` |
| 禁语表 / 已落地能力台账 | 程序的 `claims.txt` ｜ `done-claims.txt` |
| **整套目录形状**（程序 / 内容 / 实例三个根、便携版怎么打） | `references/layout.md` |
| 站点管线内部（数据形状、两种模式、判据怎么加、上色） | `references/site-pipeline.md` |
| 程序本身（**在旁边那个仓库里**，不是本仓库） | `../skillpress/` ｜ 门面 `bin/skillpress.mjs`（子命令都从这儿进） |
| **还没做的 / 计划**（会变，别当契约） | 程序的 `PLAN.md` |
| moobile 的现状 / 分数 / 未做清单 | `docs/STATUS.md`（**唯一来源**，别抄数字） |
