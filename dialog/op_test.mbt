///|
test "dialog commands have structural debug output" {
  debug_inspect(
    @dialog.show("settings"),
    content="DialogShow(\"settings\", true)",
  )
  debug_inspect(
    @dialog.close("settings", return_value="saved"),
    content="DialogClose(\"settings\", Some(\"saved\"))",
  )
  debug_inspect(
    @dialog.request_close("settings"),
    content="DialogRequestClose(\"settings\", None)",
  )
}
