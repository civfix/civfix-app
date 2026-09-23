/**
 * The <BodyTransition> `direction` from the nav stack length across renders. `push` appends and `back`
 * pops in both modes, so length is the reliable push/pop signal; `openDetail` replaces the stack with one
 * entry, so pin-after-pin browsing keeps length 1 and cross-fades as a "replace".
 */
import { useLayoutEffect, useRef } from "react"
import type { BodyTransitionDirection } from "./BodyTransition.types"

export function directionForStackLengths(prevLen: number, nextLen: number): BodyTransitionDirection {
  if (nextLen > prevLen) return "push"
  if (nextLen < prevLen) return "pop"
  return "replace"
}

/**
 * Only meaningful on the render where the transitionKey changed. The previous length advances in a layout
 * effect, never in render: React may render more than once per commit (StrictMode) or discard a render
 * (concurrent interruption), and advancing the ref there would make the committing pass compare the
 * length against itself and report "replace" for every navigation. Layout rather than passive, so it
 * lands before any subsequent render can read the ref.
 */
export function useStackDirection(stackLength: number): BodyTransitionDirection {
  const prevLenRef = useRef(stackLength)
  const direction = directionForStackLengths(prevLenRef.current, stackLength)
  useLayoutEffect(() => {
    prevLenRef.current = stackLength
  }, [stackLength])
  return direction
}
