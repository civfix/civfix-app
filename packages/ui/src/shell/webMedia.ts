/**
 * The two `matchMedia` guards the web shell seams share.
 *
 * Both used to be copy-pasted three-liners in every seam that needed them (SearchHeader.web,
 * BodyTransition.web, TabBar.web, CompactShell.web) - five copies of two functions, each with its own SSR
 * comment, and they had already drifted (one copy lacked the try/catch). They live here once instead.
 *
 * NOT a `.web` seam: these are plain predicates with no web-only imports, so the module is safe to bundle
 * anywhere; it is simply only IMPORTED by the web seams (on native both queries are meaningless - the OS
 * reduce-motion flag comes from `AccessibilityInfo`, and the pointer is always coarse).
 *
 * SSR: the web app is a Next.js static export that PRERENDERS with no `window`, so every access is guarded
 * and both predicates fall back to `false` (= desktop, full motion), which is what the prerendered markup
 * should assume.
 */

/** True when the OS asks for reduced motion. SSR-safe (no window during prerender => false). */
export function prefersReducedMotion(): boolean {
  return matches("(prefers-reduced-motion: reduce)")
}

/**
 * True on a COARSE pointer (touch), which is also the signal for "this device raises a soft keyboard".
 * The seams use it to apply keyboard-adjacent motion INSTANTLY on touch: animating a focused field while
 * iOS Safari presents the keyboard makes the keyboard glitch or fail to appear. A fine pointer
 * (mouse/trackpad) has no soft keyboard, so it keeps the smooth animation. SSR-safe => non-touch.
 */
export function isCoarsePointer(): boolean {
  return matches("(pointer: coarse)")
}

/** One guarded matchMedia probe: no window (SSR), no matchMedia, or a throwing query => false. */
function matches(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  try {
    return window.matchMedia(query).matches
  } catch {
    return false
  }
}
