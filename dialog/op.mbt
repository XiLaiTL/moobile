///|
extenum @cmd.Extension += {
  DialogShow(String, Bool)
  DialogClose(String, String?)
  DialogRequestClose(String, String?)
}

///|
let op : @cmd.Op = @cmd.Op()
  ..on_invoke(op_invoke)
  ..on_debug(extension => {
    match extension {
      DialogShow(id, modal) =>
        Repr::ctor("DialogShow", [(None, Repr(id)), (None, Repr(modal))])
      DialogClose(id, return_value) =>
        Repr::ctor("DialogClose", [(None, Repr(id)), (None, Repr(return_value))])
      DialogRequestClose(id, return_value) =>
        Repr::ctor("DialogRequestClose", [
          (None, Repr(id)),
          (None, Repr(return_value)),
        ])
      _ => raise Unhandled
    }
  })

///|
#cfg(target="js")
fn op_invoke(
  extension : @cmd.Extension,
  _context : &@cmd.Context,
) -> @cmd.OpCont[Cmd] raise @cmd.Unhandled {
  match extension {
    DialogShow(id, modal) =>
      AfterLayout(() => {
        let dialog = @dom.document()
          .get_element_by_id(id)
          .unwrap()
          .to_html_element()
          .unwrap()
          .to_html_dialog_element()
          .unwrap()
        if modal {
          dialog.show_modal()
        } else {
          dialog.show()
        }
        @cmd.none
      })
    DialogClose(id, return_value) =>
      AfterLayout(() => {
        if @dom.document().get_element_by_id(id).to_option() is Some(element) {
          let dialog = element
            .to_html_element()
            .unwrap()
            .to_html_dialog_element()
            .unwrap()
          dialog.close(return_value=@js.Optional::from_option(return_value))
        }
        @cmd.none
      })
    DialogRequestClose(id, return_value) =>
      AfterLayout(() => {
        let dialog = @dom.document()
          .get_element_by_id(id)
          .unwrap()
          .to_html_element()
          .unwrap()
          .to_html_dialog_element()
          .unwrap()
        dialog.request_close(
          return_value=@js.Optional::from_option(return_value),
        )
        @cmd.none
      })
    _ => raise Unhandled
  }
}

///|
#cfg(not(target="js"))
#warnings("-unused_error_type")
fn op_invoke(
  _ : @cmd.Extension,
  _context : &@cmd.Context,
) -> @cmd.OpCont[Cmd] raise @cmd.Unhandled {
  None
}
