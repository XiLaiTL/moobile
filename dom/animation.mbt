///|
/// https://developer.mozilla.org/en-US/docs/Web/API/Animation
#cfg(target="js")
#external
type Animation

///|
#cfg(target="js")
pub impl IsEventTarget for Animation

///|
#cfg(target="js")
pub impl @js.Cast for Animation with fn into(value) {
  value |> ffi_to_animation |> animation => { animation.to_option() }
}

///|
#cfg(target="js")
pub impl @js.Cast for Animation with fn from(value) {
  value |> js_identity
}

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/Animation/finish
#cfg(target="js")
pub extern "js" fn Animation::finish(self : Self) -> Unit = "(self) => self.finish()"

///|
#cfg(target="js")
extern "js" fn ffi_to_animation(value : @js.Value) -> @js.Nullable[Animation] =
  #| (value) => typeof Animation !== "undefined"
  #|   && value instanceof Animation
  #|   ? value
  #|   : null
