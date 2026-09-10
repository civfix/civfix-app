/**
 * useReplyDockInset - how far the thread's docked reply composer must lift to sit ON the keyboard.
 *
 * THE BUG THIS FIXES: on the post-thread screen the composer row, its attach affordances and the Reply
 * button all rendered BEHIND the soft keyboard - you could not see what you were typing. The old
 * `PostThreadBody` applied `useKeyboardInset()`, which is a hard-coded `0` on native
 * (`shell/useKeyboardInset.native.ts`), so nothing lifted at all on the phone.
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
 * THE ONE THING THAT WOULD BREAK IT is an ANCESTOR also reserving the keyboard: on mobile web
 * `PortraitShell.shared` used to apply `paddingBottom: keyboardInset` to the post-thread overlay. That is
 * removed for `post-thread` in `shell/bodyLayout.ts` (`surfaceKeyboardAvoidance`), and
 * `shell/__tests__/portrait-shell.test.ts` pins it. The two changes MUST ship in the same version.
 *
 * `restPad` exists because iOS's `endCoordinates.height` is measured from the SCREEN bottom and already
 * covers the home-indicator strip: adding `insets.bottom` on top of a live keyboard inset would reopen a
 * 34pt dead gap (the exact defect the search dock had). So the safe-area pad applies only at rest.
 */
import { useContext, useEffect, useRef, useState } from "react"
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
  // The legacy shell seam: 0 on native, the visualViewport overlap on web. See the table above.
  const shell = useKeyboardInset()
  // NOT `useSafeAreaInsets()`: this hook renders on web too, where there is no SafeAreaProvider and the
  // hook throws. The context form degrades to zeros, exactly like ConversationBody does.
  const insets = useContext(SafeAreaInsetsContext)
  const [own, setOwn] = useState(0)
  const restingWindowHeight = useRestingWindowHeight()
  const systemBarInsetRef = useRef(insets?.bottom ?? 0)
  systemBarInsetRef.current = insets?.bottom ?? 0

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
  }, [])

  const inset = Math.max(shell, own)
  return { inset, restPad: inset > 0 ? 0 : (insets?.bottom ?? 0), visible: inset > 0 }
}
