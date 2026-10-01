// 由 `npx moobile-host regen` 生成 —— **不要手改**。
//
// 依据：本目录 package.json 的 dependencies。
// 加能力就 `npm install` 那个包，然后重跑 regen。
//
// 已识别：
//   · db  ← expo-sqlite（本地数据库（expo-sqlite））

import { installDb } from 'moobile-host/capabilities/db';

export const registry = [
  { name: 'db', provider: 'expo-sqlite', install: installDb },
];
