import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, StyleSheet, useWindowDimensions } from "react-native"
import { useFocusEffect } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useQueryClient } from "@tanstack/react-query"
import type { BBox, CleanupDTO, LatLng, ReportClusterDTO, ReportPinDTO } from "@civfix/shared"
import {
  AppShell,
  space,
  useNavStore,
  useLayoutMode,
  Map as SharedMap,
  MapControls,
  useMapFlyTo,
  useMapFocus,
  useMapViewport,
  useReportFilterStore,
  enabledCategoriesArray,
  shellOcclusionLeft,
  defaultRenderBody,
  openDropPinMenu,
  dropPinCameraTarget,
  captureDropPinCamera,
  setDropPinCameraRestorer,
  MapPending,
  resolveMapCenter,
  shouldAdoptCenter,
  PRECISE_ZOOM,
  APPROX_ZOOM,
  type MapCenterSource,
  type MapCenterTarget,
  type MapHandle,
  type MapProps,
  type RememberedCenter,
} from "@civfix/ui"
import {
  queryKeys,
  useApproximateLocation,
  useMapReports,
  useNearbyCleanups,
  useTotalUnread,
} from "@civfix/ui/data"
import { useHaptics } from "@civfix/ui/capabilities"
import { mobileHostMapPlan } from "@/components/hostMapPlan"
import {
  ROOT_SHELL_ID,
  clearNestedShellHosts,
  shellStackBelow,
  useNestedShellStore,
} from "@/lib/nestedShellSignal"
import { LocationPrimerSheet } from "@/components/LocationPrimerSheet"
import { useAndroidBackHandler } from "@/hooks/useAndroidBackHandler"
import { markRootShellSeen } from "@/lib/rootShellSeen"
import { useUserLocation } from "@/hooks/useUserLocation"
import { decideRegionFetch } from "@/lib/mapRegion"
import { readLastCenter, writeLastCenter } from "@/lib/lastCenter"
import { locationPrimerDecision } from "@/lib/locationPrimerPlan"
import { useLocationPrimerStore } from "@/store/locationPrimerStore"
import { useOnboardingStore, ONBOARDING_VERSION } from "@/store/onboardingStore"
import { useAuthStore } from "@/store/authStore"
import { dropPinMenuAlreadyOpen, dropPinRestoreFlyArgs } from "@/lib/dropPinRestore"
import {
  acknowledgeMapSettlement,
  beginMapRequest,
  createMapLifecycleState,
  markMapReady,
  mountMap,
  recallMapViewport,
  rememberMapViewport,
  resolveMapRequest,
  takePendingMapTarget,
  unmountMap,
} from "@/lib/mapLifecycle"

let nextMapMountGeneration = 0

type ManagedMapProps = Omit<MapProps, "onRegionChange"> & {
  onMapHandle: (generation: number, map: MapHandle | null) => void
  onInstanceRegionChange: (generation: number, bbox: BBox, zoom: number) => void
}

function ManagedMap({
  onMapHandle,
  onInstanceRegionChange,
  ...mapProps
}: ManagedMapProps) {
  const generationRef = useRef<number | null>(null)
  if (generationRef.current === null) {
    nextMapMountGeneration += 1
    generationRef.current = nextMapMountGeneration
  }
  const generation = generationRef.current

  const setMapHandle = useCallback(
    (map: MapHandle | null) => onMapHandle(generation, map),
    [generation, onMapHandle],
  )
  const onRegionChange = useCallback(
    (bbox: BBox, zoom: number) => onInstanceRegionChange(generation, bbox, zoom),
    [generation, onInstanceRegionChange],
  )

  return <SharedMap {...mapProps} ref={setMapHandle} onRegionChange={onRegionChange} />
}

const NEARBY_CLEANUPS_LIMIT = 20

const CONTROL_LONG_PRESS_GUARD_MS = 800

export default function MapHomeScreen() {
  const insets = useSafeAreaInsets()
  const layoutMode = useLayoutMode()
  const { height: windowHeight, width: windowWidth } = useWindowDimensions()
  const haptics = useHaptics()

  const mapRef = useRef<{ generation: number; map: MapHandle } | null>(null)
  const mapLifecycleRef = useRef(createMapLifecycleState(recallMapViewport()))
  const pendingViewportGenerationRef = useRef<number | null>(null)

  const active = useNavStore((s) => s.active)
  const view = useNavStore((s) => s.view)

  const [bbox, setBbox] = useState<BBox | null>(null)
  const loadedBboxRef = useRef<BBox | null>(null)
  const requestedBboxRef = useRef<BBox | null>(null)

  const enabledCategories = useReportFilterStore((s) => s.enabled)
  const eventsVisible = useReportFilterStore((s) => s.eventsEnabled)
  const userLayerCategories = useMemo(
    () => enabledCategoriesArray(enabledCategories),
    [enabledCategories],
  )

  const location = useUserLocation()
  const approximate = useApproximateLocation({
    enabled: location.permissionResolved && location.permission !== "granted",
  })
  const approximatePoint = useMemo<LatLng | null>(
    () => (approximate.data ? { lat: approximate.data.lat, lng: approximate.data.lng } : null),
    [approximate.data],
  )
  const nearPoint = location.coords ?? approximatePoint

  const queryClient = useQueryClient()
  useEffect(() => {
    if (!nearPoint) return
    queryClient.setQueryData<LatLng | null>(queryKeys.userLocation, nearPoint)
  }, [nearPoint, queryClient])

  const reportsEnabled = userLayerCategories.length > 0
  const reports = useMapReports({
    bbox,
    categories: userLayerCategories,
    enabled: reportsEnabled,
  })
  const cleanups = useNearbyCleanups(NEARBY_CLEANUPS_LIMIT, nearPoint, { radiusM: null })

  const unreadMessages = useTotalUnread()

  const replayPendingMapTarget = useCallback((generation: number) => {
    const lifecycle = mapLifecycleRef.current
    const mountedMap = mapRef.current
    if (mountedMap?.generation !== generation) return false
    const pending = takePendingMapTarget(lifecycle, generation)
    if (!pending.target) return false
    mapLifecycleRef.current = pending.state
    mountedMap.map.flyTo(pending.target.lat, pending.target.lng, pending.target.zoom)
    return true
  }, [])

  const setMapHandle = useCallback((generation: number, map: MapHandle | null) => {
    if (map) {
      mapRef.current = { generation, map }
      mapLifecycleRef.current = mountMap(mapLifecycleRef.current, generation)
      return
    }
    if (mapRef.current?.generation === generation) mapRef.current = null
    mapLifecycleRef.current = unmountMap(mapLifecycleRef.current, generation)
  }, [])

  const beginCameraRequest = useCallback(() => {
    const request = beginMapRequest(mapLifecycleRef.current)
    mapLifecycleRef.current = request.state
    return request.generation
  }, [])

  const flyTo = useCallback(
    (lng: number, lat: number, zoom?: number, requestGeneration?: number) => {
      const generation = requestGeneration ?? beginCameraRequest()
      mapLifecycleRef.current = resolveMapRequest(mapLifecycleRef.current, generation, {
        lat,
        lng,
        zoom,
      })
      const mountedGeneration = mapLifecycleRef.current.mountedGeneration
      if (mountedGeneration !== null) replayPendingMapTarget(mountedGeneration)
    },
    [beginCameraRequest, replayPendingMapTarget],
  )

  useAndroidBackHandler()

  const centerOnTarget = useCallback(
    (target: MapCenterTarget, requestGeneration?: number) => {
      flyTo(target.lng, target.lat, target.zoom, requestGeneration)
    },
    [flyTo],
  )

  const bboxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onRegionChange = useCallback((generation: number, viewport: BBox, _zoom: number) => {
    if (mapLifecycleRef.current.mountedGeneration !== generation) return

    if (mapLifecycleRef.current.readyGeneration !== generation) {
      mapLifecycleRef.current = markMapReady(mapLifecycleRef.current, generation)
      replayPendingMapTarget(generation)
    }
    pendingViewportGenerationRef.current = generation
    if (bboxTimerRef.current) clearTimeout(bboxTimerRef.current)
    bboxTimerRef.current = setTimeout(() => {
      bboxTimerRef.current = null
      const decision = decideRegionFetch(
        { loaded: loadedBboxRef.current, requested: requestedBboxRef.current },
        viewport,
      )
      if (decision.action === "keep") return
      requestedBboxRef.current = decision.region
      setBbox(decision.region)
    }, 350)
  }, [replayPendingMapTarget])

  useEffect(() => {
    if (reports.isError) {
      loadedBboxRef.current = null
      requestedBboxRef.current = null
      return
    }
    if (reports.isSuccess && !reports.isPlaceholderData) loadedBboxRef.current = bbox
  }, [reports.isError, reports.isSuccess, reports.isPlaceholderData, bbox])

  useEffect(() => {
    return useMapViewport.subscribe((state) => {
      const generation = pendingViewportGenerationRef.current
      if (generation === null || !state.viewport) return
      pendingViewportGenerationRef.current = null
      mapLifecycleRef.current = acknowledgeMapSettlement(
        mapLifecycleRef.current,
        generation,
        state.viewport,
      )
      rememberMapViewport(mapLifecycleRef.current.lastViewport)
      writeLastCenter({
        lat: state.viewport.center.lat,
        lng: state.viewport.center.lng,
        zoom: state.viewport.zoom,
      })
    })
  }, [])

  useEffect(() => {
    return () => {
      if (bboxTimerRef.current) clearTimeout(bboxTimerRef.current)
    }
  }, [])

  const lastControlTapRef = useRef(0)
  const markControlInteraction = useCallback(() => {
    lastControlTapRef.current = Date.now()
  }, [])
  const onMapPress = useCallback(() => {
    if (Date.now() - lastControlTapRef.current < 350) return
    useReportFilterStore.getState().setLayersOpen(false)
    useNavStore.getState().setSnap(0)
  }, [])

  const resolveLocation = location.resolve
  const awaitFirstFix = location.awaitFirstFix

  const recalledViewport = recallMapViewport() !== null
  const initialCenterOwnedRef = useRef(recalledViewport)

  const onUserCameraMove = useCallback(() => {
    initialCenterOwnedRef.current = true
    beginCameraRequest()
  }, [beginCameraRequest])

  const [rememberedCenter] = useState<RememberedCenter | null>(readLastCenter)

  const centerPlan = useMemo(
    () =>
      resolveMapCenter({
        precise: location.coords,
        approximate: approximatePoint,
        remembered: rememberedCenter,
      }),
    [location.coords, approximatePoint, rememberedCenter],
  )

  const [seedCenter, setSeedCenter] = useState<MapCenterTarget | null>(null)
  const adoptedSourceRef = useRef<MapCenterSource | null>(null)
  useEffect(() => {
    if (seedCenter !== null || !centerPlan.center) return
    adoptedSourceRef.current = centerPlan.source
    setSeedCenter(centerPlan.center)
  }, [seedCenter, centerPlan])

  const approximatePointRef = useRef(approximatePoint)
  useEffect(() => {
    approximatePointRef.current = approximatePoint
  }, [approximatePoint])
  const onLocate = useCallback(() => {
    const requestGeneration = beginCameraRequest()
    void (async () => {
      const { coords, prompted } = await resolveLocation()
      const fallback = approximatePointRef.current
      initialCenterOwnedRef.current = true
      if (coords) {
        adoptedSourceRef.current = "precise"
        centerOnTarget({ ...coords, zoom: PRECISE_ZOOM }, requestGeneration)
        return
      }
      if (fallback) {
        adoptedSourceRef.current = "approximate"
        centerOnTarget({ ...fallback, zoom: APPROX_ZOOM }, requestGeneration)
      }
      if (!prompted) return
      const firstFix = await awaitFirstFix()
      if (!firstFix) return
      adoptedSourceRef.current = "precise"
      centerOnTarget({ ...firstFix, zoom: PRECISE_ZOOM }, requestGeneration)
    })()
  }, [awaitFirstFix, beginCameraRequest, centerOnTarget, resolveLocation])

  const onboardingDone = useOnboardingStore((s) => s.completedVersion >= ONBOARDING_VERSION)
  const tourPresenting = useOnboardingStore((s) => s.presenting)
  const gateActive = useOnboardingStore((s) => s.gateActive)
  const authStatus = useAuthStore((s) => s.status)
  const profileIncomplete = useAuthStore((s) => s.user?.profileComplete === false)
  const primerShown = useLocationPrimerStore((s) => s.shown)
  const markPrimerShown = useLocationPrimerStore((s) => s.markShown)
  const setLocationChoice = useLocationPrimerStore((s) => s.setChoice)
  const [primerVisible, setPrimerVisible] = useState(false)

  const [routeFocused, setRouteFocused] = useState(false)
  useFocusEffect(
    useCallback(() => {
      setRouteFocused(true)
      markRootShellSeen()
      return () => setRouteFocused(false)
    }, []),
  )

  useFocusEffect(useCallback(() => clearNestedShellHosts(), []))

  const primerPlan = locationPrimerDecision({
    permission: location.permission,
    permissionResolved: location.permissionResolved,
    primerShown,
    gateActive,
    authStatus,
    onboardingDone,
    tourPresenting,
    profileIncomplete,
    routeFocused,
  })

  useEffect(() => {
    if (initialCenterOwnedRef.current) return
    if (seedCenter === null) return
    const { center, source } = centerPlan
    if (!center || !source) return
    if (!shouldAdoptCenter(adoptedSourceRef.current, source)) return
    adoptedSourceRef.current = source
    initialCenterOwnedRef.current = true
    if (useMapFocus.getState().focus || useMapFlyTo.getState().highlight) return
    centerOnTarget(center)
  }, [centerPlan, seedCenter, centerOnTarget])

  useEffect(() => {
    if (primerPlan !== "prompt") return
    setPrimerVisible(true)
  }, [primerPlan])

  const answerPrimer = useCallback(() => {
    setPrimerVisible(false)
    markPrimerShown()
  }, [markPrimerShown])

  const onPrimerUseLocation = useCallback(() => {
    answerPrimer()
    setLocationChoice("precise")
    onLocate()
  }, [answerPrimer, onLocate, setLocationChoice])
  const onPrimerApproximate = useCallback(() => {
    answerPrimer()
    setLocationChoice("approximate")
  }, [answerPrimer, setLocationChoice])

  useEffect(() => {
    setDropPinCameraRestorer((restoreTarget) => {
      flyTo(...dropPinRestoreFlyArgs(restoreTarget))
    })
    return () => setDropPinCameraRestorer(null)
  }, [flyTo])

  const mapPlan = mobileHostMapPlan(layoutMode, view)

  const cleanupItems = useMemo(() => cleanups.data ?? [], [cleanups.data])
  const onPressCleanup = useCallback(
    (id: string) => {
      lastControlTapRef.current = Date.now()
      const c = cleanupItems.find((x) => x.id === id)
      useNavStore.getState().openDetail({ kind: "cleanup", id, title: c?.title, lat: c?.lat, lng: c?.lng })
      if (c?.lat != null && c?.lng != null) flyTo(c.lng, c.lat)
    },
    [cleanupItems, flyTo],
  )
  const onPressPin = useCallback(
    (id: string) => {
      lastControlTapRef.current = Date.now()
      const p = (reports.data?.pins ?? []).find((x) => x.id === id)
      useNavStore.getState().openDetail({ kind: "pin", id, lat: p?.lat, lng: p?.lng })
      if (p?.lat != null && p?.lng != null) flyTo(p.lng, p.lat)
    },
    [reports.data?.pins, flyTo],
  )
  const lastLongPressRef = useRef(0)
  const onLongPressMap = useCallback(
    (lat: number, lng: number) => {
      if (Date.now() - lastControlTapRef.current < CONTROL_LONG_PRESS_GUARD_MS) return
      if (Date.now() - lastLongPressRef.current < 400) return
      lastLongPressRef.current = Date.now()
      useReportFilterStore.getState().setLayersOpen(false)
      const viewportBefore = useMapViewport.getState().viewport
      const navBefore = useNavStore.getState()
      const viewBefore = navBefore.view
      const menuAlreadyOpen = dropPinMenuAlreadyOpen(navBefore.stack)
      if (!openDropPinMenu(lat, lng)) return
      haptics.impactLight()
      const target = dropPinCameraTarget({
        lat,
        lng,
        currentZoom: viewportBefore?.zoom ?? null,
        windowHeight,
        sheetTopReserve: insets.top + space["8"],
        topInset: insets.top,
        sheetDetent: useNavStore.getState().snap,
        mode: layoutMode,
        occlusionLeft: shellOcclusionLeft(windowWidth),
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
            view: viewBefore,
          },
          menuAlreadyOpen,
        )
      }
      flyTo(target.lng, target.lat, target.zoom)
    },
    [flyTo, windowHeight, windowWidth, insets.top, layoutMode, haptics],
  )

  const onPressCluster = useCallback((clusterReports: ReportPinDTO[]) => {
    lastControlTapRef.current = Date.now()
    useNavStore.getState().openDetail({ kind: "cluster", reports: clusterReports })
  }, [])
  const onPressBlend = useCallback((event: CleanupDTO, blendReports: ReportPinDTO[]) => {
    lastControlTapRef.current = Date.now()
    useNavStore
      .getState()
      .openDetail({ kind: "blend", event, reports: blendReports, title: event.title, lat: event.lat, lng: event.lng })
  }, [])

  const pins = useMemo<ReportPinDTO[]>(
    () => (reportsEnabled ? (reports.data?.pins ?? []) : []),
    [reportsEnabled, reports.data],
  )
  const reportAggregates = useMemo<ReportClusterDTO[]>(
    () => (reportsEnabled ? (reports.data?.clusters ?? []) : []),
    [reportsEnabled, reports.data],
  )

  const focusedPinId = active?.kind === "pin" ? (active.id ?? null) : null
  const focusedCleanupId = active?.kind === "cleanup" ? (active.id ?? null) : null

  const mapElement = useMemo(() => {
    const mapSeed = mapLifecycleRef.current.lastViewport ?? seedCenter
    return mapSeed === null ? (
      <MapPending />
    ) : (
      <ManagedMap
        onMapHandle={setMapHandle}
        onInstanceRegionChange={onRegionChange}
        onUserCameraMove={onUserCameraMove}
        initialCenter={mapSeed}
        reports={pins}
        reportAggregates={reportAggregates}
        cleanups={eventsVisible ? cleanupItems : []}
        userLocation={location.coords}
        showUserLocation={location.permission === "granted"}
        onPressPin={onPressPin}
        onPressCleanup={onPressCleanup}
        onPressCluster={onPressCluster}
        onPressBlend={onPressBlend}
        onPressMap={onMapPress}
        onLongPressMap={onLongPressMap}
        focusedPinId={focusedPinId}
        focusedCleanupId={focusedCleanupId}
      />
    )
  }, [
    seedCenter,
    setMapHandle,
    onRegionChange,
    onUserCameraMove,
    location.coords,
    location.permission,
    pins,
    reportAggregates,
    cleanupItems,
    eventsVisible,
    onPressPin,
    onPressCleanup,
    onPressCluster,
    onPressBlend,
    onMapPress,
    onLongPressMap,
    focusedPinId,
    focusedCleanupId,
  ])

  const ownedStack = useNestedShellStore((s) => shellStackBelow(s, ROOT_SHELL_ID))

  return (
    <>
      <AppShell
        renderBody={defaultRenderBody}
        {...(ownedStack ? { stack: ownedStack } : {})}
        map={mapPlan.renderMap ? mapElement : null}
        mapControls={
          mapPlan.renderMapControls ? (
            <View
              style={StyleSheet.absoluteFill}
              pointerEvents="box-none"
              onTouchStart={markControlInteraction}
            >
              <MapControls
                topInset={insets.top}
                unreadCount={unreadMessages}
                onLocate={onLocate}
              />
            </View>
          ) : null
        }
        authOverlay={null}
      />
      <LocationPrimerSheet
        visible={primerVisible}
        onUseLocation={onPrimerUseLocation}
        onApproximate={onPrimerApproximate}
      />
    </>
  )
}
