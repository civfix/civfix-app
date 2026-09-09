/**
 * Unit tests for `nextPinIndex` (P3 Task 3.6) - the PinnedBar's cyclic advance: after jumping to
 * the pin at `current`, move to the next OLDER pin (index + 1 in the pinnedAt-DESC list), wrapping
 * back to the newest (0) after the oldest.
 */
import { describe, expect, it } from "vitest"
import { nextPinIndex } from "../pinCycle"

describe("nextPinIndex", () => {
  it("advances toward older pins", () => {
    expect(nextPinIndex(0, 3)).toBe(1)
    expect(nextPinIndex(1, 3)).toBe(2)
  })

  it("wraps to the newest pin after the oldest", () => {
    expect(nextPinIndex(2, 3)).toBe(0)
  })

  it("a single pin always stays at 0", () => {
    expect(nextPinIndex(0, 1)).toBe(0)
  })

  it("no pins parks at 0 (degenerate - the bar is hidden anyway)", () => {
    expect(nextPinIndex(0, 0)).toBe(0)
  })

  it("an out-of-range current (list shrank mid-cycle) still lands in range", () => {
    expect(nextPinIndex(5, 3)).toBe(0)
  })
})
