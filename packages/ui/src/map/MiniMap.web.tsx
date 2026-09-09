/**
 * MiniMap (web seam) - the small non-interactive detail-location map on web (maplibre-gl).
 *
 * The web counterpart of the mobile MiniMap: a locked CARTO Voyager raster map centered once on lat/lng
 * with the focused teardrop planted on the point. Like Map.web, the marker is NOT a bespoke DOM element
 * - it is a maplibre `Marker({ element })` whose element is an empty <div> into which the SHARED
 * react-native-svg pin (TeardropPin / EventPin) is mounted via react-dom/client `createRoot` (RNW
 * renders the SVG pin to a real <svg>), so the marker is pixel-identical to the native seam + the home
 * map. ALL interaction handlers are disabled (interactive: false) so the embed stays inert; an optional
 * top-left glass tag pill + a faint CARTO/OSM credit overlay the canvas as plain DOM.
 *
 * maplibre-gl + react-dom/client are allowed here (this is the *.web.* map seam). The maplibre-gl CSS is
 * imported by the web app (globals.css), as for Map.web.
 */
import * as React from "react"
import maplibregl from "maplibre-gl"
import { createRoot, type Root } from "react-dom/client"
import { useTheme, ThemeProvider, type Theme } from "../theme"
import { useT } from "../i18n"
import { useCartoApiKey } from "../data"
import { rasterMapStyle, DEFAULT_ATTRIBUTION } from "./mapStyle"
import { TeardropPin, EventPin } from "./pins"
import { MINIMAP_HEIGHT, MINIMAP_ZOOM, type MiniMapProps } from "./MiniMap.types"

export function MiniMap({ lat, lng, category, label, height = MINIMAP_HEIGHT, aspectRatio, zoom = MINIMAP_ZOOM }: MiniMapProps) {
  const { t } = useT("map-ui")
  const th = useTheme()
  const styles = React.useMemo(() => makeStyles(th), [th])
  const schemeRef = React.useRef(th.scheme)
  schemeRef.current = th.scheme
  const cartoApiKey = useCartoApiKey()
  const cartoApiKeyRef = React.useRef(cartoApiKey)
  cartoApiKeyRef.current = cartoApiKey
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<maplibregl.Map | null>(null)
  const rootRef = React.useRef<Root | null>(null)

  // The pin node (category teardrop, else the gold cleanup teardrop). Kept in a ref so the init effect
  // mounts it without re-running, and the sync effect below re-renders it on a category change.
  const pinNode = (
    <ThemeProvider preference={th.scheme}>
      {category != null ? <TeardropPin category={category} /> : <EventPin />}
    </ThemeProvider>
  )
  const pinNodeRef = React.useRef(pinNode)
  pinNodeRef.current = pinNode

  // ---- map init (once) ----
  React.useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: rasterMapStyle(DEFAULT_ATTRIBUTION, {
        cartoApiKey: cartoApiKeyRef.current,
        scheme: schemeRef.current,
      }) as maplibregl.StyleSpecification,
      center: [lng, lat],
      zoom,
      // Locked: no gestures (the detail body owns the scroll), no controls, no rotation.
      interactive: false,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })

    // The single focused teardrop: an empty div hosting the shared SVG pin via createRoot, anchored at
    // its tip on the coordinate.
    const el = document.createElement("div")
    el.style.lineHeight = "0"
    const root = createRoot(el)
    root.render(pinNodeRef.current)
    rootRef.current = root
    new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([lng, lat]).addTo(map)

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      rootRef.current = null
      // map.remove() tears down the marker's DOM; unmount the React root so the SVG pin is freed. Defer
      // the unmount to a microtask: calling root.unmount() synchronously inside an effect cleanup can run
      // while React is still rendering (e.g. rapid HMR remounts), which React warns about - deferring it
      // lets the current render commit first. The map/marker DOM is already gone, so the timing is safe.
      queueMicrotask(() => root.unmount())
    }
    // Seeded once from the initial lat/lng/zoom; a parent that changes them remounts via the key it sets.
    // The current pin node is read via pinNodeRef, so it is not a dep (the map is created once).
  }, [])

  // ---- re-render the pin if the category (its color/glyph) changes without a remount ----
  // pinNode is recomputed each render from `category`; on a category change re-render the mounted root
  // with the latest pin (pinNode itself is not a dep - it is a fresh element identity every render).
  React.useEffect(() => {
    rootRef.current?.render(pinNodeRef.current)
  }, [category, th.scheme])

  return (
    <div style={{ ...styles.wrap, ...(aspectRatio != null ? { aspectRatio } : { height }) }}>
      <div ref={containerRef} style={styles.canvas} aria-label={t("a11y.miniMap")} />
      {label ? <div style={styles.tag}>{label}</div> : null}
      <div style={styles.credit}>{t("a11y.attribution")}</div>
    </div>
  )
}

// Plain DOM styles (the web seam renders DOM, not RN primitives - mirrors Map.web's container).
function makeStyles(t: Theme): Record<string, React.CSSProperties> {
  return {
    // .pi-detail-map: radius lg, overflow hidden, paper-2 while tiles load.
    wrap: {
      position: "relative",
      width: "100%",
      borderRadius: t.radius.lg,
      overflow: "hidden",
      backgroundColor: t.colors.bgAlt,
      border: `1px solid ${t.colors.border}`,
    },
    canvas: {
      width: "100%",
      height: "100%",
    },
    // .pi-detail-tag: top-left glass pill.
    tag: {
      position: "absolute",
      top: t.space["3"],
      left: t.space["3"],
      padding: "5px 10px",
      borderRadius: t.radius.pill,
      backgroundColor: t.glass.button.fill,
      border: `1px solid ${t.glass.button.border}`,
      font: `800 11px/1 ${t.fontFamily.bodyExtraBold}, system-ui, sans-serif`,
      letterSpacing: 0.5,
      color: t.colors.text,
      pointerEvents: "none",
    },
    credit: {
      position: "absolute",
      bottom: 4,
      right: 6,
      font: "400 9px/1 system-ui, sans-serif",
      color: t.colors.textSubtle,
      pointerEvents: "none",
    },
  }
}
