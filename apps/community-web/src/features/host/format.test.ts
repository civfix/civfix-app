import { describe, expect, it, vi } from "vitest"

vi.mock("@civfix/ui/i18n", () => ({
  useLocale: () => ({ locale: "en" }),
  useViewerTimeZone: () => "UTC",
}))

import { datetimeLocalFromIso } from "@civfix/shared/datetime"

import {
  consoleInputZone,
  inputZoneHintName,
  zoneGenericName,
  zonedFieldPatch,
} from "./format"

const LA = "America/Los_Angeles"
const OPENS = "2026-09-12T17:00:00.000Z"

describe("the zone a console datetime-local input is read in", () => {
  it("falls back to the viewer's zone for a legacy event with no usable zone", () => {
    expect(consoleInputZone(LA, "Europe/Berlin")).toBe(LA)
    expect(consoleInputZone(null, "Europe/Berlin")).toBe("Europe/Berlin")
    expect(consoleInputZone("Mars/Olympus", "Europe/Berlin")).toBe("Europe/Berlin")
  })
})

describe("zonedFieldPatch", () => {
  const saved = { opensAt: datetimeLocalFromIso(OPENS, LA), closesAt: "" }

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

describe("naming the zone a console time input is read in", () => {
  const SUMMER = Date.parse("2026-07-01T12:00:00.000Z")
  const WINTER = Date.parse("2026-12-01T12:00:00.000Z")

  it("uses the zone's generic name, which holds on both sides of a DST change", () => {
    expect(zoneGenericName(LA, "en")).toBe("Pacific Time")
    expect(zoneGenericName(LA, "de")).not.toMatch(/PDT|PST/)
  })

  it("names the zone when the viewer reads any relevant instant at another offset", () => {
    expect(inputZoneHintName(LA, "America/Phoenix", [SUMMER], "en")).toBeNull()
    expect(inputZoneHintName(LA, "America/Phoenix", [SUMMER, WINTER], "en")).toBe("Pacific Time")
    expect(inputZoneHintName(LA, "America/New_York", [WINTER], "en")).toBe("Pacific Time")
    expect(inputZoneHintName(LA, LA, [SUMMER, WINTER], "en")).toBeNull()
  })
})
