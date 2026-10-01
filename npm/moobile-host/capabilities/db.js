// 能力：本地数据库（`expo-sqlite`）。
//
// 这是 `MOBILE_HOST.db` 的宿主侧实现，契约由 MoonBit 侧的 `sqlite/sqlite.mbt` 定义：
//
//   exec(sql)                 -> Promise<void>
//   run(sql, paramsJson)      -> Promise<string>   // {"changes":n,"last_insert_row_id":n}
//   all(sql, paramsJson)      -> Promise<string>   // [{"id":1,...}, ...]
//
// 两个刻意的决定：
//   1. **键名用 snake_case** —— MoonBit 的 `derive(FromJson)` 按字段名直接对键，
//      不做大小写转换；
//   2. **参数与返回值都是 JSON 字符串** —— 边界上只传字符串，MoonBit 侧用 `@json` 解，
//      避免把 JS 对象逐个字段打字（理由见 `sqlite/sqlite.mbt` 顶部）。
//
// ⚠️ 本模块 `import 'expo-sqlite'`，所以**只有装了 expo-sqlite 的应用**才应该
// 在自己的 `registry.generated.js` 里引用它（`moobile-host regen` 会按依赖自动决定）。

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'moobile.db';

let dbPromise = null;
const open = () => (dbPromise ??= SQLite.openDatabaseAsync(DB_NAME));

// SQLite 没有布尔类型：绑定时把 true/false 变成 1/0。
// 读回来的 0/1 由 MoonBit 侧的 `Int` 字段接住（要不要解释成布尔由应用决定）。
const toBind = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v);

const parseParams = (paramsJson) =>
  paramsJson ? JSON.parse(paramsJson).map(toBind) : [];

/**
 * 装 `MOBILE_HOST.db`。只会使用**异步 API** —— 同步 API 在 Web 上依赖
 * `SharedArrayBuffer`（需要 crossOriginIsolated），是更脆的那一半。
 */
export function installDb() {
  globalThis.MOBILE_HOST.db = {
    exec: async (sql) => {
      const db = await open();
      await db.execAsync(sql);
    },
    run: async (sql, paramsJson) => {
      const db = await open();
      const r = await db.runAsync(sql, parseParams(paramsJson));
      return JSON.stringify({
        changes: r.changes,
        last_insert_row_id: r.lastInsertRowId,
      });
    },
    all: async (sql, paramsJson) => {
      const db = await open();
      const rows = await db.getAllAsync(sql, parseParams(paramsJson));
      return JSON.stringify(rows);
    },
  };
}
