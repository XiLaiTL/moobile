// gesture-rn.js —— 手势通道在 React Native 上的**默认实现**（`PanResponder`，零新依赖）。
//
// ## 为什么在这里、而不是让应用自己接
//
// 决策点 19 的"库优先"判据第 2 条：**零配置**。应用不该为了"能拖动"去 opt-in 一个原生依赖，
// 也不该自己写 responder 胶水。所以 `installHost()`（RN 预设）**默认**把 5 个内置组件
// 包成"手势可用"的版本 —— 应用侧 `@gesture.attrs(on_pan=…)` 直接就有效。
//
// ## 契约（必须与库侧 `gesture/gesture.mbt` 那张表逐字一致）
//
// 递给 MoonBit 处理器的载荷形状：
//
//   { x, y,        // **元素内**坐标（responder 的 locationX/locationY）
//     dx, dy,      // **从按下那一刻起算**的位移 —— ★ 由这里算，不是谁的 translationX
//     ax, ay,      // 屏幕坐标（pageX/pageY）
//     phase,       // 'start' | 'move' | 'end' | 'cancel'
//     pointers }   // 手指数（v1 恒为 1，为多指留位）
//
// ★ `dx/dy` 非得自己算不可：`react-native-gesture-handler` 的 `translationX` **不是
// "按下即起算"**（默认 Pan 有激活阈值，实测偏 20px）。若把它原样漏给应用，
// 罗盘那类"按下即转"的交互会**起步少一截**；而应用读的是我们的契约，
// 所以将来换实现（RNGH / 多指）**不动应用代码**。
//
// ## 为什么只包这一次
//
// 组件对象必须**只建一次**：每次渲染新建一个包装组件，React 会看到"类型变了"，
// 把整棵子树卸载重挂（组件内部 state / 动画归零）—— 本仓库在 `registerLibrary`
// 的注释里已经记过这条，这里是同一个坑的另一面。

import React, { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';

/** 点按判定：位移不超过这么多像素、且时间不超过这么多毫秒。 */
const TAP_SLOP = 8;
const TAP_MS = 500;

/**
 * 把一个基础组件包成"手势可用"的版本。
 *
 * 认两个 prop（由库侧的 `on_raw("pan" / "tap", …)` 经 `map_event` 兜底成 camelCase 而来）：
 * `onPan` / `onTap`。它们**不会**被继续传给底层组件（RN 不认识它们，传下去只会被静默忽略）。
 */
export function withGestures(Base, displayName) {
  function GestureCapable(props) {
    const { onPan, onTap, ...rest } = props;
    const start = useRef({ x: 0, y: 0, t: 0 });

    const responder = useMemo(() => {
      const emit = (handler, n, phase) => {
        if (typeof handler !== 'function') return;
        handler({
          // `x/y`：**元素内**坐标（RN 的 `locationX/locationY`）。
          // ⚠️ 它们的参照系是"**最深的被触摸 view**"，可能不是挂着手势的那个元素 ——
          //    实测：拖动区里放了一行文字，起始点落在文字上 → `locationX` 相对**文字**；
          //    手指滑出文字范围后 RN 换了参照系。所以它们只适合"当下位置"，**不能拿来算位移**。
          x: n.locationX,
          y: n.locationY,
          // ★ `dx/dy`：**从按下起算**，用**屏幕坐标**算（`pageX/pageY`）——参照系永远稳定。
          //   用 `locationX` 差值算的话，上面那个参照系切换会让位移**跳**：
          //   实测横滑 80px 报出 `dx=155`（多出来的正是"文字 → 父 View"那一跳）。
          dx: n.pageX - start.current.px,
          dy: n.pageY - start.current.py,
          ax: n.pageX,
          ay: n.pageY,
          phase,
          pointers: 1,
        });
      };
      return PanResponder.create({
        // 有点击/拖动处理器才去抢响应者 —— 没挂手势的元素行为**一字不变**。
        onStartShouldSetPanResponder: () => typeof onPan === 'function' || typeof onTap === 'function',
        onMoveShouldSetPanResponder: () => typeof onPan === 'function',
        onPanResponderGrant: (e) => {
          const n = e.nativeEvent;
          // 基准点用**屏幕坐标**（见 `emit` 里的说明），`locationX/Y` 只作为起点参考。
          start.current = { px: n.pageX, py: n.pageY, x: n.locationX, y: n.locationY, t: Date.now() };
          emit(onPan, n, 'start');
        },
        onPanResponderMove: (e) => emit(onPan, e.nativeEvent, 'move'),
        onPanResponderRelease: (e) => {
          const n = e.nativeEvent;
          emit(onPan, n, 'end');
          // 点按：位移够小、时间够短才算 —— 否则拖一下就会误触发点按。
          // 位移同样用**屏幕坐标**算（与 `dx/dy` 同一个理由）。
          const moved = Math.hypot(n.pageX - start.current.px, n.pageY - start.current.py);
          if (typeof onTap === 'function' && moved <= TAP_SLOP && Date.now() - start.current.t <= TAP_MS) {
            emit(onTap, n, 'end');
          }
        },
        onPanResponderTerminate: (e) => emit(onPan, e.nativeEvent, 'cancel'),
      });
    }, [onPan, onTap]);

    return React.createElement(Base, { ...rest, ...responder.panHandlers });
  }
  GestureCapable.displayName = `GestureCapable(${displayName || Base.displayName || Base.name || 'Component'})`;
  return GestureCapable;
}

/**
 * 把组件表整体包一遍，**每个组件只包一次**（模块级缓存）。
 *
 * 重复调用是安全的：同一份输入拿回同一份输出，于是 React 不会因为
 * "类型变了"而重挂子树。
 */
const cache = new WeakMap();
export function withGestureComponents(components) {
  const out = {};
  for (const [name, Base] of Object.entries(components || {})) {
    let wrapped = cache.get(Base);
    if (!wrapped) {
      wrapped = withGestures(Base, name);
      cache.set(Base, wrapped);
    }
    out[name] = wrapped;
  }
  return out;
}
