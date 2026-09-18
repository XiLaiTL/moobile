///|
/// https://developer.mozilla.org/en-US/docs/Web/API/TransitionEvent
#cfg(target="js")
#external
type TransitionEvent

///|
#cfg(target="js")
pub impl IsEvent for TransitionEvent

///|
#cfg(target="js")
pub impl @js.Cast for TransitionEvent with fn into(value) {
  value |> ffi_to_transition_event |> result => { result.to_option() }
}

///|
#cfg(target="js")
pub impl @js.Cast for TransitionEvent with fn from(value) {
  value |> js_identity
}

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/TransitionEvent/propertyName
#cfg(target="js")
pub extern "js" fn TransitionEvent::get_property_name(self : Self) -> String = "(event) => event.propertyName"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/TransitionEvent/elapsedTime
#cfg(target="js")
pub extern "js" fn TransitionEvent::get_elapsed_time(self : Self) -> Double = "(event) => event.elapsedTime"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/TransitionEvent/pseudoElement
#cfg(target="js")
pub extern "js" fn TransitionEvent::get_pseudo_element(self : Self) -> String = "(event) => event.pseudoElement"
