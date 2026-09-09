import type {
  EventRegistrationDTO,
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

export function checkableSeatIds(row: EventRegistrationDTO): string[] {
  return row.seats
    .filter((seat) => seat.status === "active" && seat.checkedInAt === null)
    .map((seat) => seat.id)
}

export function checkedInSeatIds(row: EventRegistrationDTO): string[] {
  return row.seats
    .filter((seat) => seat.status === "active" && seat.checkedInAt !== null)
    .map((seat) => seat.id)
}

export function attendanceOf(
  row: EventRegistrationDTO,
): "checked_in" | "not_checked_in" | "no_show" {
  if (row.checkedInAt !== null && row.checkedInAt !== undefined) return "checked_in"
  if (row.seats.some((seat) => seat.noShowAt)) return "no_show"
  return "not_checked_in"
}

export function attendeeDisplayName(
  row: EventRegistrationDTO,
  fallbacks: { guest: string; deleted: string },
): string {
  if (row.person) return row.person.deleted ? fallbacks.deleted : row.person.name
  return row.guestName ?? fallbacks.guest
}

export function shouldResetCursor(
  prev: { filter: string; sort: string; q: string; ticket: string },
  next: { filter: string; sort: string; q: string; ticket: string },
): boolean {
  return (
    prev.filter !== next.filter ||
    prev.sort !== next.sort ||
    prev.q !== next.q ||
    prev.ticket !== next.ticket
  )
}

export function rosterTotals(
  loadedRows: number,
  eventTotal: number | undefined,
  hasMore: boolean,
): { shown: number; eventTotal: number | null; hasMore: boolean } {
  return { shown: loadedRows, eventTotal: eventTotal ?? null, hasMore }
}
