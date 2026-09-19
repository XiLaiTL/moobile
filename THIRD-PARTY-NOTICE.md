# THIRD-PARTY-NOTICE —— 第三方代码与署名

本模块（`XiLaiTL/moobile`）**内含**一个第三方库的 fork。按 Apache-2.0 §4 的要求，
这里保留其版权与许可声明，并声明我们做过修改。

---

## 1. rabbita（主要第三方）

| 项 | 内容 |
|---|---|
| 项目 | **rabbita** —— MoonBit 的声明式 UI 框架（Elm / Bonsai 风格的 TEA） |
| 来源 | <https://github.com/moonbit-community/rabbita> |
| 我们 vendor 的版本 | **0.15.4**（注册表制品；见 `_tools/vendor.lock`） |
| 许可 | **Apache License 2.0**（上游仓库根目录的 `LICENSE`；上游未附 `NOTICE` 文件） |
| 版权 | 归 rabbita 的作者与贡献者所有（moonbit-community） |

### 我们改了什么

**改动清单与逐条理由见 [`FORK.md`](FORK.md)**；机器可读的版本是
[`_tools/patches/`](_tools/patches) 里的 15 个 patch（共约 983 行），
`bash _tools/vendor_sync.sh --check` 可以验证「工作区 == 上游 0.15.4 + 这些 patch」。

一句话概括：把渲染后端从 DOM 换成 React（React Native / react-native-web），
因此需要把 `Event` 从 `@dom.Event` 解耦、把 `Props.styles` 从 `Map[String, String]`
加宽成类型化的 `StyleValue`、并把事件解码做成可替换的查表。

### 分发形态

- **源码分发**：本仓库**不含** rabbita 的代码（第三方目录在 `.gitignore` 里），
  由 `_tools/vendor_sync.sh` 从注册表拉取指定版本再打 patch 生成。
- **制品分发**：`moon package` 打出的包**包含** fork 后的 rabbita 源码
  （消费者需要它才能编译），该部分仍是 Apache-2.0。

---

## 2. 其它依赖

| 依赖 | 用途 | 许可 |
|---|---|---|
| `moonbitlang/async` | 异步运行时（rabbita 的 `js_async` 等） | 见其仓库 |
| ~~`moonbitlang/x`~~ | **已不再是依赖**（2026-09）：它只被 `server/` 用，而 `server/` 已裁掉 | — |
| ~~`hackwaly/moonback`~~ | **已不再是依赖**（2026-09）：同上，只被 `server/` 用 | — |

> 依赖的许可条款以其各自仓库为准；这里只做索引，不复制其文本。

---

## 3. 我们自己的代码

本模块除 fork 部分外的代码（模块根包的 `host.mbt` / `render.mbt` / `app.mbt` /
`store.mbt` / `schedule.mbt`、`style/`、`demo/`、`host/`、`_tools/` 等）
采用 **Apache License 2.0**，版权归 `XiLaiTL`（见 [`LICENSE`](LICENSE)）。
