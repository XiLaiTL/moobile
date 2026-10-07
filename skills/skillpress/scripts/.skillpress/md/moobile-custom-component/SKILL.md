---
name: moobile-custom-component
description: 给 moobile 写一个库里没有的组件：在宿主侧实现一个 React 组件、用 registerLibrary 注册成「命名空间:组件名」，再在 MoonBit 视图里当普通标签用。
whenToUse: 你要给 moobile 加一个**库里没有的**组件（自家原生视图、要包一层的宿主侧组件、画布那类后端、或一个现成 RN 组件但它要裸字符串数据），需要写宿主侧 React 实现并注册进 `MOBILE_HOST.components`，然后在 MoonBit 里用「命名空间:组件名」调用时；也用于审一份手写的 `registerLibrary` 注册代码（顺序、`platforms` 闸门、`events` 落点、`jsonProps` 白名单）。
---

# moobile-custom-component —— 开发你自己的组件

**只解决一件事**：库里**没有**你要的组件 ⇒ 你在宿主侧**写一个 React 组件**、注册成 `命名空间:组件名`，
MoonBit 侧当普通标签用。先跑一遍（在 moobile 仓库根），确认你看到的结果是**这一版**代码的：

```bash
bash tools/verify_all.sh
```

## 一、先分清这活归谁（划分依据见 skillpress 的 `SKILLS.md`）

| 情形 | 归谁 |
|---|---|
| 组件**已经有了**（antd / markdown 渲染器…），你只做声明与生成 | 用 `moobile-react-library`（写配置 + 跑 `libgen`，不写组件代码） |
| **没人给你这个组件** | 本 skill：写 + 注册 |
| 一般的「不报错但错」（样式、布局、标签、手势） | 用 `moobile-pitfalls` |

## 二、三条慢变的事实（错了都不报，或只在真机上现形）

| 事实 | 错了会怎样 | 细则 |
|---|---|---|
| 名字是 `命名空间:组件名` **一个字符串** | 忘写命名空间不报错，但会回落成 `View` 并计入 `unmapped` | `references/registration.md` |
| 注册必须在**挂载之前**（`installHost` → `registerLibrary` → `mountApp`） | **真机启动即抛**；只有**手写**注册会踩（生成路径撞不上） | `references/registration.md` |
| 组件对象**只能建一次**（模块级或注册时） | 渲染期现造 ⇒ React 认为类型变了 ⇒ 整棵子树重挂、state 归零 | `references/identity-and-selfcheck.md` |

## 三、注册：一次调用、两种形状

```js
installHost();                        // ① 先装：registerLibrary 要求 MOBILE_HOST 已存在
registerLibrary({
  namespace: 'app',
  components: { Gauge: makeGauge() }, // 手写组件 = 直接给实现，不需要 module
});
export default mountApp(app, { registry });   // ③ 内部还会再装一次（幂等合并）
```

- `components` 直接给**实现**（`{ Gauge: makeGauge() }`）⇒ **不需要 `module`**；
  按**名字**从模块里挑（`['Button'] + module`）是接别人的库那条。
- **覆盖内置的 5 个**（`View` / `Text` / `Pressable` / `TextInput` / `ScrollView`）不走这里，
  走 `installHost({ components })`。
- `registerLibrary` 的**返回值**是实际注册进去的键数组 —— 启动日志与断言都拿它，
  别只凭"没抛错"下结论。

### 注册时一并决定的四件事

`platforms`（平台闸门）｜ `jsonProps`（哪些 prop 键走 JSON）｜ `events`（事件键 → 真的 React prop 名）｜
`wrap`（每个根外面套一层 Provider，只作用于应用根）。

⚠️ **`platforms` 没有默认值** ⇒ **不写就等于没有闸门**。"默认 `['web']`"是 `libgen` 生成器那一侧的默认，
不是 `registerLibrary` 的行为（以 `npm/moobile-host/core.js` 的代码为准）。而写 `platforms: []` 不是
"不设闸门"，是"哪个平台都不允许"⇒ 应用在每个平台都启动不了。
逐条实测与出处 → `references/registration.md`。

## 四、事件：要真值就必须走 `on_raw`

`on_change` 那批老处理器在 React 后端**载荷是零值**（能触发、拿不到值）⇒ 受控组件用不了。
真值通道是 `Attrs::on_raw` + `Payload` 的 `text()` / `json()` / `num()` / `bool()` / `field()`；
事件键是**你自己的语义名**，真正的 prop 名由 `events` 表三级优先决定
（`events['ns:X']` → `events['ns:*']` → `events['*']`）。
提取器**永不抛错**（形状对不上给空值）⇒ "值没上来"要自己断言 → `references/events-and-children.md`。

## 五、children：两种形态，选错就是白干

| 通道 | 到组件是 |
|---|---|
| **子节点**（默认，位置参数） | React 子节点；**字符串子节点已被包成 `<Text>` 元素** |
| **`children` prop** | `props.children === "…"` **裸字符串** |
| 具名 prop + 宿主侧适配 | 你自己挑一个键（上面两条都不顺手时） |

- 组件把 children 当**数据**用（markdown-it 那种）⇒ 收到 `<Text>` 元素会抛，
  界面只表现为"那块空着"。处置是**文本走 prop + 宿主侧适配**。
- ❌ 两处**刻意未做**的缺口（别当已支持）：给自定义组件传**裸字符串子节点**；**渲染型回调**
  （`itemRender` / `renderItem`）→ `references/events-and-children.md`。

## 六、缺参数要当场抛，不要静默跳过

- **资源与引擎由应用传进来，宿主不替它猜**（Skia 要应用 import 的引擎 + `makeFont`；web 画布零依赖）。
- 有文字指令而没给 `makeFont` → **抛**；静默跳过会让"标签不见了"很久以后才发现。
- 没注册的标签会让宿主抛错并列出已注册的名字，而 React 会卸掉整棵树 ⇒ 表现为**整页空白**。

## 七、写完自查

1. 注册返回值里有你要的键。2. 每个目标平台都设了 `platforms` 且**真跑过**。
3. 结构化 prop 进了 `jsonProps` 白名单。4. 每个 `on_raw` 事件键在 `events` 里有落点，
判据是"**值对上了**"而不是"回调触发了"。5. 组件类型只建一次。
6. 改了 `npm/moobile-host/**` 就先跑 `bash tools/refresh_host_copies.sh`。
逐条展开与"去哪看细节" → `references/identity-and-selfcheck.md`。
