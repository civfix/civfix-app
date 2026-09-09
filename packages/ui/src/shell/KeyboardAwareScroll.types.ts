/**
 * Shared (platform-agnostic) types for the KeyboardAwareScroll seam, so the `.native` and `.web` siblings
 * and the `.ts` default all reference one definition without importing across platform files. Plus the one
 * trivial runtime helper both siblings need to read a flag that may be a thunk — duplicating four lines
 * across the platform files would be worse than the file's name being a slight understatement.
 */

/**
 * A host flag that is either fixed for the life of the host, or resolved LAZILY on each keyboard
 * transition.
 *
 * WHY THE THUNK EXISTS: `makeKeyboardAwareScrollHost` builds a FRESH component per call, so two hosts that
 * differ only in these flags are two different element TYPES — and swapping between them at the same
 * position unmounts and remounts the whole scroll subtree (scroll position gone, every child's local state
 * reset). A surface whose answer changes at runtime (the portrait base surface, which must ignore the
 * DOCKED search field while Search rides over it) therefore passes a thunk and keeps ONE host.
 *
 * CONTRACT: read at keyboard-transition time on native and at render time on web, so it must be cheap and
 * must not close over per-render state — read a store with `getState()` instead.
 */
export type KeyboardAwareScrollHostFlag = boolean | (() => boolean)

/** Options that tune the keyboard-aware behavior for a particular host. */
export interface KeyboardAwareScrollHostOptions {
  /**
   * Called when the keyboard opens while a field inside this scroll host is focused (native) / when a field
   * gains focus (web). The CompactShell passes `() => setSnap(2)` so the home sheet grows to its tallest snap
   * (max room above the keyboard). Omitted by hosts with no snap concept (ExpandedShell).
   */
  onKeyboardShow?: () => void
  /**
   * Does the keyboard-raising input live INSIDE this scroller? Default **true**.
   *
   * WHY THIS IS AN EXPLICIT DECLARATION AND NOT A GEOMETRIC TEST: the reveal finds the focused field via
   * the GLOBAL `TextInput.State.currentlyFocusedInput()` (web: any `focusin` that bubbles to the scroll
   * node), with NO descendant test — and RN offers no cheap reliable ancestry check from a ScrollView ref
   * (`ReactNativeElement.measureLayout`'s `onFail` is annotated `/* currently unused *\/`, and
   * `ReadOnlyNode.contains` needs a host node the ref does not expose). A typed declaration is
   * deterministic where a geometric guess is not.
   *
   * Pass **false** from any host whose keyboard-raising field is OUTSIDE its scroller — the docked search
   * bar's TextInput (SearchBodyReveal / the portrait base surface during Search) and the reply thread's
   * composer, which is a sibling of the list. Without it the host scrolls its own unrelated content up and
   * leaves it scrolled after the keyboard closes.
   *
   * May be a THUNK when the answer changes at runtime — see {@link KeyboardAwareScrollHostFlag}.
   */
  ownsFocusedInput?: KeyboardAwareScrollHostFlag
  /**
   * Should this host add the keyboard overlap to its content's bottom padding? Default **true**.
   *
   * Pass **false** when an ANCESTOR already reserves that space (SearchBodyReveal's overlay layer adds
   * `searchBarStore.keyboardReserve` to its own paddingBottom) — otherwise the surface is double-inset and
   * the content box collapses to a sliver.
   *
   * May be a THUNK when the answer changes at runtime — see {@link KeyboardAwareScrollHostFlag}.
   */
  reserveKeyboardPadding?: KeyboardAwareScrollHostFlag
}

/**
 * Normalise a host flag into a getter both platform seams can call. `undefined` takes `fallback`; a
 * boolean is frozen; a thunk is passed through so it is evaluated at USE time.
 */
export function resolveHostFlag(
  flag: KeyboardAwareScrollHostFlag | undefined,
  fallback: boolean = true,
): () => boolean {
  if (flag === undefined) return () => fallback
  if (typeof flag === "function") return flag
  return () => flag
}
