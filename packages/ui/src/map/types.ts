/**
 * The shared Map contract (UI-unification Stage 4 slice 5A).
 *
 * ONE component, two seam implementations: Map.native.tsx (maplibre-react-native) and Map.web.tsx
 * (maplibre-gl). Both implement the SAME `MapProps` / `MapHandle` so the two apps mount an identical
 * `<Map/>` and only differ in the platform-bound renderer the bundler selects.
 *
 * The props are the unified SUPERSET of what the two per-app maps took before (mobile MapCanvas +
 * web MapView): the report pins/clusters, cleanup/event pins, the focused-marker ids (the open
 * in-sheet detail enlarges its marker), the user-location dot, the viewport->bbox callback, the
 * marker/empty-map press handlers, and an optional explicit map style (defaults to the shared CARTO
 * Voyager raster style). The category/layer FILTER is taken here as already-resolved visible data
 * (the caller passes the pins/clusters/cleanups it wants drawn); the shared filter STORE is slice 5B.
 *
 * The imperative handle exposes the camera moves both apps drive today: `flyTo(lat,lng,zoom?)` (the
 * pin-tap recenter + the Locate control) and `recenter()` (re-fly to the last user location, a no-op
 * fallback the apps can layer their own resolve on top of). Mobile's old `recenter(lng,lat)` maps to
 * `flyTo(lat,lng)`.
 */
import type { ReportPinDTO, CleanupDTO, BBox } from "@civfix/shared"

/** A simple lat/lng the map can fly to / draw the user dot at (when the precise/IP location resolves). */
export interface MapLatLng {
  lat: number
  lng: number
}

/**
 * The cross-platform style input. Kept structural ON PURPOSE: the SHARED contract must not import a
 * platform-bound `@maplibre/*` package (the import-guard reserves maplibre for the seam files). A
 * MapLibre StyleSpecification object is structurally a `{ version: 8, ... }` record, which both
 * maplibre-gl (web) and maplibre-react-native (native) accept; the seam files cast it to the real
 * `StyleSpecification` type. A bare string (a style URL) is also allowed for parity with the native
 * `mapStyle` prop.
 */
export type MapStyleInput = string | Record<string, unknown>

export interface MapProps {
  /**
   * ALL category-filtered report points for the loaded region (raw individual pins, NOT pre-clustered).
   * The Map builds a CLIENT-SIDE supercluster index from these and, on every move, draws either an
   * individual category teardrop (anchor "bottom", tip on the coordinate) or a count bubble per the live
   * zoom - so isolated reports show their icon sooner and zoom/merge is smooth (no per-zoom network
   * refetch). Pass a MEMOIZED array: a new array identity rebuilds the index.
   */
  reports?: ReportPinDTO[]
  /** Cleanup/event gold teardrops to draw (the caller passes them only while the Events layer is on). */
  cleanups?: CleanupDTO[]

  /** The currently-focused report pin id (an open in-sheet "pin" detail) - drawn enlarged + glowing. */
  focusedPinId?: string | null
  /** The currently-focused cleanup id (an open in-sheet "cleanup" detail) - drawn enlarged + glowing. */
  focusedCleanupId?: string | null

  /**
   * The user's resolved approximate location. When set AND `showUserLocation`, the native map draws
   * its OS location dot; the web map draws an equivalent CSS dot. Null/undefined until it resolves.
   */
  userLocation?: MapLatLng | null
  /** Whether to render the user-location dot (mobile gates this on the OS permission being granted). */
  showUserLocation?: boolean

  /**
   * Fired on move-settle with the new viewport bounds + current zoom. The Map clusters CLIENT-SIDE, so
   * this is for the app's DATA layer, not for clustering: fetch the raw report points for the (padded)
   * region and feed them back as `reports`. Refetch only when the viewport leaves the loaded region -
   * the Map reclusters locally on zoom with no network, which is what keeps zoom/merge smooth.
   */
  onRegionChange?: (bbox: BBox, zoom: number) => void
  /**
   * A report pin was tapped (the app opens the full report detail). In EVENT-LINK mode (a cleanup being
   * hosted/edited) a badged-pin tap instead opens the inline marker-anchored ReportLinkPanel; this same
   * callback is then the panel's "View report details" action, so the shell keeps owning that navigation
   * (no separate prop needed). The panel's Add/Remove flows through useEventReportLink.toggle, not here.
   */
  onPressPin?: (id: string) => void
  /**
   * A count bubble was tapped - receives the FULL list of raw report pins the cluster encloses
   * (supercluster getLeaves, already in hand, no fetch). The app opens its own list surface whose rows
   * tap through to the report detail. When omitted, a cluster tap zooms the camera in instead.
   */
  onPressCluster?: (reports: ReportPinDTO[]) => void
  /** A cleanup/event pin was tapped. */
  onPressCleanup?: (id: string) => void
  /**
   * A "blend" marker was tapped (issue #70): an event that stems from reports, drawn as ONE special marker
   * in place of the event pin + its linked report pins. Receives the event AND the full list of its linked
   * reports (as pins, already in hand - no fetch). The app opens the SAME merged-reports list a cluster tap
   * opens, now showing the event + its reports. When omitted, a blend tap falls back to `onPressCleanup`.
   */
  onPressBlend?: (event: CleanupDTO, reports: ReportPinDTO[]) => void
  /**
   * A tap on the EMPTY map (not a marker). Marker taps are consumed by the marker's own handler, so
   * this fires only for empty-map taps - the apps use it to collapse the pull-up sheet.
   */
  onPressMap?: () => void
  /**
   * A LONG press on the map (the "drop a pin here, then create something here" gesture). Receives the
   * pressed coordinate, LAT FIRST (the seams normalise maplibre's lng-first `lngLat` tuple for you).
   *
   * DELAY: ~500ms on all three platforms. Native takes MapLibre's own `onLongPress`; the web seam runs
   * its own 500ms touch timer (maplibre-gl's `contextmenu` is desktop-reliable but not touch-reliable -
   * iOS Safari emits none at all) plus the desktop right-click, behind a shared dedupe window so one
   * press can never drop two pins.
   *
   * SUPPRESSION, applied by the seams so every host gets it for free:
   *   - a press that lands on an existing marker is SWALLOWED. Android's native view already hit-tests
   *     markers and swallows it; iOS does not, and the web seam sees the marker DOM - `longPressGate.ts`
   *     normalises all three to the Android behaviour.
   *   - EVENT-LINK mode (`useEventReportLink.active`) and LOCATION-PICK mode (`useLocationPick.active`)
   *     already own the map's press semantics, so the long press is suppressed entirely while either is
   *     active.
   * The host is still responsible for its OWN guards (a press that started on a floating control, a
   * second press inside the repeat window) and for the CAMERA - neither seam moves it. Feed the
   * coordinate through `dropPinCameraTarget` and fly with the host's own generation-guarded camera.
   */
  onLongPressMap?: (lat: number, lng: number) => void

  /**
   * Explicit MapLibre style. Defaults to the shared CARTO Voyager raster style (mapStyle.ts) when
   * omitted, so a caller that has a backend attribution string can still inject its own style.
   */
  mapStyle?: MapStyleInput

  /**
   * Optional INITIAL camera for the very first frame (dock-morph rebuild, defect 6). The camera seeds
   * ONCE at mount from this (falling back to the neutral statewide default when omitted). A host that
   * REMOUNTS the map - e.g. returning to the Map tab after Search, which mounts a fresh instance - passes
   * the last-known viewport here so the fresh map renders THERE instead of flashing the statewide default
   * and then flying back (the disorienting zoom). Read only at mount; later changes do not move the camera.
   */
  initialCenter?: (MapLatLng & { zoom?: number }) | null
}

/**
 * Imperative camera handle (forwardRef + useImperativeHandle). Identical on both platforms.
 */
export interface MapHandle {
  /** Fly the camera to a lat/lng (optionally to a target zoom), animated. */
  flyTo: (lat: number, lng: number, zoom?: number) => void
  /**
   * Re-center on the last-known user location, if any (animated). A convenience the Locate control
   * can call; no-op when no user location has been provided. (The apps may instead resolve a fresh
   * location and call `flyTo` directly - both paths are supported.)
   */
  recenter: () => void
}
