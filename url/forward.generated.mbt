// ⚠️ **生成物，不要手改** —— 由 `tools/gen_forwarders.py` 从
// `vendor/rabbita/url/pkg.generated.mbti` 生成（那个文件又是 `moon info` 的产物）。
//
// 为什么有这一层：fork 住在 `vendor/rabbita/url/`，但消费者不该看见 `vendor/`。
// 这个包**只做转发**（`pub using`）—— 于是 `import { "XiLaiTL/moobile/url" }` 照旧可用。
//
// 改名字清单请改生成器（或先 `moon info` 再重跑），否则 `verify_all.sh` 会报漂移。

///|
// 转发 XiLaiTL/moobile/vendor/rabbita/url 的公开面。
pub using @vendor {type Protocol, type Url, type UrlRequest, parse}
