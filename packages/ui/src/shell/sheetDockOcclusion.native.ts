/**
 * The detail sheet (CompactShell.native) and the dock (TabBar.native) live in different subtrees, but the
 * dock must track the sheet's live position so it sinks as the card rises and returns as it slides away,
 * with no dead frame after the slide ends. Same UI-thread `makeMutable` bridge as `dockMorphProgress`; at
 * most one sheet and one dock are mounted. CompactShell resets it to 0 on unmount so a missed animation
 * callback can never strand the dock hidden.
 *
 * Native only: it imports react-native-reanimated, which must never reach the web bundle.
 */
import { makeMutable } from "react-native-reanimated"

/** 0 = dock fully shown, 1 = sheet covering the dock zone. */
export const sheetDockOcclusion = makeMutable(0)
