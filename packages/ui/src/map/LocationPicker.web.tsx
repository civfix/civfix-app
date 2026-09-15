import * as React from "react"
import maplibregl from "maplibre-gl"
import { tokens, shadowSchemes } from "@civfix/shared/tokens"
import { useTheme, EASE_STANDARD_CSS, type Theme } from "../theme"
import { useT } from "../i18n"
import { useCartoApiKey } from "../data"
import { rasterMapStyle, DEFAULT_ATTRIBUTION } from "./mapStyle"
import { PICKER_ZOOM, PICKER_HEIGHT, type LatLng, type LocationPickerProps } from "./LocationPicker.types"
import { useLocationPick } from "./locationPickStore"
import { pinAppearanceFor } from "./pins"

export function applyPinElementTheme(el: HTMLElement, t: Theme, fill: string): void {
  el.style.background = fill
  el.style.boxShadow = shadowSchemes[t.scheme].pin
  el.style.border = `2px solid ${t.colors.onAccent}`
}

export function makePinElement(t: Theme, fill: string): HTMLDivElement {
  const el = document.createElement("div")
  el.style.width = "24px"
  el.style.height = "24px"
  el.style.borderRadius = String(tokens.radius.pin)
  el.style.transform = "rotate(45deg)"
  el.style.boxSizing = "border-box"
  el.style.cursor = "grab"
  applyPinElementTheme(el, t, fill)
  return el
}

function InlineLocationPicker({ value, onChange, initialCenter, height = PICKER_HEIGHT, pin }: LocationPickerProps) {
  const { t } = useT("map-ui")
  const th = useTheme()
  const styles = React.useMemo(() => makeStyles(th), [th])
  const themeRef = React.useRef(th)
  themeRef.current = th
  const pinFill = pinAppearanceFor(pin, th.scheme).fill
  const pinFillRef = React.useRef(pinFill)
  pinFillRef.current = pinFill
  const cartoApiKey = useCartoApiKey()
  const cartoApiKeyRef = React.useRef(cartoApiKey)
  cartoApiKeyRef.current = cartoApiKey
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<maplibregl.Map | null>(null)
  const markerRef = React.useRef<maplibregl.Marker | null>(null)
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange
  const [placed, setPlaced] = React.useState<boolean>(value != null)

  const seedRef = React.useRef<LatLng | null>(null)
  if (seedRef.current == null) seedRef.current = value ?? initialCenter ?? null
  const cameraSeed = seedRef.current

  const ensureMarker = React.useCallback(
    (map: maplibregl.Map, lngLat: maplibregl.LngLatLike): maplibregl.Marker => {
      const existing = markerRef.current
      if (existing) return existing
      const marker = new maplibregl.Marker({
        element: makePinElement(themeRef.current, pinFillRef.current),
        anchor: "bottom",
        draggable: true,
      })
        .setLngLat(lngLat)
        .addTo(map)
      marker.on("dragend", () => {
        const ll = marker.getLngLat()
        onChangeRef.current(ll.lat, ll.lng)
      })
      markerRef.current = marker
      return marker
    },
    [],
  )

  React.useEffect(() => {
    if (mapRef.current || !containerRef.current || !cameraSeed) return
    const start: [number, number] = [cameraSeed.lng, cameraSeed.lat]

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: rasterMapStyle(DEFAULT_ATTRIBUTION, {
        cartoApiKey: cartoApiKeyRef.current,
        scheme: themeRef.current.scheme,
      }) as maplibregl.StyleSpecification,
      center: start,
      zoom: PICKER_ZOOM,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right")

    if (value) ensureMarker(map, start)

    map.on("click", (e) => {
      ensureMarker(map, e.lngLat).setLngLat(e.lngLat)
      onChangeRef.current(e.lngLat.lat, e.lngLat.lng)
      setPlaced(true)
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [cameraSeed])

  React.useEffect(() => {
    const marker = markerRef.current
    if (marker) applyPinElementTheme(marker.getElement(), th, pinFill)
  }, [th, pinFill])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!value) {
      markerRef.current?.remove()
      markerRef.current = null
      setPlaced(false)
      return
    }
    setPlaced(true)
    const marker = ensureMarker(map, [value.lng, value.lat])
    const current = marker.getLngLat()
    if (Math.abs(current.lat - value.lat) > 1e-6 || Math.abs(current.lng - value.lng) > 1e-6) {
      marker.setLngLat([value.lng, value.lat])
      map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), PICKER_ZOOM), duration: 400 })
    }
  }, [value])


  if (!cameraSeed) {
    return <div style={{ ...styles.wrap, height }} aria-label={t("a11y.picker")} aria-busy />
  }

  return (
    <div style={{ ...styles.wrap, height }}>
      <div
        ref={containerRef}
        style={styles.canvas}
        aria-label={t("a11y.picker")}
      />
      <div style={styles.hint}>{placed ? t("hint.move") : t("hint.place")}</div>
    </div>
  )
}

function MainMapLocationPicker({ value, onChange, onClear, pin }: LocationPickerProps) {
  const { t } = useT("map-ui")
  const th = useTheme()
  const styles = React.useMemo(() => makeStyles(th), [th])
  const draft = useLocationPick((s) => s.draft)

  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange
  const onClearRef = React.useRef(onClear)
  onClearRef.current = onClear
  const pinRef = React.useRef(pin)
  pinRef.current = pin

  React.useEffect(() => {
    useLocationPick.getState().start(value ?? null, pinRef.current)
    return () => {
      useLocationPick.getState().cancel()
    }
  }, [])

  React.useEffect(() => {
    useLocationPick.getState().setPin(pin)
  }, [pin])

  React.useEffect(() => {
    if (!draft) return
    if (value && Math.abs(draft.lat - value.lat) < 1e-9 && Math.abs(draft.lng - value.lng) < 1e-9) return
    onChangeRef.current(draft.lat, draft.lng)
  }, [draft, value])

  const point = draft ?? value ?? null

  const onReset = React.useCallback(() => {
    useLocationPick.getState().start(null, pinRef.current)
    onClearRef.current?.()
  }, [])

  const [resetHovered, setResetHovered] = React.useState(false)

  return (
    <div style={styles.overlay}>
      <div style={styles.overlayRow}>
        <span style={styles.overlayLead}>
          <span style={styles.overlayIcon} aria-hidden>
            <span style={styles.overlayDot} />
          </span>
          <span style={styles.overlayInstruction}>
            {point ? t("hint.moveMainMap") : t("hint.place")}
          </span>
        </span>
        <button
          type="button"
          onClick={onReset}
          disabled={point == null}
          data-focus-ring=""
          onPointerEnter={(e) => {
            if (e.pointerType !== "touch") setResetHovered(true)
          }}
          onPointerLeave={() => setResetHovered(false)}
          onPointerCancel={() => setResetHovered(false)}
          style={{
            ...styles.overlayReset,
            ...(resetHovered && point != null ? styles.overlayResetHovered : null),
            ...(point == null ? styles.overlayResetDisabled : null),
          }}
        >
          {t("actions.reset")}
        </button>
      </div>
      <div style={styles.overlayCoord}>
        {point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : t("hint.empty")}
      </div>
    </div>
  )
}

export function LocationPicker(props: LocationPickerProps) {
  const mapRegistered = useLocationPick((s) => s.mapRegistered)
  if (props.mode === "main-map" && mapRegistered) {
    return <MainMapLocationPicker {...props} />
  }
  return <InlineLocationPicker {...props} />
}

function makeStyles(t: Theme): Record<string, React.CSSProperties> {
  return {

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
    hint: {
      position: "absolute",
      bottom: 12,
      left: "50%",
      transform: "translateX(-50%)",
      maxWidth: "90%",
      padding: "7px 12px",
      borderRadius: t.radius.pill,
      backgroundColor: t.glass.button.fill,
      border: `1px solid ${t.glass.button.border}`,
      textAlign: "center",
      whiteSpace: "nowrap",
      font: `600 12.5px/1.3 ${t.fontFamily.bodySemiBold}, system-ui, sans-serif`,
      color: t.colors.text,
      pointerEvents: "none",
    },

    overlay: {
      display: "flex",
      flexDirection: "column",
      gap: t.space["3"],
      padding: t.space["4"],
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.bgAlt,
      border: `1px solid ${t.colors.border}`,
    },
    overlayRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.space["3"],
    },
    overlayLead: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: t.space["2"],
      minWidth: 0,
    },
    overlayIcon: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },
    overlayDot: {
      width: 12,
      height: 12,
      borderRadius: 999,
      background: t.colors.brand.bloom,
      border: `2px solid ${t.colors.onAccent}`,
      boxShadow: shadowSchemes[t.scheme].pin,
      display: "inline-block",
    },
    overlayInstruction: {
      font: `600 13.5px/1.3 ${t.fontFamily.bodySemiBold}, system-ui, sans-serif`,
      color: t.colors.text,
    },
    overlayCoord: {
      font: `400 12px/1.3 ${t.fontFamily.mono}, ui-monospace, SFMono-Regular, Menlo, monospace`,
      color: t.colors.textSubtle,
    },
    overlayReset: {
      flex: "0 0 auto",
      height: 40,
      padding: `0 ${t.space["4"]}px`,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surface,
      border: `1.5px solid ${t.colors.borderStrong}`,
      color: t.colors.text,
      font: `700 13.5px/1 ${t.fontFamily.bodyBold}, system-ui, sans-serif`,
      cursor: "pointer",
      transition: `opacity 120ms ${EASE_STANDARD_CSS}, background-color 120ms ${EASE_STANDARD_CSS}, border-color 120ms ${EASE_STANDARD_CSS}, transform 120ms ${EASE_STANDARD_CSS}`,
    },
    overlayResetHovered: {
      backgroundColor: t.colors.surfaceTint,
      border: `1.5px solid ${t.colors.textSubtle}`,
    },
    overlayResetDisabled: {
      opacity: 0.5,
      cursor: "default",
    },
  }
}
