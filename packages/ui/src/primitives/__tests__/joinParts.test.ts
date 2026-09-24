import { describe, expect, it } from "vitest"
import { joinParts, META_SEPARATOR } from "../joinParts"

describe("joinParts", () => {
  it("joins the present parts with the meta separator by default", () => {
    expect(META_SEPARATOR).toBe(" · ")
    expect(joinParts(["General", null, "2 seats"])).toBe("General · 2 seats")
  })

  it("drops only null, so an empty string still takes a slot", () => {
    expect(joinParts(["a", "", "b"])).toBe("a ·  · b")
  })

  it("returns an empty string when nothing is present", () => {
    expect(joinParts([null, null])).toBe("")
    expect(joinParts([])).toBe("")
  })

  it("takes another separator", () => {
    expect(joinParts(["Open", null, "3 waiting"], ". ")).toBe("Open. 3 waiting")
  })
})
