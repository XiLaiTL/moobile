///|
/// Create a command to show a dialog.
/// 
/// The `modal` argument determines whether the dialog is modal or not.
pub fn show(id : String, modal? : Bool = true) -> Cmd {
  op.request(DialogShow(id, modal))
}

///|
/// Create a command to close a dialog.
/// 
/// The `return_value` argument is the value that will be filled in the `close` message.
pub fn close(id : String, return_value? : String) -> Cmd {
  op.request(DialogClose(id, return_value))
}

///|
/// Create a command to request closing a dialog.
/// 
/// This command will not close the dialog immediately; it will trigger the 
/// `cancel` message.
/// 
/// The `return_value` argument is the value that will be filled in the `close` message.
pub fn request_close(id : String, return_value? : String) -> Cmd {
  op.request(DialogRequestClose(id, return_value))
}
