import type {
  EventRegistrationDTO,
  ListEventRegistrationsResponse,
  RegistrationRosterFilter,
  RegistrationRosterSort,
} from "@civfix/shared"

export const ROSTER_FILTERS: readonly RegistrationRosterFilter[] = [
  "all",
  "registered",
  "checked_in",
  "not_checked_in",
  "no_show",
  "waitlisted",
  "cancelled",
  "guests",
  "members",
]

export const ROSTER_SORTS: readonly RegistrationRosterSort[] = [
  "registered_at_desc",
  "registered_at_asc",
  "name_asc",
  "checked_in_at_desc",
]

export function isRosterFilter(value: string | undefined): value is RegistrationRosterFilter {
  return value !== undefined && (ROSTER_FILTERS as readonly string[]).includes(value)
}

export function isRosterSort(value: string | undefined): value is RegistrationRosterSort {
  return value !== undefined && (ROSTER_SORTS as readonly string[]).includes(value)
}

export function isWaitlistProjection(filter: RegistrationRosterFilter): boolean {
  return filter === "waitlisted"
}

export function rowSupportsRegistrationActions(
  row: EventRegistrationDTO,
  filter: RegistrationRosterFilter,
): boolean {
  return !isWaitlistProjection(filter) && row.status !== "cancelled"
}

export function attendanceOf(
  row: EventRegistrationDTO,
): "checked_in" | "not_checked_in" | "no_show" {
  if (row.checkedInAt !== null && row.checkedInAt !== undefined) return "checked_in"
  if (row.seats.some((seat) => seat.noShowAt)) return "no_show"
  return "not_checked_in"
}

export function checkInSeatsInRow(
  row: EventRegistrationDTO,
  seatIds: readonly string[],
  at: string,
): EventRegistrationDTO {
  const checked = new Set(seatIds)
  const seats = row.seats.map((seat) =>
    checked.has(seat.id) && seat.status === "active" && !seat.checkedInAt
      ? { ...seat, checkedInAt: at, checkinMethod: "manual" as const }
      : seat,
  )
  return { ...row, seats, checkedInAt: row.checkedInAt ?? at }
}

export function rowStillPendingCheckIn(row: EventRegistrationDTO): boolean {
  return row.seats.some((seat) => seat.status === "active" && !seat.checkedInAt)
}

/**
 * The server sends the whole-event total with the first page. It stays distinct from the loaded row
 * count, which a filter or an unfetched next page makes smaller.
 */
export function rosterEventTotal(
  pages: readonly ListEventRegistrationsResponse[] | undefined,
): number | null {
  return pages?.[0]?.total ?? null
}
