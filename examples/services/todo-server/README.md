# server —— Todo 示例的后端

MoonBit + [`moonbitlang/async`](https://mooncakes.io/docs/moonbitlang/async) 的最小 REST 服务端。
存在的理由是给前端一条**真的**网络链路（而不是 mock），顺带证明"一套语言写两端"这件事在
本机是可行的 —— 它**一次编译就通过**，全量冷构建 4~5 秒。

## 跑起来

```bash
cd server
moon build --target native
./_build/native/debug/build/moobile-todo-server.exe
# todo server on http://127.0.0.1:8787  (N 条已载入，存储=todos.json)
```

Windows 上原生构建需要 **MSVC**：moon 会自己用 `vswhere.exe` 找到 VS 2022 BuildTools，
**不用手动跑 vcvars**。`moon run --target native` **必须带包路径**（`moon run --target native .`）。

## 路由

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/health` | `{"ok":true}` |
| `GET` | `/todos` | 全量清单 |
| `POST` | `/todos` | body `{"text": "..."}` → 创建（201） |
| `PATCH` | `/todos/<id>` | body `{"text"?: "...", "done"?: true}` |
| `DELETE` | `/todos/<id>` | 删除 |

每条 todo 的形状与客户端 `examples/apps/todo-app/todo_api.mbt` 的 `ServerTodo` 对齐：

```json
{ "id": 1, "text": "读《周易折中》", "done": false, "updated": 1789800502993 }
```

```bash
curl -s http://127.0.0.1:8787/todos
curl -s -X POST http://127.0.0.1:8787/todos -H 'Content-Type: application/json' -d '{"text":"buy milk"}'
```

## 存储

`todos.json`（相对当前工作目录）：**写临时文件再 `rename`**，所以替换是原子的 ——
中途崩了不会留下半个文件。启动时读回，读不到就退化成空清单（不阻塞启动）。

JSON 文件而不是 SQLite 是刻意的：async 生态里最省事且可靠，**零额外依赖、零 C 工具链负担**
（要真 SQLite 可以用 `moonbitstack/moonsqlite`，但那是另一个量级的取舍，见 `docs/FINDINGS.md`）。

## 三个"只能自己写"的地方

`moonbitlang/async` 只给**裸 HTTP 原语** —— 没有路由、没有中间件、没有静态文件。所以：

1. **CORS 得自己写**：Web 端（Expo dev server 在另一个端口）必然跨域，而且带
   `Content-Type: application/json` 的 POST/PATCH 会先发**预检**，`OPTIONS` 必须处理；
2. **路由**就是一个 `match (request.meth, path)`；`request.path` **带 query string**，
   要自己切；
3. **日志**用 `@stdio.stdout.write` 而不是 `println` —— **`println` 是块缓冲的**，
   输出被重定向（后台跑、`| tee`）时日志会一直卡在缓冲区里，看起来像"服务端没反应"。

## 已知边界（诚实清单）

- 没有鉴权、没有多用户、没有并发写保护（单进程内存态 + 全量落盘）；
- 没有分页，`GET /todos` 返回全量；
- 埋的坑都在 `docs/FINDINGS.md` 的 R2 一节里（连同"怎么修"）。
