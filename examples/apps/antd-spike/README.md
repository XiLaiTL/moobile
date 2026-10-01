# antd 试金石 —— React 组件库接入的端到端验证

> 这不是示例应用，是**判据**。设计稿在 [`../../../docs/design/DESIGN-COMPONENT-LIBRARY.md`](../../../docs/design/DESIGN-COMPONENT-LIBRARY.md)，
> 这里只回答一件事：**MoonBit 写的视图，能不能真的用上 antd 的组件。**

## 它是什么

一份 MoonBit 视图里同时压上四条链路，缺任何一条都会红：

| 链路 | 视图里长什么样 | 靠什么成立 |
|---|---|---|
| 内置标签（老路径） | `@html.div` / `@html.span` / `@html.button` | `render.mbt` 的标签表 → 宿主基础组件 |
| 组件库标签 | `@html.node("antd:Card", …)` | 标签**命名空间直通** → `MOBILE_HOST.components["antd:Card"]` |
| 四条 prop 通道 | `.prop_str` / `.prop_bool` / `.prop_num` / **`.prop_json`** | `Attrs` 的通用 prop 通道；结构化值走 JSON 文本，宿主 `JSON.parse` |
| 事件 | `.on_click(_ => emit(Bump))` | 事件名由**宿主**覆盖成 antd 的 `onClick`（RN 语义下它是 `onPress`） |
| **受控组件** | `@html.node("antd:Input", …on_raw("change", e => emit(SetDraft(e.text()))))` | **载荷通道**（`Attrs::on_raw` + `Payload` 提取器）：拿到的是**真实文本**，不是零值 |

## 怎么跑

```bash
# 1) 编 MoonBit（产物在 _build/，脚本直接吃它，不拷副本）
cd <仓库根> && moon build --target js

# 2) 装宿主依赖（antd + react-dom + jsdom，约 110 个包）
cd examples/apps/antd-spike/host && npm install

# 3) 跑
node verify.mjs
```

**不需要浏览器、不需要 Metro、不需要后端** —— 三个阶段各自用最省的判据：

- **阶段 0 · SSR**：`renderToStaticMarkup` 把元素渲成 HTML，断言 antd **自己的**类名
  （`ant-btn` / `ant-card` / `ant-table`）与它从 JSON 里解出来的数据（`>10<` `>20<` `>30<`）。
- **阶段 1 · jsdom**：真实挂载（`react-dom/client`）+ 真实点击事件，看 DOM 变没变
  —— 证明事件回到了 MoonBit 的 `update` 并触发重渲染。
- **阶段 2 · 负例**：写错的组件名必须**点名报错**；宿主不给事件覆盖时点击必须**无效**。
  后者是反证 —— 没有它，我们分不清"设计生效了"和"本来就通"。

期望输出：`26/26 通过`（其中 3 条专门盯**受控组件的值**：打字 → Model 收到该文本 → 回填 DOM）。

## 还有一个**编译期**探针：`generated_shape_probe.mbt`

上面 20 条是**运行期**判据；这个文件是**编译期**判据，回答另一个问题：

> 生成之后，组件能不能像 `@html` 那样写（`@antd.button(type_="primary", …, "加一条")`），
> 而不是 `@html.node("antd:Button", …)`？

它模拟"生成物"的形状，被 `moon check` 编译 —— 所以答案是机器可重复验证的，不是文档里的乐观推断。
实测结论（0 错误）：`@html.IsChildren` 能当消费方的 trait 约束、同款具名参数签名能编、
产出的 `@html.Html` 能直接混进 `@html.div([...])`。
**但名字必须小写** —— `pub fn Button(...)` 是 parse error（大写开头是类型名），
所以目标写法是 `@antd.button`，与 `@svg.rect` / `@html.div` 一致。
**未做**的是生成器本身（`PLAN.md` §3.8 的 I3）。

## 还有一个**生成器可行性**量测：`manifest_probe.mjs`

```bash
node manifest_probe.mjs     # 几秒，不联网、不渲染
```

它回答"**自动生成组件库包装（PLAN 的 I2）到底难不难**"，方式是**量**而不是猜：
浅解析 antd 的 `.d.ts`（正则 + 花括号配对，不起 TypeScript），统计组件数、prop 数、
类型类别分布、以及"命名类型跳一跳能救回多少"。2026-09 读数（antd 6.6.4）：
**79 个组件 / 73 个 Props 接口 / 1260 个直接 prop / ~88% 可自动分类**；
**真正的坑是继承** —— 33/73 个组件的常用 prop（`onClick`/`href`/`className`/`aria-*`）
来自 `@types/react`，而它**不在场**（antd 不依赖它）。
完整分析与工作量估计见设计稿 §5 **T7**。

## 它**不**覆盖什么（别把 20/20 读成"antd 全部可用"）

- **样式**：antd 的 CSS-in-JS 在浏览器里才真正生效。这里只看结构（类名与数据），
  没有量化"moobile 的类型化样式落到 antd 组件上还剩多少交集"（设计稿 §N5）。
- **真机 / iOS**：antd 是 Web 库，本来就不该在 RN 原生上跑。跨平台的路线见设计稿 §N6。
- **复杂交互**：表单校验、弹层、虚拟滚动、多参数回调（`onChange(value, option)` 只拿得到第一个参数）都**没测**。
  受控**单值**组件（`Input`）已验；`Select` / `DatePicker` 那类还没试。
- **性能**：全树 diff 的代价在有 Table 的场景下没测过（设计稿 §N7 的未覆盖项）。
