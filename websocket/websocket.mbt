///|
using @cmd {type Cmd}

///|
/// Open or replace a named browser WebSocket connection.
///
/// Reconnecting with the same `id` replaces the old socket after the new one
/// has been created and wired.
pub fn connect(
  id : String,
  url : String,
  protocols? : Array[String] = [],
  on_event~ : @cmd.Emit[Event],
  failed? : @cmd.Emit[String],
) -> Cmd {
  op.request(WebSocketConnect(id, url, protocols, on_event, failed))
}

///|
/// Send an outbound payload through a named WebSocket connection.
pub fn send(id : String, payload : Payload, failed? : @cmd.Emit[String]) -> Cmd {
  op.request(WebSocketSend(id, payload, failed))
}

///|
/// Request closing a named WebSocket connection.
///
/// The registry entry remains until the real browser `close` event arrives.
pub fn close(
  id : String,
  code? : Int,
  reason? : String,
  failed? : @cmd.Emit[String],
) -> Cmd {
  op.request(WebSocketClose(id, code, reason, failed))
}

///|
/// Read the current state of a named WebSocket connection.
pub fn state(id : String, reply~ : @cmd.Emit[Result[Snapshot, String]]) -> Cmd {
  op.request(WebSocketState(id, reply))
}
