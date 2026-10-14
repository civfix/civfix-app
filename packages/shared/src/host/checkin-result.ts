import type { CheckinOutcome } from "../schemas/host/checkin.js"

export type CheckinTone = "success" | "warning" | "error"

export interface CheckinResultRender {
  /** The outcome the desk shows: a repeat scan the server still reports as `checked_in` reads as `already`. */
  shown: CheckinOutcome
  tone: CheckinTone
  titleKey: string
  bodyKey: string
  undoable: boolean
}

const OUTCOME_RENDER: Readonly<Record<CheckinOutcome, Omit<CheckinResultRender, "shown">>> = {
  checked_in: { tone: "success", titleKey: "result.checked_in_title", bodyKey: "result.checked_in_body", undoable: true },
  already: { tone: "warning", titleKey: "result.already_title", bodyKey: "result.already_body", undoable: true },
  waitlisted: { tone: "warning", titleKey: "result.waitlisted_title", bodyKey: "result.waitlisted_body", undoable: false },
  cancelled: { tone: "error", titleKey: "result.cancelled_title", bodyKey: "result.cancelled_body", undoable: false },
  no_show: { tone: "warning", titleKey: "result.no_show_title", bodyKey: "result.no_show_body", undoable: false },
  wrong_event: { tone: "error", titleKey: "result.wrong_event_title", bodyKey: "result.wrong_event_body", undoable: false },
  unknown_token: { tone: "error", titleKey: "result.unknown_title", bodyKey: "result.unknown_body", undoable: false },
}

export function checkinResultRender(outcome: CheckinOutcome, firstTime: boolean): CheckinResultRender {
  const shown = outcome === "checked_in" && !firstTime ? "already" : outcome
  return { shown, ...OUTCOME_RENDER[shown] }
}
