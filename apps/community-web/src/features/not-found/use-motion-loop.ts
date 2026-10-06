import * as React from "react"

/**
 * While `live`, runs the `step(dtSeconds)` that `start` returns every animation
 * frame until it returns false, so a stage that has come to rest stops
 * scheduling frames. `start` returning null skips the loop. The first step runs
 * before paint, so the stage never shows its resting layout for a frame before
 * the motion begins.
 */
export function useMotionLoop(live: boolean, start: () => ((dt: number) => boolean) | null): void {
  const startRef = React.useRef(start)
  startRef.current = start

  React.useLayoutEffect(() => {
    if (!live) return
    const step = startRef.current()
    if (!step || !step(0)) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      // Clamped so a backgrounded tab does not resume with one giant step.
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      if (step(dt)) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [live])
}
