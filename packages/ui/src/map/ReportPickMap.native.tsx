import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { View, StyleSheet, type NativeSyntheticEvent } from "react-native"
import {
  Map as MlMap,
  Camera,
  Marker,
  GeoJSONSource,
  Layer,
  type CameraRef,
  type MapRef,
  type MarkerEvent,
  type ViewState,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native"
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec"
import type { BBox } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../theme"
import { alpha } from "../theme/alpha"
import { Text } from "../typography"
import { useCartoApiKey } from "../data"
import { useHaptics } from "../capabilities"
import { rasterMapStyle, DEFAULT_ATTRIBUTION } from "./mapStyle"
import { TeardropPin, EventPin, ClusterBubble } from "./pins"
import { useClusters } from "./useClusters"
import { createIdleRunner, type IdleRunner } from "./clusterSchedule"
import {
  clusterFallbackZoom,
  clusterZoomTarget,
  expansionZoomOfCluster,
  WORLD_BBOX,
  type ClusterNode,
  type MapClusterIndex,
  type MapPoint,
} from "./clusterer"
import { radiusCircleFeature } from "./radiusCircle"
import { MARKER_PRESS_GUARD_MS } from "./markerFocus"
import {
  REPORT_PICK_FLY_MS,
  REPORT_PICK_MEETING_PIN_OPACITY,
  REPORT_PICK_MEETING_PIN_SIZE,
  REPORT_PICK_MUTED_OPACITY,
  REPORT_PICK_PIN_SIZE,
  REPORT_PICK_RADIUS_FILL_ALPHA,
  REPORT_PICK_RADIUS_LINE_ALPHA,
  REPORT_PICK_RADIUS_LINE_DASH,
  REPORT_PICK_RADIUS_LINE_WIDTH,
  type ReportPickMapHandle,
  type ReportPickMapProps,
} from "./ReportPickMap.types"

const RADIUS_SOURCE_ID = "report-pick-radius"

export const ReportPickMap = memo(
  forwardRef<ReportPickMapHandle, ReportPickMapProps>(function ReportPickMap(props, ref) {
    const {
      center,
      radiusM,
      zoom,
      pins,
      stateOf,
      focusedId,
      lookFor,
      pinLabel,
      clusterLabel,
      mapLabel,
      meetingPointLabel,
      onPressPin,
      onPressMap,
      onRegionChange,
      attributionBottomInset,
    } = props
    const styles = useStyles()
    const th = useTheme()
    const haptics = useHaptics()
    const hapticsRef = useRef(haptics)
    const cameraRef = useRef<CameraRef>(null)
    const mapNativeRef = useRef<MapRef>(null)
    const mapReadyRef = useRef(false)
    const lastRegionRef = useRef<{ bbox: BBox; zoom: number } | null>(null)
    const onRegionChangeRef = useRef(onRegionChange)
    const onPressPinRef = useRef(onPressPin)
    const onPressMapRef = useRef(onPressMap)
    useLayoutEffect(() => {
      hapticsRef.current = haptics
      onRegionChangeRef.current = onRegionChange
      onPressPinRef.current = onPressPin
      onPressMapRef.current = onPressMap
    })
    const markerPressedAtRef = useRef(0)

    const cartoApiKey = useCartoApiKey()
    const mapStyle = useMemo(
      () =>
        rasterMapStyle(DEFAULT_ATTRIBUTION, { cartoApiKey, scheme: th.scheme }) as
          | string
          | StyleSpecification,
      [cartoApiKey, th.scheme],
    )

    const seedRef = useRef({ center, zoom })
    const initialViewState = useMemo(
      () => ({
        center: [seedRef.current.center.lng, seedRef.current.center.lat] as [number, number],
        zoom: seedRef.current.zoom,
      }),
      [],
    )

    const points = useMemo<MapPoint[]>(
      () => pins.map((pin) => ({ kind: "report", id: pin.id, lat: pin.lat, lng: pin.lng, pin })),
      [pins],
    )
    const { index, query } = useClusters(points)
    const indexRef = useRef<MapClusterIndex>(index)
    const [nodes, setNodes] = useState<ClusterNode[]>([])
    const nodesByMarkerRef = useRef<globalThis.Map<string, ClusterNode>>(new globalThis.Map())

    const recomputeRef = useRef<() => void>(() => {})
    useLayoutEffect(() => {
      recomputeRef.current = () => {
        const region = lastRegionRef.current
        if (region) {
          setNodes(query(region.bbox, region.zoom))
          return
        }
        if (mapReadyRef.current) setNodes(query(WORLD_BBOX, seedRef.current.zoom))
      }
    })
    const runnerRef = useRef<IdleRunner | null>(null)
    if (runnerRef.current === null) runnerRef.current = createIdleRunner(() => recomputeRef.current())
    const runner = runnerRef.current

    useEffect(() => () => runner.dispose(), [runner])

    useEffect(() => {
      indexRef.current = index
      runner.flush()
    }, [index, query, runner])

    useImperativeHandle(
      ref,
      (): ReportPickMapHandle => ({
        flyTo: (lat, lng, targetZoom) => {
          cameraRef.current?.flyTo({
            center: [lng, lat],
            zoom: targetZoom ?? lastRegionRef.current?.zoom ?? seedRef.current.zoom,
            duration: REPORT_PICK_FLY_MS,
          })
        },
      }),
      [],
    )

    const commitRegion = useCallback(
      (bbox: BBox, nextZoom: number) => {
        lastRegionRef.current = { bbox, zoom: nextZoom }
        onRegionChangeRef.current(bbox, nextZoom)
        runner.request()
      },
      [runner],
    )

    const handleRegion = useCallback(
      (event: { nativeEvent: ViewStateChangeEvent }) => {
        const [west, south, east, north] = event.nativeEvent.bounds
        commitRegion({ west, south, east, north }, event.nativeEvent.zoom)
      },
      [commitRegion],
    )

    const handleMapLoad = useCallback(() => {
      mapReadyRef.current = true
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

    const handleMapPress = useCallback(() => {
      if (Date.now() - markerPressedAtRef.current < MARKER_PRESS_GUARD_MS) return
      onPressMapRef.current?.()
    }, [])

    const handlePressPin = useCallback((event: NativeSyntheticEvent<MarkerEvent>) => {
      markerPressedAtRef.current = Date.now()
      hapticsRef.current.selection()
      onPressPinRef.current(event.nativeEvent.id.slice("pick-".length))
    }, [])

    const handlePressCluster = useCallback((event: NativeSyntheticEvent<MarkerEvent>) => {
      markerPressedAtRef.current = Date.now()
      const node = nodesByMarkerRef.current.get(event.nativeEvent.id)
      if (!node || node.type !== "cluster") return
      hapticsRef.current.selection()
      const currentZoom = lastRegionRef.current?.zoom ?? seedRef.current.zoom
      const expansion =
        node.clusterId === null ? null : expansionZoomOfCluster(indexRef.current, node.clusterId)
      const target = clusterZoomTarget(node, currentZoom, expansion) ?? clusterFallbackZoom(currentZoom)
      cameraRef.current?.flyTo({
        center: [node.lng, node.lat],
        zoom: target,
        duration: REPORT_PICK_FLY_MS,
      })
    }, [])

    const markerNodes = useMemo(() => {
      const byMarker = new globalThis.Map<string, ClusterNode>()
      const rendered = nodes.map((node) => {
        const markerId = node.type === "cluster" ? node.key : `pick-${node.id}`
        byMarker.set(markerId, node)
        return { node, markerId }
      })
      return { rendered, byMarker }
    }, [nodes])

    useEffect(() => {
      nodesByMarkerRef.current = markerNodes.byMarker
    }, [markerNodes])

    const radiusFeature = useMemo(() => radiusCircleFeature(center, radiusM), [center, radiusM])
    const radiusFill = alpha(th.colors.brand.bloom, REPORT_PICK_RADIUS_FILL_ALPHA)
    const radiusLine = alpha(th.colors.brand.bloom, REPORT_PICK_RADIUS_LINE_ALPHA)

    return (
      <View style={styles.container} accessibilityLabel={mapLabel}>
        <MlMap
          ref={mapNativeRef}
          style={styles.map}
          mapStyle={mapStyle}
          logo={false}
          compass={false}
          attribution={false}
          touchRotate={false}
          touchPitch={false}
          onDidFinishLoadingMap={handleMapLoad}
          onRegionDidChange={handleRegion}
          onPress={handleMapPress}
        >
          <Camera ref={cameraRef} initialViewState={initialViewState} />

          <GeoJSONSource id={RADIUS_SOURCE_ID} data={radiusFeature}>
            <Layer
              id={`${RADIUS_SOURCE_ID}-fill`}
              type="fill"
              paint={{ "fill-color": radiusFill }}
            />
            <Layer
              id={`${RADIUS_SOURCE_ID}-line`}
              type="line"
              paint={{
                "line-color": radiusLine,
                "line-width": REPORT_PICK_RADIUS_LINE_WIDTH,
                "line-dasharray": REPORT_PICK_RADIUS_LINE_DASH,
              }}
            />
          </GeoJSONSource>

          <Marker id="meeting-point" lngLat={[center.lng, center.lat]} anchor="bottom">
            <View
              accessible
              accessibilityLabel={meetingPointLabel}
              style={styles.meetingPin}
              pointerEvents="none"
            >
              <EventPin size={REPORT_PICK_MEETING_PIN_SIZE} />
            </View>
          </Marker>

          {markerNodes.rendered.map(({ node, markerId }) => {
            if (node.type === "cluster") {
              return (
                <Marker key={node.key} id={markerId} lngLat={[node.lng, node.lat]} onPress={handlePressCluster}>
                  <View accessible accessibilityRole="button" accessibilityLabel={clusterLabel(node.count)}>
                    <ClusterBubble count={node.count} />
                  </View>
                </Marker>
              )
            }
            if (node.type !== "report") return null
            const state = stateOf(node.id)
            const look = lookFor(state, focusedId === node.id)
            return (
              <Marker key={node.key} id={markerId} lngLat={[node.lng, node.lat]} anchor="bottom" onPress={handlePressPin}>
                <View
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={pinLabel(node.pin, state)}
                  accessibilityState={{ selected: state === "selected" || state === "linked" }}
                  style={look.muted ? styles.mutedPin : null}
                >
                  <TeardropPin
                    category={node.pin.category}
                    size={REPORT_PICK_PIN_SIZE}
                    active={look.active}
                    badge={look.badge}
                  />
                </View>
              </Marker>
            )
          })}
        </MlMap>

        <Text
          style={[
            styles.credit,
            attributionBottomInset != null ? { bottom: attributionBottomInset } : null,
          ]}
          pointerEvents="none"
        >
          {DEFAULT_ATTRIBUTION}
        </Text>
      </View>
    )
  }),
)

const useStyles = makeThemedStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.colors.bgAlt,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  meetingPin: {
    alignItems: "center",
    justifyContent: "center",
    opacity: REPORT_PICK_MEETING_PIN_OPACITY,
  },
  mutedPin: {
    opacity: REPORT_PICK_MUTED_OPACITY,
  },
  credit: {
    position: "absolute",
    bottom: t.space["1"],
    right: 6,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 9,
    color: t.colors.textSubtle,
  },
}))
