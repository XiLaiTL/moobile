// ⚠️ **生成物，不要手改** —— 由 `tools/gen_forwarders.py` 从
// `vendor/rabbita/cmd/pkg.generated.mbti` 生成（那个文件又是 `moon info` 的产物）。
//
// 为什么有这一层：fork 住在 `vendor/rabbita/cmd/`，但消费者不该看见 `vendor/`。
// 这个包**只做转发**（`pub using`）—— 于是 `import { "XiLaiTL/moobile/cmd" }` 照旧可用。
//
// 改名字清单请改生成器（或先 `moon info` 再重跑），否则 `verify_all.sh` 会报漂移。

///|
// 转发 XiLaiTL/moobile/vendor/rabbita/cmd 的公开面。
pub using @vendor {type Cmd, type EffectKind, type Emit, type Injector, type Op, type OpCont, type Runner, type Settle, after_render, attempt, batch, custom_cmd}
pub using @vendor {delay, effect, immediately, none, perform}
