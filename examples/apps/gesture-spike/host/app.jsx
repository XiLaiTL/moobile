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
import { View, Text, PanResponder, StyleSheet } from 'react-native';
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

function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <RNGHBox prefix="rngh" />
      <RNGHBox prefix="rngh0" minDistance={0} />
      <PanResponderBox />
      <WrappedBox />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', gap: 24, padding: 24 },
  col: { alignItems: 'center' },
  label: { marginBottom: 8, fontSize: 11, color: '#333' },
  box: { width: BOX, height: BOX, borderRadius: 8 },
  rngh: { backgroundColor: '#b8902f' },
  rngh0: { backgroundColor: '#4a6fa5' },
  pan: { backgroundColor: '#8a2518' },
  wrapped: { backgroundColor: '#2f7d5f' },
});

/** 三个**已知节点**的位置交给验证脚本（用 testID 定位，不靠猜坐标）。 */
window.__boxes = () => {
  const out = {};
  for (const id of ['rngh-box', 'rngh0-box', 'pan-box', 'wrapped-box']) {
    const el = document.querySelector('[data-testid="' + id + '"]');
    if (el) {
      const r = el.getBoundingClientRect();
      out[id] = { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    }
  }
  return out;
};

createRoot(document.getElementById('root')).render(<App />);
