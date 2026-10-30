/**
 * `onKeyPress`, not `onKeyDown`: react-native-web's TextInput overwrites any caller `onKeyDown` with its own
 * handler, so that prop never fires. rn-web does invoke `onKeyPress` with the DOM keydown event, which
 * carries `key`, `shiftKey`, `isComposing` and `preventDefault`; `readWebKeyPress` reads that richer event
 * through RN's prop type. Both checks are web only.
 */
import type { TextInputKeyPressEvent } from "react-native"

export interface WebKeyPress {
  key: string | undefined
  shiftKey: boolean
  isComposing: boolean
}

/** The DOM keydown fields rn-web's `onKeyPress` event carries beyond RN's prop type; absent on native. */
export function readWebKeyPress(e: TextInputKeyPressEvent): WebKeyPress {
  const native: unknown = e.nativeEvent
  return {
    key: "key" in e && typeof e.key === "string" ? e.key : undefined,
    shiftKey: "shiftKey" in e && e.shiftKey === true,
    isComposing:
      typeof native === "object" && native !== null && "isComposing" in native && native.isComposing === true,
  }
}

function preventDefault(e: TextInputKeyPressEvent): void {
  if (typeof e.preventDefault === "function") e.preventDefault()
}

/** An Enter that commits an IME candidate (e.g. CJK) must not send. */
export function isComposerSendKey(e: TextInputKeyPressEvent): boolean {
  const we = readWebKeyPress(e)
  if (we.key !== "Enter" || we.shiftKey) return false
  if (we.isComposing) return false
  preventDefault(e)
  return true
}

/** Escape also dismisses IME candidate windows, and that dismissal must not cancel the edit. */
export function isComposerCancelKey(e: TextInputKeyPressEvent): boolean {
  const we = readWebKeyPress(e)
  if (we.key !== "Escape") return false
  if (we.isComposing) return false
  preventDefault(e)
  return true
}
