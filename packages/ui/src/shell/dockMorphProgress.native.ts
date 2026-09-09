/**
 * Dock-morph progress singleton (native seam; dock-morph rebuild, body-sync defects 4/5).
 *
 * The bottom dock's morph progress `p` (0 = tabs + orb, 1 = docked search field) lives as a local
 * `useSharedValue` inside TabBar.native, deeply wired into every derived chrome style. To SYNC the search
 * BODY reveal to that same morph (so body + dock move together on enter, and the fading search body keeps
 * painting over the underlying view on exit — no cream flash), the body layer — rendered in a DIFFERENT
 * component subtree (PortraitShellFrame's SearchBodyReveal) — needs to read the same value.
 *
 * A module-singleton `makeMutable` shared value bridges the two subtrees on the UI thread with NO per-frame
 * `runOnJS` hop: TabBar MIRRORS its local `p` into this singleton via a `useAnimatedReaction` (a cheap
 * worklet copy), and SearchBodyReveal.native reads it straight in a `useAnimatedStyle`. There is only ever
 * ONE TabBar mounted, so a single shared cell is unambiguous; TabBar resets it whenever the morph resets.
 *
 * NATIVE ONLY: this imports react-native-reanimated (a native module), so only `.native` files import it.
 * The web SearchBodyReveal seam is a no-op (web renders search in the base surface as before), so nothing
 * on the web/SWC pipeline ever pulls reanimated in through here.
 */
import { makeMutable } from "react-native-reanimated"

/** Shared morph progress mirror (0 rest, 1 docked). Written by TabBar.native, read by SearchBodyReveal.native. */
export const dockMorphProgress = makeMutable(0)
