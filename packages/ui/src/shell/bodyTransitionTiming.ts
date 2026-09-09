import { theme } from "../theme"
import type { BodyTransitionTiming } from "./bodyTransitionModel"

export const BODY_TIMING: BodyTransitionTiming = {
  slideDuration: theme.motion.bodyPush.duration,
  fadeDuration: theme.motion.bodyReplace.duration,
  exitDuration: theme.motion.bodyExit.duration,
  travelRatio: theme.motion.pageTravelRatio,
  underRatio: theme.motion.pageParallaxRatio,
  fadeRatio: theme.motion.bodyFadeRatio,
}
