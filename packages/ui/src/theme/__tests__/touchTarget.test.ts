import { describe, expect, it } from "vitest"
import { MIN_TOUCH_TARGET, hitSlopToTarget } from "../touchTarget"

describe("the touch-target floor", () => {
  it("is 44pt", () => {
    expect(MIN_TOUCH_TARGET).toBe(44)
  })

  it("splits the missing height evenly between the two edges", () => {
    expect(hitSlopToTarget(32)).toBe(6)
    expect(hitSlopToTarget(22)).toBe(11)
    expect(hitSlopToTarget(28)).toBe(8)
    expect(hitSlopToTarget(30)).toBe(7)
  })

  it("grows every size back to exactly the floor", () => {
    for (const size of [16, 24, 26, 28, 30, 32, 34, 36, 40]) {
      expect(size + 2 * hitSlopToTarget(size)).toBe(MIN_TOUCH_TARGET)
    }
  })

  it("asks for no slop from a control already at the floor", () => {
    expect(hitSlopToTarget(MIN_TOUCH_TARGET)).toBe(0)
  })
})
