import type { CalendarSaveInput, CalendarSaveResult } from "./calendarFile.types"

export function calendarSaveAvailable(input: Pick<CalendarSaveInput, "writer">): boolean {
  return input.writer !== undefined && input.writer !== null
}

export async function saveCalendarFile(input: CalendarSaveInput): Promise<CalendarSaveResult> {
  const writer = input.writer
  if (!writer || input.ics.length === 0) return "unavailable"
  try {
    const saved = await writer.save({ filename: input.filename, ics: input.ics })
    return saved ? "downloaded" : "unavailable"
  } catch {
    return "unavailable"
  }
}
