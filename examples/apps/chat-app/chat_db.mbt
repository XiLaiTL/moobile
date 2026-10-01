///|
/// **本地库层**（`expo-sqlite`，走库的能力包 `@sqlite`）：消息历史 + 设置。
///
/// ## 一条纪律（与 todo-app 不同，理由写在下面）
///
/// todo-app 是"**写库之后统一重读一次**，只让 `Loaded(rows)` 回来" —— 于是模型与库
/// 不可能不一致。聊天这里**故意不这么做**：流式回复期间模型里有一条**还没落库的**助手气泡
/// （每收到一帧都重读一次库 = 把那条抹掉，或者要为"半成品"发明一套状态）。
///
/// 所以分工是：
///
/// | 谁 | 管什么 |
/// |---|---|
/// | 模型 | **本次会话**的唯一真相（含正在生成的那条） |
/// | 本地库 | **历史**：每次"一个回合结束"（用户发出、助手收尾/停止/出错）各写一次 |
///
/// ⚠️ 代价说清楚：**流到一半把应用杀掉，那半条助手回复就没了**（它从没落过库）。
/// 这是 v1 的取舍，不是"忘了写"。

///|
let ddl_bubble : String = "CREATE TABLE IF NOT EXISTS bubble (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, text TEXT NOT NULL, ts REAL NOT NULL)"

///|
let ddl_setting : String = "CREATE TABLE IF NOT EXISTS setting (k TEXT PRIMARY KEY, v TEXT NOT NULL)"

///|
/// 表里的一行。`derive(FromJson)` 是 `@sqlite.all` 的要求（宿主把行读成 JSON 再交给 MoonBit）。
pub struct BubbleRow {
  id : Int
  role : String
  text : String
} derive(FromJson, Debug)

///|
pub struct KV {
  k : String
  v : String
} derive(FromJson, Debug)

///|
/// 设置三件套。**没有它应用就是空的**（没有 key 连不上任何端点），所以首次打开会直接把
/// 用户送到设置页（见 `app.mbt` 的 `Ready` 分支）。
pub struct Fields {
  base : String
  key : String
  model : String
} derive(Eq, Debug)

///|
/// 默认值只提供"少打几个字"，不承诺任何服务商：base 是 DeepSeek 的 OpenAI 兼容入口，
/// 用户可以填任何一家（或本地 Ollama：`http://<局域网 IP>:11434/v1`）。
pub fn default_fields() -> Fields {
  { base: "https://api.deepseek.com/v1", key: "", model: "deepseek-chat" }
}

///|
extern "js" fn now_ms() -> Double = "() => Date.now()"

///|
/// 建表。启动时跑一次（幂等）。
pub async fn setup() -> Unit {
  @sqlite.exec(ddl_bubble)
  @sqlite.exec(ddl_setting)
}

///|
pub async fn history() -> Array[BubbleRow] {
  @sqlite.all("SELECT id, role, text FROM bubble ORDER BY id")
}

///|
/// 追加一条。`role` 用 `"u"` / `"a"` 存（短、且与显示文案解耦）。
pub async fn append(role : String, text : String) -> Unit {
  @sqlite.run(
    "INSERT INTO bubble (role, text, ts) VALUES (?, ?, ?)",
    params=@sqlite.params([
      @sqlite.p_str(role),
      @sqlite.p_str(text),
      @sqlite.p_double(now_ms()),
    ]),
  )
  |> ignore
}

///|
pub async fn wipe() -> Unit {
  @sqlite.run("DELETE FROM bubble") |> ignore
}

///|
/// 读设置。**缺哪条就用默认值**（表是空的、或者只填了一半）—— 于是调用方拿到的永远是
/// 一个"三个字段都在"的结构，不用到处判空。
pub async fn load_settings() -> Fields {
  let rows : Array[KV] = @sqlite.all("SELECT k, v FROM setting")
  let mut f = default_fields()
  for r in rows {
    match r.k {
      "base" => f = { ..f, base: r.v }
      "key" => f = { ..f, key: r.v }
      "model" => f = { ..f, model: r.v }
      _ => ()
    }
  }
  f
}

///|
pub async fn save_settings(f : Fields) -> Unit {
  for kv in [("base", f.base), ("key", f.key), ("model", f.model)] {
    @sqlite.run(
      "INSERT OR REPLACE INTO setting (k, v) VALUES (?, ?)",
      params=@sqlite.params([@sqlite.p_str(kv.0), @sqlite.p_str(kv.1)]),
    )
    |> ignore
  }
}
