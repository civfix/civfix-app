/**
 * The dock's morph progress lives in TabBar.native, but SearchBodyReveal renders in a different subtree
 * and must track the same value so the search body and dock move together (and the fading body keeps
 * painting over the underlying view on exit, with no cream flash). A module-singleton `makeMutable` cell
 * bridges the two on the UI thread with no per-frame `runOnJS` hop; only one TabBar is ever mounted, so
 * a single cell is unambiguous.
 *
 * Native only: it imports react-native-reanimated, which must never reach the web bundle.
 */
import { makeMutable } from "react-native-reanimated"

/** 0 = rest, 1 = docked. */
export const dockMorphProgress = makeMutable(0)
