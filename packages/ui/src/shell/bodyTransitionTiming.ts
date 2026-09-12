import { motion } from "../theme"
import type { BodyTransitionTiming } from "./bodyTransitionModel"

export const BODY_TIMING: BodyTransitionTiming = {
  slideDuration: motion.bodyPush.duration,
  fadeDuration: motion.bodyReplace.duration,
  exitDuration: motion.bodyExit.duration,
  travelRatio: motion.pageTravelRatio,
  underRatio: motion.pageParallaxRatio,
  fadeRatio: motion.bodyFadeRatio,
}
