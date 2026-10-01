// ⚠️ **生成物，不要手改** —— 由 `tools/gen_forwarders.py` 从
// `vendor/rabbita/sub/pkg.generated.mbti` 生成（那个文件又是 `moon info` 的产物）。
//
// 为什么有这一层：fork 住在 `vendor/rabbita/sub/`，但消费者不该看见 `vendor/`。
// 这个包**只做转发**（`pub using`）—— 于是 `import { "XiLaiTL/moobile/sub" }` 照旧可用。
//
// 改名字清单请改生成器（或先 `moon info` 再重跑），否则 `verify_all.sh` 会报漂移。

///|
// 转发 XiLaiTL/moobile/vendor/rabbita/sub 的公开面。
pub using @vendor {type RunningSub, type Scope, type Sub, type SubLoader, batch, custom_sub, every, none, on_animation_frame, on_key_down, on_key_up, on_mouse_move}
pub using @vendor {on_resize, on_scroll, on_url_changed, on_url_request, on_visibility_change}
