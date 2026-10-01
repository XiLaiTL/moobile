// babel 配置 —— 这个应用**必须**有它。
//
// ★ 为什么（实测，2026-10-01）：
//   `@shopify/react-native-skia` 的 peer 是 `react-native-reanimated` + `react-native-worklets`，
//   而 reanimated 4 的 worklet 要**在 babel 阶段**被 `react-native-worklets/plugin` 转换。
//   在**这个工程里**（Expo SDK 57 + 无 `babel.config.js`）实测：原生侧
//   `libreanimated.so` / `libworklets.so` 都进了 APK，但 JS 侧一加载就报
//
//     Error: react-native-reanimated is not installed!   (OptionalDependencyNotInstalledError)
//
//   —— Skia 捕捉到 require 失败就报"没装"。加上这个文件（插件**放最后**，reanimated 的要求）
//   之后就好。
//
// ⚠️ 与 Expo 文档的关系：reanimated 那页写着 "No additional configuration is required.
//   Reanimated Babel plugin is automatically configured in babel-preset-expo"。
//   实测在**这个版本组合下不成立**（`babel-preset-expo@57.0.13` 的产物里没有自动挂它）。
//   这条是"文档说的 ≠ 这套版本组合下的实际"，所以写在这里而不是删掉。
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
