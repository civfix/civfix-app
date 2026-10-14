import type { EventRegistrationDTO } from "../schemas/entities.js"

type RosterRow = Pick<EventRegistrationDTO, "seats">

export interface AttendeeNameFallbacks {
  guest: string
  deleted: string
}

export function checkableSeatIds(row: RosterRow): string[] {
  return row.seats
    .filter((seat) => seat.status === "active" && seat.checkedInAt == null)
    .map((seat) => seat.id)
}

export function nextCheckinSeat(row: RosterRow): string | null {
  return checkableSeatIds(row)[0] ?? null
}

export function lastCheckedInSeat(row: RosterRow): string | null {
  let best: { id: string; at: string } | null = null
  for (const seat of row.seats) {
    if (seat.status !== "active" || !seat.checkedInAt) continue
    if (!best || seat.checkedInAt > best.at) best = { id: seat.id, at: seat.checkedInAt }
  }
  return best?.id ?? null
}

export function attendeeDisplayName(
  row: Pick<EventRegistrationDTO, "person" | "guestName">,
  fallbacks: AttendeeNameFallbacks,
): string {
  if (row.person) return row.person.deleted ? fallbacks.deleted : row.person.name
  return row.guestName ?? fallbacks.guest
}
