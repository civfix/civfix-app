import {
  endTimeSelectable,
  eventWindowOf,
  isScheduleInFuture,
  isScheduleUntouched,
} from "./calendarModel"
import { slotDraftWindow, slotsValid, type SlotDraft } from "./eventSlotsForm"

export const DEFAULT_WIZARD_DURATION_MS = 2 * 3_600_000

export interface EventScheduleSource {
  scheduledAt: string
  endsAt?: string | null
}

export interface EventScheduleDraft {
  date: Date | null
  time: Date | null
  endTime: Date | null
}

export function seededEndTime(cleanup: EventScheduleSource): Date {
  if (cleanup.endsAt) return new Date(cleanup.endsAt)
  return new Date(new Date(cleanup.scheduledAt).getTime() + DEFAULT_WIZARD_DURATION_MS)
}

export function eventWindowUntouched(
  cleanup: EventScheduleSource,
  value: EventScheduleDraft,
): boolean {
  if (!value.date || !value.time || !value.endTime) return false
  if (!isScheduleUntouched(cleanup.scheduledAt, value.date, value.time)) return false
  const seeded = seededEndTime(cleanup)
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
  coords: { lat: number; lng: number } | null
  slots: readonly SlotDraft[]
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
        isScheduleInFuture(draft.date, draft.time, now) &&
        endTimeSelectable(draft.date, draft.time, draft.endTime.getHours(), draft.endTime.getMinutes())
      )
    case "where":
      return draft.coords !== null
    case "details":
      return slotsValid(draft.slots, undefined, eventWindowOf(draft.date, draft.time, draft.endTime))
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
