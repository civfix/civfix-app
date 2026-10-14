/**
 * The px the soft keyboard overlaps the bottom of the layout viewport. On mobile web the browser shrinks
 * the visual viewport but not the layout viewport, so a `bottom:0` composer stays under the keyboard, and
 * RN's `Keyboard` events never fire on react-native-web; `window.visualViewport` is the only reliable
 * signal.
 *
 *   overlap = window.innerHeight - visualViewport.height - visualViewport.offsetTop
 *
 * `offsetTop` accounts for the browser scrolling the visual viewport up (iOS Safari nudging a focused
 * field into view), and sub-pixel noise floors to 0 so a closed keyboard causes no 1px jitter.
 *
 * New surfaces use `useKeyboardAnchor`, which depends on this seam and needs these exact semantics.
 */
import { useSyncExternalStore } from "react"

// One visualViewport listener pair for the whole page: every KeyboardAwareScroll, the portrait shell and each
// keyboard anchor read the same overlap, so N subscribers cost one measurement per viewport event.
const listeners = new Set<() => void>()
let inset = 0
let detach: (() => void) | null = null

function measure(vv: VisualViewport): void {
  const overlap = window.innerHeight - vv.height - vv.offsetTop
  const next = overlap > 1 ? Math.round(overlap) : 0
  if (next === inset) return
  inset = next
  for (const listener of [...listeners]) listener()
}

export function subscribeKeyboardInset(listener: () => void): () => void {
  listeners.add(listener)
  if (detach === null) {
    const vv = typeof window !== "undefined" ? window.visualViewport : null
    if (vv) {
      const onChange = () => measure(vv)
      vv.addEventListener("resize", onChange)
      vv.addEventListener("scroll", onChange)
      detach = () => {
        vv.removeEventListener("resize", onChange)
        vv.removeEventListener("scroll", onChange)
      }
      measure(vv)
    }
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0 || detach === null) return
    detach()
    detach = null
    // Unobserved, the cached overlap would go stale; the next first subscriber re-measures from 0.
    inset = 0
  }
}

export function readKeyboardInset(): number {
  return inset
}

function getServerInset(): number {
  return 0
}

export function useKeyboardInset(): number {
  return useSyncExternalStore(subscribeKeyboardInset, readKeyboardInset, getServerInset)
}
