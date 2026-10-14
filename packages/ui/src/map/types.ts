import type { ReportPinDTO, ReportClusterDTO, CleanupDTO, BBox } from "@civfix/shared"

export interface MapLatLng {
  lat: number
  lng: number
}

export interface CameraTarget extends MapLatLng {
  zoom: number
}

/**
 * Structural because the shared contract must not import a platform-bound `@maplibre/*` package; the seam
 * files cast it to the real `StyleSpecification`. A string is a style URL.
 */
export type MapStyleInput = string | Record<string, unknown>

export interface MapProps {
  /**
   * Raw points, clustered client-side, so zoom and merge need no network refetch. Pass a memoized array:
   * a new identity rebuilds the supercluster index.
   */
  reports?: ReportPinDTO[]
  cleanups?: CleanupDTO[]
  reportAggregates?: ReportClusterDTO[]

  focusedPinId?: string | null
  focusedCleanupId?: string | null

  userLocation?: MapLatLng | null
  showUserLocation?: boolean

  /**
   * Fired on move-settle for the host's data layer, not for clustering: refetch only when the viewport
   * leaves the loaded region, since the map reclusters locally.
   */
  onRegionChange?: (bbox: BBox, zoom: number) => void
  onUserCameraMove?: () => void
  onPressPin?: (id: string) => void
  /** Receives the cluster's leaves. When omitted, a cluster tap zooms the camera in instead. */
  onPressCluster?: (reports: ReportPinDTO[]) => void
  onPressCleanup?: (id: string) => void
  /** An event with linked reports, drawn as one marker. When omitted, a tap falls back to `onPressCleanup`. */
  onPressBlend?: (event: CleanupDTO, reports: ReportPinDTO[]) => void
  /** Marker taps are consumed by the marker's own handler, so this fires only on empty map. */
  onPressMap?: () => void
  /**
   * Lat first; the seams normalise maplibre's lng-first tuple. The web seam runs its own 500ms touch timer
   * because iOS Safari emits no `contextmenu`, with a dedupe window so one press cannot drop two pins.
   *
   * The seams swallow a press on an existing marker (`longPressGate.ts` makes iOS and web match Android)
   * and suppress it entirely during a location pick. The host owns its other guards and the camera: feed
   * the coordinate through `dropPinCameraTarget` and fly with its own generation-guarded camera.
   */
  onLongPressMap?: (lat: number, lng: number) => void

  /**
   * Web only: the width of shell chrome covering the map's left edge, read each time the camera eases to a
   * focus, a fly-to or a pick on the expanded layout, so the target lands in the visible part of the map.
   */
  occlusionLeft?: () => number

  /**
   * There is no fallback centre anywhere in the map stack: a host that does not yet know where the viewer
   * is renders no map. Read only at mount, so a host that remounts the map passes the last-known viewport.
   */
  initialCenter: MapLatLng & { zoom?: number }
}

export interface MapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void
  /** No-op when no user location has been provided. */
  recenter: () => void
}
