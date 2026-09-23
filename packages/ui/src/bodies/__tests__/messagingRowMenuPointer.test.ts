/**
 * The web thread row's "More" chip style callback runs for every row on every hover, focus and press
 * change; the pointer kind cannot change under it, so it is probed once per page load, not per callback.
 * MessagingListBody imports react-native, so this pins the source.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("../MessagingListBody.tsx", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")

describe("the row menu chip reads the pointer kind once", () => {
  it("probes the pointer at module scope and never inside the per-row predicate", () => {
    expect(source.match(/isCoarsePointer\(\)/g)).toHaveLength(1)
    expect(source).toMatch(/^const COARSE_POINTER = IS_WEB && isCoarsePointer\(\)$/m)
    const start = source.indexOf("function rowMenuChipShown(")
    expect(start).toBeGreaterThan(-1)
    const end = source.indexOf("\n}\n", start)
    expect(end).toBeGreaterThan(start)
    const predicate = source.slice(start, end)
    expect(predicate).toContain("COARSE_POINTER")
    expect(predicate).not.toContain("isCoarsePointer(")
  })
})
