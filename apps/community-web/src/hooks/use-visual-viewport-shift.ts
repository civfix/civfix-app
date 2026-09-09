"use client"

import * as React from "react"

/**
 * The vertical offset a fixed, layout-viewport-centered dialog needs so it stays centered in the area
 * the soft keyboard leaves VISIBLE on mobile web.
 *
 * A `position:fixed` card is centered in the LAYOUT viewport, which the keyboard does not shrink, so a
 * lower input would sit under it. `window.visualViewport` reports the visible area, and the difference
 * between the two centers is the shift to apply (0 on desktop / with no keyboard). Sub-pixel jitter
 * (|shift| <= 1) is treated as 0 so the card does not twitch. We deliberately do NOT touch the global
 * viewport meta (interactive-widget), which would break the rn-web shell's useKeyboardInset math.
 *
 * `enabled` lets a dialog that is currently closed opt out (and reset to 0) without conditionally
 * calling the hook.
 */
export function useVisualViewportShift(enabled = true): number {
  const [shift, setShift] = React.useState(0)

  React.useEffect(() => {
    if (!enabled) {
      setShift(0)
      return
    }
    const vv = typeof window !== "undefined" ? window.visualViewport : null
    if (!vv) return
    const compute = () => {
      const next = vv.offsetTop + vv.height / 2 - window.innerHeight / 2
      setShift(Math.abs(next) > 1 ? Math.round(next) : 0)
    }
    compute()
    vv.addEventListener("resize", compute)
    vv.addEventListener("scroll", compute)
    return () => {
      vv.removeEventListener("resize", compute)
      vv.removeEventListener("scroll", compute)
    }
  }, [enabled])

  return shift
}
