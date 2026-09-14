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
import { TeardropPin, EventPin, BlendPin, ClusterBubble, DropPin } from "./pins"
import { useClusters } from "./useClusters"
import { computeMapBlends } from "./blend"
import { useLocationPick } from "./locationPickStore"
import { useMapFocus } from "./mapFocusStore"
import { useMapViewport } from "./mapViewportStore"
import { useDroppedPin } from "./droppedPinStore"
import { makePinElement, applyPinElementTheme } from "./LocationPicker.web"
import { occludedCenterLng } from "./dropPinCamera"
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
    `.cf-map-canvas .maplibregl-ctrl summary:focus-visible{` +
    `outline:${FOCUS_RING_OUTLINE};outline-offset:${FOCUS_RING_OFFSET}px;}`
  document.head.appendChild(el)
}

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283]
const DEFAULT_ZOOM = 4
const FLYTO_ZOOM = 13
const FOCUS_ZOOM = 16

const LONG_PRESS_MS = 500
const LONG_PRESS_SLOP_PX = 10
const LONG_PRESS_DEDUPE_MS = 700

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
  onClick?: () => void
}

export const Map = React.forwardRef<MapHandle, MapProps>(function Map(props, ref) {
  const { t } = useT("map-ui")
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

  const { blends, standaloneReports, standaloneCleanups } = React.useMemo(
    () => computeMapBlends(reports, cleanups),
    [reports, cleanups],
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
  const pickActiveRef = React.useRef(pickActive)
  pickActiveRef.current = pickActive

  const focus = useMapFocus((s) => s.focus)

  const onRegionChangeRef = React.useRef(onRegionChange)
  onRegionChangeRef.current = onRegionChange
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

  const { query, leaves } = useClusters(standaloneReports)

  const reconcileRef = React.useRef<() => void>(() => {})
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

    if (useMapFocus.getState().focus) {
      const f = useMapFocus.getState().focus!
      if (f.kind === "cleanup") {
        put(`cleanup:${f.id}`, {
          signature: `${f.eventKind}|1|focus`,
          anchor: "bottom",
          lngLat: [f.lng, f.lat],
          node: <EventPin active eventKind={f.eventKind} />,
          onClick: () => onPressCleanupRef.current?.(f.id),
        })
      } else {
        put(`pin:${f.id}`, {
          signature: `${f.category}|1|focus`,
          anchor: "bottom",
          lngLat: [f.lng, f.lat],
          node: <TeardropPin category={f.category} active />,
          onClick: () => onPressPinRef.current?.(f.id),
        })
      }
    } else {
      const nodes = query(mapBoundsToBBox(map), map.getZoom())
      for (const node of nodes) {
        if (node.type === "cluster") {
          put(`cluster:${node.clusterId}`, {
            signature: `${node.count}`,
            anchor: "center",
            lngLat: [node.lng, node.lat],
            node: <ClusterBubble count={node.count} />,
            onClick: () => onPressClusterRef.current?.(leaves(node.clusterId)),
          })
        } else {
          const active = focusedPinId === node.id
          put(`pin:${node.id}`, {
            signature: `${node.pin.category}|${active ? 1 : 0}`,
            anchor: "bottom",
            lngLat: [node.lng, node.lat],
            node: <TeardropPin category={node.pin.category} active={active} />,
            onClick: () => onPressPinRef.current?.(node.id),
          })
        }
      }
      for (const c of standaloneCleanups) {
        const active = focusedCleanupId === c.id
        put(`cleanup:${c.id}`, {
          signature: `${c.eventKind}|${active ? 1 : 0}`,
          anchor: "bottom",
          lngLat: [c.lng, c.lat],
          node: <EventPin active={active} eventKind={c.eventKind} />,
          onClick: () => onPressCleanupRef.current?.(c.id),
        })
      }
      for (const b of blends) {
        const active = focusedCleanupId === b.event.id
        put(`blend:${b.event.id}`, {
          signature: `${b.event.eventKind}|${b.reports.length}|${active ? 1 : 0}`,
          anchor: "bottom",
          lngLat: [b.event.lng, b.event.lat],
          node: <BlendPin count={b.reports.length} active={active} eventKind={b.event.eventKind} />,
          onClick: () =>
            onPressBlendRef.current
              ? onPressBlendRef.current(b.event, b.reports)
              : onPressCleanupRef.current?.(b.event.id),
        })
      }
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
        entry.onClick.fn = want.onClick
      }
    }
    for (const [key, want] of desired) {
      if (current.has(key)) continue
      const el = document.createElement("div")
      el.style.cursor = want.onClick ? "pointer" : "default"
      el.style.lineHeight = "0"
      const onClick: { fn?: () => void } = { fn: want.onClick }
      el.addEventListener("click", (e: MouseEvent) => {
        e.stopPropagation()
        onClick.fn?.()
      })
      const root = createRoot(el)
      root.render(want.node)
      const marker = new maplibregl.Marker({ element: el, anchor: want.anchor })
        .setLngLat(want.lngLat)
        .addTo(map)
      current.set(key, { marker, root, signature: want.signature, onClick })
    }
  }

  React.useImperativeHandle(
    ref,
    (): MapHandle => ({
      flyTo: (lat, lng, zoom) => {
        const map = mapRef.current
        if (!map) return
        map.easeTo({ center: [lng, lat], zoom: zoom ?? FLYTO_ZOOM, duration: 600 })
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
      center: seed ? [seed.lng, seed.lat] : DEFAULT_CENTER,
      zoom: seed ? seed.zoom ?? FLYTO_ZOOM : DEFAULT_ZOOM,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })

    const syncViewport = () => {
      reconcileRef.current()
      const bbox = mapBoundsToBBox(map)
      const zoom = map.getZoom()
      onRegionChangeRef.current?.(bbox, zoom)
      useMapViewport.getState().setRegion(bbox, zoom)
    }

    map.on("load", () => {
      setMapReady(true)
      syncViewport()
    })
    map.on("moveend", syncViewport)

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
      el.setAttribute("aria-label", t("a11y.userLocation"))
      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([userLocation!.lng, userLocation!.lat])
        .addTo(map)
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
    if (!pickMarkerRef.current) {
      pickMarkerRef.current = new maplibregl.Marker({ element: makePinElement(themeRef.current), anchor: "bottom" })
        .setLngLat([pickDraft.lng, pickDraft.lat])
        .addTo(map)
    } else {
      pickMarkerRef.current.setLngLat([pickDraft.lng, pickDraft.lat])
      applyPinElementTheme(pickMarkerRef.current.getElement(), themeRef.current)
    }
  }, [mapReady, pickActive, pickDraft, mode, th.scheme])

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
      el.setAttribute("aria-label", t("dropPin.locationA11y"))
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
    reconcileRef.current()
  }, [mapReady, reports, cleanups, focusedPinId, focusedCleanupId, focus, th.scheme])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !focus) return
    const lng =
      mode === "compact" ? focus.lng : occludedCenterLng(focus.lng, shellOcclusionLeft(), FOCUS_ZOOM)
    map.easeTo({ center: [lng, focus.lat], zoom: FOCUS_ZOOM, duration: 600 })
  }, [mapReady, mode, focus?.id, focus?.lat, focus?.lng])

  return (
    <div className="cf-map-wrap" style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        className="cf-map-canvas"
        ref={containerRef}
        aria-label={t("a11y.homeMap")}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  )
})
