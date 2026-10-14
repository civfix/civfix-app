/**
 * The `matchMedia` guards the web shell seams share. Not a `.web` seam: plain predicates, safe to bundle
 * anywhere. The static-export prerender has no `window`, so both fall back to `false` (desktop, full
 * motion), which is what the prerendered markup should assume.
 */

export const COARSE_POINTER_QUERY = "(pointer: coarse)"

export function prefersReducedMotion(): boolean {
  return matches("(prefers-reduced-motion: reduce)")
}

/**
 * A coarse pointer is also the "raises a soft keyboard" signal: the seams apply keyboard-adjacent motion
 * instantly on touch, because animating a focused field while iOS Safari presents the keyboard makes the
 * keyboard glitch or fail to appear.
 */
export function isCoarsePointer(): boolean {
  return matches(COARSE_POINTER_QUERY)
}

export function mediaQuery(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null
  try {
    return window.matchMedia(query)
  } catch {
    return null
  }
}

function matches(query: string): boolean {
  return mediaQuery(query)?.matches ?? false
}
