# CONTRIBUTING —— 怎么改这个仓库

给三类人看的三件事：**怎么跑起来**（[`DEV.md`](DEV.md)）、**怎么验证**（下面第一节）、
**写东西的规矩**（第二节）。第一类只有一条命令，先记住它。

---

## 1. 改完必须跑什么

```bash
bash tools/verify_all.sh              # 离线 15 项（清单见 AGENTS.md §2；分数见 docs/STATUS.md）
bash tools/verify_all.sh --with-e2e   # 再加 Web 端到端 3 项（需要 Metro + 后端）
python3 tools/verify_android.py       # 真机 27 项（需要模拟器 + APK，不进 CI；当前 25/27）
```

**改了哪一块，至少跑哪几项**：

| 你改了什么 | 必须跑 |
|---|---|
| 库本体（根包 / `style/` / `sqlite/`） | `verify_all.sh`；动了渲染路径再加 `--with-e2e` |
| `vendor/rabbita/**`（fork 代码） | **先 `tools/vendor_sync.sh --capture`，再 `--check`** —— 第三方目录是 gitignore 的，`git status` 不会提醒你漏了回写 |
| 重建第三方（新克隆 / 换版本） | `tools/vendor_sync.sh --apply` → `verify_all.sh` 全跑 |
| demo / 宿主（`examples/**`） | `--with-e2e`；动了原生侧再加 `verify_android.py` |
| **模板（`examples/apps/template/`）或生成器（`npm/moobile-host/lib/**`）** | `node tools/template_check.mjs` + `node tools/scaffold_probe.mjs`（`verify_all.sh` 里那两条门就是它们）。**模板是"用户会拿到什么"的唯一真源**，改它必须让这两条门全绿 —— 生成物编不过、跑不起来、名字没换干净，都在这里红 |
| **demo（`examples/apps/todo-app/`）或 `tools/template/deltas.txt`** | `node tools/template_compare.mjs`（T1：生成物与 demo 的差异逐条对着清单判）。**模板与 demo 是"同源"关系**，改任何一边都可能让两边漂开 —— 漂了就红。⚠️ 加一条清单**不是**"修好"：先问那处差异是不是真该存在（清单越长说明这条路越没走通）。改了比对器本身再加跑 `bash tools/template_compare_falsify.sh` |
| **宿主 npm 包（`npm/moobile-host/**`）** | `bash tools/verify_all.sh`（里面有"副本新鲜度"与"注册表一致性"两条）+ **`node examples/apps/host-swap-spike/verify.mjs`** —— 后者是 C0 那条实测：换掉宿主（零 Expo）之后，同一份产物还能不能渲染 + 交互（要 Chrome 与该目录的 `npm install`） |
| **宿主 npm 包要发版** | `bash npm/moobile-host/publish.sh --dry-run`（打包自检：`files` 白名单 + **包内模板齐全** + **打包形态自检**（真装一遍、用装好的 CLI 生成一个项目）；泄漏自检）。⚠️ `.gitignore` 这条踩过两次：`files` 里**必须单独列** `template/.gitignore`（不列，tarball 里一个 ignore 文件都没有），而**列了也不够** —— `npm install` 解包时会把它**改名成 `.npmignore`**，所以最后能不能到用户手里取决于 `init`（它现在负责还原）。详见 [`docs/FINDINGS.md`](docs/FINDINGS.md) 的 2026-09-21 补记 |
| 准备发版 | 下面 §3 |

---

## 2. 写东西的规矩（负面清单为主）

这个仓库的文档问题历来是"读起来像聊天记录"：结论先行、没有证据链、口语与 emoji 混用。
所以规矩尽量写成"**不要做什么**"：

**不要**

- 不要写"已对齐 / 已验证 / 应该没问题"——**除非同一条里给了可复现的命令或输出**。
  反例：`app.mbt` 里曾长期写着一句"签名与 `rabbita.elmish` 对齐"，而实际上 `update`
  既不返回 `Cmd` 也没有 `subscriptions?`。假注释的危害是**迁移者最先读到它**。
- 不要把"没做过"说成"做过"。没有证据就写"未实测 / 未查证"，并说清怎么才能测。
- 不要只写机制不写**为什么**。例如"fork 铺在 `vendor/rabbita/`"要带上原因
  （`internal` 的可见性只认路径段）与**被推翻的旧结论**。
- 不要在文档里贴没有上下文的大段代码。要贴就贴"能直接跑"的，或"被测过的那几行"。
- 不要用 emoji 当标题的装饰；它们只用来标**状态**（✅ 已落地 / 🟡 部分 / ❌ 不可行）。
- **不要把"我们的验收进度"写进 `README.md`**：它是**使用者**的第一屏（也是 mooncakes 与 npm 的落地页），
  只该回答"这是什么 / 给谁用 / 怎么装 / 代码长什么样"。门数、分数、`R2` 这类编号、内部项目名
  一律写在 `PLAN.md`（进度快照）与 `docs/FINDINGS.md`（实测）。
  这条是**踩过才写的**：README 曾有一整段"四道门全绿：27/27、14/14…"，几周后就过期了
  （真机早就是 21/21），既误导使用者又暴露内部节奏。
- 不要把计划写成愿望清单：每条要有**判据**（成功长什么样、怎么验）。

**要**

- 内部文档（`PLAN.md` / `DEV.md` / `FORK.md` / `docs/**`）用中文；对外（`README.md` 首屏、
  npm 包的 README、registry 描述）中英兼顾。
- 踩过的坑写进 [`docs/FINDINGS.md`](docs/FINDINGS.md)，**带上真因与解法**，不要只写现象。
- 断言的粒度要**能抓住设计错误**。例子：同步链路那条"新条目必须是**负 id** 且 `dirty = 1`"
  抓出了一个真 bug（新条目被算成正 id，于是被当成"服务器已有的行"去 PATCH，404）。
  如果只断言"界面上多了一条"，这个 bug 会漏到线上。
- 文档结构见 [`docs/README.md`](docs/README.md)（使用者 / 贡献者 / 维护者三类）。

---

## 3. 发版

```bash
# 0) 先过泄漏闸门：本机绝对路径 / 凭据绝不能进包（README 曾把维护者路径带进已发布的包里）
bash tools/py.sh tools/check_public_leaks.py
#    npm 包那边 publish.sh 会自动跑这一步

# 0.5) 打包，并**拿打出来的那份**验 README 的快速上手（这一步必须重打，不要用旧 zip）
moon package --list                                  # 出 zip：_build/publish/<模块>-<版本>.zip
bash tools/py.sh tools/readme_probe.py --zip _build/publish/XiLaiTL-moobile-<版本>.zip
#    为什么要有这一步：0.2.1 发出去之后才发现，随包发布的 README 让使用者 import
#    `XiLaiTL/moobile/html`，而那份包里根本没有这个包 —— 照 README 写的第一行就编不过。
#    发出去不可撤回，所以**打包后、发布前**必须先自己当一次使用者。

# 1) 月亮包（mooncakes）
moon publish

# 2) npm 宿主包（注意：本机默认 registry 是只读镜像，必须显式指向官方；账号开了 2FA 还要 OTP）
bash npm/moobile-host/publish.sh <6位码>

# 3) 发完从"用户视角"验一遍（默认验 moon.mod 里那一版）
bash tools/check_published.sh
```

**发布前必看**（发布不可逆）：

```bash
moon package --list     # 它会把要发的文件全列出来，也会真的写出 zip
```

⚠️ 这条清单**救过一次**：重写 `.moonignore` 时漏了 `/*.png`，三张 70 KB 的截图当场混进发布包；
发出去就收不回来了。同理 `moon.work` 这类开发用文件也要排除。

版本约定：`moon.mod` 的主版本必须是 `0`（CLI 硬性要求）；破坏性改动抬到下一个次版本
（0.1 → 0.2 就是 `mount` 签名 + 单导出那一次），见 [`CHANGELOG.md`](CHANGELOG.md)。
