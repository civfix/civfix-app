/**
 * useKeyboardAnchor (web seam) — the same FROZEN contract as the native anchor, over the visual
 * viewport instead of RN's Keyboard module.
 *
 * OVERLAP SOURCE: `useKeyboardInset.web` verbatim (`innerHeight - visualViewport.height -
 * visualViewport.offsetTop`). RN's `Keyboard` events never fire on react-native-web, so the visual
 * viewport is the only reliable signal. Explicit `.web` specifier because this file is itself a seam.
 *
 * TRANSITION: `searchRiseTransition({coarsePointer, reduceMotion})` verbatim, so the two behaviours the
 * docked bar already depends on are preserved — a COARSE pointer (i.e. a device with a soft keyboard)
 * gets `transition: none`, because animating a focused field while iOS Safari presents the keyboard
 * makes the keyboard glitch or fail to appear; and OS reduced-motion also gets `none`.
 *
 * OWNERSHIP, and the bug it fixes: today `translateY = focused ? -keyboardInset : 0` snaps to 0 the
 * instant the field blurs, while the keyboard is still closing — the bar drops through the still-present
 * keyboard. Here `engaged` is HELD until the visual viewport recovers, mirroring the native reducer's
 * "engaged through will-hide, released at did-settle".
 *
 * NO REANIMATED. `lift` is therefore `null` on this seam (frozen contract) — a web consumer composes
 * `liftStyle` or reads `reserved`, never a shared value.
 */
import { useEffect, useState } from "react"
import type { ViewStyle } from "react-native"
import { KEYBOARD_SURFACE_GAP, keyboardLift } from "./keyboardInsetModel"
import { searchRiseTransition } from "./tabBarLogic"
import type { KeyboardAnchor, KeyboardAnchorOptions } from "./useKeyboardAnchor.types"
// Explicit `.web` specifier (this file is itself a `.web` seam, so it must not rely on bundler resolution).
import { useKeyboardInset } from "./useKeyboardInset.web"
// The shared matchMedia guards (a coarse pointer means a soft keyboard: the rise is applied INSTANTLY on
// touch so the bar never animates across the screen while the browser presents the keyboard).
import { isCoarsePointer, prefersReducedMotion } from "./webMedia"

export function useKeyboardAnchor({
  enabled = true,
  restOffset = 0,
  gap = KEYBOARD_SURFACE_GAP,
  hostReserved = false,
}: KeyboardAnchorOptions = {}): KeyboardAnchor {
  const overlap = useKeyboardInset()
  const [engaged, setEngaged] = useState(false)

  useEffect(() => {
    if (hostReserved) {
      // An ancestor already reserved the overlap (PortraitShell.shared's full-social-modal overlay
      // applies `paddingBottom: keyboardInset`); applying it here too would double-inset the surface.
      setEngaged(false)
      return
    }
    if (enabled && overlap > 0) {
      setEngaged(true)
      return
    }
    // NOTE the deliberately missing `else`: losing focus while the keyboard is still on screen must NOT
    // drop the bar. Ownership is released only when the visual viewport has actually recovered.
    if (overlap <= 0) setEngaged(false)
  }, [enabled, overlap, hostReserved])

  const lift = engaged ? keyboardLift(overlap, restOffset, gap) : 0
  const liftStyle = {
    transform: `translateY(${-lift}px)`,
    transition: searchRiseTransition({
      coarsePointer: isCoarsePointer(),
      reduceMotion: prefersReducedMotion(),
    }),
  } as unknown as ViewStyle

  // `reserved` mirrors `lift` on web: the overlap is a layout-viewport fact that changes at most twice
  // per keyboard transition (the visual-viewport resize events), never per frame.
  return { liftStyle, lift: null, reserved: lift, engaged }
}
