// 由 `npx moobile-host regen` 生成 —— **不要手改**。
//
// 依据：本目录 package.json 的 dependencies。加能力就 `npm install` 那个包，然后重跑 regen。
// `--host webview` 的默认依赖里没有一个能力包（`db` 要 `expo-sqlite`，静态站点上也没有），
// 所以这里是空的 —— 真要用数据库，得先给这个宿主找一条替代路线（IndexedDB / sql.js 之类）。
export const registry = [];
