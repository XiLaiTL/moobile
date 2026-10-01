///|
/// # 探针应用的**真身** —— 它被拷进一个"刚由脚手架生成出来的项目"里跑（见 tools/scaffold_probe.mjs）
///
/// 意图：`tools/template_check.mjs` 只证明"生成物能编译、能跑起最小 Todo"。
/// 那还不足以回答真正的问题 —— **生成出来的形状撑不撑得住一个像样的应用**：
/// 多文件拆分、页面切换、过滤、编辑、多个 Msg 通道。
///
/// 所以这里放的就是那个"像样的应用"：**按模板给出的契约写**（单导出 `app` + TEA 四件套），
/// 但比模板大一圈，且**刻意与模板不同名不同形**（多文件、`✕` 而不是 `删`、多一个编辑页）
/// —— 因为"照着模板原样抄一遍还能跑"是废话。
///
/// ⚠️ 它住在 `tools/` 里（而不是 `examples/apps/`）的理由与 `tools/pub_probe/` 一样：
///    **只为一条门存在、不打算给人跑**。真给人跑的示例是 `examples/apps/todo-app/`。
///    这也是为什么它可以"比模板大"却不算第二个 demo —— 它没有自己的 README、没有宿主配置，
///    它就是几个 `.mbt` 文件，等着被拷进别人的工程。
///
/// ⚠️ 它**不使用任何能力**（没有 sqlite、没有 http）—— 那些在 `todo-app` 里已被验过，
///    而且无头验证里没有真的本地库。这里要验的是**脚手架的形状**，不是能力。

///|
pub enum Filter {
  All
  Active
  Done
} derive(Eq)

///|
pub struct Todo {
  id : Int
  text : String
  done : Bool
} derive(Eq)

///|
pub enum Page {
  List
  Edit(Int)
} derive(Eq)

///|
pub struct Model {
  items : Array[Todo]
  draft : String
  filter : Filter
  page : Page
  editing : String
  next_id : Int
  ticks : Int
} derive(Eq)

///|
pub enum Msg {
  SetDraft(String)
  Add
  Toggle(Int)
  Remove(Int)
  SetFilter(Filter)
  OpenEdit(Int)
  SetEditing(String)
  SaveEdit(Int)
  Back
  Tick
}

///|
pub fn initial() -> Model {
  {
    items: [],
    draft: "",
    filter: All,
    page: List,
    editing: "",
    next_id: 1,
    ticks: 0,
  }
}

///|
pub fn find_item(items : Array[Todo], id : Int) -> Todo? {
  for t in items {
    if t.id == id {
      return Some(t)
    }
  }
  None
}

///|
fn visible(model : Model) -> Array[Todo] {
  match model.filter {
    All => model.items
    Active => model.items.filter(t => !t.done)
    Done => model.items.filter(t => t.done)
  }
}

///|
pub fn left_count(model : Model) -> Int {
  model.items.filter(t => !t.done).length()
}

///|
pub fn update(
  model : Model,
  msg : Msg,
  _emit : @cmd.Emit[Msg],
) -> (Model, @cmd.Cmd) {
  match msg {
    SetDraft(s) => ({ ..model, draft: s }, @cmd.none)
    Add =>
      if model.draft == "" {
        (model, @cmd.none)
      } else {
        let item : Todo = { id: model.next_id, text: model.draft, done: false }
        (
          { ..model, items: model.items + [item], draft: "", next_id: model.next_id + 1 },
          @cmd.none,
        )
      }
    Toggle(id) =>
      (
        {
          ..model,
          items: model.items.map(t => if t.id == id { { ..t, done: !t.done } } else { t }),
        },
        @cmd.none,
      )
    Remove(id) => ({ ..model, items: model.items.filter(t => t.id != id) }, @cmd.none)
    SetFilter(f) => ({ ..model, filter: f }, @cmd.none)
    OpenEdit(id) =>
      match find_item(model.items, id) {
        Some(t) => ({ ..model, page: Edit(id), editing: t.text }, @cmd.none)
        None => (model, @cmd.none)
      }
    SetEditing(s) => ({ ..model, editing: s }, @cmd.none)
    SaveEdit(id) =>
      if model.editing == "" {
        ({ ..model, page: List }, @cmd.none)
      } else {
        (
          {
            ..model,
            page: List,
            items: model.items.map(t => if t.id == id {
              { ..t, text: model.editing }
            } else {
              t
            }),
          },
          @cmd.none,
        )
      }
    Back => ({ ..model, page: List }, @cmd.none)
    Tick => ({ ..model, ticks: model.ticks + 1 }, @cmd.none)
  }
}

///|
pub fn subscriptions(_model : Model, emit : @cmd.Emit[Msg]) -> @sub.Sub {
  @sub.every(5000, emit(Tick))
}
