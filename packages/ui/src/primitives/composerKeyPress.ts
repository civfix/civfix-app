/**
 * composerKeyPress - shared "Enter sends, Shift+Enter newlines" key handling for the chat + report-comment
 * composers on web.
 *
 * Why `onKeyPress` and not `onKeyDown`: react-native-web's TextInput OVERWRITES any caller `onKeyDown` with
 * its own internal handler (`supportedProps.onKeyDown = handleKeyDown`), so an `onKeyDown` prop is dead code
 * and never fires - which is why plain Enter only inserted a newline. rn-web DOES invoke `onKeyPress`,
 * passing the underlying DOM keydown event (richer than RN's `TextInputKeyPressEventData`: it carries
 * top-level `key`/`shiftKey`, a native `isComposing` flag, and `preventDefault`). We type composer handlers
 * with RN's event type so the prop type matches, and read that richer web event through `WebKeyPress`.
 */
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from "react-native"

/** The web (rn-web) view of the keydown event rn-web hands to `onKeyPress`. */
interface WebKeyPress {
  key?: string
  shiftKey?: boolean
  nativeEvent?: { isComposing?: boolean }
  preventDefault?: () => void
}

/**
 * True when a composer should SEND on this key event: a plain Enter (no Shift) that is not an active IME
 * composition (e.g. committing a CJK candidate). When it returns true it has already called preventDefault,
 * so no newline is inserted AND rn-web's own Enter handling is skipped. Returns false for Shift+Enter, an
 * IME composition, or any other key - those fall through to the native newline/commit. WEB ONLY: callers
 * gate the handler behind `Platform.OS === "web"` (native keeps its default multiline return behavior).
 */
export function isComposerSendKey(e: NativeSyntheticEvent<TextInputKeyPressEventData>): boolean {
  const we = e as unknown as WebKeyPress
  if (we.key !== "Enter" || we.shiftKey) return false
  if (we.nativeEvent?.isComposing) return false
  we.preventDefault?.()
  return true
}

/**
 * True when a composer should CANCEL its active mode (inline edit / reply) on this key event: a plain
 * Escape that is not an active IME composition (Escape also dismisses IME candidate windows - that
 * dismissal must not eat the edit). Calls preventDefault when it returns true, mirroring
 * `isComposerSendKey`. WEB ONLY, same gating as above; callers only consult this while a composer mode
 * is active (a bare composer has nothing to cancel).
 */
export function isComposerCancelKey(e: NativeSyntheticEvent<TextInputKeyPressEventData>): boolean {
  const we = e as unknown as WebKeyPress
  if (we.key !== "Escape") return false
  if (we.nativeEvent?.isComposing) return false
  we.preventDefault?.()
  return true
}
