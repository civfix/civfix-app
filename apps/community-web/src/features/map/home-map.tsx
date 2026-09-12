"use client"

import * as React from "react"
import type { BBox, CleanupDTO, ReportCategory, ReportPinDTO } from "@civfix/shared"
import {
  Map as SharedMap,
  space,
  useNavStore,
  useReportFilterStore,
  useEventReportLink,
  useMapViewport,
  useLayoutMode,
  enabledCategoriesArray,
  FILTER_CATEGORIES,
  // The landscape shell's live geometry - the drop-pin camera offsets around the rail + card, which
  // OVERLAY the map rather than shrinking it (`expandedFramePlan` is the one tested source for how much).
  useSidebarStore,
  clampSidebarWidth,
  expandedFramePlan,
  // The portrait app-download banner's MEASURED height: the drop-pin camera treats it as the top occlusion,
  // the same way web-map-controls folds it into `MapControls topInset`.
  useAppPromoStore,
  // Map long-press -> drop a pin -> pull-up create menu (Area 3).
  openDropPinMenu,
  dropPinCameraTarget,
  // The detail-panel focus camera's published target. Read (never written) here, so the one-time initial
  // center cannot fly away from a deep-linked detail - see the effect below.
  useMapFocus,
  type MapHandle,
  type MapLatLng,
  type DetailEntry,
} from "@civfix/ui"
import { useCleanups, useMapReports } from "@civfix/ui/data"

import { decideRegionFetch } from "@/features/map/region-fetch"
import { readCameraSnapshot, writeCameraSnapshot } from "@/features/map/camera-snapshot"
import { resolveInitialCenter, getBrowserPosition, PRECISE_ZOOM, APPROX_ZOOM } from "@/lib/locate"
import { ipLocate } from "@civfix/shared/geocode"
import { useMapRecenterStore } from "@/features/map/map-recenter"

/**
 * The web home map (UI-unification Stage 4 slice 5A; filter store + Locate wired in slice 5B-1).
 *
 * Previously the web had its OWN maplibre-gl MapView that hand-built DOM pin markers (features/map/
 * map-view.tsx, now deleted). This thin wrapper keeps the web data wiring (the viewport-driven
 * /map/reports query, upcoming cleanups, the per-category count publish) but hands the resolved
 * pins/clusters/cleanups + handlers to the SHARED <Map/> (@civfix/ui), whose .web seam renders
 * maplibre-gl and mounts the unified react-native-svg pins into its markers via createRoot.
 *
 * Slice 5B-1: the category/events filter now reads the SHARED `useReportFilterStore` (@civfix/ui) - the
 * same store the shared MapControls/LayersPopover write - instead of the deleted web-local store. The
 * Locate control lives in the shared MapControls (a separate AppShell slot), so this map registers a
 * `recenter` (resolve a fresh location -> fly there + light the user dot) into a small cross-slot bus
 * (map-recenter), and also performs a one-time initial center on mount (mirroring the mobile screen).
 *
 * The map always renders the warm CARTO Voyager raster basemap, so first paint shows a real street map
 * even with no backend running. The style is NOT built here: the host used to hand the shared Map a
 * duplicate of it (features/map/map-style.ts, now deleted), which pinned the basemap to the light paper
 * backdrop and switched OFF the shared Map's own restyle-on-scheme-change. Omitting `mapStyle` lets the
 * shared Map build it from `rasterMapStyle(DEFAULT_ATTRIBUTION, { cartoApiKey, scheme })` and re-style
 * live when the appearance changes. The tiles stay CARTO Voyager either way. Pin clicks push the matching detail into the
 * unified nav store (the web panel-stack behavior is preserved).
 */
/**
 * The full report-category list to fetch when an event-report link is active but its filter is unscoped
 * ("all categories"). Derived from the canonical shared FILTER_CATEGORIES (the five real, toggleable
 * categories - "other" excluded, same universe the layer filter and the link's filterCategories operate
 * over) so it can never drift from the taxonomy.
 */
const ALL_REPORT_CATEGORIES: readonly ReportCategory[] = FILTER_CATEGORIES

export function HomeMap() {
  // The PADDED region we have fetched raw points for (NOT the viewport). The shared Map clusters these
  // client-side; we only update this when the viewport leaves the region (see onRegionChange).
  const [bbox, setBbox] = React.useState<BBox | null>(null)
  // The region whose points we actually HOLD (its query succeeded) vs. the one the CURRENT query is for
  // (in flight, or the loaded one once it resolved). The requested region suppresses duplicate fetches
  // while its query is in flight (a pan inside it must not restart the request on every settle); the
  // loaded region is what a pan BACK lands on, and never suppresses a settle on its own (that would strand
  // the map on the in-flight region's pins). Both feed decideRegionFetch - see region-fetch.ts.
  const loadedBboxRef = React.useRef<BBox | null>(null)
  const requestedBboxRef = React.useRef<BBox | null>(null)
  // The user's PRECISE device location, or null. Drives the user dot - and ONLY the dot. An IP-based
  // center estimate is NOT stored here (it centers the camera but must never draw a dot); the dot
  // appears only when precise browser geolocation is granted.
  const [userLocation, setUserLocation] = React.useState<MapLatLng | null>(null)

  // The persisted last-settled camera (features/map/camera-snapshot.ts), read SYNCHRONOUSLY once per
  // mount (lazy useState, so localStorage is touched exactly once) and handed to the shared Map as its
  // `initialCenter` seed. A returning visitor's map therefore boots AT their metro and the load-time
  // region fetch is the only one; without it every boot rendered the statewide default, fetched a
  // continental region, then flew to the resolved location and fetched AGAIN ("the map loads twice").
  // Null on a genuine first visit (and during the static-export build, where there is no window) -
  // the map then keeps today's neutral-boot + one locate-fly behavior.
  const [bootCamera] = React.useState(readCameraSnapshot)

  const mapRef = React.useRef<MapHandle>(null)
  const setRecenter = useMapRecenterStore((s) => s.setRecenter)
  // Drives the drop-pin camera offset: compact (mobile web) shifts the centre SOUTH so the pin lands in the
  // strip above the pull-up menu; expanded (the desktop sidebar) leaves the centre alone.
  const layoutMode = useLayoutMode()

  const enabled = useReportFilterStore((s) => s.enabled)
  const eventsEnabled = useReportFilterStore((s) => s.eventsEnabled)
  const setCounts = useReportFilterStore((s) => s.setCounts)
  const userLayerCategories = React.useMemo<ReportCategory[]>(
    () => enabledCategoriesArray(enabled),
    [enabled],
  )

  // While an event-report link is ACTIVE the map must show report pins regardless of the user's reports
  // layer toggle (the link temporarily "overrides layers"): force the query ON and feed the link's
  // category scope (its filterCategories, or ALL real categories when it is unscoped). When INACTIVE this
  // is byte-equivalent to the old behavior - the user's layer categories drive the query and it is gated
  // on at least one enabled category. (filterCategories is read elementwise; CleanupForm keeps it in sync.)
  const linkActive = useEventReportLink((s) => s.active)
  const linkFilterCategories = useEventReportLink((s) => s.filterCategories)
  const effectiveCategories = React.useMemo<ReportCategory[]>(
    () =>
      linkActive
        ? linkFilterCategories.length
          ? linkFilterCategories
          : [...ALL_REPORT_CATEGORIES]
        : userLayerCategories,
    [linkActive, linkFilterCategories, userLayerCategories],
  )
  const queryEnabled = linkActive || userLayerCategories.length > 0

  const reports = useMapReports({ bbox, categories: effectiveCategories, enabled: queryEnabled })
  // Upcoming events for the map's event markers. The SHARED hook (auth-optional, so it loads signed-out)
  // at its default page size, so this lands on exactly the `queryKeys.cleanups("upcoming", 50)` entry
  // EventsBody reads instead of a second, near-identical one - keep the limit at the shared default.
  const cleanups = useCleanups("upcoming")

  // Publish the latest per-category counts to the filter store so the layers popover can show live
  // numbers. Undefined when the backend omits them.
  React.useEffect(() => {
    setCounts(reports.data?.counts ?? null)
  }, [reports.data, setCounts])

  // One-time initial center: resolve the user's approximate location (precise browser geolocation, else
  // IP) and fly there. We ALWAYS center on the best estimate, but light the user dot ONLY when the
  // position is precise - an IP estimate centers the camera without dropping a dot. The zoom tracks the
  // confidence: precise GPS lands tight (PRECISE_ZOOM), an IP estimate lands much wider (APPROX_ZOOM) so
  // the user sees the whole metro instead of a wrong neighborhood. If neither resolves, keep the neutral view.
  //
  // IT DOES NOT FLY OVER A FOCUSED DETAIL. This resolve is ASYNC (browser geolocation, else an IP lookup),
  // so on a COLD deep link to a detail the two cameras race: the panel's `useMapFocus` easeTo runs the
  // moment its body has coordinates, and an initial flyTo that lands AFTER it drags the map off to the
  // user's own metro with the focused marker thousands of px off-screen - and nothing ever corrects it,
  // because focus publishes once. Measured on this build before the guard: /cleanups/e1 landed on the
  // clear-strip centre 1/4 cold loads at both 840x630 and 1440x900 (the marker at x=-5416 on the misses),
  // while /pin/r-pothole passed 3-4/4 purely because its body resolves ~2s LATER than the fly. Reading the
  // store at RESOLVE time (not at mount) is what makes the guard honest: whoever published last wins, so a
  // focus that arrives after this has already flown still overrides it with its own easeTo.
  //
  // The USER DOT is not part of the race and is set either way - it marks where the user is, not where the
  // camera is pointed.
  //
  // AND IT DOES NOT FLY AT ALL WHEN THE MAP BOOTED FROM THE PERSISTED CAMERA. `bootCamera` already put
  // the first frame where the user last left the map (the standard maps-app boot), so flying to the
  // freshly-resolved location would yank the camera off it AND re-trigger the second region fetch this
  // seed exists to eliminate. The resolve still runs - solely for the dot - and the Locate button
  // remains the deliberate way to recenter. Only a first-ever visit (no snapshot) takes the flight.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const target = await resolveInitialCenter()
      if (cancelled || !target) return
      if (target.precise) setUserLocation(target.point)
      if (bootCamera) return
      if (useMapFocus.getState().focus) return
      mapRef.current?.flyTo(target.point.lat, target.point.lng, target.precise ? PRECISE_ZOOM : APPROX_ZOOM)
    })()
    return () => {
      cancelled = true
    }
  }, [bootCamera])

  // Register a Locate action into the cross-slot recenter bus (the shared MapControls' Locate button
  // reads it - it lives in a separate AppShell slot). Re-resolve a FRESH location and fly there: precise
  // GPS lights the dot; an IP fallback only re-centers (no dot, since it isn't the user's real position).
  // If BOTH are unavailable, keep the current camera (never jump to the neutral US center). Mirrors the
  // mobile screen's onLocate. Cleared on unmount so the button is a safe no-op with no map.
  React.useEffect(() => {
    const recenter = () => {
      void (async () => {
        const precise = await getBrowserPosition()
        if (precise) {
          setUserLocation(precise)
          mapRef.current?.flyTo(precise.lat, precise.lng, PRECISE_ZOOM)
          return
        }
        const estimate = await ipLocate()
        if (estimate) mapRef.current?.flyTo(estimate.lat, estimate.lng, APPROX_ZOOM)
      })()
    }
    setRecenter(recenter)
    return () => setRecenter(null)
  }, [setRecenter])

  // The shared Map fires this on move-settle. Clustering is client-side, so we DON'T refetch on every
  // move: only when the viewport leaves the region we asked for (pan/zoom-out) or zooms in past it (the
  // sample would be too coarse). Otherwise the Map reclusters the already-loaded points locally - the
  // smooth path. `decideRegionFetch` weighs BOTH refs (see region-fetch.ts): the requested region dedupes
  // the settles of a long pan while its query is in flight, and the loaded region catches a pan BACK onto
  // data we already hold - "revert" re-points the query at it (a cache hit) so the pins on screen always
  // belong to the visible area instead of the region still in flight somewhere else.
  const onRegionChange = React.useCallback((viewport: BBox, zoom: number) => {
    // Every settle persists the camera (best-effort) so the NEXT boot seeds `initialCenter` from it -
    // see camera-snapshot.ts. Written before the fetch decision on purpose: a settle that needs no
    // refetch (a small pan inside the loaded region) is still where the user last sat.
    writeCameraSnapshot(viewport, zoom)
    const decision = decideRegionFetch(
      { loaded: loadedBboxRef.current, requested: requestedBboxRef.current },
      viewport,
    )
    if (decision.action === "keep") return
    requestedBboxRef.current = decision.region
    setBbox(decision.region)
  }, [])

  // Commit the requested region as LOADED only once its query really resolved with data for it. If the
  // fetch fails hard (the shared useMapReports sets retry:false) we clear both refs instead, so the next
  // move-settle re-requests the region - otherwise regionCovers() would keep reporting the failed region
  // as covered and the map would sit on no/stale pins until the user panned right out of it.
  // `isPlaceholderData` means we are still showing the PREVIOUS region's points while this one loads.
  React.useEffect(() => {
    if (reports.isError) {
      loadedBboxRef.current = null
      requestedBboxRef.current = null
      return
    }
    if (reports.isSuccess && !reports.isPlaceholderData) loadedBboxRef.current = bbox
  }, [reports.isError, reports.isSuccess, reports.isPlaceholderData, bbox])

  // ALL raw report points for the loaded region (category-filtered by the query; empty when no category
  // is enabled, since the query is then disabled). Memoized on the query data so the shared Map's
  // supercluster index is rebuilt only when the points actually change (stable identity = no index churn).
  const pins = React.useMemo<ReportPinDTO[]>(() => reports.data?.pins ?? [], [reports.data])
  // Memoized to mirror the `pins` memo above: a fresh `[]` (when events are off or cleanups.data is
  // still undefined) or `cleanups.data` allocated every render would change the `cleanups` prop's
  // identity, re-firing SharedMap's marker-reconcile effect (keyed on `cleanups`) - which re-runs a
  // supercluster bbox query and diffs all markers - on EVERY HomeMap render. Stable identity = no churn.
  const cleanupItems = React.useMemo<CleanupDTO[]>(
    () => (eventsEnabled ? (cleanups.data ?? []) : []),
    [eventsEnabled, cleanups.data],
  )

  // Map-marker selection is LATERAL, not a drill-down: on the compact sheet it must REPLACE any open
  // detail (openDetail -> Back closes the sheet, no pin-after-pin back-stack); on the expanded sidebar it
  // APPENDS to the visible panel stack (push -> Back pops panels), the established web model. This per-mode
  // split is exactly what the store's `push` used to encode before drill-downs (in-body row taps) gained a
  // real back-stack in both modes - so web behavior is preserved byte-for-byte here.
  const selectMapDetail = React.useCallback((entry: DetailEntry) => {
    const nav = useNavStore.getState()
    if (nav.mode === "expanded") nav.push(entry)
    else nav.openDetail(entry)
  }, [])
  const onPressPin = React.useCallback((id: string) => {
    selectMapDetail({ kind: "pin", id })
  }, [selectMapDetail])
  const onPressCleanup = React.useCallback((id: string) => {
    selectMapDetail({ kind: "cleanup", id })
  }, [selectMapDetail])
  // Tapping a count bubble opens the list of reports it encloses (the Map hands us the cluster's leaves).
  const onPressCluster = React.useCallback((clusterReports: ReportPinDTO[]) => {
    selectMapDetail({ kind: "cluster", reports: clusterReports })
  }, [selectMapDetail])
  // Tapping a BLEND marker (issue #70: an event that stems from reports) opens the merged list of the event
  // + its linked reports (the Map hands us both). The event rides on the entry so the list renders its header.
  const onPressBlend = React.useCallback((event: CleanupDTO, blendReports: ReportPinDTO[]) => {
    selectMapDetail({ kind: "blend", event, reports: blendReports, title: event.title, lat: event.lat, lng: event.lng })
  }, [selectMapDetail])

  // An empty-canvas tap dismisses the open LayersPopover (megaticket item 7); the about modal closes via
  // its own scrim.
  const onPressMap = React.useCallback(() => {
    useReportFilterStore.getState().setLayersOpen(false)
  }, [])

  // Long-press (touch) / right-click (desktop) anywhere on the map: drop a transient coral "+" pin, open
  // the pull-up create menu, and fly the camera so the pin sits in the strip of map the menu leaves visible
  // (ABOVE the sheet in portrait, BESIDE the sidebar in landscape/desktop).
  const onLongPressMap = React.useCallback(
    (lat: number, lng: number) => {
      useReportFilterStore.getState().setLayersOpen(false)
      // EVERYTHING BELOW IS GATED ON THE MENU ACTUALLY OPENING. `openDropPinMenu` DECLINES while a creation
      // flow owns the stack (host-an-event / edit / the composer); flying anyway zoomed to z17 and offset
      // the centre with NO pin and NO menu - a camera yank out of nowhere on a map the user had deliberately
      // exposed. (Map.web already swallows the press while `useLocationPick.active`, but a peeked composer /
      // edit-cleanup still reaches here.)
      if (!openDropPinMenu(lat, lng)) return
      const target = dropPinCameraTarget({
        lat,
        lng,
        currentZoom: useMapViewport.getState().viewport?.zoom ?? null,
        // No safe-area API on web; the compact sheet's top reserve is just the floating gutter - taken from
        // the shared token, the same one CompactShell.web builds its detents from, so the two cannot drift.
        windowHeight: typeof window === "undefined" ? 0 : window.innerHeight,
        sheetTopReserve: space["8"],
        // The portrait app-download banner is a FIXED strip over the full-bleed map, so it occludes the top
        // of the map exactly as a notch does on native. It publishes its MEASURED height into the shared
        // promo store (the same value web-map-controls folds into `MapControls topInset`), and that height is
        // 0 whenever no banner is showing - desktop, dismissed, installed PWA. Without it the camera centres
        // the pin in a strip that starts at y=0, i.e. behind the banner.
        topInset: useAppPromoStore.getState().bannerHeight,
        // Read AFTER openDropPinMenu: it settles the compact sheet at MID (a 52pt pin cannot be seen in the
        // sliver a FULL sheet leaves) and bumps a PEEKED sheet up, so the camera must offset by whatever the
        // sheet actually settles at.
        sheetDetent: useNavStore.getState().snap,
        mode: layoutMode,
        // Landscape/desktop: the rail (z65) and the ExpandedShell card (z60) OVERLAY the map's left edge
        // over a full-bleed map, so the occlusion there is HORIZONTAL. The frame plan answers how much:
        // the rail's footprint plus the card's LIVE, drag-resizable width - or the bare footprint when the
        // card is hidden. Read AFTER `openDropPinMenu`, like `snap` above: in map mode the drop-pin push
        // brings the card BACK, and the camera must offset for the card the user is about to see.
        occlusionLeft: expandedFramePlan({
          view: useNavStore.getState().view,
          stackLength: useNavStore.getState().stack.length,
          sidebarWidth: clampSidebarWidth(
            useSidebarStore.getState().width,
            typeof window === "undefined" ? 0 : window.innerWidth,
          ),
        }).occlusionLeft,
      })
      // NOTE the (lat, lng) argument order: MapHandle.flyTo is LAT-FIRST - the OPPOSITE of the mobile
      // host's queued flyTo(lng, lat).
      mapRef.current?.flyTo(target.lat, target.lng, target.zoom)
    },
    [layoutMode],
  )

  return (
    <SharedMap
      ref={mapRef}
      initialCenter={bootCamera}
      reports={pins}
      cleanups={cleanupItems}
      userLocation={userLocation}
      showUserLocation={userLocation != null}
      onRegionChange={onRegionChange}
      onPressPin={onPressPin}
      onPressCleanup={onPressCleanup}
      onPressCluster={onPressCluster}
      onPressBlend={onPressBlend}
      onPressMap={onPressMap}
      onLongPressMap={onLongPressMap}
    />
  )
}
