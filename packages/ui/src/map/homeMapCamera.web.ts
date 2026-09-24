import * as React from "react"
import type { Map as MlMap } from "maplibre-gl"
import type { LayoutMode } from "../theme"
import { occludedCenterLng } from "./dropPinCamera"
import { CAMERA_EASE_MS, FOCUS_ZOOM } from "./mapCamera"
import { useMapFlyTo, type MapFlyToRequest } from "./mapFlyToStore"
import type { FocusedEntity } from "./mapFocusStore"
import type { MapProps } from "./types"

export type OcclusionLeftRef = React.RefObject<MapProps["occlusionLeft"]>

/** On the expanded layout the camera centres a target in the map area the shell chrome leaves visible. */
export function centerLngFor(lng: number, zoom: number, mode: LayoutMode, occlusionLeftRef: OcclusionLeftRef): number {
  return mode === "compact" ? lng : occludedCenterLng(lng, occlusionLeftRef.current?.() ?? 0, zoom)
}

export function useFocusAndFlyToCamera(
  mapRef: React.RefObject<MlMap | null>,
  mapReady: boolean,
  mode: LayoutMode,
  focus: FocusedEntity | null,
  flyToRequest: MapFlyToRequest | null,
  occlusionLeftRef: OcclusionLeftRef,
): void {
  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !focus) return
    const lng = centerLngFor(focus.lng, FOCUS_ZOOM, mode, occlusionLeftRef)
    map.easeTo({ center: [lng, focus.lat], zoom: FOCUS_ZOOM, duration: CAMERA_EASE_MS })
  }, [mapReady, mode, focus])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !flyToRequest) return
    const lng = centerLngFor(flyToRequest.lng, FOCUS_ZOOM, mode, occlusionLeftRef)
    map.easeTo({ center: [lng, flyToRequest.lat], zoom: FOCUS_ZOOM, duration: CAMERA_EASE_MS })
    useMapFlyTo.getState().consume(flyToRequest.generation)
  }, [mapReady, mode, flyToRequest])
}
