import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_WIZARD_DURATION_MS,
  EVENT_WIZARD_STEPS,
  eventStepIndex,
  eventStepSatisfied,
  firstIncompleteEventStep,
  isFinalEventStep,
  nextEventStep,
  prevEventStep,
  eventWindowUntouched,
  mustPersistEventEnd,
  seededEndTime,
  type EventWizardDraft,
} from "../eventWizard"
import type { SlotDraft } from "../eventSlotsForm"
import {
  DURATION_CHIP_HOURS,
  endTimeAfter,
  endTimeSelectable,
  eventWindowInZone,
  eventWindowOf,
} from "../calendarModel"

const NOW = new Date("2026-06-01T12:00:00.000Z")
const FUTURE_DAY = new Date("2026-06-08T00:00:00.000Z")
const FUTURE_TIME = new Date("2026-06-08T17:30:00.000Z")
const FUTURE_END = new Date("2026-06-08T19:30:00.000Z")
const PAST_DAY = new Date("2026-05-01T00:00:00.000Z")
const PAST_TIME = new Date("2026-05-01T09:00:00.000Z")
const DEVICE_ZONE = "America/Los_Angeles"

const slot = (over: Partial<SlotDraft> = {}): SlotDraft => ({
  key: "slot-1",
  title: "Rake crew",
  description: "",
  capacity: "4",
  startsAt: null,
  endsAt: null,
  ...over,
})

function draft(over: Partial<EventWizardDraft> = {}): EventWizardDraft {
  return {
    title: "Riverside cleanup",
    date: FUTURE_DAY,
    time: FUTURE_TIME,
    endTime: FUTURE_END,
    timezone: DEVICE_ZONE,
    coords: { lat: 34.05, lng: -118.24 },
    slots: [],
    ...over,
  }
}

describe("the wizard's default event length", () => {
  it("is two hours, which is what a blank `when` step prefills", () => {
    expect(DEFAULT_WIZARD_DURATION_MS).toBe(2 * 3_600_000)
  })
})

describe("the event wizard's step plan", () => {
  it("runs basics -> when -> where -> details -> review, with review last", () => {
    expect(EVENT_WIZARD_STEPS).toEqual(["basics", "when", "where", "details", "review"])
    expect(EVENT_WIZARD_STEPS.filter(isFinalEventStep)).toEqual(["review"])
    expect(eventStepIndex("where")).toBe(2)
  })

  it("walks forward and back without falling off either end", () => {
    expect(nextEventStep("basics")).toBe("when")
    expect(nextEventStep("review")).toBeNull()
    expect(prevEventStep("when")).toBe("basics")
    expect(prevEventStep("basics")).toBeNull()
  })
})

describe("per-step gating", () => {
  it("basics needs a non-blank title", () => {
    expect(eventStepSatisfied("basics", draft({ title: "   " }), NOW)).toBe(false)
    expect(eventStepSatisfied("basics", draft(), NOW)).toBe(true)
  })

  it("when needs a date, a time, and a schedule that is not in the past", () => {
    expect(eventStepSatisfied("when", draft({ date: null }), NOW)).toBe(false)
    expect(eventStepSatisfied("when", draft({ time: null }), NOW)).toBe(false)
    expect(eventStepSatisfied("when", draft({ date: PAST_DAY, time: PAST_TIME }), NOW)).toBe(false)
    expect(eventStepSatisfied("when", draft(), NOW)).toBe(true)
  })

  it("when REQUIRES an end time, and one that is at least the slot minimum after the start", () => {
    expect(eventStepSatisfied("when", draft({ endTime: null }), NOW)).toBe(false)
    const start = draft().time as Date
    expect(eventStepSatisfied("when", draft({ endTime: start }), NOW)).toBe(false)
    expect(
      eventStepSatisfied("when", draft({ endTime: new Date(start.getTime() + 14 * 60_000) }), NOW),
    ).toBe(false)
    expect(
      eventStepSatisfied("when", draft({ endTime: new Date(start.getTime() + 15 * 60_000) }), NOW),
    ).toBe(true)
  })

  it("when is satisfiable on a 23:30 start, whose end can only be the next day", () => {
    const lateDay = new Date(FUTURE_DAY)
    const lateStart = new Date(FUTURE_DAY)
    lateStart.setHours(23, 30, 0, 0)
    for (const hours of DURATION_CHIP_HOURS) {
      const endTime = endTimeAfter(lateDay, lateStart, hours * 3_600_000)
      const late = draft({ date: lateDay, time: lateStart, endTime })
      expect(eventStepSatisfied("when", late, NOW)).toBe(true)
      const window = eventWindowInZone(lateDay, lateStart, endTime, DEVICE_ZONE)
      expect((window?.end?.getTime() ?? 0) - (window?.start.getTime() ?? 0)).toBe(hours * 3_600_000)
    }
  })

  it("keeps `details` honest about a shift inside an overnight event", () => {
    const lateDay = new Date(FUTURE_DAY)
    const lateStart = new Date(FUTURE_DAY)
    lateStart.setHours(22, 0, 0, 0)
    const endTime = endTimeAfter(lateDay, lateStart, 4 * 3_600_000)
    const window = eventWindowInZone(lateDay, lateStart, endTime, DEVICE_ZONE)
    const start = window?.start as Date
    const afterMidnight = slot({
      startsAt: new Date(start.getTime() + 2 * 3_600_000),
      endsAt: new Date(start.getTime() + 3 * 3_600_000),
    })
    const past = slot({
      startsAt: new Date(start.getTime() + 3 * 3_600_000),
      endsAt: new Date(start.getTime() + 5 * 3_600_000),
    })
    const late = (slots: SlotDraft[]) =>
      draft({ date: lateDay, time: lateStart, endTime, slots })
    expect(eventStepSatisfied("details", late([afterMidnight]), NOW)).toBe(true)
    expect(eventStepSatisfied("details", late([past]), NOW)).toBe(false)
  })

  it("reads slot windows against the EVENT zone, not the device's", () => {
    const day = new Date(2026, 8, 5, 12, 0, 0, 0)
    const onePm = new Date(2026, 0, 1, 13, 0, 0, 0)
    const fourPm = new Date(2026, 0, 1, 16, 0, 0, 0)
    const utcWindow = eventWindowInZone(day, onePm, fourPm, "UTC")
    const laWindow = eventWindowInZone(day, onePm, fourPm, "America/Los_Angeles")
    expect((laWindow?.start.getTime() ?? 0) - (utcWindow?.start.getTime() ?? 0)).toBe(7 * 3_600_000)

    const inUtcWindow = slot({
      startsAt: new Date(Date.parse("2026-09-05T13:30:00.000Z")),
      endsAt: new Date(Date.parse("2026-09-05T15:00:00.000Z")),
    })
    const utcDraft = draft({
      date: day,
      time: onePm,
      endTime: fourPm,
      timezone: "UTC",
      slots: [inUtcWindow],
    })
    expect(eventStepSatisfied("details", utcDraft, NOW)).toBe(true)
    expect(
      eventStepSatisfied("details", { ...utcDraft, timezone: "America/Los_Angeles" }, NOW),
    ).toBe(false)
  })

  it("judges the end clock against the EVENT zone's spring-forward gap", () => {
    const beforeSpring = new Date("2026-03-01T12:00:00.000Z")
    const eve = new Date(2026, 2, 7, 12, 0, 0, 0)
    const elevenPm = new Date(2026, 0, 1, 23, 0, 0, 0)
    const halfPastTwo = new Date(2026, 0, 1, 2, 30, 0, 0)
    const overnight = draft({ date: eve, time: elevenPm, endTime: halfPastTwo })
    expect(
      eventStepSatisfied("when", { ...overnight, timezone: "America/Los_Angeles" }, beforeSpring),
    ).toBe(false)
    expect(
      eventStepSatisfied("when", { ...overnight, timezone: "America/Phoenix" }, beforeSpring),
    ).toBe(true)
  })

  it("details rejects a slot window that falls outside the event", () => {
    const window = eventWindowInZone(FUTURE_DAY, FUTURE_TIME, FUTURE_END, DEVICE_ZONE)
    const start = window?.start as Date
    const inside = slot({
      startsAt: new Date(start.getTime()),
      endsAt: new Date(start.getTime() + 3_600_000),
    })
    const outside = slot({
      startsAt: new Date(start.getTime()),
      endsAt: new Date(start.getTime() + 5 * 3_600_000),
    })
    expect(eventStepSatisfied("details", draft({ slots: [inside] }), NOW)).toBe(true)
    expect(eventStepSatisfied("details", draft({ slots: [outside] }), NOW)).toBe(false)
  })

  it("where needs a meeting point", () => {
    expect(eventStepSatisfied("where", draft({ coords: null }), NOW)).toBe(false)
    expect(eventStepSatisfied("where", draft(), NOW)).toBe(true)
  })

  it("details is optional but still rejects a broken slot row", () => {
    expect(eventStepSatisfied("details", draft({ slots: [] }), NOW)).toBe(true)
    expect(eventStepSatisfied("details", draft({ slots: [slot()] }), NOW)).toBe(true)
    expect(eventStepSatisfied("details", draft({ slots: [slot({ title: "" })] }), NOW)).toBe(false)
    expect(
      eventStepSatisfied("details", draft({ slots: [slot({ capacity: "-3" })] }), NOW),
    ).toBe(false)
  })

  it("review is satisfied only when every earlier step is", () => {
    expect(eventStepSatisfied("review", draft(), NOW)).toBe(true)
    expect(eventStepSatisfied("review", draft({ coords: null }), NOW)).toBe(false)
    expect(eventStepSatisfied("review", draft({ title: "" }), NOW)).toBe(false)
    expect(eventStepSatisfied("review", draft({ date: PAST_DAY, time: PAST_TIME }), NOW)).toBe(false)
    expect(eventStepSatisfied("review", draft({ endTime: null }), NOW)).toBe(false)
  })
})

describe("resuming a draft that survived a remount", () => {
  it("lands on the first step that is not satisfied yet", () => {
    expect(firstIncompleteEventStep(draft({ title: "" }), NOW)).toBe("basics")
    expect(firstIncompleteEventStep(draft({ date: null }), NOW)).toBe("when")
    expect(firstIncompleteEventStep(draft({ endTime: null }), NOW)).toBe("when")
    expect(firstIncompleteEventStep(draft({ coords: null }), NOW)).toBe("where")
    expect(firstIncompleteEventStep(draft({ slots: [slot({ title: "" })] }), NOW)).toBe("details")
  })

  it("lands on review when nothing is missing", () => {
    expect(firstIncompleteEventStep(draft(), NOW)).toBe("review")
  })

  it("prefers the EARLIEST gap, so a seeded location never skips the title", () => {
    expect(firstIncompleteEventStep(draft({ title: "", date: null }), NOW)).toBe("basics")
  })
})

describe("editing an event whose end is a wall clock, not a same-day instant", () => {
  const OVERNIGHT_START = new Date(2026, 5, 8, 23, 30, 0, 0)
  const OVERNIGHT_END = new Date(2026, 5, 9, 2, 0, 0, 0)

  const stored = {
    scheduledAt: OVERNIGHT_START.toISOString(),
    endsAt: OVERNIGHT_END.toISOString(),
  }

  function seededForm(cleanup: { scheduledAt: string; endsAt?: string | null }) {
    const when = new Date(cleanup.scheduledAt)
    return {
      date: when,
      time: when,
      endTime: seededEndTime(cleanup),
      timezone: DEVICE_ZONE,
      slots: [] as SlotDraft[],
    }
  }

  it("loads an overnight event into a form the host can actually save", () => {
    const form = seededForm(stored)
    expect(form.endTime.getHours()).toBe(2)
    expect(
      endTimeSelectable(
        form.date,
        form.time,
        form.endTime.getHours(),
        form.endTime.getMinutes(),
        DEVICE_ZONE,
      ),
    ).toBe(true)
    const window = eventWindowOf(form.date, form.time, form.endTime)
    expect(window?.end?.toISOString()).toBe(OVERNIGHT_END.toISOString())
  })

  it("treats an untouched schedule as untouched, seeded 2 h end included", () => {
    expect(eventWindowUntouched(stored, seededForm(stored))).toBe(true)
    const legacy = { scheduledAt: OVERNIGHT_START.toISOString(), endsAt: null }
    expect(seededEndTime(legacy).getTime() - OVERNIGHT_START.getTime()).toBe(
      DEFAULT_WIZARD_DURATION_MS,
    )
    expect(eventWindowUntouched(legacy, seededForm(legacy))).toBe(true)
  })

  it("notices a moved start, a moved end, and an incomplete form", () => {
    const form = seededForm(stored)
    const laterStart = new Date(form.time.getTime() + 3_600_000)
    expect(eventWindowUntouched(stored, { ...form, time: laterStart })).toBe(false)
    const laterEnd = new Date(form.endTime.getTime() + 3_600_000)
    expect(eventWindowUntouched(stored, { ...form, endTime: laterEnd })).toBe(false)
    expect(eventWindowUntouched(stored, { ...form, endTime: null })).toBe(false)
  })

  it("keeps a legacy null end null unless the host actually moved the window", () => {
    const body = readFileSync(new URL("../EditCleanupBody.tsx", import.meta.url), "utf8")
    expect(body).toContain("const persistEventEnd = mustPersistEventEnd(cleanup, form)")
    expect(body).toContain("...(persistEventEnd ? { endsAt: endsAt.toISOString() } : {})")
    expect(body).toContain("formEndInstantMs(form.date, form.time, form.endTime, form.timezone)")
    expect(body).not.toMatch(/endsAt: endsAt\.toISOString\(\),\n/)
  })
})

describe("whether an edit has to persist the event's end", () => {
  const START = new Date(2026, 5, 8, 9, 0, 0, 0)
  const stored = {
    scheduledAt: START.toISOString(),
    endsAt: new Date(2026, 5, 8, 12, 0, 0, 0).toISOString(),
  }
  const legacy = { scheduledAt: START.toISOString(), endsAt: null }

  function form(cleanup: { scheduledAt: string; endsAt?: string | null }, slots: SlotDraft[]) {
    const when = new Date(cleanup.scheduledAt)
    return { date: when, time: when, endTime: seededEndTime(cleanup), timezone: DEVICE_ZONE, slots }
  }

  const timedSlot = (over: Partial<SlotDraft> = {}) =>
    slot({
      startsAt: new Date(START.getTime() + 30 * 60_000),
      endsAt: new Date(START.getTime() + 90 * 60_000),
      ...over,
    })

  it("sends the end on a legacy null-end event the moment a slot carries a window", () => {
    expect(mustPersistEventEnd(legacy, form(legacy, [timedSlot()]))).toBe(true)
  })

  it("leaves a legacy null end alone through an untimed, title-only edit", () => {
    expect(mustPersistEventEnd(legacy, form(legacy, []))).toBe(false)
    expect(mustPersistEventEnd(legacy, form(legacy, [slot()]))).toBe(false)
  })

  it("leaves a stored end alone while the window is untouched, timed slots or not", () => {
    expect(mustPersistEventEnd(stored, form(stored, []))).toBe(false)
    expect(mustPersistEventEnd(stored, form(stored, [timedSlot()]))).toBe(false)
  })

  it("sends the end whenever the host moved the window, on either kind of event", () => {
    const moved = (cleanup: { scheduledAt: string; endsAt?: string | null }) => {
      const base = form(cleanup, [])
      return { ...base, endTime: new Date(base.endTime.getTime() + 3_600_000) }
    }
    expect(mustPersistEventEnd(stored, moved(stored))).toBe(true)
    expect(mustPersistEventEnd(legacy, moved(legacy))).toBe(true)
  })

  it("ignores a half-set slot window, which the payload sends as untimed anyway", () => {
    const halfSet = slot({ startsAt: new Date(START.getTime() + 30 * 60_000), endsAt: null })
    expect(mustPersistEventEnd(legacy, form(legacy, [halfSet]))).toBe(false)
  })
})
