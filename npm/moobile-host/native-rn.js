// 平台替代物（`MOBILE_HOST.native`）在 React Native 上的实现。
//
// ⚠️ **这一层与 `capabilities/` 是两件不同的事，策略正好相反，别混：**
//
//   `capabilities/<name>.js` → `MOBILE_HOST.<name>`
//       应用**声明要用**的能力（如 `db` ← expo-sqlite）。缺失 = **抛错**，
//       因为"应用要了却没装"必须立刻说清楚。由 `moobile-host regen` 按依赖生成。
//
//   `native.<name>` → `MOBILE_HOST.native.<name>`
//       某个**浏览器 API 在本平台上的替代物**（如 `visibility` ← AppState）。
//       缺失 = **回退 DOM**，因为 Web 上本来就该走 DOM，不需要谁来登记。
//       不经过 regen，也不要求应用 opt-in。
//
// 为什么需要这一层（而不是让库自己判断平台）：`#cfg(target="js")` **区分不了 Web 与 RN**
// —— RN 走的也是 js 目标。所以"这是不是浏览器"只能由**宿主声明**。
// 库侧的契约与回退逻辑见 `vendor/rabbita/cmd/host_native.mbt`。
//
// 每个能力的契约（方法名与语义）由**用它的那个能力包**定义：
//   visibility ← `vendor/rabbita/sub/sub.mbt` 的 `on_visibility_change`
//     subscribe(cb) -> unsubscribe
//     cb(hidden: boolean)   // 与 DOM 的 `document.hidden` 同义：true = 不可见
//   geometry  ← `@sub.on_resize`
//     subscribe(cb) -> unsubscribe
//     cb({ width, height })  // 对象或 JSON 字符串都行，库侧统一成字符串再严格解

import { AppState, Dimensions } from 'react-native';

/**
 * RN 提供得了的替代物。
 *
 * 形状约定：**能力对象挂方法，值域与库侧 `HostCapability` 的适配器一一对应**。
 * 现阶段两个适配器：`subscribe_bool`（布尔流）、`subscribe_json`（结构化载荷）。 */
export const RN_NATIVE = {
  /**
   * `@sub.on_visibility_change` ← DOM 的 `document.hidden` + `visibilitychange`。
   *
   * ⚠️ **语义是近似，不是等价**，两点写在这里免得以后当 bug 查：
   *   1. RN 的 `AppState` 只有 `active` / `background` / `inactive`，
   *      而 DOM 有 `visible` / `hidden` 两态。映射取 `state !== "active"` ——
   *      于是 iOS 转场期间的 `inactive` 会被算作"不可见"。
   *   2. 与 DOM 那条路一样**只在变化时推送**，不补发当前状态 ——
   *      两端行为一致，所以应用看到的初始时机不会因平台而异。
   */
  visibility: {
    subscribe(cb) {
      const sub = AppState.addEventListener('change', (state) => {
        cb(state !== 'active');
      });
      return () => sub.remove();
    },
  },
  /**
   * `@sub.on_resize` ← DOM 的 `window.innerWidth/innerHeight` + `resize` 事件。
   *
   * ⚠️ **这一条原来在 RN 上是"静默失效"**：`window` 存在（RN 做了 `global.window = global`），
   * 但 `innerWidth` / `innerHeight` 是 `undefined` → 库侧按 `Int` 接住就是 **0×0，而且不抛**。
   * 它比 `on_key_down` 那类"会抛"的危险得多 —— 所以先修的是它（`tools/cap_platform.mjs`
   * 会把"静默给错值"这一类单独报出来）。
   *
   * 语义上与 DOM 那条**对齐**：同样只在**变化时**推送，不补发当前尺寸 ——
   * 想要初始尺寸请在应用侧自己取（两端一样），不要指望这条订阅先给你一个值。
   * （`Dimensions.get('window')` 拿得到，但在这里补发会让两端行为不一致。）
   */
  geometry: {
    subscribe(cb) {
      const sub = Dimensions.addEventListener('change', ({ window }) => {
        // 取整：DOM 的 innerWidth 是整数，不取整会让两端出现小数差异
        cb({ width: Math.round(window.width), height: Math.round(window.height) });
      });
      return () => sub.remove();
    },
  },
  // 缺口（N5b 剩下的）：
  //   on_scroll        ← ScrollView 的 onScroll 载荷（同属"静默给 0"那一类，下一个该修的）
  //   on_url_changed   ← Context::inject_url_changed（机制已有，只差接线）
  //   on_url_request   ← 同源判断要从 window.location 改成 Context::get_origin
};

/**
 * 把 RN 替代物并进宿主选项。应用的 `native` 覆盖 RN 默认（便于测试与特例）。
 */
export function withNative(native) {
  return { ...RN_NATIVE, ...(native || {}) };
}
