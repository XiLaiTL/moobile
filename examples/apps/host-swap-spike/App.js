// 宿主侧的全部手写代码 —— 就这 4 行（与 `examples/apps/template/App.js` **逐字同形**）。
//
// ⚠️ 这个文件是 C0 的关键证据之一：**换宿主，应用侧一行都不用改**。
//    差异只在 `index.js`（入口）与构建配置（resolver）里 —— 见那两处的说明。
//
// 应用状态机来自**同一份 MoonBit 产物** `./moobile.js`（由 verify.mjs 现编现搬，
// 走的就是用户那条路：`moon build --target js` → `moobile-host build`）。
import { mountApp } from 'moobile-host';
import { app } from './moobile.js';
// 注册表也吃模板那一份（空的：模板没装能力）—— 不复制一份，免得两边漂。
import { registry } from '../template/registry.generated.js';

export default mountApp(app, { registry });
