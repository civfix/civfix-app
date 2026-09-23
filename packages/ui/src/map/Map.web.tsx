import * as React from "react"
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl"
import { createRoot, type Root } from "react-dom/client"
import type { BBox } from "@civfix/shared"
import {
  useLayoutMode,
  useTheme,
  ThemeProvider,
  FOCUS_RING_COLOR,
  FOCUS_RING_OFFSET,
  FOCUS_RING_OUTLINE,
  type ColorSchemeName,
} from "../theme"
import { useT } from "../i18n"
import { useCartoApiKey } from "../data"
import { useNavStore } from "../nav"
import { expandedFramePlan } from "../shell/expandedFramePlan"
import { clampSidebarWidth, useSidebarStore } from "../shell/sidebarStore"
import { rasterMapStyle, DEFAULT_ATTRIBUTION } from "./mapStyle"
import {
  TeardropPin,
  EventPin,
  BlendPin,
  ClusterBubble,
  DropPin,
  pinAppearanceFor,
  clusterToneFor,
} from "./pins"
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
import { makePinElement, applyPinElementTheme } from "./LocationPicker.web"
import { occludedCenterLng } from "./dropPinCamera"
import type { ClusterNode, MapClusterIndex } from "./clusterer"
import type { MapProps, MapHandle } from "./types"

const MAP_FOCUS_STYLE_ID = "civfix-map-focus-ring"
const CANVAS_RING_INSET = -3
let mapFocusStyleInjected = false

function ensureMapFocusRingStyle(): void {
  if (mapFocusStyleInjected || typeof document === "undefined") return
  mapFocusStyleInjected = true
  if (document.getElementById(MAP_FOCUS_STYLE_ID)) return
  const el = document.createElement("style")
  el.id = MAP_FOCUS_STYLE_ID
  el.textContent =
    `.cf-map-canvas canvas:focus-visible{outline:2px solid ${FOCUS_RING_COLOR};` +
    `outline-offset:${CANVAS_RING_INSET}px;}` +
    `.cf-map-canvas .maplibregl-ctrl button:focus-visible,` +
    `.cf-map-canvas .maplibregl-ctrl summary:focus-visible,` +
    `.cf-map-canvas .maplibregl-marker:focus-visible{` +
    `outline:${FOCUS_RING_OUTLINE};outline-offset:${FOCUS_RING_OFFSET}px;}`
  document.head.appendChild(el)
}

const FLYTO_ZOOM = 13
const FOCUS_ZOOM = 16

const LONG_PRESS_MS = 500
const LONG_PRESS_SLOP_PX = 10
const LONG_PRESS_DEDUPE_MS = 700
const CLUSTER_FLY_MS = 450
const NO_REPORTS: MapProps["reports"] = []
const NO_CLEANUPS: MapProps["cleanups"] = []
const NO_AGGREGATES: MapProps["reportAggregates"] = []

function shellOcclusionLeft(): number {
  const { view, stack } = useNavStore.getState()
  return expandedFramePlan({
    view,
    stackLength: stack.length,
    sidebarWidth: clampSidebarWidth(useSidebarStore.getState().width, window.innerWidth),
  }).occlusionLeft
}

function mapBoundsToBBox(map: MlMap): BBox {
  const b = map.getBounds()
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }
}

interface MarkerEntry {
  marker: Marker
  root: Root
  signature: string
  onClick: { fn?: () => void }
}

interface Desired {
  signature: string
  anchor: "bottom" | "center"
  lngLat: [number, number]
  node: React.ReactNode
  label: string
  onClick?: () => void
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
    mapStyle,
    initialCenter,
  } = props

  const points = React.useMemo(
    () => mapPointsFor({ reports, cleanups, aggregates: reportAggregates }),
    [reports, cleanups, reportAggregates],
  )

  const cartoApiKey = useCartoApiKey()
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
  themeRef.current = th
  const pickActive = useLocationPick((s) => s.active)
  const pickDraft = useLocationPick((s) => s.draft)
  const pickPin = useLocationPick((s) => s.pin)
  const pickActiveRef = React.useRef(pickActive)
  pickActiveRef.current = pickActive

  const focus = useMapFocus((s) => s.focus)
  const flyToRequest = useMapFlyTo((s) => s.request)
  const flyToHighlight = useMapFlyTo((s) => s.highlight)
  const { pinId: activePinId, cleanupId: activeCleanupId } = activeMarkerIds(
    focusedPinId,
    focusedCleanupId,
    flyToHighlight,
  )

  const onRegionChangeRef = React.useRef(onRegionChange)
  onRegionChangeRef.current = onRegionChange
  const onUserCameraMoveRef = React.useRef(onUserCameraMove)
  onUserCameraMoveRef.current = onUserCameraMove
  const onPressMapRef = React.useRef(onPressMap)
  onPressMapRef.current = onPressMap
  const onPressPinRef = React.useRef(onPressPin)
  onPressPinRef.current = onPressPin
  const onPressCleanupRef = React.useRef(onPressCleanup)
  onPressCleanupRef.current = onPressCleanup
  const userLocationRef = React.useRef(userLocation)
  userLocationRef.current = userLocation
  const onPressClusterRef = React.useRef(onPressCluster)
  onPressClusterRef.current = onPressCluster
  const onPressBlendRef = React.useRef(onPressBlend)
  onPressBlendRef.current = onPressBlend
  const onLongPressMapRef = React.useRef(onLongPressMap)
  onLongPressMapRef.current = onLongPressMap
  const modeRef = React.useRef(mode)
  modeRef.current = mode

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
  reconcileRef.current = () => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const scheme = themeRef.current.scheme
    const desired = new globalThis.Map<string, Desired>()
    const put = (key: string, want: Desired) =>
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

    const current = markersRef.current
    for (const [key, entry] of current) {
      const want = desired.get(key)
      if (!want || want.signature !== entry.signature) {
        const stale = entry.root
        queueMicrotask(() => stale.unmount())
        entry.marker.remove()
        current.delete(key)
      } else {
        entry.marker.setLngLat(want.lngLat)
        entry.marker.getElement().setAttribute("aria-label", want.label)
        entry.onClick.fn = want.onClick
      }
    }
    for (const [key, want] of desired) {
      if (current.has(key)) continue
      const el = document.createElement("div")
      el.style.cursor = want.onClick ? "pointer" : "default"
      el.style.lineHeight = "0"
      el.setAttribute("role", "button")
      el.setAttribute("tabindex", "0")
      const onClick: { fn?: () => void } = { fn: want.onClick }
      el.addEventListener("click", (e: MouseEvent) => {
        e.stopPropagation()
        useMapFlyTo.getState().clear()
        onClick.fn?.()
      })
      el.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        e.stopPropagation()
        useMapFlyTo.getState().clear()
        onClick.fn?.()
      })
      const root = createRoot(el)
      root.render(want.node)
      const marker = new maplibregl.Marker({ element: el, anchor: want.anchor })
        .setLngLat(want.lngLat)
        .addTo(map)
      // After addTo: maplibre's addTo overwrites aria-label with its generic "Map marker".
      el.setAttribute("aria-label", want.label)
      current.set(key, { marker, root, signature: want.signature, onClick })
    }
  }

  React.useImperativeHandle(
    ref,
    (): MapHandle => ({
      flyTo: (lat, lng, zoom) => {
        const map = mapRef.current
        if (!map) return
        map.easeTo({ center: [lng, lat], zoom: zoom ?? Math.max(map.getZoom(), FLYTO_ZOOM), duration: 600 })
      },
      recenter: () => {
        const map = mapRef.current
        const loc = userLocationRef.current
        if (!map || !loc) return
        map.easeTo({ center: [loc.lng, loc.lat], zoom: FLYTO_ZOOM, duration: 600 })
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
      style: (mapStyle ??
        rasterMapStyle(DEFAULT_ATTRIBUTION, {
          cartoApiKey,
          scheme: themeRef.current.scheme,
        })) as maplibregl.StyleSpecification,
      center: [seed.lng, seed.lat] as [number, number],
      zoom: seed.zoom ?? FLYTO_ZOOM,
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

    const blockedTarget = (target: EventTarget | null): boolean => {
      if (pickActiveRef.current) return true
      return target instanceof Element && target.closest(".maplibregl-marker") !== null
    }
    let lastFireAt = 0
    const fire = (lat: number, lng: number, target: EventTarget | null) => {
      if (!onLongPressMapRef.current) return
      if (blockedTarget(target)) return
      if (Date.now() - lastFireAt < LONG_PRESS_DEDUPE_MS) return
      lastFireAt = Date.now()
      onLongPressMapRef.current(lat, lng)
    }
    map.on("click", (e) => {
      if (pickActiveRef.current) {
        useLocationPick.getState().setDraft(e.lngLat.lat, e.lngLat.lng)
        return
      }
      onPressMapRef.current?.()
      if (modeRef.current === "expanded") fire(e.lngLat.lat, e.lngLat.lng, e.originalEvent.target)
    })
    map.on("contextmenu", (e) => fire(e.lngLat.lat, e.lngLat.lng, e.originalEvent.target))

    let pressTimer: ReturnType<typeof setTimeout> | null = null
    let pressOrigin: { x: number; y: number } | null = null
    const cancelPress = () => {
      if (pressTimer !== null) clearTimeout(pressTimer)
      pressTimer = null
      pressOrigin = null
    }
    map.on("touchstart", (e) => {
      cancelPress()
      if (e.points.length !== 1) return
      pressOrigin = { x: e.point.x, y: e.point.y }
      const { lat, lng } = e.lngLat
      const target = e.originalEvent.target
      pressTimer = setTimeout(() => {
        pressTimer = null
        pressOrigin = null
        fire(lat, lng, target)
      }, LONG_PRESS_MS)
    })
    map.on("touchmove", (e) => {
      if (!pressOrigin) return
      if (Math.hypot(e.point.x - pressOrigin.x, e.point.y - pressOrigin.y) > LONG_PRESS_SLOP_PX) cancelPress()
    })
    map.on("touchend", cancelPress)
    map.on("touchcancel", cancelPress)

    mapRef.current = map
    useLocationPick.getState().setMapRegistered(true)
    return () => {
      cancelPress()
      runner.dispose()
      useLocationPick.getState().setMapRegistered(false)
      useMapViewport.getState().clear()
      map.remove()
      mapRef.current = null
      for (const entry of markers.values()) {
        const r = entry.root
        queueMicrotask(() => r.unmount())
      }
      markers.clear()
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
  }, [])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (mode === "expanded") {
      if (!navCtrlRef.current) {
        navCtrlRef.current = new maplibregl.NavigationControl({ showCompass: false })
        map.addControl(navCtrlRef.current, "bottom-right")
      }
      if (attribCtrlRef.current) {
        map.removeControl(attribCtrlRef.current)
        attribCtrlRef.current = null
      }
      attribCtrlRef.current = new maplibregl.AttributionControl({ compact: true })
      map.addControl(attribCtrlRef.current, "bottom-left")
    } else {
      if (navCtrlRef.current) {
        map.removeControl(navCtrlRef.current)
        navCtrlRef.current = null
      }
      if (attribCtrlRef.current) {
        map.removeControl(attribCtrlRef.current)
        attribCtrlRef.current = null
      }
      attribCtrlRef.current = new maplibregl.AttributionControl({ compact: false })
      map.addControl(attribCtrlRef.current, "bottom-left")
    }
  }, [mapReady, mode])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const show = showUserLocation && userLocation != null
    if (!show) {
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      return
    }
    if (!userMarkerRef.current) {
      const el = document.createElement("div")
      el.className = "cf-map-user-dot"
      el.setAttribute("role", "img")
      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([userLocation!.lng, userLocation!.lat])
        .addTo(map)
      el.setAttribute("aria-label", t("a11y.userLocation"))
    } else {
      userMarkerRef.current.setLngLat([userLocation!.lng, userLocation!.lat])
      userMarkerRef.current.getElement().setAttribute("aria-label", t("a11y.userLocation"))
    }
  }, [mapReady, showUserLocation, userLocation, t])

  const pickStartedRef = React.useRef(false)
  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (!pickActive) {
      pickMarkerRef.current?.remove()
      pickMarkerRef.current = null
      pickStartedRef.current = false
      return
    }
    if (!pickStartedRef.current) {
      pickStartedRef.current = true
      if (pickDraft) {
        const zoom = Math.max(map.getZoom(), FLYTO_ZOOM)
        const lng = mode === "compact" ? pickDraft.lng : occludedCenterLng(pickDraft.lng, shellOcclusionLeft(), zoom)
        map.easeTo({ center: [lng, pickDraft.lat], zoom, duration: 500 })
      }
    }
    if (!pickDraft) {
      pickMarkerRef.current?.remove()
      pickMarkerRef.current = null
      return
    }
    const pickFill = pinAppearanceFor(pickPin, th.scheme).fill
    if (!pickMarkerRef.current) {
      pickMarkerRef.current = new maplibregl.Marker({
        element: makePinElement(themeRef.current, pickFill),
        anchor: "bottom",
      })
        .setLngLat([pickDraft.lng, pickDraft.lat])
        .addTo(map)
    } else {
      pickMarkerRef.current.setLngLat([pickDraft.lng, pickDraft.lat])
      applyPinElementTheme(pickMarkerRef.current.getElement(), themeRef.current, pickFill)
    }
  }, [mapReady, pickActive, pickDraft, pickPin, mode, th.scheme])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (!droppedPin) {
      dropMarkerRef.current?.remove()
      dropMarkerRef.current = null
      const stale = dropRootRef.current
      dropRootRef.current = null
      if (stale) queueMicrotask(() => stale.unmount())
      return
    }
    if (!dropMarkerRef.current) {
      const el = document.createElement("div")
      el.style.lineHeight = "0"
      el.style.pointerEvents = "none"
      el.setAttribute("role", "img")
      const root = createRoot(el)
      root.render(
        <ThemeProvider preference={th.scheme}>
          <DropPin />
        </ThemeProvider>,
      )
      dropRootRef.current = root
      dropMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([droppedPin.lng, droppedPin.lat])
        .addTo(map)
      el.setAttribute("aria-label", t("dropPin.locationA11y"))
    } else {
      dropMarkerRef.current.setLngLat([droppedPin.lng, droppedPin.lat])
      dropMarkerRef.current.getElement().setAttribute("aria-label", t("dropPin.locationA11y"))
      dropRootRef.current?.render(
        <ThemeProvider preference={th.scheme}>
          <DropPin />
        </ThemeProvider>,
      )
    }
  }, [mapReady, droppedPin, t, th.scheme])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || mapStyle || styleSchemeRef.current === th.scheme) return
    styleSchemeRef.current = th.scheme
    map.setStyle(
      rasterMapStyle(DEFAULT_ATTRIBUTION, {
        cartoApiKey,
        scheme: th.scheme,
      }) as maplibregl.StyleSpecification,
    )
  }, [mapReady, mapStyle, cartoApiKey, th.scheme])

  React.useEffect(() => {
    indexRef.current = index
    if (mapReady) runner.flush()
  }, [runner, mapReady, index, points, activePinId, activeCleanupId, flyToHighlight, focus, th.scheme])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !focus) return
    const lng =
      mode === "compact" ? focus.lng : occludedCenterLng(focus.lng, shellOcclusionLeft(), FOCUS_ZOOM)
    map.easeTo({ center: [lng, focus.lat], zoom: FOCUS_ZOOM, duration: 600 })
  }, [mapReady, mode, focus])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !flyToRequest) return
    const lng =
      mode === "compact"
        ? flyToRequest.lng
        : occludedCenterLng(flyToRequest.lng, shellOcclusionLeft(), FOCUS_ZOOM)
    map.easeTo({ center: [lng, flyToRequest.lat], zoom: FOCUS_ZOOM, duration: 600 })
    useMapFlyTo.getState().consume(flyToRequest.generation)
  }, [mapReady, mode, flyToRequest])

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
