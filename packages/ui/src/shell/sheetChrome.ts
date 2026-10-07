import type { Snap } from "../nav"
import { space } from "../theme"

// Card insets as [peek, full], interpolated between those snaps. The bottom gap is 0 at every snap: the
// sheet presents as a modal flush to the screen bottom, because any gap exposed the raw background under
// the card and sliced the scrolled content above the screen edge.
export const SHEET_FLOAT_SIDE: [number, number] = [space["3"], space["1"]]
export const SHEET_FLOAT_BOTTOM: [number, number] = [0, 0]
export const SHEET_FLOAT_RADIUS: [number, number] = [30, 22]

/** Grab-handle geometry shared by the native and web compact sheets. */
export const SHEET_HANDLE_HEIGHT = 20
export const SHEET_HANDLE_BAR = { width: 38, height: 5, borderRadius: 3 } as const

export const SHEET_HEADER_SIDE_PAD = 14

// The top pad stays constant across snaps: a peek-aware top pad made the search bar jump while dragging.
export function sheetHeaderPad(snap: Snap): { paddingTop: number; paddingBottom: number } {
  return { paddingTop: 0, paddingBottom: snap === 0 ? space["5"] : space["3"] }
}
