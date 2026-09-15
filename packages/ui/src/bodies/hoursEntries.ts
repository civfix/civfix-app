import { MAX_EVENT_HOURS, MIN_EVENT_HOURS, type CleanupDTO, type EventHoursEntry } from "@civfix/shared"
import { formatHours } from "./formatHours"

export type HoursCleanup = Pick<CleanupDTO, "scheduledAt" | "endsAt" | "slots" | "timezone">

export interface HoursAttendee {
  slot?: { id: string } | null
}

function spanHours(fromIso: string, toIso: string): number | null {
  const span = Date.parse(toIso) - Date.parse(fromIso)
  if (!Number.isFinite(span) || span <= 0) return null
  const hours = Math.round((span / 3_600_000) * 100) / 100
  return Math.min(MAX_EVENT_HOURS, Math.max(MIN_EVENT_HOURS, hours))
}

export function plannedEventHours(cleanup: HoursCleanup): number | null {
  if (!cleanup.endsAt) return null
  return spanHours(cleanup.scheduledAt, cleanup.endsAt)
}

export function suggestedHoursFor(
  attendee: HoursAttendee,
  cleanup: HoursCleanup,
): { hours: number; slotTitle: string | null } | null {
  const slotId = attendee.slot?.id
  if (slotId !== undefined) {
    const slot = cleanup.slots.find((s) => s.id === slotId)
    if (slot?.startsAt && slot.endsAt) {
      const hours = spanHours(slot.startsAt, slot.endsAt)
      if (hours !== null) return { hours, slotTitle: slot.title }
    }
  }
  const planned = plannedEventHours(cleanup)
  return planned === null ? null : { hours: planned, slotTitle: null }
}

export function parseHoursDraft(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (trimmed.includes(".") && trimmed.includes(",")) return null
  const n = Number(trimmed.replace(",", "."))
  return Number.isFinite(n) ? n : null
}

export function hoursDraftValid(value: string, max: number): boolean {
  if (value.trim().length === 0) return true
  const n = parseHoursDraft(value)
  return n !== null && n >= MIN_EVENT_HOURS && n <= max
}

export function buildHoursEntries(
  userIds: readonly string[],
  drafts: Readonly<Record<string, string>>,
  max: number,
): EventHoursEntry[] | null {
  const entries: EventHoursEntry[] = []
  for (const userId of userIds) {
    const draft = drafts[userId] ?? ""
    if (draft.trim().length === 0) continue
    const hours = parseHoursDraft(draft)
    if (hours === null || hours < MIN_EVENT_HOURS || hours > max) return null
    entries.push({ userId, hours })
  }
  return entries.length > 0 ? entries : null
}

export function seedHoursDrafts(
  entries: ReadonlyArray<{ userId: string; hours: number }>,
): Record<string, string> {
  const drafts: Record<string, string> = {}
  for (const entry of entries) drafts[entry.userId] = formatHours(entry.hours)
  return drafts
}
