///|
#cfg(target="js")
type MouseEvent = @dom.MouseEvent

///|
#cfg(target="js")
type KeyboardEvent = @dom.KeyboardEvent

///|
#cfg(target="js")
type FocusEvent = @dom.FocusEvent

///|
#cfg(target="js")
type DragEvent = @dom.DragEvent

///|
#cfg(target="js")
type ClipboardEvent = @dom.ClipboardEvent

///|
#cfg(target="js")
type CompositionEvent = @dom.CompositionEvent

///|
#cfg(target="js")
type WheelEvent = @dom.WheelEvent

///|
#cfg(target="js")
type UIEvent = @dom.UIEvent

///|
#cfg(target="js")
type InputEvent = @dom.InputEvent

///|
#cfg(target="js")
type DomEvent = @dom.Event

///|
#cfg(not(target="js"))
type MouseEvent = Unit

///|
#cfg(not(target="js"))
type KeyboardEvent = Unit

///|
#cfg(not(target="js"))
type FocusEvent = Unit

///|
#cfg(not(target="js"))
type DragEvent = Unit

///|
#cfg(not(target="js"))
type ClipboardEvent = Unit

///|
#cfg(not(target="js"))
type CompositionEvent = Unit

///|
#cfg(not(target="js"))
type WheelEvent = Unit

///|
#cfg(not(target="js"))
type UIEvent = Unit

///|
#cfg(not(target="js"))
type InputEvent = Unit

///|
#cfg(not(target="js"))
type DomEvent = Unit

///|
// Browsers dispatch `scroll` as a plain Event in current Chromium, even though
// older DOM typings exposed it as UIEvent. The wrapper only relies on the
// shared Event surface, so preserve the public callback type without an
// `instanceof UIEvent` assertion that would panic for valid scroll events.
#cfg(target="js")
extern "js" fn scroll_event_as_ui_event(event : DomEvent) -> UIEvent = "(event) => event"

///|
#cfg(target="js")
fn Attrs::on_mouse_event(
  self : Attrs,
  event : String,
  msg : (MouseEvent) -> Cmd,
) -> Attrs {
  self.handler(event, (raw_event, scheduler) => {
    scheduler.add(msg(((event_decoders.val).mouse_event)(raw_event)))
  })
}

///|
#cfg(not(target="js"))
fn Attrs::on_mouse_event(
  self : Attrs,
  event : String,
  msg : (MouseEvent) -> Cmd,
) -> Attrs {
  ignore((event, msg))
  self
}

///|
#cfg(target="js")
fn Attrs::on_keyboard_event(
  self : Attrs,
  event : String,
  msg : (KeyboardEvent) -> Cmd,
) -> Attrs {
  self.handler(event, (raw_event, scheduler) => {
    scheduler.add(msg(((event_decoders.val).keyboard_event)(raw_event)))
  })
}

///|
#cfg(not(target="js"))
fn Attrs::on_keyboard_event(
  self : Attrs,
  event : String,
  msg : (KeyboardEvent) -> Cmd,
) -> Attrs {
  ignore((event, msg))
  self
}

///|
#cfg(target="js")
fn Attrs::on_focus_event(
  self : Attrs,
  event : String,
  msg : (FocusEvent) -> Cmd,
) -> Attrs {
  self.handler(event, (raw_event, scheduler) => {
    scheduler.add(msg(((event_decoders.val).focus_event)(raw_event)))
  })
}

///|
#cfg(not(target="js"))
fn Attrs::on_focus_event(
  self : Attrs,
  event : String,
  msg : (FocusEvent) -> Cmd,
) -> Attrs {
  ignore((event, msg))
  self
}

///|
#cfg(target="js")
fn Attrs::on_drag_event(
  self : Attrs,
  event : String,
  msg : (DragEvent) -> Cmd,
) -> Attrs {
  self.handler(event, (raw_event, scheduler) => {
    scheduler.add(msg(((event_decoders.val).drag_event)(raw_event)))
  })
}

///|
#cfg(not(target="js"))
fn Attrs::on_drag_event(
  self : Attrs,
  event : String,
  msg : (DragEvent) -> Cmd,
) -> Attrs {
  ignore((event, msg))
  self
}

///|
#cfg(target="js")
fn Attrs::on_clipboard_event(
  self : Attrs,
  event : String,
  msg : (ClipboardEvent) -> Cmd,
) -> Attrs {
  self.handler(event, (raw_event, scheduler) => {
    scheduler.add(msg(((event_decoders.val).clipboard_event)(raw_event)))
  })
}

///|
#cfg(not(target="js"))
fn Attrs::on_clipboard_event(
  self : Attrs,
  event : String,
  msg : (ClipboardEvent) -> Cmd,
) -> Attrs {
  ignore((event, msg))
  self
}

///|
#cfg(target="js")
fn Attrs::on_composition_event(
  self : Attrs,
  event : String,
  msg : (CompositionEvent) -> Cmd,
) -> Attrs {
  self.handler(event, (raw_event, scheduler) => {
    scheduler.add(msg(((event_decoders.val).composition_event)(raw_event)))
  })
}

///|
#cfg(not(target="js"))
fn Attrs::on_composition_event(
  self : Attrs,
  event : String,
  msg : (CompositionEvent) -> Cmd,
) -> Attrs {
  ignore((event, msg))
  self
}

///|
#cfg(target="js")
fn Attrs::on_wheel_event(
  self : Attrs,
  event : String,
  msg : (WheelEvent) -> Cmd,
) -> Attrs {
  self.handler(event, (raw_event, scheduler) => {
    scheduler.add(msg(((event_decoders.val).wheel_event)(raw_event)))
  })
}

///|
#cfg(not(target="js"))
fn Attrs::on_wheel_event(
  self : Attrs,
  event : String,
  msg : (WheelEvent) -> Cmd,
) -> Attrs {
  ignore((event, msg))
  self
}

///|
pub fn Attrs::on_click(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("click", msg)
}

///|
pub fn Attrs::on_dblclick(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("dblclick", msg)
}

///|
pub fn Attrs::on_dbclick(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_dblclick(msg)
}

///|
pub fn Attrs::on_mousedown(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("mousedown", msg)
}

///|
pub fn Attrs::on_mouseup(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("mouseup", msg)
}

///|
pub fn Attrs::on_mousemove(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("mousemove", msg)
}

///|
pub fn Attrs::on_mouseenter(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("mouseenter", msg)
}

///|
pub fn Attrs::on_mouseover(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("mouseover", msg)
}

///|
pub fn Attrs::on_mouseleave(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("mouseleave", msg)
}

///|
pub fn Attrs::on_mouseout(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("mouseout", msg)
}

///|
/// Handle a primary or auxiliary pointer starting contact with the element.
///
/// `PointerEvent` extends the browser's mouse-event surface, so the callback
/// uses Rabbita's existing `MouseEvent` wrapper while preserving pointer-only
/// fields for JavaScript FFI helpers.
pub fn Attrs::on_pointerdown(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("pointerdown", msg)
}

///|
/// Handle movement from a captured mouse, pen, or touch pointer.
pub fn Attrs::on_pointermove(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("pointermove", msg)
}

///|
/// Handle the end of a mouse, pen, or touch pointer interaction.
pub fn Attrs::on_pointerup(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("pointerup", msg)
}

///|
/// Handle browser cancellation of an active pointer interaction.
pub fn Attrs::on_pointercancel(
  self : Attrs,
  msg : (MouseEvent) -> Cmd,
) -> Attrs {
  self.on_mouse_event("pointercancel", msg)
}

///|
pub fn Attrs::on_contextmenu(self : Attrs, msg : (MouseEvent) -> Cmd) -> Attrs {
  self.on_mouse_event("contextmenu", msg)
}

///|
#cfg(target="js")
pub fn Attrs::on_scroll(self : Attrs, msg : (UIEvent) -> Cmd) -> Attrs {
  self.handler("scroll", (event, scheduler) => {
    // ★ moobile 改造：入口处把后端无关的 `Event` 转成 `@dom.Event`。
    let event : @dom.Event = @vdom.as_dom_event(event)
    scheduler.add(msg(scroll_event_as_ui_event(event)))
  })
}

///|
#cfg(not(target="js"))
pub fn Attrs::on_scroll(self : Attrs, msg : (UIEvent) -> Cmd) -> Attrs {
  ignore(msg)
  self
}

///|
pub fn Attrs::on_wheel(self : Attrs, msg : (WheelEvent) -> Cmd) -> Attrs {
  self.on_wheel_event("wheel", msg)
}

///|
#cfg(target="js")
pub fn Attrs::on_beforeinput(self : Attrs, msg : (InputEvent) -> Cmd) -> Attrs {
  self.handler("beforeinput", (event, scheduler) => {
    scheduler.add(msg(((event_decoders.val).input_event)(event)))
  })
}

///|
#cfg(not(target="js"))
pub fn Attrs::on_beforeinput(self : Attrs, msg : (InputEvent) -> Cmd) -> Attrs {
  ignore(msg)
  self
}

///|
#cfg(target="js")
pub fn Attrs::on_input(self : Attrs, msg : (InputEvent) -> Cmd) -> Attrs {
  self.handler("input", (event, scheduler) => {
    scheduler.add(msg(((event_decoders.val).input_event)(event)))
  })
}

///|
#cfg(not(target="js"))
pub fn Attrs::on_input(self : Attrs, msg : (InputEvent) -> Cmd) -> Attrs {
  ignore(msg)
  self
}

///|
#cfg(target="js")
pub fn Attrs::on_change(self : Attrs, msg : (InputEvent) -> Cmd) -> Attrs {
  self.handler("change", (event, scheduler) => {
    scheduler.add(msg(((event_decoders.val).input_event)(event)))
  })
}

///|
#cfg(not(target="js"))
pub fn Attrs::on_change(self : Attrs, msg : (InputEvent) -> Cmd) -> Attrs {
  ignore(msg)
  self
}

///|
pub fn Attrs::on_focus(self : Attrs, msg : (FocusEvent) -> Cmd) -> Attrs {
  self.on_focus_event("focus", msg)
}

///|
pub fn Attrs::on_blur(self : Attrs, msg : (FocusEvent) -> Cmd) -> Attrs {
  self.on_focus_event("blur", msg)
}

///|
pub fn Attrs::on_keydown(self : Attrs, msg : (KeyboardEvent) -> Cmd) -> Attrs {
  self.on_keyboard_event("keydown", msg)
}

///|
pub fn Attrs::on_keyup(self : Attrs, msg : (KeyboardEvent) -> Cmd) -> Attrs {
  self.on_keyboard_event("keyup", msg)
}

///|
pub fn Attrs::on_submit(self : Attrs, msg : (DomEvent) -> Cmd) -> Attrs {
  self.handler("submit", (event, scheduler) => scheduler.add(msg(((event_decoders.val).dom_event)(event))))
}

///|
pub fn Attrs::on_reset(self : Attrs, msg : (DomEvent) -> Cmd) -> Attrs {
  self.handler("reset", (event, scheduler) => scheduler.add(msg(((event_decoders.val).dom_event)(event))))
}

///|
pub fn Attrs::on_dragstart(self : Attrs, msg : (DragEvent) -> Cmd) -> Attrs {
  self.on_drag_event("dragstart", msg)
}

///|
pub fn Attrs::on_dragover(self : Attrs, msg : (DragEvent) -> Cmd) -> Attrs {
  self.on_drag_event("dragover", msg)
}

///|
pub fn Attrs::on_dragenter(self : Attrs, msg : (DragEvent) -> Cmd) -> Attrs {
  self.on_drag_event("dragenter", msg)
}

///|
pub fn Attrs::on_dragleave(self : Attrs, msg : (DragEvent) -> Cmd) -> Attrs {
  self.on_drag_event("dragleave", msg)
}

///|
pub fn Attrs::on_dragend(self : Attrs, msg : (DragEvent) -> Cmd) -> Attrs {
  self.on_drag_event("dragend", msg)
}

///|
pub fn Attrs::on_drop(self : Attrs, msg : (DragEvent) -> Cmd) -> Attrs {
  self.on_drag_event("drop", msg)
}

///|
pub fn Attrs::on_copy(self : Attrs, msg : (ClipboardEvent) -> Cmd) -> Attrs {
  self.on_clipboard_event("copy", msg)
}

///|
pub fn Attrs::on_cut(self : Attrs, msg : (ClipboardEvent) -> Cmd) -> Attrs {
  self.on_clipboard_event("cut", msg)
}

///|
pub fn Attrs::on_paste(self : Attrs, msg : (ClipboardEvent) -> Cmd) -> Attrs {
  self.on_clipboard_event("paste", msg)
}

///|
pub fn Attrs::on_compositionstart(
  self : Attrs,
  msg : (CompositionEvent) -> Cmd,
) -> Attrs {
  self.on_composition_event("compositionstart", msg)
}

///|
pub fn Attrs::on_compositionupdate(
  self : Attrs,
  msg : (CompositionEvent) -> Cmd,
) -> Attrs {
  self.on_composition_event("compositionupdate", msg)
}

///|
pub fn Attrs::on_compositionend(
  self : Attrs,
  msg : (CompositionEvent) -> Cmd,
) -> Attrs {
  self.on_composition_event("compositionend", msg)
}
