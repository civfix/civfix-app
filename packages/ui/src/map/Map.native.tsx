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
import { TeardropPin, EventPin, BlendPin, ClusterBubble, DropPin } from "./pins"
import { useClusters } from "./useClusters"
import { computeMapBlends } from "./blend"
import { useLocationPick } from "./locationPickStore"
import { useMapFocus } from "./mapFocusStore"
import { useMapViewport } from "./mapViewportStore"
import { useDroppedPin } from "./droppedPinStore"
import { longPressHitsMarker, type LongPressMarker } from "./longPressGate"
import type { ClusterNode } from "./clusterer"
import type { MapProps, MapHandle } from "./types"

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283]
const DEFAULT_ZOOM = 13
const INITIAL_FALLBACK_ZOOM = 4
const FOCUS_ZOOM = 16

export const Map = memo(forwardRef<MapHandle, MapProps>(function Map(props, ref) {
  const {
    reports = [],
    cleanups = [],
    focusedPinId = null,
    focusedCleanupId = null,
    userLocation = null,
    showUserLocation = false,
    onRegionChange,
    onPressPin,
    onPressCleanup,
    onPressCluster,
    onPressBlend,
    onPressMap,
    onLongPressMap,
    mapStyle,
    initialCenter = null,
  } = props

  const { blends, standaloneReports, standaloneCleanups } = useMemo(
    () => computeMapBlends(reports, cleanups),
    [reports, cleanups],
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
  const blendsRef = useRef(blends)
  blendsRef.current = blends
  const mapSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })

  const { query, leaves } = useClusters(standaloneReports)
  const leavesRef = useRef(leaves)
  leavesRef.current = leaves
  const [nodes, setNodes] = useState<ClusterNode[]>([])
  const lastRegionRef = useRef<{ bbox: BBox; zoom: number } | null>(null)

  const focus = useMapFocus((s) => s.focus)
  const droppedPin = useDroppedPin((s) => s.pin)

  useEffect(() => {
    return () => {
      useMapViewport.getState().clear()
    }
  }, [])

  const hitMarkers = useMemo<LongPressMarker[]>(() => {
    if (focus) return [{ lat: focus.lat, lng: focus.lng }]
    return [
      ...nodes.map((node) => ({
        lat: node.lat,
        lng: node.lng,
        anchor: node.type === "cluster" ? ("center" as const) : ("bottom" as const),
      })),
      ...standaloneCleanups.map((cleanup) => ({ lat: cleanup.lat, lng: cleanup.lng })),
      ...blends.map((blend) => ({ lat: blend.event.lat, lng: blend.event.lng })),
    ]
  }, [focus, nodes, standaloneCleanups, blends])
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

  const initialCenterRef = useRef(initialCenter)
  const initialViewState = useMemo(
    () =>
      initialCenterRef.current
        ? {
            center: [initialCenterRef.current.lng, initialCenterRef.current.lat] as [number, number],
            zoom: initialCenterRef.current.zoom ?? DEFAULT_ZOOM,
          }
        : { center: DEFAULT_CENTER, zoom: INITIAL_FALLBACK_ZOOM },
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

  const handleRegion = (event: { nativeEvent: ViewStateChangeEvent }) => {
    const [west, south, east, north] = event.nativeEvent.bounds
    const bbox: BBox = { west, south, east, north }
    const zoom = event.nativeEvent.zoom
    lastRegionRef.current = { bbox, zoom }
    setNodes(query(bbox, zoom))
    onRegionChange?.(bbox, zoom)
    useMapViewport.getState().setRegion(bbox, zoom)
  }

  const handleMapLoad = () => {
    void mapNativeRef.current
      ?.getViewState()
      .then((view: ViewState) => {
        const [west, south, east, north] = view.bounds
        const bbox: BBox = { west, south, east, north }
        lastRegionRef.current = { bbox, zoom: view.zoom }
        setNodes(query(bbox, view.zoom))
        onRegionChange?.(bbox, view.zoom)
        useMapViewport.getState().setRegion(bbox, view.zoom)
      })
      .catch(() => {})
  }

  useEffect(() => {
    const region = lastRegionRef.current
    if (region) setNodes(query(region.bbox, region.zoom))
  }, [query])

  useEffect(() => {
    if (!focus) return
    cameraRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: FOCUS_ZOOM, duration: 600 })
  }, [focus?.id, focus?.lat, focus?.lng])

  const handleMapPress = (_event: NativeSyntheticEvent<PressEvent | PressEventWithFeatures>) => {
    onPressMap?.()
  }

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
    const id = event.nativeEvent.id.slice("pin-".length)
    hapticsRef.current.selection()
    onPressPinRef.current?.(id)
  }, [])
  const handlePressCluster = useCallback((event: NativeSyntheticEvent<MarkerEvent>) => {
    const clusterId = Number(event.nativeEvent.id.slice("cluster-".length))
    onPressClusterRef.current?.(leavesRef.current(clusterId))
  }, [])
  const handlePressCleanup = useCallback((event: NativeSyntheticEvent<MarkerEvent>) => {
    const id = event.nativeEvent.id.slice("cleanup-".length)
    hapticsRef.current.selection()
    onPressCleanupRef.current?.(id)
  }, [])
  const handlePressBlend = useCallback((event: NativeSyntheticEvent<MarkerEvent>) => {
    const id = event.nativeEvent.id.slice("blend-".length)
    const blend = blendsRef.current.find((b) => b.event.id === id)
    if (!blend) return
    hapticsRef.current.selection()
    if (onPressBlendRef.current) onPressBlendRef.current(blend.event, blend.reports)
    else onPressCleanupRef.current?.(blend.event.id)
  }, [])

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
      onRegionDidChange={handleRegion}
      onPress={handleMapPress}
      onLongPress={handleMapLongPress}
    >
      <Camera ref={cameraRef} initialViewState={initialViewState} />

      {showUserLocation ? <UserLocation animated accuracy /> : null}

      {focus ? (
        focus.kind === "cleanup" ? (
          <Marker
            key={`cleanup-${focus.id}`}
            id={`cleanup-${focus.id}`}
            lngLat={[focus.lng, focus.lat]}
            anchor="bottom"
            onPress={handlePressCleanup}
          >
            <EventPin active eventKind={focus.eventKind} />
          </Marker>
        ) : (
          <Marker
            key={`pin-${focus.id}`}
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
          {nodes.map((node) =>
            node.type === "cluster" ? (
              <Marker
                key={`cluster-${node.clusterId}`}
                id={`cluster-${node.clusterId}`}
                lngLat={[node.lng, node.lat]}
                onPress={handlePressCluster}
              >
                <ClusterBubble count={node.count} />
              </Marker>
            ) : (
              <Marker
                key={`pin-${node.id}`}
                id={`pin-${node.id}`}
                lngLat={[node.lng, node.lat]}
                anchor="bottom"
                onPress={handlePressPin}
              >
                <TeardropPin category={node.pin.category} active={focusedPinId === node.id} />
              </Marker>
            ),
          )}

          {standaloneCleanups.map((cleanup) => (
            <Marker
              key={`cleanup-${cleanup.id}`}
              id={`cleanup-${cleanup.id}`}
              lngLat={[cleanup.lng, cleanup.lat]}
              anchor="bottom"
              onPress={handlePressCleanup}
            >
              <EventPin
                active={focusedCleanupId === cleanup.id}
                eventKind={cleanup.eventKind}
              />
            </Marker>
          ))}

          {blends.map((blend) => (
            <Marker
              key={`blend-${blend.event.id}`}
              id={`blend-${blend.event.id}`}
              lngLat={[blend.event.lng, blend.event.lat]}
              anchor="bottom"
              onPress={handlePressBlend}
            >
              <BlendPin
                count={blend.reports.length}
                active={focusedCleanupId === blend.event.id}
                eventKind={blend.event.eventKind}
              />
            </Marker>
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
