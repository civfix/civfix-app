import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { EventSlotDTO } from "@civfix/shared"
import {
  parseHoursDraft,
  hoursDraftValid,
  buildHoursEntries,
  plannedEventHours,
  seedHoursDrafts,
  suggestedHoursFor,
  type HoursCleanup,
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

  it("cannot credit the ACTING HOST: the id list is the roster minus the viewer", () => {
    const host = "host-1"
    const roster = [...ids, host]
    const drafts = { a: "2", [host]: "6" }
    expect(buildHoursEntries(roster, drafts, MAX)).toContainEqual({ userId: host, hours: 6 })
    const withoutHost = roster.filter((id) => id !== host)
    expect(buildHoursEntries(withoutHost, drafts, MAX)).toEqual([{ userId: "a", hours: 2 }])

    const editor = readFileSync(new URL("../LogHoursEditor.tsx", import.meta.url), "utf8")
    expect(editor).toContain("roster.filter((a) => a.id !== viewerId)")
    expect(editor).toMatch(/buildHoursEntries\(\s*attendees\.map\(\(a\) => a\.id\),/)
    expect(editor).not.toMatch(/buildHoursEntries\(\s*roster/)
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

const EVENT_START = "2026-06-08T16:00:00.000Z"

function iso(offsetMinutes: number): string {
  return new Date(Date.parse(EVENT_START) + offsetMinutes * 60_000).toISOString()
}

function timedSlot(id: string, startMin: number, endMin: number): EventSlotDTO {
  return {
    id,
    title: `Slot ${id}`,
    claimed: 0,
    sortOrder: 0,
    startsAt: iso(startMin),
    endsAt: iso(endMin),
  }
}

function cleanup(over: Partial<HoursCleanup> = {}): HoursCleanup {
  return {
    scheduledAt: EVENT_START,
    endsAt: iso(240),
    slots: [],
    timezone: "America/Los_Angeles",
    ...over,
  }
}

describe("plannedEventHours", () => {
  it("is the event's own length, to two decimals", () => {
    expect(plannedEventHours(cleanup())).toBe(4)
    expect(plannedEventHours(cleanup({ endsAt: iso(90) }))).toBe(1.5)
    expect(plannedEventHours(cleanup({ endsAt: iso(100) }))).toBe(1.67)
  })

  it("is null for an event with no end, and for an end that is not after the start", () => {
    expect(plannedEventHours(cleanup({ endsAt: null }))).toBeNull()
    expect(plannedEventHours(cleanup({ endsAt: EVENT_START }))).toBeNull()
    expect(plannedEventHours(cleanup({ endsAt: iso(-60) }))).toBeNull()
  })

  it("never suggests more than the ledger accepts", () => {
    expect(plannedEventHours(cleanup({ endsAt: iso(60 * 40) }))).toBe(MAX)
  })
})

describe("suggestedHoursFor", () => {
  const board = [timedSlot("s1", 0, 120), { id: "s2", title: "Grill", claimed: 0, sortOrder: 1 }]

  it("prefers the length of the TIMED slot the person holds, and names it", () => {
    expect(suggestedHoursFor({ slot: { id: "s1" } }, cleanup({ slots: board }))).toEqual({
      hours: 2,
      slotTitle: "Slot s1",
    })
  })

  it("falls back to the event's planned length for an untimed slot or no slot at all", () => {
    expect(suggestedHoursFor({ slot: { id: "s2" } }, cleanup({ slots: board }))).toEqual({
      hours: 4,
      slotTitle: null,
    })
    expect(suggestedHoursFor({ slot: null }, cleanup({ slots: board }))).toEqual({
      hours: 4,
      slotTitle: null,
    })
    expect(suggestedHoursFor({}, cleanup({ slots: board }))).toEqual({ hours: 4, slotTitle: null })
  })

  it("falls back to the planned length when the held slot is not on the board any more", () => {
    expect(suggestedHoursFor({ slot: { id: "gone" } }, cleanup({ slots: board }))).toEqual({
      hours: 4,
      slotTitle: null,
    })
  })

  it("suggests nothing at all for an event with no end and no timed slot", () => {
    expect(suggestedHoursFor({ slot: { id: "s2" } }, cleanup({ endsAt: null, slots: board }))).toBeNull()
    expect(suggestedHoursFor({}, cleanup({ endsAt: null }))).toBeNull()
  })

  it("still names the shift on an event with no end - the slot carries its own window", () => {
    expect(
      suggestedHoursFor({ slot: { id: "s1" } }, cleanup({ endsAt: null, slots: board })),
    ).toEqual({ hours: 2, slotTitle: "Slot s1" })
  })

  it("produces a value the row editor accepts", () => {
    const suggestion = suggestedHoursFor({ slot: { id: "s1" } }, cleanup({ slots: board }))
    expect(hoursDraftValid(formatHours(suggestion?.hours ?? 0), MAX)).toBe(true)
  })
})
