// 裸 RN（无 Expo）的入口 —— 与 `--host expo` 那份的 `registerRootComponent(App)` 等价。
//
// 桌面上**不用 Expo**：Expo SDK 钉的 RN 版本与 `react-native-windows` 要的对不上
// （RN 版本由宿主决定，库不绑版本），所以这一份自带 RN 0.83.x。
import { AppRegistry } from 'react-native';

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
