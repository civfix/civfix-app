/**
 * useKeyboardInset (native seam) - always 0.
 *
 * On native the on-screen keyboard is handled WITHOUT a bottom inset on the composer: the full-screen
 * ConversationBody owns a KeyboardAvoidingView (+ safe-area insets) and the in-sheet render rides the
 * gorhom sheet's keyboardBehavior="extend". So the web-only visual-viewport inset (see useKeyboardInset.web)
 * must be a no-op here - returning a constant 0 keeps the native composer layout byte-for-byte unchanged.
 *
 * It is a SIBLING seam of `useKeyboardVisible` (which the full-screen native path still uses): that hook
 * reports a boolean off RN's Keyboard events; this one reports the px the soft keyboard overlaps the
 * bottom of the layout viewport, which only the web (rn-web) path needs.
 *
 * SUPERSEDED by `useKeyboardAnchor` (shell/useKeyboardAnchor.*), the canonical keyboard primitive: it
 * tracks the keyboard continuously on the UI thread on native, GATES on which surface owns the focused
 * input, and returns the resting-offset-corrected LIFT rather than the raw overlap. New surfaces MUST
 * use the anchor. This hook remains for PortraitShell.web and useReplyDockInset; the web seam is
 * additionally an internal dependency of useKeyboardAnchor.web and must keep its exact
 * `overlap = innerHeight - vv.height - vv.offsetTop` semantics.
 */
export function useKeyboardInset(): number {
  return 0
}
