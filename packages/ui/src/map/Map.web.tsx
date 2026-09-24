import * as React from "react"
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl"
import type { Root } from "react-dom/client"
import type { BBox } from "@civfix/shared"
import { useLayoutMode, useTheme, ThemeProvider, type ColorSchemeName } from "../theme"
import { useT } from "../i18n"
import { useCartoApiKey } from "../data"
import { rasterMapStyle, DEFAULT_ATTRIBUTION } from "./mapStyle"
import { TeardropPin, EventPin, BlendPin, ClusterBubble, clusterToneFor } from "./pins"
import { useClusters } from "./useClusters"
import { mapPointsFor } from "./mapPoints"
import { createIdleRunner, type IdleRunner } from "./clusterSchedule"
import {
  clusterFallbackZoom,
  clusterListReports,
  clusterZoomTarget,
  expansionZoomOfCluster,
} from "./clusterer"
import { useLocationPick } from "./locationPickStore"
import { useMapFocus, type FocusedEntity } from "./mapFocusStore"
import { useMapViewport } from "./mapViewportStore"
import { useDroppedPin } from "./droppedPinStore"
import { useMapFlyTo } from "./mapFlyToStore"
import { activeMarkerIds, flyToTargetOffMap, markerA11yLabel, targetMarkerA11yLabel } from "./markerFocus"
import { CAMERA_EASE_MS, CLUSTER_FLY_MS, DEFAULT_ZOOM } from "./mapCamera"
import { ensureMapFocusRingStyle } from "./mapFocusRing.web"
import { disposeMarkers, syncMarkers, type DesiredMarker, type MarkerEntry } from "./homeMapMarkers.web"
import { attachPressGestures } from "./mapPressGestures.web"
import { useFocusAndFlyToCamera } from "./homeMapCamera.web"
import { useDropPinMarker, useModeMapControls, usePickMarker, useUserLocationDot } from "./homeMapOverlays.web"
import type { ClusterNode, MapClusterIndex } from "./clusterer"
import type { MapProps, MapHandle } from "./types"

const NO_REPORTS: MapProps["reports"] = []
const NO_CLEANUPS: MapProps["cleanups"] = []
const NO_AGGREGATES: MapProps["reportAggregates"] = []

function mapBoundsToBBox(map: MlMap): BBox {
  const b = map.getBounds()
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }
}

export const Map = React.forwardRef<MapHandle, MapProps>(function Map(props, ref) {
  const { t } = useT("map-ui")
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
    occlusionLeft,
    initialCenter,
  } = props

  const points = React.useMemo(
    () => mapPointsFor({ reports, cleanups, aggregates: reportAggregates }),
    [reports, cleanups, reportAggregates],
  )

  const cartoApiKey = useCartoApiKey()
  // The map is built once; a later key reaches it through the style-swap effect, not a rebuild.
  const cartoApiKeyRef = React.useRef(cartoApiKey)
  React.useLayoutEffect(() => {
    cartoApiKeyRef.current = cartoApiKey
  })
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<MlMap | null>(null)
  const markersRef = React.useRef<globalThis.Map<string, MarkerEntry>>(new globalThis.Map())
  const userMarkerRef = React.useRef<Marker | null>(null)
  const pickMarkerRef = React.useRef<Marker | null>(null)
  const navCtrlRef = React.useRef<maplibregl.NavigationControl | null>(null)
  const attribCtrlRef = React.useRef<maplibregl.AttributionControl | null>(null)
  const [mapReady, setMapReady] = React.useState(false)
  const initialCenterRef = React.useRef(initialCenter)
  const mode = useLayoutMode()
  const th = useTheme()
  const themeRef = React.useRef(th)
  const pickActive = useLocationPick((s) => s.active)
  const pickActiveRef = React.useRef(pickActive)

  const focus = useMapFocus((s) => s.focus)
  const flyToRequest = useMapFlyTo((s) => s.request)
  const flyToHighlight = useMapFlyTo((s) => s.highlight)
  const { pinId: activePinId, cleanupId: activeCleanupId } = activeMarkerIds(
    focusedPinId,
    focusedCleanupId,
    flyToHighlight,
  )

  const onRegionChangeRef = React.useRef(onRegionChange)
  const onUserCameraMoveRef = React.useRef(onUserCameraMove)
  const onPressMapRef = React.useRef(onPressMap)
  const onPressPinRef = React.useRef(onPressPin)
  const onPressCleanupRef = React.useRef(onPressCleanup)
  const userLocationRef = React.useRef(userLocation)
  const onPressClusterRef = React.useRef(onPressCluster)
  const onPressBlendRef = React.useRef(onPressBlend)
  const onLongPressMapRef = React.useRef(onLongPressMap)
  const occlusionLeftRef = React.useRef(occlusionLeft)
  const modeRef = React.useRef(mode)
  React.useLayoutEffect(() => {
    themeRef.current = th
    pickActiveRef.current = pickActive
    onRegionChangeRef.current = onRegionChange
    onUserCameraMoveRef.current = onUserCameraMove
    onPressMapRef.current = onPressMap
    onPressPinRef.current = onPressPin
    onPressCleanupRef.current = onPressCleanup
    userLocationRef.current = userLocation
    onPressClusterRef.current = onPressCluster
    onPressBlendRef.current = onPressBlend
    onLongPressMapRef.current = onLongPressMap
    occlusionLeftRef.current = occlusionLeft
    modeRef.current = mode
  })

  const droppedPin = useDroppedPin((s) => s.pin)
  const dropMarkerRef = React.useRef<Marker | null>(null)
  const dropRootRef = React.useRef<Root | null>(null)
  const styleSchemeRef = React.useRef<ColorSchemeName | null>(null)

  const { index, query } = useClusters(points)
  const indexRef = React.useRef<MapClusterIndex>(index)

  const pressCluster = React.useCallback(
    (node: Extract<ClusterNode, { type: "cluster" }>) => {
      const map = mapRef.current
      if (!map) return
      const currentZoom = map.getZoom()
      const expansion =
        node.clusterId === null ? null : expansionZoomOfCluster(indexRef.current, node.clusterId)
      const target = clusterZoomTarget(node, currentZoom, expansion)
      const flyToCluster = (zoom: number) =>
        map.easeTo({ center: [node.lng, node.lat], zoom, duration: CLUSTER_FLY_MS })
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
    },
    [],
  )

  const reconcileRef = React.useRef<() => void>(() => {})
  const runnerRef = React.useRef<IdleRunner | null>(null)
  if (runnerRef.current === null) runnerRef.current = createIdleRunner(() => reconcileRef.current())
  const runner = runnerRef.current
  React.useLayoutEffect(() => {
    reconcileRef.current = () => {
      const map = mapRef.current
      if (!map || !mapReady) return

      const scheme = themeRef.current.scheme
      const desired = new globalThis.Map<string, DesiredMarker>()
      const put = (key: string, want: DesiredMarker) =>
        desired.set(key, {
          ...want,
          signature: `${want.signature}|${scheme}`,
          node: <ThemeProvider preference={scheme}>{want.node}</ThemeProvider>,
        })

      const putTargetMarker = (target: FocusedEntity) => {
        if (target.kind === "cleanup") {
          put(`e:${target.id}`, {
            signature: `${target.eventKind}|1`,
            anchor: "bottom",
            lngLat: [target.lng, target.lat],
            node: <EventPin active eventKind={target.eventKind} />,
            label: targetMarkerA11yLabel(target, t),
            onClick: () => onPressCleanupRef.current?.(target.id),
          })
        } else {
          put(`r:${target.id}`, {
            signature: `${target.category}|1`,
            anchor: "bottom",
            lngLat: [target.lng, target.lat],
            node: <TeardropPin category={target.category} active />,
            label: targetMarkerA11yLabel(target, t),
            onClick: () => onPressPinRef.current?.(target.id),
          })
        }
      }

      const focused = useMapFocus.getState().focus
      if (focused) {
        putTargetMarker(focused)
      } else {
        const nodes = query(mapBoundsToBBox(map), map.getZoom())
        for (const node of nodes) {
          if (node.type === "cluster") {
            const tone = clusterToneFor(node.reportCount, node.eventCount)
            put(node.key, {
              signature: `${node.count}|${tone}`,
              anchor: "center",
              lngLat: [node.lng, node.lat],
              node: <ClusterBubble count={node.count} tone={tone} />,
              label: markerA11yLabel(node, t),
              onClick: () => pressCluster(node),
            })
          } else if (node.type === "report") {
            const active = activePinId === node.id
            put(node.key, {
              signature: `${node.pin.category}|${active ? 1 : 0}`,
              anchor: "bottom",
              lngLat: [node.lng, node.lat],
              node: <TeardropPin category={node.pin.category} active={active} />,
              label: markerA11yLabel(node, t),
              onClick: () => onPressPinRef.current?.(node.id),
            })
          } else if (node.type === "event") {
            const active = activeCleanupId === node.id
            put(node.key, {
              signature: `${node.event.eventKind}|${active ? 1 : 0}`,
              anchor: "bottom",
              lngLat: [node.lng, node.lat],
              node: <EventPin active={active} eventKind={node.event.eventKind} />,
              label: markerA11yLabel(node, t),
              onClick: () => onPressCleanupRef.current?.(node.id),
            })
          } else {
            const active = activeCleanupId === node.id
            const event = node.event
            const blendReports = node.reports
            put(node.key, {
              signature: `${event.eventKind}|${blendReports.length}|${active ? 1 : 0}`,
              anchor: "bottom",
              lngLat: [node.lng, node.lat],
              node: (
                <BlendPin count={blendReports.length} active={active} eventKind={event.eventKind} />
              ),
              label: markerA11yLabel(node, t),
              onClick: () =>
                onPressBlendRef.current
                  ? onPressBlendRef.current(event, blendReports)
                  : onPressCleanupRef.current?.(event.id),
            })
          }
        }
        const offMapTarget = flyToTargetOffMap(nodes, flyToHighlight)
        if (offMapTarget) putTargetMarker(offMapTarget)
      }

      syncMarkers(map, markersRef.current, desired)
    }
  })

  React.useImperativeHandle(
    ref,
    (): MapHandle => ({
      flyTo: (lat, lng, zoom) => {
        const map = mapRef.current
        if (!map) return
        map.easeTo({
          center: [lng, lat],
          zoom: zoom ?? Math.max(map.getZoom(), DEFAULT_ZOOM),
          duration: CAMERA_EASE_MS,
        })
      },
      recenter: () => {
        const map = mapRef.current
        const loc = userLocationRef.current
        if (!map || !loc) return
        map.easeTo({ center: [loc.lng, loc.lat], zoom: DEFAULT_ZOOM, duration: CAMERA_EASE_MS })
      },
    }),
    [],
  )

  React.useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    ensureMapFocusRingStyle()
    const markers = markersRef.current
    const seed = initialCenterRef.current

    styleSchemeRef.current = themeRef.current.scheme
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: rasterMapStyle(DEFAULT_ATTRIBUTION, {
        cartoApiKey: cartoApiKeyRef.current,
        scheme: themeRef.current.scheme,
      }) as maplibregl.StyleSpecification,
      center: [seed.lng, seed.lat] as [number, number],
      zoom: seed.zoom ?? DEFAULT_ZOOM,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()

    const syncViewport = () => {
      const bbox = mapBoundsToBBox(map)
      const zoom = map.getZoom()
      onRegionChangeRef.current?.(bbox, zoom)
      useMapViewport.getState().setRegion(bbox, zoom)
      runner.request()
    }

    map.on("load", () => {
      setMapReady(true)
      syncViewport()
    })
    map.on("moveend", syncViewport)
    const endFlyToOnUserGesture = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent) return
      useMapFlyTo.getState().clear()
      onUserCameraMoveRef.current?.()
    }
    map.on("movestart", endFlyToOnUserGesture)
    map.on("wheel", endFlyToOnUserGesture)

    const cancelPress = attachPressGestures(map, {
      pickActive: () => pickActiveRef.current,
      expanded: () => modeRef.current === "expanded",
      onPressMap: () => onPressMapRef.current?.(),
      longPressHandler: () => onLongPressMapRef.current,
    })

    mapRef.current = map
    useLocationPick.getState().setMapRegistered(true)
    return () => {
      cancelPress()
      runner.dispose()
      useLocationPick.getState().setMapRegistered(false)
      useMapViewport.getState().clear()
      map.remove()
      mapRef.current = null
      disposeMarkers(markers)
      const dropRoot = dropRootRef.current
      if (dropRoot) queueMicrotask(() => dropRoot.unmount())
      dropRootRef.current = null
      dropMarkerRef.current = null
      userMarkerRef.current = null
      pickMarkerRef.current = null
      navCtrlRef.current = null
      attribCtrlRef.current = null
      setMapReady(false)
    }
  }, [runner])

  useModeMapControls(mapRef, mapReady, mode, navCtrlRef, attribCtrlRef)
  useUserLocationDot(mapRef, mapReady, userMarkerRef, showUserLocation, userLocation, t)
  usePickMarker(mapRef, mapReady, pickMarkerRef, pickActive, mode, themeRef, th.scheme, occlusionLeftRef)
  useDropPinMarker(mapRef, mapReady, dropMarkerRef, dropRootRef, droppedPin, th.scheme, t)

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || styleSchemeRef.current === th.scheme) return
    styleSchemeRef.current = th.scheme
    map.setStyle(
      rasterMapStyle(DEFAULT_ATTRIBUTION, {
        cartoApiKey,
        scheme: th.scheme,
      }) as maplibregl.StyleSpecification,
    )
  }, [mapReady, cartoApiKey, th.scheme])

  React.useEffect(() => {
    indexRef.current = index
    if (mapReady) runner.flush()
  }, [runner, mapReady, index, points, activePinId, activeCleanupId, flyToHighlight, focus, th.scheme])

  useFocusAndFlyToCamera(mapRef, mapReady, mode, focus, flyToRequest, occlusionLeftRef)

  return (
    <div className="cf-map-wrap" style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        className="cf-map-canvas"
        ref={containerRef}
        role="region"
        aria-label={t("a11y.homeMap")}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  )
})
