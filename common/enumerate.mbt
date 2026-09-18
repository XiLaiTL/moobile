///|
/// Provides stable branch identities for incremental selection.
///
/// Values that represent the same logical branch must return the same tag;
/// distinct branches must return distinct tags.
pub(open) trait Enumerate {
  /// Returns the stable identity of this value's incremental branch.
  fn tag(Self) -> String
}
