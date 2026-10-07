/**
 * `onKeyPress`, not `onKeyDown`: react-native-web's TextInput overwrites any caller `onKeyDown` with its own
 * handler, so that prop never fires. rn-web does invoke `onKeyPress` with the DOM keydown event, which
 * carries `key`, `shiftKey`, `isComposing` and `preventDefault`; `WebKeyPress` reads that richer event
 * through RN's prop type. Both checks are web only.
 */
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from "react-native"

interface WebKeyPress {
  key?: string
  shiftKey?: boolean
  nativeEvent?: { isComposing?: boolean }
  preventDefault?: () => void
}

/** An Enter that commits an IME candidate (e.g. CJK) must not send. */
export function isComposerSendKey(e: NativeSyntheticEvent<TextInputKeyPressEventData>): boolean {
  const we = e as unknown as WebKeyPress
  if (we.key !== "Enter" || we.shiftKey) return false
  if (we.nativeEvent?.isComposing) return false
  we.preventDefault?.()
  return true
}

/** Escape also dismisses IME candidate windows, and that dismissal must not cancel the edit. */
export function isComposerCancelKey(e: NativeSyntheticEvent<TextInputKeyPressEventData>): boolean {
  const we = e as unknown as WebKeyPress
  if (we.key !== "Escape") return false
  if (we.nativeEvent?.isComposing) return false
  we.preventDefault?.()
  return true
}
