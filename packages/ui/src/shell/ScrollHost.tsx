/**
 * ScrollHost - the SHELL-INJECTED scroll-container seam (Stage 4 slice 1; THE reusable pattern).
 *
 * THE PROBLEM
 * A scrollable feature body (the people search list, the person-detail scroll content, any future feed)
 * must use a DIFFERENT scroll container depending on the SHELL it is mounted in - even on the SAME
 * native platform:
 *   - native, inside the COMPACT bottom sheet (CompactShell.native / @gorhom/bottom-sheet): the inner
 *     scroll and the sheet's drag gesture must COORDINATE (drag the sheet from a scrolled-to-top list,
 *     scroll the list once the sheet is full), so the body's scroll must be a DECORATED one. It was
 *     gorhom's `BottomSheetScrollView` / `BottomSheetFlatList`; since round 5 it is a plain RN scrollable
 *     wrapped by this package's own decorators (see WHO PROVIDES WHAT).
 *   - native, inside the EXPANDED panel (ExpandedShell, e.g. iPad landscape): there is no bottom sheet,
 *     so the body's scroll MUST be a PLAIN RN `ScrollView` / `FlatList`.
 *   - web (CompactShell.web / ExpandedShell on react-native-web): the sheet drag is a PanResponder bound
 *     only to the grab handle, so a plain RN scroll never fights it - PLAIN RN containers again.
 *
 * Because the same body on the same platform needs gorhom-in-the-sheet but plain-in-the-panel, a static
 * `.native` / `.web` file seam is NOT enough (the file extension cannot distinguish "which shell"). The
 * decision is a RUNTIME, per-SHELL one - so the SHELL injects the scroll components through context and
 * the body consumes them.
 *
 * THE SEAM
 *   - `ScrollHostProvider value={{ ScrollView, FlatList }}` wraps a shell's body region.
 *   - `useScrollHost()` returns `{ ScrollView, FlatList }`; a body destructures and uses them exactly
 *     like the RN components (same props).
 *   - The DEFAULT (no provider mounted) is the plain RN `ScrollView` / `FlatList`, so a body rendered in
 *     a gallery / test / any non-sheet host "just works" without a provider.
 *
 * WHO PROVIDES WHAT
 *   - CompactShell.native: provides PLAIN RN `ScrollView` / `FlatList` wrapped in three decorators. It has
 *     NOT provided gorhom's `BottomSheetScrollView` / `BottomSheetFlatList` since commit 6868c56 — those
 *     were retired in round 5 because their drag handoff is inseparable from a scroll LOCK that capped the
 *     scroll range of every sheet body (see CompactShell.native's header). The decorators, innermost to
 *     outermost, are:
 *       1. `makeSheetHandoffScrollHost` (SheetHandoffScroll.native) — a downward pull at the top of the
 *          content drags the sheet down / collapses it, replacing what gorhom's scrollables used to do,
 *          without the lock.
 *       2. `makeKeyboardAwareScrollHost` (KeyboardAwareScroll.native) — keeps a focused field above the
 *          soft keyboard, and grows the sheet to its tallest snap on keyboard show.
 *       3. `makeMinimizeAwareScrollHost` (MinimizeAwareScroll.native) — feeds the offset to the bottom
 *          TabBar's scroll-minimize.
 *   - PortraitShell.shared: provides the keyboard-aware plain host around the base + overlay surfaces.
 *   - CompactShell.web + ExpandedShell: provide the plain RN defaults (they never import gorhom).
 *
 * THE ESCAPE HATCH — nested vertical scrollers. Every decorator above assumes the scrollable it wraps IS
 * the surface's main scroll region. A body that renders a SECOND vertical scroller inside the sheet (a
 * nested pane, a scrollable inner card) must give that inner scroller its own plain host:
 *     <ScrollHostProvider value={PLAIN_SCROLL_HOST}>…</ScrollHostProvider>
 * (the GroupInfoBody pattern). Otherwise the inner scroller arms the sheet handoff from its own offset 0
 * and pulling down inside it collapses the whole sheet.
 *
 * (Historical note: `PostDetailBody.tsx` and `SavedPostsBody.tsx` long rendered NO scrollable from this
 * host at all — a known gap. Both now own a host ScrollView like every other "scroll" body; the guard
 * for that lives in bodies/__tests__/postScrollOwnership.test.ts.)
 *
 * DOUBLE-SCROLL RECONCILIATION
 * A "scroll" body now OWNS its scroll (via this host), so the shells must NOT also wrap it in their own
 * ScrollView (that would nest two scrollers). The shells therefore render every body RAW inside a flex:1
 * region and let the body's ScrollHost component carry the scroll. (Pre-4B the shells wrapped "scroll"
 * bodies in a ScrollView; that wrapping is removed - see ExpandedShell / CompactShell.* .) "full" bodies
 * (thread/drop) still render raw and own their own layout, unchanged.
 *
 * The component PROPS are kept deliberately loose: gorhom's BottomSheetScrollView/FlatList and RN's
 * ScrollView/FlatList have compatible-enough runtime props but do not share a single TS type, and a body
 * uses them positionally (it passes `data`/`renderItem`/`contentContainerStyle`/`style`). Keeping the seam
 * open here avoids leaking gorhom's types into the shared (web-safe) surface while letting each provider
 * pass its concrete component. The one thing that IS named is the list's imperative handle
 * (`ScrollHostListHandle`), so a body that scrolls its own list gets a checked ref instead of an `as never`
 * cast - every decorator below forwards its ref to the RN FlatList underneath, so the handle is real.
 *
 * This module is RN + React only (no gorhom): the gorhom components arrive by INJECTION from the
 * `.native` shell, never by import here, so the shared body source stays gorhom-free (import-guard).
 *
 * ----------------------------------------------------------------------------------------------------
 * FLASH-LIST (Stage 5C perf assessment) - DECISION: KEEP RN FlatList; flash-list deferred.
 * ----------------------------------------------------------------------------------------------------
 * The plan's perf pass floats swapping the long paginated lists (notifications, threads/inbox, reports,
 * people, feed) from RN FlatList to @shopify/flash-list, provided cleanly THROUGH this ScrollHost seam:
 * a 3rd `ScrollHostValue` variant whose `FlatList` is a FlashList, coordinated with the gorhom sheet on
 * native-in-sheet and a plain FlashList on web/expanded. This was assessed against the installed deps and
 * NOT adopted. The bodies keep the RN FlatList they already consume via this seam (no per-body change);
 * the seam stays the single place a future swap would land. Why deferred (concrete blockers, not vibes):
 *
 *   1. flash-list v2 API churn vs gorhom's helper. @shopify/flash-list@2.3.2 is installed. gorhom
 *      (@gorhom/bottom-sheet@5.2.14) DOES ship a `BottomSheetFlashList` + `createBottomSheetScrollableComponent`
 *      / `useBottomSheetScrollableCreator`, BUT `BottomSheetFlashList` is SELF-DEPRECATED (it console.warns
 *      "BottomSheetFlashList is deprecated, please use useBottomSheetScrollableCreator instead") AND it is
 *      written against flash-list v1 (`estimatedItemSize`, fixed renderScrollComponent). flash-list v2
 *      REMOVED `estimatedItemSize` (auto-sizing now), so the convenience component is mismatched. The
 *      non-deprecated path (`useBottomSheetScrollableCreator()` -> a `renderScrollComponent` prop on each
 *      FlashList) is real but is PER-LIST wiring + reanimated-4 worklet coordination, not the transparent
 *      `<FlatList .../>` drop-in this seam currently injects. That is exactly the fragile gorhom<->flash-list
 *      coordination the task said not to force.
 *
 *   2. Dependency / single-RN risk. flash-list is NOT in @civfix/ui peerDependencies, NOT installed in
 *      civfix-mobile, and NOT in civfix-shared. It currently exists ONLY in civfix-web (a dead dep - NO
 *      source imports it anywhere today, verified by grep). Worse, in civfix-web's store flash-list@2.3.2
 *      resolved `react-native@0.82.1` as a transitive peer - the VERIFY gate pins a single
 *      react-native@0.81.5. Threading flash-list through the shared seam means adding it to @civfix/ui
 *      peers + the mobile app (a native module -> autolinking, per the plan's "new native lib goes in the
 *      APP's package.json" rule) AND pinning its RN peer, with flash-list v2's New-Architecture (Fabric)
 *      requirement to validate on the mobile build. High blast radius for a virtualization win FlatList
 *      already delivers.
 *
 *   3. FlatList already virtualizes these lists fine. Every long list here is CURSOR/INFINITE paginated
 *      (useMyReports / useNotifications / inbox / people / feed) - the page sizes are bounded and FlatList's
 *      windowing handles them without jank at the data volumes civfix renders. flash-list's win (cell
 *      recycling) is marginal until lists are very long; these are not.
 *
 * HOW TO LAND IT LATER (when the cost is justified): add `@shopify/flash-list` to @civfix/ui peerDeps
 * (+ the mobile app dep, pinned to the repo's RN), build a `FLASH_SCROLL_HOST` here whose FlatList is the
 * FlashList wired with `renderScrollComponent={useBottomSheetScrollableCreator(...)}` on native-in-sheet
 * (and a bare FlashList on web/expanded), and have CompactShell.native / .web + ExpandedShell inject it for
 * the paginated bodies. Bodies need NO change - they already read `FlatList` from this host. Re-run the
 * single-RN check (`pnpm why react-native` -> exactly one) after adding the dep.
 */
import React, { createContext, useContext } from "react"
import { ScrollView as RNScrollView, FlatList as RNFlatList } from "react-native"

/**
 * The scroll components a body consumes. Props stay open on purpose (see file header): a body uses them
 * with the standard RN ScrollView / FlatList prop shape, and each shell injects either the plain RN
 * components or gorhom's sheet-coordinated equivalents.
 */
export interface ScrollHostValue {
  /** A vertical scroll container (RN ScrollView, or gorhom BottomSheetScrollView in the native sheet). */
  ScrollView: React.ComponentType<any>
  /** A virtualized list (RN FlatList, or gorhom BottomSheetFlatList in the native sheet). */
  FlatList: React.ComponentType<ScrollHostListProps>
}

export interface ScrollHostListHandle {
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void
  scrollToEnd?: (options?: { animated?: boolean }) => void
}

export type ScrollHostListProps = Record<string, unknown> & {
  ref?: React.Ref<ScrollHostListHandle>
}

/** The plain RN defaults - used when no shell provider is mounted (gallery / test / non-sheet host). */
const DEFAULT_SCROLL_HOST: ScrollHostValue = {
  ScrollView: RNScrollView as React.ComponentType<any>,
  FlatList: RNFlatList as unknown as React.ComponentType<ScrollHostListProps>,
}

const ScrollHostContext = createContext<ScrollHostValue>(DEFAULT_SCROLL_HOST)
ScrollHostContext.displayName = "ScrollHostContext"

export interface ScrollHostProviderProps {
  /** The scroll components this shell region injects (plain RN, or gorhom's sheet-coordinated ones). */
  value: ScrollHostValue
  children: React.ReactNode
}

/** Provide the scroll components for everything a shell renders in its body region. */
export function ScrollHostProvider({ value, children }: ScrollHostProviderProps) {
  return <ScrollHostContext.Provider value={value}>{children}</ScrollHostContext.Provider>
}

/**
 * Read the injected scroll components. Returns the plain RN `{ ScrollView, FlatList }` when no provider
 * is mounted, so a body works stand-alone. A scrollable body destructures this and uses the components
 * for its scroll region:
 *   const { FlatList } = useScrollHost()
 *   return <FlatList data={...} renderItem={...} />
 */
export function useScrollHost(): ScrollHostValue {
  return useContext(ScrollHostContext)
}

/** The plain-RN scroll host the web + expanded shells inject (exported so they share one identity). */
export const PLAIN_SCROLL_HOST = DEFAULT_SCROLL_HOST
