// ⚠️ **生成物，不要手改** —— 由 `tools/gen_forwarders.py` 从
// `vendor/rabbita/html/pkg.generated.mbti` 生成（那个文件又是 `moon info` 的产物）。
//
// 为什么有这一层：fork 住在 `vendor/rabbita/html/`，但消费者不该看见 `vendor/`。
// 这个包**只做转发**（`pub using`）—— 于是 `import { "XiLaiTL/moobile/html" }` 照旧可用。
//
// 改名字清单请改生成器（或先 `moon info` 再重跑），否则 `verify_all.sh` 会报漂移。

///|
// 转发 XiLaiTL/moobile/vendor/rabbita/html 的公开面。
pub using @vendor {type Attrs, type AutoComplete, type EventDecoders, type Html, type InputType, type Payload, type Scope, type Target, type Keyboard, type Mouse, type Scroll, trait IsChildren}
pub using @vendor {a, abbr, address, area, article, aside, audio, b, base, bdi, bdo, blockquote}
pub using @vendor {body, br, button, canvas, caption, cite, code, col, colgroup, data, datalist, dd}
pub using @vendor {del, details, dfn, dialog, div, dl, dom_decoders, dt, em, embed, event_decoders, fencedframe}
pub using @vendor {fieldset, figcaption, figure, footer, form, form_value_from_event, fragment, geolocation, h1, h2, h3, h4}
pub using @vendor {h5, h6, head, header, hgroup, hr, html, i, iframe, img, input, ins}
pub using @vendor {kbd, label, legend, li, link, main_, map, mark, math, menu, meta, meter}
pub using @vendor {nav, node, noscript, nothing, object, ol, optgroup, option, output, p, passthrough_decoders, picture}
pub using @vendor {pre, progress, q, rp, rt, ruby, s, samp, script, search, section, select}
pub using @vendor {selectedcontent, slot, small, source, span, strong, style_tag, sub, summary, sup, svg, table}
pub using @vendor {tbody, td, template, text, textarea, tfoot, th, thead, time, title, tr, track}
pub using @vendor {u, ul, var_, video, wbr}
