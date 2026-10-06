// 静态 Web 宿主的入口 —— 与 `--host expo` 那份（`registerRootComponent(App)`）的差别只有这几行。
//
//   Expo：        import { registerRootComponent } from 'expo';  registerRootComponent(App);
//   这里（零 Expo）：RN 自己的 `AppRegistry` + 静态 `index.html` 里的 `#root`
//
// `react-native` 这个名字由**构建配置**映射到 `react-native-web`
// （`build-web.mjs` 里一行 `alias`，等价于 Metro / Expo 在 web 平台做的事）。
import { AppRegistry } from 'react-native';

import App from './App';

AppRegistry.registerComponent('main', () => App);
AppRegistry.runApplication('main', {
  rootTag: document.getElementById('root'),
  initialProps: {},
});
