///|
test "clipboard commands have structural debug output" {
  debug_inspect(
    @clipboard.copy(Text("hello")),
    content="ClipboardCopy(Text(\"hello\"))",
  )
  debug_inspect(
    @clipboard.paste(pasted=_ => @cmd.none),
    content="ClipboardPaste",
  )
}
