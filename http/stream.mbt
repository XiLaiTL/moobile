///|
/// **流式**响应 —— `@http` 的另一半（让"边生成边显示"的接口能用）。
///
/// ## 它解决什么问题
///
/// `@http` 原来只有**一问一答**：`@http.post(url).with_json(b).expect_json(msg)` 会把整个响应
/// 读完之后**一次性**交回来（`expect_text` 也是读完整包）。而 LLM 的 `/chat/completions`
/// 带 `stream: true` 时是 **SSE**：一条连接上分很多帧推 `data: {...}`，最后一帧是 `data: [DONE]`。
/// 用一问一答的接口拿它，**用户要盯着空白等十几秒**，然后文字一次蹦出来。
///
/// ⇒ 这里补的就是这条：**一个请求、很多条消息回到 `update`**。
///
/// ## 为什么它住在这个目录里（**手写文件躺在生成物旁边**，是刻意的）
///
/// `http/` 是 `vendor/rabbita/http` 的**转发包**，`moon.pkg` 与 `forward.generated.mbt` 都是
/// `tools/gen_forwarders.py` 生成的 —— **但生成器是我们自己的**，它有 `EXTRA` 表专门登记
/// "这个转发包里还有哪些手写文件、它们要哪些 import"。于是：
///
/// | 做法 | 为什么不选 |
/// |---|---|
/// | 加进 `vendor/rabbita/http/**` | 那是**别人的包**。我们的改动得落成 `tools/patches/*.patch`、升级时逐个重放（`FORK.md` §0）—— 往别人的包里塞我们发明的新能力，代价大于收益 |
/// | 另开一个包 `XiLaiTL/moobile/sse` | API 就变成 `@sse.stream(...)`。可它**本来就是 HTTP 能力的一部分**（客户端是应用、地址是 URL、错的是 HTTP 状态码），消费者没理由多记一个包名 |
/// | 手改 `http/moon.pkg` | 它是生成物：下次重跑被覆盖，且 `--check` 会当漂移报出来 |
///
/// ⚠️ **操作上的一个坑（下次加手写扩展时会撞上）**：`gen_forwarders.py` 要先跑 `moon info`，
/// 而那要求**工程能编译**；可新的手写文件又需要新 import 才能编译 —— **先有鸡还是先有蛋**。
/// 解法：**照生成器将会产出的内容，先把 `moon.pkg` 手写一次**，编译通过后再跑生成器
/// （它会写出同样的内容，`--check` 随即一致）。本文件就是这么落地的。
///
/// ## 为什么不用生态里那个 `f4ah6o/sse`
///
/// 它有，但**对 LLM 流式用不了** —— 三条独立的理由：
///
/// | 它的实现 | 后果 |
/// |---|---|
/// | 建在浏览器 **`EventSource`** 上 | **只能 GET** —— 而 `/chat/completions` 要 **POST + JSON body** |
/// | `EventSource` 不支持自定义请求头 | 带不了 **`Authorization: Bearer …`** |
/// | `EventSource` 在 **React Native 里不存在** | 真机上也跑不了 |
///
/// 生态里的 LLM 客户端同样接不上：`DC-Z-lab/moonllm` 依赖 `oboard/mio`（**native** 异步 HTTP 栈），
/// `QuietlyChan/moonai` 则**把传输留给你实现**（`HttpTransport::fetch_stream`）——
/// 也就是说最底下那条传输**还是得我们自己写**，而那正是 web 与 RN 分叉的地方。
///
/// ## 契约
///
/// | 事件 | 什么时候来 | 保证 |
/// |---|---|---|
/// | `Delta(text)` | 每收到一帧 `data:` | **按流里的顺序**，一帧一条；`[DONE]` **不会**出现在这里 |
/// | `Done` | 流正常结束（收到 `[DONE]`，或连接读完） | **恰一次**，且是最后一条 |
/// | `Fail(reason)` | HTTP 非 2xx / 网络错 / 这个运行时不支持流式 | **恰一次**，且是最后一条 |
///
/// 三条不变量（有判据压着，见 `examples/apps/sse-spike/`）：
///
/// 1. **`Done`/`Fail` 恰一次且在最后**，两者互斥；收尾之后**不会再有任何事件**。
/// 2. **分帧与网络分包无关**：一帧被切成两半、或者两帧挤在一次读取里，应用看到的都是
///    "一帧一条 `Delta`"（解析器自己缓冲，见 `JS` 里 `feed` 的注释）。
/// 3. **`abort` 之后一条都不再发** —— 不是"发了但应用忽略"。
///
/// ## 平台：同一份代码，两种传输
///
/// | 平台 | 传输 | 为什么 |
/// |---|---|---|
/// | Web / Node | `fetch` + `response.body.getReader()` | 现成的流式读法 |
/// | **React Native** | **`XMLHttpRequest` 渐进读 `responseText`** | ⚠️ RN 的 `fetch` **没有 `response.body`**（它基于 whatwg-fetch），照 `fetch` 写法在**真机上一条 `Delta` 都收不到** |
///
/// 判据在编译出来的 JS 里**先判平台再发请求**（`navigator.product === "ReactNative"`）——
/// 不能"先用 fetch 试，不行再换 XHR"：那会把同一个 POST 发两遍。
///
/// ## 用法
///
/// ```moonbit
/// // update 里：发出去，并把句柄记在 Model 里（用来 abort / 忽略过期事件）
/// Start => (
///   { ..m, streaming: Some(m.next_id) },
///   @http.stream(
///     id=m.next_id,
///     url=url,
///     headers=[("Authorization", "Bearer \{key}"), ("Content-Type", "application/json")],
///     body=body,
///     on_event=ev => emit(Stream(ev)),
///   ),
/// )
///
/// // 事件回来：**只有当前这一次**的才认（用户可能已经发了下一条）
/// Stream(ev) => match m.streaming {
///   Some(id) if id == cur => (...按 ev 追加文本 / 收尾...)
///   _ => (m, @cmd.none)
/// }
/// ```
///
/// ⚠️ `on_event` 的返回值**必须**是 `@cmd.Cmd`（通常是 `emit(...)` 的结果）——
/// `Emit[Msg]` 的定义就是 `(Msg) -> Cmd`，**光调 `emit` 不把返回的 Cmd 交给运行时，消息不会到**。
/// 这里内部用 `custom_cmd` 拿到的 `scheduler` 把它送进去（与 `@sub.every` 同一条路径）。

///|
/// 流式事件。**应用只该看见这三种**，别把某个厂商的帧格式漏到应用层。
pub(all) enum StreamEvent {
  /// 一帧数据（`data:` 后面那串，已剥前缀；多行 `data:` 用 `\n` 拼接）
  Delta(String)
  /// 正常结束（`[DONE]` 或连接读完）——恰一次，在最后
  Done
  /// 出错（HTTP 非 2xx / 网络 / 平台不支持）——恰一次，在最后
  Fail(String)
}

///|
/// 发一个**流式** POST 请求（`Content-Type: application/json`）。
///
/// - `id`：**应用自己给的句柄**（同一个数字被复用之前，先 `abort` 掉旧的）。
///   用它来"停止生成"，也用来在 `update` 里忽略过期事件。
/// - `on_event`：把事件映射成一条消息 —— 写 `ev => emit(Stream(ev))` 即可。
///
/// 返回 `Cmd`：交给 `update` 返回出去（和别的副作用一样，`update` 保持纯）。
pub fn stream(
  id~ : Int,
  url~ : String,
  headers~ : Array[(String, String)],
  body~ : String,
  on_event~ : (StreamEvent) -> @cmd.Cmd,
) -> @cmd.Cmd {
  @cmd.custom_cmd(scheduler => {
    sse_start(
      id,
      url,
      headers_json(headers),
      body,
      (kind, payload) => {
        scheduler.add(
          on_event(
            match kind {
              0 => Delta(payload)
              1 => Done
              _ => Fail(payload)
            },
          ),
        )
      },
    )
  })
}

///|
/// 停掉 `id` 这条流：**它之后一条事件都不会再发**（不是"发了但应用忽略"）。
///
/// 已结束的 `id` 调它无害（幂等）。流收尾之后也可以再调一次（清理 JS 侧的登记）。
pub fn abort(id : Int) -> @cmd.Cmd {
  @cmd.custom_cmd(_ => sse_abort(id))
}

///|
/// `Array[(k, v)]` → JSON 对象字符串。**不用 `Json::object`** 是因为这里只要一层键值，
/// 而且值一定是字符串 —— 少一层转换就少一处出错的地方（转义仍走 `Json`，不手拼）。
fn headers_json(headers : Array[(String, String)]) -> String {
  let m : Map[String, Json] = Map([])
  for h in headers {
    m[h.0] = Json::string(h.1)
  }
  Json::object(m).stringify()
}

///|
/// JS 侧：起一条流。`on_event(kind, payload)` 的 kind 是 `0=delta 1=done 2=fail`。
///
/// ⚠️ 下面这段 JS 里**没有用过双反斜杠** —— `#|` 块里的 `\\` 会被吃掉一层（实测：
/// 写 `"\\d"` 到 JS 里变成 `"\d"`），会把分帧悄悄弄错。需要换行就写 `"\n"`（实测正常）。
extern "js" fn sse_start(
  id : Int,
  url : String,
  headers_json : String,
  body : String,
  on_event : (Int, String) -> Unit,
) -> Unit =
  #| (id, url, headersJson, body, onEvent) => {
  #|   const live = (globalThis.__moobile_sse ||= new Map());
  #|   // 同一 id 再来一次：先把旧的停掉（应用可能忘了 abort）
  #|   const old = live.get(id);
  #|   if (old) old.stop();
  #|
  #|   let terminal = false;
  #|   // ⚠️ 裸投递与"带闸门的投递"分开：`finish` 要**先把闸门关上**再投最后一条，
  #|   //    如果它走 `send`（`send` 开头就是 `if (terminal) return`），最后一条会被自己挡掉 ——
  #|   //    症状是"分片都到了，但永远停在『接收中』"。这条判据抓过（verify.mjs 的 Done/Fail 两条）。
  #|   const raw = (kind, payload) => {
  #|     try { onEvent(kind, payload == null ? "" : String(payload)); }
  #|     catch (e) { /* 应用回调抛错不该把流拖死（也不能让它冒泡回 JS 事件里） */ }
  #|   };
  #|   const send = (kind, payload) => { if (!terminal) raw(kind, payload); };
  #|   const finish = (kind, payload) => {
  #|     if (terminal) return;
  #|     terminal = true;
  #|     live.delete(id);
  #|     raw(kind, payload);
  #|   };
  #|
  #|   let buf = "";
  #|   // 一帧 = 到空行为止的一段（SSE 规范）。data: 可以出现多行，用 \n 拼起来。
  #|   const handleBlock = (block) => {
  #|     const lines = block.split("\n");
  #|     const data = [];
  #|     for (const raw of lines) {
  #|       const line = raw.charCodeAt(raw.length - 1) === 13 ? raw.slice(0, -1) : raw;
  #|       if (line.startsWith("data:")) {
  #|         const v = line.slice(5);
  #|         data.push(v.startsWith(" ") ? v.slice(1) : v);
  #|       }
  #|       // 别的字段（event: / id: / retry:）与注释行（:）对"拿到文本"没有用，忽略
  #|     }
  #|     if (data.length === 0) return;
  #|     const payload = data.join("\n");
  #|     if (payload === "[DONE]") finish(1, "");
  #|     else send(0, payload);
  #|   };
  #|   // ⚠️ 关键：**只有**看到空行才认为一帧结束 —— 网络分包会把一帧切成两半，
  #|   //    也会把两帧挤在一次读取里。`final` 时把残留的一段也当一帧（流可能没有收尾空行）。
  #|   const feed = (text, final) => {
  #|     buf += text;
  #|     let i;
  #|     while ((i = buf.indexOf("\n\n")) >= 0) {
  #|       const block = buf.slice(0, i);
  #|       buf = buf.slice(i + 2);
  #|       handleBlock(block);
  #|     }
  #|     if (final && buf.trim().length > 0) { handleBlock(buf); buf = ""; }
  #|   };
  #|
  #|   const isRN = typeof navigator !== "undefined" && navigator.product === "ReactNative";
  #|
  #|   if (!isRN && typeof fetch === "function") {
  #|     const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  #|     live.set(id, { stop: () => { terminal = true; live.delete(id); if (ctrl) ctrl.abort(); } });
  #|     let headers = {};
  #|     try { headers = JSON.parse(headersJson || "{}"); } catch (e) { /* 空头也合法 */ }
  #|     fetch(url, { method: "POST", headers, body, signal: ctrl ? ctrl.signal : undefined })
  #|       .then((resp) => {
  #|         if (!resp.ok) { finish(2, "HTTP " + resp.status); return; }
  #|         if (!resp.body || typeof resp.body.getReader !== "function") {
  #|           finish(2, "这个运行时的 fetch 不支持流式响应");
  #|           return;
  #|         }
  #|         const reader = resp.body.getReader();
  #|         const dec = new TextDecoder();
  #|         const pump = () => {
  #|           reader.read().then((r) => {
  #|             if (terminal) return;
  #|             if (r.done) { feed("", true); finish(1, ""); return; }
  #|             feed(dec.decode(r.value, { stream: true }), false);
  #|             pump();
  #|           }).catch((e) => finish(2, String((e && e.message) || e)));
  #|         };
  #|         pump();
  #|       })
  #|       .catch((e) => {
  #|         // abort 是我们自己叫停的，不算失败
  #|         if (terminal) return;
  #|         finish(2, String((e && e.message) || e));
  #|       });
  #|     return;
  #|   }
  #|
  #|   // React Native：fetch 拿不到 response.body，只能靠 XHR 的渐进式 responseText
  #|   const xhr = new XMLHttpRequest();
  #|   live.set(id, { stop: () => { terminal = true; live.delete(id); try { xhr.abort(); } catch (e) {} } });
  #|   let seen = 0;
  #|   const drain = () => {
  #|     const t = xhr.responseText || "";
  #|     if (t.length > seen) { feed(t.slice(seen), false); seen = t.length; }
  #|   };
  #|   xhr.onreadystatechange = () => {
  #|     if (terminal) return;
  #|     if (xhr.readyState === 3) drain();
  #|     else if (xhr.readyState === 4) {
  #|       if (xhr.status >= 200 && xhr.status < 300) { drain(); feed("", true); finish(1, ""); }
  #|       else finish(2, "HTTP " + xhr.status);
  #|     }
  #|   };
  #|   xhr.onerror = () => finish(2, "网络错误");
  #|   xhr.open("POST", url, true);
  #|   try {
  #|     const headers = JSON.parse(headersJson || "{}");
  #|     for (const k of Object.keys(headers)) xhr.setRequestHeader(k, headers[k]);
  #|   } catch (e) { /* 空头也合法 */ }
  #|   xhr.send(body);
  #| }

///|
/// JS 侧：停掉一条流。
extern "js" fn sse_abort(id : Int) -> Unit =
  #| (id) => {
  #|   const live = (globalThis.__moobile_sse ||= new Map());
  #|   const h = live.get(id);
  #|   if (h) h.stop();
  #| }
