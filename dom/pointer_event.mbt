///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent
#cfg(target="js")
#external
type PointerEvent

///|
#cfg(target="js")
pub impl IsEvent for PointerEvent

///|
#cfg(target="js")
pub impl IsUIEvent for PointerEvent

///|
#cfg(target="js")
pub impl IsMouseEvent for PointerEvent

///|
#cfg(target="js")
pub impl @js.Cast for PointerEvent with fn into(value) {
  value |> ffi_to_pointer_event |> result => { result.to_option() }
}

///|
#cfg(target="js")
pub impl @js.Cast for PointerEvent with fn from(value) {
  value |> js_identity
}

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId
#cfg(target="js")
pub extern "js" fn PointerEvent::get_pointer_id(self : Self) -> Int = "(event) => event.pointerId"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/width
#cfg(target="js")
pub extern "js" fn PointerEvent::get_width(self : Self) -> Double = "(event) => event.width"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/height
#cfg(target="js")
pub extern "js" fn PointerEvent::get_height(self : Self) -> Double = "(event) => event.height"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pressure
#cfg(target="js")
pub extern "js" fn PointerEvent::get_pressure(self : Self) -> Double = "(event) => event.pressure"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/tangentialPressure
#cfg(target="js")
pub extern "js" fn PointerEvent::get_tangential_pressure(self : Self) -> Double = "(event) => event.tangentialPressure"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/tiltX
#cfg(target="js")
pub extern "js" fn PointerEvent::get_tilt_x(self : Self) -> Int = "(event) => event.tiltX"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/tiltY
#cfg(target="js")
pub extern "js" fn PointerEvent::get_tilt_y(self : Self) -> Int = "(event) => event.tiltY"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/twist
#cfg(target="js")
pub extern "js" fn PointerEvent::get_twist(self : Self) -> Int = "(event) => event.twist"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/altitudeAngle
#cfg(target="js")
pub extern "js" fn PointerEvent::get_altitude_angle(self : Self) -> Double = "(event) => event.altitudeAngle"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/azimuthAngle
#cfg(target="js")
pub extern "js" fn PointerEvent::get_azimuth_angle(self : Self) -> Double = "(event) => event.azimuthAngle"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerType
#cfg(target="js")
pub extern "js" fn PointerEvent::get_pointer_type(self : Self) -> String = "(event) => event.pointerType"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/isPrimary
#cfg(target="js")
pub extern "js" fn PointerEvent::get_is_primary(self : Self) -> Bool = "(event) => event.isPrimary"
