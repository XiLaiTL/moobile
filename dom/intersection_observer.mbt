///|
/// https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver
#cfg(target="js")
#external
type IntersectionObserver

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserverEntry
#cfg(target="js")
#external
type IntersectionObserverEntry

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/IntersectionObserver
#cfg(target="js")
pub fn IntersectionObserver::new(
  callback : (Array[IntersectionObserverEntry], IntersectionObserver) -> Unit,
  threshold? : Array[Double],
) -> Self {
  if threshold is Some(threshold) {
    ffi_intersection_observer_new_with_threshold(callback, threshold)
  } else {
    ffi_intersection_observer_new(callback)
  }
}

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/observe
#cfg(target="js")
pub extern "js" fn IntersectionObserver::observe(
  self : Self,
  target : Element,
) -> Unit = "(self, target) => self.observe(target)"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/unobserve
#cfg(target="js")
pub extern "js" fn IntersectionObserver::unobserve(
  self : Self,
  target : Element,
) -> Unit = "(self, target) => self.unobserve(target)"

///|
/// https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/disconnect
#cfg(target="js")
pub extern "js" fn IntersectionObserver::disconnect(self : Self) -> Unit = "(self) => self.disconnect()"

///|
#cfg(target="js")
extern "js" fn ffi_intersection_observer_new(
  callback : (Array[IntersectionObserverEntry], IntersectionObserver) -> Unit,
) -> IntersectionObserver = "(callback) => new IntersectionObserver(callback)"

///|
#cfg(target="js")
extern "js" fn ffi_intersection_observer_new_with_threshold(
  callback : (Array[IntersectionObserverEntry], IntersectionObserver) -> Unit,
  threshold : Array[Double],
) -> IntersectionObserver = "(callback, threshold) => new IntersectionObserver(callback, { threshold })"
