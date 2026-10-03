// 由 `moobile-host libgen` 生成 —— **不要手改**。
//
// 组件库：react-native-markdown-display@7.0.2（命名空间 `md:`）
// 生成器：moobile-host libgen 0.4.0｜manifest 版本 1
// 清单：改动请改 manifest 后重跑 `libgen`，或改这里的 `libgen.config.json`。
//
// 组件 1 个（含复合子组件共 1 个键）｜平台 [android, ios, web]｜JSON 通道的组件 1 个

import * as md from 'react-native-markdown-display';

/** 在宿主启动时调用一次；返回实际注册的组件名（便于启动日志与验证脚本断言）。 */
export function registerMd(registerLibrary) {
  return registerLibrary({
    namespace: 'md',
    module: md,
    // 显式清单：与 MoonBit 侧生成物同源（见本文件头部说明）
    components: [
      'Markdown',
    ],
    platforms: ['android', 'ios', 'web'],
    // ⚠️ 这几个名字**只在模块的 `default` 导出上**（类型定义说有具名导出，JS 里没有）：
    //    这是人声明的（libgen.config.json 的 defaultExports），因为类型定义看不出来。
    //    不声明的话宿主**不会**回落，而是启动即报错（那样才知道是哪里不对）。
    defaultExports: ['Markdown'],
    // 结构化 prop（MoonBit 侧用 `prop_json` 传 JSON 文本，宿主这里 JSON.parse 后交给组件）
    jsonProps: {
      Markdown: [
        'rules',
      ],
    },
    // 事件键 → 组件库的 prop 名。**这里刻意是身份映射**：生成的 MoonBit 侧写的是
    // `.on_raw("onClick", …)`（键就是 prop 名），于是不需要"猜落点"这一层 ——
    // 而 `MOBILE_HOST.events["<ns>:*"]` 是库级通配，任何组件共用同一张表。
    events: {
      onLinkPress: 'onLinkPress',
    },
  });
}
