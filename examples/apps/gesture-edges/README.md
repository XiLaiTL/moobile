# gesture-edges —— 手势通道**边界**的真机验证

```bash
cd examples/apps/gesture-edges

# 一次性：装依赖 + 出原生工程
npm install
npx expo prebuild -p android --no-install
bash ../../../tools/android_env_setup.sh --app examples/apps/gesture-edges
powershell -NoProfile -ExecutionPolicy Bypass -File ../../../tools/link_builddirs.ps1 -App examples/apps/gesture-edges

# 出包（不需要 Skia，所以比 canvas-demo 那套轻）
npm run build
cd android && JAVA_HOME="<你的 JDK 17 目录>" NODE_OPTIONS=--preserve-symlinks \
  ./gradlew assembleDebug -PreactNativeArchitectures=x86_64

# 装 + 验（debug 包现拉 bundle，所以 Metro 与 adb reverse 是必需的）
cd .. && npx expo start --port 8081 &      # 另开一个终端更省事
adb reverse tcp:8081 tcp:8081
node device_check.mjs
```

## 1. 为什么单独一个应用

`gesture-spike` 在 **web 宿主（RNW）** 上把手势边界验到了 **40/40**，但其中四条
**在浏览器里压根不成立**，而它们恰好是最可能在真机上翻车的：

| 边界 | 为什么 web 上问不出来 |
|---|---|
| **嵌套归属**（内外都挂 `on_pan`） | web 上验的是 RNW 的 responder 协商；原生走的是另一套（Android 触摸分发 + RN responder），结论不能平移 |
| **深层子元素的参照系** | RNW 给的是"挂手势那个元素"的局部坐标；Android 的 `locationX` 语义是"**最深的被触摸 view**" |
| **可拖元素在滚动容器里** | 鼠标拖动**不滚** `overflow` 容器，这个问题在浏览器里不存在 |
| **只挂 `on_tap` 的元素不该锁死滚动** | 同上，只有真机有真滚动 |

第二条是这里面最贵的一条。它不是"顺手补个用例"：`canvas-demo` 里
`dx=155 dy=51`（横滑 80px）那次事故，真因就是**参照系在手势中途换掉了**
（起点落在子元素上 → 相对子元素；手指滑出子元素 → 换回父元素）。
当时只修了 `dx/dy`（改用 `pageX/pageY` 算），**`x/y` 没人问过它"相对谁"** ——
而契约里白纸黑字写着"`x`/`y` 是元素内坐标"。若真机给的是子元素坐标系，
那句话在**最重要的平台上就是假的**，而这种假最难发现：应用照契约写的换算
（罗盘取角度、滑杆取刻度）只在"手指恰好落在子元素上"时算错。

## 2. 页面怎么布置（尺寸是算过的，别随手改）

```text
① 嵌套      外盒 358×120，内盒 120×64 居中
② 深层      盒 358×110；子元素 margin(60,24)、140×52
            → 子元素中心在**盒坐标系**里是 (130,50)，在**子坐标系**里是 (70,26)
            ⇒ 从子元素中心按下，`x` 落在哪一对就把参照系定死了
③ 两个滚动   各 170×190 的 `scroll`，内容 90+150+30 = 270 > 190 ⇒ 能滚
            左：内容首块挂 `on_pan`（token `拖A n=… c=…`）
            右：内容首块只挂 `on_tap`（token `点B n=…`）
            底部各有哨兵 `底A 见` / `底B 见`，**在初始视口之外**
```

三个设计点值得说：

- **② 不需要知道盒子在屏幕上的位置**就能判：脚本只知道"从 `子` 这个 token 上按下"，
  而那个 token 正好在子元素中心。两对候选数字相差 60/24，远大于取整误差。
- **③ 那对哨兵是唯一能证明"滚动没被手势吞掉"的抓手**：应用侧**拿不到滚动位置**
  （`on_scroll` 在 RN 上还是缺口，见 `npm/moobile-host/native-rn.js`），
  于是把"滚没滚"翻译成"视口外的节点进没进 UI 树"，用 `uiautomator dump` 读。
  哨兵初始**必须在视口外** —— 否则"它出现了"什么都证明不了，所以基线那一条自己也是断言。
- **不给 `subscriptions`**：定时推送会让界面一直"不空闲"，`uiautomator dump` 会报
  `could not get idle state.`，而它失败时**不会清掉上一次的 xml** ——
  读到陈旧界面就会得出完全错误的结论（`docs/FINDINGS.md` 记过）。
  同理，脚本每次 dump 前**先删旧文件**，把 dump 失败当**空**处理。

## 3. 判据

| # | 判据 | 压的是什么 |
|---|---|---|
| ① | 从**内盒**上滑 → `内 n ≥ 3`、`内 c = 0`、**`外 n = 0`** | 更具体的元素赢，父不抢子 |
| ② | 从**子元素**上滑 → `深 起` ≈ `130,50`（不是 `70,26`） | `x`/`y` 相对**挂手势的盒** |
| ②-2 | `末 − 起` ≈ `40` | 整条拖动在**同一个参照系**里（`dx=155` 的病根） |
| ③ | `on_pan` 的块上竖滑 → `拖A n ≥ 3`、`c = 0`、**内容不滚** | 它按下即判定"这次是拖动"，不让别人抢 |
| ④-0 | **正对照**：同一容器里没有手势的块滑得动 | 没有它，"④-1 没滚"分不清是手势挡的还是滑动姿势不对 |
| ④-1 | 只挂 `on_tap` 的块上竖滑 → **内容滚了**、`点B n = 0` | 可点元素必须把滚动让出去，否则列表里的可点行会锁死滚动 |
| ⑤ | 无手势元素上滑 → 五个计数器全不变 | 证伪：上面那些数字确实来自手势元素 |

## 4. 结果与它改了什么

**分数只在一处**：[`docs/STATUS.md`](../../../docs/STATUS.md)（这里不抄会变的数字）。
这一节只记**这个应用逼出来的三处实现修正** —— 每一条都是先红、查明真因、再改：

| 症状（实测） | 真因 | 修正 |
|---|---|---|
| `外 n=6 序外=ssssss`：外盒收到 **6 次 `start`、零 move** | RN 会**投机调用**候选者的 `onResponderGrant`（拿它的布尔返回值当判断），**然后**才问当前响应者让不让；被拒时补一个 `responderReject`，可那个 `grant` 已经跑过了。web 宿主只在允许转移时才调，所以**浏览器上看不见** | `start` 改成"确认真的拿到响应者之后才吐"（`onPanResponderStart`），`onPanResponderReject` 清掉待定 |
| `深xs=[6, 7, 79, 89, …, 109]`：参照系在**第一个 move** 就换掉了 | 原生的 `locationX/locationY` 是"**手指底下最深的那个 view**"的局部坐标（头两个 `6,7` 是那个 `子` 字自身的），而且**会随手指移动而换** | 原生侧自己量元素原点（`measure` 的 `pageX/pageY`），用 `pageX/pageY − 原点` 算 `x/y`；web 保持原样（RNW 本来就对，且它的 `measure` 给的是视口坐标、与触摸的文档坐标不同源） |
| 只挂 `on_tap` 的块在 `scroll` 里竖滑，**内容一点都不动**（旁边无手势的块滑得动） | `PanResponder` 默认把 `onShouldBlockNativeResponder` 当 `true` 返回，而 RN 用它决定**要不要挡住原生组件** —— 原生 `ScrollView` 因此收不到这次触摸。光有 `TerminationRequest` 让不让**还不够** | `onShouldBlockNativeResponder: () => hasPan`（与终止权**同一套策略**：拖动挡、点按让） |

## 5. 这个应用**没有**验什么（边界）

1. **多指（`pointers`）**：`adb shell input` 只能发单指，多指要 `sendevent` 原始事件
   （机型相关、不可移植）。所以 `pointers` 只有 **web 证据**（`gesture-spike` 的 E3：
   两指按下 → `pointers=2`，且 `dx` 锁在第一指）。**真机没验，不假装覆盖。**
2. **iOS**：一次都没跑过（仓库里所有真机证据都是 Android 模拟器）。
3. **JS 线程忙时的手感**：`PanResponder` 与渲染都在 JS 线程，所以"拖动时界面还在重算"
   会不会掉帧，这里没有判据。
4. **手势与原生滚动的更细交互**：只验了"竖滑谁赢"这一条；嵌套滚动、`RefreshControl`、
   横向 `ScrollView` 都没碰。
5. **`x`/`y` 只验了"相对挂手势的元素"这一层**：元素自身在拖动中**移动**的情况
   （比如跟着手指走的浮层）没验 —— 那种情况下"元素内坐标"该怎么解释，契约里也还没写。
