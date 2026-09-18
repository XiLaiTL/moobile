name = "probe/app"

version = "0.1.0"

preferred_target = "js"

// 本地依赖靠 moon.work 的工作区解析（由 _tools/check_external.sh 生成）。
// 这里必须写版本号 —— 新版 moon.mod 的 import 只接受带版本的 registry 形式，
// 工作区解析时 `@版本号` 会被忽略。
import {
  "moobile/moobile@0.1.0",
}
