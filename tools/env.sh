#!/usr/bin/env bash
# env.sh —— 每个新 shell 都要设的变量，一次 source 搞定。
#
#   source tools/env.sh
#
# 内容与 `DEV.md` §1「每个新 shell 都要设的环境变量」一致 ——
# 之所以做成脚本，是因为反复手敲这几行总会漏一个（漏 `ANDROID_HOME` 的表现是
# Gradle 报 "SDK location not found"，漏 `JAVA_HOME` 的表现是 Gradle 找不到 JDK）。
#
# ⚠️ 刻意**不设** GRADLE_USER_HOME —— 让 `~/.gradle` 的目录联接生效（指向 E:\BACKUP\.gradle）。

export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_AVD_HOME='E:\avd'
export JAVA_HOME="/d/Program Files/Java/jdk-17.0.5"
# adb / emulator 直接可用（DEV.md 里的命令都是裸调用的）
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

echo "env: ANDROID_HOME=$ANDROID_HOME"
echo "env: JAVA_HOME=$JAVA_HOME"
