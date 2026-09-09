/**
 * Public types for the responsive SHELL layer (stage 3B-1).
 *
 * The shell is the chrome that hosts the unified community UI. Landscape keeps a full-bleed map with a
 * secondary sidebar. Portrait uses independent full-screen tab surfaces, mounting the map and controls
 * only for the Map surface, with details layered above the current tab.
 *
 * The shell is deliberately content-agnostic: it owns geometry, the header/back affordance, scroll, and
 * the snap detents, but NOT the map or the feature bodies. The consumer (stage 3B-2 wires web) injects:
 *   - `map`         - the platform map view (maplibre on web, maplibre-react-native on native).
 *   - `mapControls` - the floating top-bar / FAB controls drawn over the map (under the panel).
 *   - `authOverlay` - an optional top-most overlay (the auth modal / gate), drawn above everything.
 *   - `renderBody`  - maps the active nav entry (or the list view, when no detail) to a body node. When
 *                     omitted the shell uses `defaultRenderBody` (the BodyRouter), which resolves every
 *                     reachable view/kind to a real feature body.
 *
 * This module is PURE types. It imports only React + the nav types; no react-native, no next/*, no map.
 */
import type { DetailEntry, View } from "../nav"

export interface AppShellProps {
  /** The platform map view, persistent in landscape and mounted only on the portrait Map surface. */
  map: React.ReactNode
  /** Floating map controls drawn with the live map but under any sidebar, sheet, or overlay. */
  mapControls: React.ReactNode
  /** Optional top-most overlay (auth modal / gate), drawn above the panel and controls. */
  authOverlay?: React.ReactNode
  /**
   * Map the active nav entry (or the active list `view`, when no detail is open) to a body node. The
   * shell calls this with `(null, view)` for the list/home body and `(entry, view)` for a detail. When
   * omitted the shell falls back to `defaultRenderBody` (the BodyRouter).
   */
  renderBody?: (entry: DetailEntry | null, view: View) => React.ReactNode
}
