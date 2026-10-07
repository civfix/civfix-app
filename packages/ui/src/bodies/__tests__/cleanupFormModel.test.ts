import { describe, expect, it } from "vitest"
import type { EventSlotDTO } from "@civfix/shared"
import {
  cleanupFormWindow,
  dateChangePatch,
  emptyCleanupForm,
  isCleanupFormComplete,
  startTimeChangePatch,
  timezoneChangePatch,
  type CleanupFormValue,
} from "../cleanupFormModel"
import { formInstantMs } from "../calendarModel"
import type { SlotDraft } from "../eventSlotsForm"

const HOUR = 3_600_000
const ZONE = "America/Los_Angeles"

const DAY = new Date(2030, 5, 1, 12, 0, 0, 0)
const NINE = new Date(2030, 5, 1, 9, 0, 0, 0)
const ELEVEN = new Date(2030, 5, 1, 11, 0, 0, 0)

function slot(over: Partial<SlotDraft> = {}): SlotDraft {
  return {
    key: "k1",
    title: "Sweep",
    description: "",
    capacity: "",
    startsAt: null,
    endsAt: null,
    ...over,
  }
}

function completeForm(over: Partial<CleanupFormValue> = {}): CleanupFormValue {
  return {
    ...emptyCleanupForm(),
    title: "Beach day",
    coords: { lat: 34.01, lng: -118.49 },
    address: "1550 Pacific Coast Hwy, Santa Monica",
    date: DAY,
    time: NINE,
    endTime: ELEVEN,
    timezone: ZONE,
    slots: [slot()],
    ...over,
  }
}

function eventStartMs(value: CleanupFormValue): number {
  if (!value.date || !value.time) throw new Error("no start")
  const start = formInstantMs(value.date, value.time, value.timezone)
  if (start === null) throw new Error("start in a DST gap")
  return start
}

describe("emptyCleanupForm", () => {
  it("starts with one blank slot card, feed sharing on, and the seeds applied", () => {
    const form = emptyCleanupForm("r1", "org1")
    expect(form.slots).toHaveLength(1)
    expect(form.slots[0]).toMatchObject({ title: "", capacity: "", startsAt: null, endsAt: null })
    expect(form.shareToFeed).toBe(true)
    expect(form.linkedReportIds).toEqual(["r1"])
    expect(form.organizationId).toBe("org1")
  })

  it("keeps the uploaded cover id and its preview uri as two separate, empty fields", () => {
    const form = emptyCleanupForm()
    expect(form.coverMediaId).toBeNull()
    expect(form.coverPreviewUrl).toBeNull()
  })
})

describe("isCleanupFormComplete", () => {
  it("accepts a form with every required field and a named slot", () => {
    expect(isCleanupFormComplete(completeForm())).toBe(true)
  })

  it("threads the live claim counts through the submit gate: a capacity below the claims blocks Save", () => {
    const existing: EventSlotDTO[] = [
      { id: "s1", title: "Sweep", claimed: 3, sortOrder: 0, capacity: 5 },
    ]
    const form = completeForm({ slots: [slot({ id: "s1", capacity: "2" })] })
    expect(isCleanupFormComplete(form, existing)).toBe(false)
    expect(isCleanupFormComplete(form)).toBe(true)
  })

  it("checks each slot against the same event window the editor shows", () => {
    const start = eventStartMs(completeForm())
    const inside = slot({ startsAt: new Date(start), endsAt: new Date(start + HOUR) })
    const outside = slot({ startsAt: new Date(start + HOUR), endsAt: new Date(start + 3 * HOUR) })
    expect(cleanupFormWindow(completeForm())?.end?.getTime()).toBe(start + 2 * HOUR)
    expect(isCleanupFormComplete(completeForm({ slots: [inside] }))).toBe(true)
    expect(isCleanupFormComplete(completeForm({ slots: [outside] }))).toBe(false)
  })

  it("refuses a board of blank cards", () => {
    expect(isCleanupFormComplete(completeForm({ slots: [slot({ title: "" })] }))).toBe(false)
  })
})

describe("the schedule handlers carry timed slots with the event", () => {
  const start = eventStartMs(completeForm())
  const timed = slot({ startsAt: new Date(start), endsAt: new Date(start + HOUR) })

  it("moves a timed slot by the same delta when the date moves", () => {
    const form = completeForm({ slots: [timed] })
    const patch = dateChangePatch(form, new Date(2030, 5, 3, 12, 0, 0, 0))
    expect(patch.date?.getDate()).toBe(3)
    expect([patch.time?.getDate(), patch.time?.getHours()]).toEqual([3, 9])
    expect([patch.endTime?.getDate(), patch.endTime?.getHours()]).toEqual([3, 11])
    expect(patch.slots?.[0]?.startsAt?.getTime()).toBe(start + 48 * HOUR)
  })

  it("leaves the slots alone when the start instant does not move", () => {
    const form = completeForm({ slots: [timed] })
    expect(dateChangePatch(form, DAY)).not.toHaveProperty("slots")
  })

  it("keeps the event's length when the start time moves", () => {
    const form = completeForm({ slots: [timed] })
    const patch = startTimeChangePatch(form, new Date(2030, 5, 1, 10, 0, 0, 0))
    expect(patch.endTime?.getHours()).toBe(12)
    expect(patch.slots?.[0]?.startsAt?.getTime()).toBe(start + HOUR)
  })

  it("defaults a first start to the wizard's two-hour window", () => {
    const form = completeForm({ time: null, endTime: null })
    const patch = startTimeChangePatch(form, NINE)
    expect(patch.endTime?.getHours()).toBe(11)
    expect(patch).not.toHaveProperty("slots")
  })

  it("re-reads the wall clock in the new zone and shifts the slots by the offset difference", () => {
    const form = completeForm({ slots: [timed] })
    const patch = timezoneChangePatch(form, "America/New_York")
    expect(patch.timezone).toBe("America/New_York")
    expect(patch.slots?.[0]?.startsAt?.getTime()).toBe(start - 3 * HOUR)
  })
})
