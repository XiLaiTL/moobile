---
title: 站点管线：内容怎么变成页面
description: gen-content 的数据形状、markdown 的解析边界（H1/H2 的用途）、首页与文档两种模式的状态机、站点判据怎么加一条、构建与预览的命令、构建期上色怎么做的。
---

# 站点管线：内容怎么变成页面

**什么时候读它**：你要动站点**界面**（界面在**程序包**里 —— `../../../skillpress/shell/site.mbt`；
实例那一侧只剩接线：`../../../scripts/.skillpress/app.mbt`）、动内容管线
（程序里的 `engine/content/generate.mbt`，旧版是 `lib/gen-content.mjs`，现在它是**对账的参照实现**）、
加一条站点判据（`lib/verify-site.mjs`，还没搬进 MoonBit），
或者遇到"改了内容源但站点没变"的时候。主文档只留了"三道命令"，细则在这儿。

## 一、数据形状（内容包只有数据，渲染在界面包里）

内容管线把 markdown 编成**站点**的 `content/content.generated.mbt`（**生成物，别手改**）：

| 类型 | 是什么 | 从哪来 |
|---|---|---|
| `Span` | 一段行内内容：`Txt` / `Code` / `Bold` | 内联只认这三种写法（见 §二） |
| `Block` | 正文里的一块：标题 / 段落 / 列表 / 表格 / 代码块 / 引用 / 分隔线 | 逐块解析 |
| `Code(lang, text, runs)` | 代码块 + **高亮片段**（`runs` = 若干 `(文本, 色号)`，拼回去逐字节等于 `text`） | tree-sitter（见 §六） |
| `Section` | 首页的一个**分栏** = `skills/skillpress/SKILL.md` 里的一个 `##` | `title` + `blocks` + `link`（见 §三） |
| `Home` | 首页：`title`（H1）+ `lede`（首个 `##` 之前）+ `sections` | `skills/skillpress/SKILL.md` |
| `Kid` | 子页：某个 skill 的 `references/*.md`、`FAQ.md` 或 `scripts/*` | 侧栏树的第二层 |
| `Doc` | 一份 skill：`slug` / `desc` / `full_desc` / `when` / `blocks` / `kids` | `skills/<name>/` |

三个入口：`@content.home()`（首页）、`@content.skills()`（文档区，按 slug 排序 ⇒ 生成物稳定）、
`@content.find_page(key)`（**页面键 → `(kind, 下标, 子页下标)`**，给纯链接节用；认不出给 `(-1,-1,-1)`）。
页面键的形状（主文档 = `<slug>`、子页 = `<slug>/<kind>/<name>`）在生成器与生成物**两侧各写一次**，
改一边必须改另一边 —— 它们靠这段注释对账。

## 二、markdown 的解析边界（刻意的窄）

**只支持内容源里实际用到的构造**：标题 / 段落 / 两级列表 / 表格 / 围栏代码块 / 引用 / 分隔线；
内联只认 `` `code` `` / `**bold**` / 链接。遇到不认识的构造（图片、原始 HTML）**逐条点名报错**，
不静默丢内容 —— 跟 moobile 学的"解不开的必须看得见"。生成器报错时 `--check` 也一起红。

三条会咬人的规矩：

- **`#` 不进正文**：H1 被抽成 `title`（页眉的站名与首屏大标题都用它），不当块。
- **`##` 就是分栏的边界**：顶栏有几条**完全由首页那份 skill 决定** ⇒ 它的 `##` 要写成**短名**
  （细则放正文第一句），7 个长标题会把顶栏挤爆。`###` / `####` 留在所属分栏的 `blocks` 里。
- **链接按"台词"渲染**：这是静态阅读页，没有路由。**链接文字与目标相同时只留一份**
  （指 `SPEC.md` 那种写法就是这一类）；否则渲染成"文字 + 代码样式的路径"。

## 三、两种模式（状态机很小，但两条通道别混）

`Model` 四个字段：`mode`（0 = 首页，1 = 文档）、`sec`（首页选中第几栏，`-1` = 首屏）、
`sel`（文档区选中的页）、`open`（树里哪几个 skill 是展开的）。`Msg` 四种：

| Msg | 谁发 |
|---|---|
| `Top(i)` | 顶栏的分栏（`-1` = 首页那条） |
| `Docs` | 顶栏同一排最右那一栏（换模式） |
| `Go(kind, i, k)` | 文档区的 skill / 子页；**纯链接节**也发它（见下） |
| `Toggle(i)` | 树上的 `▸ / ▾` |

**「文档 / SKILL」和别的分栏长一样**（D2）：顶栏是**一行** —— 左边站名、右边一排分段控件，
「文档」就是最右那一栏，只差一条竖细线。它换的是**整个模式**（分栏只是"看哪一节"），
但形态上不再单独做成实心按钮。

### 纯链接节（D3）：`## [名字](目标)`

节的标题**整条是一个链接**时，点那一栏不是"换正文"，而是**直接渲染目标文件**：

- 生成期把目标按"首页那份 skill 的目录"解析成**页面键**，写进 `Section.link`；
  认得出来才算是纯链接节，**认不出来就报错**（不给静默的死链）。
- 应用侧 `top_msg()` 把键经 `@content.find_page()` 换成 `Go(kind, i, k)`；换不出来就退回普通分栏。
- 判定刻意**严**：只有 `[名字](目标)` 占满整条标题才算 —— 节的正文里有链接**不算**
  （那是普通分栏，点它只换正文）。
- 这一节若还带着正文块，生成器会提示一句"点它会跳到 X"（正文只在"不跳"时才看得到）。
- 判据：`verify-site.mjs` 会从**目标文件**里现取一句真话，点那一栏后断言它出现
  （同时钉住"跳对了页"与"渲染的是那份文件"）。

## 四、站点判据（`verify-site.mjs`）

判据清单的**家**是那个脚本的文件头（一张表：每条断言抓哪个失败模式）。要加一条就照那个风格写，
并且**必须能区分"做了"与"没做"**：只验"渲出来了"抓不到"点了没反应"。

几条硬规矩（踩出来的）：

- 点击一律走 **CDP 真鼠标**（`Input.dispatchMouseEvent`）—— `Pressable` 在 web 上走 responder 事件，
  合成 `click()` 不一定触发，那样判据会变成**永远绿**。
- **端口动态挑**：写死端口会撞上"机器上已经有一个同端口在跑"，于是判据测的是**别人那个服务**。
- Chrome 的 **stderr 必须留着**：CDP 连不上时，真正的原因只在 Chrome 自己的话里。
- 探针文字从**内容源**现算（首页从那份 SKILL.md 取，skill 从 frontmatter 取），不写死在脚本里。
- 判"两个模式分开了"**不能**用"skill 名一个都没露"：首页本身就是一份 skill，
  正文里出现 `skills/skillpress/` 是应该的 ⇒ 改成认**侧栏那个容器**在不在（底色 `#eae3d5`）。

## 五、构建与预览

```bash
node ../skillpress/bin/skillpress.mjs press --check       # 生成物与源一致吗（门）
node ../skillpress/bin/skillpress.mjs audit               # 上色的闸门
cd skills/skillpress/scripts/.skillpress
npm install && npm run build && npm run serve             # → http://127.0.0.1:8123/
node verify.mjs                                           # 委托给程序那份判据
```

`npm run build` 三步各自的意义、以及 `--host webview` 这个宿主的取舍，见那份 README。
`dist` 是全部基础设施：一个字都改不动的时候，先删掉它重编一次，再看是不是缓存的旧产物。

## 六、代码上色（构建期，tree-sitter）

**为什么不是编辑器那两套**：`moon-lsp` 的语义 token legend 只有 `function_call` / `function_decl`
（且对真文件返回空数组）—— 它是给 hover / 定义 / 重命名 用的；TextMate（tmLanguage）能上色，
但那是 10 KB 正则汤、不建树，而"大纲 / 折叠 / 搜索"要的正是树。

**形状**：上色引擎在程序包里（`engine/highlight/hl.mbt`；旧版是 `lib/highlight.mjs`，
现在是对账的参照实现）+ `grammars`（vendor 的 wasm 与 `highlights.scm`，
出处与 sha256 见那份 `PROVENANCE.md`）。`web-tree-sitter` 是这台引擎**唯一**的 npm 依赖。

**两条硬规矩**：色号两头对齐（程序的 `engine/highlight/hl.mbt` 里的 `PALETTE` ↔ 界面包里
`shell/blocks.mbt` 的 `tok_color`，改要一起改）；
**拼回原文**（颜色逐字符贴，`highlight()` 硬断言"拼回去逐字节等于原文"，否则抛错）。

**片段是常态，所以有"包装候选"**：文档里的代码块大多不是合法代码（顶层裸表达式最常见），
tree-sitter 会给出 ERROR 节点，而 **ERROR 里的东西一个 capture 都拿不到**（实测裸解析的字符串召回
只有 12%）。解法是每种包装试一遍（函数体 / let 绑定 / 调用参数 / 数组元素 / struct 字段 / match 分支…），
取"未上色的非空白字符最少"的那个 —— 召回 66.7% → 93.3%。

⚠️ **一个安静得可怕的坑**：tree-sitter 的 `Parser` 是**有状态**的。按需加载语言时只 `setLanguage`
一次，于是"最后装载的语言"会污染之后所有解析：审计里 moonbit 的漏色从 106 变 425，页面照常渲染。
**每种语言一个 `Parser`**。

**闸门**：`highlight.mjs --audit` 用纯正则数出"必须上色的词法元素"（关键字 / 字符串 / 注释 / 数字），
报召回率与漏色比例，越线即红。当前实测：**召回 96.8%，漏色 21.3%**
（漏色里大头是 bash 的普通参数与路径 —— 编辑器也不给它们上色）。

## 七、已知的边界（别当成已覆盖）

- **没配语法的标记按原文渲染**：内容是允许出现别的语言的（`highlight.mjs` 里 `LANGS` 加一行即可支持）。
- **bash 的普通参数 / 路径不上色**：它的 `highlights.scm` 只标命令名、字符串、注释、变量 —— 与编辑器一致。
- **内容里的 fence 标错语言，会被"染错"而不是报错**：实测 moobile README 里有个 ```moonbit 块其实
  是 `moon.pkg`（TOML）。这类要**改家**（把 fence 改成 `toml`），不是改投影。
- **锚点 / 目录 / 搜索没做**：它们该在**生成期**算好；语法树已经在手上，是下一步的原料。
- **只有 `references/` 与 `scripts/` 会渲成子页**：`_meta.json` 只进打包，不上站点。
- **宽屏优先**：顶栏那条分段控件在窄屏上会挤，还没做折叠菜单。
- ⚠️ **顶栏的"吸顶"还没落地，但修法已查明（一行 CSS）**：样式层里没有 `sticky`
  （`style/style.mbt` 文件头：`position:sticky` 连构造器都没有），只能靠结构（顶栏在滚动容器外）。
  根因在**宿主**：`index.html` 的 `#root` 是 `display:block`，而应用的根是 `flex: 1 1 0%` 的弹性项
  —— 弹性项在块盒里没有可分配的 flex 空间，直接长到内容高 ⇒ 正文那个 `scroll` 容器被撑满
  ⇒ 只能滚整个 document ⇒ 顶栏跟着走。实测：给 `#root` 加
  `display:flex; flex-direction:column; height:100%; min-height:0` 之后，
  滚动容器高度从 3435 变 490、整页可滚从 2945 变 0、滚 window 时顶栏 **不动**。
  完整的实测数据与两条弯路记在 `PLAN.md` 的 P2 一节。
