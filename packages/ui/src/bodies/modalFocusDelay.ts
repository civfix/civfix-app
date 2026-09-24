/**
 * A native `focus()` issued while a Modal is presenting, re-laying out or tearing down can be swallowed, so
 * focus that follows a menu or modal step waits this long for the Modal to settle.
 */
export const MODAL_DISMISS_FOCUS_DELAY_MS = 50
