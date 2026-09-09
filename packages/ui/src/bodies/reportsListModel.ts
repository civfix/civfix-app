/**
 * Pure behavior model for ReportsBody ("Your reports"), extracted so it is unit-testable without the RN body.
 */

/**
 * Does a report match the in-list search query? Title + category + address, all case-folded.
 *
 * `categoryLabel` is passed in ALREADY LOCALIZED (the caller resolves `enums:category.*`, the same string the
 * row renders) rather than read from the hardcoded English REPORT_CATEGORY_LABELS map - otherwise a reader of
 * a non-English catalog searching the category name they can actually see on screen matched nothing.
 */
export function matchesReportQuery(
  report: { title?: string | null; addr?: string | null },
  categoryLabel: string,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    (report.title ?? "").toLowerCase().includes(q) ||
    categoryLabel.toLowerCase().includes(q) ||
    (report.addr ?? "").toLowerCase().includes(q)
  )
}
