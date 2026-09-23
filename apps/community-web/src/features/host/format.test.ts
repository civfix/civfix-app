import { describe, expect, it, vi } from "vitest"

vi.mock("@civfix/ui/i18n", () => ({
  useLocale: () => ({ locale: "en" }),
  useViewerTimeZone: () => "UTC",
}))

import { consoleInputZone, isoToZonedInput, zonedFieldPatch, zonedInputToIso } from "./format"

const LA = "America/Los_Angeles"
const OPENS = "2026-09-12T17:00:00.000Z"

describe("console datetime-local inputs in the event's zone", () => {
  it("shows a stored instant as the event's wall clock, not the UTC one", () => {
    expect(isoToZonedInput(OPENS, LA)).toBe("2026-09-12T10:00")
    expect(isoToZonedInput(OPENS, "Asia/Seoul")).toBe("2026-09-13T02:00")
    expect(isoToZonedInput(null, LA)).toBe("")
  })

  it("reads an input back as that zone's instant, so a round trip is exact", () => {
    expect(zonedInputToIso(isoToZonedInput(OPENS, LA), LA)).toEqual({ kind: "instant", iso: OPENS })
    expect(zonedInputToIso("2026-12-01T09:30", LA)).toEqual({
      kind: "instant",
      iso: "2026-12-01T17:30:00.000Z",
    })
    expect(zonedInputToIso("", LA)).toEqual({ kind: "empty" })
  })

  it("refuses a wall clock skipped by a spring-forward change instead of shifting it", () => {
    expect(zonedInputToIso("2026-03-08T02:30", LA)).toEqual({ kind: "invalid" })
    expect(zonedInputToIso("not a date", LA)).toEqual({ kind: "invalid" })
  })

  it("falls back to the viewer's zone for a legacy event with no usable zone", () => {
    expect(consoleInputZone(LA, "Europe/Berlin")).toBe(LA)
    expect(consoleInputZone(null, "Europe/Berlin")).toBe("Europe/Berlin")
    expect(consoleInputZone("Mars/Olympus", "Europe/Berlin")).toBe("Europe/Berlin")
  })
})

describe("zonedFieldPatch", () => {
  const saved = { opensAt: isoToZonedInput(OPENS, LA), closesAt: "" }

  it("sends nothing for an untouched window, so saving another setting cannot move it", () => {
    expect(zonedFieldPatch(saved, saved, LA)).toEqual({ patch: {}, invalid: [] })
  })

  it("sends only the edited bound, converted in the event's zone", () => {
    const current = { opensAt: saved.opensAt, closesAt: "2026-09-20T18:00" }
    expect(zonedFieldPatch(saved, current, LA)).toEqual({
      patch: { closesAt: "2026-09-21T01:00:00.000Z" },
      invalid: [],
    })
  })

  it("sends every set field when there is no saved value to compare with", () => {
    expect(zonedFieldPatch(null, saved, LA)).toEqual({
      patch: { opensAt: OPENS, closesAt: null },
      invalid: [],
    })
  })

  it("clears a bound the host emptied and flags one that does not exist in the zone", () => {
    const current = { opensAt: "", closesAt: "2026-03-08T02:15" }
    expect(zonedFieldPatch(saved, current, LA)).toEqual({
      patch: { opensAt: null },
      invalid: ["closesAt"],
    })
  })
})
