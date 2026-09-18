///|
#alias(Dispatch, deprecated="Use Emit[Msg] instead.")
pub(all) struct Emit[Msg]((Msg) -> Cmd)

///|
pub fn[A, B] Emit::map(self : Self[A], f : (B) -> A) -> Self[B] {
  b => self(f(b))
}

// ///|
// /// internal use only
// #doc(hidden)
// pub fn[Msg] make_emitter(id : @slotmap.Id) -> Emit[Msg] {
//   // carry the drain (which own model and update) in message will cause memory leak in RC
//   msg => Message(id, @any.erase(msg))
// }

///|
/// internal use only
#doc(hidden)
pub fn[Msg] make_legacy_emitter(f : (&Scheduler, Msg) -> Unit) -> Emit[Msg] {
  msg => op.request(LegacyMessage(x => f(x, msg)))
}
