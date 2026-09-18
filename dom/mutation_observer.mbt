///|
/// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
#cfg(target="js")
#external
type MutationObserver

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/MutationRecord
#cfg(target="js")
#external
type MutationRecord

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/MutationObserver
#cfg(target="js")
pub extern "js" fn MutationObserver::new(
  callback : (Array[MutationRecord], MutationObserver) -> Unit,
) -> Self = "(callback) => new MutationObserver(callback)"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe
#cfg(target="js")
pub fn MutationObserver::observe(
  self : Self,
  target : Node,
  child_list? : Bool,
  attributes? : Bool,
  character_data? : Bool,
  subtree? : Bool,
  attribute_old_value? : Bool,
  character_data_old_value? : Bool,
  attribute_filter? : Array[String],
) -> Unit {
  ffi_mutation_observer_observe(
    self,
    target,
    @js.Optional::from_option(child_list),
    @js.Optional::from_option(attributes),
    @js.Optional::from_option(character_data),
    @js.Optional::from_option(subtree),
    @js.Optional::from_option(attribute_old_value),
    @js.Optional::from_option(character_data_old_value),
    @js.Optional::from_option(attribute_filter),
  )
}

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect
#cfg(target="js")
pub extern "js" fn MutationObserver::disconnect(self : Self) -> Unit = "(self) => self.disconnect()"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/MutationRecord/attributeName
#cfg(target="js")
pub fn MutationRecord::get_attribute_name(self : Self) -> String? {
  ffi_mutation_record_get_attribute_name(self).to_option()
}

///|
#cfg(target="js")
extern "js" fn ffi_mutation_observer_observe(
  observer : MutationObserver,
  target : Node,
  child_list : @js.Optional[Bool],
  attributes : @js.Optional[Bool],
  character_data : @js.Optional[Bool],
  subtree : @js.Optional[Bool],
  attribute_old_value : @js.Optional[Bool],
  character_data_old_value : @js.Optional[Bool],
  attribute_filter : @js.Optional[Array[String]],
) -> Unit =
  #| (self, target, childList, attributes, characterData, subtree, attributeOldValue, characterDataOldValue, attributeFilter) => {
  #|   const options = {}
  #|   if (childList !== undefined) options.childList = childList
  #|   if (attributes !== undefined) options.attributes = attributes
  #|   if (characterData !== undefined) options.characterData = characterData
  #|   if (subtree !== undefined) options.subtree = subtree
  #|   if (attributeOldValue !== undefined) options.attributeOldValue = attributeOldValue
  #|   if (characterDataOldValue !== undefined) options.characterDataOldValue = characterDataOldValue
  #|   if (attributeFilter !== undefined) options.attributeFilter = attributeFilter
  #|   self.observe(target, options)
  #| }

///|
#cfg(target="js")
extern "js" fn ffi_mutation_record_get_attribute_name(
  record : MutationRecord,
) -> @js.Nullable[String] = "(self) => self.attributeName"
