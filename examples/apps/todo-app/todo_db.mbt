///|
/// **本地库层**（`expo-sqlite`）—— 离线权威存储。
///
/// # 分工（重要）
///
/// `update` 保持**纯**：所有写库都是 `Cmd`（`@cmd.perform`）；写完之后**统一重读一次**，
/// 只发一个 `Loaded(rows)` 回来。于是"清单怎么变"只有**一条**路径 —— 读库的结果。
/// 代价是每次点击多一次 SELECT（微秒级），换来的是模型与库**不可能不一致**。
///
/// # 本地 id 方案（为同步准备）
///
/// | id | 含义 |
/// |---|---|
/// | **负数** | 本地新建、还没推到服务器（`-1, -2, …`，由 SQL 的 `MIN(id) - 1` 生成） |
/// | **正数** | 服务器分配的 id（推送成功后替换） |
///
/// 删除不做物理删除，而是 `deleted = 1` 的**墓碑**：同步时先推 DELETE 再清掉。
/// 这是离线优先应用的标准做法 —— 否则"离线时删掉的条目"在下次拉取时又回来了。
///
/// # 表结构
///
/// ```sql
/// id INTEGER PRIMARY KEY   -- 负数=本地临时，正数=服务器
/// text TEXT NOT NULL
/// done INTEGER NOT NULL    -- SQLite 没有布尔，0/1
/// dirty INTEGER NOT NULL   -- 1 = 有未推送的本地变更
/// deleted INTEGER NOT NULL -- 1 = 墓碑
/// updated REAL NOT NULL    -- 毫秒时间戳
/// ```
let ddl = "CREATE TABLE IF NOT EXISTS todo (id INTEGER PRIMARY KEY, text TEXT NOT NULL, done INTEGER NOT NULL, dirty INTEGER NOT NULL, deleted INTEGER NOT NULL, updated REAL NOT NULL)"

///|
/// 库里的行。**刻意用 `Int` 而不是 `Bool`** —— SQLite 回来的是 0/1，
/// 而 `derive(FromJson)` 只认真正的 JSON 布尔，不会替你做转换。
/// 转换发生在 `to_todo` 这一处，边界清楚。
pub struct TodoRow {
  id : Int
  text : String
  done : Int
  dirty : Int
  deleted : Int
  updated : Double
} derive(FromJson, Eq, Debug)

///|
/// 行 → 领域对象。
pub fn to_todo(r : TodoRow) -> Todo {
  { id: r.id, text: r.text, done: r.done != 0 }
}

///|
/// 活着的行（墓碑不算）。
fn select_all() -> String {
  "SELECT id, text, done, dirty, deleted, updated FROM todo WHERE deleted = 0 ORDER BY id"
}

///|
/// 首批种子数据：只在库为空时插入，**且 `dirty = 0`**（它们不对应服务器上的任何东西，
/// 标成待推送会往服务器灌垃圾）。
async fn seed_if_empty() -> Unit {
  let n : Array[TodoRow] = @sqlite.all("SELECT id, text, done, dirty, deleted, updated FROM todo")
  if n.length() > 0 {
    return
  }
  let seeds : Array[(String, Int)] = [
    ("在 MoonBit 里写 UI", 1),
    ("让 React Native 渲染出来", 0),
    ("样式走类型化的通道", 0),
  ]
  let mut id = 1
  for seed in seeds {
    @sqlite.run(
      "INSERT INTO todo (id, text, done, dirty, deleted, updated) VALUES (?, ?, ?, 0, 0, ?)",
      params=@sqlite.params([
        @sqlite.p_int(id),
        @sqlite.p_str(seed.0),
        @sqlite.p_int(seed.1),
        @sqlite.p_int(now_ms()),
      ]),
    )
    |> ignore
    id = id + 1
  }
}

///|
/// 毫秒时间戳。**走宿主**：MoonBit 侧没有时钟，而 JS 侧 `Date.now()` 两端都有。
fn now_ms() -> Int {
  host_now_ms()
}

///|
extern "js" fn host_now_ms() -> Int = "() => Date.now() | 0"

///|
/// 读回全部活着的行。
async fn read_rows() -> Array[TodoRow] {
  @sqlite.all(select_all())
}

///|
/// 启动：建表 → 空则播种 → 读回。
async fn open_and_read() -> Array[TodoRow] {
  @sqlite.exec(ddl)
  seed_if_empty()
  read_rows()
}

///|
/// 把"写库 + 读回"包成一个 `Cmd`。
///
/// 三种结局都变成消息：成功 → `Loaded`（模型里唯一的清单来源），失败 → `Failed`。
/// ⚠️ `@cmd.perform` 要求 `noraise`，所以这里必须自己 `try/catch` —— 也是**唯一**
/// 能保证"库炸了不会静默空白"的地方。
fn db_cmd(emit : @cmd.Emit[Msg], work : async () -> Unit) -> @cmd.Cmd {
  @cmd.perform(
    (r : Result[Array[TodoRow], String]) =>
      emit(
        match r {
          Ok(rows) => Loaded(rows.map(to_todo))
          Err(e) => Failed("本地库出错：\{e}")
        },
      ),
    async fn() -> Result[Array[TodoRow], String] noraise {
      try {
        work()
        Ok(read_rows())
      } catch {
        e => Err(e.to_string())
      }
    },
  )
}

///|
/// 启动命令：读库（带播种）。
pub fn load_cmd(emit : @cmd.Emit[Msg]) -> @cmd.Cmd {
  @cmd.perform(
    (r : Result[Array[TodoRow], String]) =>
      emit(
        match r {
          Ok(rows) => Loaded(rows.map(to_todo))
          Err(e) => Failed("本地库打不开：\{e}")
        },
      ),
    async fn() -> Result[Array[TodoRow], String] noraise {
      try {
        Ok(open_and_read())
      } catch {
        e => Err(e.to_string())
      }
    },
  )
}

///|
/// 新增：id 由 SQL 现算 —— **只看负 id** 的 `MIN(id) - 1`。
///
/// ⚠️ 这里踩过一次：一开始写的是 `MIN(id) - 1`（不限负数），结果当库里只有服务器来的
/// id `6, 7` 时，新条目的 id 算成了 **5**（正数）—— 于是同步时被当成"服务器已有的行"
/// 去 PATCH，服务器 404，整轮同步失败。**本地临时 id 必须是负数**：
/// "负号"就是"这条服务器还不知道"的标记。
pub fn add_cmd(emit : @cmd.Emit[Msg], text : String) -> @cmd.Cmd {
  db_cmd(emit, async fn() {
    @sqlite.run(
      "INSERT INTO todo (id, text, done, dirty, deleted, updated) VALUES ((SELECT COALESCE(MIN(id), 0) - 1 FROM todo WHERE id < 0), ?, 0, 1, 0, ?)",
      params=@sqlite.params([
        @sqlite.p_str(text),
        @sqlite.p_int(now_ms()),
      ]),
    )
    |> ignore
  })
}

///|
/// 勾选 / 取消勾选（`dirty = 1`：本地变更待推送）。
pub fn toggle_cmd(emit : @cmd.Emit[Msg], id : Int, done : Bool) -> @cmd.Cmd {
  db_cmd(emit, async fn() {
    @sqlite.run(
      "UPDATE todo SET done = ?, dirty = 1, updated = ? WHERE id = ?",
      params=@sqlite.params([
        @sqlite.p_int(if done { 1 } else { 0 }),
        @sqlite.p_int(now_ms()),
        @sqlite.p_int(id),
      ]),
    )
    |> ignore
  })
}

///|
/// 改文本。
pub fn set_text_cmd(emit : @cmd.Emit[Msg], id : Int, text : String) -> @cmd.Cmd {
  db_cmd(emit, async fn() {
    @sqlite.run(
      "UPDATE todo SET text = ?, dirty = 1, updated = ? WHERE id = ?",
      params=@sqlite.params([
        @sqlite.p_str(text),
        @sqlite.p_int(now_ms()),
        @sqlite.p_int(id),
      ]),
    )
    |> ignore
  })
}

///|
/// 删除：**负数 id 直接物理删**（服务器根本不知道它），
/// 正数 id 立墓碑（等同步把 DELETE 推上去）。
pub fn remove_cmd(emit : @cmd.Emit[Msg], id : Int) -> @cmd.Cmd {
  db_cmd(emit, async fn() {
    if id < 0 {
      @sqlite.run(
        "DELETE FROM todo WHERE id = ?",
        params=@sqlite.params([@sqlite.p_int(id)]),
      )
      |> ignore
    } else {
      @sqlite.run(
        "UPDATE todo SET deleted = 1, dirty = 1, updated = ? WHERE id = ?",
        params=@sqlite.params([@sqlite.p_int(now_ms()), @sqlite.p_int(id)]),
      )
      |> ignore
    }
  })
}
