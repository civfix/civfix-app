/**
 * The picker identifies one report among several, so its headline is `"<type>: <reference>"`. The feed shows
 * the title instead, because a `LinkedReportRef` carries no `referenceCode` and would print the raw uuid.
 */

export type LinkedReportHeadline = "reference" | "title"

/**
 * The list-layout headline. `typeLabel` is the fine report-type label (or the coarse category label when a
 * report carries no type) and `categoryLabel` is the coarse category label used as the last-resort fallback
 * for a blank title, so a row is never empty.
 */
export function linkedReportHeadline(
  report: { id: string; title?: string | null; referenceCode?: string | null },
  headline: LinkedReportHeadline,
  typeLabel: string,
  categoryLabel: string,
): string {
  if (headline === "title") return report.title?.trim() || categoryLabel
  return `${typeLabel}: ${report.referenceCode?.trim() || report.id}`
}
