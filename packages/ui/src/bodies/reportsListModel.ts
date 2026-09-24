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

/** How many `/me/reports` pages a search pulls in on its own before it stops and says so. */
export const SEARCH_BACKFILL_MAX_PAGES = 5

export type SearchBackfill = "off" | "fetch" | "busy" | "complete" | "partial"

/**
 * The search filters loaded pages only (the endpoint has no text query), so while a query is typed the
 * list keeps loading older pages up to a bound. Past the bound, or after a failed page, the result is
 * partial and the list says how many reports it searched.
 */
export function searchBackfill(input: {
  filtering: boolean
  pagesLoaded: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPageFailed: boolean
}): SearchBackfill {
  if (!input.filtering) return "off"
  if (!input.hasNextPage) return "complete"
  if (input.isFetchingNextPage) return "busy"
  if (input.fetchNextPageFailed || input.pagesLoaded >= SEARCH_BACKFILL_MAX_PAGES) return "partial"
  return "fetch"
}
