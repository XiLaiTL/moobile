///|
/// https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
#cfg(target="js")
type WebSocket

///|
#cfg(target="js")
pub impl IsEventTarget for WebSocket

///|
#cfg(target="js")
pub impl @js.Cast for WebSocket with fn into(value) {
  value |> ffi_to_web_socket |> y => { y.to_option() }
}

///|
#cfg(target="js")
pub impl @js.Cast for WebSocket with fn from(value) {
  value |> js_identity
}

///|
#cfg(target="js")
pub extern "js" fn WebSocket::new(url : String) -> WebSocket = "(url) => new WebSocket(url)"

///|
#cfg(target="js")
pub extern "js" fn WebSocket::new_with_protocols(
  url : String,
  protocols : Array[String],
) -> WebSocket = "(url, protocols) => new WebSocket(url, protocols)"

///|
#cfg(target="js")
pub fn WebSocket::open(
  url : String,
  protocols? : Array[String] = [],
) -> Result[WebSocket, String] {
  let mut result : Result[WebSocket, String] = Err(
    "websocket creation failed without an error message",
  )
  ffi_open_socket(
    url,
    protocols,
    has_protocols=!protocols.is_empty(),
    opened=socket => result = Ok(socket),
    failed=message => result = Err(message),
  )
  result
}

///|
#cfg(target="js")
pub extern "js" fn WebSocket::close(self : Self) = "(socket) => socket.close()"

///|
#cfg(target="js")
pub extern "js" fn WebSocket::close_with_code_reason(
  self : Self,
  code : Int,
  reason : String,
) = "(socket, code, reason) => socket.close(code, reason)"

///|
#cfg(target="js")
pub fn WebSocket::close_safe(
  self : Self,
  code? : Int,
  reason? : String,
) -> Result[Unit, String] {
  let mut result : Result[Unit, String] = Ok(())
  ffi_close_socket(
    self,
    code,
    reason,
    has_code=code is Some(_),
    has_reason=reason is Some(_),
    failed=message => result = Err(message),
  )
  result
}

///|
#cfg(target="js")
pub fn WebSocket::close_quietly(self : Self) -> Unit {
  ffi_close_socket_quietly(self)
}

///|
#cfg(target="js")
pub extern "js" fn WebSocket::send(self : Self, data : String) = "(socket, data) => socket.send(data)"

///|
#cfg(target="js")
pub fn WebSocket::send_safe(self : Self, data : String) -> Result[Unit, String] {
  let mut result : Result[Unit, String] = Ok(())
  ffi_send_socket(self, data, failed=message => result = Err(message))
  result
}

///|
#cfg(target="js")
pub extern "js" fn WebSocket::get_url(self : Self) -> String = "(socket) => socket.url"

///|
#cfg(target="js")
pub extern "js" fn WebSocket::get_protocol(self : Self) -> String = "(socket) => socket.protocol"

///|
#cfg(target="js")
pub extern "js" fn WebSocket::get_buffered_amount(self : Self) -> Int = "(socket) => socket.bufferedAmount"

///|
#cfg(target="js")
pub extern "js" fn WebSocket::get_ready_state(self : Self) -> Int = "(socket) => socket.readyState"

///|
#cfg(target="js")
extern "js" fn ffi_to_web_socket(x : @js.Value) -> @js.Nullable[WebSocket] =
  #| (x) => x instanceof WebSocket ? x : null

///|
#cfg(target="js")
extern "js" fn ffi_open_socket(
  url : String,
  protocols : Array[String],
  has_protocols~ : Bool,
  opened~ : (WebSocket) -> Unit,
  failed~ : (String) -> Unit,
) =
  #| (url, protocols, hasProtocols, opened, failed) => {
  #|   try {
  #|     opened(hasProtocols ? new WebSocket(url, protocols) : new WebSocket(url))
  #|   } catch (error) {
  #|     failed(error.toString())
  #|   }
  #| }

///|
#cfg(target="js")
extern "js" fn ffi_send_socket(
  socket : WebSocket,
  data : String,
  failed~ : (String) -> Unit,
) =
  #| (socket, data, failed) => {
  #|   try {
  #|     socket.send(data)
  #|   } catch (error) {
  #|     failed(error.toString())
  #|   }
  #| }

///|
#cfg(target="js")
extern "js" fn ffi_close_socket(
  socket : WebSocket,
  code : Int?,
  reason : String?,
  has_code~ : Bool,
  has_reason~ : Bool,
  failed~ : (String) -> Unit,
) =
  #| (socket, code, reason, hasCode, hasReason, failed) => {
  #|   try {
  #|     if (hasCode) {
  #|       socket.close(code, hasReason ? reason : "")
  #|     } else if (hasReason) {
  #|       socket.close(1000, reason)
  #|     } else {
  #|       socket.close()
  #|     }
  #|   } catch (error) {
  #|     failed(error.toString())
  #|   }
  #| }

///|
#cfg(target="js")
extern "js" fn ffi_close_socket_quietly(socket : WebSocket) =
  #| socket => {
  #|   try {
  #|     socket.close()
  #|   } catch (_) {
  #|   }
  #| }
