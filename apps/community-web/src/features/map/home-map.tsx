"use client"

import * as React from "react"
import type { BBox, CleanupDTO, ReportCategory, ReportClusterDTO, ReportPinDTO } from "@civfix/shared"
import {
  Map as SharedMap,
  space,
  useNavStore,
  useReportFilterStore,
  useMapViewport,
  useLayoutMode,
  enabledCategoriesArray,
  shellOcclusionLeft,
  useAppPromoStore,
  openDropPinMenu,
  dropPinCameraTarget,
  captureDropPinCamera,
  setDropPinCameraRestorer,
  useMapFocus,
  useMapFlyTo,
  MapPending,
  resolveMapCenter,
  shouldAdoptCenter,
  holdsRememberedCamera,
  PRECISE_ZOOM,
  APPROX_ZOOM,
  type MapCenterSource,
  type MapCenterTarget,
  type MapHandle,
  type MapLatLng,
  type DetailEntry,
} from "@civfix/ui"
import { useApproximateLocation, useCleanups, useMapReports } from "@civfix/ui/data"

import { decideRegionFetch } from "@/features/map/region-fetch"
import { readCameraSnapshot, writeCameraSnapshot } from "@/features/map/camera-snapshot"
import { resolvePreciseCenterAfterPrompt, getBrowserPosition } from "@/lib/locate"
import { useMapRecenterStore } from "@/features/map/map-recenter"

function currentShellOcclusionLeft(): number {
  return shellOcclusionLeft(typeof window === "undefined" ? 0 : window.innerWidth)
}

export function HomeMap() {
  // The padded region fetched for client-side clustering, not the viewport.
  const [bbox, setBbox] = React.useState<BBox | null>(null)
  const loadedBboxRef = React.useRef<BBox | null>(null)
  const requestedBboxRef = React.useRef<BBox | null>(null)
  // Precise geolocation only: an IP-based estimate centres the camera but must never draw the user dot.
  const [userLocation, setUserLocation] = React.useState<MapLatLng | null>(null)

  // Lazy useState so localStorage is read exactly once per mount.
  const [bootCamera] = React.useState(readCameraSnapshot)

  const mapRef = React.useRef<MapHandle>(null)
  const setRecenter = useMapRecenterStore((s) => s.setRecenter)
  const layoutMode = useLayoutMode()

  const enabled = useReportFilterStore((s) => s.enabled)
  const eventsEnabled = useReportFilterStore((s) => s.eventsEnabled)
  const setCounts = useReportFilterStore((s) => s.setCounts)
  const userLayerCategories = React.useMemo<ReportCategory[]>(
    () => enabledCategoriesArray(enabled),
    [enabled],
  )

  const reportsEnabled = userLayerCategories.length > 0
  const reports = useMapReports({
    bbox,
    categories: userLayerCategories,
    enabled: reportsEnabled,
  })
  // Keep the shared default page size so this shares EventsBody's `queryKeys.cleanups("upcoming", 50)`
  // cache entry instead of creating a near-identical one.
  const cleanups = useCleanups("upcoming")

  React.useEffect(() => {
    setCounts(reports.data?.counts ?? null)
  }, [reports.data, setCounts])

  // There is no fallback coordinate: with no precise, approximate or remembered centre the map is not
  // mounted at all (@civfix/shared DECISIONS §45). The initial fly is skipped when a detail focus or
  // fly-to has already published, because the centre resolves asynchronously and a late flyTo would drag
  // a cold deep link's focused marker off-screen; focus publishes only once. Reading the stores at adopt
  // time, not at mount, is what makes that guard hold.
  const [preciseCenter, setPreciseCenter] = React.useState<MapLatLng | null>(null)
  const promptGrantRef = React.useRef(false)
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const { precise, prompted } = await resolvePreciseCenterAfterPrompt()
      if (cancelled || !precise) return
      promptGrantRef.current = prompted
      setPreciseCenter(precise)
      setUserLocation(precise)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const approximate = useApproximateLocation()
  const approximatePoint = React.useMemo<MapLatLng | null>(
    () => (approximate.data ? { lat: approximate.data.lat, lng: approximate.data.lng } : null),
    [approximate.data],
  )

  const approximatePointRef = React.useRef(approximatePoint)
  React.useEffect(() => {
    approximatePointRef.current = approximatePoint
  }, [approximatePoint])

  const centerPlan = React.useMemo(
    () =>
      resolveMapCenter({
        precise: preciseCenter,
        approximate: approximatePoint,
        remembered: bootCamera,
      }),
    [preciseCenter, approximatePoint, bootCamera],
  )

  const [seedCenter, setSeedCenter] = React.useState<MapCenterTarget | null>(null)
  const adoptedSourceRef = React.useRef<MapCenterSource | null>(null)
  const seedSourceRef = React.useRef<MapCenterSource | null>(null)
  React.useEffect(() => {
    if (seedCenter !== null || !centerPlan.center) return
    adoptedSourceRef.current = centerPlan.source
    seedSourceRef.current = centerPlan.source
    setSeedCenter(centerPlan.center)
  }, [seedCenter, centerPlan])

  const cameraOwnedRef = React.useRef(false)
  React.useEffect(() => {
    if (cameraOwnedRef.current) return
    if (holdsRememberedCamera(seedSourceRef.current, promptGrantRef.current)) return
    if (seedCenter === null) return
    const { center, source } = centerPlan
    if (!center || !source) return
    if (!shouldAdoptCenter(adoptedSourceRef.current, source)) return
    adoptedSourceRef.current = source
    cameraOwnedRef.current = true
    if (useMapFocus.getState().focus || useMapFlyTo.getState().highlight) return
    mapRef.current?.flyTo(center.lat, center.lng, center.zoom)
  }, [centerPlan, seedCenter])

  // With neither a precise nor an approximate location, Locate keeps the current camera.
  React.useEffect(() => {
    const recenter = () => {
      void (async () => {
        cameraOwnedRef.current = true
        const precise = await getBrowserPosition()
        if (precise) {
          setUserLocation(precise)
          mapRef.current?.flyTo(precise.lat, precise.lng, PRECISE_ZOOM)
          return
        }
        const estimate = approximatePointRef.current
        if (estimate) mapRef.current?.flyTo(estimate.lat, estimate.lng, APPROX_ZOOM)
      })()
    }
    setRecenter(recenter)
    return () => setRecenter(null)
  }, [setRecenter])

  const onRegionChange = React.useCallback((viewport: BBox, zoom: number) => {
    // Before the fetch decision on purpose: a settle that needs no refetch is still where the user last sat.
    writeCameraSnapshot(viewport, zoom)
    const decision = decideRegionFetch(
      { loaded: loadedBboxRef.current, requested: requestedBboxRef.current },
      viewport,
    )
    if (decision.action === "keep") return
    requestedBboxRef.current = decision.region
    setBbox(decision.region)
  }, [])

  const onUserCameraMove = React.useCallback(() => {
    cameraOwnedRef.current = true
  }, [])

  // useMapReports sets retry:false, so a failed region must clear both refs; left as covered it would
  // suppress every later refetch inside it. `isPlaceholderData` is still the previous region's points.
  React.useEffect(() => {
    if (reports.isError) {
      loadedBboxRef.current = null
      requestedBboxRef.current = null
      return
    }
    if (reports.isSuccess && !reports.isPlaceholderData) loadedBboxRef.current = bbox
  }, [reports.isError, reports.isSuccess, reports.isPlaceholderData, bbox])

  // Stable identity so the shared Map's supercluster index rebuilds only when the points change.
  const pins = React.useMemo<ReportPinDTO[]>(
    () => (reportsEnabled ? (reports.data?.pins ?? []) : []),
    [reportsEnabled, reports.data],
  )
  const reportAggregates = React.useMemo<ReportClusterDTO[]>(
    () => (reportsEnabled ? (reports.data?.clusters ?? []) : []),
    [reportsEnabled, reports.data],
  )
  // A fresh array each render would re-fire SharedMap's marker-reconcile effect, which is keyed on
  // `cleanups`.
  const cleanupItems = React.useMemo<CleanupDTO[]>(
    () => (eventsEnabled ? (cleanups.data ?? []) : []),
    [eventsEnabled, cleanups.data],
  )

  // Marker selection is lateral: on the compact sheet it replaces the open detail so Back closes the
  // sheet, while the expanded sidebar keeps the web panel-stack model and appends.
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
  const onPressCluster = React.useCallback((clusterReports: ReportPinDTO[]) => {
    selectMapDetail({ kind: "cluster", reports: clusterReports })
  }, [selectMapDetail])
  // The event rides on the entry so the merged list can render its header.
  const onPressBlend = React.useCallback((event: CleanupDTO, blendReports: ReportPinDTO[]) => {
    selectMapDetail({ kind: "blend", event, reports: blendReports, title: event.title, lat: event.lat, lng: event.lng })
  }, [selectMapDetail])

  const onPressMap = React.useCallback(() => {
    useReportFilterStore.getState().setLayersOpen(false)
  }, [])

  React.useEffect(() => {
    setDropPinCameraRestorer((restoreTarget) => {
      mapRef.current?.flyTo(restoreTarget.lat, restoreTarget.lng, restoreTarget.zoom)
    })
    return () => setDropPinCameraRestorer(null)
  }, [])

  const onLongPressMap = React.useCallback(
    (lat: number, lng: number) => {
      useReportFilterStore.getState().setLayersOpen(false)
      const viewportBefore = useMapViewport.getState().viewport
      const navBefore = useNavStore.getState()
      const menuAlreadyOpen = navBefore.stack.some((entry) => entry.kind === "drop-pin")
      // Declined while a creation flow owns the stack; flying anyway would yank the camera with no pin.
      if (!openDropPinMenu(lat, lng)) return
      const target = dropPinCameraTarget({
        lat,
        lng,
        currentZoom: useMapViewport.getState().viewport?.zoom ?? null,
        // No safe-area API on web: the reserve is the floating gutter token CompactShell.web's detents use.
        windowHeight: typeof window === "undefined" ? 0 : window.innerHeight,
        sheetTopReserve: space["8"],
        // The fixed app-download banner occludes the top of the map like a notch; its measured height is 0
        // whenever no banner shows.
        topInset: useAppPromoStore.getState().bannerHeight,
        // Read after openDropPinMenu, which moves the sheet to MID; the camera offsets for the settled detent.
        sheetDetent: useNavStore.getState().snap,
        mode: layoutMode,
        // Read after `openDropPinMenu`, whose push brings the card back in map mode.
        occlusionLeft: currentShellOcclusionLeft(),
      })
      if (viewportBefore) {
        captureDropPinCamera(
          {
            from: {
              lat: viewportBefore.center.lat,
              lng: viewportBefore.center.lng,
              zoom: viewportBefore.zoom,
            },
            flownTo: target,
            view: navBefore.view,
          },
          menuAlreadyOpen,
        )
      }
      // MapHandle.flyTo is lat-first, the opposite of the mobile host's queued flyTo(lng, lat).
      mapRef.current?.flyTo(target.lat, target.lng, target.zoom)
    },
    [layoutMode],
  )

  if (seedCenter === null) return <MapPending />

  return (
    <SharedMap
      ref={mapRef}
      initialCenter={seedCenter}
      reports={pins}
      reportAggregates={reportAggregates}
      cleanups={cleanupItems}
      userLocation={userLocation}
      showUserLocation={userLocation != null}
      onRegionChange={onRegionChange}
      onUserCameraMove={onUserCameraMove}
      onPressPin={onPressPin}
      onPressCleanup={onPressCleanup}
      onPressCluster={onPressCluster}
      onPressBlend={onPressBlend}
      onPressMap={onPressMap}
      onLongPressMap={onLongPressMap}
      occlusionLeft={currentShellOcclusionLeft}
    />
  )
}
