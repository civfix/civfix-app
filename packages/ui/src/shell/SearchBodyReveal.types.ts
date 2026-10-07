/** The native seam renders Search as an overlay faded by the dock morph; the web seam is a no-op. */
import type { ReactNode } from "react"
import type { DetailEntry, View } from "../nav"

export interface SearchBodyRevealProps {
  /** False starts the fade-out. */
  active: boolean
  renderBody: (entry: DetailEntry | null, view: View) => ReactNode
  topInset: number
  /**
   * A pre-measurement fallback for the dock footprint, used until the dock's first onLayout. It pads the
   * scroll content, never the overlay's box: that would end the viewport at the dock's top edge and turn
   * the strip the bar floats in into inert paint.
   */
  bottomInset: number
}
