/**
 * An event linked to reports collapses with them into one marker instead of floating beside its source
 * pins. Linking is deliberate, so a linked pair is always merged rather than tested for on-screen
 * proximity. Absorbed reports are dropped from `standaloneReports` so they never also draw as their own
 * pin or cluster.
 */
import type { CleanupDTO, ReportPinDTO } from "@civfix/shared"

export interface MapBlend {
  event: CleanupDTO
  reports: ReportPinDTO[]
}

export interface BlendResult {
  blends: MapBlend[]
  standaloneReports: ReportPinDTO[]
  standaloneCleanups: CleanupDTO[]
}

/** Optional fields are spread so an omitted `type` or `thumbUrl` stays omitted, per the ReportPinDTO contract. */
function linkedReportToPin(r: CleanupDTO["linkedReports"][number]): ReportPinDTO {
  return {
    id: r.id,
    category: r.category,
    ...(r.type !== undefined ? { type: r.type } : {}),
    lat: r.lat,
    lng: r.lng,
    status: r.status,
    title: r.title,
    ...(r.thumbUrl !== undefined && r.thumbUrl !== null ? { thumbUrl: r.thumbUrl } : {}),
  }
}

/**
 * Only `cleanup`-kind events carry links, so the kind guard is defensive. When nothing blends the inputs
 * are returned by identity so the memoized supercluster index does not churn.
 */
export function computeMapBlends(
  reports: ReportPinDTO[],
  cleanups: CleanupDTO[],
): BlendResult {
  const blends: MapBlend[] = []
  const absorbed = new Set<string>()
  for (const c of cleanups) {
    if (c.eventKind !== "cleanup" || c.linkedReports.length === 0) continue
    const pins = c.linkedReports.map(linkedReportToPin)
    blends.push({ event: c, reports: pins })
    for (const p of pins) absorbed.add(p.id)
  }
  if (blends.length === 0) {
    return { blends, standaloneReports: reports, standaloneCleanups: cleanups }
  }
  const blendedEventIds = new Set(blends.map((b) => b.event.id))
  return {
    blends,
    standaloneReports: reports.filter((r) => !absorbed.has(r.id)),
    standaloneCleanups: cleanups.filter((c) => !blendedEventIds.has(c.id)),
  }
}
