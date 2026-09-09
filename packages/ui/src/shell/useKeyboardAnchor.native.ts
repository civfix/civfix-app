/**
 * useKeyboardAnchor (native seam) — THE canonical keyboard primitive.
 *
 * WHAT IT FIXES over the old `keyboard.height`-times-a-flag styles:
 *  1. OWNERSHIP. A surface only rises for a keyboard IT raised. The gate is enforced on the UI thread
 *     (`enabledSv`), not merely in the pure reducer — without that, the continuous mirror below
 *     re-publishes a foreign keyboard's live height the instant `owned` clears and the dock rides up for
 *     every TextField in the app.
 *  2. TIMEBASE. reanimated's iOS notification path estimates the keyboard's progress against a
 *     HARD-CODED 0.48s / 0.496s. The OS reports the real duration on the event; we re-parameterise
 *     reanimated's own fitted curves (see keyboardInsetModel) onto THAT, which kills the trail-then-snap.
 *  3. REST OFFSET. The surface lands exactly `gap` above the keyboard top, because the pt already
 *     between its VISIBLE bottom edge and the window bottom are subtracted.
 *
 * THREADING INVARIANT (frozen, see useKeyboardAnchor.types.ts): `lift` is per-frame on the UI thread;
 * `reserved` is per-transition on the JS thread. Never conflate them.
 */
import { useEffect, useRef, useState } from "react"
import {
  Keyboard,
  Platform,
  useWindowDimensions,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import {
  ReduceMotion,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { theme } from "../theme"
import {
  KEYBOARD_SURFACE_GAP,
  iosKeyboardCloseEasing,
  iosKeyboardOpenEasing,
  isRedundantClose,
  keyboardAnimationDuration,
  keyboardLift,
  keyboardOverlapFrom,
  reduceKeyboard,
  type KeyboardCommand,
  type KeyboardPhase,
} from "./keyboardInsetModel"
import type { KeyboardAnchor, KeyboardAnchorOptions } from "./useKeyboardAnchor.types"

const PLATFORM: "ios" | "android" | "other" =
  Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "other"

export function useKeyboardAnchor({
  enabled = true,
  restOffset = 0,
  gap = KEYBOARD_SURFACE_GAP,
}: KeyboardAnchorOptions = {}): KeyboardAnchor {
  const kb = useAnimatedKeyboard()
  const windowH = useWindowDimensions().height

  const overlap = useSharedValue(0)
  const owned = useSharedValue(0)
  /** THE UI-THREAD OWNERSHIP GATE. Without this the continuous mirror below re-publishes a foreign
   *  keyboard's live height the instant `owned` clears, and the dock rides up for every TextField in
   *  the app. The pure reducer CANNOT express this — it is a UI-thread invariant. */
  const enabledSv = useSharedValue(enabled ? 1 : 0)
  const restSv = useSharedValue(restOffset)
  const gapSv = useSharedValue(gap)
  useEffect(() => {
    restSv.value = restOffset
  }, [restOffset, restSv])
  useEffect(() => {
    gapSv.value = gap
  }, [gap, gapSv])

  const phase = useRef<KeyboardPhase>("idle")
  const enabledRef = useRef(enabled)
  const winRef = useRef(windowH)
  winRef.current = windowH
  /** The OVERLAP currently reserved (not the derived lift) — replayed into `will-hide` as `reserveHint`
   *  so the reservation is HELD through the close animation instead of collapsing a frame after blur. */
  const reserveOverlapRef = useRef(0)
  /** The TARGET of the close currently travelling, or null when nothing is. TWO jobs, one record:
   *  it is the `closing` flag `reduceKeyboard` needs to CARRY the reservation through the blur, and it is
   *  the dedupe key that stops that same blur restarting the will-hide's timing. Set when `apply` starts a
   *  CLOSING animation; cleared on every landing (duration <= 0) and by any non-closing animation. */
  const inFlightCloseRef = useRef<number | null>(null)
  /** Replay buffer: iOS can deliver keyboardWillShow BEFORE React commits `focused: true`. */
  const lastWillShow = useRef<{ overlap: number; duration: number; at: number } | null>(null)
  const [engaged, setEngaged] = useState(false)
  const [reserved, setReserved] = useState(0)

  // (A) CONTINUOUS MIRROR — GATED. reanimated's height is the genuine per-frame system value on
  //     Android (WindowInsetsAnimationCompat onProgress) and during an iOS INTERACTIVE dismissal (KVO
  //     on the keyboard view's center, which publishes the LIVE frame). Only the iOS NOTIFICATION path
  //     is an estimate, and `owned` masks that. `enabledSv` masks a keyboard we do not own — on BOTH
  //     platforms, which also covers Android where no will* listener is registered.
  useAnimatedReaction(
    () => kb.height.value,
    (h) => {
      if (enabledSv.value === 0) {
        // `owned` is checked on THIS branch too. Losing ownership while the keyboard is still up runs
        // reduceKeyboard's ownership/`enabled:false`/`engaged` case, which returns duration =
        // keyboardHandoffMs — so `apply` sets owned = 1 and starts a withTiming(0) release. A plain
        // assignment to a shared value CANCELS a running reanimated animation, and this reaction fires on
        // every frame kb.height moves, so an unconditional `overlap.value = 0` here killed that release on
        // its very first frame: the surface snapped ~300pt down in one frame and then sat hidden behind
        // the still-descending keyboard. `apply` clears `owned` on every duration<=0 landing, so the
        // foreign-keyboard mask this gate exists for is untouched.
        if (owned.value === 0) overlap.value = 0
        return
      }
      if (owned.value === 0) overlap.value = h
    },
  )

  const apply = (cmd: KeyboardCommand, closing: boolean) => {
    phase.current = cmd.phase
    setEngaged(cmd.phase === "engaged")
    reserveOverlapRef.current = cmd.reserveOverlap
    setReserved(keyboardLift(cmd.reserveOverlap, restOffset, gap))
    // ONE CLOSE, ONE CURVE. The phase + reservation above STILL apply — that is exactly how the mid-close
    // blur carries the reservation (reduceKeyboard's `closing` branch). Only the ANIMATION command is
    // dropped, because reanimated would restart the ease-out from the current value and re-accelerate the
    // dock while the real keyboard is still decelerating on the OS curve.
    if (isRedundantClose(cmd, inFlightCloseRef.current)) return
    if (cmd.duration <= 0) {
      inFlightCloseRef.current = null
      owned.value = 0
      overlap.value = cmd.target
      return
    }
    inFlightCloseRef.current = closing ? cmd.target : null
    owned.value = 1
    overlap.value = withTiming(cmd.target, {
      duration: cmd.duration,
      easing: closing ? iosKeyboardCloseEasing : iosKeyboardOpenEasing,
      reduceMotion: ReduceMotion.System,
    })
  }

  // (C) iOS NOTIFICATION TRANSITIONS, re-timed off the OS's OWN reported duration (ms).
  //     Android is NOT registered for will*: its duration is documented "always 0" and its insets
  //     animation is already frame-exact through (A).
  useEffect(() => {
    const subs: { remove(): void }[] = []
    const dur = (e: KeyboardEvent) =>
      keyboardAnimationDuration(e.duration, theme.motion.keyboardFallbackMs, theme.motion.keyboardMaxMs)
    if (Platform.OS === "ios") {
      subs.push(
        Keyboard.addListener("keyboardWillShow", (e: KeyboardEvent) => {
          const overlapPt = keyboardOverlapFrom(e.endCoordinates, winRef.current, PLATFORM)
          lastWillShow.current = { overlap: overlapPt, duration: dur(e), at: Date.now() }
          apply(
            reduceKeyboard(phase.current, {
              type: "will-show",
              overlap: overlapPt,
              duration: dur(e),
              enabled: enabledRef.current,
            }),
            false,
          )
        }),
      )
      subs.push(
        Keyboard.addListener("keyboardWillHide", (e: KeyboardEvent) => {
          lastWillShow.current = null
          apply(
            reduceKeyboard(phase.current, {
              type: "will-hide",
              duration: dur(e),
              reserveHint: reserveOverlapRef.current,
            }),
            true,
          )
        }),
      )
    }
    subs.push(
      Keyboard.addListener("keyboardDidShow", (e: KeyboardEvent) => {
        apply(
          reduceKeyboard(phase.current, {
            type: "did-settle",
            overlap: keyboardOverlapFrom(e.endCoordinates, winRef.current, PLATFORM),
            enabled: enabledRef.current,
          }),
          false,
        )
      }),
    )
    subs.push(
      Keyboard.addListener("keyboardDidHide", () => {
        lastWillShow.current = null
        apply(
          reduceKeyboard(phase.current, { type: "did-settle", overlap: 0, enabled: enabledRef.current }),
          true,
        )
      }),
    )
    return () => subs.forEach((s) => s.remove())
  }, [restOffset, gap])

  // (D) OWNERSHIP CHANGES.
  //     `enabledRef` is assigned SYNCHRONOUSLY here (not during render) so an in-flight willShow can be
  //     replayed. `Keyboard.metrics()` returns `_currentlyShowing?.endCoordinates`, which RN assigns ONLY
  //     in its keyboardDidShow listener — it is UNDEFINED for the whole show animation. Without the
  //     replay, focusing after a willShow means nothing moves until didShow, then a single-frame 317pt
  //     teleport. The replay window is generous (600ms) because it is bounded by keyboardMaxMs anyway.
  useEffect(() => {
    enabledRef.current = enabled
    enabledSv.value = enabled ? 1 : 0
    const pending = lastWillShow.current
    if (enabled && pending && Date.now() - pending.at < theme.motion.keyboardMaxMs) {
      apply(
        reduceKeyboard(phase.current, {
          type: "will-show",
          overlap: pending.overlap,
          duration: pending.duration,
          enabled: true,
        }),
        false,
      )
      return
    }
    const live = keyboardOverlapFrom(Keyboard.metrics(), winRef.current, PLATFORM)
    apply(
      reduceKeyboard(phase.current, {
        type: "ownership",
        enabled,
        liveOverlap: live,
        handoffMs: theme.motion.keyboardHandoffMs,
        // Derived from the SAME record the dedupe uses, so "carry the reserve" and "do not restart the
        // travel" can never disagree. Order of record: iOS posts keyboardWillHide (which starts the close
        // and sets this ref) BEFORE the field's blur re-runs this effect.
        closing: inFlightCloseRef.current !== null,
        reserveHint: reserveOverlapRef.current,
      }),
      !enabled,
    )
    // NO setTimeout releasing `owned`: `enabledSv` now holds the mirror off, so there is nothing to release.
  }, [enabled, enabledSv])

  const lift = useDerivedValue(() => keyboardLift(overlap.value, restSv.value, gapSv.value))
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value }] }))
  // Two deliberate widenings so the seam matches the FROZEN cross-platform contract:
  //  - `useAnimatedStyle` returns reanimated's opaque AnimatedStyleHandle (4.4.1) / plain style (4.1.7);
  //    the contract publishes `StyleProp<ViewStyle>` because the web seam returns a plain CSS object.
  //    Consumers must hand it to an Animated.View (or <KeyboardAnchorView>), never to a plain View.
  //  - `useDerivedValue` returns a Readonly<SharedValue>; the contract publishes
  //    `SharedValue<number> | null` so a consumer can compose it into its OWN worklet. Read-only in
  //    practice — nothing may write to it.
  return {
    liftStyle: liftStyle as unknown as StyleProp<ViewStyle>,
    lift: lift as unknown as SharedValue<number>,
    reserved,
    engaged,
  }
}
