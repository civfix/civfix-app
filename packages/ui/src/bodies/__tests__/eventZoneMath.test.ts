process.env.TZ = "UTC"

import { readFileSync } from "node:fs"
import type { TFunction } from "i18next"
import type { LinkedEventRef } from "@civfix/shared"
import { describe, expect, it } from "vitest"
import { durationChipFor, eventDurationMs } from "../calendarModel"
import { slotsAfterZoneChange } from "../eventWizard"
import type { SlotDraft } from "../eventSlotsForm"
import { buildLinkedEventCardModel } from "../linkedEventCardModel"

// Every assertion here compares an EVENT zone against a device zone pinned to UTC above, so a device
// clock can never make the zone-blind code pass by accident.

const code = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const HOUR = 3_600_000

function timedSlot(key: string, startIso: string, endIso: string): SlotDraft {
  return {
    key,
    title: key,
    description: "",
    capacity: "",
    startsAt: new Date(startIso),
    endsAt: new Date(endIso),
  }
}

describe("changing the event's time zone carries the timed slots with the window", () => {
  const day = new Date(2026, 6, 24)
  const nineAm = new Date(2026, 6, 24, 9, 0)
  const untimed: SlotDraft = {
    key: "any",
    title: "Any time",
    description: "",
    capacity: "",
    startsAt: null,
    endsAt: null,
  }

  it("moves a 9-11 LA shift to 9-11 New York when the event moves from LA to New York", () => {
    const slots = [timedSlot("a", "2026-07-24T16:00:00.000Z", "2026-07-24T18:00:00.000Z"), untimed]
    const moved = slotsAfterZoneChange(slots, day, nineAm, "America/Los_Angeles", "America/New_York")
    expect(moved[0]?.startsAt?.toISOString()).toBe("2026-07-24T13:00:00.000Z")
    expect(moved[0]?.endsAt?.toISOString()).toBe("2026-07-24T15:00:00.000Z")
    expect(moved[1]).toBe(untimed)
  })

  it("leaves the slots alone without a start, on the same zone, or when the start falls in a DST gap", () => {
    const slots = [timedSlot("a", "2026-03-08T10:00:00.000Z", "2026-03-08T11:00:00.000Z")]
    expect(slotsAfterZoneChange(slots, null, nineAm, "America/Los_Angeles", "UTC")).toBe(slots)
    expect(slotsAfterZoneChange(slots, day, nineAm, "UTC", "UTC")).toBe(slots)
    const gapDay = new Date(2026, 2, 8)
    const inGap = new Date(2026, 2, 8, 2, 30)
    expect(slotsAfterZoneChange(slots, gapDay, inGap, "UTC", "America/Los_Angeles")).toBe(slots)
  })

  it("is what the form's zone picker calls", () => {
    const form = code("../CleanupForm.tsx")
    expect(form).toContain("<TimezoneField value={value.timezone} onChange={onChangeTimezone} />")
    expect(form).toContain(
      "slots: slotsAfterZoneChange(value.slots, value.date, value.time, value.timezone, timezone)",
    )
  })
})

describe("the duration chip measures the window in the EVENT's zone", () => {
  it("reads the Berlin spring-forward night as one real hour, not the device's two", () => {
    const day = new Date(2026, 2, 29)
    const start = new Date(2026, 2, 29, 1, 30)
    const end = new Date(2026, 2, 29, 3, 30)
    expect(eventDurationMs(day, start, end, "Europe/Berlin")).toBe(1 * HOUR)
    expect(durationChipFor(day, start, end, "Europe/Berlin")).toBe(1)
    expect(durationChipFor(day, start, end)).toBe(2)
  })

  it("lights nothing when the start does not exist in the event's zone", () => {
    const day = new Date(2026, 2, 8)
    const inGap = new Date(2026, 2, 8, 2, 30)
    const end = new Date(2026, 2, 8, 4, 30)
    expect(durationChipFor(day, inGap, end, "America/Los_Angeles")).toBeNull()
  })

  it("is fed the event's zone by the picker", () => {
    expect(code("../DateTimeFieldRow.tsx")).toContain(
      "durationChipFor(date, time, endTime, timeZone)",
    )
  })
})

describe("an attached-event card with a malformed zone", () => {
  const t = ((key: string) => key) as unknown as TFunction
  const event = {
    id: "e1",
    title: "Park cleanup",
    eventKind: "cleanup",
    status: "upcoming",
    scheduledAt: "2026-09-16T12:00:00.000Z",
    lat: 0,
    lng: 0,
    going: 3,
    organizer: { id: "u1", name: "Ana", handle: null, avatar: null, avatarUrl: null },
    linkedAt: "2026-09-01T00:00:00.000Z",
  } as unknown as LinkedEventRef

  it("keeps the viewer's language and only drops the zone", () => {
    const model = buildLinkedEventCardModel(event, t, "ko-KR", "Not/A_Zone")
    const month = new Intl.DateTimeFormat("ko-KR", { month: "short" })
      .format(new Date(event.scheduledAt))
      .toUpperCase()
    expect(model.month).toBe(month)
    expect(model.month).not.toBe("SEP")
  })
})
