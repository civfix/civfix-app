import { describe, expect, it } from "vitest"
import { excerptOf } from "../quoteStrip"

describe("excerptOf", () => {
  it("collapses every whitespace run to one space and trims the ends", () => {
    expect(excerptOf("  first line\n\nsecond\tline  ")).toBe("first line second line")
  })

  it("leaves an all-whitespace body empty, so callers fall back to their media label", () => {
    expect(excerptOf(" \n\t ")).toBe("")
  })
})
