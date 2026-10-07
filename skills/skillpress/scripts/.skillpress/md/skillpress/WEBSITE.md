# skillpress —— 把一堆 skill 印成一个站点

**只解决一件事**：把仓库里那批 skill（`skills/<名字>/SKILL.md` 与它的 `references/`）印成一个能读的
站点 —— 顶栏是首页的分栏，**书架**是那批 skill，点进去就是**文档区**。
下面三条都在这份仓库的根上跑，而**程序是它旁边的兄弟**（`../skillpress/`，它自己是一个 git 仓库）：

```bash
node ../skillpress/bin/skillpress.mjs check      # 门：skill 自己（G1–G8）
node ../skillpress/bin/skillpress.mjs press      # 内容源 → 站点内容包
node ../skillpress/bin/skillpress.mjs verify     # 判据：真 Chrome 无头，自起静态服务
```

> 三个根别混：**程序**在旁边的 `../skillpress/`（引擎 + 门 + 语法资产）；
> **内容**是 `skills/**` —— 站点的**唯一内容源**；**站点实例**在
> `skills/skillpress/scripts/.skillpress/`（一个"**用**程序"的 MoonBit 工程：
> 界面在程序包里，这里只接线）。整套形状见 `skills/skillpress/references/layout.md`。
>
> 中间那条最容易漏：**改了任何内容源就必须重跑 `press`**，否则站点还是旧内容 ——
> `press --check` 会红，并指出**第一处差异**。

## 一、站点的形状

顶栏分两段：左边是**首页 + 首页的每个 `##`**（点一下换一栏正文），右边一条「文档 / SKILL」切进**书架**；
书架的内容源就是 `skills/**`，左侧那棵树是一份 skill → 它的 `references/`、`scripts/`。

渲染**在构建期就算完了**：产物是一份 MoonBit 文件
（`skills/skillpress/scripts/.skillpress/content/content.generated.mbt`），运行期只做显示。
所以"站点到底变没变"是**能查的** —— 那份产物可 diff、可 `--check`，不必靠眼睛看。

## 二、书架上有什么

七份 skill 里**六份**上桌，`skillpress` 自己那份**不上** —— 它是这套工具自己的说明书
（讲怎么写一份 skill、怎么跑那几道门），读者是**改内容的人**，不是来看站点的人。

不上桌这件事写在仓库根的 `skillpress.ignore.md` 里，**每条都必须带理由**（没写理由就红）：
忽略是"把东西藏起来"的机制，它坏掉的样子是**不报错**的 —— 所以每次跑门或生成，
都会把"跳过了几份 + 逐条理由"打出来。

## [从哪一份开始](../moobile-app-development/SKILL.md)

> 这一栏是**纯链接节**（标题本身是一个链接）：点它不会换一栏正文，而是**直接渲染那个目标页**。
> 目标是书架上的 `moobile-app-development` —— 六份里该先读的那一份。

## 四、去哪看

- [moobile-app-development](../moobile-app-development/SKILL.md)
- [moobile-custom-component](../moobile-custom-component/SKILL.md)
- [moobile-library-development](../moobile-library-development/SKILL.md)
- [moobile-pitfalls](../moobile-pitfalls/SKILL.md)

上面这个列表每一项**整条是一个链接**、目标都是已收录的页 ⇒ 它就是这一栏的**下拉菜单**
（鼠标悬停出来，触摸点一下展开）。两处特判（纯链接节 / 下拉菜单）的判据写在
`skills/skillpress/references/site-pipeline.md` 里。

## 五、门与判据

站点的每一处形状都有判据盯着，而不是"看着对"：`check` 管 skill 自己
（G1–G8：frontmatter / 体量 / 行尾 / 路径 / 脚本 / 禁语 / 指纹），`verify` 管**渲染出来的真页面**
（22 条：顶栏、书架、点进子页、代码块与内容源逐字一致、吸顶、控制台无 error）。

> 门存在的唯一理由：**一个说谎的 skill 比没有 skill 更糟**。顺序永远是
> **先改事实的家**（moobile 的 `docs/**`），**再改投影**。
