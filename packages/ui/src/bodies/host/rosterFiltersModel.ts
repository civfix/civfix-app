import type { RegistrationRosterFilter } from "@civfix/shared"
import { appErrorCode } from "../errorCode"

export const ROSTER_FILTERS: readonly RegistrationRosterFilter[] = [
  "all",
  "not_checked_in",
  "checked_in",
  "waitlisted",
]

export function visibleRosterFilters(
  hasTicketTypes: boolean,
): readonly RegistrationRosterFilter[] {
  return hasTicketTypes ? ROSTER_FILTERS : ROSTER_FILTERS.filter((f) => f !== "waitlisted")
}

export function rosterMutationErrorKey(err: unknown): "roster.error_forbidden" | "roster.error" {
  return appErrorCode(err) === "FORBIDDEN" ? "roster.error_forbidden" : "roster.error"
}
