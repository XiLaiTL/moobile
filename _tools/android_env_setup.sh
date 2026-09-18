#!/usr/bin/env bash
# android_env_setup.sh —— 幂等地把 Android 侧的「本机特殊配置」施加一遍。
#
# 为什么需要它：`npx expo prebuild` 会重写 host/android/ 下的
#   gradle/wrapper/gradle-wrapper.properties   → Gradle 版本被改回 9.3.1（必然构建失败）
#   gradle.properties                          → ABI / JDK 路径 / 内存设置会丢
#   build.gradle, settings.gradle              → 阿里云镜像会丢
# 只要跑过 prebuild，就重跑一次本脚本。
#
# 用法：
#   bash _tools/android_env_setup.sh            # 修回来
#   bash _tools/android_env_setup.sh --check    # 只检查，不改
#   bash _tools/android_env_setup.sh --save     # 把当前文件存为"已知良好"副本
#
# 实现上刻意的取舍：只用 bash + sed，**不用 python heredoc**
# （Git Bash 下 python heredoc 会触发 cmd 级解析错误）。
# build.gradle / settings.gradle 用"保存已知良好副本 + 还原"而不是打补丁。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AND="$ROOT/host/android"
CFG="$ROOT/_tools/android-config"

MODE="apply"
case "${1:-}" in
  --check) MODE="check" ;;
  --save)  MODE="save" ;;
  "")      MODE="apply" ;;
  *) echo "未知参数: $1"; exit 2 ;;
esac

GRADLE_VER="8.14.3"
GRADLE_MIRROR="mirrors.cloud.tencent.com/gradle"
JDK_PATH="D:/Program Files/Java/jdk-17.0.5"
ABI="x86_64"

BEGIN="# MOOBILE_LOCAL_OVERRIDES_BEGIN"
END="# MOOBILE_LOCAL_OVERRIDES_END"

changed=0
ok()   { printf '  [ok]   %s\n' "$*"; }
need() { printf '  [%s] %s\n' "$([ "$MODE" = check ] && echo need || echo fix)" "$*"; changed=$((changed + 1)); }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ -d "$AND" ] || die "找不到 $AND —— 先 cd host && npx expo prebuild -p android"

# ---------------------------------------------------------------- 0) --save
if [ "$MODE" = save ]; then
  mkdir -p "$CFG"
  cp "$AND/gradle/wrapper/gradle-wrapper.properties" "$CFG/"
  cp "$AND/build.gradle" "$CFG/"
  cp "$AND/settings.gradle" "$CFG/"
  echo "已保存已知良好副本到 _tools/android-config/："
  ls -1 "$CFG"
  exit 0
fi

# ------------------------------------------------- 1) Gradle wrapper（必须 8.14.3）
echo "=== 1) Gradle wrapper 版本（必须 $GRADLE_VER；9.x 会必然失败）"
WRAP="$AND/gradle/wrapper/gradle-wrapper.properties"
[ -f "$WRAP" ] || die "缺 $WRAP"
WANT="distributionUrl=https\\\\://${GRADLE_MIRROR}/gradle-${GRADLE_VER}-bin.zip"
if grep -q "gradle-${GRADLE_VER}-bin.zip" "$WRAP" && grep -q "$GRADLE_MIRROR" "$WRAP"; then
  ok "已是 $GRADLE_VER（腾讯镜像）"
else
  need "重设 distributionUrl -> $GRADLE_VER @ $GRADLE_MIRROR"
  if [ "$MODE" = apply ]; then
    sed -i -E "s|^distributionUrl=.*|${WANT}|" "$WRAP"
    grep -q '^distributionUrl' "$WRAP" || echo "$WANT" >> "$WRAP"
    sed -n 's/^/         /p' <(grep '^distributionUrl' "$WRAP")
  fi
fi

# ------------------------------------------- 2) gradle.properties 的本机覆盖项
echo "=== 2) gradle.properties 的本机覆盖项"
GP="$AND/gradle.properties"
[ -f "$GP" ] || die "缺 $GP"
if grep -qF "$BEGIN" "$GP" && grep -qF "$END" "$GP"; then
  ok "已有管理块（重写以保持在文件末尾）"
  # 删除旧块（marker 不含 sed 元字符，安全）
  [ "$MODE" = apply ] && sed -i "/^${BEGIN}$/,/^${END}$/d" "$GP"
else
  need "追加覆盖块（jvmargs / ABI / JDK 路径）"
fi
if [ "$MODE" = apply ]; then
  {
    echo ""
    echo "$BEGIN"
    echo "# 放在文件末尾：Java properties 是后者覆盖前者。"
    echo "org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m"
    echo "kotlin.daemon.jvmargs=-Xmx2048m"
    echo "# 只编一个 ABI（默认 4 个）：构建体积与时间约为 1/4"
    echo "reactNativeArchitectures=${ABI}"
    echo "# 本机 JDK 不在 Gradle 的自动探测位置，显式指定（替代 foojay 插件）"
    echo "org.gradle.java.installations.paths=${JDK_PATH}"
    echo "$END"
  } >> "$GP"
fi

# ------------------------------------------------------ 3) Maven 镜像（阿里云）
echo "=== 3) Maven 镜像（阿里云）"
for f in build.gradle settings.gradle; do
  t="$AND/$f"
  [ -f "$t" ] || { printf '  [--]   %s 不存在，跳过\n' "$f"; continue; }
  if grep -q "maven.aliyun.com/repository/google" "$t"; then
    ok "$f 已有阿里云镜像"
  else
    need "$f 缺镜像 —— 从已知良好副本还原"
    if [ "$MODE" = apply ]; then
      if [ -f "$CFG/$f" ]; then
        cp "$CFG/$f" "$t"
        printf '         （已从 _tools/android-config/%s 还原）\n' "$f"
      else
        printf '         ⚠ 没有副本可还原：先手动加镜像后跑 --save\n'
      fi
    fi
  fi
done

# ------------------------------------------------------ 4) 目录联接（产物 -> E 盘）
echo "=== 4) 目录联接（构建产物 -> E 盘）"
PS="$ROOT/_tools/link_builddirs.ps1"
if [ -f "$PS" ]; then
  powershell -NoProfile -ExecutionPolicy Bypass -File "$PS" 2>&1 | sed -n '/=== result/,$p' | sed 's/^/  /'
else
  printf '  [--]   缺 %s，跳过\n' "$PS"
fi

# ------------------------------------------------------------------ 5) 依赖检查
echo "=== 5) 外部依赖检查"
[ -d "$ROOT/host/node_modules/@react-native/gradle-plugin" ] && ok "node_modules 已安装" \
  || die "node_modules 缺失：先 cd host && npm install"
[ -x "$JDK_PATH/bin/javac" ] && ok "JDK: $JDK_PATH" || die "找不到 JDK：$JDK_PATH"
[ -x "$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" ] && ok "Android SDK 可达（经目录联接）" \
  || die "Android SDK 不可达"
if [ -f "$ROOT/host/node_modules/expo-modules-autolinking/build/index.js" ]; then
  ok "expo-modules-autolinking/build 完好（是真实目录，不是空联接）"
else
  die "expo-modules-autolinking/build 缺失 —— 见 DEV.md §7 第 2 条的恢复命令"
fi

echo
if [ "$MODE" = check ]; then
  echo "检查完成，未做修改；有 $changed 处需要修（去掉 --check 再跑）。"
else
  echo "完成，修改了 $changed 处。"
  echo "提醒：wrapper / gradle.properties 的改动要重新跑一次 gradlew 才生效。"
fi
