import type { TFunction } from "i18next"

/**
 * The line under a report's vote buttons, also on Possible duplicate rows and Most pressing nearby cards (#156 D1):
 * each count above 0 as its own phrase, joined by ", ", and `null` when nobody voted.
 */
export function reportCountsLine(
  t: TFunction,
  counts: { confirmCount: number; fixedCount: number },
): string | null {
  const parts: string[] = []
  if (counts.confirmCount > 0)
    parts.push(t("report-row:confirm_count", { count: counts.confirmCount }))
  if (counts.fixedCount > 0) parts.push(t("report-row:fixed_count", { count: counts.fixedCount }))
  return parts.length > 0 ? parts.join(", ") : null
}
