///|
using @cmd {type Cmd, type Emit}

///|
using @sub {type Sub}

///|
struct Store {
  /// (Msg) -> Cmd
  on_update : (&Scheduler, @any.Any) -> Cmd
}

///|
fn diff_subs(
  old_subs : Map[String, @sub.RunningSub],
  new_subs : Map[String, (Error, @sub.SubLoader)],
  scheduler : &@cmd.Scheduler,
) -> Map[String, @sub.RunningSub] {
  let sub_map : Map[String, @sub.RunningSub] = Map([])
  for key, sub in old_subs {
    match new_subs.get(key) {
      None => (sub.unload)(scheduler)
      Some((new_payload, _)) => {
        (sub.update_tagger)(new_payload)
        sub_map[key] = sub
      }
    }
  }
  for key, sub in new_subs {
    let (payload, loader) = sub
    if !old_subs.contains(key) && loader(payload, scheduler) is Some(running) {
      sub_map[key] = running
    }
  }
  sub_map
}

///|
fn cleanup_store(
  stores : @slotmap.SlotMap[Store],
  id : @slotmap.Id,
  sub_map : Map[String, @sub.RunningSub],
  scheduler : &@cmd.Scheduler,
) -> Unit {
  stores.free(id)
  for _, sub in sub_map {
    (sub.unload)(scheduler)
  }
}

///|
pub fn[Model : Eq, Msg] create_state_machine(
  initialize : (Emit[Msg]) -> (Model, Cmd),
  update : (Model, Msg, Emit[Msg]) -> (Model, Cmd),
  subscriptions? : (Model, Emit[Msg]) -> Sub,
) -> (@duplix.Node[Model], Emit[Msg]) {
  let host = ambient_host.val
  let stores = Host::get_stores(host)
  let id = stores.allocate()
  let emit = msg => op.request(Message(id, @any.erase(msg)))
  let mut sub_map : Map[String, @sub.RunningSub] = Map([])

  fn handle_subs(scheduler : &Scheduler, model : Model) {
    if subscriptions is Some(subscriptions) {
      let new_subs = subscriptions(model, emit).to_map(
        @key.key,
        filter_global=false,
      )
      sub_map = diff_subs(sub_map, new_subs, scheduler)
    }
  }

  let (model, set_model) : (@duplix.Node[Model?], _) = @duplix.input(None)

  let (model_value, init_cmd) = initialize(emit)
  set_model(Some(model_value))

  fn on_update(scheduler : &Scheduler, msg : @any.Any) -> Cmd {
    let msg : Msg = msg.into()
    let old_model = model.read()
    let (new_model, cmd) = update(old_model.unwrap(), msg, emit)
    handle_subs(scheduler, new_model)
    set_model(Some(new_model))
    cmd
  }

  stores[id] = { on_update, }
  @duplix.on_cleanup(() => cleanup_store(stores, id, sub_map, host))

  Scheduler::add(host, init_cmd)
  handle_subs(host, model.read().unwrap())
  (model.map(x => x.unwrap()), emit)
}

///|
pub fn[Model : Eq, Msg, Input : Eq] create_state_machine_with_input(
  initialize : (Emit[Msg], Input) -> (Model, Cmd),
  update : (Model, Input, Msg, Emit[Msg]) -> (Model, Cmd),
  subscriptions? : (Model, Input, Emit[Msg]) -> Sub,
  input : @duplix.Node[Input],
) -> (@duplix.Node[Model], Emit[Msg]) {
  let host = ambient_host.val
  let stores = Host::get_stores(host)
  let id = stores.allocate()
  let emit = (msg : Msg) => op.request(Message(id, @any.erase(msg)))
  let mut sub_map : Map[String, @sub.RunningSub] = Map([])

  fn handle_subs(scheduler : &Scheduler, model : Model) {
    if subscriptions is Some(subscriptions) {
      let input = input.read()
      let new_subs = subscriptions(model, input, emit).to_map(
        @key.key,
        filter_global=false,
      )
      sub_map = diff_subs(sub_map, new_subs, scheduler)
    }
  }

  let (model, set_model) : (@duplix.Node[Model?], _) = @duplix.input(None)

  let (model_value, init_cmd) = initialize(emit, input.read())
  set_model(Some(model_value))

  fn on_update(scheduler : &Scheduler, msg : @any.Any) -> Cmd {
    let msg : Msg = msg.into()
    let old_model = model.read()
    let input_val = input.read()
    let (new_model, cmd) = update(old_model.unwrap(), input_val, msg, emit)
    handle_subs(scheduler, new_model)
    set_model(Some(new_model))
    cmd
  }

  stores[id] = { on_update, }
  @duplix.on_cleanup(() => cleanup_store(stores, id, sub_map, host))

  Scheduler::add(host, init_cmd)
  handle_subs(host, model.read().unwrap())
  (model.map(x => x.unwrap()), emit)
}
