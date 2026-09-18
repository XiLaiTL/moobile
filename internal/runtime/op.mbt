///|
extenum @cmd.Extension += {
  Message(@slotmap.Id, @any.Any)
}

///|
let op : @cmd.Op = Op()

///|
fn handle_message(host : &Host, extension : @cmd.Extension) -> Bool {
  match extension {
    Message(id, erased_msg) => {
      if Host::get_stores(host).get(id) is Some(store) {
        let cmd = (store.on_update)(host, erased_msg)
        Scheduler::queue_command(host, cmd)
      }
      true
    }
    _ => false
  }
}
