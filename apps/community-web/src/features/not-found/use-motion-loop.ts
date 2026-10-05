import * as React from "react"
import { useReducedMotion } from "@civfix/ui/theme"

/**
 * Runs `step(dtSeconds)` every animation frame while motion is allowed. Reduced
 * motion (or a still-unknown preference) leaves the stage in its resting CSS
 * layout, which is the server-rendered state too.
 */
export function useMotionLoop(start: () => ((dt: number) => void) | null): boolean {
  const reduced = useReducedMotion()
  const startRef = React.useRef(start)
  startRef.current = start
  const animate = reduced === false

  React.useEffect(() => {
    if (!animate) return
    const step = startRef.current()
    if (!step) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      // Clamped so a backgrounded tab does not resume with one giant step.
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      step(dt)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animate])

  return animate
}
