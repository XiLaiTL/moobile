///|
#cfg(target="js")
test "pointer event helpers install generic runtime handlers" {
  let attrs = Attrs::build()
    .on_pointerdown(_ => @cmd.none)
    .on_pointerdown(_ => @cmd.none)
    .on_pointermove(_ => @cmd.none)
    .on_pointermove(_ => @cmd.none)
    .on_pointerup(_ => @cmd.none)
    .on_pointerup(_ => @cmd.none)
    .on_pointercancel(_ => @cmd.none)
    .on_pointercancel(_ => @cmd.none)
  assert_true(attrs.0.handlers.contains("pointerdown"))
  assert_true(attrs.0.handlers.contains("pointermove"))
  assert_true(attrs.0.handlers.contains("pointerup"))
  assert_true(attrs.0.handlers.contains("pointercancel"))
}

///|
#cfg(not(target="js"))
test "pointer event helpers remain SSR safe" {
  let attrs = Attrs::build()
    .on_pointerdown(_ => @cmd.none)
    .on_pointerdown(_ => @cmd.none)
    .on_pointermove(_ => @cmd.none)
    .on_pointermove(_ => @cmd.none)
    .on_pointerup(_ => @cmd.none)
    .on_pointerup(_ => @cmd.none)
    .on_pointercancel(_ => @cmd.none)
    .on_pointercancel(_ => @cmd.none)
  let html = div(attrs~, nothing)
  assert_true(html.to_virtual_dom() is Elem(_, _, _, namespace_uri=None))
}
