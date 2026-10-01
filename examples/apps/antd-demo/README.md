# antd 全组件 demo —— `libgen` 生成物的用法示例

> **它是什么**：用 `libgen`（`PLAN.md` §3.8 的 I2/I3/I5）从 antd 的类型定义**生成**出来的
> `@antd` DSL 包与宿主注册，把 **71 个组件**全部渲染出来的示例。
>
> **它的判据是什么**：不是"页面能打开"，而是 —— **manifest 里的每一个组件都真的被 antd 渲染出了 DOM**，
> 并且关键交互确实把值送回了 MoonBit。做法见 `host/verify.mjs`（24 条）。
>
> **它为什么不在 `tools/verify_all.sh` 里**（这是刻意的）：那条门测的是**库本体**
> （标签直通 / 契约 / 宿主包 / 载荷通道，26 项，几分钟内可跑完、离线）；
> 这一份测的是**应用侧生成物**，它跟着 antd 的版本走，只有装了 antd 的机器能跑。
> 混在一起会让"门红了"分不清是库退化了还是 antd 升级了 —— 那种门最后会被人无视。
> 生成物的门属于**应用的 CI**（设计稿 §5 T6）。

## 怎么跑

```bash
# 1) 编 MoonBit（工作区成员，吃本地源码）
cd <仓库根> && moon build --target js

# 2) 装依赖（antd + react + jsdom，约 110 个包）
cd examples/apps/antd-demo/host && npm install

# 3) 一条命令跑三件事：生成物与清单一致 + 24 条判据
npm run check
```

分开跑：

```bash
npm run libgen          # 重新生成（改了 antd 版本、或改了 libgen.config.json 之后）
npm run libgen:check    # 只校验生成物没被手改（进应用 CI 的那条）
npm run verify          # 只跑判据
```

## 生成物是"承诺面"：都在库里，都能 diff

| 文件 | 是什么 | 谁生成 |
|---|---|---|
| `generated/antd.manifest.json` | **组件 → prop 名 + 类别**的清单（71 个组件 / 65 个复合子组件 / 9317 个 prop） | `libgen` 第 ① 段（I2） |
| `host/libraries.generated.js` | 宿主注册调用（`components` / `jsonProps` / `events` / `wrap` / `platforms`） | `libgen` 第 ② 段（I5） |
| `antd/components.generated.mbt` | MoonBit DSL 包（`@antd.button(type_="primary", …)`） | `libgen` 第 ③ 段（I3） |
| `antd/moon.pkg` | 那个包的 `moon.pkg` | 同上 |

**为什么必须"一条命令、一份 manifest、两个产物"**：宿主侧认的是**名字**
（`MOBILE_HOST.components["antd:Button"]`），MoonBit 侧发的也是**名字**（标签字符串）。
两边各写一份清单就是等着漂；同源于一份 manifest 才是机制保证。
`npm run libgen:check` 是这个保证的判据 —— **任一侧被手改都会红**（已做证伪测试：
往 `components.generated.mbt` 追加一行注释 → 立刻报"第 N 行起不一致"）。

## 这个 demo 长什么样（四段）

| 段 | 组件数 | 压的是什么 |
|---|---|---|
| 数据录入 | 19 | **受控组件**：`value` 从 Model 来、`on_change` 把真实值带回去（I1 的载荷通道） |
| 数据展示 | 28 | **结构化 prop**（JSON 通道）：`Table.columns/dataSource`、`items` 系列… |
| 反馈与导航 | 14 | **弹层类**（portal）：`Modal` / `Drawer` 的开关，`Popconfirm` / `Dropdown` / `Tour` |
| 布局与起点 | 10 | 布局、栅格，以及 `Button`（点击 → 表格多一行的那条链路） |

写法与 `@html` 平级：

```moonbit
@antd.button(type_="primary", danger=true, on_click=emit(Bump), "加一条")
@antd.input(value=jstr(model.draft), on_change=e => emit(SetDraft(e.text())), ([] : Array[@html.Html]))
@antd.form_item(label="姓名", [ @antd.input(placeholder="姓名", ([] : Array[@html.Html])) ])
```

## 24 条判据（`host/verify.mjs`）

- **覆盖**：manifest 的 71 个组件**每一个**都有 gallery 格子（`data-demo="<组件名>"`），
  且每个格子里都有 antd 渲染出的 `.ant-*` DOM；
  **反向对照**：格子里不许出现 manifest 不知道的组件名。
- **两侧同源**：宿主注册表的键集合 == manifest 的组件集合（136 个：71 + 65）。
- **交互**（判据是"值对上了"，不是"事件触发了"）：
  Input 打字 → `Model.draft` 是该文本且 DOM 回填 / Button 点击 → 表格多一行 /
  Switch → 布尔 / Checkbox → 从事件对象里挖 `target.checked` / Radio.Group → 值 /
  Tabs → `activeKey` / Pagination → 页码（含 Double→Int）/ Form 提交 → `onFinish` /
  Modal·Drawer 打开 → portal 真的进 `document.body` / Rate → 数值。
- **三条例外都写明了理由**（放宽断言是禁止的）：`ConfigProvider` 本身不出 DOM；
  `Tour` 是 portal（改判到 jsdom 阶段断言）；`Watermark` 的可见产出是 canvas，
  而 **jsdom 没有实现 canvas** —— 改判成"它的 children 渲染出来了"。

## 已知限制（别把 24/24 读成"antd 全都能用"）

1. **渲染型回调（`itemRender` / `renderItem`）过不来**：`Listy` / `Masonry` 这类组件的渲染
   由回调决定，而我们的 prop 通道只能传 String / Bool / Int / Double + JSON 文本
   （回调是另一个通道，且它的契约是"返回消息"而不是"返回节点"）。
   这两格的 item 因此是空的（壳仍然由 antd 渲染）。**两条解法**（都未做）：
   宿主侧注入默认渲染器；或库侧新增"render prop"通道（`(Payload) -> Html`）。
2. **`Splitter` 没有面板**：antd 把 `children` 声明在**组件类型**上
   （`declare const Splitter: React.ForwardRefExoticComponent<SplitterProps & { children?: … }>`），
   而生成器按 props 接口（`SplitterProps`）取 —— 这个已知形态有补丁，但补丁要顺着
   `typeof SplitterComp` 再跳一层才够，本轮没做。
3. **样式没验**：antd 的 CSS-in-JS 在真浏览器里才真正生效，这里只断言结构。
4. **`message` / `notification` / `theme` / `Grid` / `version` / `unstableSetRender` 不是组件**
   （命令式 API 或门面对象），所以既不在 manifest 里、也不在 gallery 里 —— 本 demo 不假装覆盖。
5. **多参数回调只拿得到第一个参数**（I1 的既有已知限制）：
   `DatePicker` 的 `onChange(date, dateString)` 里那个**可读的字符串**拿不到，
   所以 demo 里它只断言"回调回来了"。解法同第 1 条（宿主侧适配器）。
6. **`value` 这类 prop 要写成 JSON 文本**：`.d.ts` 里它是
   `string | number | readonly string[]`，含数组的联合按规则走 JSON 通道，
   于是调用点写 `jstr(model.draft)`（见 `gallery_entry.mbt` 的 `jstr`）。
   规则本身没错（`string[]` 真能传），代价是常见的单值场景要包一层。

## 与 `antd-spike` 的分工（别把两者读成同一个东西）

| | `examples/apps/antd-spike` | 这里 |
|---|---|---|
| 定位 | **判据**：库本体接得对不对 | **用法示例**：生成物覆盖多少、交互能不能用 |
| 压的东西 | 标签直通 / 契约 / 宿主包 / 载荷通道（26 项） | 全组件覆盖 + 交互 + 两侧同源（24 项） |
| 进 `verify_all.sh`？ | ✅ 是（离线、几秒） | ❌ 否（跟 antd 版本走，属应用 CI） |
| 手写还是生成 | 手写 `@html.node("antd:Button", …)` | 生成的 `@antd.button(…)` |
