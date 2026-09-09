/**
 * minimizeScrollLogic - PURE hysteresis for the Apple-Music-style tab-bar SCROLL-MINIMIZE (round 3).
 *
 * iOS-26's `tabBarMinimizeBehavior(.onScrollDown)`: scrolling DOWN (content advancing, finger dragging up)
 * collapses the tab pill into a single glyph circle; any deliberate UPWARD drag restores it. This module is
 * the number-in / number-out decision so it is unit-testable with zero reanimated / RN imports - the same
 * shape as tabBarLogic's window schedules. The stateful scroll wrapper (MinimizeAwareScroll.native) and the
 * store (dockMinimizeStore) feed raw scroll offsets through `reduceMinimize`; the TabBar animates off the
 * resulting boolean.
 *
 * HYSTERESIS (anti-jitter): a single scroll frame never toggles. Directional travel ACCUMULATES; the state
 * only flips once the accumulator crosses ±THRESHOLD (~14pt of consistent-direction motion). A direction
 * REVERSAL resets the accumulator to that frame's delta, and the accumulator is CLAMPED to ±THRESHOLD so a
 * quick reversal needs only one threshold of opposite travel to flip back (never a backlog to unwind). This
 * absorbs momentum-fling micro-reversals and the rubber-band settle without chatter.
 *
 * OVERSCROLL / TOP: negative offsets (iOS rubber-band bounce past the top) are clamped to 0 and never drive
 * a minimize. At/near the very top (offset <= MIN_OFFSET) the bar is ALWAYS restored - the system shows the
 * full bar whenever the content is at rest at the top - and minimize is only ever ENTERED once scrolled past
 * MIN_OFFSET (so the first few points of travel off the top don't collapse it).
 */

/** Directional travel (pt) that must accumulate in one direction before the minimized state toggles. */
export const MINIMIZE_THRESHOLD = 14
/** Content must be scrolled past this offset (pt) before a down-scroll may MINIMIZE (restore has no floor). */
export const MINIMIZE_MIN_OFFSET = 12

export interface MinimizeState {
  /** The last scroll offset seen (clamped to >= 0), so the next frame's delta is offset - lastY. */
  lastY: number
  /** Signed directional-travel accumulator, clamped to ±THRESHOLD. +down / -up. */
  accum: number
  /** The current decision: true = collapsed glyph circle, false = full pill. */
  minimized: boolean
  /** False until the first real sample seeds `lastY` (so the initial 0 -> firstY jump isn't counted). */
  primed: boolean
}

export interface MinimizeOptions {
  threshold?: number
  minOffset?: number
}

/** A fresh tracker: full pill, no travel, unprimed. Used on mount and on manual restore / navigation reset. */
export function initialMinimizeState(): MinimizeState {
  return { lastY: 0, accum: 0, minimized: false, primed: false }
}

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0
}

/**
 * Fold one scroll offset into the tracker, returning the next state (pure; never mutates the input).
 *
 * - Overscroll bounce (y < 0) is clamped to 0.
 * - At/above the top band (y <= minOffset) the bar is forced OPEN and the accumulator cleared.
 * - The first primed sample only seeds `lastY` (no toggle) so the mount-time 0 is never a phantom down-scroll.
 * - Otherwise the signed delta accumulates (reset on a direction flip, clamped to ±threshold); crossing
 *   +threshold minimizes, crossing -threshold restores.
 */
export function reduceMinimize(
  state: MinimizeState,
  y: number,
  opts: MinimizeOptions = {},
): MinimizeState {
  const threshold = opts.threshold ?? MINIMIZE_THRESHOLD
  const minOffset = opts.minOffset ?? MINIMIZE_MIN_OFFSET
  const clampedY = y < 0 ? 0 : y

  // Top band: always open, accumulator cleared, but stay primed (so leaving the top resumes cleanly).
  if (clampedY <= minOffset) {
    return { lastY: clampedY, accum: 0, minimized: false, primed: true }
  }

  // First real sample: seed lastY without acting.
  if (!state.primed) {
    return { lastY: clampedY, accum: 0, minimized: state.minimized, primed: true }
  }

  const delta = clampedY - state.lastY
  if (delta === 0) return { ...state, lastY: clampedY }

  // Accumulate in-direction; a reversal restarts the accumulator at this frame's delta.
  const continuing = state.accum === 0 || sign(delta) === sign(state.accum)
  let accum = continuing ? state.accum + delta : delta
  // Clamp so a reversal only ever needs one full threshold of opposite travel to flip back.
  if (accum > threshold) accum = threshold
  else if (accum < -threshold) accum = -threshold

  let minimized = state.minimized
  if (accum >= threshold) minimized = true
  else if (accum <= -threshold) minimized = false

  return { lastY: clampedY, accum, minimized, primed: true }
}
