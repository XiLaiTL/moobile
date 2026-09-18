///|
/// 状态与逻辑。**对渲染后端一无所知** —— 纯 MoonBit，可以在任何 target 上编。
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
/// 顶层屏幕。
///
/// `Todo` 是管道验收用的待办清单；`R1` 是**可行性样本**
/// （按 `interest/yi` 的真实 CSS 移植的那段排版）。
/// 两个屏共用同一套 moobile 后端 —— 换屏只换 `view`，不碰渲染路径。
pub enum Screen {
  Todo
  R1
} derive(Eq)

///|
pub struct Model {
  items : Array[Todo]
  draft : String
  filter : Filter
  next_id : Int
  screen : Screen
} derive(Eq)

///|
pub enum Msg {
  SetDraft(String)
  Add
  Toggle(Int)
  Remove(Int)
  SetFilter(Filter)
  SetScreen(Screen)
}

///|
pub fn initial() -> Model {
  {
    items: [
      { id: 1, text: "在 MoonBit 里写 UI", done: true },
      { id: 2, text: "让 React Native 渲染出来", done: false },
      { id: 3, text: "样式走类型化的通道", done: false },
    ],
    draft: "",
    filter: All,
    next_id: 4,
    screen: Todo,
  }
}

///|
/// TEA 的 update：纯函数，无副作用。
pub fn update(model : Model, msg : Msg) -> Model {
  match msg {
    SetDraft(s) => { ..model, draft: s }
    Add =>
      if model.draft == "" {
        model
      } else {
        let items = model.items.copy()
        items.push({ id: model.next_id, text: model.draft, done: false })
        { ..model, items, draft: "", next_id: model.next_id + 1 }
      }
    Toggle(id) => {
      let items = model.items.map(t => if t.id == id {
        { ..t, done: !t.done }
      } else {
        t
      })
      { ..model, items }
    }
    Remove(id) => { ..model, items: model.items.filter(t => t.id != id) }
    SetFilter(f) => { ..model, filter: f }
    SetScreen(s) => { ..model, screen: s }
  }
}

///|
pub fn visible(model : Model) -> Array[Todo] {
  match model.filter {
    All => model.items
    Active => model.items.filter(t => !t.done)
    Done => model.items.filter(t => t.done)
  }
}

///|
pub fn remaining(model : Model) -> Int {
  model.items.filter(t => !t.done).length()
}
