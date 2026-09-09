import type { BodyTransitionDirection } from "./BodyTransition.types"

export interface BodyTransitionPlan {
  fromRatio: number
  exitRatio: number
  slide: boolean
  duration: number
  fadeDuration: number
  exitDuration: number
}

export interface BodyTransitionTiming {
  slideDuration: number
  fadeDuration: number
  exitDuration: number
  travelRatio: number
  underRatio: number
  fadeRatio: number
}

export function bodyTransitionPlan(
  direction: BodyTransitionDirection,
  reduceMotion: boolean,
  timing: BodyTransitionTiming,
): BodyTransitionPlan {
  if (direction === "replace" || reduceMotion) {
    return {
      fromRatio: 0,
      exitRatio: 0,
      slide: false,
      duration: timing.fadeDuration,
      fadeDuration: timing.fadeDuration,
      exitDuration: timing.exitDuration,
    }
  }
  const push = direction === "push"
  return {
    fromRatio: push ? timing.travelRatio : -timing.underRatio,
    exitRatio: push ? -timing.underRatio : timing.travelRatio,
    slide: true,
    duration: timing.slideDuration,
    fadeDuration: Math.round(timing.slideDuration * timing.fadeRatio),
    exitDuration: timing.exitDuration,
  }
}

export function translateRatio(ratio: number): string {
  return ratio === 0 ? "translateX(0%)" : `translateX(${Math.round(ratio * 1000) / 10}%)`
}
