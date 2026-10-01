#!/usr/bin/env bash
# android_env_setup.sh —— 幂等地把 Android 侧的「本机特殊配置」施加一遍。
#
# 为什么需要它：`npx expo prebuild` 会重写 examples/apps/todo-app/host/android/ 下的
#   gradle/wrapper/gradle-wrapper.properties   → Gradle 版本被改回 9.3.1（必然构建失败）
#   gradle.properties                          → ABI / JDK 路径 / 内存设置会丢
#   build.gradle, settings.gradle              → 阿里云镜像会丢
# 只要跑过 prebuild，就重跑一次本脚本。
#
# 用法：
#   bash tools/android_env_setup.sh            # 修回来
#   bash tools/android_env_setup.sh --check    # 只检查，不改
#   bash tools/android_env_setup.sh --save     # 把当前文件存为"已知良好"副本
#
# 实现上刻意的取舍：只用 bash + sed，**不用 python heredoc**
# （Git Bash 下 python heredoc 会触发 cmd 级解析错误）。
# build.gradle / settings.gradle 用"保存已知良好副本 + 还原"而不是打补丁。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# 目标安卓工程：默认 todo-app 的宿主；`--app <工程目录>` 可以指到别的应用
# （为什么需要：`examples/apps/canvas-demo` 是**可选特性自己的示例**，它也要 prebuild，
#  而这条修复对它同样必需 —— 工具不该只服务某一个 demo。）
APP_HOST="$ROOT/examples/apps/todo-app/host"
MODE="apply"
while [ $# -gt 0 ]; do
  case "$1" in
    --check) MODE="check"; shift ;;
    --save)  MODE="save"; shift ;;
    --app)   APP_HOST="$2"; shift 2 ;;
    --app=*) APP_HOST="${1#--app=}"; shift ;;
    *) echo "未知参数: $1（用法：android_env_setup.sh [--check|--save] [--app <工程目录>]）"; exit 2 ;;
  esac
done
# 相对路径按调用者的 cwd 解析（脚本自己会 cd 到别处，所以这里就定死）
case "$APP_HOST" in
  /*|[A-Za-z]:*) ;;
  *) APP_HOST="$(pwd)/$APP_HOST" ;;
esac
AND="$APP_HOST/android"
CFG="$ROOT/tools/android-config"

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
  echo "已保存已知良好副本到 tools/android-config/："
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
        printf '         （已从 tools/android-config/%s 还原）\n' "$f"
      else
        printf '         ⚠ 没有副本可还原：先手动加镜像后跑 --save\n'
      fi
    fi
  fi
done

# ------------------------------------------------------ 4) 目录联接（产物 -> E 盘）
echo "=== 4) 目录联接（构建产物 -> E 盘）"
PS="$ROOT/tools/link_builddirs.ps1"
if [ -f "$PS" ]; then
  powershell -NoProfile -ExecutionPolicy Bypass -File "$PS" 2>&1 | sed -n '/=== result/,$p' | sed 's/^/  /'
else
  printf '  [--]   缺 %s，跳过\n' "$PS"
fi

# ------------------------------------------------- 4.5) SDK 位置（local.properties）
# 为什么要有这一步：`expo prebuild` 会把 `android/` 整个重建（它本来就被 gitignore），
# 于是 `local.properties` 一起没了 —— 而 Gradle 找不到 SDK 时的报错是：
#   "SDK location not found. Define a valid SDK location with an ANDROID_HOME
#    environment variable or by setting the sdk.dir path in .../local.properties"
# 实测（2026-09-21）：不补这一步，"prebuild → android_env_setup → gradlew"这条
# **文档里写的流程**跑不通。写进 local.properties 而不是只依赖环境变量，
# 是因为 Gradle 在 Android Studio 之外也常被直接调用（CI / 脚本），环境变量不一定传下去。
# ⚠️ 这个文件是 gitignore 的（在 `android/` 里），所以写本机路径**不会**进仓库 ——
# 而 `tools/check_public_leaks.py` 恰好就是挡"本机绝对路径"的，别把它放进受扫描的文件。
echo "=== 4.5) SDK 位置（local.properties）"
SDK_GUESS="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$LOCALAPPDATA/Android/Sdk}}"
LP="$AND/local.properties"   # ⚠️ $AND 已经是 .../host/android，别再拼一层
SDK_WIN="$(cygpath -m "$SDK_GUESS" 2>/dev/null || printf '%s' "$SDK_GUESS")"
if [ -f "$LP" ] && grep -q "^sdk.dir=" "$LP"; then
  ok "local.properties 已有 sdk.dir"
else
  if [ -d "$SDK_GUESS" ]; then
    need "写 local.properties 的 sdk.dir=$SDK_WIN"
    if [ "$MODE" = apply ]; then
      printf "sdk.dir=%s\n" "$SDK_WIN" > "$LP"
      printf '         （已写入 %s）\n' "$LP"
    fi
  else
    die "找不到 Android SDK（试过 ANDROID_HOME / ANDROID_SDK_ROOT / %s）" "$LOCALAPPDATA/Android/Sdk"
  fi
fi
# ------------------------------------------------------------------ 5) 依赖检查
echo "=== 5) 外部依赖检查"
[ -d "$APP_HOST/node_modules/@react-native/gradle-plugin" ] && ok "node_modules 已安装" \
  || die "node_modules 缺失：先 cd $APP_HOST && npm install"
[ -x "$JDK_PATH/bin/javac" ] && ok "JDK: $JDK_PATH" || die "找不到 JDK：$JDK_PATH"
[ -x "$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" ] && ok "Android SDK 可达（经目录联接）" \
  || die "Android SDK 不可达"
if [ -f "$APP_HOST/node_modules/expo-modules-autolinking/build/index.js" ]; then
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
