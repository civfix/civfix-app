/**
 * useKeyboardInset (web seam) - the px the soft keyboard overlaps the bottom of the layout viewport.
 *
 * THE PROBLEM this fixes: on mobile web the conversation renders inside the bottom-pinned CompactShell.web
 * sheet (`position:absolute; bottom:0`). When the on-screen keyboard opens, the browser shrinks the VISUAL
 * viewport but NOT the layout viewport, so a `bottom:0` element (the composer) stays put - under the
 * keyboard. RN's `Keyboard` events never fire on rn-web, so `useKeyboardVisible` can't see this; the only
 * reliable signal is the `window.visualViewport` API. We compute the overlap and the body lifts its
 * composer by exactly that much so the message box sits ON TOP of the keyboard (iMessage-style), matching
 * what the native KeyboardAvoidingView / gorhom sheet already do on the app.
 *
 *   overlap = window.innerHeight - visualViewport.height - visualViewport.offsetTop
 *
 * `innerHeight` is the (unchanging) layout-viewport height; `visualViewport.height` shrinks by the keyboard;
 * `offsetTop` accounts for the browser pinch/scroll-shifting the visual viewport up (e.g. iOS Safari nudging
 * a focused field into view), so a page the browser already scrolled needs less lift. Sub-pixel noise is
 * floored to 0 so a closed keyboard reports a clean zero (no 1px composer jitter on desktop).
 *
 * SUPERSEDED by `useKeyboardAnchor` (shell/useKeyboardAnchor.*), the canonical keyboard primitive: it
 * tracks the keyboard continuously on the UI thread on native, GATES on which surface owns the focused
 * input, and returns the resting-offset-corrected LIFT rather than the raw overlap. New surfaces MUST
 * use the anchor. This hook remains for the legacy consumers (ConversationBody, DeleteAccountModal,
 * ReportFlowBody, ModalCardSheet, PortraitShell.web) until each is migrated. This web seam is
 * additionally an INTERNAL DEPENDENCY of useKeyboardAnchor.web and must keep its exact
 * `overlap = innerHeight - vv.height - vv.offsetTop` semantics.
 */
import { useEffect, useState } from "react"

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null
    if (!vv) return
    const compute = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop
      setInset(overlap > 1 ? Math.round(overlap) : 0)
    }
    compute()
    vv.addEventListener("resize", compute)
    vv.addEventListener("scroll", compute)
    return () => {
      vv.removeEventListener("resize", compute)
      vv.removeEventListener("scroll", compute)
    }
  }, [])
  return inset
}
