# CHANGELOG

版本策略：`moon.mod` 的**主版本必须是 `0`**（moon CLI 的硬性要求，`1.x` 会被拒）。
破坏性改动抬次版本；修 bug 抬补丁位。发版前必看 `moon package --list`（见 [`CONTRIBUTING.md`](CONTRIBUTING.md) §3）。

---

## 0.2.1 —— 2026-09（未发布，待 `moon publish`）

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
