---
name: moobile-app-development
description: 用 moobile 写应用侧代码（不改库）的入口：TEA 四件套 + 单导出 app()、首帧入口、@html DSL、@style 是类型化样式的唯一通道、事件真实值走哪条通道、Cmd/Sub、加页面与滚动容器、长列表 memo 的键契约、宿主侧最小接入与产物搬运命令。
whenToUse: 要新建一个 moobile 应用、给已有 moobile 应用加页面/改视图/加样式、用 memo_list 写长列表，或第一次把它接到 Expo 宿主上（init / build / 在浏览器或模拟器里跑起来）时用。改库本身、接第三方 React 组件库、环境与门红了排错、从 rabbita 迁移——用别的 skill。
---

# moobile 应用开发：从零一个应用、加一个页面

**解决什么**：应用侧怎么写、怎么跑（**不动库**）。
**先跑什么**：`npx moobile-host init my-app && cd my-app && npm install && npm run web`。
生成物就是 `examples/apps/template/` 的替换产物；功能长满的那份参照是 `examples/apps/todo-app/`。

## 一、先跑这两条，确认你看到的是**这一版**代码的

```bash
npx moobile-host init my-app && cd my-app && npm install && npm run web   # 先跑起来
bash tools/verify_all.sh                                                  # 仓库内：离线全集
```

生成物就是 `examples/apps/template/` 的替换产物；功能长满的那份参照是 `examples/apps/todo-app/`。

## 二、五条不能碰的线（错了要么不报、要么只在真机上现形）

| 线 | 错了会怎样 | 细则 |
|---|---|---|
| 应用必须是**独立模块**（自己的 `moon.mod`） | 塞进库的 `moon.mod` 等于让所有使用者下载你的依赖 | `references/structure.md` |
| 出口名 `app` 必须在 `moon.pkg` 的 `exports`、`App.js` 的 import 三处一致 | **编译器不报**，宿主挂不起来 | `references/structure.md` |
| 样式只能走 `Attrs::styles`，没有 CSS | `class=` / `style="…"` 能写、能编译、**在 RN 上没有任何效果** | `references/styles.md` |
| 整页要包一层 `scroll` 伪标签 | 手机上超过一屏够不着，**浏览器里完全看不出来** | `references/pages-and-lists.md` |
| 首帧入口不能塞进模块初始化，也不能塞进 `view` | 那时宿主还没装 `MOBILE_HOST`；`view` 每帧都跑 | `references/structure.md` |

## 三、骨架与出口

文件构成、`moon.pkg` 要写什么、import 路径照谁抄 → `references/structure.md`。

```moonbit
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~, subscriptions~)
}
```

- 首帧**之前**要干的事（读本地库、发第一个请求）走 `handlers_with_init(init=..., update~, view~)`：
  `init` 返回的命令由运行时排队执行，不阻塞挂载。
- ⚠️ 那个初始化函数**不能叫 `init`**（MoonBit 的保留形状，必须无参无返回值）—— todo-app 叫 `init_app`。
- `update` 是**纯**的：写库、发请求都返回 `Cmd`，结果作为一条 `Msg` 回来；顺序型副作用用
  计数器 + `@cmd.batch`，**不用 sleep**。

## 四、样式与事件

- 样式**唯一**通道是 `@style`：长度给数字（`@style.px(12.0)` / `@style.pct(50.0)`），
  关键词给枚举（`@style.Align::Center`）。按下态 `press()` 的语义是"给**它前面**的键加前缀"，
  链尾调用会把常态键一起变成按下态 → `references/styles.md`。
- 要**真实载荷**（坐标 / 按键 / 滚动量）必须走 `Attrs::on_raw` + `Payload` 的
  `text()` / `json()` / `num()` / `bool()` / `field()`；老的 `on_*` 在 React 后端是**零值**：
  能写、不崩、拿不到 → `references/events-and-subs.md`。
- 用户没点也会来的消息（定时器 / 回前台 / 尺寸变化）走 `subscriptions`；
  ⚠️ `@sub.every` 的间隔别取 1 秒，会让真机验证工具一直等不到 idle。

## 五、页面、滚动容器与长列表

- **没有路由库**：页面是 `Model` 里的一个值，切换是纯 `update`，`view` 里一次 `match` 分发。
- **整页必须包滚动容器**：RN 的 `View` 不滚动，而 `@html` 里没有滚动标签 ⇒ 用伪标签
  `@html.node("scroll", attrs(…), [...])`（标签表把它映射成 `ScrollView`）。
- 长列表用 `@moobile.memo_list`，**键相同必须蕴含"这一行的 HTML 与 handler 等价"**：
  行里每一个会变的东西（`id` / 文案 / 勾选 / handler 捕获的值）都要进键。
  只按 `id` 取键 ⇒ 变化画不出来；用"第几条"当键 ⇒ 插一行后静默错配；`by` 漏了 handler
  捕获的值 ⇒ 点下去动的是**另一条数据** → `references/pages-and-lists.md`。

## 六、宿主侧与能力

- 宿主入口**手写 4 行**；**加能力 = `npm install <包>` + `npm run regen` + `moon.pkg` 加一条 import**。
- 产物搬运**一律走 `moobile-host build`** —— **别写死 `cp`**：产物路径取决于模块在构建根里的身份。
- 换宿主（`expo` / `rnw` / `webview`）**不改编译侧**。
- 写得出来、但只在真机上现形的能力边界（不支持的那批标签、未收录标签、第三方组件、
  原生能力、换平台）→ `references/host-and-capabilities.md`。

## 七、跑起来 / 改完看效果

```bash
npm run web            # 生成出来的项目：build + expo start --web
npm run android        # 模拟器或真机（要 Android SDK，且 adb 在 PATH 上）
bash tools/build.sh    # 仓库内：编译 + 把产物搬进 examples/apps/todo-app/host
```

仓库内跑 Web 预览：`cd examples/apps/todo-app/host && npx expo start --port 8081`；
真机要 `adb reverse tcp:8081 tcp:8081`，否则**白屏**（`DEV.md` §3）。

## 八、去哪看细节

| 要看什么 | 去哪 |
|---|---|
| 骨架 / 出口 / 首帧入口 / update | `references/structure.md` |
| 样式（含两条没效果的 CSS 通道） | `references/styles.md` |
| 事件、Payload、订阅 | `references/events-and-subs.md` |
| 页面、滚动容器、memo_list | `references/pages-and-lists.md` |
| 宿主接入、能力边界、跑起来 | `references/host-and-capabilities.md` |
| 一般性"不报错但错"的坑（逐条清单） | `moobile-pitfalls` |
| 现状 / 分数 / 已发布版本 | `docs/STATUS.md` |
