///|
/// https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList
#cfg(target="js")
#external
type MediaQueryList

///|
#cfg(target="js")
pub impl IsEventTarget for MediaQueryList

///|
#cfg(target="js")
pub impl @js.Cast for MediaQueryList with fn into(value) {
  value |> ffi_to_media_query_list |> list => { list.to_option() }
}

///|
#cfg(target="js")
pub impl @js.Cast for MediaQueryList with fn from(value) {
  value |> js_identity
}

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
#cfg(target="js")
pub extern "js" fn Window::match_media(
  self : Self,
  query : String,
) -> MediaQueryList = "(self, query) => self.matchMedia(query)"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/matches
#cfg(target="js")
pub extern "js" fn MediaQueryList::get_matches(self : Self) -> Bool = "(self) => self.matches"

///|
#cfg(target="js")
extern "js" fn ffi_to_media_query_list(
  value : @js.Value,
) -> @js.Nullable[MediaQueryList] =
  #| (value) => typeof MediaQueryList !== "undefined"
  #|   && value instanceof MediaQueryList
  #|   ? value
  #|   : null
