/**
 * Shared contract for the CompactShell sheet seam (stage 3C-1).
 *
 * CompactShell is the bottom-sheet surface for the COMPACT layout (portrait). Its implementation
 * is platform-split:
 *   - `.native` ports the historic mobile HomeSheet VERBATIM (@gorhom/bottom-sheet: 3 snaps, the
 *     reanimated expand-outward glass card, expo-blur, the tap-cycle grab handle, keyboard "extend").
 *   - `.web` is a worklet-free transform sheet (an absolutely-positioned card whose height + expand-
 *     outward geometry animate via a CSS transition; drag/snap via react-native PanResponder). It
 *     imports NEITHER react-native-reanimated, @gorhom/bottom-sheet, NOR expo-blur.
 *
 * Both seam files share these props so call sites are identical and the package emits ONE
 * CompactShell.d.ts. The selector (CompactShell.tsx) re-exports the .web seam for tsc/Node; bundlers
 * resolve the .native/.web sibling first.
 */
import type { AppShellProps } from "./types"

export interface CompactShellProps {
  /**
   * Map the active entry / list view to a body node. Defaults to the production router
   * (`defaultRenderBody`), which resolves every reachable view/kind to a real body.
   * Called `(null, view)` for the list/home body and `(entry, view)` for an open detail.
   */
  renderBody?: NonNullable<AppShellProps["renderBody"]>
  /**
   * True once the shell has decided the sheet should DISMISS (the store no longer has a sheet detail),
   * but the sheet is still mounted so it can slide fully OFF-SCREEN before it is torn down. The seam runs
   * its exit animation (native: gorhom `close()` → index -1 → onClose) and FREEZES the rendered detail to
   * the last entry so the content does not swap to the underlying view mid-slide. When false the sheet is
   * live (fresh mount = the from-off-screen entry animation). See PortraitShellFrame's presence gate.
   */
  closing?: boolean
  /**
   * Fired when the exit slide-down has fully completed (the sheet is off-screen). The shell unmounts the
   * sheet AND restores the dock only after this — so the dock never pops back in over a still-visible sheet.
   */
  onClosed?: () => void
}
