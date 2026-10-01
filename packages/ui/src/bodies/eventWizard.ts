import {
  endTimeSelectable,
  eventWindowInZone,
  isScheduleInFutureInZone,
  isScheduleUntouched,
  wallClockToFormTime,
} from "./calendarModel"
import { wallClockInZone } from "@civfix/shared/datetime"
import { isEventAddressComplete } from "./eventAddressField"
import {
  hasNamedSlot,
  slotDraftWindow,
  slotsValid,
  type SlotDraft,
  type SlotWindowBounds,
} from "./eventSlotsForm"

export const DEFAULT_WIZARD_DURATION_MS = 2 * 3_600_000

export interface EventScheduleSource {
  scheduledAt: string
  endsAt?: string | null
}

export interface EventScheduleDraft {
  date: Date | null
  time: Date | null
  endTime: Date | null
  timezone: string
}

export function seededEndTime(cleanup: EventScheduleSource, timeZone?: string): Date {
  const endMs = cleanup.endsAt
    ? Date.parse(cleanup.endsAt)
    : Date.parse(cleanup.scheduledAt) + DEFAULT_WIZARD_DURATION_MS
  if (Number.isNaN(endMs)) return new Date(Number.NaN)
  return timeZone === undefined
    ? new Date(endMs)
    : wallClockToFormTime(wallClockInZone(endMs, timeZone))
}

export function eventWindowUntouched(
  cleanup: EventScheduleSource,
  value: EventScheduleDraft,
): boolean {
  if (!value.date || !value.time || !value.endTime) return false
  if (!isScheduleUntouched(cleanup.scheduledAt, value.date, value.time, value.timezone)) return false
  const seeded = seededEndTime(cleanup, value.timezone)
  return (
    value.endTime.getHours() === seeded.getHours() &&
    value.endTime.getMinutes() === seeded.getMinutes()
  )
}

export interface EventEndDraft extends EventScheduleDraft {
  slots: readonly SlotDraft[]
}

export function mustPersistEventEnd(
  cleanup: EventScheduleSource,
  form: EventEndDraft,
): boolean {
  if (!eventWindowUntouched(cleanup, form)) return true
  if (cleanup.endsAt != null) return false
  return form.slots.some((d) => slotDraftWindow(d) !== null)
}

export type EventWizardStep = "basics" | "when" | "where" | "details" | "review"

export const EVENT_WIZARD_STEPS: readonly EventWizardStep[] = [
  "basics",
  "when",
  "where",
  "details",
  "review",
]

export interface EventWizardDraft {
  title: string
  date: Date | null
  time: Date | null
  endTime: Date | null
  timezone: string
  coords: { lat: number; lng: number } | null
  address: string
  slots: readonly SlotDraft[]
}

export function eventDraftWindow(draft: EventScheduleDraft): SlotWindowBounds | null {
  return eventWindowInZone(draft.date, draft.time, draft.endTime, draft.timezone)
}

export function eventStepIndex(step: EventWizardStep): number {
  const index = EVENT_WIZARD_STEPS.indexOf(step)
  return index < 0 ? 0 : index
}

export function isFinalEventStep(step: EventWizardStep): boolean {
  return step === "review"
}

export function eventStepSatisfied(
  step: EventWizardStep,
  draft: EventWizardDraft,
  now?: Date,
): boolean {
  switch (step) {
    case "basics":
      return draft.title.trim().length > 0
    case "when":
      return (
        draft.date !== null &&
        draft.time !== null &&
        draft.endTime !== null &&
        isScheduleInFutureInZone(draft.date, draft.time, draft.timezone, now?.getTime()) &&
        endTimeSelectable(
          draft.date,
          draft.time,
          draft.endTime.getHours(),
          draft.endTime.getMinutes(),
          draft.timezone,
        )
      )
    case "where":
      return draft.coords !== null && isEventAddressComplete(draft.address)
    case "details":
      return hasNamedSlot(draft.slots) && slotsValid(draft.slots, undefined, eventDraftWindow(draft))
    case "review":
      return EVENT_WIZARD_STEPS.every(
        (other) => isFinalEventStep(other) || eventStepSatisfied(other, draft, now),
      )
  }
}

export function nextEventStep(step: EventWizardStep): EventWizardStep | null {
  return EVENT_WIZARD_STEPS[eventStepIndex(step) + 1] ?? null
}

export function prevEventStep(step: EventWizardStep): EventWizardStep | null {
  const index = eventStepIndex(step)
  return index <= 0 ? null : (EVENT_WIZARD_STEPS[index - 1] ?? null)
}

export function firstIncompleteEventStep(draft: EventWizardDraft, now?: Date): EventWizardStep {
  for (const step of EVENT_WIZARD_STEPS) {
    if (isFinalEventStep(step)) break
    if (!eventStepSatisfied(step, draft, now)) return step
  }
  return "review"
}
