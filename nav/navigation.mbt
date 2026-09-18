///|
/// Create a command to go back in history. 
/// This will cause the page to reload.
pub fn back() -> Cmd {
  op.request(NavBack)
}

///|
/// Create a command to go forward in history. 
/// This will cause the page to reload.
pub fn forward() -> Cmd {
  op.request(NavForward)
}

///|
/// Create a command to load a new URL. 
/// This will cause the page to reload.
pub fn load(url : String) -> Cmd {
  op.request(NavLoad(url))
}

///|
/// Create a command to reload the current url.
pub fn reload() -> Cmd {
  op.request(NavReload)
}

///|
/// Create a command to push a new URL to history but not trigger a page load.
/// 
/// This will trigger the `url_changed` message.
pub fn push_url(url : String) -> Cmd {
  op.request(NavPushUrl(url))
}

///|
/// Create a command to change the URL but not trigger a page load.
/// 
/// This will trigger the `url_changed` message.
pub fn replace_url(url : String) -> Cmd {
  op.request(NavReplaceUrl(url))
}
