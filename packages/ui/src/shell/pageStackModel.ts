import { clamp01 } from "../math/clamp"
import type { DetailLeadingAffordance } from "./backAffordance"

export interface PageLayerStyle {
  translateX: number
  opacity: number
  scrimOpacity: number
}

export interface PageMotionTokens {
  travelRatio: number
  parallaxRatio: number
  scrimOpacity: number
}

export interface PageLayerTokens extends PageMotionTokens {
  fadeStrength: number
}

export function pageLayerTokens(
  motion: PageMotionTokens,
  reduceMotion: boolean,
  dragging: boolean,
): PageLayerTokens {
  if (reduceMotion) {
    return {
      travelRatio: dragging ? 1 : 0,
      parallaxRatio: 0,
      scrimOpacity: motion.scrimOpacity,
      fadeStrength: 0,
    }
  }
  if (dragging) {
    return {
      travelRatio: 1,
      parallaxRatio: motion.parallaxRatio,
      scrimOpacity: motion.scrimOpacity,
      fadeStrength: 0,
    }
  }
  return { ...motion, fadeStrength: 1 }
}

export function pageLayerStyle(
  ownProgress: number,
  aboveProgress: number,
  width: number,
  tokens: PageLayerTokens,
): PageLayerStyle {
  "worklet"
  const own = clamp01(ownProgress)
  const above = clamp01(aboveProgress)
  return {
    translateX: own * width * tokens.travelRatio + (above - 1) * width * tokens.parallaxRatio,
    opacity: 1 - own * tokens.fadeStrength,
    scrimOpacity: (1 - above) * tokens.scrimOpacity,
  }
}

export interface SwipeBackTokens {
  completeFraction: number
  completeVelocity: number
}

export type SwipeBackDecision = "complete" | "cancel"

export function swipeBackDecision(
  translationX: number,
  velocityX: number,
  width: number,
  tokens: SwipeBackTokens,
): SwipeBackDecision {
  "worklet"
  if (width <= 0) return "cancel"
  if (velocityX <= -tokens.completeVelocity) return "cancel"
  if (velocityX >= tokens.completeVelocity) return "complete"
  return translationX >= width * tokens.completeFraction ? "complete" : "cancel"
}

export type PageStackDirection = "push" | "pop" | "replace"

export interface PageTransitionTiming {
  pushDuration: number
  popDuration: number
  fadeDuration: number
}

export interface PageTransitionPlan {
  slide: boolean
  retainLeaving: boolean
  fromFront: number
  duration: number
  fadeDuration: number
}

export function pageTransitionPlan(
  direction: PageStackDirection,
  reduceMotion: boolean,
  timing: PageTransitionTiming,
): PageTransitionPlan {
  if (reduceMotion || direction === "replace") {
    return {
      slide: false,
      retainLeaving: false,
      fromFront: 0,
      duration: 0,
      fadeDuration: timing.fadeDuration,
    }
  }
  if (direction === "push") {
    return {
      slide: true,
      retainLeaving: false,
      fromFront: 1,
      duration: timing.pushDuration,
      fadeDuration: 0,
    }
  }
  return {
    slide: true,
    retainLeaving: true,
    fromFront: 0,
    duration: timing.popDuration,
    fadeDuration: 0,
  }
}

export interface SwipeBackArming {
  layerCount: number
  leading: DetailLeadingAffordance
  interactive: boolean
  platformIsIOS: boolean
  discardsFlow: boolean
  nestedInNativeStack?: boolean
}

export function canSwipeBack({
  layerCount,
  leading,
  interactive,
  platformIsIOS,
  discardsFlow,
  nestedInNativeStack = false,
}: SwipeBackArming): boolean {
  if (!platformIsIOS) return false
  if (!interactive) return false
  if (layerCount < 1) return false
  if (nestedInNativeStack && layerCount < 2) return false
  if (discardsFlow) return false
  return leading === "back"
}

export type PageLayerPointerEvents = "auto" | "none" | "box-only"

export function pageLayerPointerEvents(input: {
  active: boolean
  isLeaving: boolean
  hasLeaving: boolean
}): PageLayerPointerEvents {
  if (input.isLeaving) return "box-only"
  if (!input.active) return "none"
  return input.hasLeaving ? "none" : "auto"
}

export function backPressDecision(
  nowMs: number,
  lastAcceptedMs: number | null,
  popDurationMs: number,
): "accept" | "ignore" {
  if (lastAcceptedMs !== null && nowMs - lastAcceptedMs < popDurationMs) return "ignore"
  return "accept"
}
