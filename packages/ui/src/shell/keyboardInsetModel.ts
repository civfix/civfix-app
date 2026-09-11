/**
 * PURE keyboard geometry, curves and ownership reducer. RN-free, vitest-able.
 * NO import may be added to this file — it is the leaf both platform seams consume.
 */

/** Visual gap (pt) kept between a bottom-anchored surface's VISIBLE bottom edge and the keyboard top.
 *  8 == DOCK_BOTTOM_MARGIN, so a bar sitting on the keyboard reads with the same rhythm it has at rest. */
export const KEYBOARD_SURFACE_GAP = 8

/** THE formula. `overlap` = pt the keyboard covers of the window bottom. `restOffset` = pt already
 *  between the surface's VISIBLE bottom edge and the window bottom at rest. Returns translateY magnitude.
 *
 *  NOTE the literal `8` default: reanimated does NOT capture a module const referenced in a worklet's
 *  DEFAULT PARAMETER list (the __closure destructure lands in the body, after defaults evaluate) — it
 *  would throw "Property 'KEYBOARD_SURFACE_GAP' doesn't exist" on the UI thread. Same trap documented at
 *  surface/liquidGlass/liquidGlassModel.ts:117-120. This literal MUST equal KEYBOARD_SURFACE_GAP; the
 *  unit test asserts it. */
export function keyboardLift(overlap: number, restOffset: number, gap: number = 8): number {
  "worklet"
  if (overlap <= 0) return 0
  const lift = overlap - restOffset + gap
  return lift > 0 ? lift : 0
}

export function keyboardAnimationDuration(
  reported: number | undefined,
  fallback: number,
  max: number,
): number {
  const d = typeof reported === "number" && reported > 0 ? reported : fallback
  return d > max ? max : d
}

/**
 * iOS keyboard OPEN/CLOSE progress curves — reanimated 4's OWN fitted curves, lifted verbatim from
 * REAKeyboardEventObserver.mm's `estimateProgressForDuration:a1:a2:b1:b2:c1:c2`
 * (1 - a1*(1-x)^a2 - b1*x*(1-x)^b2 - c1*x^2*(1-x)^c2, a1 == 1 in both call sites), but RE-PARAMETERISED
 * onto the duration the OS actually reports instead of reanimated's hard-coded 0.48s / 0.496s. The SHAPE
 * is a measured fit of real keyboard motion; only the timebase was wrong, and that is the trail-then-snap.
 */
function curve(x: number, a2: number, b1: number, b2: number, c1: number, c2: number): number {
  "worklet"
  const t = x < 0 ? 0 : x > 1 ? 1 : x
  const inv = 1 - t
  return 1 - Math.pow(inv, a2) - b1 * t * Math.pow(inv, b2) - c1 * t * t * Math.pow(inv, c2)
}
export function iosKeyboardOpenEasing(x: number): number {
  "worklet"
  return curve(x, 4.62, 2.44, 9.82, 0.22, 2.09)
}
export function iosKeyboardCloseEasing(x: number): number {
  "worklet"
  return curve(x, 5.65, 2.74, 8.38, 0.93, 3.29)
}

/**
 * Overlap from a KeyboardEvent. iOS ONLY takes the screenY branch: RCTKeyboardObserver.mm converts
 * endCoordinates to WINDOW space, so window-bottom minus screenY is the true overlap even for
 * split/floating keyboards. On ANDROID the window already EXCLUDES the keyboard under adjustResize —
 * `winH - screenY` would double-count (the same trap documented at KeyboardAwareScroll.native.tsx:94-97) —
 * so Android takes the `height` branch.
 */
export function keyboardOverlapFrom(
  endCoordinates: { screenY?: number; height?: number } | undefined,
  windowHeight: number,
  platform: "ios" | "android" | "other",
): number {
  const screenY = endCoordinates?.screenY
  if (platform === "ios" && typeof screenY === "number" && windowHeight > 0) {
    return Math.max(0, windowHeight - screenY)
  }
  return Math.max(0, endCoordinates?.height ?? 0)
}

export function androidKeyboardInset(
  keyboardHeight: number,
  restingWindowHeight: number,
  currentWindowHeight: number,
): number {
  const shrunk = Math.max(0, restingWindowHeight - currentWindowHeight)
  return Math.max(0, Math.round(keyboardHeight - shrunk))
}

export interface KeyboardViewportOverlapInput {
  endCoordinates: { screenY?: number; height?: number } | undefined
  windowHeight: number
  restingWindowHeight: number
  platform: "ios" | "android" | "other"
  systemBarInset: number
}

export function keyboardViewportOverlap({
  endCoordinates,
  windowHeight,
  restingWindowHeight,
  platform,
  systemBarInset,
}: KeyboardViewportOverlapInput): number {
  if (platform !== "android") return keyboardOverlapFrom(endCoordinates, windowHeight, platform)
  const height = endCoordinates?.height ?? 0
  if (height <= 0) return 0
  return androidKeyboardInset(height + systemBarInset, restingWindowHeight, windowHeight)
}

export interface KeyboardMirrorOverlapInput {
  reanimatedHeight: number
  systemBarInset: number
  edgeToEdge: boolean
}

export function keyboardMirrorOverlap({
  reanimatedHeight,
  systemBarInset,
  edgeToEdge,
}: KeyboardMirrorOverlapInput): number {
  "worklet"
  if (reanimatedHeight <= 0) return 0
  return edgeToEdge ? reanimatedHeight : reanimatedHeight + systemBarInset
}

export interface RestingHeightRecaptureInput {
  keyboardOpen: boolean
  prevWidth: number
  nextWidth: number
}

export function shouldRecaptureRestingHeight({
  keyboardOpen,
  prevWidth,
  nextWidth,
}: RestingHeightRecaptureInput): boolean {
  return !keyboardOpen || prevWidth !== nextWidth
}

// ----- Ownership state machine (pure). -----
export type KeyboardPhase = "idle" | "engaged"
export type KeyboardSignal =
  | { type: "will-show"; overlap: number; duration: number; enabled: boolean }
  /** `reserveHint` is the OVERLAP currently reserved — the same units as every other `overlap`/
   *  `reserveOverlap` in this module, NOT the derived lift (the caller runs `keyboardLift` over
   *  `reserveOverlap` itself, so handing it a lift would shrink the reservation by `restOffset - gap`
   *  on every close). It is HELD through the close animation and released at `did-settle`, so content
   *  does not re-expand under a still-travelling bar. */
  | { type: "will-hide"; duration: number; reserveHint?: number }
  | { type: "did-settle"; overlap: number; enabled: boolean }
  /**
   * Ownership changed while a keyboard may be up.
   *
   * `closing` says a close THIS surface owns is ALREADY travelling — `keyboardWillHide` has fired and
   * `did-settle` has not. On iOS a dock exit posts willHide FIRST and the field's blur lands one tick
   * later, so this signal routinely arrives mid-descent; the caller derives the flag from the same
   * in-flight record it uses to skip the redundant animation (`isRedundantClose`).
   *
   * `reserveHint` is the OVERLAP currently reserved — the same units as every other `overlap` /
   * `reserveOverlap` in this module, NOT the derived lift (see the note on `will-hide`).
   */
  | {
      type: "ownership"
      enabled: boolean
      liveOverlap: number
      handoffMs: number
      closing?: boolean
      reserveHint?: number
    }
export interface KeyboardCommand {
  phase: KeyboardPhase
  target: number
  duration: number
  reserveOverlap: number
}
export function reduceKeyboard(phase: KeyboardPhase, s: KeyboardSignal): KeyboardCommand {
  switch (s.type) {
    case "will-show":
      if (!s.enabled) return { phase: "idle", target: 0, duration: 0, reserveOverlap: 0 }
      return { phase: "engaged", target: s.overlap, duration: s.duration, reserveOverlap: s.overlap }
    case "will-hide":
      if (phase !== "engaged") return { phase: "idle", target: 0, duration: 0, reserveOverlap: 0 }
      // reserveOverlap is HELD until did-settle: dropping it here would collapse the content box a
      // frame after blur, while the bar and keyboard are still travelling down.
      return { phase: "engaged", target: 0, duration: s.duration, reserveOverlap: s.reserveHint ?? 0 }
    case "did-settle":
      if (s.overlap <= 0 || !s.enabled) return { phase: "idle", target: 0, duration: 0, reserveOverlap: 0 }
      return { phase: "engaged", target: s.overlap, duration: 0, reserveOverlap: s.overlap }
    case "ownership":
      if (s.enabled) {
        if (phase === "engaged" || s.liveOverlap <= 0) {
          return {
            phase,
            target: s.liveOverlap,
            duration: 0,
            reserveOverlap: phase === "engaged" ? s.liveOverlap : 0,
          }
        }
        return {
          phase: "engaged",
          target: s.liveOverlap,
          duration: s.handoffMs,
          reserveOverlap: s.liveOverlap,
        }
      }
      if (phase !== "engaged") return { phase: "idle", target: 0, duration: 0, reserveOverlap: 0 }
      // A close WE own is already travelling: this is the blur that follows keyboardWillHide by one tick.
      // Returning reserveOverlap: 0 here is what collapsed the reservation in ONE un-animated frame while
      // the keyboard was still descending (SearchBodyReveal.native folds it into the search list's scroll
      // padding, so it re-lays-out that content box: 411 -> 94 on an iPhone 17 Pro). CARRY it, exactly as the
      // will-hide branch does, and stay "engaged" so a duplicate will-hide or re-focus ownership event
      // chooses the instant-snap branch (duration: 0) instead of the animated handoff.
      if (s.closing) {
        return { phase: "engaged", target: 0, duration: s.handoffMs, reserveOverlap: s.reserveHint ?? 0 }
      }
      return { phase: "idle", target: 0, duration: s.handoffMs, reserveOverlap: 0 }
  }
}

/**
 * Would `cmd` RESTART a close that is already travelling to the same target?
 *
 * `inFlightTarget` is the target of the close currently animating, or null when nothing is. Reanimated
 * does not "continue" a running timing: assigning a second `withTiming` starts a NEW ease-out from the
 * current value, so re-issuing the will-hide's close on the blur that follows it one tick later
 * re-accelerates the dock while the real keyboard keeps decelerating on the OS curve.
 *
 * A duration<=0 command is NEVER redundant: that is the LANDING (`did-settle`), and it is what clears the
 * in-flight record and releases the reservation Task 4.1 carries.
 */
export function isRedundantClose(cmd: KeyboardCommand, inFlightTarget: number | null): boolean {
  return inFlightTarget !== null && cmd.duration > 0 && cmd.target === inFlightTarget
}

export const KEYBOARD_REVEAL_MARGIN = 16

export function keyboardTopInWindow(windowHeight: number, overlap: number): number {
  return windowHeight - (overlap > 0 ? overlap : 0)
}

export interface RevealScrollDeltaInput {
  fieldTop: number
  fieldHeight: number
  keyboardTop: number
  visibleTop: number
  margin: number
}

export function revealScrollDelta({
  fieldTop,
  fieldHeight,
  keyboardTop,
  visibleTop,
  margin,
}: RevealScrollDeltaInput): number {
  const needed = fieldTop + fieldHeight + margin - keyboardTop
  if (needed <= 0) return 0
  const headroom = fieldTop - visibleTop
  const delta = needed < headroom ? needed : headroom
  return delta > 0 ? delta : 0
}

export function revealScrollTarget(offset: number, delta: number): number {
  const target = offset + delta
  return target > 0 ? target : 0
}

export function scrollKeyboardReserve(overlap: number, margin: number): number {
  if (overlap <= 0) return 0
  return overlap + margin
}
