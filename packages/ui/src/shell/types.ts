/**
 * Public types for the responsive shell. The shell is content-agnostic: it owns geometry, the header and
 * back affordance, scroll and the snap detents, while the host injects the map, its controls, the auth
 * overlay and optionally `renderBody`. Pure types only: no react-native, next/* or map imports.
 */
import type { DetailEntry, View } from "../nav"

export interface AppShellProps {
  /** Persistent in landscape; mounted only on the portrait Map surface. */
  map: React.ReactNode
  /** Drawn with the live map but under any sidebar, sheet or overlay. */
  mapControls: React.ReactNode
  /** Drawn above the panel and controls. */
  authOverlay?: React.ReactNode
  /**
   * A non-modal card that floats over the map. Expanded, it draws in the controls layer under their top
   * bar, so a panel the controls open covers it; compact, it draws with the overlay, above the tab bar.
   */
  mapPrompt?: React.ReactNode
  /** Called `(null, view)` for the list/home body and `(entry, view)` for a detail. */
  renderBody?: (entry: DetailEntry | null, view: View) => React.ReactNode
  stack?: readonly DetailEntry[]
}
