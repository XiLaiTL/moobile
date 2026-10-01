# CHANGELOG

版本策略：`moon.mod` 的**主版本必须是 `0`**（moon CLI 的硬性要求，`1.x` 会被拒）。
破坏性改动抬次版本；修 bug 抬补丁位。发版前必看 `moon package --list`（见 [`CONTRIBUTING.md`](CONTRIBUTING.md) §3）。

---

## 未发布 —— 工具链改用 MoonBit（不影响库的 API 与产物）

- 新增 `tools/mbtools/`（**独立嵌套模块**，不污染库的 `moon.mod`）+ `tools/mb.sh`，
  已迁第一个子命令 `cr-scan`（行尾检查/修复）；`lf_normalize.sh` 已切过去，`tools/cr_scan.py` 退役。
  等价性是**逐行对账**证明的（两边都能 `--mode list`，diff 无输出），并做了证伪测试。
- 顺带修掉两个真问题：排除规则只认精确路径 → 嵌套 `_build/` 里 192 个构建产物被当成候选
  （候选 2531 → 166）；`cr-scan --mode fix` 修完仍返回 1 → `lf_normalize.sh` 在成功修复后报失败。
- 写 MoonBit 请先用 `moon ide doc / peek-def / outline` 查 API，别 grep 标准库。
  详见 [`docs/FINDINGS.md`](docs/FINDINGS.md) R8。

---

## 0.2.2 —— 2026-09（已发布）

**修：0.2.1 的包与它自己的 README 不符 —— 照 README 写的第一行就编不过**

- 0.2.1 里只有 `XiLaiTL/moobile/vendor/rabbita/html`，而 README（**随包发布**、也是 mooncakes
  落地页）让使用者 import `XiLaiTL/moobile/html` → 实测报
  `Cannot find import 'XiLaiTL/moobile/html'`。**已发布版本的 README 是坏的**，这是本次修复的主因。
- 修法**不是**改文档去迁就产物（那会把 `vendor/rabbita/` 漏进使用者的每一行 import），
  而是在模块根补一层**纯转发包**：`html/`、`cmd/`、`sub/`、`http/`。
  由此：README 不用改、**0.2.0 用户的 import 继续有效**（0.2.0 的包本来就是扁平布局）、
  0.2.1 能用的一切照旧 —— 所以这是个**新增**（非破坏）版本。
- 转发包的名字清单**生成**而非手写：`tools/gen_forwarders.py` 从
  `vendor/rabbita/<pkg>/pkg.generated.mbti` 抽（`html` 有 400+ 个名字，而 `pub using`
  **没有通配写法**）。生成物入库，`--check` 可 diff 漂移。
- 顺带更正一条**被写错很久**的结论：R3 说"加一层公开再导出包 → ❌ 类型只能被命名、不能被使用"，
  实测**消费者**通过转发包可以命名 / 调函数 / 字段访问 / **变体匹配**（全 ✅）；
  只有**转发包自己**构造转发来的 struct 会报 `Cannot create values of the read-only type`。
  详见 [`docs/FINDINGS.md`](docs/FINDINGS.md) R7。

**修：registry 上那行 description（对搜"mobile"的人不可见）**

- 原来：`moobile：MoonBit 写 UI，交给 React Native 渲染 —— 跨端 UI 层（内含 rabbita vendor fork）` ——
  重复包名、纯中文（mooncakes 是国际站）、把内部实现摆最前。
- 现在：`MoonBit UI for mobile: Android, iOS and Web from one rabbita (TEA) app, rendered by React Native`，
  keywords 改为 `moonbit, mobile, android, ios, web, cross-platform, react-native, rabbita, UI, TEA`。

**新增两条敢失败的闸门（`verify_all.sh` 现在是离线 8 项）**

- `tools/readme_probe.py`：**README 是契约** —— 解析 README 里的 import 路径，并按 README 的
  `view` / `app` 示例编一遍（workspace 与 registry 两种目标）。之前没有任何检查把"文档"与"产物"对起来。
- `tools/gen_forwarders.py --check`：转发包与 `.mbti` 是否一致（改了 `vendor/**` 忘了重跑就红）。
- `tools/check_published.sh` 默认目标改为**跟随 `moon.mod` 的版本**（原来写死 `@0.2.0`，
  于是发了 0.2.1 之后它还在验 0.2.0 —— 本次缺陷就是这么溜过去的）。

## 0.2.1 —— 2026-09（已发布）

**修：发布产物里的本机路径**

- `README.md` 的本地工作区示例里写着维护者机器的**绝对路径**（一个盘符开头的本机路径），
  而 README 是**随包发布**的 —— 0.1.0 / 0.2.0 的发布 zip 里都带着它。现在换成 `/path/to/moobile` 占位符。
  （审计工具：`tools/check_public_leaks.py`；它现在是 `verify_all.sh` 的第 4 项，
  也被 `npm/moobile-host/publish.sh` 作为发布前的闸门。）
- `tools/env.sh` 里的本机 JDK / AVD 路径改为**可被环境变量覆盖**（不再硬编码）；
  维护者本机专用的两个磁盘迁移脚本移到 `tools/local/` 并加了说明。

**工具：验证闸门从 9 分钟降到 24 秒**

- `tools/lf_normalize.sh` 的 CR 判定原来是**逐文件 fork**（`tr` + `wc`，2539 个候选文件
  ≈ 5000 次进程启动），在 Windows 上单项就要 **260 秒**；而 `vendor_sync.sh --check`
  内部还会再调它一次，所以 `verify_all.sh` 全程 ≈ **9 分钟**。现在扫描逻辑搬进
  `tools/cr_scan.py`（一次进程按字节读），实测 **1 秒**，`verify_all.sh` **24 秒**。
- 中途试过用一次 `grep -lU $'\r'` 代替 —— 快（0.19s）但**是坏的**：
  本机 Git Bash 会把参数里的裸 CR 弄坏，对 0 个 CR 的仓库报出 **2537 个假阳性**。
  所以最终选了按字节读的 Python 实现，并且给检查加了**证伪测试**
  （塞一个 CRLF 诱饵 → 必须点名它）。
- 输出里现在带**候选文件数**：一个"什么都没查"的检查也会报"通过"，
  这个数字是"检查真的在查东西"的证据。详见 [`docs/FINDINGS.md`](docs/FINDINGS.md) R6。

## 0.2.0 —— 2026-09

**破坏性**（升级前请看这一节）

- **`mount` 补齐了 TEA 的另一半**：`update~ : (Model, Msg, Emit[Msg]) -> (Model, Cmd)`，
  并新增 `subscriptions?`。此前 `update` 只能返回 `Model`、也没有订阅 —— 意味着
  "改状态顺便干件事"（读本地库、发请求）与"持续数据流"（传感器、网络状态）**都写不了**。
  这不是风格变化，是能力缺口；`app.mbt` 里那句"签名与 `rabbita.elmish` 对齐"的注释当时是假的。
- **新增 `mount_with_init`**：对齐上游 `create_state_with_init` —— 首帧**之前**要做的命令
  （例如"先从本地库读回清单"）终于有地方放。
- **新增 `handlers()` / `handlers_with_init()`**：返回一张句柄表
  `{contract, start, snapshot, subscribe, element, …}`。
  应用侧的链接导出从 **4 个降到 1 个**（`demo` 现在是 `exports: ["app"]`）。
  依据：`Mount` 是**非泛型**具体类型，泛型只存在于构造那一刻 —— 于是库能替应用把这四个入口包起来。
- **新增 `MOBILE_HOST` 契约版本比对**：库在句柄表里带 `contract`，宿主有 `CONTRACT`，
  不等就**当场报错并说出两个版本号**。

**新增**

- **`sqlite/` 能力包**：本地数据库（宿主侧 `expo-sqlite`）。边界形状是
  **JSON 字符串**（`exec` / `run` / `all`），MoonBit 侧用 `@json` 解；
  缺能力时 `ensure()` 直接 fail-fast 并说明怎么装。
- **`@http` 的 JS 路径首次被真实使用**（Todo 示例的同步链路）。

**仓库结构（对使用者无影响，导入路径不变）**

- 第三方 fork 从**模块根**搬进 **`vendor/rabbita/`**（根目录 44 项 → 24 项）。
  `internal/*` 被**摊平**：`internal` 的可见性只认路径段恰好等于 `internal`，
  所以 `internal/vdom` → `vendor/rabbita/vdom` 之后根包照样能 import。
  （旧结论"必须铺在模块根"已被推翻，实验记录见 `docs/FINDINGS.md` R3。）
- `demo/` → `examples/apps/todo-app/`，并变成**独立模块**（`moon.mod` + 根 `moon.work` 工作区）。
  理由：`moon.mod` 的 import 是**模块粒度**且随发布包走 —— demo 的依赖会变成
  **每个使用者的下载量**（实测：声明了但没人 import 的依赖照样被拉下来；
  `moonorm`+`moondb` = 11 MB，而库自己的发布包 ~200 KB）。
- `host/` → `examples/apps/todo-app/host/`；`server/` → `examples/services/todo-server/`；
  `packages/moobile-host/` → `npm/moobile-host/`；`_tools/` → `tools/`；
  `_r1/` → `docs/evidence/r1/`。
- **发布包更干净**：212 个文件，只含库本体 + `style/` + `sqlite/` + `vendor/rabbita/` +
  三个声明文件。`examples/`、`npm/`、`tools/`、`docs/`、`moon.work`、根上的截图全部排除。
- **`docs/` 按读者分家**：索引（`docs/README.md`）+ `design/`（设计期，含原 `EVIDENCE.md`，
  改名为 `DESIGN-FEASIBILITY.md` 以消掉与 `evidence/` 的命名冲突）+ `plan/`（归档计划）+
  `evidence/r1/`（测量数据）；`ARCHITECTURE.md` 与 `FINDINGS.md` 留在 `docs/` 下便于发现。
- **补齐"大项目标准件"**：`AGENTS.md`（给 AI 代理的须知：本仓库硬性事实与禁区）、
  `.editorconfig`（编辑器级 LF —— fork 用 patch 维护，CRLF 会打乱上下文）、
  `.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md`、`.github/PULL_REQUEST_TEMPLATE.md`。

**工具**

- `tools/verify_all.sh`：一条命令跑完全部离线检查（5 项），`--with-e2e` 追加 Web 端到端（3 项）。
- `tools/verify_web.js`（原 `_verify.js`）：Web UI **27 项**（新增"订阅在跑：心跳自己会涨"）。
- `tools/verify_android.py`：真机 **21 项**，覆盖 新增 / 完成 / 删除 / 离线落库 / 同步。
- `tools/db_probe.js`（8 项）、`tools/sync_probe.js`（14 项）、`tools/console_dump.js`（白屏排查）。
- `tools/check_published.sh`：在临时模块里装 **registry 上那一版**并编译，验"对外真的可用"。
- `tools/vendor_relocate.py`：fork 的布局搬家（两个方向），被 `vendor_sync.sh` 调用。
- `tools/check_links.py`：检查所有 Markdown 的**相对链接**是否指得到东西
  —— 文档搬家最容易留下的坑（GitHub 上 404，本地看不出来）。已接进 `verify_all.sh`。
- `tools/verify_all.sh` 现在是**离线 7 项**：编译 / 行尾 / 文档链接 / **公开内容无本机路径与凭据** /
  vendor 一致 / 外部模块 / 注册表一致。
- `tools/check_public_leaks.py`：扫本机绝对路径、用户名、凭据（zip/tgz 产物也能扫）。
  之所以有这个工具：README 曾把维护者的绝对路径带进**已发布**的 0.1.0/0.2.0。

---

## 0.1.0 —— 2026-09 首发

- 首个发布版：rabbita 的 React 后端（vendor fork，Apache-2.0）+ 类型化样式层 `style/`。
- 应用侧导出四件套（`start` / `snapshot` / `subscribe` / `element`），
  宿主侧手写 `MOBILE_HOST` 与根组件（约 40 行）。
- 验证：Web 端到端 26 项、真机（Android 14 模拟器）通过、R1 文本排版判决通过。
