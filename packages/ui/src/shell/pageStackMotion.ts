import { motion, space } from "../theme"
import type { PageMotionTokens, PageTransitionTiming } from "./pageStackModel"

export const PAGE_TIMING: PageTransitionTiming = {
  pushDuration: motion.pagePush.duration,
  popDuration: motion.pagePop.duration,
  fadeDuration: motion.bodyReplace.duration,
}

export const PAGE_MOTION: PageMotionTokens = {
  travelRatio: motion.pageTravelRatio,
  parallaxRatio: motion.pageParallaxRatio,
  scrimOpacity: motion.pageScrimOpacity,
}

export const PAGE_HEADER_STYLE = {
  flexShrink: 0,
  paddingHorizontal: 14,
  paddingBottom: space["3"],
} as const
