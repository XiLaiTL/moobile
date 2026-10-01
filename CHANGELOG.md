# CHANGELOG

版本策略：`moon.mod` 的**主版本必须是 `0`**（moon CLI 的硬性要求，`1.x` 会被拒）。
破坏性改动抬次版本；修 bug 抬补丁位。发版前必看 `moon package --list`（见 [`CONTRIBUTING.md`](CONTRIBUTING.md) §3）。

---

## 未发布 —— canvas 通道（`<canvas>` 的平台替代物）

**新能力：`<canvas>` 在原生端画得出来了 —— 走的是既有组件通道，不是新通道**

```moonbit
let ctx = @canvas.OpCtx::new()
ctx.set_fill_style("#f6efe0")
ctx.fill_rect(0.0, 0.0, 720.0, 720.0)
ctx.set_stroke_style("#b8902f")
ctx.begin_path()
ctx.arc(360.0, 360.0, 300.0, 0.0, 2.0 * @math.pi)
ctx.stroke()
@canvas.canvas(ctx.take(), 720.0, 720.0)
```

- **新包 `XiLaiTL/moobile/canvas`**：18 条有界绘制指令（`DrawOp`）+ 收集器 `OpCtx` +
  `canvas()` 节点。指令集是**量出来的**：`interest/yi` 的罗盘恰好用 18 种 canvas 调用。
  `OpCtx` 的方法名与 DOM 的 `CanvasRenderingContext2D` 逐字相同，
  所以 `@dom.CanvasRenderingContext2D` → `@canvas.OpCtx` 是**换类型**，绘制代码一行不用改。
- **载荷走既有 `prop_json` 通道**（组件通道），序列化成紧凑数组 JSON。
  六十四卦那一档实测 5335 条 op / 181 KB（比对象编码省 31%）。
- **宿主侧 `moobile-host/canvas-ops`（纯翻译器）与 `moobile-host/canvas-skia`（React 桥）**：
  指令列表 → Skia 元素树 → `<Canvas>`。**宿主包不依赖 Skia**（它带 reanimated + worklets
  两个原生依赖），由应用 `import` 进来传给 `registerSkiaCanvas({ skia })`。
- 判据：`examples/apps/canvas-spike/` 的 32 项（含**跨语言对账**：MoonBit 编出来的载荷与
  JS 镜像程序**逐字节相同**，两份载荷各自过真 Skia 出图**像素逐点相同**）。
  用真 Skia（CanvasKit）渲染 yi 的六十四卦罗盘，**384 个采样点**的颜色逐一等于卦爻数据推出的颜色。
- ⚠️ **真机未验**：`<Canvas>` 的组件挂载与文字字形还没在真机上跑过（要 `expo prebuild` + 重建 APK）。

---

## 未发布 —— 第三方 React 组件库接入（**契约 `1 → 2`，破坏性**）

**新能力：React 生态的组件库能当 moobile 的标签用**

```moonbit
@html.node("antd:Button", @html.Attrs::build()
  .prop_str("type", "primary")
  .prop_bool("danger", true)
  .on_click(_ => emit(Bump)), "加一条")
```

- **标签命名空间直通**（`库名:组件名`）：`map_tag` 变三档 —— 命中原 42 条表 → 老行为；
  **含冒号** → 原样直通给宿主组件注册表；其余 → 回落 `View` + 计数（迁移诊断不变）。
  写错名字或库没装**在启动时点名报错**（列出已注册的名字），不再回落成空盒子。
- **通用 prop 通道**（vendor `html/attrs.mbt`，落进 patch 01）：新增
  `prop_str` / `prop_bool` / `prop_int` / `prop_num` / `prop_json` 五个公开方法。
  此前 `attribute`/`property` 是**包内私有**，于是 `danger` / `loading` / `columns`
  这类组件库词汇一个都传不进去。结构化值走 **JSON 文本**，由宿主按 `jsonProps` 白名单解析。
- **事件落点改由宿主决定**（三级优先：精确标签 → `库:*` → `*` → 默认表）。
  顺带修掉一个真 bug：兜底从 `"on" + event` 改成 camelCase —— 原来的 `onchange` 被 React
  **明确拒绝**（`Invalid event handler property`），那些处理器根本不会被接上。
- **空样式不再写 `style` 键**（以前无条件写 `style: {}`）。

**新能力：事件载荷通道 —— 受控组件可用了（`PLAN.md` 的 I1）**

```moonbit
@html.node("antd:Input",
  @html.Attrs::build()
    .prop_str("value", model.draft)                     // 出：Model → 组件
    .on_raw("change", e => emit(SetDraft(e.text()))),   // 回：组件 → Model（**真实值**）
  [])
```

- 新增 `Attrs::on_raw(event, f : (Payload) -> Cmd)` 与提取器
  `Payload::text/json/num/bool/field`（vendor patch **27**：`html/payload.mbt`，整文件限定 js）。
  在此之前 `onChange` **会触发但读不到值**（透传表填零值），所以 `Input`/`Select` 这类
  受控组件"能画、能点、**不能用**"。
- **旧的 `on_*` 签名一个都没动** —— 它们是对 DOM 的承诺；这是**平行**通道。
- 提取器覆盖三种真实形态：直接给字符串（RN 的 `onChangeText`）、事件对象（`target.value`）、
  业务值（`json()`）；形状对不上给空值而**不抛错**。
- 顺带厘清一条行为：`change` 这类**单词回调靠 camelCase 兜底就能通**，
  只有落点语义不同的（`click` → 默认 RN 的 `onPress`）才必须在宿主声明覆盖 —— 试金石的
  对照断言把这条钉住了。
- ⚠️ **已知限制**：回调**只取第一个参数**（`onChange(value, option)` 只拿得到 `value`）。

**宿主包：拆成「平台无关核心 + RN 预设」**

- 新增 `npm/moobile-host/core.js`：`MOBILE_HOST` 契约的装配、`registerLibrary()`、
  `mountRoot()`、`mountAppCore()`；`index.js` 变薄，只留 RN 的组件表与 `Platform.OS`。
  理由：`import 'react-native'` 一出现，这个包就只能给 RN 用 —— 而契约本身与 RN 无关。
- `react-native` 与 `react-dom` 改为**可选** peer（用 `core.js` 的宿主不必装平台）。
- `registerLibrary()` 一个调用管四件事：组件登记（antd 自动挑出 71 个导出）、
  结构化 prop、事件覆盖、Provider 包裹 + **平台闸门**（不匹配当场抛，而不是渲染成空白）。

**契约 `1 → 2`（破坏性）**：`components` 键空间开放 + 新增可选 `events` / `wrapRoot` / `platform`。
库与宿主包各自声明版本，宿主挂载时比对，不等就**同时报出两个版本号**。
⚠️ **发版时 `moon.mod` 与 npm 包必须同代抬到 `0.3.0`**（本次只改了代码，没有动版本号）。

**证据**（都是可复现的命令，见设计稿附录）：

- `bash tools/verify_all.sh` → **13/13 通过**（含"组件库接入（antd 试金石，26 项）"与
  "模板同源 T1"这一条 —— 后者是 2026-09-21 补的，见下）。
- antd 6.6.4 端到端：`node examples/apps/antd-spike/host/verify.mjs` → **26/26**
  —— SSR 断言 antd 自己的类名与 Table 数据、jsdom 真实点击回到 `update` 并重渲染、
  **受控组件打字后值对上了**（3 条）、四个负例/对照（写错名字点名报错 / 不给事件覆盖则点击无效 /
  全局覆盖能兜住 / `change` 不靠覆盖也能通而 `click` 不行）。
  离线可跑：不需要浏览器、不需要 Metro、不需要后端。

**生成器（组件库的清单 + DSL 包）—— 已落地**（`PLAN.md` §3.8 的 I2 / I5 / I3）：

```bash
cd examples/apps/antd-demo/host && npm run check   # 生成物一致 + 24 条判据
```

- **新增 `moobile-host libgen`**（`npm/moobile-host/libgen/`，~1800 行，**0 个 runtime 依赖**，
  刻意不起 TypeScript）：从 `node_modules/<lib>/**/*.d.ts` 抽「组件 → prop 名 + 类别」，
  一次生成三份产物 —— **manifest JSON**（入库、可 diff）+ **宿主注册调用** + **MoonBit DSL 包**。
  三份同源于一份 manifest，`libgen --check` 任一侧被手改都会红（已做证伪测试）。
- **读数**（antd 6.6.4）：**71 个组件 / 65 个复合子组件（注册 136 个键）/ 9317 个 prop（其中 4965 个进 DSL）**，
  抽取 ~0.6s；生成的 `components.generated.mbt` **12062 行**、`moon check` 0 错误。
- **新示例** [`examples/apps/antd-demo/`](examples/apps/antd-demo/)：用生成的 `@antd` DSL
  把 71 个组件全渲染出来，24 条判据（覆盖 / 两侧同源 / 交互）。
  **它刻意不进 `tools/verify_all.sh`** —— 那条门测库本体，这一份测应用侧生成物且跟 antd 版本走
  （设计稿 §5 T6 的分工）。
- **宿主包 `core.js` 兼容性扩展**：`registerLibrary` 的 `components` 支持**点号路径**
  （`'Form.Item'` → `mod.Form.Item`），取不到照旧点名报错。旧写法不受影响。
- **踩到的坑**（八个"形状对不上却给了结果"的解析退化，含两处会静默少一批 prop 的）：
  见 [`docs/FINDINGS.md`](docs/FINDINGS.md) 的 I2/I3 补记。

**设计文档**：[`docs/design/DESIGN-COMPONENT-LIBRARY.md`](docs/design/DESIGN-COMPONENT-LIBRARY.md)
（机制 N1–N7、被否掉的方案、缺口清单）。**未做**：真浏览器/真机实测与样式交集量化（T3）、
平台矩阵实测（I4）、渲染型回调（`itemRender`）的通道、`Splitter` 那类"children 挂在组件类型上"的 props。

---

## 未发布 —— 脚手架（E 轨道）：模板同源门 T1（2026-09-21）

**新闸门：生成物与 demo 的差异，一条条对着清单判**（`SCAFFOLD.md` §6 的 T1）

- 新增 `tools/template_compare.mjs`（~1 秒，离线，已进 `tools/verify_all.sh` 的并发那一组）：
  `moobile-host init` 现场生成一个临时项目 → 与 `examples/apps/todo-app/` 比对 →
  **清单（`tools/template/deltas.txt`）之外的任何差异 = 红**。
  这补上的是"**模板与 demo 还是一家人吗**"这条判据 —— 此前三条脚手架门验的都只是"模板自己好不好"。
- 判据分三层：文件级（多/少文件）、**字段级**（声明的字段删掉之后剩下的部分必须一模一样：
  JSON 按键、文本按"去掉注释后逐字比"）、以及**死条目**（登记着、实际已不存在的差异 ——
  点名但**不弄红**，因为红的含义是"有漂移"，而"清单该删一行"是另一回事）。
- **清单本身被核出是错的**（它 2026-09-20 是手量的）：漏登 3 处（`expo.web.favicon`、
  `expo.newArchEnabled`、`moon.pkg` 里 `exports` 的排版）、多登 1 处（`package.json:private` ——
  其实两边都是 `true`）。前者补进清单，后者删掉并变成"死条目"检查；
  而 `exports` 那处**排版差异改成把模板对齐 demo**（能用改代码消掉的差异，就不该变成清单里的一行）。
  真因与解法见 [`docs/FINDINGS.md`](docs/FINDINGS.md) 的 T1 补记。
- 证伪 8 例全过：`bash tools/template_compare_falsify.sh`（5 例该红、2 例不许红、1 例基线）。
  ⚠️ 它会**临时改工作区里真实的文件**（跑完逐文件 `cmp` 校验还原，`trap` 到 `EXIT/INT/TERM`），
  所以**不进 `verify_all.sh`**，只在改了比对器或清单之后手动跑。
- 顺带：模板 `moon.pkg` 的 `exports` 改成与 demo 同一排版（纯排版，语义不变）。

> E 轨道其余部分（模板 / `init` / `build` / 另两条门）见 [`PLAN.md`](PLAN.md) §3.9；
> **现状与分数一律看 [`docs/STATUS.md`](docs/STATUS.md)**（唯一来源）。

---

## 未发布 —— 修：打包后的 `init` 生成的项目**没有 `.gitignore`**（2026-09-21）

**症状**（只有"真装一遍"才看得见）：`npx moobile-host init my-app` 出来的项目里，忽略规则文件叫
**`.npmignore`** 而不是 `.gitignore` → 使用者会把 `moobile.js`（1 MB 构建产物）与 `_build/`
一起提交进自己的仓库。

**真因**（三份样本实测）：`files` 白名单里确实列了 `template/.gitignore`，tarball 里也**有**它
（`npm pack --json` 与 `tar -tzf` 都看得到）—— 但 **`npm install` 解包那一步会把包里的 `.gitignore`
改名成 `.npmignore`**（手写 `tar -xzf` 不会）。而仓库里所有脚手架门（`template_check` /
`scaffold_probe` / T1）都是从**仓库布局**的模板生成的 —— 所以**在我们这边永远复现不出来**。

**修法**：

- `lib/init.js`：**永远写出 `.gitignore`**（模板里是 `.npmignore` 就把这个名字还原）；
  模板里两个都没有时**当场报错**、不生成残缺项目（与它旁边两条断言同一个处置）。
- **新门** `tools/package_check.mjs`：真打 tarball → 真 `npm install` → 用**装好的 CLI** `init` →
  断言生成物里有 `.gitignore`、没有 `.npmignore`、文件集合与包内模板逐一对得上。
  挂在 `npm/moobile-host/publish.sh` 里 —— **发布前必跑，不过就不许发**。
- `tools/template_check.mjs` 加一条**离线代理**（把"npm 改名"这件事模拟出来），日常门就能拦住（14 → **15 项**）。
- 两条门都做过**证伪**：关掉修复 → 离线代理红 1 项、打包门红 2 项；还原后 15/15 与 10/10 全绿。

**顺带实测**：`file:` 依赖的安装形态里**没有** `template/`（那是发包时才拷进包里的），
所以 `init` 只在"仓库布局"或"打包形态"下工作 —— demo 吃 `file:` 依赖不受影响（它不调 `init`）。
详见 [`docs/FINDINGS.md`](docs/FINDINGS.md) 的 2026-09-21 补记。

---

## 未发布 —— C0：换掉宿主，库与应用一行都不用改（2026-09-21）

**实测补上了 `PLAN.md` §1.2 那句断言**：「宿主是可替换件 —— 库与具体 RN 版本无关，也与 Expo 无关」。
此前它只有**读代码 + 间接证据**（全文搜 `AppRegistry` 只搜得到"注释里说换成它会怎样"）。

- 新增 [`examples/apps/host-swap-spike/`](examples/apps/host-swap-spike/)：一个**最小裸 RN(Web) 宿主** ——
  入口是 RN 自己的 `AppRegistry`（不是 `registerRootComponent`），打包只用 esbuild
  （`react-native` → `react-native-web` 一行 alias），服务就是一个 node http 静态文件，
  **零 Expo、零 Metro**。它的 `App.js` 与模板那份 4 行**逐字同形**。
- 判据是 `node examples/apps/host-swap-spike/verify.mjs`（**27 项，全过**）：编产物 → 搬产物
  （走 `moon build` + `moobile-host build`）→ 打包 → 起服务 → 真 Chrome（CDP）→ 断言
  首屏渲染、输入/添加/勾选/删除四条交互都回到 `update`、以及**页面上的产物 sha256 与磁盘一致**
  （防"浏览器吃的是旧包"）。它同时断言这个工程 `import('expo')` 直接失败、打包依赖图里
  一个 `node_modules/expo*` 都没有。已挂进 `tools/verify_all.sh --with-e2e` 的尾巴
  （缺 Chrome / 没装依赖记 **SKIP**，**不是** PASS）。
- ⚠️ **边界**（写在最前面免得被读大）：验的是 **web 目标**的裸 RN 宿主，**裸 native RN
  （gradle + 真机）没验**；挂的是**零能力**的模板应用 —— `todo-app` 启动就发 db 命令，
  而 db 能力现在由 `expo-sqlite` 实现，混进来会把"宿主能不能换"盖住。带能力的宿主是下一步。
- 真因与踩坑（esbuild 的 `alias` 按 cwd 解析、本机 npm `omit=["dev"]` 静默跳过 devDependencies、
  RNW 的 `<Text>` 是两层 / `Pressable` 没有 `role`）见 [`docs/FINDINGS.md`](docs/FINDINGS.md) 的 C0 补记。

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
