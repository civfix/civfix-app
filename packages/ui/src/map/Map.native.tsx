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
  type MarkerEvent,
  type ViewState,
  type ViewStateChangeEvent,
  type PressEvent,
  type PressEventWithFeatures,
} from "@maplibre/maplibre-react-native"
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec"
import type { BBox } from "@civfix/shared"
import { useTheme } from "../theme"
import { useCartoApiKey } from "../data"
import { useHaptics } from "../capabilities"
import { rasterMapStyle, DEFAULT_ATTRIBUTION } from "./mapStyle"
import { TeardropPin, EventPin, BlendPin, ClusterBubble, DropPin, clusterToneFor } from "./pins"
import { useClusters } from "./useClusters"
import { mapPointsFor } from "./mapPoints"
import { createIdleRunner, type IdleRunner } from "./clusterSchedule"
import { useLocationPick } from "./locationPickStore"
import { useMapFocus } from "./mapFocusStore"
import { useMapViewport } from "./mapViewportStore"
import { useDroppedPin } from "./droppedPinStore"
import { longPressHitsMarker, type LongPressMarker } from "./longPressGate"
import { markerNodeIsActive } from "./markerFocus"
import {
  clusterFallbackZoom,
  clusterListReports,
  clusterZoomTarget,
  expansionZoomOfCluster,
  WORLD_BBOX,
  type ClusterNode,
  type MapClusterIndex,
} from "./clusterer"
import type { MapProps, MapHandle } from "./types"

const DEFAULT_ZOOM = 13
const FOCUS_ZOOM = 16
const CLUSTER_FLY_MS = 450
const MARKER_PRESS_GUARD_MS = 350
const NO_REPORTS: MapProps["reports"] = []
const NO_CLEANUPS: MapProps["cleanups"] = []
const NO_AGGREGATES: MapProps["reportAggregates"] = []

interface MarkerNodeProps {
  node: ClusterNode
  markerId: string
  active: boolean
  onPress: (event: NativeSyntheticEvent<MarkerEvent>) => void
}

const MarkerNode = memo(function MarkerNode({ node, markerId, active, onPress }: MarkerNodeProps) {
  const lngLat = useMemo<[number, number]>(() => [node.lng, node.lat], [node.lng, node.lat])

  if (node.type === "cluster") {
    return (
      <Marker id={markerId} lngLat={lngLat} onPress={onPress}>
        <ClusterBubble
          count={node.count}
          tone={clusterToneFor(node.reportCount, node.eventCount)}
        />
      </Marker>
    )
  }
  if (node.type === "report") {
    return (
      <Marker id={markerId} lngLat={lngLat} anchor="bottom" onPress={onPress}>
        <TeardropPin category={node.pin.category} active={active} />
      </Marker>
    )
  }
  if (node.type === "event") {
    return (
      <Marker id={markerId} lngLat={lngLat} anchor="bottom" onPress={onPress}>
        <EventPin active={active} eventKind={node.event.eventKind} />
      </Marker>
    )
  }
  return (
    <Marker id={markerId} lngLat={lngLat} anchor="bottom" onPress={onPress}>
      <BlendPin count={node.reports.length} active={active} eventKind={node.event.eventKind} />
    </Marker>
  )
})

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
    mapStyle,
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

  const hitMarkers = useMemo<LongPressMarker[]>(() => {
    if (focus) return [{ lat: focus.lat, lng: focus.lng }]
    return nodes.map((node) => ({
      lat: node.lat,
      lng: node.lng,
      anchor: node.type === "cluster" ? ("center" as const) : ("bottom" as const),
    }))
  }, [focus, nodes])
  const hitMarkersRef = useRef(hitMarkers)
  hitMarkersRef.current = hitMarkers

  useImperativeHandle(
    ref,
    (): MapHandle => ({
      flyTo: (lat, lng, zoom) => {
        cameraRef.current?.flyTo({
          center: [lng, lat],
          zoom: zoom ?? Math.max(lastRegionRef.current?.zoom ?? DEFAULT_ZOOM, DEFAULT_ZOOM),
          duration: 600,
        })
      },
      recenter: () => {
        const loc = userLocationRef.current
        if (loc) {
          cameraRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: DEFAULT_ZOOM, duration: 600 })
        }
      },
    }),
    [],
  )

  const cartoApiKey = useCartoApiKey()
  const scheme = useTheme().scheme
  const resolvedStyle = useMemo(
    () =>
      (mapStyle ?? rasterMapStyle(DEFAULT_ATTRIBUTION, { cartoApiKey, scheme })) as
        | string
        | StyleSpecification,
    [mapStyle, cartoApiKey, scheme],
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
      if (event.nativeEvent.userInteraction) onUserCameraMoveRef.current?.()
    },
    [],
  )

  const handleMapLoad = useCallback(() => {
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
    cameraRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: FOCUS_ZOOM, duration: 600 })
  }, [focus])

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

  const handlePressPin = useCallback((event: NativeSyntheticEvent<MarkerEvent>) => {
    markerPressedAtRef.current = Date.now()
    const id = event.nativeEvent.id.slice("pin-".length)
    hapticsRef.current.selection()
    onPressPinRef.current?.(id)
  }, [])
  const handlePressCluster = useCallback((event: NativeSyntheticEvent<MarkerEvent>) => {
    markerPressedAtRef.current = Date.now()
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
  const handlePressCleanup = useCallback((event: NativeSyntheticEvent<MarkerEvent>) => {
    markerPressedAtRef.current = Date.now()
    const id = event.nativeEvent.id.slice("cleanup-".length)
    hapticsRef.current.selection()
    onPressCleanupRef.current?.(id)
  }, [])
  const handlePressBlend = useCallback((event: NativeSyntheticEvent<MarkerEvent>) => {
    markerPressedAtRef.current = Date.now()
    const node = nodesByMarkerRef.current.get(event.nativeEvent.id)
    if (!node || node.type !== "blend") return
    hapticsRef.current.selection()
    if (onPressBlendRef.current) onPressBlendRef.current(node.event, node.reports)
    else onPressCleanupRef.current?.(node.event.id)
  }, [])

  const markerNodes = useMemo(() => {
    const byMarker = new globalThis.Map<string, ClusterNode>()
    const rendered = nodes.map((node) => {
      const markerId =
        node.type === "cluster"
          ? node.key
          : node.type === "report"
            ? `pin-${node.id}`
            : node.type === "event"
              ? `cleanup-${node.id}`
              : `blend-${node.id}`
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
      attributionPosition={{ bottom: insets.bottom + 96, right: 8 }}
      compass={false}
      onDidFinishLoadingMap={handleMapLoad}
      onRegionWillChange={handleRegionWillChange}
      onRegionDidChange={handleRegion}
      onPress={handleMapPress}
      onLongPress={handleMapLongPress}
    >
      <Camera ref={cameraRef} initialViewState={initialViewState} />

      {showUserLocation ? <UserLocation animated accuracy /> : null}

      {focus ? (
        focus.kind === "cleanup" ? (
          <Marker
            key={`e:${focus.id}`}
            id={`cleanup-${focus.id}`}
            lngLat={[focus.lng, focus.lat]}
            anchor="bottom"
            onPress={handlePressCleanup}
          >
            <EventPin active eventKind={focus.eventKind} />
          </Marker>
        ) : (
          <Marker
            key={`r:${focus.id}`}
            id={`pin-${focus.id}`}
            lngLat={[focus.lng, focus.lat]}
            anchor="bottom"
            onPress={handlePressPin}
          >
            <TeardropPin category={focus.category} active />
          </Marker>
        )
      ) : (
        <>
          {markerNodes.rendered.map(({ node, markerId }) => (
            <MarkerNode
              key={node.key}
              node={node}
              markerId={markerId}
              active={markerNodeIsActive(node, focusedPinId, focusedCleanupId)}
              onPress={
                node.type === "cluster"
                  ? handlePressCluster
                  : node.type === "report"
                    ? handlePressPin
                    : node.type === "event"
                      ? handlePressCleanup
                      : handlePressBlend
              }
            />
          ))}
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
