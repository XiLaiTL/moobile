// app.jsx —— 手势试金石：**同一屏三个盒子**，比三种手势实现的行为。
//
// 为什么要比、而不是选一个就用：`SCAFFOLD.md` §4 的规矩是"先验证未知量"。
// 「手势通道该用 PanResponder 还是 react-native-gesture-handler（RNGH）」有三个未知量，
// 一个都不能靠读文档定：
//
//   1. RNGH 在 **react-native-web 宿主**上到底跑不跑（包里有 275 个 `.web.js`，
//      但"包里有 web 实现"≠"在我们的 RNW 下能挂载并收到事件"）；
//   2. `PanResponder`（RN 内置、零新依赖）在 RNW 上给不给**元素内坐标**；
//   3. RNGH 的 `translationX` 语义是否等同 DOM 的"按下即起算" ——
//      **实测不等同**：默认 Pan 有激活阈值，跨过它之前 `translationX` 一直是 0。
//      所以这里放第三个盒子（`minDistance(0)`）验证这个阈值能不能关掉。
//
// 判据不是"能拖"，而是：事件真的来了 + 坐标是**元素内**的 + **位置真的跟着指针走**。
// 只断言"回调被调了"抓不住"坐标全 0"—— 而那正是 moobile 现在在 RN 上的毛病。

import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text, ScrollView, PanResponder, StyleSheet } from 'react-native';
// 别名（esbuild 配置见 verify.mjs）：`react-native` → `react-native-web`
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
// ★ 库自己的手势实现（宿主包默认装载的那一份）
import { withGestureComponents } from 'moobile-host/gesture-rn.js';

/** 事件日志：验证脚本从 `window.__log` 读（不靠截图猜）。 */
const log = (kind, data) => {
  (window.__log = window.__log || []).push({ kind, ...data });
};

const BOX = 96;

/** RNGH 的 Pan 盒子。`minDistance` 不给就沿用默认（有激活阈值）；给 0 则关掉。 */
function RNGHBox(props) {
  const prefix = props.prefix || 'rngh';
  const hasMin = props.minDistance !== undefined && props.minDistance !== null;
  let pan = Gesture.Pan()
    .onBegin((e) => log(prefix + '.begin', { x: e.x, y: e.y, ax: e.absoluteX, ay: e.absoluteY }))
    .onUpdate((e) =>
      log(prefix + '.update', {
        x: e.x,
        y: e.y,
        tx: e.translationX,
        ty: e.translationY,
        ax: e.absoluteX,
        ay: e.absoluteY,
      }),
    )
    .onEnd((e) =>
      log(prefix + '.end', { x: e.x, y: e.y, tx: e.translationX, ax: e.absoluteX, ay: e.absoluteY }),
    )
    .onFinalize(() => log(prefix + '.finalize', {}));
  if (hasMin) pan = pan.minDistance(props.minDistance);
  return (
    <View style={styles.col}>
      <Text style={styles.label}>{prefix}</Text>
      <GestureDetector gesture={pan}>
        <View
          style={[styles.box, prefix === 'rngh' ? styles.rngh : styles.rngh0]}
          testID={prefix + '-box'}
        />
      </GestureDetector>
    </View>
  );
}

/**
 * ★ **库自己的实现**：`moobile-host` 的 `withGestureComponents`（宿主的默认手势支持）。
 *
 * 这一盒是三者里最关键的 —— 前两盒证明"RN 生态里有什么可用"，
 * 这一盒证明"我们**发出去的那份实现**给出的载荷符合契约"：
 * `x/y` 是元素内坐标、`dx/dy` **从按下起算**（不是谁的 `translationX`）、`phase` 有始有终。
 */
const GestureView = withGestureComponents({ View }).View;

function WrappedBox() {
  return (
    <View style={styles.col}>
      <Text style={styles.label}>moobile-host</Text>
      <GestureView
        style={[styles.box, styles.wrapped]}
        testID="wrapped-box"
        onPan={(g) => log('wrapped.' + (g.phase === 'cancel' ? 'end' : g.phase), g)}
        onTap={(g) => log('wrapped.tap', g)}
      />
    </View>
  );
}

/** RN 内置的 responder 系统（**零新依赖**）。 */
function PanResponderBox() {
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const n = evt.nativeEvent;
        log('pan.begin', { x: n.locationX, y: n.locationY, pageX: n.pageX, pageY: n.pageY });
      },
      onPanResponderMove: (evt) => {
        const n = evt.nativeEvent;
        log('pan.update', { x: n.locationX, y: n.locationY, pageX: n.pageX, pageY: n.pageY });
      },
      onPanResponderRelease: () => log('pan.end', {}),
    }),
  ).current;
  return (
    <View style={styles.col}>
      <Text style={styles.label}>PanResponder</Text>
      <View style={[styles.box, styles.pan]} testID="pan-box" {...responder.panHandlers} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 边界（README §7）—— 上面那一排问"RN 生态里有什么可用"，这一排问
// "**契约在这些情况下怎么表态**"。每个盒子只问一件事，别的地方一字不改，
// 这样一条断言红了就能直接指到是哪条边界。
//
// ⚠️ 这里最要紧的不是"能跑"，而是**实现有没有撒谎**：契约白纸黑字写着 `x/y` 是
// "元素内坐标"，那手指落在子元素上时就不能换成子元素的坐标系；
// 写着 `pointers` 是手指数，多指时就不能恒报 1。撒谎的实现比缺功能更坏 ——
// 应用会照着契约写逻辑，然后在某个边界上悄悄写错状态。
// ═══════════════════════════════════════════════════════════════════════════════

/** 边界盒子统一用这一个类型（同类型不同 props，不会引起重挂）。 */
const GV = withGestureComponents({ View }).View;

/** E1 嵌套：父子**都**挂 `onPan`。期望：**子赢**，父一个事件都不收。 */
function NestedBox() {
  return (
    <View style={styles.col}>
      <Text style={styles.label}>嵌套</Text>
      <GV
        style={[styles.box, styles.nestedOuter]}
        testID="nested-box"
        onPan={(g) => log('edge.nested.outer.' + g.phase, g)}
      >
        <GV
          style={[styles.nestedInner]}
          testID="nested-inner"
          onPan={(g) => log('edge.nested.inner.' + g.phase, g)}
        />
      </GV>
    </View>
  );
}

/**
 * E2 深层子元素：挂手势的元素里放一个**占了上半部分**的 `Text`，从 `Text` 上按下拖。
 *
 * 期望：`x/y` **仍相对挂手势的那个元素**（契约说的"元素内"就是它）。
 * 这条正是 `dx=155 dy=51` 那次事故的根：真机实测 `locationX` 的参照系是
 * "**最深的被触摸 view**"，手指从文字滑出去时参照系会中途换掉 —— 位移于是跳。
 * `dx/dy` 已经改用 `pageX/pageY` 绕开了它，但 `x/y` 同样是同一个陷阱，
 * 之前没人问过它"相对谁"。
 */
function DeepChildBox() {
  return (
    <View style={styles.col}>
      <Text style={styles.label}>深层子元素</Text>
      <GV style={[styles.box, styles.deep]} testID="deep-box" onPan={(g) => log('edge.deep.' + g.phase, g)}>
        <Text style={styles.deepLabel} testID="deep-label">
          文字
        </Text>
      </GV>
    </View>
  );
}

/**
 * E3 多指：同一元素上两指按下、只动第一指。
 * 期望：`pointers` **诚实报 2**；`dx/dy` **仍跟第一指**（不因为第二指落下而跳）。
 */
function MultiBox() {
  return (
    <View style={styles.col}>
      <Text style={styles.label}>多指</Text>
      <GV style={[styles.box, styles.multi]} testID="multi-box" onPan={(g) => log('edge.multi.' + g.phase, g)} />
    </View>
  );
}

/**
 * E4/E5 滚动容器：`ScrollView` 里放两个可拖元素 ——
 * 上面那个挂了 `onPan`（期望：滚动**抢走**响应者 → 我们只收到 `cancel`，且它是最后一次）；
 * 下面那个**只**挂 `onTap`（期望：拖动时它**不**劫持滚动，滚动正常滚起来）。
 *
 * ⚠️ 这里用**未包装的** `ScrollView`：`withGestures` 会把 responder prop 铺到 Base 上，
 * 那会盖掉 `ScrollView` 自己的滚动响应者逻辑 —— 包它等于把滚动关掉。
 */
const SCROLL_H = 150;
const ScrollBox = React.forwardRef((props, ref) => (
  <View style={styles.col}>
    <Text style={styles.label}>{props.label}</Text>
    <ScrollView
      ref={ref}
      style={styles.scroll}
      testID={props.testID}
      onScroll={(e) => {
        window.__scrollY = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
    >
      <GV
        style={styles.scrollDrag}
        testID={props.dragTestID}
        onPan={(g) => log('edge.scroll.' + g.phase, g)}
      />
      <GV
        style={styles.scrollTap}
        testID={props.tapTestID}
        onTap={(g) => log('edge.taponly.tap', g)}
      />
      <View style={styles.scrollFiller} />
    </ScrollView>
  </View>
));

/** E6 同挂：一个元素上 `onPan` 与 `onTap` 都给。期望：点按时**两个都触发**（文档已声明二选一）。 */
function BothBox() {
  return (
    <View style={styles.col}>
      <Text style={styles.label}>同挂</Text>
      <GV
        style={[styles.box, styles.both]}
        testID="both-box"
        onPan={(g) => log('edge.both.pan.' + g.phase, g)}
        onTap={(g) => log('edge.both.tap', g)}
      />
    </View>
  );
}

/** E7 无处理器：包装过、但一个手势 prop 都没给。期望：行为**一字不变**（不抢响应者）。 */
function PlainBox() {
  return (
    <View style={styles.col}>
      <Text style={styles.label}>无处理器</Text>
      <GV style={[styles.box, styles.plain]} testID="plain-box" />
    </View>
  );
}

function App() {
  const scrollPadRef = useRef(null);
  const scrollOnlyRef = useRef(null);
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.row}>
        <RNGHBox prefix="rngh" />
        <RNGHBox prefix="rngh0" minDistance={0} />
        <PanResponderBox />
        <WrappedBox />
      </View>
      <View style={styles.row}>
        <NestedBox />
        <DeepChildBox />
        <MultiBox />
        <BothBox />
        <PlainBox />
        <ScrollBox ref={scrollPadRef} label="滚动+可拖" testID="scroll-box" dragTestID="scrolldrag-box" tapTestID="unused-a" />
        <ScrollBox ref={scrollOnlyRef} label="滚动+只点按" testID="scroll2-box" dragTestID="unused-b" tapTestID="scrolltap-box" />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // ⚠️ 宽度与换行**不是排版审美，是判据的前提**：第二行有 7 列，挤在一行里会互相压住，
  //    于是"拖 A 盒子"实际拖到了压在它上面的 B 盒子 —— 头一版就跑出过这种结果
  //    （E3/E4/E6 全空、E7 的"正对照"也是假的）。验证脚本另有一条 `__hitAt` 自检兜底。
  root: { width: 900, flexDirection: 'column', gap: 28, padding: 24 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', maxWidth: 852 },
  col: { alignItems: 'center' },
  label: { marginBottom: 8, fontSize: 11, color: '#333' },
  box: { width: BOX, height: BOX, borderRadius: 8 },
  rngh: { backgroundColor: '#b8902f' },
  rngh0: { backgroundColor: '#4a6fa5' },
  pan: { backgroundColor: '#8a2518' },
  wrapped: { backgroundColor: '#2f7d5f' },
  // ── 边界盒子：颜色只用来人眼区分，判据一律走日志 ──
  nestedOuter: { backgroundColor: '#6b4fa0', alignItems: 'center', justifyContent: 'center' },
  nestedInner: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#d8c7f0' },
  deep: { backgroundColor: '#1f6f8b' },
  // ⚠️ 这个子元素**故意不贴左上角**（left:20 / top:10）：只有它的原点与父元素错开，
  //    才分得出 `x/y` 到底相对谁 —— 贴角的话两套参照系给出同一个数，测了等于没测。
  deepLabel: {
    position: 'absolute',
    left: 20,
    top: 10,
    width: 60,
    height: 40,
    backgroundColor: '#bfe6f2',
    fontSize: 12,
    textAlign: 'center',
    // ⚠️ **这一条是实测逼出来的**：不加它，从文字上按下拖动会被浏览器的
    //    **文字选择**接管 —— 手势在 10px 处收到 `cancel`（见 README §7-E2）。
    //    在 RN 原生侧没有这回事，所以这是 web 宿主（RNW）特有的坑。
    userSelect: 'none',
  },
  multi: { backgroundColor: '#a05c1f' },
  both: { backgroundColor: '#4f7a28' },
  plain: { backgroundColor: '#7a7a7a' },
  scroll: { width: 120, height: SCROLL_H, backgroundColor: '#e8e8e8' },
  scrollDrag: { width: 120, height: 80, backgroundColor: '#2f7d5f' },
  scrollTap: { width: 120, height: 80, backgroundColor: '#c98a2f' },
  scrollFiller: { width: 120, height: 300, backgroundColor: '#cccccc' },
});

/** **已知节点**的位置交给验证脚本（用 testID 定位，不靠猜坐标）。 */
const BOX_IDS = [
  'rngh-box', 'rngh0-box', 'pan-box', 'wrapped-box',
  // 边界盒子
  'nested-box', 'nested-inner', 'deep-box', 'deep-label', 'multi-box', 'both-box', 'plain-box',
  'scroll-box', 'scrolldrag-box', 'scroll2-box', 'scrolltap-box',
];
window.__boxes = () => {
  const out = {};
  for (const id of BOX_IDS) {
    const el = document.querySelector('[data-testid="' + id + '"]');
    if (el) {
      const r = el.getBoundingClientRect();
      out[id] = { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, top: r.top, left: r.left };
    }
  }
  return out;
};

/** 滚动位置（E4/E5 的判据：滚动到底动没动）。 */
window.__scroll = () => window.__scrollY || 0;

/**
 * **命中自检**：某个盒子的某一点上，浏览器真的会把这个元素（或它的子孙）当目标吗？
 *
 * 为什么必须有这条：验证脚本按 `getBoundingClientRect` 算按下点，但**算出的点未必命中
 * 那个元素** —— 布局换行不对、或别的元素压在上面时，`Input.dispatchMouseEvent` 会把事件
 * 送给另一个元素。表现是"日志是空的"，而**空日志与"功能没实现"长得一模一样**。
 * 头一版就因此得了三个假结论（E3/E4/E6 全空、E7 的正对照也是假的）。
 * 本仓库那条"验证脚本要能识别自己拿到的是不是这次的"规矩，这里再一次应验。
 */
window.__hitAt = (id, dx = 0, dy = 0) => {
  const el = document.querySelector('[data-testid="' + id + '"]');
  if (!el) return '(元素不存在)';
  const r = el.getBoundingClientRect();
  const x = r.x + (dx || r.width / 2);
  const y = r.y + (dy || r.height / 2);
  const h = document.elementFromPoint(x, y);
  if (!h) return '(落点无元素)';
  // 落在自己或自己的子孙上才算命中
  return h.closest('[data-testid="' + id + '"]') ? 'ok' : h.getAttribute('data-testid') || h.tagName;
};

createRoot(document.getElementById('root')).render(<App />);
