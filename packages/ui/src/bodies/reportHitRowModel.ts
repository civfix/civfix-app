/**
 * Pure row-model for a REPORT hit in the search surfaces (the grouped "Reports" results and the resting
 * "Reports nearby" discovery section) - the field resolution behind the shared `ReportRowView`, lifted out
 * of the component so the fallback chain is unit-testable with no RN in the loop. Mirrors the resolution
 * the other two ReportRowView callers do inline (ReportsBody's renderItem, ClusterReportsBody's row).
 *
 * The subtitle is LOCATION, not the report body (that is the whole point of the change): "0.4 mi · 1200 S
 * Hope St", degrading to whichever half is present, and only falling back to the description when neither
 * is - so a row never shows an empty secondary line.
 *
 * UNITS, the trap this module exists to contain: `haversineMeters` returns METRES (geo.ts:19-30,
 * EARTH_RADIUS_M = 6_371_000), `distanceLabel` formats MILES (relativeTime.ts:34-37). The conversion is
 * explicit here, once. A metres value handed straight to `distanceLabel` renders "645 mi" for the
 * quarter-mile walk that should read "0.4 mi" - measured, not hypothetical.
 *
 * Pure + deterministic: the caller passes the already-localized category label (i18n is a React concern)
 * and the resolved viewer point, so nothing here reads a hook, a store, or the clock.
 */
import { haversineMeters, type LatLng } from "@civfix/shared"
import { distanceLabel } from "./relativeTime"

/** Metres in one statute mile - the bridge between haversineMeters (m) and distanceLabel (mi). */
export const METERS_PER_MILE = 1609.344

/** The minimal report shape this model needs; `ReportPinDTO` satisfies it. */
export interface ReportHitLike {
  title?: string | null
  description?: string | null
  addr?: string | null
  thumbUrl?: string | null
  lat: number
  lng: number
}

/** The three display fields a search report row hands to `ReportRowView`. */
export interface ReportHitRowModel {
  /** Report title, falling back to the caller-supplied localized category label. */
  title: string
  /** "{distance} · {address}", either half alone, else the description, else null. */
  subtitle: string | null
  /** The presigned first-photo thumb, or null so the row draws the category pin dot instead. */
  thumbUrl: string | null
}

export function reportHitRowModel({
  report,
  categoryLabel,
  viewer,
}: {
  report: ReportHitLike
  /** Already localized by the caller, e.g. `t(\`enums:category.${report.category}\`)`. */
  categoryLabel: string
  /** The viewer's resolved point, or null (location denied / still resolving / unavailable). */
  viewer: LatLng | null
}): ReportHitRowModel {
  const title = report.title?.trim() || categoryLabel
  const thumbUrl = report.thumbUrl?.trim() || null
  const addr = report.addr?.trim() || null
  // Metres from the viewer -> miles, because distanceLabel formats miles. "" without a viewer point, which
  // drops out of the join below rather than leaving a dangling separator.
  const distance = viewer
    ? distanceLabel(haversineMeters(viewer, { lat: report.lat, lng: report.lng }) / METERS_PER_MILE)
    : ""
  const location = [distance, addr].filter(Boolean).join(" · ")
  const subtitle = location || report.description?.trim() || null
  return { title, subtitle, thumbUrl }
}
