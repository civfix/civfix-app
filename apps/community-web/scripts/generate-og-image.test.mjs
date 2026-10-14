import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("./generate-og-image.mjs", import.meta.url), "utf8")

describe("generate-og-image", () => {
  it("never calls process.exit inside the render loop, whose finally removes the temp dir", () => {
    const start = source.indexOf("\ntry {")
    const end = source.indexOf("} finally {", start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(source.slice(start, end)).not.toContain("process.exit(")
  })
})
