import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent 做的是 AppRegistry.registerComponent('main', () => App)，
// 并保证 Expo Go 与本机构建两种形态下环境都装好了。**Expo 的入口约定，不用改。**
registerRootComponent(App);
