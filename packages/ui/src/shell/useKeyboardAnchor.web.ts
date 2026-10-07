/**
 * useKeyboardAnchor (web seam) over the visual viewport: RN's `Keyboard` events never fire on
 * react-native-web.
 *
 * A coarse pointer gets `transition: none`, because animating a focused field while iOS Safari presents
 * the keyboard makes the keyboard glitch or fail to appear; OS reduced motion also gets `none`.
 *
 * `engaged` is held until the visual viewport recovers, so the bar does not drop through a keyboard that
 * is still closing after the field blurs. `lift` is always null here.
 */
import { useEffect, useState } from "react"
import type { ViewStyle } from "react-native"
import { KEYBOARD_SURFACE_GAP, keyboardLift } from "./keyboardInsetModel"
import { searchRiseTransition } from "./tabBarLogic"
import type { KeyboardAnchor, KeyboardAnchorOptions } from "./useKeyboardAnchor.types"
// Explicit `.web` specifier: this file is itself a `.web` seam and must not rely on bundler resolution.
import { useKeyboardInset } from "./useKeyboardInset.web"
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
      // PortraitShell.shared's overlay already applies `paddingBottom: keyboardInset`.
      setEngaged(false)
      return
    }
    if (enabled && overlap > 0) {
      setEngaged(true)
      return
    }
    // Deliberately no `else`: losing focus while the keyboard is still on screen must not drop the bar.
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

  // The overlap changes only on visual-viewport resize events, never per frame, so `reserved` can mirror it.
  return { liftStyle, lift: null, reserved: lift, engaged }
}
