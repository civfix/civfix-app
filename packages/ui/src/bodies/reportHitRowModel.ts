/**
 * `haversineMeters` returns metres and `distanceLabel` formats miles, so the conversion happens here, once: a
 * metres value passed straight through renders "645 mi" for a walk that should read "0.4 mi".
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

export interface ReportHitRowModel {
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
