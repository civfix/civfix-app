import { MIN_EVENT_HOURS, type EventHoursEntry } from "@civfix/shared"
import { formatHours } from "./formatHours"

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
