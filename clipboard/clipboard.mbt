///|
pub(all) enum Item {
  Text(String)
}

///|
/// Returns a command that copies the given item to the clipboard.
/// 
/// # Message
/// 
/// - `copied` is triggered if the copy operation is successful.
/// - `failed` is triggered with the error message if the copy operation fails.
pub fn copy(item : Item, copied? : Cmd, failed? : (String) -> Cmd) -> Cmd {
  op.request(ClipboardCopy(item, copied, failed))
}

///|
/// Returns a command that pastes the clipboard content and returns it as an item.
/// 
/// # Message
/// - `pasted` is triggered with the pasted item if the paste operation is successful.
/// - `failed` is triggered with the error message if the paste operation fails.
pub fn paste(pasted~ : (Item) -> Cmd, failed? : (String) -> Cmd) -> Cmd {
  op.request(ClipboardPaste(pasted, failed))
}
