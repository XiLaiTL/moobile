///|
test "navigation commands have structural debug output" {
  debug_inspect(@nav.back(), content="NavBack")
  debug_inspect(@nav.push_url("/profile"), content="NavPushUrl(\"/profile\")")
  debug_inspect(
    @nav.scroll_to_pos(10, 20, behavior=Smooth),
    content="NavScrollToPos(10, 20, Smooth)",
  )
}
