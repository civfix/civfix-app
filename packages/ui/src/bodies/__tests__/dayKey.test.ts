/**
 * `dayKey` documents itself as a "YYYY-MM-DD" key; it used to emit an unpadded, 0-based month
 * ("2026-6-24" for July 24) which sorted and parsed a month off. It is still a LOCAL calendar day.
 */
import { describe, expect, it } from "vitest"
import { dayKey } from "../relativeTime"

function localIso(year: number, monthIndex: number, day: number, hour = 12): string {
  return new Date(year, monthIndex, day, hour).toISOString()
}

describe("dayKey", () => {
  it("emits a real padded, 1-based ISO day", () => {
    expect(dayKey(localIso(2026, 6, 24))).toBe("2026-07-24")
    expect(dayKey(localIso(2026, 0, 5))).toBe("2026-01-05")
    expect(dayKey(localIso(2026, 11, 31))).toBe("2026-12-31")
  })

  it("sorts lexicographically in calendar order", () => {
    const keys = [localIso(2026, 9, 1), localIso(2026, 0, 9), localIso(2026, 1, 20)].map(dayKey)
    expect([...keys].sort()).toEqual(["2026-01-09", "2026-02-20", "2026-10-01"])
  })

  it("still groups the same local day together, and returns '' for an unparseable date", () => {
    expect(dayKey(localIso(2026, 6, 24, 1))).toBe(dayKey(localIso(2026, 6, 24, 23)))
    expect(dayKey("not-a-date")).toBe("")
  })
})
