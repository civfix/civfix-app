import { describe, expect, it } from "vitest"
import { EASE_STANDARD_CSS, MOTION } from "../../theme/motion"
import { cssTransition, cssTransitionParts } from "../motionCss"

describe("cssTransition", () => {
  it("emits one clause per property at the recipe's duration and the standard curve", () => {
    expect(cssTransition(["opacity"], MOTION.sheetMove)).toBe(`opacity 240ms ${EASE_STANDARD_CSS}`)
    expect(cssTransition(["height", "left", "right", "border-radius"], MOTION.sheetMove)).toBe(
      [
        `height 240ms ${EASE_STANDARD_CSS}`,
        `left 240ms ${EASE_STANDARD_CSS}`,
        `right 240ms ${EASE_STANDARD_CSS}`,
        `border-radius 240ms ${EASE_STANDARD_CSS}`,
      ].join(", "),
    )
  })
  it("returns an empty string for no properties (a safe `transition` value)", () => {
    expect(cssTransition([], MOTION.sheetMove)).toBe("")
  })
})

describe("cssTransitionParts", () => {
  it("gives each property its OWN duration", () => {
    const fade = Math.round(MOTION.bodyPush.duration * MOTION.bodyFadeRatio)
    expect(fade).toBeLessThan(MOTION.bodyPush.duration)
    expect(
      cssTransitionParts([
        ["transform", MOTION.bodyPush.duration],
        ["opacity", fade],
      ]),
    ).toBe(
      `transform ${MOTION.bodyPush.duration}ms ${EASE_STANDARD_CSS}, opacity ${fade}ms ${EASE_STANDARD_CSS}`,
    )
  })
  it("returns an empty string for no parts", () => {
    expect(cssTransitionParts([])).toBe("")
  })
})

describe("web/native parity constants", () => {
  it("keeps the fixed 24px nudge for the chrome that only OFFSETS (the expanded card hide)", () => {
    expect(MOTION.bodyDistance).toBe(24)
  })

  it("drives the page/body TRANSITIONS off width fractions, identical on both platforms", () => {
    expect(MOTION.pageTravelRatio).toBeGreaterThan(0)
    expect(MOTION.pageTravelRatio).toBeLessThan(1)
    expect(MOTION.pageParallaxRatio).toBeGreaterThan(0)
    expect(MOTION.pageParallaxRatio).toBeLessThan(MOTION.pageTravelRatio)
  })
})
