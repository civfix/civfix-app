import type { CheckinOutcome } from "@civfix/shared"

export type CheckinTone = "success" | "warning" | "error" | "neutral"

export interface CheckinResultRender {
  tone: CheckinTone
  icon: "TicketCheck" | "UserCheck" | "Hourglass" | "TriangleAlert" | "Ban"
  titleKey: string
  bodyKey: string
  undoable: boolean
}

export function checkinResultRender(
  outcome: CheckinOutcome,
  firstTime: boolean,
): CheckinResultRender {
  switch (outcome) {
    case "checked_in":
      return firstTime
        ? { tone: "success", icon: "TicketCheck", titleKey: "result.checked_in_title", bodyKey: "result.checked_in_body", undoable: true }
        : { tone: "warning", icon: "UserCheck", titleKey: "result.already_title", bodyKey: "result.already_body", undoable: true }
    case "already":
      return { tone: "warning", icon: "UserCheck", titleKey: "result.already_title", bodyKey: "result.already_body", undoable: true }
    case "waitlisted":
      return { tone: "warning", icon: "Hourglass", titleKey: "result.waitlisted_title", bodyKey: "result.waitlisted_body", undoable: false }
    case "cancelled":
      return { tone: "error", icon: "Ban", titleKey: "result.cancelled_title", bodyKey: "result.cancelled_body", undoable: false }
    case "no_show":
      return { tone: "warning", icon: "TriangleAlert", titleKey: "result.no_show_title", bodyKey: "result.no_show_body", undoable: false }
    case "wrong_event":
      return { tone: "error", icon: "TriangleAlert", titleKey: "result.wrong_event_title", bodyKey: "result.wrong_event_body", undoable: false }
    case "unknown_token":
      return { tone: "error", icon: "TriangleAlert", titleKey: "result.unknown_title", bodyKey: "result.unknown_body", undoable: false }
  }
}

export const MANUAL_CODE_MIN = 8
export const MANUAL_CODE_MAX = 64

export function normalizeManualCode(raw: string): string {
  return raw.replace(/[\s-]+/gu, "").toUpperCase()
}

export function manualCodeReady(raw: string): boolean {
  const value = normalizeManualCode(raw)
  return value.length >= MANUAL_CODE_MIN && value.length <= MANUAL_CODE_MAX
}
