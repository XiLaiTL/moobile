///|
/// 极简版 `Val`：一个版本号 + 订阅者表。
///
/// 对齐设计文档 §4.2 —— React 的 `useSyncExternalStore` 要的就是
/// "订阅 + 一个不可变快照"。这里快照就是版本号：变了就整棵树重建，
/// 交给 React 去 diff（§4.3 的取舍：本类应用更新频率低，全树 diff 不是问题）。
pub struct Store {
  mut version : Int
  mut next_id : Int
  subscribers : Map[Int, (Int) -> Unit]
}

///|
pub fn Store::new() -> Store {
  { version: 0, next_id: 0, subscribers: Map([]), }
}

///|
pub fn Store::snapshot(self : Store) -> Int {
  self.version
}

///|
/// 订阅，并返回取消订阅的闭包 —— React 需要拿到它。
pub fn Store::subscribe(self : Store, f : (Int) -> Unit) -> () -> Unit {
  let id = self.next_id
  self.next_id = self.next_id + 1
  self.subscribers[id] = f
  () => self.subscribers.remove(id) |> ignore
}

///|
/// 版本号 +1 并通知所有订阅者。
///
/// 通知前先拷贝一份订阅者列表：回调里可能发生退订，直接遍历会踩到迭代中修改。
pub fn Store::bump(self : Store) -> Unit {
  self.version = self.version + 1
  let listeners : Array[(Int) -> Unit] = []
  for _, f in self.subscribers {
    listeners.push(f)
  }
  for f in listeners {
    f(self.version)
  }
}
