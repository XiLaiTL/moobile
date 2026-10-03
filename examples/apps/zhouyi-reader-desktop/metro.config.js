// Metro 配置（裸 RN，不是 Expo）。
//
// 与 Expo 的模板相比只有一处必须改：**产物在隔壁工程里**。
// `moobile.js` 由 `examples/apps/zhouyi-reader/` 构建出来，桌面宿主 import `../zhouyi-reader/moobile.js`
// —— Metro 默认只看自己这个工程目录，所以要把隔壁加进 `watchFolders`，
// 否则报 `Unable to resolve module ../zhouyi-reader/moobile.js`（而且看起来像"产物没生成"）。
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/** @type {import('metro-config').MetroConfig} */
const config = {
  watchFolders: [path.resolve(__dirname, '..', 'zhouyi-reader')],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
