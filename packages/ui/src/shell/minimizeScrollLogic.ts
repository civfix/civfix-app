/**
 * Pure hysteresis for the dock's scroll-minimize: scrolling down collapses the tab pill into one glyph
 * circle, any deliberate upward drag restores it.
 *
 * A single frame never toggles: directional travel accumulates and the state flips only past
 * ±THRESHOLD. A reversal restarts the accumulator, and it is clamped to ±THRESHOLD so flipping back never
 * has a backlog to unwind; this absorbs momentum micro-reversals and the rubber-band settle. Negative
 * (rubber-band) offsets clamp to 0, and at the top (offset <= MIN_OFFSET) the bar is always restored, as
 * the system shows the full bar at rest at the top.
 */

export const MINIMIZE_THRESHOLD = 14
/** Only minimizing has this floor; restoring does not. */
export const MINIMIZE_MIN_OFFSET = 12

export interface MinimizeState {
  lastY: number
  /** +down / -up. */
  accum: number
  minimized: boolean
  /** So the initial 0 -> firstY jump is not counted as travel. */
  primed: boolean
}

export interface MinimizeOptions {
  threshold?: number
  minOffset?: number
}

export function initialMinimizeState(): MinimizeState {
  return { lastY: 0, accum: 0, minimized: false, primed: false }
}

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0
}

export function reduceMinimize(
  state: MinimizeState,
  y: number,
  opts: MinimizeOptions = {},
): MinimizeState {
  const threshold = opts.threshold ?? MINIMIZE_THRESHOLD
  const minOffset = opts.minOffset ?? MINIMIZE_MIN_OFFSET
  const clampedY = y < 0 ? 0 : y

  // Stay primed so leaving the top resumes cleanly.
  if (clampedY <= minOffset) {
    return { lastY: clampedY, accum: 0, minimized: false, primed: true }
  }

  if (!state.primed) {
    return { lastY: clampedY, accum: 0, minimized: state.minimized, primed: true }
  }

  const delta = clampedY - state.lastY
  if (delta === 0) return { ...state, lastY: clampedY }

  const continuing = state.accum === 0 || sign(delta) === sign(state.accum)
  let accum = continuing ? state.accum + delta : delta
  if (accum > threshold) accum = threshold
  else if (accum < -threshold) accum = -threshold

  let minimized = state.minimized
  if (accum >= threshold) minimized = true
  else if (accum <= -threshold) minimized = false

  return { lastY: clampedY, accum, minimized, primed: true }
}
