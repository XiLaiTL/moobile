///|
/// Message emitter type used by a state machine.
///
/// Calling `emit(msg)` returns a `Cmd` that enqueues `msg` into the state
/// machine's update loop.
pub type Emit[Msg] = @cmd.Emit[Msg]
