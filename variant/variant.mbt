///|
pub(all) enum Variant {
  Boolean(Bool)
  Integer(Int)
  Floating(Double)
  String(String)
} derive(Debug, Eq, Compare, Hash)

///|
pub impl Show for Variant with fn output(self, buf) {
  Show::output(self.to_repr(), buf)
}
