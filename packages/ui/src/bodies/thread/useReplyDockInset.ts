/**
 * How far the thread's docked reply composer must lift to sit ON the keyboard.
 *
 * The shell's `useKeyboardInset()` is a hard-coded `0` on native (`shell/useKeyboardInset.native.ts`), so
 * on its own it would leave the composer row, its attach affordances and the Reply button BEHIND the soft
 * keyboard on the phone.
 *
 * THE DESIGN, and why it cannot double-apply:
 *
 *   inset = Math.max(shellInset, ownNativeMeasurement)
 *
 * `shellInset` is the legacy shell seam: 0 on native, the `visualViewport` overlap on web.
 * `ownNativeMeasurement` is THIS hook's own RN `Keyboard` measurement: a real value on iOS/Android, and
 * always 0 on web (RN's `Keyboard` events never fire under react-native-web). The two sources are
 * therefore DISJOINT by platform, so `Math.max` is exactly "whichever source can see the keyboard here",
 * and it stays correct if the shell seam ever starts reporting a native value too:
 *
 *   | scenario                                    | shell | own | max | correct?          |
 *   |---------------------------------------------|-------|-----|-----|-------------------|
 *   | native today (shell seam returns 0)         |     0 | 345 | 345 | yes - the fix     |
 *   | native if the shell seam is ever wired up   |   345 | 345 | 345 | yes - no doubling |
 *   | mobile web (RN Keyboard never fires)        |   336 |   0 | 336 | yes - applied once|
 *   | desktop web                                 |     0 |   0 |   0 | yes               |
 *
 * It composes with `useKeyboardAnchor` (the canonical primitive) by NOT USING IT: the anchor animates a
 * transform on the UI thread, which is the right tool for a floating bar over a static body, whereas the
 * reply dock is a FLEX SIBLING of the reply list and must change LAYOUT (the list genuinely shrinks, and
 * `buildReplyComposerHeightPlan` needs the number synchronously in JS on the same render). Because this
 * hook never asks the anchor for a lift, a surface can never receive both.
 *
 * THE ONE THING THAT WOULD BREAK IT is an ANCESTOR also reserving the keyboard: the mobile-web portrait
 * shell must not pad the post-thread overlay by the keyboard inset. `shell/bodyLayout.ts`
 * (`surfaceKeyboardAvoidance`) keeps `post-thread` out of it, and `shell/__tests__/portraitShell.test.ts`
 * pins that.
 *
 * `restPad` exists because iOS's `endCoordinates.height` is measured from the SCREEN bottom and already
 * covers the home-indicator strip: adding `insets.bottom` on top of a live keyboard inset would reopen a
 * 34pt dead gap. So the safe-area pad applies only at rest.
 */
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { keyboardViewportOverlap } from "../../shell/keyboardInsetModel"
import { useKeyboardInset } from "../../shell/useKeyboardInset"
import { useRestingWindowHeight } from "../../shell/useRestingWindowHeight"

const PLATFORM: "ios" | "android" | "other" =
  Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "other"

export interface ReplyDockInset {
  /** px to lift the docked surface by (applied as `marginBottom`). 0 when the keyboard is closed. */
  inset: number
  /** px of bottom padding to apply INSIDE the surface when `inset === 0` (home-indicator clearance). */
  restPad: number
  /** Whether a keyboard is currently overlapping the dock. */
  visible: boolean
}

export function useReplyDockInset(): ReplyDockInset {
  const shell = useKeyboardInset()
  const insets = useContext(SafeAreaInsetsContext)
  const [own, setOwn] = useState(0)
  const restingWindowHeight = useRestingWindowHeight()
  const systemBarInsetRef = useRef(insets?.bottom ?? 0)
  useLayoutEffect(() => {
    systemBarInsetRef.current = insets?.bottom ?? 0
  })

  useEffect(() => {
    const overlapOf = (event: KeyboardEvent) =>
      keyboardViewportOverlap({
        endCoordinates: event.endCoordinates,
        windowHeight: Dimensions.get("window").height,
        restingWindowHeight: restingWindowHeight.current,
        platform: PLATFORM,
        systemBarInset: systemBarInsetRef.current,
      })

    // Web has no RN Keyboard events at all; `shell` is the only source there and it is already read above.
    if (Platform.OS !== "ios" && Platform.OS !== "android") return
    const subs: { remove(): void }[] = []
    if (Platform.OS === "ios") {
      // WILL_show/hide, not DID: iOS posts them at the START of the ~0.25s keyboard animation, so the
      // dock is already in place by the time the keyboard arrives instead of jumping after it lands.
      subs.push(
        Keyboard.addListener("keyboardWillShow", (event: KeyboardEvent) => setOwn(overlapOf(event))),
      )
      subs.push(Keyboard.addListener("keyboardWillHide", () => setOwn(0)))
    } else {
      // Android has no reliable will* pair (its reported duration is documented "always 0").
      subs.push(
        Keyboard.addListener("keyboardDidShow", (event: KeyboardEvent) => setOwn(overlapOf(event))),
      )
      subs.push(Keyboard.addListener("keyboardDidHide", () => setOwn(0)))
    }
    return () => {
      for (const sub of subs) sub.remove()
    }
  }, [restingWindowHeight])

  const inset = Math.max(shell, own)
  const restingSafeArea = Platform.OS === "web" ? 0 : (insets?.bottom ?? 0)
  return { inset, restPad: inset > 0 ? 0 : restingSafeArea, visible: inset > 0 }
}
