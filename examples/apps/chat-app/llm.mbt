///|
/// **OpenAI 兼容端点**的两件事：拼请求、取增量。
///
/// 刻意只有这两件 —— 协议解析写在这里，**传输**在 `@http.stream` 里，**状态机**在 `app.mbt` 里。
/// 三层各自可测：这一层是纯函数（无 IO、无平台），所以 `verify.mjs` 能直接断言它。
///
/// 为什么自己写而不引生态里的 LLM 客户端（`moonllm` / `moonai`）：
/// `moonllm` 建在 `oboard/mio`（**native** 异步栈）上，`moonai` 把传输留给使用者实现
/// （`HttpTransport::fetch_stream`）—— 也就是说**最底下那条 web/RN 分叉的传输还是得自己写**，
/// 而上面这三十行反而是最便宜的一段。

///|
/// 把用户填的 base 拼成 `chat/completions`。
///
/// 容忍三种写法（用户从文档里抄来的地址形态各不相同）：`https://x/v1`、`https://x/v1/`、
/// 以及直接给到 `…/chat/completions` 的。
pub fn endpoint(base : String) -> String {
  let b = base.trim().to_owned()
  if b.has_suffix("/chat/completions") {
    b
  } else if b.has_suffix("/") {
    b + "chat/completions"
  } else {
    b + "/chat/completions"
  }
}

///|
/// 请求体：`{"model":…,"messages":[…],"stream":true}`。
///
/// ⚠️ `stream: true` 是**这条链路的前提** —— 不带它服务端会一次性返回，而我们的
/// `@http.stream` 就会读到一个"没有 `data:` 帧"的响应体（判据里那条负例正是这个形状）。
pub fn request_body(model : String, bubbles : Array[Bubble]) -> String {
  let msgs : Array[Json] = bubbles.map(b => {
    Json::object(
      Map([
        ("role", Json::string(if b.role == User { "user" } else { "assistant" })),
        ("content", Json::string(b.text)),
      ]),
    )
  })
  Json::object(
    Map([
      ("model", Json::string(if model.trim().to_owned() == "" { "gpt-4o-mini" } else { model })),
      ("messages", Json::array(msgs)),
      ("stream", Json::boolean(true)),
    ]),
  ).stringify()
}

///|
/// 从一帧 `data:` 里取增量文本：`choices[0].delta.content`。
///
/// 拿不到就返回 `None` —— **不是错误**。同一个流里会出现好几类帧：
/// 首个带 `role` 的帧（没有 `content`）、带 `finish_reason` 的收尾帧、以及
/// 服务商自己加的字段（例如 reasoning）。`None` 只表示"这一帧没有文本"，
/// 调用方**不该**把它当成失败（这是最容易把好流掐断的地方）。
pub fn delta_text(payload : String) -> String? {
  try {
    match @json.parse(payload) {
      Json::Object(top) =>
        match top.get("choices") {
          Some(Json::Array(choices)) =>
            match choices.get(0) {
              Some(Json::Object(c0)) =>
                match c0.get("delta") {
                  Some(Json::Object(d)) =>
                    match d.get("content") {
                      Some(Json::String(s)) => Some(s)
                      _ => None
                    }
                  _ => None
                }
              _ => None
            }
          _ => None
        }
      _ => None
    }
  } catch {
    _ => None
  }
}

///|
/// 从一帧里取**服务端的错误说明**（`{"error":{"message":"…"}}`）。
///
/// 为什么需要它：有些网关在**状态码 200** 的流里塞一条错误帧（配额、鉴权、模型名写错）。
/// 此时 `@http` 报的是"正常结束"，真正的原因只在载荷里 —— 不取出来，用户看到的就是
/// "AI 一个字都没说，也没报错"。
pub fn error_text(payload : String) -> String? {
  try {
    match @json.parse(payload) {
      Json::Object(top) =>
        match top.get("error") {
          Some(Json::Object(e)) =>
            match e.get("message") {
              Some(Json::String(s)) => Some(s)
              _ => Some("服务端返回了一个错误帧")
            }
          _ => None
        }
      _ => None
    }
  } catch {
    _ => None
  }
}
