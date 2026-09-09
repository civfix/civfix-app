/**
 * linkedReportHeadline - the pure headline computation for `LinkedReportCard layout="list"`.
 *
 * The list layout serves TWO audiences with opposite needs:
 *   - the PICKER (the event form's linked reports, the composer's report list): the reader is identifying
 *     one report among several, so the headline is `"<type>: <reference>"` (e.g. "Dump: DU-42-000001").
 *     This is the DEFAULT and is preserved byte-for-byte.
 *   - the FEED (PostCard's attached report, the composer's attached preview, the share preview): the reader
 *     wants the human title. A `LinkedReportRef` carries NO `referenceCode`, so the "reference" headline
 *     silently degrades to the raw uuid there - "Dump: 550e8400-e29b-41d4-a716-446655440000" - which is
 *     exactly the "NEVER a bare id snippet" the card's own doc comment forbids.
 *
 * Extracted into its own module (rather than living inline in `LinkedReportCard.tsx`) so it is unit-testable
 * without a react-native renderer, matching the `postCardModel` / `linkedEventCardModel` house pattern.
 */

/** Which headline the list layout should print. */
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
