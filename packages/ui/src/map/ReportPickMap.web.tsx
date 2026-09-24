import * as React from "react"
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl"
import { createRoot, type Root } from "react-dom/client"
import type { BBox } from "@civfix/shared"
import { useTheme, ThemeProvider, type ColorSchemeName } from "../theme"
import { alpha } from "../theme/alpha"
import { useCartoApiKey } from "../data"
import { rasterMapStyle, carryStyleOverlay, DEFAULT_ATTRIBUTION } from "./mapStyle"
import { TeardropPin, EventPin, ClusterBubble } from "./pins"
import { useClusters } from "./useClusters"
import { createIdleRunner, type IdleRunner } from "./clusterSchedule"
import {
  clusterFallbackZoom,
  clusterZoomTarget,
  expansionZoomOfCluster,
  type ClusterNode,
  type MapClusterIndex,
  type MapPoint,
} from "./clusterer"
import { radiusCircleFeature } from "./radiusCircle"
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
  selected: boolean | null
  muted: boolean
  onClick: () => void
}

function boundsToBBox(map: MlMap): BBox {
  const b = map.getBounds()
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }
}

export const ReportPickMap = React.forwardRef<ReportPickMapHandle, ReportPickMapProps>(
  function ReportPickMap(props, ref) {
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
    } = props
    const th = useTheme()
    const themeRef = React.useRef(th)
    const cartoApiKey = useCartoApiKey()
    // The map is built once; a later key reaches it through the style-swap effect, not a rebuild.
    const cartoApiKeyRef = React.useRef(cartoApiKey)
    React.useLayoutEffect(() => {
      cartoApiKeyRef.current = cartoApiKey
    })
    const containerRef = React.useRef<HTMLDivElement | null>(null)
    const mapRef = React.useRef<MlMap | null>(null)
    const markersRef = React.useRef<globalThis.Map<string, MarkerEntry>>(new globalThis.Map())
    const meetingMarkerRef = React.useRef<Marker | null>(null)
    const meetingRootRef = React.useRef<Root | null>(null)
    const [mapReady, setMapReady] = React.useState(false)
    const styleSchemeRef = React.useRef<ColorSchemeName | null>(null)
    const seedRef = React.useRef({ center, zoom })

    const onRegionChangeRef = React.useRef(onRegionChange)
    const onPressPinRef = React.useRef(onPressPin)
    const onPressMapRef = React.useRef(onPressMap)
    const stateOfRef = React.useRef(stateOf)
    const lookForRef = React.useRef(lookFor)
    const pinLabelRef = React.useRef(pinLabel)
    const clusterLabelRef = React.useRef(clusterLabel)
    const focusedIdRef = React.useRef(focusedId)
    React.useLayoutEffect(() => {
      themeRef.current = th
      onRegionChangeRef.current = onRegionChange
      onPressPinRef.current = onPressPin
      onPressMapRef.current = onPressMap
      stateOfRef.current = stateOf
      lookForRef.current = lookFor
      pinLabelRef.current = pinLabel
      clusterLabelRef.current = clusterLabel
      focusedIdRef.current = focusedId
    })

    const points = React.useMemo<MapPoint[]>(
      () => pins.map((pin) => ({ kind: "report", id: pin.id, lat: pin.lat, lng: pin.lng, pin })),
      [pins],
    )
    const { index, query } = useClusters(points)
    const indexRef = React.useRef<MapClusterIndex>(index)

    const pressCluster = React.useCallback((node: Extract<ClusterNode, { type: "cluster" }>) => {
      const map = mapRef.current
      if (!map) return
      const currentZoom = map.getZoom()
      const expansion =
        node.clusterId === null ? null : expansionZoomOfCluster(indexRef.current, node.clusterId)
      const target = clusterZoomTarget(node, currentZoom, expansion) ?? clusterFallbackZoom(currentZoom)
      map.easeTo({ center: [node.lng, node.lat], zoom: target, duration: REPORT_PICK_FLY_MS })
    }, [])

    const reconcileRef = React.useRef<() => void>(() => {})
    const runnerRef = React.useRef<IdleRunner | null>(null)
    if (runnerRef.current === null) runnerRef.current = createIdleRunner(() => reconcileRef.current())
    const runner = runnerRef.current

    React.useLayoutEffect(() => {
      reconcileRef.current = () => {
        const map = mapRef.current
        if (!map || !mapReady) return
        const scheme = themeRef.current.scheme
        const desired = new globalThis.Map<string, Desired>()
        for (const node of query(boundsToBBox(map), map.getZoom())) {
          if (node.type === "cluster") {
            desired.set(node.key, {
              signature: `c|${node.count}|${scheme}`,
              anchor: "center",
              lngLat: [node.lng, node.lat],
              node: (
                <ThemeProvider preference={scheme}>
                  <ClusterBubble count={node.count} />
                </ThemeProvider>
              ),
              label: clusterLabelRef.current(node.count),
              selected: null,
              muted: false,
              onClick: () => pressCluster(node),
            })
          } else if (node.type === "report") {
            const state = stateOfRef.current(node.id)
            const look = lookForRef.current(state, focusedIdRef.current === node.id)
            desired.set(node.key, {
              signature: `r|${node.pin.category}|${state}|${look.active ? 1 : 0}|${look.badge ?? "-"}|${scheme}`,
              anchor: "bottom",
              lngLat: [node.lng, node.lat],
              node: (
                <ThemeProvider preference={scheme}>
                  <TeardropPin
                    category={node.pin.category}
                    size={REPORT_PICK_PIN_SIZE}
                    active={look.active}
                    badge={look.badge}
                  />
                </ThemeProvider>
              ),
              label: pinLabelRef.current(node.pin, state),
              selected: state === "selected" || state === "linked",
              muted: look.muted,
              onClick: () => onPressPinRef.current(node.id),
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
            const el = entry.marker.getElement()
            el.setAttribute("aria-label", want.label)
            el.style.opacity = want.muted ? String(REPORT_PICK_MUTED_OPACITY) : "1"
          }
        }
        for (const [key, want] of desired) {
          if (current.has(key)) continue
          const el = document.createElement("div")
          el.style.cursor = "pointer"
          el.style.lineHeight = "0"
          el.style.opacity = want.muted ? String(REPORT_PICK_MUTED_OPACITY) : "1"
          el.setAttribute("role", "button")
          el.setAttribute("tabindex", "0")
          if (want.selected !== null) el.setAttribute("aria-pressed", String(want.selected))
          const onClick: { fn?: () => void } = { fn: want.onClick }
          el.addEventListener("click", (e: MouseEvent) => {
            e.stopPropagation()
            onClick.fn?.()
          })
          el.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return
            e.preventDefault()
            e.stopPropagation()
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
    })

    React.useImperativeHandle(
      ref,
      (): ReportPickMapHandle => ({
        flyTo: (lat, lng, targetZoom) => {
          const map = mapRef.current
          if (!map) return
          map.easeTo({
            center: [lng, lat],
            zoom: targetZoom ?? map.getZoom(),
            duration: REPORT_PICK_FLY_MS,
          })
        },
      }),
      [],
    )

    React.useEffect(() => {
      if (mapRef.current || !containerRef.current) return
      const markers = markersRef.current
      const seed = seedRef.current
      styleSchemeRef.current = themeRef.current.scheme
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: rasterMapStyle(DEFAULT_ATTRIBUTION, {
          cartoApiKey: cartoApiKeyRef.current,
          scheme: themeRef.current.scheme,
        }) as maplibregl.StyleSpecification,
        center: [seed.center.lng, seed.center.lat],
        zoom: seed.zoom,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      })
      map.touchZoomRotate.disableRotation()
      map.keyboard.disableRotation()
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right")

      const syncViewport = () => {
        onRegionChangeRef.current(boundsToBBox(map), map.getZoom())
        runner.request()
      }
      map.on("load", () => {
        setMapReady(true)
        syncViewport()
      })
      map.on("moveend", syncViewport)
      map.on("click", (e) => {
        if (e.originalEvent.target instanceof Element && e.originalEvent.target.closest(".maplibregl-marker")) return
        onPressMapRef.current?.()
      })

      mapRef.current = map
      return () => {
        runner.dispose()
        map.remove()
        mapRef.current = null
        for (const entry of markers.values()) {
          const r = entry.root
          queueMicrotask(() => r.unmount())
        }
        markers.clear()
        const meetingRoot = meetingRootRef.current
        if (meetingRoot) queueMicrotask(() => meetingRoot.unmount())
        meetingRootRef.current = null
        meetingMarkerRef.current = null
        setMapReady(false)
      }
    }, [runner])

    const radiusFeature = React.useMemo(() => radiusCircleFeature(center, radiusM), [center, radiusM])

    React.useEffect(() => {
      const map = mapRef.current
      if (!map || !mapReady) return
      const fill = alpha(th.colors.brand.bloom, REPORT_PICK_RADIUS_FILL_ALPHA)
      const line = alpha(th.colors.brand.bloom, REPORT_PICK_RADIUS_LINE_ALPHA)
      const apply = () => {
        const existing = map.getSource(RADIUS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
        if (existing) {
          existing.setData(radiusFeature)
        } else {
          map.addSource(RADIUS_SOURCE_ID, { type: "geojson", data: radiusFeature })
        }
        if (!map.getLayer(`${RADIUS_SOURCE_ID}-fill`)) {
          map.addLayer({
            id: `${RADIUS_SOURCE_ID}-fill`,
            type: "fill",
            source: RADIUS_SOURCE_ID,
            paint: { "fill-color": fill },
          })
          map.addLayer({
            id: `${RADIUS_SOURCE_ID}-line`,
            type: "line",
            source: RADIUS_SOURCE_ID,
            paint: {
              "line-color": line,
              "line-width": REPORT_PICK_RADIUS_LINE_WIDTH,
              "line-dasharray": REPORT_PICK_RADIUS_LINE_DASH,
            },
          })
        } else {
          map.setPaintProperty(`${RADIUS_SOURCE_ID}-fill`, "fill-color", fill)
          map.setPaintProperty(`${RADIUS_SOURCE_ID}-line`, "line-color", line)
        }
      }
      if (map.isStyleLoaded()) apply()
      map.on("style.load", apply)
      return () => {
        map.off("style.load", apply)
      }
    }, [mapReady, radiusFeature, th.colors.brand.bloom, th.scheme])

    React.useEffect(() => {
      const map = mapRef.current
      if (!map || !mapReady) return
      const node = (
        <ThemeProvider preference={th.scheme}>
          <EventPin size={REPORT_PICK_MEETING_PIN_SIZE} />
        </ThemeProvider>
      )
      if (!meetingMarkerRef.current) {
        const el = document.createElement("div")
        el.style.lineHeight = "0"
        el.style.opacity = String(REPORT_PICK_MEETING_PIN_OPACITY)
        el.style.pointerEvents = "none"
        el.setAttribute("role", "img")
        const root = createRoot(el)
        root.render(node)
        meetingRootRef.current = root
        meetingMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([center.lng, center.lat])
          .addTo(map)
        el.setAttribute("aria-label", meetingPointLabel)
      } else {
        meetingMarkerRef.current.setLngLat([center.lng, center.lat])
        meetingMarkerRef.current.getElement().setAttribute("aria-label", meetingPointLabel)
        meetingRootRef.current?.render(node)
      }
    }, [mapReady, center, meetingPointLabel, th.scheme])

    React.useEffect(() => {
      const map = mapRef.current
      if (!map || !mapReady || styleSchemeRef.current === th.scheme) return
      styleSchemeRef.current = th.scheme
      map.setStyle(
        rasterMapStyle(DEFAULT_ATTRIBUTION, { cartoApiKey, scheme: th.scheme }) as maplibregl.StyleSpecification,
        { transformStyle: carryStyleOverlay(RADIUS_SOURCE_ID) },
      )
    }, [mapReady, cartoApiKey, th.scheme])

    React.useEffect(() => {
      indexRef.current = index
      if (mapReady) runner.flush()
    }, [runner, mapReady, index, focusedId, stateOf, lookFor, th.scheme])

    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <div
          ref={containerRef}
          role="region"
          aria-label={mapLabel}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    )
  },
)
