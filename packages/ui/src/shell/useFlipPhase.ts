import { useLayoutEffect, useRef, type TransitionEvent } from "react"

export type LayerTransitionEndEvent = Pick<
  TransitionEvent<Element>,
  "target" | "currentTarget" | "propertyName"
>

/**
 * Reads layout from the first target that has any, so the browser commits the start frame before the
 * flip swaps in the end styles; without it the CSS transition would never see a change and snap.
 */
export function forceReflow(targets: readonly unknown[], documentFallback: boolean): void {
  for (const target of targets) {
    if (typeof (target as { offsetHeight?: unknown } | null | undefined)?.offsetHeight === "number") return
  }
  if (documentFallback && typeof document !== "undefined") void document.documentElement.offsetHeight
}

export interface FlipPhase {
  /** The navigation still painting its start frame, or null once flipped or idle. */
  pendingNav: number | null
  /** The navigation in flight, flipped or not, or null when idle. */
  phaseNav: number | null
  fallbackMs: number
  reflow: () => void
  flip: (nav: number) => void
  settle: (nav: number) => void
}

export function useFlipPhase({ pendingNav, phaseNav, fallbackMs, reflow, flip, settle }: FlipPhase): void {
  const handlersRef = useRef({ reflow, flip, settle })
  useLayoutEffect(() => {
    handlersRef.current = { reflow, flip, settle }
  })

  useLayoutEffect(() => {
    if (pendingNav === null) return
    handlersRef.current.reflow()
    handlersRef.current.flip(pendingNav)
  }, [pendingNav])

  // Keyed on the phase, not the flip: the flip must not clear the fallback armed for the same phase.
  useLayoutEffect(() => {
    if (phaseNav === null) return
    const fallback = setTimeout(() => handlersRef.current.settle(phaseNav), fallbackMs)
    return () => clearTimeout(fallback)
  }, [fallbackMs, phaseNav])
}
