///|
fn assert_dialog_attr(
  html : @html.Html,
  name : String,
  expected : String,
) -> Unit raise {
  match html.to_virtual_dom() {
    Elem("dialog", props, _, namespace_uri=None) =>
      match props.attrs.get(name) {
        Some(actual) if actual == expected => ()
        Some(actual) => fail("expected \{name}=\{expected}, got \{actual}")
        None => fail("expected \{name}=\{expected}")
      }
    _ => fail("expected dialog element")
  }
}

///|
test "dialog closedby argument emits attribute" {
  assert_dialog_attr(
    @html.dialog(closedby="any", @html.nothing),
    "closedby",
    "any",
  )
}

///|
test "dialog accepts closedby through attrs builder" {
  assert_dialog_attr(
    @html.dialog(
      attrs=@html.Attrs::build().closedby("closerequest"),
      @html.nothing,
    ),
    "closedby",
    "closerequest",
  )
}
