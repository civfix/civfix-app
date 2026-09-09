/**
 * The transient "the user long-pressed HERE" pin bus (map long-press -> drop pin -> create menu).
 *
 * ITS OWN STORE, DELIBERATELY NOT `useMapFocus`. Both map seams render exactly ONE marker while
 * `useMapFocus.focus` is set (Map.native's three-way branch, Map.web's `reconcile` focus branch), so
 * expressing the dropped pin through the focus bus would make every report/event pin VANISH the moment
 * the drop-pin menu opened. The seams instead draw this pin as a SIBLING of their normal marker tree.
 *
 * Pure zustand (mirrors mapFocusStore.ts) - no react-native / maplibre / next - so it unit-tests
 * directly and both seam files plus the sheet body may import it.
 *
 * COORDINATES ARE ROUNDED TO 6 DECIMAL PLACES (~11cm) on the way in. Two reasons: the long-press
 * coordinate arrives as a full-precision double from two different projections (maplibre-gl on web,
 * MapLibre-native on iOS/Android) and the same visual spot must produce the SAME value on both seams;
 * and `drop` is IDEMPOTENT at that precision - re-dropping the same point returns the SAME state object
 * so a StrictMode double-invoke or a re-mount effect cannot churn the two map seams' marker subtrees.
 */
import { create } from "zustand"

/** The transient long-pressed coordinate, rounded to 6dp. */
export interface DroppedPin {
  lat: number
  lng: number
}

export interface DroppedPinState {
  /** The pin currently painted on the map, or null when no drop-pin menu is open. */
  pin: DroppedPin | null
  /** Drop (or move) the transient pin. Rounds to 6dp and no-ops when the rounded point is unchanged. */
  drop: (lat: number, lng: number) => void
  /** Remove the transient pin (menu dismissed / flow committed / nav left the drop-pin entry). */
  clear: () => void
}

/** Decimal places the store normalises every incoming coordinate to (~11cm at the equator). */
export const DROPPED_PIN_PRECISION = 6

const FACTOR = 10 ** DROPPED_PIN_PRECISION

/** Round to DROPPED_PIN_PRECISION dp. `Object.is`-safe: normalises -0 to 0 so idempotence holds. */
function round6(value: number): number {
  if (!Number.isFinite(value)) return value
  const rounded = Math.round(value * FACTOR) / FACTOR
  return rounded === 0 ? 0 : rounded
}

export const useDroppedPin = create<DroppedPinState>((set) => ({
  pin: null,
  drop: (lat, lng) =>
    set((state) => {
      const next = { lat: round6(lat), lng: round6(lng) }
      const current = state.pin
      // Idempotent at 6dp: returning the SAME object keeps every subscriber's reference-equal selector
      // from re-rendering (both seams key their transient marker off this identity).
      if (current && current.lat === next.lat && current.lng === next.lng) return state
      return { pin: next }
    }),
  clear: () => set((state) => (state.pin === null ? state : { pin: null })),
}))
