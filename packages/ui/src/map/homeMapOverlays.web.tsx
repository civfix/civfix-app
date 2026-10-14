import * as React from "react"
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl"
import { createRoot, type Root } from "react-dom/client"
import { ThemeProvider, type ColorSchemeName, type LayoutMode, type Theme } from "../theme"
import { DropPin, pinAppearanceFor } from "./pins"
import { applyPinElementTheme, makePinElement } from "./pins/pinElement.web"
import { useLocationPick } from "./locationPickStore"
import type { DroppedPin } from "./droppedPinStore"
import type { MarkerLabelT } from "./markerFocus"
import { DEFAULT_ZOOM, PICK_EASE_MS } from "./mapCamera"
import { centerLngFor, type OcclusionLeftRef } from "./homeMapCamera.web"
import type { MapLatLng } from "./types"

type MlMapRef = React.RefObject<MlMap | null>

/** `map.remove()` takes every marker and control with it, so each overlay drops its handles with the map. */
function useReleaseWithMap(mapReady: boolean, release: () => void): void {
  // Every caller passes a fresh closure over stable refs, so the latest one is read at teardown instead of
  // re-arming the effect on each render.
  const releaseRef = React.useRef(release)
  releaseRef.current = release
  React.useEffect(() => {
    if (!mapReady) return
    return () => releaseRef.current()
  }, [mapReady])
}

export interface ModeMapControlsOptions {
  mapRef: MlMapRef
  mapReady: boolean
  mode: LayoutMode
}

export function useModeMapControls({ mapRef, mapReady, mode }: ModeMapControlsOptions): void {
  const navCtrlRef = React.useRef<maplibregl.NavigationControl | null>(null)
  const attribCtrlRef = React.useRef<maplibregl.AttributionControl | null>(null)
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
  }, [mapReady, mode, mapRef])
  useReleaseWithMap(mapReady, () => {
    navCtrlRef.current = null
    attribCtrlRef.current = null
  })
}

export interface UserLocationDotOptions {
  mapRef: MlMapRef
  mapReady: boolean
  showUserLocation: boolean
  userLocation: MapLatLng | null
  t: MarkerLabelT
}

export function useUserLocationDot({
  mapRef,
  mapReady,
  showUserLocation,
  userLocation,
  t,
}: UserLocationDotOptions): void {
  const userMarkerRef = React.useRef<Marker | null>(null)
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
  }, [mapReady, showUserLocation, userLocation, t, mapRef])
  useReleaseWithMap(mapReady, () => {
    userMarkerRef.current = null
  })
}

export interface PickMarkerOptions {
  mapRef: MlMapRef
  mapReady: boolean
  pickActive: boolean
  mode: LayoutMode
  themeRef: React.RefObject<Theme>
  scheme: ColorSchemeName
  occlusionLeftRef: OcclusionLeftRef
}

/** The first draft of a pick session brings the camera to it once; later drafts only move the marker. */
export function usePickMarker({
  mapRef,
  mapReady,
  pickActive,
  mode,
  themeRef,
  scheme,
  occlusionLeftRef,
}: PickMarkerOptions): void {
  const pickMarkerRef = React.useRef<Marker | null>(null)
  const pickDraft = useLocationPick((s) => s.draft)
  const pickPin = useLocationPick((s) => s.pin)
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
        const zoom = Math.max(map.getZoom(), DEFAULT_ZOOM)
        const lng = centerLngFor(pickDraft.lng, zoom, mode, occlusionLeftRef)
        map.easeTo({ center: [lng, pickDraft.lat], zoom, duration: PICK_EASE_MS })
      }
    }
    if (!pickDraft) {
      pickMarkerRef.current?.remove()
      pickMarkerRef.current = null
      return
    }
    const pickFill = pinAppearanceFor(pickPin, scheme).fill
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
  }, [mapReady, pickActive, pickDraft, pickPin, mode, scheme, mapRef, occlusionLeftRef, themeRef])
  useReleaseWithMap(mapReady, () => {
    pickMarkerRef.current = null
  })
}

export interface DropPinMarkerOptions {
  mapRef: MlMapRef
  mapReady: boolean
  droppedPin: DroppedPin | null
  scheme: ColorSchemeName
  t: MarkerLabelT
}

export function useDropPinMarker({ mapRef, mapReady, droppedPin, scheme, t }: DropPinMarkerOptions): void {
  const dropMarkerRef = React.useRef<Marker | null>(null)
  const dropRootRef = React.useRef<Root | null>(null)
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
        <ThemeProvider preference={scheme}>
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
        <ThemeProvider preference={scheme}>
          <DropPin />
        </ThemeProvider>,
      )
    }
  }, [mapReady, droppedPin, t, scheme, mapRef])
  useReleaseWithMap(mapReady, () => {
    const dropRoot = dropRootRef.current
    if (dropRoot) queueMicrotask(() => dropRoot.unmount())
    dropRootRef.current = null
    dropMarkerRef.current = null
  })
}
