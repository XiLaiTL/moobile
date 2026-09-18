///|
#cfg(target="js")
extern "js" fn core_primitives_test_element() -> Element =
  #| () => {
  #|   const selected = { nodeType: 1, id: "selected" }
  #|   const parent = { nodeType: 1, id: "parent" }
  #|   const captured = new Set()
  #|   return {
  #|     nodeType: 1,
  #|     children: [selected],
  #|     querySelector: selector => selector === ".hit" ? selected : null,
  #|     querySelectorAll: selector => selector === ".hit" ? [selected] : [],
  #|     closest: selector => selector === ".root" ? parent : null,
  #|     matches: selector => selector === ".root",
  #|     contains: node => node === selected,
  #|     hasAttribute: name => name === "data-ready",
  #|     getAttribute: name => name === "data-ready" ? "yes" : null,
  #|     parentElement: parent,
  #|     isConnected: true,
  #|     clientWidth: 320,
  #|     clientHeight: 180,
  #|     clientLeft: 2,
  #|     clientTop: 3,
  #|     getClientRects: () => [{}, {}],
  #|     setPointerCapture: id => {
  #|       if (id < 0) throw new Error("invalid pointer")
  #|       captured.add(id)
  #|     },
  #|     releasePointerCapture: id => {
  #|       if (!captured.has(id)) throw new Error("missing pointer")
  #|       captured.delete(id)
  #|     },
  #|     hasPointerCapture: id => captured.has(id),
  #|     scrollIntoView(options) { this.__scrollOptions = options },
  #|     getAnimations: () => [{ finish() { this.finished = true } }],
  #|   }
  #| }

///|
#cfg(target="js")
extern "js" fn core_primitives_test_scroll_options(element : Element) -> String =
  #| element => {
  #|   const options = element.__scrollOptions
  #|   return [options.behavior, options.block, options.inline, options.container].join(",")
  #| }

///|
#cfg(target="js")
extern "js" fn core_primitives_test_document() -> Document =
  #| () => ({
  #|   activeElement: { nodeType: 1, id: "active" },
  #|   head: { nodeType: 1, id: "head" },
  #|   body: { nodeType: 1, id: "body" },
  #|   documentElement: { nodeType: 1, id: "document-element" },
  #|   elementFromPoint: (x, y) => (
  #|     x === 12.5 && y === 24.75 ? { nodeType: 1, id: "point" } : null
  #|   ),
  #|   elementsFromPoint: (x, y) => (
  #|     x === 12.5 && y === 24.75
  #|       ? [{ nodeType: 1, id: "point" }, { nodeType: 1, id: "parent" }]
  #|       : []
  #|   ),
  #| })

///|
#cfg(target="js")
extern "js" fn core_primitives_test_event_target() -> EventTarget =
  #| () => ({
  #|   addEventListener(type, listener, options) {
  #|     this.__listenerOptions = ["add", type, options.capture, options.passive, options.once]
  #|   },
  #|   removeEventListener(type, listener, options) {
  #|     this.__listenerOptions = ["remove", type, options.capture]
  #|   },
  #| })

///|
#cfg(target="js")
extern "js" fn core_primitives_test_listener_options(
  target : EventTarget,
) -> String = "target => target.__listenerOptions.join(',')"

///|
#cfg(target="js")
extern "js" fn core_primitives_test_html_element() -> HTMLElement =
  #| () => ({
  #|   nodeType: 1,
  #|   focus(options) { this.__focusOptions = options },
  #| })

///|
#cfg(target="js")
extern "js" fn core_primitives_test_popover_element() -> HTMLElement =
  #| () => ({
  #|   nodeType: 1,
  #|   __open: false,
  #|   showPopover() {
  #|     this.__open = true
  #|   },
  #|   hidePopover() {
  #|     this.__open = false
  #|   },
  #| })

///|
#cfg(target="js")
extern "js" fn core_primitives_test_popover_open(element : HTMLElement) -> Bool = "element => element.__open"

///|
#cfg(target="js")
extern "js" fn core_primitives_test_focus_options(
  element : HTMLElement,
) -> String =
  #| element => [element.__focusOptions.preventScroll, element.__focusOptions.focusVisible].join(",")

///|
#cfg(target="js")
extern "js" fn core_primitives_test_focus_event() -> FocusEvent = "() => ({ relatedTarget: null })"

///|
#cfg(target="js")
extern "js" fn core_primitives_test_mouse_event() -> MouseEvent = "() => ({ relatedTarget: null })"

///|
#cfg(target="js")
extern "js" fn core_primitives_test_event_options(event : Event) -> String =
  #| event => [event.type, event.bubbles, event.cancelable, event.composed].join(",")

///|
#cfg(target="js")
extern "js" fn core_primitives_test_input() -> HTMLInputElement = "() => ({ nodeType: 1, value: 'before' })"

///|
#cfg(target="js")
extern "js" fn core_primitives_test_window() -> Window =
  #| () => ({
  #|   setTimeout(callback, ms) {
  #|     this.__timeoutDelay = ms
  #|     callback()
  #|     return ms + 1
  #|   },
  #|   clearTimeout(id) { this.__clearedTimeout = id },
  #|   queueMicrotask(callback) { callback() },
  #|   performance: { now: () => 123.5 },
  #| })

///|
#cfg(target="js")
extern "js" fn core_primitives_test_cleared_timeout(window_ : Window) -> Int = "window => window.__clearedTimeout"

///|
#cfg(target="js")
extern "js" fn core_primitives_test_image_target() -> EventTarget =
  #| () => {
  #|   globalThis.__domTestHTMLImageElement = globalThis.HTMLImageElement
  #|   globalThis.HTMLImageElement = class HTMLImageElement extends EventTarget {
  #|     constructor() {
  #|       super()
  #|       this.complete = true
  #|       this.naturalWidth = 640
  #|     }
  #|   }
  #|   return new HTMLImageElement()
  #| }

///|
#cfg(target="js")
extern "js" fn core_primitives_test_restore_image_type() -> Unit =
  #| () => {
  #|   if (globalThis.__domTestHTMLImageElement === undefined) delete globalThis.HTMLImageElement
  #|   else globalThis.HTMLImageElement = globalThis.__domTestHTMLImageElement
  #|   delete globalThis.__domTestHTMLImageElement
  #| }

///|
#cfg(target="js")
extern "js" fn core_primitives_test_subtype_events() -> Array[Event] =
  #| () => {
  #|   globalThis.__domTestPointerEvent = globalThis.PointerEvent
  #|   globalThis.__domTestTransitionEvent = globalThis.TransitionEvent
  #|   globalThis.__domTestToggleEvent = globalThis.ToggleEvent
  #|   globalThis.PointerEvent = class PointerEvent {
  #|     constructor() {
  #|       this.pointerId = 7
  #|       this.width = 8.5
  #|       this.height = 9.5
  #|       this.pressure = 0.75
  #|       this.tangentialPressure = 0.25
  #|       this.tiltX = 10
  #|       this.tiltY = 11
  #|       this.twist = 12
  #|       this.altitudeAngle = 0.5
  #|       this.azimuthAngle = 1.5
  #|       this.pointerType = "pen"
  #|       this.isPrimary = true
  #|     }
  #|   }
  #|   globalThis.TransitionEvent = class TransitionEvent {
  #|     constructor() {
  #|       this.propertyName = "opacity"
  #|       this.elapsedTime = 0.2
  #|       this.pseudoElement = "::before"
  #|     }
  #|   }
  #|   globalThis.ToggleEvent = class ToggleEvent {
  #|     constructor() {
  #|       this.oldState = "closed"
  #|       this.newState = "open"
  #|     }
  #|   }
  #|   return [new PointerEvent(), new TransitionEvent(), new ToggleEvent()]
  #| }

///|
#cfg(target="js")
extern "js" fn core_primitives_test_restore_event_types() -> Unit =
  #| () => {
  #|   if (globalThis.__domTestPointerEvent === undefined) delete globalThis.PointerEvent
  #|   else globalThis.PointerEvent = globalThis.__domTestPointerEvent
  #|   if (globalThis.__domTestTransitionEvent === undefined) delete globalThis.TransitionEvent
  #|   else globalThis.TransitionEvent = globalThis.__domTestTransitionEvent
  #|   if (globalThis.__domTestToggleEvent === undefined) delete globalThis.ToggleEvent
  #|   else globalThis.ToggleEvent = globalThis.__domTestToggleEvent
  #|   delete globalThis.__domTestPointerEvent
  #|   delete globalThis.__domTestTransitionEvent
  #|   delete globalThis.__domTestToggleEvent
  #| }

///|
#cfg(target="js")
extern "js" fn core_primitives_test_platform_window() -> Window =
  #| () => {
  #|   const names = [
  #|     "CSS",
  #|     "ResizeObserver",
  #|     "MutationObserver",
  #|     "IntersectionObserver",
  #|   ]
  #|   globalThis.__domTestPlatformGlobals = Object.fromEntries(names.map(name => [
  #|     name,
  #|     {
  #|       had: Object.prototype.hasOwnProperty.call(globalThis, name),
  #|       value: globalThis[name],
  #|     },
  #|   ]))
  #|   globalThis.__domTestObserverLog = []
  #|   globalThis.CSS = {
  #|     supports: (property, value) => property === "position-anchor" && value === "--trigger",
  #|   }
  #|   globalThis.ResizeObserver = class ResizeObserver {
  #|     constructor(callback) { this.callback = callback }
  #|     observe() { globalThis.__domTestObserverLog.push("resize:observe") }
  #|     unobserve() { globalThis.__domTestObserverLog.push("resize:unobserve") }
  #|     disconnect() { globalThis.__domTestObserverLog.push("resize:disconnect") }
  #|   }
  #|   globalThis.MutationObserver = class MutationObserver {
  #|     constructor(callback) { this.callback = callback }
  #|     observe(target, options) {
  #|       const option = name => Object.prototype.hasOwnProperty.call(options, name)
  #|         ? options[name]
  #|         : "omitted"
  #|       const attributeFilter = option("attributeFilter")
  #|       globalThis.__domTestObserverLog.push(
  #|         `mutation:${option("attributes")}:${option("childList")}:${option("subtree")}:${attributeFilter === "omitted" ? attributeFilter : attributeFilter.join("|")}:${option("attributeOldValue")}:${option("characterData")}:${option("characterDataOldValue")}`,
  #|       )
  #|     }
  #|     disconnect() { globalThis.__domTestObserverLog.push("mutation:disconnect") }
  #|   }
  #|   globalThis.IntersectionObserver = class IntersectionObserver {
  #|     constructor(callback, options) {
  #|       this.callback = callback
  #|       const thresholds = options === undefined ? null : options.threshold
  #|       if (thresholds !== null && thresholds.some(value => value < 0 || value > 1)) {
  #|         throw new RangeError("threshold out of range")
  #|       }
  #|       const threshold = thresholds === null ? "default" : thresholds.join("|")
  #|       globalThis.__domTestObserverLog.push(`intersection:${threshold}`)
  #|     }
  #|     observe() { globalThis.__domTestObserverLog.push("intersection:observe") }
  #|     unobserve() { globalThis.__domTestObserverLog.push("intersection:unobserve") }
  #|     disconnect() { globalThis.__domTestObserverLog.push("intersection:disconnect") }
  #|   }
  #|   const visualViewport = {
  #|     width: 640,
  #|     height: 480,
  #|     offsetLeft: 12,
  #|     offsetTop: 18,
  #|     addEventListener() {},
  #|     removeEventListener() {},
  #|     dispatchEvent() { return true },
  #|   }
  #|   return {
  #|     visualViewport,
  #|     matchMedia(query) {
  #|       return {
  #|         matches: query === "(reduce)",
  #|         addEventListener() {},
  #|         removeEventListener() {},
  #|         dispatchEvent() { return true },
  #|       }
  #|     },
  #|     getComputedStyle() {
  #|       return { getPropertyValue: property => property === "direction" ? "rtl" : "" }
  #|     },
  #|   }
  #| }

///|
#cfg(target="js")
extern "js" fn core_primitives_test_observer_log() -> String =
  #| () => globalThis.__domTestObserverLog.join(",")

///|
#cfg(target="js")
extern "js" fn core_primitives_test_mutation_record() -> MutationRecord =
  #| () => ({ attributeName: "data-open" })

///|
#cfg(target="js")
extern "js" fn core_primitives_test_restore_platform_globals() -> Unit =
  #| () => {
  #|   for (const [name, saved] of Object.entries(globalThis.__domTestPlatformGlobals)) {
  #|     if (saved.had) globalThis[name] = saved.value
  #|     else delete globalThis[name]
  #|   }
  #|   delete globalThis.__domTestPlatformGlobals
  #|   delete globalThis.__domTestObserverLog
  #| }

///|
#cfg(target="js")
test "element and document core primitives expose browser values" {
  let element = core_primitives_test_element()
  guard element.query_selector(".hit") is Some(selected) else {
    fail("expected querySelector to find the child")
  }
  assert_eq(element.query_selector_all(".hit").length(), 1)
  assert_true(element.query_selector(".missing") is None)
  assert_true(element.closest(".root") is Some(_))
  assert_true(element.matches(".root"))
  assert_true(element.contains(selected.as_node()))
  assert_true(element.has_attribute("data-ready"))
  assert_eq(element.get_attribute("data-ready"), Some("yes"))
  assert_eq(element.get_attribute("data-missing"), None)
  assert_true(element.get_parent_element() is Some(_))
  assert_true(element.get_is_connected())
  assert_eq(element.get_client_width(), 320.0)
  assert_eq(element.get_client_height(), 180.0)
  assert_eq(element.get_client_left(), 2.0)
  assert_eq(element.get_client_top(), 3.0)
  assert_eq(element.get_client_rects().length(), 2)
  element.set_pointer_capture(7)
  assert_true(element.has_pointer_capture(7))
  element.release_pointer_capture(7)
  assert_false(element.has_pointer_capture(7))
  element.scroll_into_view_with_options(
    behavior="smooth",
    block="center",
    inline="end",
    container="nearest",
  )
  assert_eq(
    core_primitives_test_scroll_options(element),
    "smooth,center,end,nearest",
  )
  let document = core_primitives_test_document()
  assert_true(document.get_active_element() is Some(_))
  assert_true(document.get_head() is Some(_))
  assert_true(document.get_body() is Some(_))
  assert_true(document.get_document_element() is Some(_))
  assert_true(document.element_from_point(12.5, 24.75) is Some(_))
  assert_true(document.element_from_point(12.5, 25.0) is None)
  assert_eq(document.elements_from_point(12.5, 24.75).length(), 2)
  assert_eq(document.elements_from_point(12.5, 25.0).length(), 0)
}

///|
#cfg(target="js")
test "popover primitives mirror browser methods" {
  let popover = core_primitives_test_popover_element()
  popover.show_popover()
  assert_true(core_primitives_test_popover_open(popover))
  popover.hide_popover()
  assert_false(core_primitives_test_popover_open(popover))
}

///|
#cfg(target="js")
test "event, listener, focus, and input primitives preserve optional values" {
  let event = Event::new("ready", bubbles=true, cancelable=true, composed=true)
  assert_eq(core_primitives_test_event_options(event), "ready,true,true,true")
  assert_false(event.get_default_prevented())
  event.prevent_default()
  assert_true(event.get_default_prevented())
  assert_true(event.get_time_stamp() >= 0.0)
  assert_eq(event.composed_path().length(), 0)
  event.stop_immediate_propagation()
  let target = core_primitives_test_event_target()
  let listener : Listener = _ => ()
  target.add_event_listener_with_options(
    "wheel",
    listener,
    capture=true,
    passive=true,
    once=true,
  )
  assert_eq(
    core_primitives_test_listener_options(target),
    "add,wheel,true,true,true",
  )
  target.remove_event_listener_with_options("wheel", listener, capture=true)
  assert_eq(core_primitives_test_listener_options(target), "remove,wheel,true")
  let focusable = core_primitives_test_html_element()
  focusable.focus_with_options(prevent_scroll=true, focus_visible=true)
  assert_eq(core_primitives_test_focus_options(focusable), "true,true")
  focusable.focus_with_options()
  assert_eq(core_primitives_test_focus_options(focusable), "false,")
  assert_true(core_primitives_test_focus_event().related_target() is None)
  assert_true(core_primitives_test_mouse_event().get_related_target() is None)
  let input = core_primitives_test_input()
  assert_eq(input.value(), "before")
  input.set_value("after")
  assert_eq(input.value(), "after")
  let image_target = core_primitives_test_image_target()
  guard image_target.to_html_image_element() is Some(image) else {
    fail("expected HTMLImageElement conversion")
  }
  assert_true(image.get_complete())
  assert_eq(image.get_natural_width(), 640.0)
  let _ : EventTarget = image.as_event_target()
  core_primitives_test_restore_image_type()
}

///|
#cfg(target="js")
test "pointer, transition, and toggle event conversions expose subtype fields" {
  let events = core_primitives_test_subtype_events()
  guard events[0].to_pointer_event() is Some(pointer) else {
    fail("expected PointerEvent conversion")
  }
  assert_eq(pointer.get_pointer_id(), 7)
  assert_eq(pointer.get_width(), 8.5)
  assert_eq(pointer.get_pressure(), 0.75)
  assert_eq(pointer.get_pointer_type(), "pen")
  assert_true(pointer.get_is_primary())
  let transition_event : TransitionEvent? = @js.Cast::into(
    @js.Value::cast_from(events[1]),
  )
  guard transition_event is Some(transition) else {
    fail("expected TransitionEvent conversion")
  }
  assert_eq(transition.get_property_name(), "opacity")
  assert_eq(transition.get_elapsed_time(), 0.2)
  assert_eq(transition.get_pseudo_element(), "::before")
  let toggle_event : ToggleEvent? = @js.Cast::into(
    @js.Value::cast_from(events[2]),
  )
  guard toggle_event is Some(toggle) else {
    fail("expected ToggleEvent conversion")
  }
  assert_eq(toggle.get_old_state(), "closed")
  assert_eq(toggle.get_new_state(), "open")
  core_primitives_test_restore_event_types()
}

///|
#cfg(target="js")
test "window scheduling and performance primitives mirror browser APIs" {
  let window = core_primitives_test_window()
  let timeout_called = [false]
  let timeout_id = window.set_timeout(() => timeout_called[0] = true, 12)
  assert_true(timeout_called[0])
  assert_eq(timeout_id, 13)
  window.clear_timeout(timeout_id)
  assert_eq(core_primitives_test_cleared_timeout(window), 13)
  let microtask_called = [false]
  window.queue_microtask(() => microtask_called[0] = true)
  assert_true(microtask_called[0])
  assert_eq(window.get_performance().now(), 123.5)
}

///|
#cfg(target="js")
test "CSS, viewport, media, animation, and observer primitives mirror browser APIs" {
  let window = core_primitives_test_platform_window()
  assert_true(CSS::supports("position-anchor", "--trigger"))
  assert_false(CSS::supports("unknown", "value"))
  let element = core_primitives_test_element()
  assert_eq(
    window.get_computed_style(element).get_property_value("direction"),
    "rtl",
  )
  guard window.get_visual_viewport() is Some(viewport) else {
    fail("expected visual viewport")
  }
  assert_eq(viewport.get_width(), 640.0)
  assert_eq(viewport.get_height(), 480.0)
  assert_eq(viewport.get_offset_left(), 12.0)
  assert_eq(viewport.get_offset_top(), 18.0)
  let media = window.match_media("(reduce)")
  assert_true(media.get_matches())
  let animations = element.get_animations()
  assert_eq(animations.length(), 1)
  animations[0].finish()
  let resize = ResizeObserver::new((_, _) => ())
  resize.observe(element)
  resize.unobserve(element)
  resize.disconnect()
  let mutation = MutationObserver::new((_, _) => ())
  mutation.observe(element.as_node(), child_list=true, subtree=true, attribute_filter=[
    "data-open", "aria-expanded",
  ])
  mutation.observe(
    element.as_node(),
    attributes=false,
    child_list=true,
    attribute_old_value=false,
    character_data=true,
    character_data_old_value=true,
  )
  mutation.disconnect()
  assert_eq(
    core_primitives_test_mutation_record().get_attribute_name(),
    Some("data-open"),
  )
  let intersection = IntersectionObserver::new((_, _) => (), threshold=[
    0.0, 1.0,
  ])
  intersection.observe(element)
  intersection.unobserve(element)
  intersection.disconnect()
  assert_eq(
    core_primitives_test_observer_log(),
    "resize:observe,resize:unobserve,resize:disconnect,mutation:omitted:true:true:data-open|aria-expanded:omitted:omitted:omitted,mutation:false:true:omitted:omitted:false:true:true,mutation:disconnect,intersection:0|1,intersection:observe,intersection:unobserve,intersection:disconnect",
  )
  core_primitives_test_restore_platform_globals()
}
