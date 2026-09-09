/**
 * Client-side report clustering (supercluster) - the smooth, tap-to-list replacement for the old
 * server-side cluster/pin split.
 *
 * The Map seams build ONE index from the raw report points for the loaded region and re-query it on
 * every map move (NO network), so zoom/merge is smooth, and a cluster knows its members (getLeaves) so
 * tapping a count bubble can open the list of reports it encloses. Pure JS + the @civfix/shared DTOs
 * only (no React, no maplibre), so it is unit-testable and shared by both the .web and .native seams.
 *
 * Tuning - the "icons sooner" lever is `minPoints`: an isolated report (or 2-3 close neighbors) stays an
 * individual category pin even when zoomed out; only >= minPoints points within `radius` px collapse
 * into a count bubble. So clustering is now per-DENSITY (local) rather than all-or-nothing per zoom.
 */
import Supercluster from "supercluster"
import type { ReportPinDTO, BBox } from "@civfix/shared"

/**
 * The per-point properties carried in the index (enough to rebuild a ReportPinDTO).
 *
 * Beyond the identity trio (id/category/status) this carries the OPTIONAL enrichment the pin DTO may
 * ship (title/description/thumbUrl/addr/type/referenceCode). It is what lets ClusterReportsBody paint a
 * cluster-tapped list INSTANTLY from the pin (title, body, thumb) and upgrade in place once each
 * useReport fetch lands - dropping it here made that fast-paint path dead for the cluster surface while
 * the blend surface (which keeps the DTOs verbatim) still had it.
 */
export interface PinProps {
  id: string
  category: ReportPinDTO["category"]
  status: ReportPinDTO["status"]
  type?: ReportPinDTO["type"]
  title?: ReportPinDTO["title"]
  description?: ReportPinDTO["description"]
  thumbUrl?: ReportPinDTO["thumbUrl"]
  addr?: ReportPinDTO["addr"]
  referenceCode?: ReportPinDTO["referenceCode"]
}

/** Rebuild a ReportPinDTO from an indexed point, re-attaching only the enrichment that was present. */
function pinFromProps(props: PinProps, lat: number, lng: number): ReportPinDTO {
  const pin: ReportPinDTO = { id: props.id, category: props.category, lat, lng, status: props.status }
  if (props.type !== undefined) pin.type = props.type
  if (props.title !== undefined) pin.title = props.title
  if (props.description !== undefined) pin.description = props.description
  if (props.thumbUrl !== undefined) pin.thumbUrl = props.thumbUrl
  if (props.addr !== undefined) pin.addr = props.addr
  if (props.referenceCode !== undefined) pin.referenceCode = props.referenceCode
  return pin
}

/** One thing to draw at the current viewport: an individual report pin OR a count bubble. */
export type ClusterNode =
  | { type: "pin"; id: string; lng: number; lat: number; pin: ReportPinDTO }
  | { type: "cluster"; clusterId: number; lng: number; lat: number; count: number }

/** Cluster radius in pixels (screen space) - the standard supercluster knob. */
export const CLUSTER_RADIUS = 60
/** Above this zoom supercluster returns all leaves, so individual pins are always available zoomed in. */
export const CLUSTER_MAX_ZOOM = 16
/** Min points within `radius` to form a cluster - the lever that keeps isolated reports as icons. */
export const CLUSTER_MIN_POINTS = 4

/** Build a Supercluster index from the raw report points. Rebuild only when the point set changes. */
export function buildIndex(points: ReportPinDTO[]): Supercluster<PinProps> {
  const index = new Supercluster<PinProps>({
    radius: CLUSTER_RADIUS,
    maxZoom: CLUSTER_MAX_ZOOM,
    minPoints: CLUSTER_MIN_POINTS,
  })
  index.load(
    points.map((p) => ({
      type: "Feature",
      properties: {
        id: p.id,
        category: p.category,
        status: p.status,
        type: p.type,
        title: p.title,
        description: p.description,
        thumbUrl: p.thumbUrl,
        addr: p.addr,
        referenceCode: p.referenceCode,
      },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    })),
  )
  return index
}

/** Clamp a (possibly fractional / non-finite) map zoom to the integer range supercluster expects. */
function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 0
  return Math.max(0, Math.min(CLUSTER_MAX_ZOOM + 1, Math.floor(zoom)))
}

/** The clusters + individual pins to draw for the given viewport bbox + zoom. */
export function queryClusters(
  index: Supercluster<PinProps>,
  bbox: BBox,
  zoom: number,
): ClusterNode[] {
  const features = index.getClusters(
    [bbox.west, bbox.south, bbox.east, bbox.north],
    clampZoom(zoom),
  )
  return features.map((f): ClusterNode => {
    const [lng, lat] = f.geometry.coordinates as [number, number]
    const props = f.properties
    // Cluster features carry `cluster: true` + the count; point features carry our PinProps.
    if ("cluster" in props) {
      return { type: "cluster", clusterId: props.cluster_id, lng, lat, count: props.point_count }
    }
    return {
      type: "pin",
      id: props.id,
      lng,
      lat,
      pin: pinFromProps(props, lat, lng),
    }
  })
}

/** Every report point enclosed by a cluster (drives the tap-to-list surface). No pagination cap. */
export function leavesOfCluster(
  index: Supercluster<PinProps>,
  clusterId: number,
): ReportPinDTO[] {
  return index.getLeaves(clusterId, Infinity).map((f) => {
    const [lng, lat] = f.geometry.coordinates as [number, number]
    return pinFromProps(f.properties, lat, lng)
  })
}
