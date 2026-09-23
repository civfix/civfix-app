/**
 * Shared contract for the LocationPicker seam (UI-unification Stage 4 slice 5B-2).
 *
 * LocationPicker is the INTERACTIVE inline pin-drop map in the host-event form (design `social.jsx`
 * `.pi-host-map`): the warm CARTO Voyager raster basemap the user taps to drop the coral meeting-point
 * pin (and, on web, drags to fine-tune). It returns the chosen {lat,lng} to the caller via `onChange`,
 * which the host form stores as the cleanup's coordinate. It PAIRS with the sibling AddressSearch (slice
 * 3): picking a search result sets `value`, which recenters the picker; tapping fine-tunes the drop.
 *
 * It is its OWN .web/.native seam (maplibre confined to the seam files by the import-guard). It does NOT
 * embed an address search (the host body renders AddressSearch above it) and does NOT own modal chrome:
 * the mobile original was a full-screen modal; the unified picker is an embeddable inline map so the
 * SAME component drops into the unified host body (web sidebar + native sheet) and the mobile host
 * overlay alike. A bottom "Tap the map to place the pin" hint overlays the canvas.
 */
import type { PinTarget } from "./pins/appearance"

export interface LatLng {
  lat: number
  lng: number
}

export interface LocationPickerProps {
  /** The current selection, if any: seeds the pin + recenters the camera (e.g. after an AddressSearch pick). */
  value?: LatLng | null
  /** Called with the chosen coordinate whenever the user drops / moves the pin (tap or drag). */
  onChange: (lat: number, lng: number) => void
  /**
   * Clear the current selection (the web main-map overlay's "Reset" affordance): the caller wipes its own
   * committed coordinate so the pin + any routing reset to the empty "tap to place" state. Optional - the
   * inline / native pickers never call it, so a caller with no clearable state may omit it.
   */
  onClear?: () => void
  /**
   * Where to center the camera BEFORE a pin is placed (no `value` yet) - the user's resolved approximate
   * location, so a new pin starts near them.
   *
   * HOSTS RESOLVE THIS ASYNCHRONOUSLY, and BOTH seams are built for that: until either this or `value` is
   * known they show a warm placeholder and construct no map at all, then adopt the first real point they
   * learn and freeze it. Passing nothing therefore means "I do not know yet", NOT "use a default" - there
   * is no default. The neutral US-centroid fallback both seams used to carry is deleted, not deprecated:
   * "no point is known yet" and "the user is in Kansas" are different facts, and substituting the second
   * for the first is what opened the report wizard's pin-drop map on a field 2,000 miles from the reporter.
   */
  initialCenter?: LatLng
  /**
   * The host finished resolving `initialCenter` and learned nothing (location refused, no approximate
   * point, backend off). With no `value` either, the picker asks for an address instead of loading forever.
   */
  centerSettled?: boolean
  /** Map height (design `.pi-host-map` = 200 for the inline picker). */
  height?: number
  /**
   * How the picker collects the point (event-linking follow-up 2):
   *   - "standalone" (default): render the inline 200px pin-drop map - the original behavior, used in
   *     portrait/sheet layouts where no main map is visible behind the form.
   *   - "main-map": on web, when a SHARED <Map/> has registered as the visible main map, render NO inline
   *     map - instead an overlay panel ("Tap the map to place the pin" + the live coord + a Reset) that
   *     commits each tap LIVE and drives that persistent main map via the shared locationPickStore. Falls
   *     back to the inline map
   *     when no main map is registered (a cold deep-link). The NATIVE seam IGNORES this (no persistent
   *     tappable map behind a native sheet) and always renders the inline map.
   */
  mode?: "standalone" | "main-map"
  /**
   * Enable the map's pan / zoom / rotate gestures so the user can MOVE the map (the full-screen native
   * picker). Default false keeps the gestures DISABLED: the inline picker lives inside scrollable
   * sheets / sidebars where a greedy map pan would swallow the host's vertical scroll, so there only a
   * discrete tap drops the pin. The native seam honours this; the web inline picker already supports drag.
   */
  interactive?: boolean
  /**
   * Fill the parent edge-to-edge with NO card border / radius and suppress the picker's own bottom hint
   * pill (the host's full-screen chrome supplies guidance). Used by the native full-screen
   * PortraitMapPickStep so the map reads as "the home map". Default false = the bordered inline card.
   */
  fullBleed?: boolean
  /**
   * When `fullBleed`, lift the static basemap credit this many px off the bottom so it clears the host's
   * floating confirm / cancel bar. Ignored otherwise.
   */
  attributionBottomInset?: number
  pin: PinTarget
}

// THERE IS DELIBERATELY NO `NEUTRAL_CENTER` HERE ANY MORE - do not reintroduce one.
//
// It was the geographic centre of the contiguous US (39.8283, -98.5795), used as the "we don't know where
// the user is yet" camera fallback by both picker seams. That is what made the report wizard's pin-drop map
// open on a field in the middle of the country: every reporter saw a camera 2,000 miles from the pothole
// they were standing over, and on a slow fix it stayed there. "No point is known yet" and "the user is in
// Kansas" are different facts. Both seams now enforce the rule the app's own location hook states (never
// jump to the neutral US centre) STRUCTURALLY - they construct no map until a real centre exists and show a
// warm placeholder meanwhile - so the constant has no callers left and is gone rather than deprecated. A
// fallback that does not exist cannot be reached for by the next person in a hurry.

export type PickerSurface = "map" | "pending" | "search"

export function pickerSurface(cameraSeed: LatLng | null, centerSettled: boolean | undefined): PickerSurface {
  if (cameraSeed) return "map"
  return centerSettled ? "search" : "pending"
}

/** The picker's default camera zoom + the inline-picker height. */
export const PICKER_ZOOM = 14
export const PICKER_HEIGHT = 200
