import { describe, expect, it } from "vitest"
import {
  parseHoursDraft,
  hoursDraftValid,
  buildHoursEntries,
  seedHoursDrafts,
} from "../hoursEntries"
import { formatHours } from "../formatHours"

const MAX = 24

describe("parseHoursDraft", () => {
  it("parses plain and decimal hours", () => {
    expect(parseHoursDraft("2")).toBe(2)
    expect(parseHoursDraft(" 2.5 ")).toBe(2.5)
  })

  it("accepts a decimal comma - what es/de type, and what formatHoursDisplay prints back at them", () => {
    expect(parseHoursDraft("2,5")).toBe(2.5)
    expect(parseHoursDraft(" 0,5 ")).toBe(0.5)
    expect(hoursDraftValid("2,5", MAX)).toBe(true)
    expect(buildHoursEntries(["a"], { a: "2,5" }, MAX)).toEqual([{ userId: "a", hours: 2.5 }])
  })

  it("rejects a draft carrying BOTH separators rather than guessing which one is decimal", () => {
    expect(parseHoursDraft("1.234,5")).toBeNull()
    expect(parseHoursDraft("1,234.5")).toBeNull()
    expect(hoursDraftValid("1.234,5", MAX)).toBe(false)
  })

  it("rejects more than one comma", () => {
    expect(parseHoursDraft("1,2,3")).toBeNull()
  })

  it("returns null for empty or unparseable drafts", () => {
    expect(parseHoursDraft("")).toBeNull()
    expect(parseHoursDraft("   ")).toBeNull()
    expect(parseHoursDraft("abc")).toBeNull()
    expect(parseHoursDraft("-")).toBeNull()
    expect(parseHoursDraft("Infinity")).toBeNull()
  })
})

describe("hoursDraftValid", () => {
  it("treats an empty draft as valid (the row is simply excluded)", () => {
    expect(hoursDraftValid("", MAX)).toBe(true)
    expect(hoursDraftValid("  ", MAX)).toBe(true)
  })

  it("accepts 0 < hours <= max", () => {
    expect(hoursDraftValid("0.5", MAX)).toBe(true)
    expect(hoursDraftValid("24", MAX)).toBe(true)
  })

  it("rejects zero, negative, over-max, and unparseable drafts", () => {
    expect(hoursDraftValid("0", MAX)).toBe(false)
    expect(hoursDraftValid("-1", MAX)).toBe(false)
    expect(hoursDraftValid("24.5", MAX)).toBe(false)
    expect(hoursDraftValid("abc", MAX)).toBe(false)
  })
})

describe("buildHoursEntries", () => {
  const ids = ["a", "b", "c"]

  it("builds entries for the non-empty rows, in attendee order", () => {
    expect(buildHoursEntries(ids, { a: "2", c: "1.5" }, MAX)).toEqual([
      { userId: "a", hours: 2 },
      { userId: "c", hours: 1.5 },
    ])
  })

  it("ignores drafts for users no longer on the roster", () => {
    expect(buildHoursEntries(["a"], { a: "2", gone: "3" }, MAX)).toEqual([
      { userId: "a", hours: 2 },
    ])
  })

  it("returns null when any non-empty row is invalid", () => {
    expect(buildHoursEntries(ids, { a: "2", b: "0" }, MAX)).toBeNull()
    expect(buildHoursEntries(ids, { a: "2", b: "25" }, MAX)).toBeNull()
    expect(buildHoursEntries(ids, { a: "2", b: "x" }, MAX)).toBeNull()
  })

  it("returns null when no row is credited (entries.min(1))", () => {
    expect(buildHoursEntries(ids, {}, MAX)).toBeNull()
    expect(buildHoursEntries(ids, { a: "", b: "  " }, MAX)).toBeNull()
  })
})

describe("formatHours", () => {
  it("always prints one decimal, rounded on the tenth", () => {
    expect(formatHours(2)).toBe("2.0")
    expect(formatHours(2.46)).toBe("2.5")
    expect(formatHours(0)).toBe("0.0")
  })
})

describe("seedHoursDrafts", () => {
  const ids = ["a", "b", "c"]

  it("produces the same 1-decimal strings formatHours does, keyed by user", () => {
    expect(seedHoursDrafts([{ userId: "a", hours: 2 }, { userId: "b", hours: 1.25 }])).toEqual({
      a: "2.0",
      b: "1.3",
    })
  })

  it("leaves an attendee with no logged row absent (the editor's blank state)", () => {
    expect(seedHoursDrafts([])).toEqual({})
    expect(Object.keys(seedHoursDrafts([{ userId: "a", hours: 2 }]))).toEqual(["a"])
  })

  it("round-trips through buildHoursEntries unchanged", () => {
    const logged = [
      { userId: "a", hours: 2 },
      { userId: "c", hours: 1.5 },
    ]
    expect(buildHoursEntries(ids, seedHoursDrafts(logged), MAX)).toEqual(logged)
  })
})

describe("editing rows that arrived already credited", () => {
  const ids = ["a", "b"]

  it("submits a LOWER number typed over a seeded row", () => {
    const drafts = { ...seedHoursDrafts([{ userId: "a", hours: 4 }]), a: "1" }
    expect(buildHoursEntries(ids, drafts, MAX)).toEqual([{ userId: "a", hours: 1 }])
  })

  it("submits a lower number even when it is a fraction of the credited value", () => {
    const drafts = { ...seedHoursDrafts([{ userId: "a", hours: 8 }]), a: "0.5" }
    expect(buildHoursEntries(ids, drafts, MAX)).toEqual([{ userId: "a", hours: 0.5 }])
  })

  it("still SKIPS a cleared row - clearing is not a removal, and never becomes hours: 0", () => {
    const seeded = seedHoursDrafts([
      { userId: "a", hours: 4 },
      { userId: "b", hours: 2 },
    ])
    const entries = buildHoursEntries(ids, { ...seeded, a: "" }, MAX)
    expect(entries).toEqual([{ userId: "b", hours: 2 }])
    expect(entries?.some((entry) => entry.userId === "a")).toBe(false)
  })

  it("cannot submit a batch that clears every credited row (entries.min(1))", () => {
    const seeded = seedHoursDrafts([{ userId: "a", hours: 4 }])
    expect(buildHoursEntries(ids, { ...seeded, a: "  " }, MAX)).toBeNull()
  })

  it("rejects an explicit 0 rather than sending a floor-violating entry", () => {
    const drafts = { ...seedHoursDrafts([{ userId: "a", hours: 4 }]), a: "0" }
    expect(hoursDraftValid("0", MAX)).toBe(false)
    expect(buildHoursEntries(ids, drafts, MAX)).toBeNull()
  })

  it("never credits a userId that is not in the shown roster (the viewer is filtered out upstream)", () => {
    const drafts = { a: "2", viewer: "3" }
    expect(buildHoursEntries(["a"], drafts, MAX)).toEqual([{ userId: "a", hours: 2 }])
  })
})
