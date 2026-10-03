///|
/// `memo_list` 的判据：**它必须真的产出 `VNode::Thunk`，键就是 `by` 给的**。
///
/// 为什么值得一条测试：这一层的失败模式是"看起来包了 memo、其实没有"（上游 0.16 给的东西
/// 在我们这条通道上曾经**整段空转** —— 见 `docs/PERF.md` §11.2）。
/// 断言到"产物是 thunk 且哈希等于 by"这一层，才拦得住那类"包了但没生效"。
test "memo_list 每行都产出 thunk，键就是 by 的结果" {
  let cells = memo_list([1, 2, 3], by=n => n * 2, f=n => @html.span("\{n}"))
  assert_eq(cells.length(), 3)
  for i, c in cells {
    match c.to_virtual_dom() {
      @vdom.VNode::Thunk(h, _) => assert_eq(h, (i + 1) * 2)
      _ => fail("memo_list 产出的每一行都应该是 VNode::Thunk")
    }
  }
}

///|
/// 空列表是合法输入（不该 panic、也不该产出东西）。
test "memo_list 对空列表" {
  let empty : Array[Int] = []
  let cells = memo_list(empty, by=n => n, f=n => @html.span("\{n}"))
  assert_eq(cells.length(), 0)
}

///|
/// 测试用的一行。
priv struct MemoRow {
  id : Int
  hot : Bool
}

///|
fn memo_hash_of(html : @html.Html) -> Int {
  match html.to_virtual_dom() {
    @vdom.VNode::Thunk(h, _) => h
    _ => -1
  }
}

///|
/// **同一个键 ⇒ 同一个哈希**（这是"复用"的判据），不同键 ⇒ 不同哈希。
///
/// 这一条防的是"行内容变了、键却没变"那类错配：键的完备性是**调用方**的契约，
/// 而库这边至少要把"键 → 哈希"这条映射钉死、不做任何额外加工。
/// （顺带把"只按 `id` 取键 ⇒ `hot` 变了哈希也不变"这件事**明写出来** —— 那是契约允许的，但必须知情。）
test "键相同 ⇒ 哈希相同；键不同 ⇒ 哈希不同" {
  let cold : Array[MemoRow] = [{ id: 7, hot: false }]
  let hot : Array[MemoRow] = [{ id: 7, hot: true }]
  let other : Array[MemoRow] = [{ id: 8, hot: false }]
  let a = memo_list(cold, by=r => r.id, f=_ => @html.span("x"))
  let b = memo_list(hot, by=r => r.id, f=_ => @html.span("y"))
  let c = memo_list(other, by=r => r.id, f=_ => @html.span("x"))
  assert_eq(memo_hash_of(a[0]), memo_hash_of(b[0]))
  assert_eq(memo_hash_of(a[0]), 7)
  assert_eq(memo_hash_of(c[0]), 8)
}

///|
/// `memo_list_i`：键来自 `by(i, x)`，`f` 收到序号 —— 而且**是惰性的**。
///
/// ⚠️ 这一条把三件事一起钉住（第一版我写错过，所以留着它）：
/// 1. **键在构建时就算**（`by` 立刻被调用）：键是给 diff 用的，不能等渲染；
/// 2. **`f` 在构建时不算**：`memo_by` 的产物是 `Thunk(hash, () => …)` —— **惰性正是它的语义**
///    （命中时连子树都不建）。第一版我在构建后断言 `f` 已被调用 3 次，拿到的当然是 0；
/// 3. **force 之后 `f` 收到的是哪个序号**（这是 `memo_list_i` 相对 `memo_list` 的全部价值）。
test "memo_list_i：键立刻算、f 惰性执行、序号传对" {
  let mut by_calls = 0
  let seen : Array[Int] = []
  let cells = memo_list_i(
    ["a", "b", "c"],
    by=(i, s) => {
      by_calls = by_calls + 1
      i * 100 + s.length()
    },
    f=(i, s) => {
      seen.push(i)
      @html.span(s)
    },
  )
  assert_eq(cells.length(), 3)
  assert_eq(by_calls, 3) // ← 键在构建时就算
  assert_eq(seen.length(), 0) // ← f 还没跑（惰性）
  for i, c in cells {
    match c.to_virtual_dom() {
      @vdom.VNode::Thunk(h, f) => {
        assert_eq(h, i * 100 + 1)
        ignore(f())
      }
      _ => fail("memo_list_i 产出的每一行都应该是 VNode::Thunk")
    }
  }
  assert_eq(seen.length(), 3) // ← force 之后才跑
  assert_eq(seen[0], 0)
  assert_eq(seen[2], 2)
}
