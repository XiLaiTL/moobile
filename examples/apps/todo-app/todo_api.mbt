///|
/// **网络链路**：把本地库里的变更推到服务器，再把服务器的全量拉回来合并。
///
/// # 用的是库自己的 `@http`（Cmd 版）
///
/// `@http.get(url).expect_json(msg)` 返回一个 **Cmd** —— 请求由 rabbita 运行时执行，
/// 结果变成一条消息回到 `update`。于是"发网络请求"和"写本地库"在形状上是同一种东西：
/// 都不在 `update` 里直接发生。
///
/// # 同步策略（离线优先 + 服务器为准）
///
/// | 本地行 | 推什么 |
/// |---|---|
/// | `deleted = 1` | `DELETE /todos/<id>`（墓碑） |
/// | `id < 0`（本地新建） | `POST /todos` → 用服务器返回的 id **替换**本地负 id |
/// | `id > 0 且 dirty = 1` | `PATCH /todos/<id>` |
///
/// 推完再 `GET /todos` 拉全量：**服务器有的 upsert 进本地（本地 dirty 的行不动）**，
/// 服务器已删除的干净行从本地清掉。
///
/// ⚠️ **这是最简可用的一套，不是工程化的同步**：没有时钟冲突消解、没有分页、
/// 没有重试退避。写在这里免得被误当"已经做完了"。
///
/// # 后端地址
///
/// RN 里没有"同源"这回事，地址必须由宿主给：`MOBILE_HOST.apiBase`（见 `examples/apps/todo-app/host/App.js`）。
/// Android 模拟器要么指向 `10.0.2.2`，要么用 `adb reverse tcp:8787 tcp:8787`
/// 把设备上的 127.0.0.1 转到主机。

///|
/// 服务器上的 todo。`done` 是**真正的 JSON 布尔**（不像 SQLite 回来的是 0/1），
/// 所以这里可以正常 `derive(FromJson)`。
pub struct ServerTodo {
  id : Int
  text : String
  done : Bool
  updated : Double
} derive(FromJson, Eq, Debug)

///|
extern "js" fn api_base() -> String =
  #| () => globalThis.MOBILE_HOST.apiBase || 'http://127.0.0.1:8787'

///|
fn url(path : String) -> String {
  api_base() + path
}

///|
fn json_obj(pairs : Array[(String, Json)]) -> Json {
  let m : Map[String, Json] = Map([])
  for p in pairs {
    m[p.0] = p.1
  }
  Json::object(m)
}

///|
/// 待推送的行（含墓碑）。
async fn dirty_rows() -> Array[TodoRow] {
  @sqlite.all(
    "SELECT id, text, done, dirty, deleted, updated FROM todo WHERE dirty = 1 ORDER BY id",
  )
}

///|
/// 把服务器返回的一条**接管**到本地：负 id 换成服务器 id，清掉 dirty。
///
/// 文本一律走**绑定参数**（这里只拼整数 id，不拼用户内容）。
async fn adopt(local_id : Int, t : ServerTodo) -> Unit {
  let done = if t.done { 1 } else { 0 }
  if local_id != t.id {
    @sqlite.exec("DELETE FROM todo WHERE id = \{local_id}")
    @sqlite.run(
      "INSERT OR REPLACE INTO todo (id, text, done, dirty, deleted, updated) VALUES (?, ?, ?, 0, 0, ?)",
      params=@sqlite.params([
        @sqlite.p_int(t.id),
        @sqlite.p_str(t.text),
        @sqlite.p_int(done),
        @sqlite.p_double(t.updated),
      ]),
    )
    |> ignore
  } else {
    @sqlite.run(
      "UPDATE todo SET text = ?, done = ?, dirty = 0, updated = ? WHERE id = ?",
      params=@sqlite.params([
        @sqlite.p_str(t.text),
        @sqlite.p_int(done),
        @sqlite.p_double(t.updated),
        @sqlite.p_int(local_id),
      ]),
    )
    |> ignore
  }
}

///|
/// 拉回来的全量写进本地：
/// 1. **upsert**（只有 `dirty = 0` 的行允许被覆盖 —— 本地未推送的改动优先）；
/// 2. **清掉服务器已不存在的干净行**（`dirty = 0 AND id > 0`）。
async fn merge_from_server(rows : Array[ServerTodo]) -> Unit {
  for t in rows {
    @sqlite.run(
      "INSERT INTO todo (id, text, done, dirty, deleted, updated) VALUES (?, ?, ?, 0, 0, ?) ON CONFLICT(id) DO UPDATE SET text = excluded.text, done = excluded.done, updated = excluded.updated WHERE todo.dirty = 0",
      params=@sqlite.params([
        @sqlite.p_int(t.id),
        @sqlite.p_str(t.text),
        @sqlite.p_int(if t.done { 1 } else { 0 }),
        @sqlite.p_double(t.updated),
      ]),
    )
    |> ignore
  }
  if rows.length() == 0 {
    @sqlite.exec("DELETE FROM todo WHERE dirty = 0 AND id > 0")
  } else {
    let ids = rows.map(t => t.id.to_string()).join(",")
    @sqlite.exec(
      "DELETE FROM todo WHERE dirty = 0 AND id > 0 AND id NOT IN (\{ids})",
    )
  }
}

///|
/// 第一步：把"要推哪些"读出来（读库是异步的，所以这本身也得是个 Cmd）。
pub fn sync_plan_cmd(emit : @cmd.Emit[Msg]) -> @cmd.Cmd {
  @cmd.perform(
    (r : Result[Array[TodoRow], String]) =>
      emit(
        match r {
          Ok(rows) => SyncPlan(rows)
          Err(e) => Failed("同步前读库失败：\{e}")
        },
      ),
    async fn() -> Result[Array[TodoRow], String] noraise {
      try {
        Ok(dirty_rows())
      } catch {
        e => Err(e.to_string())
      }
    },
  )
}

///|
/// 一条本地行 → 一个推送 Cmd。
fn push_cmd(emit : @cmd.Emit[Msg], row : TodoRow) -> @cmd.Cmd {
  let local_id = row.id
  let body = json_obj([
    ("text", Json::string(row.text)),
    ("done", Json::boolean(row.done != 0)),
  ])
  if row.deleted != 0 {
    @http
    .delete(url("/todos/\{local_id}"))
    .expect_empty(r =>
      emit(
        match r {
          None => PushDeleted(local_id)
          Some(e) => PushFailed(local_id, e.to_string())
        },
      )
    )
  } else if local_id < 0 {
    @http
    .post(url("/todos"))
    .with_json(body)
    .expect_json(r =>
      emit(
        match r {
          Ok(t) => Pushed(local_id, t)
          Err(e) => PushFailed(local_id, e.to_string())
        },
      )
    )
  } else {
    @http
    .patch(url("/todos/\{local_id}"))
    .with_json(body)
    .expect_json(r =>
      emit(
        match r {
          Ok(t) => Pushed(local_id, t)
          Err(e) => PushFailed(local_id, e.to_string())
        },
      )
    )
  }
}

///|
/// 第二步：把所有待推送的行一起推出去（`@cmd.batch`）。
pub fn push_all_cmd(rows : Array[TodoRow], emit : @cmd.Emit[Msg]) -> @cmd.Cmd {
  @cmd.batch(rows.map(r => push_cmd(emit, r)))
}

///|
/// 第三步：拉全量。
pub fn pull_cmd(emit : @cmd.Emit[Msg]) -> @cmd.Cmd {
  @http
  .get(url("/todos"))
  .expect_json(r =>
    emit(
      match r {
        Ok(rows) => Pulled(rows)
        Err(e) => SyncFailed(e.to_string())
      },
    )
  )
}

///|
/// 推送成功的写库动作（清 dirty / 换 id）。
pub fn adopt_cmd(
  emit : @cmd.Emit[Msg],
  local_id : Int,
  t : ServerTodo,
) -> @cmd.Cmd {
  db_cmd(emit, async fn() {
    adopt(local_id, t)
  })
}

///|
/// 推送 DELETE 成功的写库动作：墓碑可以真删了。
pub fn purge_cmd(emit : @cmd.Emit[Msg], local_id : Int) -> @cmd.Cmd {
  db_cmd(emit, async fn() {
    @sqlite.run(
      "DELETE FROM todo WHERE id = ?",
      params=@sqlite.params([@sqlite.p_int(local_id)]),
    )
    |> ignore
  })
}

///|
/// 拉取成功的写库动作：合并服务器的全量。
pub fn merge_cmd(emit : @cmd.Emit[Msg], rows : Array[ServerTodo]) -> @cmd.Cmd {
  db_cmd(emit, async fn() {
    merge_from_server(rows)
  })
}
