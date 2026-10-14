/**
 * Types shared by the KeyboardAwareScroll seams, plus the one trivial helper both need to read a flag
 * that may be a thunk.
 */

/**
 * `makeKeyboardAwareScrollHost` builds a fresh component per call, so two hosts differing only in these
 * flags are different element types, and swapping them remounts the whole scroll subtree (scroll position
 * and child state lost). A surface whose answer changes at runtime passes a thunk and keeps one host.
 *
 * A thunk is read at keyboard-transition time on native and at render time on web, so it must be cheap
 * and must not close over per-render state: read a store with `getState()` instead.
 */
export type KeyboardAwareScrollHostFlag = boolean | (() => boolean)

export interface KeyboardAwareScrollHostOptions {
  /** Native: the keyboard opened with a field here focused. Web: a field here gained focus. */
  onKeyboardShow?: () => void
  /**
   * False for a host whose keyboard-raising field sits outside its scroller (the docked search field, the
   * reply composer); otherwise the host scrolls its own unrelated content up and leaves it scrolled.
   */
  ownsFocusedInput?: KeyboardAwareScrollHostFlag
  /**
   * False when an ancestor already reserves the overlap (SearchBodyReveal's overlay layer); otherwise the
   * surface is double-inset and the content box collapses to a sliver.
   */
  reserveKeyboardPadding?: KeyboardAwareScrollHostFlag
}

export function resolveHostFlag(
  flag: KeyboardAwareScrollHostFlag | undefined,
  fallback: boolean = true,
): () => boolean {
  if (flag === undefined) return () => fallback
  if (typeof flag === "function") return flag
  return () => flag
}
