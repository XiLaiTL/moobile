// 裸 RN（无 Expo）的入口 —— 与 Expo 模板的 `registerRootComponent(App)` 等价的那两行。
//
// Expo 的 `registerRootComponent` 做的就是 `AppRegistry.registerComponent('main', () => App)`
// （外加 Expo Go 的环境准备）；桌面宿主不带 Expo，所以直接用 RN 自己的 `AppRegistry`。
import { AppRegistry } from 'react-native';

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
