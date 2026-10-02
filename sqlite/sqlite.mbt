///|
/// moobile 的**本地数据库能力包**（宿主侧实现是 `expo-sqlite`）。
///
/// # 边界形状：JSON 字符串过界，而不是 JS 对象
///
/// 桩接口只有三个函数，全部 async，**参数与返回值都是 JSON 字符串**：
///
/// ```
/// MOBILE_HOST.db.exec(sql)                -> Promise<void>
/// MOBILE_HOST.db.run(sql, paramsJson)     -> Promise<string>   // {"changes":n,"last_insert_row_id":n}
/// MOBILE_HOST.db.all(sql, paramsJson)      -> Promise<string>   // [{"id":1,...}, ...]
/// ```
///
/// 为什么不让 JS 侧直接返回对象数组：
/// 1. **少一层 FFI**：返回 JS 对象意味着要么逐个字段打字（`o[k]` 的 4 个包装 × 4 种类型），
///    要么把 MoonBit 的 `%identity` 不安全性扩散到整个数据面；
/// 2. 这个生态里**已经有现成的做法**：`@json.from_json(@json.parse(raw))`（yi 的
///    `shared/parse_reader_data` 就是这么读阅读数据的），字段名对齐由 `derive(FromJson)` 管；
/// 3. 出错的形状一致：JSON 解析失败是可定位的报错，而不是"某个字段莫名其妙是 undefined"。
///
/// 代价是每次调用多一次 stringify/parse —— 对清单类应用完全不是瓶颈。
///
/// # 字段命名
///
/// JS 侧一律用 **snake_case** 键（`last_insert_row_id`），因为 MoonBit 的
/// `derive(FromJson)` 按字段名直接对键，不做大小写转换。
///
/// # 平台与限制（实测事实，见 `examples/apps/todo-app/host/db.js`）
///
/// - **Android**：`expo-sqlite` 发预编译 AAR，走 autolink，只需 `npx expo run:android` 重建；
/// - **Web**：官方标注 **alpha**，需要 `metro.config.js` 加 wasm 资源 + COOP/COEP；
///   本包只使用**异步 API**（同步 API 在 Web 上依赖 `SharedArrayBuffer`，那是要有
///   crossOriginIsolated 的那一半）。
#cfg(target="js")
extern "js" fn db_present() -> Bool =
  #| () => !!(globalThis.MOBILE_HOST && globalThis.MOBILE_HOST.db)

///|
#cfg(target="js")
extern "js" fn db_exec_ffi(sql : String) -> @js.Promise[Unit] =
  #| (sql) => globalThis.MOBILE_HOST.db.exec(sql)

///|
#cfg(target="js")
extern "js" fn db_run_ffi(sql : String, params_json : String) -> @js.Promise[String] =
  #| (sql, p) => globalThis.MOBILE_HOST.db.run(sql, p)

///|
#cfg(target="js")
extern "js" fn db_all_ffi(sql : String, params_json : String) -> @js.Promise[String] =
  #| (sql, p) => globalThis.MOBILE_HOST.db.all(sql, p)

///|
/// 宿主没装数据库能力时的**快速失败**。
///
/// 缺能力时直接调用会得到 `Cannot read properties of undefined (reading 'all')`
/// 这种**没有信息量**的报错，或者更糟 —— 静默变成 `undefined` 一路传下去。
/// 这里改成一句话说清"缺什么、怎么装、在哪注册"。
/// 这就是 `PLAN.md` §3.7 的 H7 想推广到**全部**能力上的形状（H7 目前只落地了这一个）。
fn ensure() -> Unit {
  if !db_present() {
    abort(
      "moobile/sqlite: 宿主没有注册 `MOBILE_HOST.db`。\n" +
      "  装：npx expo install expo-sqlite\n" +
      "  注册：在 App.js 里给 MOBILE_HOST 赋值**之后**调用 installDb()（参考 examples/apps/todo-app/host/db.js）\n" +
      "  注意：ES import 会提升，所以 db.js 不能在自己顶层写 MOBILE_HOST.db = …",
    )
  }
}

///|
/// 一行 SQL 的执行结果（`INSERT` / `UPDATE` / `DELETE` 之后关心的两个数）。
pub struct RunResult {
  changes : Int
  last_insert_row_id : Double
} derive(FromJson, Eq, Debug)

///|
/// 参数表：把 MoonBit 值装成**JSON 数组字符串**（宿主侧 `JSON.parse` 后直接当绑定参数用）。
///
/// ```moonbit
/// let ps = @sqlite.params([@sqlite.p_str("买菜"), @sqlite.p_bool(false)])
/// ```
pub fn params(xs : Array[Json]) -> String {
  Json::array(xs).stringify()
}

///|
/// 字符串参数。
pub fn p_str(s : String) -> Json {
  Json::string(s)
}

///|
/// 整数参数（JSON 里只有 number，JS 侧按 `INTEGER` 列存整数没问题）。
pub fn p_int(i : Int) -> Json {
  Json::number(i.to_double())
}

///|
/// 浮点参数（时间戳、实数）。
pub fn p_double(d : Double) -> Json {
  Json::number(d)
}

///|
/// 布尔参数。SQLite 没有布尔类型：宿主侧把它存成 `0/1`。
pub fn p_bool(b : Bool) -> Json {
  Json::boolean(b)
}

///|
/// SQL `NULL`。
pub fn p_null() -> Json {
  Json::null()
}

///|
/// 执行**无参数**语句（建表、PRAGMA、迁移）。
pub async fn exec(sql : String) -> Unit {
  ensure()
  db_exec_ffi(sql).wait() |> ignore
}

///|
/// 执行**带参数**语句，返回影响行数与新插入行的 id。
pub async fn run(sql : String, params? : String = "[]") -> RunResult {
  ensure()
  let raw : String = db_run_ffi(sql, params).wait()
  @json.from_json(@json.parse(raw))
}

///|
/// 查询多行，按 `T` 的 `derive(FromJson)` 解码。
///
/// ```moonbit
/// let rows : Array[TodoRow] = @sqlite.all("SELECT id, text, done FROM todo ORDER BY id")
/// ```
pub async fn[T : FromJson] all(
  sql : String,
  params? : String = "[]",
) -> Array[T] {
  ensure()
  let raw : String = db_all_ffi(sql, params).wait()
  @json.from_json(@json.parse(raw))
}
