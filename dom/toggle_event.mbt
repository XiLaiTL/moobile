///|
/// https://developer.mozilla.org/en-US/docs/Web/API/ToggleEvent
#cfg(target="js")
#external
type ToggleEvent

///|
#cfg(target="js")
pub impl IsEvent for ToggleEvent

///|
#cfg(target="js")
pub impl @js.Cast for ToggleEvent with fn into(value) {
  value |> ffi_to_toggle_event |> result => { result.to_option() }
}

///|
#cfg(target="js")
pub impl @js.Cast for ToggleEvent with fn from(value) {
  value |> js_identity
}

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/ToggleEvent/oldState
#cfg(target="js")
pub extern "js" fn ToggleEvent::get_old_state(self : Self) -> String = "(event) => event.oldState"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/ToggleEvent/newState
#cfg(target="js")
pub extern "js" fn ToggleEvent::get_new_state(self : Self) -> String = "(event) => event.newState"
