import { describe, expect, it } from "vitest"
import { buildRsvpPillLayoutPlan } from "../rsvpPillModel"

describe("RsvpPill layout", () => {
  it.each([
    ["sm", 30],
    ["md", 34],
  ] as const)("keeps the %s visual dense inside a physical 44px target", (size, visualHeight) => {
    expect(buildRsvpPillLayoutPlan(size)).toEqual({
      target: { minWidth: 44, minHeight: 44 },
      visual: { height: visualHeight },
    })
  })
})
