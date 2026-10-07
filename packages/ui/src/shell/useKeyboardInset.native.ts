/**
 * Always 0: on native the full-screen ConversationBody owns a KeyboardAvoidingView, so the web-only
 * visual-viewport inset must be a no-op. New surfaces use `useKeyboardAnchor` instead.
 */
export function useKeyboardInset(): number {
  return 0
}
