/**
 * Sheet -> dock occlusion singleton (native seam; fluid modal-dismiss handoff).
 *
 * The portrait detail sheet (CompactShell.native) and the bottom glass dock (TabBar.native) live in
 * DIFFERENT subtrees, but the dock's visibility must track the sheet's live position so the two hand
 * off fluidly: the dock sinks/fades out as the card rises over it on open, and rises/fades back in as
 * the card slides down past it on dismiss — no dead frame where the dock pops after the slide ends.
 *
 * Same bridge pattern as `dockMorphProgress`: a module-singleton `makeMutable` cell written on the UI
 * thread by CompactShell (a `useAnimatedReaction` mapping gorhom's `animatedPosition` through
 * `dockOcclusionFromSheet`) and read straight in TabBar's `useAnimatedStyle` — no per-frame `runOnJS`.
 * There is at most ONE portrait detail sheet and ONE dock mounted, so a single cell is unambiguous.
 * CompactShell resets it to 0 on unmount (sheet gone => dock fully unoccluded), so a missed animation
 * callback can never strand the dock hidden.
 *
 * NATIVE ONLY: imports react-native-reanimated, so only `.native` files may import this module. The web
 * seam keeps its mount/unmount gating in PortraitShell.shared (parity is a follow-up, not required).
 */
import { makeMutable } from "react-native-reanimated"

/** 0 = no sheet over the dock zone (dock fully shown) .. 1 = sheet covering it (dock fully hidden). */
export const sheetDockOcclusion = makeMutable(0)
