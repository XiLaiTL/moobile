# tools/local —— **维护者本机专用**的脚本，不是项目的一部分

这里的脚本是为**某台具体机器**写的（磁盘布局迁移、Gradle 构建目录搬到别的盘），
换一台机器就未必适用，`CONTRIBUTING` 的流程也不依赖它们。

| 脚本 | 干什么 | 前提 |
|---|---|---|
| `link_builddirs.ps1` | 把 Gradle 的构建产物目录（`android/build`、`app/build`、几个 node_modules 里的 build）**做成目录联接**搬到别的盘，避免 C 盘被撑爆 | 需要管理员权限建联接；盘符写死在脚本里 |
| `migrate_c_to_e.ps1` | 把 Android SDK / AVD 数据从 C 盘搬到 E 盘并留联接 | 同上 |

> ⚠️ 它们**保留在仓库里**只是为了"换机器时照着改"，不需要的读者可以直接忽略。
> 里面的盘符（`E:\...`）是**本机现状**，不是项目要求 —— 这也是 `tools/check_public_leaks.py`
> 把它们标成 WARN 而不是 LEAK 的原因：公开仓库里出现本机路径不好看，但它们不是泄漏。
