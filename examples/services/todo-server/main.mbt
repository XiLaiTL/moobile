// moobile Todo 示例的**后端**：MoonBit + moonbitlang/async 的最小 REST 服务端。
//
// 为什么后端也用 MoonBit：这个项目的叙事是"一套语言写两端"，
// 而且 async@0.21 的 HTTP 服务端在本机（Windows + MSVC）已实测可构建可运行。
//
// 存储：JSON 文件 + 原子替换（写临时文件再 rename）。
// 这是 async 生态里最省事且可靠的做法 —— 不需要 SQLite 绑定，也不需要 C 工具链。
//
// 路由：
//   GET    /health          -> {"ok":true}
//   GET    /todos           -> [Todo, ...]
//   POST   /todos           -> body {text}                -> Todo（201）
//   PATCH  /todos/<id>      -> body {text?, done?}         -> Todo
//   DELETE /todos/<id>      -> {}                          -> {}
//
// Todo 的形状（与客户端 `examples/apps/todo-app/todo.mbt` 的 `TodoRow` 对齐）：
//   { "id": Int, "text": String, "done": Bool, "updated": Double }

///|
/// 服务端手里的 todo。
struct Todo {
  id : Int
  mut text : String
  mut done : Bool
  mut updated : Double
}

///|
/// 状态文件（相对当前工作目录）。
let data_path = "todos.json"

///|
/// 临时文件 —— 写入后再 rename，保证替换是原子的（中途崩了不会留下半个文件）。
let tmp_path = "todos.json.tmp"

///|
/// 持久化的状态。
struct Store {
  mut todos : Array[Todo]
  mut next_id : Int
}

///|
/// 无缓冲日志。
///
/// ⚠️ `println` 在 stdout 被重定向（后台跑、`| tee`）时是**块缓冲**的，
/// 日志会一直卡在缓冲区里、看起来像"服务端没反应"。`@stdio.stdout` 直写 fd。
async fn log(msg : String) -> Unit {
  @stdio.stdout.write(msg + "\n")
}

///|
fn now_ms() -> Double {
  @env.now().to_double()
}

///|
fn obj(pairs : Array[(String, Json)]) -> Json {
  let m : Map[String, Json] = Map([])
  for pair in pairs {
    m[pair.0] = pair.1
  }
  Json::object(m)
}

///|
fn todo_json(t : Todo) -> Json {
  obj([
    ("id", Json::number(t.id.to_double())),
    ("text", Json::string(t.text)),
    ("done", Json::boolean(t.done)),
    ("updated", Json::number(t.updated)),
  ])
}

///|
fn error_json(message : String) -> Json {
  obj([("error", Json::string(message))])
}

///|
fn meth_name(meth : @http.RequestMethod) -> String {
  match meth {
    Get => "GET"
    Head => "HEAD"
    Post => "POST"
    Put => "PUT"
    Delete => "DELETE"
    Connect => "CONNECT"
    Options => "OPTIONS"
    Trace => "TRACE"
    Patch => "PATCH"
  }
}

///|
/// 每个响应都带上 CORS —— Web 端（Expo dev server 在另一个端口）必然跨域。
///
/// 预检（OPTIONS）也必须处理：带 `Content-Type: application/json` 的 POST/PATCH
/// 在浏览器里会先发一次预检请求。async 只给裸 HTTP 原语，没有中间件，所以这些
/// 头得自己写全。
fn cors_headers() -> @http.Headers {
  let h : @http.Headers = Map([])
  h["Access-Control-Allow-Origin"] = "*"
  h["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
  h["Access-Control-Allow-Headers"] = "Content-Type"
  h["Access-Control-Max-Age"] = "600"
  h
}

///|
async fn send_json(
  conn : @http.ServerConnection,
  code : Int,
  reason : String,
  json : Json,
) -> Unit {
  let body = @utf8.encode(json.stringify())
  let headers = cors_headers()
  headers["Content-Type"] = "application/json; charset=utf-8"
  headers["Content-Length"] = body.length().to_string()
  conn.send_response(code, reason, extra_headers=headers)
  conn.write(body)
  conn.end_response()
}

///|
/// 从路径里取 id：`/todos/12` → `12`。
fn path_id(path : String) -> Int? {
  guard path.has_prefix("/todos/") else { return None }
  let rest = path[7:].to_owned()
  let digits = match rest.find("?") {
    Some(i) => rest[:i].to_owned()
    None => rest
  }
  guard digits != "" else { return None }
  let mut n = 0
  for c in digits {
    guard c >= '0' && c <= '9' else { return None }
    n = n * 10 + (c.to_int() - 48)
  }
  Some(n)
}

///|
/// 按 id 找一条（`Array` 在这个版本里没有 `find_first`，自己写一个）。
fn find_todo(todos : Array[Todo], id : Int) -> Todo? {
  for t in todos {
    if t.id == id {
      return Some(t)
    }
  }
  None
}

///|
/// 读请求体 JSON（失败给 None，交给调用方回 400）。
async fn read_json(body : &@io.Reader) -> Json? {
  try {
    Some(body.read_all().json())
  } catch {
    _ => None
  }
}

///|
fn field_text(j : Json) -> String? {
  match j {
    Json::Object(m) =>
      match m.get("text") {
        Some(Json::String(s)) => Some(s)
        _ => None
      }
    _ => None
  }
}

///|
fn field_done(j : Json) -> Bool? {
  match j {
    Json::Object(m) =>
      match m.get("done") {
        Some(Json::True) => Some(true)
        Some(Json::False) => Some(false)
        _ => None
      }
    _ => None
  }
}

///|
/// 落盘（原子替换）。
async fn persist(store : Store) -> Unit {
  let arr : Array[Json] = store.todos.map(todo_json)
  @fs.write_file(tmp_path, Json::array(arr).stringify())
  @fs.rename(tmp_path, data_path)
}

///|
/// 启动时读回状态；文件不存在或有坏数据都退化成空清单（不阻塞启动）。
async fn load(store : Store) -> Unit {
  guard @fs.exists(data_path) else { return }
  let parsed : Json? = try {
    Some(@fs.read_file(data_path).json())
  } catch {
    _ => None
  }
  match parsed {
    Some(Json::Array(items)) => {
      for item in items {
        let id = match item {
          Json::Object(m) =>
            match m.get("id") {
              Some(Json::Number(d)) => d.to_int()
              _ => 0
            }
          _ => 0
        }
        let text = match field_text(item) {
          Some(t) => t
          None => ""
        }
        let done = match field_done(item) {
          Some(d) => d
          None => false
        }
        let updated = match item {
          Json::Object(m) =>
            match m.get("updated") {
              Some(Json::Number(d)) => d
              _ => 0.0
            }
          _ => 0.0
        }
        store.todos.push({ id, text, done, updated })
        if id >= store.next_id {
          store.next_id = id + 1
        }
      }
    }
    _ => ()
  }
}

///|
async fn main {
  let store : Store = { todos: [], next_id: 1 }
  load(store)
  let server = @http.Server(@socket.Addr::parse("127.0.0.1:8787"))
  log(
    "todo server on http://127.0.0.1:8787  (\{store.todos.length()} 条已载入，存储=\{data_path})",
  )
  server.run_forever() <| ((request, body, conn) => {
    let path = request.path.to_string()
    log("\{meth_name(request.meth)} \{path}")
    // 预检：直接放行，不带 body。
    if request.meth is Options {
      send_json(conn, 200, "OK", obj([]))
      return
    }
    match (request.meth, path) {
      (Get, "/health") => send_json(conn, 200, "OK", obj([("ok", Json::boolean(true))]))
      (Get, "/todos") =>
        send_json(conn, 200, "OK", Json::array(store.todos.map(todo_json)))
      (Post, "/todos") =>
        match read_json(body) {
          None =>
            send_json(conn, 400, "Bad Request", error_json("body is not valid JSON"))
          Some(j) =>
            match field_text(j) {
              None =>
                send_json(
                  conn,
                  400,
                  "Bad Request",
                  error_json("body needs a string field `text`"),
                )
              Some(text) => {
                let t : Todo = {
                  id: store.next_id,
                  text,
                  done: false,
                  updated: now_ms(),
                }
                store.next_id = store.next_id + 1
                store.todos.push(t)
                persist(store)
                send_json(conn, 201, "Created", todo_json(t))
              }
            }
        }
      (Patch, _) =>
        match path_id(path) {
          None =>
            send_json(conn, 404, "NotFound", error_json("PATCH \{path} not found"))
          Some(id) =>
            match find_todo(store.todos, id) {
              None => send_json(conn, 404, "NotFound", error_json("no todo \{id}"))
              Some(t) =>
                match read_json(body) {
                  None =>
                    send_json(
                      conn,
                      400,
                      "Bad Request",
                      error_json("body is not valid JSON"),
                    )
                  Some(j) => {
                    match field_text(j) {
                      Some(text) => t.text = text
                      None => ()
                    }
                    match field_done(j) {
                      Some(done) => t.done = done
                      None => ()
                    }
                    t.updated = now_ms()
                    persist(store)
                    send_json(conn, 200, "OK", todo_json(t))
                  }
                }
            }
        }
      (Delete, _) =>
        match path_id(path) {
          None =>
            send_json(conn, 404, "NotFound", error_json("DELETE \{path} not found"))
          Some(id) =>
            match find_todo(store.todos, id) {
              None => send_json(conn, 404, "NotFound", error_json("no todo \{id}"))
              Some(t) => {
                store.todos = store.todos.filter(x => x.id != t.id)
                persist(store)
                send_json(conn, 200, "OK", obj([]))
              }
            }
        }
      _ => send_json(conn, 404, "NotFound", error_json("\{meth_name(request.meth)} \{path} not found"))
    }
  })
}
