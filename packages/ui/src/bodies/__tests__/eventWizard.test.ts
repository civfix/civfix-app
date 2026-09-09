import { describe, expect, it } from "vitest"
import {
  EVENT_WIZARD_STEPS,
  eventStepIndex,
  eventStepSatisfied,
  firstIncompleteEventStep,
  isFinalEventStep,
  nextEventStep,
  prevEventStep,
  type EventWizardDraft,
} from "../eventWizard"
import type { SlotDraft } from "../eventSlotsForm"

const NOW = new Date("2026-06-01T12:00:00.000Z")
const FUTURE_DAY = new Date("2026-06-08T00:00:00.000Z")
const FUTURE_TIME = new Date("2026-06-08T17:30:00.000Z")
const PAST_DAY = new Date("2026-05-01T00:00:00.000Z")
const PAST_TIME = new Date("2026-05-01T09:00:00.000Z")

const slot = (over: Partial<SlotDraft> = {}): SlotDraft => ({
  key: "slot-1",
  title: "Rake crew",
  description: "",
  capacity: "4",
  ...over,
})

function draft(over: Partial<EventWizardDraft> = {}): EventWizardDraft {
  return {
    title: "Riverside cleanup",
    date: FUTURE_DAY,
    time: FUTURE_TIME,
    coords: { lat: 34.05, lng: -118.24 },
    slots: [],
    ...over,
  }
}

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
  })
})

describe("resuming a draft that survived a remount", () => {
  it("lands on the first step that is not satisfied yet", () => {
    expect(firstIncompleteEventStep(draft({ title: "" }), NOW)).toBe("basics")
    expect(firstIncompleteEventStep(draft({ date: null }), NOW)).toBe("when")
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
