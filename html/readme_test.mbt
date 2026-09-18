///|
using @rabbita {type Emit}

///|
using @html {type Html, type Mouse, div, h1, button, node}

///|
#warnings("-struct_never_constructed-unused_field")
struct Model {
  count : Int
  records : Array[String]
}

///|
#warnings("-unused_constructor")
enum Msg {
  Inc
  Dec
}

///|
#warnings("-unused_constructor")
enum Msg2 {
  StartDraw(Mouse)
  EndDraw(Mouse)
}

///|
test {
  ignore(view)
  ignore(view2)
  ignore(html)
  ignore(html1)
  ignore(html2)
}

///|
#cfg(target="js")
test {
  ignore(update2)
}

///|
type Model2 = Unit
