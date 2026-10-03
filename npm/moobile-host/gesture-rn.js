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
import { PanResponder, Platform } from 'react-native';

/** 点按判定：位移不超过这么多像素、且时间不超过这么多毫秒。 */
const TAP_SLOP = 8;
const TAP_MS = 500;

/**
 * ★★ **`x`/`y` 要不要走"量元素原点"这条路？**（真机证据逼出来的分支）
 *
 * 契约说 `x`/`y` 是"**元素内**坐标"，即相对**挂手势的那个元素**。
 * 两个平台的 `locationX/locationY` 给的**不是同一个东西**：
 *
 * - **RNW（web）**：给的就是挂手势那个元素的局部坐标 —— 实测通过
 *   （`gesture-spike` 的 E2：子元素故意偏开 (20,10)，起点仍报 `50,30`，即父元素坐标系）。
 *   而且**不能**改成量测：RNW 的 `measure`/`measureInWindow` 给的是
 *   `getBoundingClientRect()` 的**视口**坐标，而触摸的 `pageX/pageY` 是 **DOM 的文档**坐标
 *   （页面一滚两者差一个 `scrollY`），相减会**只在"页面滚动过"时才错** ——
 *   那比现在更坏（现在的验证页面不滚，测不出来）。
 * - **原生（Android）**：给的是**手指底下最深的那个 view** 的局部坐标，
 *   而且**会在手势中途换掉**。实测（`gesture-edges`：从子元素上按下、右滑 40px）
 *   `深xs = [6, 7, 79, 89, 98, 99, 108, 109]` —— 头两个 `6,7` 是那个 `子` 字**自身**的
 *   局部坐标，从第三个起才变成子元素的坐标系（`79…110`）。契约要的是 `130 → 170`
 *   （相对挂手势的盒）。**同一串事件里换了参照系**，应用怎么算都是错的。
 *   ⇒ 所以原生侧自己量元素原点（`measure` 给的 `pageX/pageY` 与触摸的 `pageX/pageY`
 *   同为"相对根视图"），用 `pageX/pageY` 减出**稳定**的元素内坐标。
 *
 * 这也解释了历史上那次 `dx=155 dy=51`（横滑 80px）的事故：当时 `dx/dy` 用
 * `locationX` 的差值算，参照系在中途换了 —— 多出来的正是那一跳。
 * `dx/dy` 已经改用 `pageX/pageY`；`x/y` 是同一个陷阱的另一半，现在补上。
 */
const MEASURE_ORIGIN = Platform.OS !== 'web';

/**
 * 把一个基础组件包成"手势可用"的版本。
 *
 * 认两个 prop（由库侧的 `on_raw("pan" / "tap", …)` 经 `map_event` 兜底成 camelCase 而来）：
 * `onPan` / `onTap`。它们**不会**被继续传给底层组件（RN 不认识它们，传下去只会被静默忽略）。
 */
export function withGestures(Base, displayName) {
  function GestureCapable(props) {
    const { onPan, onTap, ...rest } = props;
    const hasPan = typeof onPan === 'function';
    const hasTap = typeof onTap === 'function';
    /**
     * 本次手势的状态。字段都在讲**同一件事的不同阶段**，分开写清楚免得混：
     * - `armed`：`grant` 过（**可能是投机的**，见下）——只有它才能让后面的相位发得出去。
     * - `started`：`start` 已经吐过了（契约：恰一次）。
     * - `over`：已经收尾，之后一律闭嘴。
     */
    const start = useRef({
      px0: 0, py0: 0, id: null, t: 0, v0: null,
      armed: false, started: false, over: true,
    });
    /** 挂手势的那个宿主节点（量它的原点用；拿不到就退回 `locationX/locationY`）。 */
    const hostRef = useRef(null);
    /**
     * 本次手势的几何状态：
     * - `ready`：原点已知（或平台不需要量）——只有它才能吐事件；
     * - `fallback`：量不出来（量测太久 / 节点不支持）→ 退回 `locationX/locationY`，
     *   **宁可坐标系不完美也不能把事件吞掉**。
     */
    const geom = useRef({ state: MEASURE_ORIGIN ? 'idle' : 'ready', ox: 0, oy: 0 });
    /** 等量测期间攒下的事件（只有"量测比一次轻点还慢"这种罕见情况才会用到）。 */
    const queue = useRef([]);

    const responder = useMemo(() => {
      const primary = (n) => {
        const touches = n.touches || [];
        if (start.current.id !== null) {
          const t = touches.find((x) => x.identifier === start.current.id);
          if (t) return t;
        }
        return n;
      };
      const pointers = (n, g) =>
        Math.max((g && g.numberActiveTouches) || 0, (n.touches || []).length, 1);
      /** 一次事件的"原值"。`start` 用的是 grant 那一刻的快照（见 `confirmStart`）。 */
      const ready = () => geom.current.state === 'ready' || geom.current.state === 'fallback';
      /**
       * ★★ **同一个参照系**：把"一次触摸的原始值"换算成契约里的 `x/y`。
       *
       * 修的是这样一件事（真机量出来的）：`grant` 那一刻量测**还没回来**，
       * 于是 `start` 的坐标走了"退回 `locationX`"那条路，而随后的 `move` 用的是
       * `pageX − 原点` —— **同一次手势里两个参照系**（原生上 `locationX` 是"手指底下最深
       * 那个 view"的坐标，与"挂手势的元素"差一截）。
       * 后果实测：拖 45° 只转约 5°（起点错、后续增量对，于是净旋转被啃掉一截）。
       * 这与本文件顶上记的那次 `dx=155` 事故是**同一类**，只是发生在 `x/y` 这一半。
       *
       * 所以起点坐标**不在 grant 时定死**：存原始值，等量测回来再换算（`v0Of`）。
       */
      const xyOf = (raw) => {
        const g0 = geom.current;
        if (g0.state === 'ready' && MEASURE_ORIGIN) {
          return { x: raw.pageX - g0.ox, y: raw.pageY - g0.oy };
        }
        return { x: raw.locationX, y: raw.locationY };
      };
      const values = (n, g) => {
        const p = primary(n);
        // ★ `x/y`：原点已知就用 `pageX/pageY − 原点`（**参照系永远稳定**）；
        //    否则退回 `locationX/locationY`（web 上这本来就是对的）。
        const xy = xyOf(p);
        return { x: xy.x, y: xy.y, ax: p.pageX, ay: p.pageY, pointers: pointers(n, g) };
      };
      const emitWith = (handler, v, phase) => {
        if (typeof handler !== 'function') return;
        handler({
          x: v.x,
          y: v.y,
          dx: v.ax - start.current.px0,
          dy: v.ay - start.current.py0,
          ax: v.ax,
          ay: v.ay,
          phase,
          pointers: v.pointers,
        });
      };

      /**
       * ★★ **确认真的拿到这次手势之后，才吐 `start`。**
       *
       * 这一条是真机逼出来的，`gesture-edges` 的 `外 n=6 序外=ssssss` 就是它：
       * 内外两层都挂 `on_pan` 时，**外盒收到了 6 次 `start`、零 move**。
       *
       * 真因在 RN 内部（`ReactFabric-dev.js` 的 `setResponderAndExtractTransfer`）：
       * 它先把 `responderGrant` **池化并直接派发**给候选者（`executeDirectDispatch`），
       * 拿它的**布尔返回值**当"要不要挡住原生响应者"的判断，**然后**才去问当前响应者
       * `responderTerminationRequest` 让不让。让，就补一个 `responderTerminate`；
       * **不让，候选者拿一个 `responderReject` 就完了 —— 可那个 `grant` 已经跑过了**。
       *
       * 也就是说：**Android 上的 `onPanResponderGrant` 不是"你拿到了"的信号，
       * 它是个"你要不要"的询问**。而 web 宿主（RNW）只在允许转移时才调 `grant`
       * （`ResponderSystem.attemptTransfer` 里写在 `if (allowTransfer)` 分支内），
       * 所以这个坑在 web 上**看不见** —— 这正是"两端行为不同、必须真机量"的那类。
       *
       * 可靠的信号是 `onPanResponderStart`：两端都只派发给**真正的响应者**
       * （Android 派发给刚 `changeResponder` 之后的 `responderInst`；
       * RNW 派发给 `currentResponder`）。`start` 用 grant 那一刻的**数值快照**
       * 发出，所以"起点 = 按下点、`dx=0`"这条不受影响 —— 确认事件与 grant 是同一个 DOWN。
       */
      /** 起点的坐标：**按量测后的参照系**换算（量测没回来就不该被调用，见调用点）。 */
      const v0Of = () => {
        const raw = start.current.v0raw;
        const xy = xyOf(raw);
        return { x: xy.x, y: xy.y, ax: raw.pageX, ay: raw.pageY, pointers: raw.pointers };
      };
      const confirmStart = () => {
        const s = start.current;
        if (!s.armed || s.started || s.over || !s.v0raw) return;
        // 量测还没回来就把 `start` 挂起（`wantStart`）——`start` 的坐标不能用估的，
        // 一旦用 `locationX` 吐出去，应用拿到的起点就落在**别的参照系**里（正是要修的那个 bug）。
        if (!ready()) {
          s.wantStart = true;
          return;
        }
        s.started = true;
        emitWith(onPan, v0Of(), 'start');
      };
      /**
       * 吐一个相位。量测还没回来时：非收尾相位**攒起来**（几毫秒的事），
       * 收尾相位则**立刻退回 `locationX` 放行** —— 宁可坐标系退化，也不能把
       * "这次手势结束了"吞掉（那会让应用永远等不到 `end`）。
       */
      const emitPhase = (handler, v, phase) => {
        if (ready()) {
          emitWith(handler, v, phase);
          return;
        }
        if (phase === 'end' || phase === 'cancel') {
          geom.current.state = 'fallback';
          drainQueue();
          emitWith(handler, v, phase);
          return;
        }
        if (queue.current.length < 32) queue.current.push({ handler, v });
      };
      /** 量测回来（或退回）之后：补吐挂起的 `start`，再把攒下的相位按顺序放出去。 */
      const drainQueue = () => {
        const s = start.current;
        if (!ready()) return;
        if (s.wantStart && s.armed && !s.started && !s.over && s.v0raw) {
          s.wantStart = false;
          s.started = true;
          emitWith(onPan, v0Of(), 'start');
        }
        const q = queue.current;
        queue.current = [];
        for (const it of q) emitWith(it.handler, it.v, it.phase);
      };
      return PanResponder.create({
        // 有点击/拖动处理器才去抢响应者 —— 没挂手势的元素行为**一字不变**。
        onStartShouldSetPanResponder: () => hasPan || hasTap,
        onMoveShouldSetPanResponder: () => hasPan,
        /**
         * ★ **半途让不让别人抢走**（web 上验出来的取舍，见 `gesture-spike` 的 E1）。
         *
         * 挂了 `onPan` → **不让**：按下那一刻它就判定"这次是拖动"，半途换人等于把一次
         * 连续拖动劈成两段，两边都算错。只挂 `onTap` → **让**：可点元素必须把滚动让给
         * 外层的 `ScrollView`，否则列表里放一个可点行就把滚动锁死了（经典 bug）。
         */
        onPanResponderTerminationRequest: () => !hasPan,
        /**
         * ★ **同一个策略的另一半，而且是 Android 独有的那一半。**
         *
         * `PanResponder` 把这个回调的返回值当作 `onResponderGrant` 的返回值交回 RN，
         * 而 RN 用它决定"**要不要挡住原生组件**"。默认（不写这个回调）是 `true`：
         * **原生 `ScrollView` 就再也收不到这次触摸了**。
         *
         * 实测（`gesture-edges` 的 ④）：只挂 `onTap` 的块放在 `scroll` 里，竖滑
         * **内容一点都不动**（哨兵 `底B 见` 始终不出现）—— 而它旁边的正对照（同一容器里
         * 一个没有任何手势的块）滑得动。也就是说：光有 `TerminationRequest` 让不让
         * 还不够，"让"在 Android 上要**两处都让**。
         *
         * 所以策略与上面那条**逐字一致**：挂了 `onPan` → 挡（我们要这次拖动）；
         * 只挂 `onTap` → 不挡（滚动必须能把它抢走，否则列表里放一个可点行就锁死滚动）。
         */
        onShouldBlockNativeResponder: () => hasPan,
        onPanResponderGrant: (e, g) => {
          const n = e.nativeEvent;
          // 基准点用**屏幕坐标**（见 `values` 里的说明），`locationX/Y` 只作为起点参考。
          // `id`：记下**这一根**手指，从此 `dx/dy` 只跟它。
          start.current = {
            px0: n.pageX,
            py0: n.pageY,
            id: typeof n.identifier === 'number' ? n.identifier : null,
            t: Date.now(),
            v0: null,
            armed: true,
            started: false,
            over: false,
            wantStart: false,
          };
          queue.current = [];
          // ★ 量元素原点（只有原生需要，见 `MEASURE_ORIGIN`）。**每次手势都重量一次**：
          //   元素可能因为布局变化或祖先滚动而挪过位置，用缓存会让 `x/y` 悄悄偏掉。
          geom.current = { state: MEASURE_ORIGIN ? 'idle' : 'ready', ox: 0, oy: 0 };
          if (MEASURE_ORIGIN) {
            const node = hostRef.current;
            if (node && typeof node.measure === 'function') {
              try {
                node.measure((_x, _y, _w, _h, px, py) => {
                  // 量测回来时这次手势可能已经结束了（清得掉就清，别污染下一次）。
                  if (geom.current.state === 'idle') {
                    geom.current = { state: 'ready', ox: px, oy: py };
                    drainQueue();
                  }
                });
              } catch {
                geom.current = { state: 'fallback', ox: 0, oy: 0 };
              }
            } else {
              // 量不出来（节点不支持）→ 立刻退回 `locationX`，别让事件卡住。
              geom.current = { state: 'fallback', ox: 0, oy: 0 };
            }
          }
          // ⚠️ 顺序：`primary` 要用刚写好的 `id`，所以快照必须在上面之后取。
          // ★ 这里**只存原始值**（`pageX/pageY/locationX/locationY`），不在这里换算 ——
          //   这一刻量测几乎一定还没回来，换出来的就是"另一个参照系"的坐标（见 `xyOf`）。
          start.current.v0raw = {
            pageX: n.pageX,
            pageY: n.pageY,
            locationX: n.locationX,
            locationY: n.locationY,
            pointers: pointers(n, g),
          };
          // 这里**不吐** `start` —— 这个 `grant` 可能只是询问，见 `confirmStart` 上面那段。
        },
        // ★ 被拒 = 刚才那个 `grant` 只是询问，我们并没有拿到这次手势。把待定清掉，
        //   否则应用会收到一个**根本没发生过**的 `start`。
        onPanResponderReject: () => {
          start.current.armed = false;
          start.current.started = false;
          start.current.over = true;
        },
        // ★ 真的拿到了：这才吐 `start`。
        onPanResponderStart: () => confirmStart(),
        onPanResponderMove: (e, g) => {
          if (!start.current.armed || start.current.over) return;
          confirmStart();
          emitPhase(onPan, values(e.nativeEvent, g), 'move');
        },
        onPanResponderRelease: (e, g) => {
          if (!start.current.armed || start.current.over) return;
          const n = e.nativeEvent;
          // 一次"按下即抬起"（点按）可能没有任何 move —— 这里补上 `start`。
          confirmStart();
          emitPhase(onPan, values(n, g), 'end');
          // 点按：位移够小、时间够短才算 —— 否则拖一下就会误触发点按。
          // 位移同样用**屏幕坐标**算（与 `dx/dy` 同一个理由）。
          const moved = Math.hypot(n.pageX - start.current.px0, n.pageY - start.current.py0);
          if (hasTap && moved <= TAP_SLOP && Date.now() - start.current.t <= TAP_MS) {
            emitPhase(onTap, values(n, g), 'end');
          }
          start.current.over = true;
          start.current.armed = false;
        },
        /**
         * ★ **主指先抬起**（还有别的手指按着）：这一次拖动的基准没了。
         * 继续按剩下的手指报 `dx` 等于**编造**（基准是你已经抬走的那根），
         * 所以这里按 `cancel` 收尾 —— 应用据此回滚，而不是把半截拖动当成完成。
         */
        onPanResponderEnd: (e, g) => {
          const n = e.nativeEvent;
          const remains = (n.touches || []).length;
          if (
            start.current.armed && start.current.started && !start.current.over &&
            remains > 0 && typeof n.identifier === 'number' && n.identifier === start.current.id
          ) {
            emitPhase(onPan, values(n, g), 'cancel');
            start.current.over = true;
            start.current.armed = false;
          }
        },
        onPanResponderTerminate: (e, g) => {
          if (!start.current.armed || start.current.over) return;
          // 还没吐过 `start` 就被终止 → 应用压根不知道这次手势，什么都别吐。
          if (start.current.started) emitWith(onPan, values(e.nativeEvent, g), 'cancel');
          start.current.over = true;
          start.current.armed = false;
        },
      });
    }, [onPan, onTap, hasPan, hasTap]);

    // `ref` 只用来量元素原点（`Base` 都是 RN 的宿主组件，能接 ref）。
    return React.createElement(Base, { ...rest, ref: hostRef, ...responder.panHandlers });
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
