///|
#cfg(target="js")
#external
type UIEvent

///|
#cfg(target="js")
pub trait IsUIEvent: IsEvent {
  fn as_ui_event(Self) -> UIEvent = _
}

///|
#cfg(target="js")
impl IsUIEvent with fn as_ui_event(s) {
  s |> js_identity
}

///|
#cfg(target="js")
pub impl IsEvent for UIEvent

///|
#cfg(target="js")
pub impl IsUIEvent for UIEvent

///|
#cfg(target="js")
pub impl @js.Cast for UIEvent with fn into(value) {
  value |> ffi_to_ui_event |> y => { y.to_option() }
}

///|
#cfg(target="js")
pub impl @js.Cast for UIEvent with fn from(value) {
  value |> js_identity
}
