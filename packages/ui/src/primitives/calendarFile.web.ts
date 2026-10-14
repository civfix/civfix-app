import type { CalendarSaveInput, CalendarSaveResult } from "./calendarFile.types"

/** Safari starts the download after `click()` returns, so revoking the URL in the same tick can cancel it. */
export const CALENDAR_BLOB_REVOKE_MS = 1000

export function calendarSaveAvailable(_input: Pick<CalendarSaveInput, "writer">): boolean {
  return typeof document !== "undefined" && typeof URL !== "undefined" && typeof Blob !== "undefined"
}

export async function saveCalendarFile(input: CalendarSaveInput): Promise<CalendarSaveResult> {
  if (!calendarSaveAvailable(input) || input.ics.length === 0) return "unavailable"
  const blob = new Blob([input.ics], { type: "text/calendar;charset=utf-8" })
  const href = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement("a")
    anchor.href = href
    anchor.download = input.filename
    anchor.rel = "noopener"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    return "downloaded"
  } catch {
    return "unavailable"
  } finally {
    setTimeout(() => URL.revokeObjectURL(href), CALENDAR_BLOB_REVOKE_MS)
  }
}
