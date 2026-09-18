///|
/// https://developer.mozilla.org/en-US/docs/Web/API/Performance
#cfg(target="js")
#external
type Performance

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/Window/performance
#cfg(target="js")
pub extern "js" fn Window::get_performance(self : Self) -> Performance = "(self) => self.performance"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
#cfg(target="js")
pub extern "js" fn Performance::now(self : Self) -> DOMHighResTimeStamp = "(self) => self.now()"
