"use client"

import * as React from "react"

/**
 * A `position:fixed` dialog is centered in the layout viewport, which the mobile soft keyboard does not
 * shrink, so a lower input would sit under the keyboard; the shift is the gap between the layout and
 * visual viewport centers. Sub-pixel jitter is ignored so the card does not twitch. The global viewport
 * meta (interactive-widget) is deliberately left alone: changing it breaks the rn-web shell's
 * useKeyboardInset math.
 */
export function useVisualViewportShift(enabled = true): number {
  const [shift, setShift] = React.useState(0)

  React.useEffect(() => {
    if (!enabled) return
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
      // A reopened dialog must start centered, not at the shift it had when it closed.
      setShift(0)
    }
  }, [enabled])

  return enabled ? shift : 0
}
