import { isScheduleInFuture } from "./calendarModel"
import { slotsValid, type SlotDraft } from "./eventSlotsForm"

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
        draft.date !== null && draft.time !== null && isScheduleInFuture(draft.date, draft.time, now)
      )
    case "where":
      return draft.coords !== null
    case "details":
      return slotsValid(draft.slots)
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
