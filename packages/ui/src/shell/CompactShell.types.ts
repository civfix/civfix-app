/**
 * Props shared by both CompactShell seams so call sites are identical and the package emits one
 * CompactShell.d.ts. The `.web` seam must import none of react-native-reanimated, @gorhom/bottom-sheet or
 * expo-blur.
 */
import type { AppShellProps } from "./types"

export interface CompactShellProps {
  /** Called `(null, view)` for the list/home body and `(entry, view)` for an open detail. */
  renderBody?: NonNullable<AppShellProps["renderBody"]>
  /**
   * True once the store no longer has a sheet detail but the sheet is still mounted so it can slide fully
   * off-screen. The seam runs its exit animation and freezes the rendered detail so the content does not
   * swap to the underlying view mid-slide.
   */
  closing?: boolean
  /**
   * Fired when the exit slide is complete. The shell restores the dock only after this, so the dock never
   * pops back in over a still-visible sheet.
   */
  onClosed?: () => void
}
