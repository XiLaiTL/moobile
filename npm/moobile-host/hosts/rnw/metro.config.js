// Metro 配置（裸 RN）。
//
// 与 `--host expo` 那份的差别就是这一行：Expo 用 `expo/metro-config`，裸 RN 用
// `@react-native/metro-config`。**应用侧的 MoonBit 代码两种宿主下完全一样。**
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

module.exports = mergeConfig(getDefaultConfig(__dirname), {});
