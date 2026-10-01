---
name: Bug 报告
about: 渲染不对 / 编译不过 / 真机与 Web 行为不一致
labels: [bug]
---

## 环境

| 项 | 值 |
|---|---|
| moobile 版本 | <!-- 月亮包版本（moon.mod 里的）；宿主包 version --> |
| 平台 | <!-- Web / Android（版本 + 真机 or 模拟器）/ 两者都有 --> |
| 是发布版还是本地工作区 | <!-- `moon add XiLaiTL/moobile@x.y.z` 还是 moon.work 本地源码 --> |
| RN / Expo / React | |

## 现象

<!-- 期望什么、实际什么。渲染问题请附图（截图或 uiautomator dump 的片段）。 -->

## 复现

```bash
# 最小复现步骤 / 片段
```

## 诊断信息（能跑就跑）

```bash
bash tools/verify_all.sh        # 离线检查的输出
node tools/console_dump.js      # Web 白屏时特别有用：把 console / exception / 网络失败都打出来
```

<!-- Windows 上如果是安卓：adb 版本、AVD 名、ABI（x86_64 还是 x86）。 -->
