import { useEffect, useState } from "react"
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
  type WithTimingConfig,
} from "react-native-reanimated"
import { motion } from "@/theme"

const STAGE_HOLD_MS = 2000
export const STAGE_STAGGER_MS = motion.gravityStagger
export const STAGE_DROP_PX = motion.gravityDrop
export const STAGE_RISE_PX = motion.fadeUp.distance

export const GRAVITY_EASE = Easing.bezierFn(...motion.gravity.easing)
export const STANDARD_EASE = Easing.bezierFn(...motion.easing)

const SWEEP_EASE = Easing.linear
const RESET_CONFIG: WithTimingConfig = { duration: 0, easing: SWEEP_EASE }

function sweepConfig(totalMs: number): WithTimingConfig {
  return { duration: totalMs, easing: SWEEP_EASE }
}

export function stageWindow(
  totalMs: number,
  startMs: number,
  endMs: number,
): readonly [number, number] {
  return [startMs / totalMs, endMs / totalMs]
}

export function stageStops(totalMs: number, ...atMs: readonly number[]): number[] {
  return atMs.map((ms) => ms / totalMs)
}

export function segment(progress: number, from: number, to: number): number {
  "worklet"
  if (to <= from) return progress >= to ? 1 : 0
  const t = (progress - from) / (to - from)
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t
}

function stageStepFor(progress: number, stops: readonly number[]): number {
  "worklet"
  let step = 0
  for (let i = 0; i < stops.length; i += 1) {
    if (progress >= stops[i]) step = i + 1
  }
  return step
}

export function useStageTimeline(
  active: boolean,
  reduceMotion: boolean,
  totalMs: number,
): SharedValue<number> {
  const progress = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress)
      progress.value = 1
      return
    }
    if (!active) {
      cancelAnimation(progress)
      progress.value = 0
      return
    }
    progress.value = 0
    progress.value = withRepeat(
      withSequence(
        withTiming(1, sweepConfig(totalMs)),
        withDelay(STAGE_HOLD_MS, withTiming(0, RESET_CONFIG)),
      ),
      -1,
    )
    return () => cancelAnimation(progress)
  }, [active, reduceMotion, totalMs, progress])

  return progress
}

export function useStageStep(progress: SharedValue<number>, stops: readonly number[]): number {
  const [step, setStep] = useState(() => stageStepFor(progress.value, stops))
  const settled = useSharedValue(step)

  useAnimatedReaction(
    () => stageStepFor(progress.value, stops),
    (next) => {
      if (next === settled.value) return
      settled.value = next
      runOnJS(setStep)(next)
    },
    [stops],
  )

  return step
}
