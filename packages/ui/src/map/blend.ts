/**
 * Event<->report map "blend" (issue #70): an event that STEMS FROM reports should not show as a separate
 * event pin floating beside its source report pins/cluster — it should collapse with them into ONE special
 * marker that, when tapped, opens a list (the same merged-reports list a cluster opens) of the event AND
 * its linked reports.
 *
 * The unit of merging is the LINK relationship itself (a host links the reports an event covers), so this
 * is pure data, not geographic clustering: any event carrying `linkedReports` becomes a blend. Because the
 * link is deliberate and a linked report is, by construction, in the event's "condensed area", we always
 * unify a linked pair rather than computing on-screen pixel proximity — which also keeps this helper a pure
 * (map-free, React-free) function the .web + .native seams share and a unit test exercises directly.
 *
 * `computeMapBlends` splits the raw Map inputs into:
 *   - `blends`             : one per event that has linked reports — the event + its reports (as pins).
 *   - `standaloneReports`  : the report points NOT absorbed by any blend — feed THESE to the clusterer so an
 *                            absorbed report never also draws as its own pin/cluster (no double-representation).
 *   - `standaloneCleanups` : the events with NO linked reports — drawn as the normal event teardrops.
 *
 * Identity is preserved when there is nothing to blend (the common case): the original `reports`/`cleanups`
 * arrays are returned unchanged, so the Map's memoized supercluster index does not churn.
 */
import type { CleanupDTO, ReportPinDTO } from "@civfix/shared"

/** One merged marker: an event and the reports it is linked to (already resolved to pins). */
export interface MapBlend {
  event: CleanupDTO
  reports: ReportPinDTO[]
}

export interface BlendResult {
  blends: MapBlend[]
  standaloneReports: ReportPinDTO[]
  standaloneCleanups: CleanupDTO[]
}

/**
 * A linked-report ref (carried verbatim on the event, with full id/category/coords/status) maps 1:1 onto
 * the ReportPinDTO the cluster list rows hydrate from — no fetch needed. Optional fields are spread so an
 * omitted `type`/`thumbUrl` stays omitted (matches the ReportPinDTO contract).
 */
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
 * Split the raw report points + event pins into blends + the standalone remainder. Only `cleanup`-kind
 * events carry links (other_volunteer events never do), so the guard is defensive but cheap. When nothing
 * blends, the original arrays are returned by identity to avoid re-clustering churn.
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
    // Nothing to merge — hand back the inputs unchanged so the clusterer index keeps its identity.
    return { blends, standaloneReports: reports, standaloneCleanups: cleanups }
  }
  const blendedEventIds = new Set(blends.map((b) => b.event.id))
  return {
    blends,
    standaloneReports: reports.filter((r) => !absorbed.has(r.id)),
    standaloneCleanups: cleanups.filter((c) => !blendedEventIds.has(c.id)),
  }
}
