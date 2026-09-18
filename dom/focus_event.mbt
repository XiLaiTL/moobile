///|
#cfg(target="js")
#external
type FocusEvent

///|
#cfg(target="js")
pub impl IsEvent for FocusEvent

///|
#cfg(target="js")
pub impl IsUIEvent for FocusEvent

///|
#cfg(target="js")
pub impl @js.Cast for FocusEvent with fn into(value) {
  value |> ffi_to_focus_event |> y => { y.to_option() }
}

///|
#cfg(target="js")
pub impl @js.Cast for FocusEvent with fn from(value) {
  value |> js_identity
}

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/relatedTarget
#cfg(target="js")
pub fn FocusEvent::related_target(self : Self) -> EventTarget? {
  ffi_focus_event_related_target(self).to_option()
}

///|
#cfg(target="js")
extern "js" fn ffi_focus_event_related_target(
  event : FocusEvent,
) -> @js.Nullable[EventTarget] = "(event) => event.relatedTarget"
