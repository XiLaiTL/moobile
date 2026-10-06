# 站点实例 —— 一个「用 skillpress」的 MoonBit 工程

这里是**这一份内容的站点**：顶栏 = 首页那份 skill 的分栏，右侧那条「文档 / SKILL」切进带侧栏树的文档区，
内容源是同仓库的 `skills/`（7 份 skill 全在里面）。

⚠️ **界面不在这里**（P6 起）：顶栏 / 分栏下拉 / 侧栏树 / 正文渲染整套住在包
`XiLaiTL/skillpress/shell` 里。本目录的 `app.mbt` 只剩**接线**（把 `content` 包交给 `@shell.site`）。

角色分工（三个根，细则见那份 skill 的 `references/layout.md`）：

| 根 | 在哪 |
|---|---|
| **程序**（引擎 + 界面包 + 门 + 语法资产） | 旁边的兄弟仓库 `../skillpress/`（`SKILLPRESS_ENGINE` 默认就指向它） |
| **内容**（7 份 skill） | `skills/` —— 本实例就在其中那份 skill 的 `scripts/` 里 |
| **实例**（本目录） | 一个"用程序"的 MoonBit 工程：**接线 + 宿主** + 生成物 |

## 与程序的三层接线（P6 起，缺一层都编不过）

| 层 | 在哪 | 是什么 |
|---|---|---|
| **模块依赖** | `moon.mod` 的 `XiLaiTL/skillpress@0.1.0` | 声明"本工程用 skillpress"（发布后从 registry 解析） |
| **工作区** | `moon.work`（成员 `["." , "../../../../../skillpress"]`） | 未发布时**吃本地源码**：两个仓库是兄弟，相对路径即可（同 `verify.mjs` / `package.json` 的约定） |
| **包依赖** | `moon.pkg` 的 `XiLaiTL/skillpress/shell` @shell<br>`content/moon.pkg` 的同一个包 | `app.mbt` 调 `@shell.site(...)`；生成物里每个构造器都带 `@shell.` 前缀 ⇒ 内容包也得 import 它 |

## 四条命令

```bash
npm run press        # 内容源 → content/（**新引擎**：`<程序>/tools/press.mjs`；`press:check` 是门）
npm install          # esbuild / react / react-dom / react-native-web / moobile-host(file:)
npm run build        # moon build --target js → moobile-host build → esbuild → dist/
npm run serve        # 零依赖静态服务 → http://127.0.0.1:8123/
node verify.mjs      # 判据：**委托**给程序那份（真 Chrome 无头 + 自起服务，22 条）
```

`press` 为什么换了实现：旧引擎（Node，`lib/gen-content.mjs`）现在是**真相的参照实现** ——
它印出来的那份冻在程序的 `tools/baseline/`，给新引擎（MoonBit，`cmd/skillpress`）对账
（`tools/file-parity.sh`）。往**实例**里写产物的日常路径因此换成 `tools/press.mjs`。
⚠️ 别拿旧的 `node ../skillpress/bin/skillpress.mjs press` 往这里写：它吐的是**旧形状**
（类型声明 + 裸构造器），一写就把本工程编挂。

## 目录

| 路径 | 是什么 |
|---|---|
| `app.mbt` | **接线**：把 `@content.home()` / `@content.skills()` / `@content.find_page` 交给 `@shell.site`（≤20 行，判据 A2 量它） |
| `content/` | **生成物**：内容的值（`Home` / `Section` / `Doc` / `Kid` / `Block` / `Span` 的**类型**在 `@shell` 里），别手改 |
| `moon.work` | 工作区：让本工程吃本地源码而不是已发布的包（见上表） |
| `index.html` / `index.js` / `App.js` | 静态宿主三件（`#root` + `AppRegistry`） |
| `build-web.mjs` / `serve-web.mjs` | esbuild 打包（一行 `alias`：`react-native` → `react-native-web`）／30 行零依赖服务 |
| `moon.mod` / `moon.pkg` | 独立模块：应用不塞进库模块，依赖按模块粒度解析 |
| `verify.mjs` | 判据入口：**spawn 程序里那份** `lib/verify-site.mjs`（不重写一套，免得两边漂） |

## 诚实清单

1. ✅ **界面已抽成包**（P6 完成）：整套界面住 `XiLaiTL/skillpress/shell`，本目录 `app.mbt` 只剩接线。
   判据在程序那边：`tools/acceptance.sh` 的 A2 量"`app.mbt` ≤20 行 + `moon.mod` 直接依赖 + 没有界面副本"。
   ⚠️ 但"吃本地源码"要靠上面的 `moon.work`（**未发布**时才需要）；包一发到 registry，那份工作区文件就可以删。
2. `verify.mjs` 在**找不到程序**时会 **SKIP**（本目录可以被单独拿走）；真门在程序那边。
3. 打的是 **dev 模式** bundle（约 6 MB，大头是 react-native-web）；上生产要换 `NODE_ENV=production` + `minify`。
4. **锚点 / 目录 / 搜索还没做**（语法树已经在手上）；**窄屏没做折叠菜单**。
5. 产物（`node_modules/`、`_build/`、`dist/`、`moobile.js`）都在 `.gitignore` 里；
   只有 `content/content.generated.mbt` **要进仓库**（本工程得能独立编译）。
6. 本目录同时是 moobile 脚手架模板的**真源**（`moon.mod` 里那句注释）：给模板加"依赖 skillpress"
   这件事还没做 —— 模板目前生成的工程不会有 `shell` 那三层接线。
