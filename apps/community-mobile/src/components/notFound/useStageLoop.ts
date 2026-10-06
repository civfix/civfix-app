import { useCallback, useEffect, useRef } from "react"
import { runOnJS, useFrameCallback, useSharedValue, type FrameInfo } from "react-native-reanimated"

/** A UI-thread step: advances the stage by `dt` seconds, false once it has come to rest. */
export type StageStep = (dt: number) => boolean

// Clamped so a stalled frame does not resume with one giant step.
const MAX_STEP_S = 1 / 30

/**
 * Runs `step` on the UI thread every frame from the moment it is non-null
 * until it returns false, then unregisters the frame callback, so a stage that
 * has settled schedules no more frames. Unmounting stops it too.
 */
export function useStageLoop(step: StageStep | null): void {
  const settled = useSharedValue(false)
  const loopRef = useRef<{ setActive: (active: boolean) => void } | null>(null)
  const stop = useCallback(() => loopRef.current?.setActive(false), [])

  const onFrame = useCallback(
    (frame: FrameInfo) => {
      "worklet"
      // The stop is applied from the JS thread, so a frame may still arrive after the last step.
      if (!step || settled.value) return
      const dt = Math.min((frame.timeSincePreviousFrame ?? 0) / 1000, MAX_STEP_S)
      if (!step(dt)) {
        settled.value = true
        runOnJS(stop)()
      }
    },
    [step, settled, stop],
  )

  const loop = useFrameCallback(onFrame, false)
  loopRef.current = loop

  useEffect(() => {
    if (!step) return
    loop.setActive(true)
    return () => loop.setActive(false)
  }, [loop, step])
}
