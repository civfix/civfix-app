import type { PinTarget } from "./pins/appearance"

export interface LatLng {
  lat: number
  lng: number
}

export interface LocationPickerProps {
  value?: LatLng | null
  onChange: (lat: number, lng: number) => void
  /** Only the web main-map overlay's Reset calls it. */
  onClear?: () => void
  /**
   * Hosts resolve this asynchronously; until it or `value` is known both seams construct no map. Passing
   * nothing means "not known yet", never "use a default": there is no default, because a fallback centre
   * opened the pin-drop map thousands of miles from the reporter.
   */
  initialCenter?: LatLng
  /** Resolution finished with no point, so the picker asks for an address instead of loading forever. */
  centerSettled?: boolean
  height?: number
  /**
   * "main-map" collects taps on the web's persistent main map through `locationPickStore` when one is
   * registered, falling back to the inline map on a cold deep link. Native ignores it: there is no
   * tappable map behind a native sheet.
   */
  mode?: "standalone" | "main-map"
  /**
   * Off by default because the inline picker lives inside scrollable sheets, where a greedy map pan would
   * swallow the host's vertical scroll. Native honours it; the web inline picker already supports drag.
   */
  interactive?: boolean
  /** Edge-to-edge with no card chrome or hint pill; the host's full-screen chrome supplies guidance. */
  fullBleed?: boolean
  /** With `fullBleed`, lifts the basemap credit clear of the host's floating confirm bar. */
  attributionBottomInset?: number
  pin: PinTarget
}

export type PickerSurface = "map" | "pending" | "search"

export function pickerSurface(cameraSeed: LatLng | null, centerSettled: boolean | undefined): PickerSurface {
  if (cameraSeed) return "map"
  return centerSettled ? "search" : "pending"
}

export const PICKER_ZOOM = 14
export const PICKER_HEIGHT = 200
