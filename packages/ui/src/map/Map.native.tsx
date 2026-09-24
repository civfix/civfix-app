import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { View, StyleSheet, type NativeSyntheticEvent } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  Map as MlMap,
  Camera,
  Marker,
  UserLocation,
  type CameraRef,
  type MapRef,
  type ViewState,
  type ViewStateChangeEvent,
  type PressEvent,
  type PressEventWithFeatures,
} from "@maplibre/maplibre-react-native"
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec"
import type { BBox } from "@civfix/shared"
import { space, useTheme } from "../theme"
import { useT } from "../i18n"
import { useCartoApiKey } from "../data"
import { useHaptics } from "../capabilities"
import { rasterMapStyle, DEFAULT_ATTRIBUTION } from "./mapStyle"
import { TeardropPin, EventPin, BlendPin, ClusterBubble, DropPin, clusterToneFor } from "./pins"
import { useClusters } from "./useClusters"
import { mapPointsFor } from "./mapPoints"
import { createIdleRunner, type IdleRunner } from "./clusterSchedule"
import { useLocationPick } from "./locationPickStore"
import { useMapFocus, type FocusedEntity } from "./mapFocusStore"
import { useMapViewport } from "./mapViewportStore"
import { useDroppedPin } from "./droppedPinStore"
import { useMapFlyTo } from "./mapFlyToStore"
import { longPressHitsMarker, type LongPressMarker } from "./longPressGate"
import {
  activeMarkerIds,
  flyToTargetOffMap,
  markerA11yLabel,
  markerButtonA11y,
  markerNodeIsActive,
  nativeMarkerId,
  targetMarkerA11yLabel,
  MARKER_PRESS_GUARD_MS,
  type MarkerPressEvent,
} from "./markerFocus"
import {
  clusterFallbackZoom,
  clusterListReports,
  clusterZoomTarget,
  expansionZoomOfCluster,
  WORLD_BBOX,
  type ClusterNode,
  type MapClusterIndex,
} from "./clusterer"
import {
  CAMERA_EASE_MS,
  CLUSTER_FLY_MS,
  DEFAULT_ZOOM,
  FOCUS_ZOOM,
} from "./mapCamera"
import type { MapProps, MapHandle } from "./types"

const ATTRIBUTION_CLEARANCE = 96
const NO_REPORTS: MapProps["reports"] = []
const NO_CLEANUPS: MapProps["cleanups"] = []
const NO_AGGREGATES: MapProps["reportAggregates"] = []

interface MarkerNodeProps {
  node: ClusterNode
  markerId: string
  active: boolean
  onPress: (event: MarkerPressEvent) => void
}

const MarkerNode = memo(function MarkerNode({ node, markerId, active, onPress }: MarkerNodeProps) {
  const lngLat = useMemo<[number, number]>(() => [node.lng, node.lat], [node.lng, node.lat])
  const { t } = useT("map-ui")
  const label = markerA11yLabel(node, t)

  if (node.type === "cluster") {
    return (
      <Marker id={markerId} lngLat={lngLat} onPress={onPress}>
        <View {...markerButtonA11y(label, markerId, onPress)}>
          <ClusterBubble
            count={node.count}
            tone={clusterToneFor(node.reportCount, node.eventCount)}
          />
        </View>
      </Marker>
    )
  }
  if (node.type === "report") {
    return (
      <Marker id={markerId} lngLat={lngLat} anchor="bottom" onPress={onPress}>
        <View {...markerButtonA11y(label, markerId, onPress)}>
          <TeardropPin category={node.pin.category} active={active} />
        </View>
      </Marker>
    )
  }
  if (node.type === "event") {
    return (
      <Marker id={markerId} lngLat={lngLat} anchor="bottom" onPress={onPress}>
        <View {...markerButtonA11y(label, markerId, onPress)}>
          <EventPin active={active} eventKind={node.event.eventKind} />
        </View>
      </Marker>
    )
  }
  return (
    <Marker id={markerId} lngLat={lngLat} anchor="bottom" onPress={onPress}>
      <View {...markerButtonA11y(label, markerId, onPress)}>
        <BlendPin count={node.reports.length} active={active} eventKind={node.event.eventKind} />
      </View>
    </Marker>
  )
})

interface TargetMarkerProps {
  target: FocusedEntity
  onPressPin: (event: MarkerPressEvent) => void
  onPressCleanup: (event: MarkerPressEvent) => void
}

function TargetMarker({ target, onPressPin, onPressCleanup }: TargetMarkerProps) {
  const { t } = useT("map-ui")
  const label = targetMarkerA11yLabel(target, t)
  if (target.kind === "cleanup") {
    return (
      <Marker
        id={`cleanup-${target.id}`}
        lngLat={[target.lng, target.lat]}
        anchor="bottom"
        onPress={onPressCleanup}
      >
        <View {...markerButtonA11y(label, `cleanup-${target.id}`, onPressCleanup)}>
          <EventPin active eventKind={target.eventKind} />
        </View>
      </Marker>
    )
  }
  return (
    <Marker id={`pin-${target.id}`} lngLat={[target.lng, target.lat]} anchor="bottom" onPress={onPressPin}>
      <View {...markerButtonA11y(label, `pin-${target.id}`, onPressPin)}>
        <TeardropPin category={target.category} active />
      </View>
    </Marker>
  )
}

export const Map = memo(forwardRef<MapHandle, MapProps>(function Map(props, ref) {
  const {
    reports = NO_REPORTS,
    cleanups = NO_CLEANUPS,
    reportAggregates = NO_AGGREGATES,
    focusedPinId = null,
    focusedCleanupId = null,
    userLocation = null,
    showUserLocation = false,
    onRegionChange,
    onUserCameraMove,
    onPressPin,
    onPressCleanup,
    onPressCluster,
    onPressBlend,
    onPressMap,
    onLongPressMap,
    initialCenter,
  } = props

  const points = useMemo(
    () => mapPointsFor({ reports, cleanups, aggregates: reportAggregates }),
    [reports, cleanups, reportAggregates],
  )

  const cameraRef = useRef<CameraRef>(null)
  const mapNativeRef = useRef<MapRef>(null)
  const insets = useSafeAreaInsets()
  const userLocationRef = useRef(userLocation)
  userLocationRef.current = userLocation

  const haptics = useHaptics()
  const hapticsRef = useRef(haptics)
  hapticsRef.current = haptics
  const onPressPinRef = useRef(onPressPin)
  onPressPinRef.current = onPressPin
  const onPressClusterRef = useRef(onPressCluster)
  onPressClusterRef.current = onPressCluster
  const onPressCleanupRef = useRef(onPressCleanup)
  onPressCleanupRef.current = onPressCleanup
  const onPressBlendRef = useRef(onPressBlend)
  onPressBlendRef.current = onPressBlend
  const onLongPressMapRef = useRef(onLongPressMap)
  onLongPressMapRef.current = onLongPressMap
  const mapSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })

  const { index, query } = useClusters(points)
  const indexRef = useRef<MapClusterIndex>(index)
  const [nodes, setNodes] = useState<ClusterNode[]>([])
  const nodesByMarkerRef = useRef<globalThis.Map<string, ClusterNode>>(new globalThis.Map())
  const lastRegionRef = useRef<{ bbox: BBox; zoom: number } | null>(null)
  const onRegionChangeRef = useRef(onRegionChange)
  onRegionChangeRef.current = onRegionChange
  const onUserCameraMoveRef = useRef(onUserCameraMove)
  onUserCameraMoveRef.current = onUserCameraMove

  const initialCenterRef = useRef(initialCenter)
  const initialViewState = useMemo(
    () => ({
      center: [initialCenterRef.current.lng, initialCenterRef.current.lat] as [number, number],
      zoom: initialCenterRef.current.zoom ?? DEFAULT_ZOOM,
    }),
    [],
  )

  const focus = useMapFocus((s) => s.focus)
  const droppedPin = useDroppedPin((s) => s.pin)
  const flyToRequest = useMapFlyTo((s) => s.request)
  const flyToHighlight = useMapFlyTo((s) => s.highlight)
  const activeIds = activeMarkerIds(focusedPinId, focusedCleanupId, flyToHighlight)
  const [mapLoaded, setMapLoaded] = useState(false)

  const recomputeRef = useRef<() => void>(() => {})
  recomputeRef.current = () => {
    const region = lastRegionRef.current
    setNodes(
      region
        ? query(region.bbox, region.zoom)
        : query(WORLD_BBOX, initialViewState.zoom),
    )
  }
  const runnerRef = useRef<IdleRunner | null>(null)
  if (runnerRef.current === null) runnerRef.current = createIdleRunner(() => recomputeRef.current())
  const runner = runnerRef.current

  useEffect(() => {
    return () => {
      runner.dispose()
      useMapViewport.getState().clear()
    }
  }, [runner])

  const offMapTarget = useMemo(
    () => (focus ? null : flyToTargetOffMap(nodes, flyToHighlight)),
    [focus, nodes, flyToHighlight],
  )

  const hitMarkers = useMemo<LongPressMarker[]>(() => {
    if (focus) return [{ lat: focus.lat, lng: focus.lng }]
    const markers: LongPressMarker[] = nodes.map((node) => ({
      lat: node.lat,
      lng: node.lng,
      anchor: node.type === "cluster" ? ("center" as const) : ("bottom" as const),
    }))
    if (offMapTarget) markers.push({ lat: offMapTarget.lat, lng: offMapTarget.lng, anchor: "bottom" })
    return markers
  }, [focus, nodes, offMapTarget])
  const hitMarkersRef = useRef(hitMarkers)
  hitMarkersRef.current = hitMarkers

  useImperativeHandle(
    ref,
    (): MapHandle => ({
      flyTo: (lat, lng, zoom) => {
        cameraRef.current?.flyTo({
          center: [lng, lat],
          zoom: zoom ?? Math.max(lastRegionRef.current?.zoom ?? DEFAULT_ZOOM, DEFAULT_ZOOM),
          duration: CAMERA_EASE_MS,
        })
      },
      recenter: () => {
        const loc = userLocationRef.current
        if (loc) {
          cameraRef.current?.flyTo({
            center: [loc.lng, loc.lat],
            zoom: DEFAULT_ZOOM,
            duration: CAMERA_EASE_MS,
          })
        }
      },
    }),
    [],
  )

  const cartoApiKey = useCartoApiKey()
  const scheme = useTheme().scheme
  const resolvedStyle = useMemo(
    () => rasterMapStyle(DEFAULT_ATTRIBUTION, { cartoApiKey, scheme }) as string | StyleSpecification,
    [cartoApiKey, scheme],
  )

  const commitRegion = useCallback((bbox: BBox, zoom: number) => {
    lastRegionRef.current = { bbox, zoom }
    onRegionChangeRef.current?.(bbox, zoom)
    useMapViewport.getState().setRegion(bbox, zoom)
    runner.request()
  }, [runner])

  const handleRegion = useCallback(
    (event: { nativeEvent: ViewStateChangeEvent }) => {
      const [west, south, east, north] = event.nativeEvent.bounds
      commitRegion({ west, south, east, north }, event.nativeEvent.zoom)
    },
    [commitRegion],
  )

  const handleRegionWillChange = useCallback(
    (event: { nativeEvent: ViewStateChangeEvent }) => {
      if (!event.nativeEvent.userInteraction) return
      useMapFlyTo.getState().clear()
      onUserCameraMoveRef.current?.()
    },
    [],
  )

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true)
    const pending = mapNativeRef.current?.getViewState()
    if (!pending) {
      runner.request()
      return
    }
    void pending
      .then((view: ViewState) => {
        const [west, south, east, north] = view.bounds
        commitRegion({ west, south, east, north }, view.zoom)
      })
      .catch(() => runner.request())
  }, [commitRegion, runner])

  useEffect(() => {
    indexRef.current = index
    runner.flush()
  }, [index, query, runner])

  useEffect(() => {
    if (!focus) return
    cameraRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: FOCUS_ZOOM, duration: CAMERA_EASE_MS })
  }, [focus])

  useEffect(() => {
    if (!flyToRequest || !mapLoaded) return
    cameraRef.current?.flyTo({
      center: [flyToRequest.lng, flyToRequest.lat],
      zoom: FOCUS_ZOOM,
      duration: CAMERA_EASE_MS,
    })
    useMapFlyTo.getState().consume(flyToRequest.generation)
  }, [flyToRequest, mapLoaded])

  const markerPressedAtRef = useRef(0)
  const onPressMapRef = useRef(onPressMap)
  onPressMapRef.current = onPressMap
  const handleMapPress = useCallback(
    (_event: NativeSyntheticEvent<PressEvent | PressEventWithFeatures>) => {
      if (Date.now() - markerPressedAtRef.current < MARKER_PRESS_GUARD_MS) return
      onPressMapRef.current?.()
    },
    [],
  )

  const handleMapLongPress = useCallback((event: NativeSyntheticEvent<PressEvent>) => {
    const handler = onLongPressMapRef.current
    if (!handler) return
    if (useLocationPick.getState().active) return
    const [lng, lat] = event.nativeEvent.lngLat
    if (
      longPressHitsMarker(
        { lat, lng },
        hitMarkersRef.current,
        useMapViewport.getState().viewport?.bbox ?? null,
        mapSizeRef.current,
      )
    ) {
      return
    }
    handler(lat, lng)
  }, [])

  const handlePressPin = useCallback((event: MarkerPressEvent) => {
    markerPressedAtRef.current = Date.now()
    useMapFlyTo.getState().clear()
    const id = event.nativeEvent.id.slice("pin-".length)
    hapticsRef.current.selection()
    onPressPinRef.current?.(id)
  }, [])
  const handlePressCluster = useCallback((event: MarkerPressEvent) => {
    markerPressedAtRef.current = Date.now()
    useMapFlyTo.getState().clear()
    const node = nodesByMarkerRef.current.get(event.nativeEvent.id)
    if (!node || node.type !== "cluster") return
    hapticsRef.current.selection()
    const currentZoom = lastRegionRef.current?.zoom ?? DEFAULT_ZOOM
    const expansion =
      node.clusterId === null ? null : expansionZoomOfCluster(indexRef.current, node.clusterId)
    const target = clusterZoomTarget(node, currentZoom, expansion)
    const flyToCluster = (zoom: number) =>
      cameraRef.current?.flyTo({ center: [node.lng, node.lat], zoom, duration: CLUSTER_FLY_MS })
    if (target !== null) {
      flyToCluster(target)
      return
    }
    const handler = onPressClusterRef.current
    const listing = clusterListReports(indexRef.current, node)
    if (handler && listing !== null && listing.length > 0) {
      handler(listing)
      return
    }
    flyToCluster(clusterFallbackZoom(currentZoom))
  }, [])
  const handlePressCleanup = useCallback((event: MarkerPressEvent) => {
    markerPressedAtRef.current = Date.now()
    useMapFlyTo.getState().clear()
    const id = event.nativeEvent.id.slice("cleanup-".length)
    hapticsRef.current.selection()
    onPressCleanupRef.current?.(id)
  }, [])
  const handlePressBlend = useCallback((event: MarkerPressEvent) => {
    markerPressedAtRef.current = Date.now()
    useMapFlyTo.getState().clear()
    const node = nodesByMarkerRef.current.get(event.nativeEvent.id)
    if (!node || node.type !== "blend") return
    hapticsRef.current.selection()
    if (onPressBlendRef.current) onPressBlendRef.current(node.event, node.reports)
    else onPressCleanupRef.current?.(node.event.id)
  }, [])

  const pressByType = useMemo<Record<ClusterNode["type"], (event: MarkerPressEvent) => void>>(
    () => ({
      cluster: handlePressCluster,
      report: handlePressPin,
      event: handlePressCleanup,
      blend: handlePressBlend,
    }),
    [handlePressCluster, handlePressPin, handlePressCleanup, handlePressBlend],
  )

  const markerNodes = useMemo(() => {
    const byMarker = new globalThis.Map<string, ClusterNode>()
    const rendered = nodes.map((node) => {
      const markerId = nativeMarkerId(node)
      byMarker.set(markerId, node)
      return { node, markerId }
    })
    return { rendered, byMarker }
  }, [nodes])

  useEffect(() => {
    nodesByMarkerRef.current = markerNodes.byMarker
  }, [markerNodes])

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        mapSizeRef.current = { width, height }
      }}
    >
    <MlMap
      ref={mapNativeRef}
      style={styles.map}
      mapStyle={resolvedStyle}
      logo={false}
      attributionPosition={{ bottom: insets.bottom + ATTRIBUTION_CLEARANCE, right: space["2"] }}
      compass={false}
      touchRotate={false}
      touchPitch={false}
      onDidFinishLoadingMap={handleMapLoad}
      onRegionWillChange={handleRegionWillChange}
      onRegionDidChange={handleRegion}
      onPress={handleMapPress}
      onLongPress={handleMapLongPress}
    >
      <Camera ref={cameraRef} initialViewState={initialViewState} />

      {showUserLocation ? <UserLocation animated accuracy /> : null}

      {focus ? (
        <TargetMarker
          key={`${focus.kind}:${focus.id}`}
          target={focus}
          onPressPin={handlePressPin}
          onPressCleanup={handlePressCleanup}
        />
      ) : (
        <>
          {markerNodes.rendered.map(({ node, markerId }) => (
            <MarkerNode
              key={node.key}
              node={node}
              markerId={markerId}
              active={markerNodeIsActive(node, activeIds.pinId, activeIds.cleanupId)}
              onPress={pressByType[node.type]}
            />
          ))}
          {offMapTarget ? (
            <TargetMarker
              key={`flyto:${offMapTarget.kind}:${offMapTarget.id}`}
              target={offMapTarget}
              onPressPin={handlePressPin}
              onPressCleanup={handlePressCleanup}
            />
          ) : null}
        </>
      )}

      {droppedPin ? (
        <Marker key="drop-pin" id="drop-pin" lngLat={[droppedPin.lng, droppedPin.lat]} anchor="bottom">
          <DropPin />
        </Marker>
      ) : null}
    </MlMap>

    </View>
  )
}))

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
})
