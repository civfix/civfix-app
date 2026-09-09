/**
 * Props for the SearchBodyReveal seam (dock-morph rebuild, body-sync defects 4/5).
 *
 * The native seam renders the Search body as a fading overlay driven by the dock morph `p`; the web seam
 * is a no-op (web keeps Search in the base surface). See SearchBodyReveal.native.tsx for the mechanism.
 */
import type { ReactNode } from "react"
import type { DetailEntry, View } from "../nav"

export interface SearchBodyRevealProps {
  /** True while the current view IS Search (the overlay reveals in); false starts the fade-out. */
  active: boolean
  /** The shell's body renderer; the overlay calls `renderBody(null, "search")` to render the Search body. */
  renderBody: (entry: DetailEntry | null, view: View) => ReactNode
  /** Top safe-area padding (matches the base surface). */
  topInset: number
  /**
   * Bottom chrome clearance (the dock footprint) — a PRE-MEASUREMENT FALLBACK only. The native seam pads
   * its scroll CONTENT by the live `tabBarStore` footprint so the list runs under the floating dock, and
   * falls back to this shell-resolved nominal for the frames before the dock's first onLayout. It is NOT
   * applied to the overlay's box: doing that ended the scroll viewport at the dock's top edge and turned
   * the strip the bar floats in into inert paint.
   */
  bottomInset: number
}
