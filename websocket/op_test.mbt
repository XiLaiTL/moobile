///|
test "websocket commands have structural debug output" {
  debug_inspect(
    @websocket.connect(
      "events",
      "wss://example.com/events",
      protocols=["json"],
      on_event=_ => @cmd.none,
    ),
    content=(
      #|WebSocketConnect("events", "wss://example.com/events", ["json"])
    ),
  )
  debug_inspect(
    @websocket.send("events", Text("ping")),
    content="WebSocketSend(\"events\", Text(\"ping\"))",
  )
  debug_inspect(
    @websocket.close("events", code=1000, reason="done"),
    content="WebSocketClose(\"events\", Some(1000), Some(\"done\"))",
  )
  debug_inspect(
    @websocket.state("events", reply=_ => @cmd.none),
    content="WebSocketState(\"events\")",
  )
}
