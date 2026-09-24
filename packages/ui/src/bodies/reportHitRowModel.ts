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
  /** The formatted distance from the viewer, or "" when there is no viewer point and no measured distance. */
  distance: string
  /** "{tag} · {distance} · {address}" with the absent parts dropped, else the description, else null. */
  subtitle: string | null
  /** The presigned first-photo thumb, or null so the row draws the category pin dot instead. */
  thumbUrl: string | null
}

export function reportHitRowModel({
  report,
  categoryLabel,
  viewer = null,
  distanceM,
  leadingTag = null,
}: {
  report: ReportHitLike
  /** Already localized by the caller, e.g. `t(\`enums:category.${report.category}\`)`. */
  categoryLabel: string
  /** The viewer's resolved point, or null (location denied / still resolving / unavailable). */
  viewer?: LatLng | null
  /** Metres from the viewer when the caller already measured them (the picker ranks by it); wins over `viewer`. */
  distanceM?: number
  /** Already localized; leads the location line, e.g. the picker's linked tag. */
  leadingTag?: string | null
}): ReportHitRowModel {
  const title = report.title?.trim() || categoryLabel
  const thumbUrl = report.thumbUrl?.trim() || null
  const addr = report.addr?.trim() || null
  const meters =
    distanceM ?? (viewer ? haversineMeters(viewer, { lat: report.lat, lng: report.lng }) : null)
  // "" without a distance, which drops out of the join below rather than leaving a dangling separator.
  const distance = meters == null ? "" : distanceLabel(meters / METERS_PER_MILE)
  const location = [leadingTag, distance, addr].filter(Boolean).join(" · ")
  const subtitle = location || report.description?.trim() || null
  return { title, distance, subtitle, thumbUrl }
}
