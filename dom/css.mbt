///|
/// https://developer.mozilla.org/en-US/docs/Web/API/CSS
#warnings("-unused_type_declaration")
#cfg(target="js")
#external
type CSS

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/CSS/supports_static
#cfg(target="js")
pub extern "js" fn CSS::supports(property : String, value : String) -> Bool =
  #| (property, value) => CSS.supports(property, value)
