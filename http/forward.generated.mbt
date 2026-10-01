// ⚠️ **生成物，不要手改** —— 由 `tools/gen_forwarders.py` 从
// `vendor/rabbita/http/pkg.generated.mbti` 生成（那个文件又是 `moon info` 的产物）。
//
// 为什么有这一层：fork 住在 `vendor/rabbita/http/`，但消费者不该看见 `vendor/`。
// 这个包**只做转发**（`pub using`）—— 于是 `import { "XiLaiTL/moobile/http" }` 照旧可用。
//
// 改名字清单请改生成器（或先 `moon info` 再重跑），否则 `verify_all.sh` 会报漂移。
//
// ⚠️ 本目录里**还有手写文件**（它们不在生成器的比对范围里）：
//      · `stream.mbt`
//    它们要的 import 由 `tools/gen_forwarders.py` 的 `EXTRA` 表写进 `moon.pkg`。

///|
// 转发 XiLaiTL/moobile/vendor/rabbita/http 的公开面。
pub using @vendor {type Body, type Request, type RequestWithBody, type ContentType, delete, get, patch, post, put}
