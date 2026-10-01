// 宿主侧的**全部手写代码** —— 就这 4 行。
//
// 契约实现（`MOBILE_HOST`、组件表、调度钩子、后端地址）、契约版本比对、
// 能力注册表的安装与核对，都在 `moobile-host` 包里。
//
// `moobile.js` 是 MoonBit 的构建产物，由 `npm run build` 生成（不用手写、不要提交）。
// `registry.generated.js` 由 `npx moobile-host regen` 从 package.json 的依赖生成 ——
// 加能力 = `npm install` 那个包 + 重跑 regen，不要手改。
import { mountApp } from 'moobile-host';
import { app } from './moobile.js';
import { registry } from './registry.generated.js';

export default mountApp(app, { registry });
