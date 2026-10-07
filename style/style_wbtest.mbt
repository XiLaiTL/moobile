///|
/// `style/style_wbtest.mbt` —— **甲级样式那三样**的白盒判据（`transform` 这一刀加的）。
///
/// 为什么这一层要有自己的白盒测试（而不是只靠"真浏览器里看着对"）：`transform` 的产物是一段
/// **字符串**，而两端都要**再解析**它（RN 用正则拆成单键对象、RNW 原样落进 CSS）。
/// 也就是说：**拼错一个字符在 web 上可能照样"看起来对"**，而在 RN 上会被解析成
/// 完全不同的东西（或者被它的 `invariant` 拦下）。所以这里钉的是**文本本身**。
///
/// 见 `style.mbt` 里 `Transform` 的说明（那三条"为什么这样"的出处）。

///|
/// 把样式表里某个键的值取出来（同包可读私有字段；没有这个键 ⇒ `None`）。
fn value_of(s : Style, key : String) -> String? {
  for e in s.entries {
    if e.0 == key {
      return match e.1 {
        StyleValue::Str(v) => Some(v)
        _ => None
      }
    }
  }
  None
}

///|
/// 一个变换串里有几个函数（数 `(` 就够了：每个动作**必须恰好一个函数**）。
fn fn_count(v : String) -> Int {
  let mut n = 0
  for c in v {
    if c == '(' {
      n = n + 1
    }
  }
  n
}

///|
test "transform：顺序就是施加顺序（`translate` 之后再 `scale`）" {
  let s = Style::new()
    .transform([
      Transform::Translate(2.0, 0.0),
      Transform::Scale(1.02),
      Transform::Rotate(45.0),
    ])
  inspect(value_of(s, "transform"), content="Some(translateX(2px) translateY(0px) scale(1.02) rotate(45deg))")
}

///|
test "transform：反过来写就必须是另一串（顺序不是装饰）" {
  let a = Style::new().transform([
    Transform::Scale(2.0),
    Transform::Translate(10.0, 0.0),
  ])
  let b = Style::new().transform([
    Transform::Translate(10.0, 0.0),
    Transform::Scale(2.0),
  ])
  inspect(value_of(a, "transform"), content="Some(scale(2) translateX(10px) translateY(0px))")
  inspect(value_of(b, "transform"), content="Some(translateX(10px) translateY(0px) scale(2))")
  // 这条是**目的**：两者必须不同（相同就说明顺序被丢了）
  assert_true(value_of(a, "transform") != value_of(b, "transform"))
}

///|
test "transform：每个动作**恰好一个函数**（RN 的 _validateTransforms 硬要求）" {
  let cases : Array[(Array[Transform], Int)] = [
    ([Transform::Translate(2.0, 0.0)], 2),
    ([Transform::Scale(1.5)], 1),
    ([Transform::Rotate(90.0)], 1),
    ([
      Transform::Translate(0.0, -8.0),
      Transform::Scale(1.02),
      Transform::Rotate(30.0),
    ], 4),
  ]
  for c in cases {
    match value_of(Style::new().transform(c.0), "transform") {
      Some(v) =>
        // ⚠️ 这里刻意**按动作数算期望**，而不是按"看着像"：`Translate` 吐 **2** 个函数
        //    （`translateX` + `translateY`）—— 一个函数带两个参数会被 RN 的
        //    `_validateTransforms`（每个对象恰好一个键）拦下，canvas 那边也栽过同一件事。
        assert_eq(fn_count(v), c.1)
      None => fail("transform 这个键没写进去")
    }
  }
}

///|
test "transform：容器名是 `transform`，且 value 是字符串（两端都按字符串解析）" {
  let s = Style::new().transform([Transform::Scale(1.0)])
  let keys : Array[String] = []
  for e in s.entries {
    keys.push(e.0)
  }
  assert_eq(keys, ["transform"])
  // 值必须是 `Str`：`Px` / `Unitless` 会在两端被按"长度/数字"翻译，那样 RN 会拿到一个数字
  match value_of(s, "transform") {
    Some(_) => ()
    None => fail("transform 的值不是字符串")
  }
}

///|
test "transform：能落在链的**任意位置**（在 `cursor` / `box_shadow` 之后也不丢）" {
  let s = Style::new()
    .cursor(Cursor::Pointer)
    .transform([Transform::Translate(0.0, -4.0)])
    .box_shadow("#00000022", 0.0, 2.0, 4.0, 0.0)
  inspect(value_of(s, "transform"), content="Some(translateX(0px) translateY(-4px))")
  inspect(value_of(s, "cursor"), content="Some(pointer)")
  assert_true(value_of(s, "boxShadow") is Some(_))
}

///|
test "transform：空数组 ⇒ 键在、串空（「清掉变换」是显式行为，不是「忘了写」）" {
  inspect(value_of(Style::new().transform([]), "transform"), content="Some()")
}
