///|
#cfg(target="js")
enum CleanupBranch {
  Active
  Inactive
} derive(Eq)

///|
#cfg(target="js")
impl @common.Enumerate for CleanupBranch with fn tag(self) {
  match self {
    Active => "active"
    Inactive => "inactive"
  }
}

///|
#cfg(target="js")
suberror CleanupPayload {
  CleanupPayload(String)
}

///|
#cfg(target="js")
suberror TaggerRefreshPayload {
  TaggerRefreshPayload(() -> Unit)
}

///|
#cfg(target="js")
#external
type SubscriptionTestHarness

///|
#cfg(target="js")
extern "js" fn SubscriptionTestHarness::fire_interval(self : Self) -> Unit = "harness => harness.fireInterval()"

///|
#cfg(target="js")
extern "js" fn SubscriptionTestHarness::fire_resize(self : Self) -> Unit = "harness => harness.fireResize()"

///|
#cfg(target="js")
extern "js" fn SubscriptionTestHarness::interval_installs(self : Self) -> Int = "harness => harness.intervalInstalls()"

///|
#cfg(target="js")
extern "js" fn SubscriptionTestHarness::interval_clears(self : Self) -> Int = "harness => harness.intervalClears()"

///|
#cfg(target="js")
extern "js" fn SubscriptionTestHarness::resize_installs(self : Self) -> Int = "harness => harness.resizeInstalls()"

///|
#cfg(target="js")
extern "js" fn SubscriptionTestHarness::resize_removals(self : Self) -> Int = "harness => harness.resizeRemovals()"

///|
#cfg(target="js")
extern "js" fn with_subscription_test_window(
  run : (SubscriptionTestHarness) -> Unit raise,
) -> Unit raise =
  #| run => {
  #|   const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window")
  #|   const previousWindow = globalThis.window
  #|   let intervalCallback
  #|   let resizeListener
  #|   let intervalInstalls = 0
  #|   let intervalClears = 0
  #|   let resizeInstalls = 0
  #|   let resizeRemovals = 0
  #|   globalThis.window = {
  #|     innerWidth: 800,
  #|     innerHeight: 600,
  #|     setInterval(callback) {
  #|       intervalCallback = callback
  #|       intervalInstalls += 1
  #|       return 17
  #|     },
  #|     clearInterval(id) {
  #|       if (id !== 17) throw new Error(`unexpected interval id: ${id}`)
  #|       intervalClears += 1
  #|     },
  #|     queueMicrotask(callback) {
  #|       callback()
  #|     },
  #|     addEventListener(type, listener) {
  #|       if (type !== "resize") throw new Error(`unexpected event type: ${type}`)
  #|       resizeListener = listener
  #|       resizeInstalls += 1
  #|     },
  #|     removeEventListener(type, listener) {
  #|       if (type !== "resize" || listener !== resizeListener) {
  #|         throw new Error(`unexpected event removal: ${type}`)
  #|       }
  #|       resizeRemovals += 1
  #|     },
  #|   }
  #|   try {
  #|     return run({
  #|       fireInterval() {
  #|         if (!intervalCallback) throw new Error("interval was not installed")
  #|         intervalCallback()
  #|       },
  #|       fireResize() {
  #|         if (!resizeListener) throw new Error("resize listener was not installed")
  #|         resizeListener({})
  #|       },
  #|       intervalInstalls: () => intervalInstalls,
  #|       intervalClears: () => intervalClears,
  #|       resizeInstalls: () => resizeInstalls,
  #|       resizeRemovals: () => resizeRemovals,
  #|     })
  #|   } finally {
  #|     if (hadWindow) globalThis.window = previousWindow
  #|     else delete globalThis.window
  #|   }
  #| }

///|
#cfg(target="js")
fn cleanup_test_sub(on_unload : () -> Unit) -> @sub.Sub {
  @sub.custom_sub(
    "cleanup-test",
    Local,
    CleanupPayload("cleanup-test"),
    SubLoader((_, _) => {
      Some({ unload: _ => on_unload(), update_tagger: _ => () })
    }),
  )
}

///|
#cfg(target="js")
struct StoreTestHost {
  task_queue : Queue[(@cmd.Op, @cmd.Extension)]
  stores : @slotmap.SlotMap[Store]
  mut draining : Bool
  mut async_tasks : Int
  mut unhandled_tasks : Int
}

///|
#cfg(target="js")
fn StoreTestHost::new() -> StoreTestHost {
  {
    task_queue: Queue([]),
    stores: SlotMap(),
    draining: false,
    async_tasks: 0,
    unhandled_tasks: 0,
  }
}

///|
#cfg(target="js")
fn StoreTestHost::drain(self : Self) -> Unit {
  guard !self.draining else { return }
  self.draining = true
  while self.task_queue.pop() is Some((op, extension)) {
    if handle_message(self, extension) {
      continue
    }
    try @cmd.invoke(@key.key, op, extension, self) catch {
      Unhandled => self.unhandled_tasks += 1
    } noraise {
      None => ()
      Ready(cmd) => @cmd.Scheduler::queue_command(self, cmd)
      Async(_) => self.async_tasks += 1
      AfterLayout(f) => @cmd.Scheduler::queue_command(self, f())
      LegacyEffect(_, f) => f(self)
    }
  }
  self.draining = false
}

///|
#cfg(target="js")
impl @cmd.Context for StoreTestHost with fn get_origin(_self) {
  "http://localhost"
}

///|
#cfg(target="js")
impl @cmd.Context for StoreTestHost with fn inject_url_changed(_self, _url) {
  @cmd.none
}

///|
#cfg(target="js")
impl @cmd.Context for StoreTestHost with fn inject_url_request(_self, _url) {
  @cmd.none
}

///|
#cfg(target="js")
impl @cmd.Scheduler for StoreTestHost with fn queue_command(self, cmd) {
  for task in @cmd.flatten(@key.key, cmd) {
    self.task_queue.push(task)
  }
  self.drain()
}

///|
#cfg(target="js")
impl @cmd.Scheduler for StoreTestHost with fn set_url_changed_injector(
  _self,
  _injector,
) {
  ignore((_self, _injector))
}

///|
#cfg(target="js")
impl @cmd.Scheduler for StoreTestHost with fn set_url_request_injector(
  _self,
  _injector,
) {
  ignore((_self, _injector))
}

///|
#cfg(target="js")
impl Host for StoreTestHost with fn flush(_self) {
  ignore(_self)
}

///|
#cfg(target="js")
impl Host for StoreTestHost with fn cleanup(_self) {
  ignore(_self)
}

///|
#cfg(target="js")
impl Host for StoreTestHost with fn get_stores(self) {
  self.stores
}

///|
#cfg(target="js")
fn with_store_test_host(run : (StoreTestHost) -> Unit raise) -> Unit raise {
  let host = StoreTestHost::new()
  ambient_host.protect(host, () => run(host))
  if host.async_tasks != 0 {
    fail("store test unexpectedly scheduled an async task")
  }
  if host.unhandled_tasks != 0 {
    fail("store test encountered an unhandled command")
  }
}

///|
#cfg(target="js")
fn exercise_subscription_across_model_update(
  subscription : (Bool) -> @sub.Sub,
  fire : () -> Unit,
) -> Unit raise {
  with_store_test_host(host => {
    let mut update_model = () => ()
    let (branch, set_branch) = @duplix.input(CleanupBranch::Active)
    let state = branch.switch(branch => {
      match branch {
        Active => {
          let (model, emit) : (@duplix.Node[Bool], @cmd.Emit[Unit]) = create_state_machine(
            _ => (false, @cmd.none),
            (_, _, _) => (true, @cmd.none),
            subscriptions=(model, _) => subscription(model),
          )
          update_model = () => @cmd.Scheduler::add(host, emit(()))
          model
        }
        Inactive => @duplix.constant(false)
      }
    })

    // Install the subscription and observe its callback under the initial model.
    ignore(state.read())
    fire()
    // Retain the resource across a model update, then observe the refreshed callback.
    update_model()
    fire()
    // Dispose the component scope so the retained resource is unloaded.
    set_branch(Inactive)
    ignore(state.read())
  })
}

///|
#cfg(target="js")
test "state machine unloads subscriptions when its component scope is disposed" {
  with_store_test_host(_ => {
    let mut unloads = 0
    let subscription = cleanup_test_sub(() => unloads += 1)
    let (branch, set_branch) = @duplix.input(CleanupBranch::Active)
    let state = branch.switch(branch => {
      match branch {
        Active => {
          let (model, _) : (@duplix.Node[Int], @cmd.Emit[Unit]) = create_state_machine(
            _ => (0, @cmd.none),
            (model, _, _) => (model, @cmd.none),
            subscriptions=(_, _) => subscription,
          )
          model
        }
        Inactive => @duplix.constant(0)
      }
    })

    inspect(state.read(), content="0")
    inspect(unloads, content="0")
    set_branch(Inactive)
    inspect(state.read(), content="0")
    inspect(unloads, content="1")
  })
}

///|
#cfg(target="js")
test "state machine with input unloads subscriptions when disposed" {
  with_store_test_host(_ => {
    let mut unloads = 0
    let subscription = cleanup_test_sub(() => unloads += 1)
    let (input, _) = @duplix.input("input")
    let (branch, set_branch) = @duplix.input(CleanupBranch::Active)
    let state = branch.switch(branch => {
      match branch {
        Active => {
          let (model, _) : (@duplix.Node[Int], @cmd.Emit[Unit]) = create_state_machine_with_input(
            (_, _) => (0, @cmd.none),
            (model, _, _, _) => (model, @cmd.none),
            subscriptions=(_, _, _) => subscription,
            input,
          )
          model
        }
        Inactive => @duplix.constant(0)
      }
    })

    inspect(state.read(), content="0")
    inspect(unloads, content="0")
    set_branch(Inactive)
    inspect(state.read(), content="0")
    inspect(unloads, content="1")
  })
}

///|
#cfg(target="js")
test "diff_subs refreshes a retained subscription without replacing it" {
  with_store_test_host(host => {
    let callbacks : Array[String] = []
    let mut unloads = 0
    let mut unexpected_loads = 0
    let mut current_tagger = () => callbacks.push("old")
    let running : @sub.RunningSub = {
      unload: _ => unloads += 1,
      update_tagger: payload => {
        guard payload is TaggerRefreshPayload(next_tagger) else { return }
        current_tagger = next_tagger
      },
    }
    let old_subs = { "tagger-refresh-test": running }
    let new_subs : Map[String, (Error, @sub.SubLoader)] = {
      "tagger-refresh-test": (
        TaggerRefreshPayload(() => callbacks.push("new")),
        SubLoader((_, _) => {
          unexpected_loads += 1
          None
        }),
      ),
    }

    current_tagger()
    let retained = diff_subs(old_subs, new_subs, host)
    current_tagger()
    assert_eq(callbacks, ["old", "new"])
    inspect(unexpected_loads, content="0")
    guard retained.get("tagger-refresh-test") is Some(retained_running) else {
      fail("expected the subscription with the matching key to be retained")
    }
    assert_true(physical_equal(running, retained_running))
    inspect(unloads, content="0")

    ignore(diff_subs(retained, Map([]), host))
    inspect(unloads, content="1")
  })
}

///|
#cfg(target="js")
test "retained every executes the latest command without replacing its timer" {
  with_subscription_test_window(harness => {
    let commands : Array[String] = []
    exercise_subscription_across_model_update(
      refreshed => {
        @sub.every(
          10,
          @cmd.custom_cmd(_ => {
            commands.push(if refreshed { "new" } else { "old" })
          }),
        )
      },
      () => harness.fire_interval(),
    )

    assert_eq(commands, ["old", "new"])
    inspect(harness.interval_installs(), content="1")
    inspect(harness.interval_clears(), content="1")
  })
}

///|
#cfg(target="js")
test "retained resize subscription invokes the latest callback without replacing its listener" {
  with_subscription_test_window(harness => {
    let callbacks : Array[String] = []
    exercise_subscription_across_model_update(
      refreshed => {
        @sub.on_resize(_ => {
          @cmd.custom_cmd(_ => {
            callbacks.push(if refreshed { "new" } else { "old" })
          })
        })
      },
      () => harness.fire_resize(),
    )

    assert_eq(callbacks, ["old", "new"])
    inspect(harness.resize_installs(), content="1")
    inspect(harness.resize_removals(), content="1")
  })
}
