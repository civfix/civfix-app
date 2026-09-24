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
