/**
 * CompactShell (native seam) - the draggable home bottom sheet (@gorhom/bottom-sheet).
 *
 * FLOATING GLASS model - ported from the pre-unification mobile `HomeSheet`, which is the SMOOTH
 * reference. An intermediate rewrite of this file janked the pull-up/pull-down ("weird movements / left
 * over stuff"); this restores the reference's mechanism:
 *
 *   - gorhom snap = the sheet HEIGHT, and the sheet sits flush to the SCREEN bottom (NO `bottomInset`).
 *     Snap anchors are the design's 844pt stops scaled to the device: peek 96, mid 470, full 786.
 *   - The whole float is ONE translucent-cream glass CARD rendered as gorhom's `backgroundComponent`,
 *     which insets itself off the sheet edges - side 12->4, bottom 16->4, radius 30->22 - CONTINUOUSLY
 *     off the sheet's own `animatedIndex`. Because the card is positioned RELATIVE to gorhom's background
 *     container (top:0 + animated left/right/bottom), it spans "sheet minus the float gaps" and therefore
 *     tracks the sheet EXACTLY at every drag fraction. The visible card heights still land on the design:
 *     peek 96-16=80, mid 470-10, full 786-4 (so this is pixel-identical to the prior shell AT the snaps,
 *     and smooth BETWEEN them).
 *
 * Why the prior rewrite janked (all removed here): it lifted the sheet with a `bottomInset` STEPPED by a
 * React `floatIdx` state (16/10/4) set from onAnimate/onChange - a discrete jump + a mid-gesture
 * re-render - and it re-derived the card HEIGHT by interpolation (`sizeStyle`) which drifts off gorhom's
 * real container height, leaving the card edge lagging the content ("left over stuff"). The reference's
 * relative `bottom` inset has neither problem. (Confirmed on the same gorhom 5.2.14 the reference used,
 * so the inset-the-card approach DOES render - the earlier "gorhom over-draws the card" note was wrong.)
 *
 * Unified wiring kept: reads `useNavStore` directly (snap drives the sheet; grab-handle tap / gorhom
 * onChange call setSnap; the reportedSnapRef sync effect lifts the old app/index logic); a drag-collapse
 * of a detail down to peek returns to the view it was opened from (collapseToParent); the header swaps SearchHeader
 * <-> DetailBar; the body is `renderBody(active, view)`. The content host is a PLAIN View (NOT
 * BottomSheetView) so the body's own gorhom scrollable keeps the scroll handoff. The body fades out as
 * the sheet collapses so its text is gone before the card shrinks past it (no "floating" text).
 *
 * expo-blur / @gorhom/bottom-sheet / react-native-reanimated are ALLOWED here - this is a `.native`
 * seam (Metro bundles it; the import-guard exempts `.native`). The web seam (CompactShell.web.tsx) is
 * a worklet-free transform sheet free of all three.
 */
import React, { useMemo, useRef, useCallback, useEffect } from "react"
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
  ScrollView as RNScrollView,
  FlatList as RNFlatList,
} from "react-native"
import BottomSheet, {
  useBottomSheetInternal,
  type BottomSheetBackgroundProps,
} from "@gorhom/bottom-sheet"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  interpolate,
  Extrapolation,
  runOnJS,
  type SharedValue,
} from "react-native-reanimated"
import { BlurView } from "expo-blur"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { makeThemedStyles, space, useTheme } from "../theme"
import { useNavStore, type Snap, type View as NavView, type DetailEntry } from "../nav"
import { useT } from "../i18n"
import { useHaptics } from "../capabilities"
import { SearchHeader } from "./SearchHeader.native"
import { SheetHeader } from "./SheetHeader.shared"
import { armCollapse, shouldCollapseOnSettle, COLLAPSE_SWAP_AT } from "./dragCollapse"
import { defaultRenderBody } from "./BodyRouter"
import { ScrollHostProvider } from "./ScrollHost"
import { makeContentBottomReserveScrollHost } from "./ContentBottomReserve"
import { makeKeyboardAwareScrollHost } from "./KeyboardAwareScroll"
import { makeMinimizeAwareScrollHost } from "./MinimizeAwareScroll.native"
import { makeSheetHandoffScrollHost } from "./SheetHandoffScroll.native"
import { resolveBodyLayout } from "./bodyLayout"
import { DETAILS_ARE_FULL_PAGE } from "./detailPresentationPlatform"
import { BodyTransition } from "./BodyTransition.native"
import { sheetDismissConfig, sheetMoveConfig } from "./motionConfigs.native"
import { useStackDirection } from "./useStackDirection"
import { compactBottomChrome, dockOcclusionFromSheet, sheetSnapPoints } from "./tabBarLogic"
import { sheetDockOcclusion } from "./sheetDockOcclusion.native"
import type { CompactShellProps } from "./CompactShell.types"

/**
 * The native-sheet scroll host: PLAIN RN ScrollView / FlatList (round 5, final form).
 *
 * WHY NOT gorhom's BottomSheetScrollView/FlatList anymore: their drag handoff is INSEPARABLE from their
 * scroll LOCK (useScrollable returns LOCKED at every detent except the exact-equality EXTENDED one, and
 * while LOCKED it force-scrollTo's the content back every frame and pins decelerationRate to 0), and that
 * lock is exactly what broke the audit's F4 scroll. Pull-down-to-collapse is instead provided by
 * `makeSheetHandoffScrollHost` below, which takes the handoff WITHOUT the lock — so
 * `enableContentPanningGesture` stays false and the scrollables stay plain RN. The sim showed every profile
 * scroll clamping at one fixed offset (~150pt of range on a body with ~800pt of overflow) and
 * rubber-banding back, IDENTICALLY with and without content panning: an end-to-end walk of our own tree
 * (bodyHost -> BodyTransition -> bodyKeyHost -> body ScrollView, all flex:1; content padding additive
 * throughout) found no height cap in this package, which leaves gorhom's scrollable internals (its
 * reanimated scroll-events handler that force-scrollTo's captured offsets, its animatedProps, its
 * active-scrollable registry, and the animated content-mask sizing they depend on) as the component whose
 * runtime behavior caps the range. Plain RN scrollables inside the explicitly-sized content region below
 * (sheetContentHeight) have none of that: the viewport is definitively bounded, contentSize is the natural
 * content height, and the full range scrolls. This also retires the FIX A registration-race class (there
 * is no shared scrollable registry to corrupt).
 *
 * NOTE the consequence for the DRAG, which this file's comments used to state too absolutely: with plain
 * scrollables the sheet is no longer draggable by its body THROUGH GORHOM. It is still draggable by its
 * grab handle, and — since the handoff decorator landed — by a downward pull at the top of the content.
 */
// THREE DECORATORS, innermost -> outermost: SheetHandoff -> KeyboardAware -> MinimizeAware.
//
//  - makeSheetHandoffScrollHost (INNERMOST) gives a DOWNWARD drag at the top of the content back to the
//    sheet, so pulling down on a body collapses the sheet the way an iOS modal does. It must be innermost
//    because its reanimated `useAnimatedScrollHandler` has to be the handler the scrollable actually
//    mounts, reading the offset on the UI thread at the native sample rate.
//  - makeKeyboardAwareScrollHost scrolls a focused field deep in a tall form ABOVE the soft keyboard
//    (gorhom's keyboardBehavior="extend" only grows the sheet; it does not scroll the inner list to the
//    focused field, and it only tracks BottomSheetTextInput — the bodies use plain RN TextInput). On
//    keyboard show it also grows the sheet to its tallest snap (onKeyboardShow -> setSnap(2)).
//  - makeMinimizeAwareScrollHost (OUTERMOST) feeds BOTH the ScrollView and the FlatList to the bottom
//    TabBar's Apple-Music scroll-minimize (dockMinimizeStore). It is outside keyboard-aware — which only
//    wraps the ScrollView, and forwards our onScroll — so the FlatList is caught too.
//
// `SHEET_SCROLL_HOST_SAFE_BOTTOM` and `sheetScrollHostFor` are built from this, so they inherit all three.
const SHEET_SCROLL_HOST = makeMinimizeAwareScrollHost(
  makeKeyboardAwareScrollHost(
    makeSheetHandoffScrollHost({
      ScrollView: RNScrollView as React.ComponentType<any>,
      FlatList: RNFlatList as React.ComponentType<any>,
    }),
    { onKeyboardShow: () => useNavStore.getState().setSnap(2) },
  ),
)

/**
 * Add the safe-area BOTTOM inset to a scrollable's content padding (round 5 fix). The flush-bottom modal
 * card (no gorhom bottomInset, FLOAT_BOTTOM 0) means a scroll body's content now runs to the physical
 * screen bottom — so the scroll CONTENT reserves insets.bottom, letting the last row scroll up clear of
 * the home indicator / Android nav bar while the glass card itself stays flush. The additive merge is
 * ContentBottomReserve's (shared with the page stack, which routes a page's safe-area bottom the same
 * way), so each body's own bottom gutter (e.g. ProfileBody / ReportDetailBody's space["10"]) is kept on
 * top of the inset.
 */
function useSafeAreaBottom(): number {
  return useSafeAreaInsets().bottom
}

/** SHEET_SCROLL_HOST with the safe-area bottom added to the scroll content (scroll-layout bodies). */
const SHEET_SCROLL_HOST_SAFE_BOTTOM = makeContentBottomReserveScrollHost(
  SHEET_SCROLL_HOST,
  useSafeAreaBottom,
)

/**
 * The scroll host for the ACTIVE body: "scroll" bodies get the safe-area-padded host (their scrollable IS
 * the sheet content, and it now bottoms at the screen edge); "full" bodies keep the raw host — they own
 * their layout and bodyHost already reserves insets.bottom for their pinned footers, so padding their
 * inner lists too would double-gutter (e.g. the conversation list above its composer).
 */
function sheetScrollHostFor(layout: "scroll" | "full") {
  return layout === "full" ? SHEET_SCROLL_HOST : SHEET_SCROLL_HOST_SAFE_BOTTOM
}

// The SHEET (gorhom snap) heights are the design anchors, derived by the shared `sheetSnapPoints` (see
// tabBarLogic) so this seam and the web seam can never drift apart. The visible glass card is the sheet
// MINUS the card's animated bottom gap, which is 0 at every snap now, so the card IS the snap height.

// Expand-outward float gaps drawn as CONTINUOUS card insets off animatedIndex (0=peek .. 2=full):
// side 12->4, corner 30->22. The BOTTOM gap is 0 at every snap (round 5 fix): the detail sheet presents
// as an iOS-style modal whose card sits FLUSH to the physical screen bottom — the old 16->4 float gap
// (plus the gorhom bottomInset) left a strip of raw background visible under the sheet and sliced the
// scrolled content that far above the screen edge. Bodies pad their content by the safe-area bottom
// instead (see the sheet scroll host + bodyHost padding below), so the last row clears the home
// indicator while the glass card itself reaches y = screen height.
const FLOAT_SIDE: [number, number] = [12, 4]
const FLOAT_BOTTOM: [number, number] = [0, 0]
const FLOAT_RADIUS: [number, number] = [30, 22]

/**
 * The CONSTANT side gutter the sheet CONTENT (header + body) uses — the midpoint of FLOAT_SIDE, i.e. the
 * exact value the old animated inset held at MID.
 *
 * WHY CONSTANT: the content host used to carry `contentFloatStyle`, an animated `marginLeft/marginRight`.
 * Margin is a LAYOUT property, so every frame of every sheet drag re-ran layout for the whole subtree —
 * header, body, and each body's scrollable and its rows. That is the single most expensive thing in the
 * sheet and it produced no visible benefit below index 0.7 (bodyFadeStyle is already 0 there). The body
 * now gets a plain constant gutter and only the HEADER keeps an animated remainder (headerFloatStyle),
 * which is a small, cheap subtree.
 *
 * ACCEPTED VISUAL DELTA: at FULL the body sits 4pt further in than the card edge (card 4, body 8);
 * pixel-exact at MID; invisible at PEEK. Flagged to design.
 */
const CONTENT_SIDE = (FLOAT_SIDE[0] + FLOAT_SIDE[1]) / 2 // 8

/** The grab handle's rendered height (styles.handleArea). Shared with the explicit content-region height. */
const HANDLE_HEIGHT = 20

// Body-content fade on collapse. The sheet's `animatedIndex` runs 0=peek .. 2=full. As the sheet
// collapses toward peek the expanded body text must vanish EARLY - before the glass card shrinks past
// it - otherwise the text is briefly left "floating" over the map with no card behind it. So fade the
// body to 0 in the FIRST part of the mid->peek leg: fully opaque at/above BODY_FADE_FROM, fully gone by
// BODY_FADE_TO. Clamped, so during a full->mid drag it stays opaque. Tunable: raise BODY_FADE_TO to make
// the text disappear sooner, lower it to let it linger.
//
// BODY_FADE_TO is pinned to COLLAPSE_SWAP_AT (the mid-collapse parent-swap fraction, from ./dragCollapse):
// the header's DetailBar->SearchHeader swap fires at that same point, so the body content has already faded
// to 0 there and its detail->list change is invisible too - only the header transitions, and while moving.
const BODY_FADE_FROM = 0.95
const BODY_FADE_TO = COLLAPSE_SWAP_AT

const useBlur = Platform.OS === "ios"
const AnimatedBlur = Animated.createAnimatedComponent(BlurView)

/**
 * The floating glass background card. gorhom OVER-DRAWS its background BELOW the screen (the container's
 * bottom is off-screen), so a relative `bottom` inset on the card never shows - it lands off-screen and
 * the card reads as "attached" to the bottom edge. So the card's bottom float comes from an explicit
 * HEIGHT instead: height = (screen height - the sheet's top) - the bottom gap, i.e. the visible sheet
 * height minus the float gap. The sheet top is read from gorhom's `animatedPosition` (pixels) so the card
 * tracks the sheet EXACTLY at every drag fraction - no interpolation drift, no leftover edge. The SIDE
 * gaps (left/right) DO render as insets (the container is full width, not over-drawn horizontally), and
 * the rounded bottom corners now sit on the visible float line. All continuous off the animated values.
 */
function makeBackground(
  animatedIndex: SharedValue<number>,
  animatedPosition: SharedValue<number>,
  screenH: number,
) {
  return function GlassBackground({ style }: BottomSheetBackgroundProps) {
    const styles = useStyles()
    const th = useTheme()
    // gorhom's MEASURED hosting-container height (rawContainerHeight): the sheet bottoms exactly at this value
    // in animatedPosition's coordinate space (non-modal detent = containerHeight - snapHeight, and the hosting
    // container is already inset by bottomInset). Using it - instead of useWindowDimensions, which under-reports
    // by varying system-bar amounts on Android edge-to-edge - keeps the card locked to the REAL sheet bottom on
    // every device. The background component is rendered inside gorhom's internal provider, so the hook resolves.
    const { animatedLayoutState } = useBottomSheetInternal()
    // The card wrapper carries the float gaps + the s4 drop shadow. NO overflow:hidden here (iOS
    // masksToBounds would eat the shadow); the rounded clip child below masks the blur/wash/sheen.
    const cardStyle = useAnimatedStyle(() => {
      const i = animatedIndex.value
      const side = interpolate(i, [0, 2], FLOAT_SIDE, Extrapolation.CLAMP)
      const gap = interpolate(i, [0, 2], FLOAT_BOTTOM, Extrapolation.CLAMP)
      const radius = interpolate(i, [0, 2], FLOAT_RADIUS, Extrapolation.CLAMP)
      // The sheet's visible bottom in animatedPosition's space. On Android use gorhom's measured container
      // height (rawContainerHeight; -999 until laid out, so fall back to screenH on the first frame). On iOS,
      // useWindowDimensions == the full screen == the container, so `screenH` is exactly right (unchanged).
      const rawH = animatedLayoutState.value.rawContainerHeight
      // Prefer gorhom's MEASURED container height on BOTH platforms once laid out: with the TabBar
      // bottomInset the container is now shorter than the window on iOS too (it used to equal the window,
      // which is why iOS previously read `screenH`). Fall back to the passed container-height estimate
      // (window - tabBarHeight) only for the first frame before rawContainerHeight is measured.
      const sheetBottom = rawH > 0 ? rawH : screenH
      // FLOAT_BOTTOM is 0 at every snap (flush modal card), so the card reaches the exact sheet bottom;
      // the interpolation is kept so a future non-zero gap slots back in without re-deriving this.
      const cardH = Math.max(sheetBottom - animatedPosition.value - gap, 0)
      return {
        left: side,
        right: side,
        height: cardH,
        // Rounded TOP only: the bottom edge sits flush on the physical screen bottom (round 5 fix), so
        // rounding it would open background slivers at the two bottom corners.
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }
    })
    const radiusStyle = useAnimatedStyle(() => {
      const radius = interpolate(animatedIndex.value, [0, 2], FLOAT_RADIUS, Extrapolation.CLAMP)
      return {
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }
    })
    return (
      <Animated.View style={[style, styles.bgRoot]}>
        <Animated.View style={[styles.cardShadow, cardStyle]}>
          {/* Clip child: fills the wrapper, rounded + overflow:hidden so the blur/wash/sheen mask to it. */}
          <Animated.View style={[styles.cardClip, radiusStyle]}>
            {useBlur ? (
              <AnimatedBlur intensity={th.glass.sheet.blurIntensity} tint={th.scheme === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            ) : null}
            <View style={styles.cardWash} />
            <View style={styles.cardSheen} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    )
  }
}

/**
 * The sticky header: the SHARED SheetHeader (SearchHeader vs DetailBar, per `searchModeFor`) bound to the
 * NATIVE SearchHeader seam. `view`/`active` come from CompactShell as props, not from the store, because
 * a dismissing sheet renders the FROZEN snapshot of them (see the exit freeze below).
 */
function NativeSheetHeader({
  view,
  active,
  stack,
}: {
  view: NavView
  active: DetailEntry | null
  stack: readonly DetailEntry[]
}) {
  const setSnap = useNavStore((s) => s.setSnap)
  return (
    <SheetHeader
      view={view}
      active={active}
      stack={stack}
      SearchHeaderComponent={SearchHeader}
      onSearchFocus={() => setSnap(2)}
    />
  )
}

export function CompactShell({ renderBody = defaultRenderBody, closing = false, onClosed }: CompactShellProps) {
  const styles = useStyles()
  const { t } = useT("nav")
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // The pushed detail sheet presents as an iOS-style modal that COVERS the dock (the dock is hidden while
  // it is up — see portraitShellPlan.bottomChromeVisible) and sits FLUSH to the physical screen bottom
  // (round 5 fix): no gorhom bottomInset at all. An earlier pass inset the sheet by insets.bottom "to
  // clear the home indicator", but that raised the whole CARD off the screen edge — raw background showed
  // through beneath every detail sheet and the scrolled content was sliced that far above the bottom.
  // The home indicator is cleared by CONTENT padding instead: scroll bodies get insets.bottom added to
  // their scroll content (sheetScrollHostFor below), full bodies pad bodyHost by insets.bottom.
  const sheetRef = useRef<BottomSheet>(null)
  const animatedIndex = useSharedValue(0)
  // The sheet's TOP position in pixels (gorhom drives this). The glass card reads it to size its height
  // to the REAL visible sheet at every drag fraction (see makeBackground) - no interpolation drift, so
  // the rounded bottom always sits on the float line. Seeded at `height` (the CLOSED detent, where
  // animateOnMount starts) — not 0 (the screen TOP) — so the dock-occlusion mirror below reads
  // "sheet off-screen" on the pre-layout frame and the dock fades out WITH the rising card instead of
  // vanishing the instant the sheet mounts.
  const animatedPosition = useSharedValue(height)
  // The settled snap index, tracked on the JS thread (from onChange) so the grab-handle tap can
  // cycle peek -> mid -> full -> peek without reading the shared value off-thread.
  const currentIndexRef = useRef(0)
  // Armed by onAnimate when the sheet commits to collapsing a detail down to peek; read on the UI thread by
  // the reaction below, which performs the parent-list swap mid-animation (see COLLAPSE_SWAP_AT).
  const collapseCommitted = useSharedValue(false)

  const snap = useNavStore((s) => s.snap)
  const setSnap = useNavStore((s) => s.setSnap)
  const haptics = useHaptics()
  const storeActive = useNavStore((s) => s.active)
  const storeView = useNavStore((s) => s.view)
  const stack = useNavStore((s) => s.stack)
  // Drag-to-collapse a detail back to the view it was opened FROM (a pin tapped on the Map tab returns to
  // the map; one opened from the Reports list returns to that list; a deep-linked one falls back to its
  // owning list). The store owns that decision - see `originView`. Invoked from onChange on a genuine
  // collapse gesture.
  const collapseToParent = useNavStore((s) => s.collapseToParent)

  // ----- Exit freeze (iOS-modal dismiss). -----
  // On dismiss the store drops the detail synchronously (active -> null / a different view), but the sheet
  // is still on screen sliding OFF (the presence gate keeps it mounted, passing `closing`). If we kept
  // rendering the LIVE store here, the sheet's header + body would swap to the underlying view mid-slide —
  // a visible content flash on the dismissing card. So while `closing` we FREEZE the last real detail
  // (kind+id + the view it was hosted in) and keep rendering THAT until the sheet is gone. The refs track
  // the live values whenever we are NOT closing, so the frozen snapshot is exactly the detail as it looked
  // the instant dismissal began.
  // The STACK is frozen alongside them: the header's back-chevron gate (showBackAffordance) reads the
  // stack, so a live read would strip the chevron off a drilled-in detail the instant dismissal begins -
  // popping a visible control off the card that is still sliding away.
  const frozenEntryRef = useRef<DetailEntry | null>(storeActive)
  const frozenViewRef = useRef<NavView>(storeView)
  const frozenStackRef = useRef<readonly DetailEntry[]>(stack)
  if (!closing) {
    frozenEntryRef.current = storeActive
    frozenViewRef.current = storeView
    frozenStackRef.current = stack
  }
  const active = closing ? frozenEntryRef.current : storeActive
  const view = closing ? frozenViewRef.current : storeView
  const headerStack = closing ? frozenStackRef.current : stack

  // ----- Body transition (compact-mode parity with the desktop-web slide/cross-fade) -----
  // The SAME identity string the FIX A keyed remount below uses; a change drives the entrance animation
  // in BodyTransition.native (push: slide from the right; pop: from the left; replace: fade).
  const bodyKey = active ? `${active.kind}:${active.id ?? ""}` : `home:${view}`
  const direction = useStackDirection(stack.length)

  // The index the sheet last REPORTED (via onChange). The sync effect below only fires snapToIndex for
  // PROGRAMMATIC snap changes (tab select / detail open / collapse), never echoing the user's own drag.
  // (Lifted from the mobile app/index.tsx, which formerly owned this ref + effect.)
  const reportedSnapRef = useRef(0)

  // gorhom snap = SHEET height = the design anchor; the card sits flush on the sheet bottom (FLOAT_BOTTOM 0).
  // The sheet bottoms at the physical screen edge (no gorhom bottomInset), so the full snap only keeps the
  // top headroom clear (status bar + a breathing gap); nothing is reserved at the bottom.
  const snapPoints = useMemo<[number, number, number]>(
    () => sheetSnapPoints(height, insets.top + space["8"]),
    [height, insets.top],
  )

  // THE single knob for every gorhom animation. CORRECTED RATIONALE: the declarative `index={-1}` below
  // is INERT after mount — gorhom's index effect reads `detents[index]`, and detents[-1] is
  // undefined, so it early-returns on `targetPosition === nextPosition` (both undefined). The REAL
  // dismiss driver is the imperative `sheetRef.current?.close()` in the effect below, which routes
  // through handleClose -> animate() -> `configs || _providedAnimationConfigs`. Freshness is guaranteed
  // because useImperativeHandle republishes `close` in a LAYOUT effect of the same commit that flips
  // `closing`, and the child's layout effects flush before this component's useEffect.
  //
  // ANDROID NOTE: verified `@gorhom/bottom-sheet/src/constants.ts` — ANIMATION_CONFIGS = Platform.select({
  // android: { duration: 250, easing: Easing.out(Easing.exp) }, default: { damping: 500, stiffness: 1000,
  // mass: 3, overshootClamping: true, ... } }). On Android the sheet ALREADY ran a deterministic 250ms
  // timing and `onClose` already landed at ~250ms — the presence gate's teardown guard was never the
  // teardown path there. So the "300ms of dead dismiss latency" this fixes is iOS-ONLY; on Android this
  // is a pure curve swap.
  const animationConfigs = useMemo(() => (closing ? sheetDismissConfig() : sheetMoveConfig()), [closing])

  const onChange = useCallback(
    (index: number) => {
      if (index >= 0 && index <= 2) {
        const prevIndex = currentIndexRef.current
        currentIndexRef.current = index
        // Record what the sheet reported (so the sync effect can tell programmatic from gesture changes)
        // and feed it to the store.
        reportedSnapRef.current = index
        setSnap(index as Snap)
        if (index !== prevIndex) haptics.impactLight()
        // Settle-time BACKSTOP for the detail->parent collapse. The smooth path runs EARLIER, mid-animation
        // (onAnimate arms it; the reaction below fires it once the sheet passes COLLAPSE_SWAP_AT), so by the
        // time the sheet arrives at peek the swap has usually already happened and this is a no-op. It stays
        // as a GUARANTEE for any settle to peek the early path missed - notably the interrupted pull-up then
        // quick pull-down, where the up-move never settled so `prevIndex` is still 0 (an earlier `prevIndex
        // !== 0` guard skipped exactly that case, stranding the DetailBar at peek). Gating on the arrival
        // index alone is safe: collapseToParent no-ops at home / mid-flow, so the initial mount-at-peek is
        // a harmless no-op too. See ./dragCollapse + dragCollapse.test.ts.
        if (shouldCollapseOnSettle(index, prevIndex)) collapseToParent()
      }
    },
    [setSnap, collapseToParent, haptics],
  )

  // gorhom fires this when the sheet COMMITS to a snap transition (gesture release or programmatic), at the
  // START of the settle animation - before onChange, which fires on ARRIVAL. When the commit targets peek
  // (toIndex 0) we arm the early parent-swap; any other target disarms it. We gate on the DESTINATION only,
  // not the origin: an interrupted pull-up never settles, so a following pull-down reports `fromIndex` still
  // 0 (gorhom's last-settled index) - an earlier `fromIndex > 0` guard disarmed exactly that collapse. The
  // swap itself happens in the reaction below once the sheet passes COLLAPSE_SWAP_AT, so it lands while the
  // sheet is still moving (smooth) rather than after it stops at peek. See ./dragCollapse.
  const onAnimate = useCallback(
    (fromIndex: number, toIndex: number) => {
      collapseCommitted.value = armCollapse(fromIndex, toIndex)
    },
    [collapseCommitted],
  )

  // Perform the armed dismissal mid-collapse: once a committed sheet drops past COLLAPSE_SWAP_AT (where the
  // body has already faded to 0) swap the detail back to its origin view, then disarm. Doing it here - while
  // the sheet is still animating toward peek - hides the DetailBar->SearchHeader change in the motion instead
  // of popping it after the sheet settles. collapseToParent no-ops for in-progress flows + when no detail is
  // open, so an armed list-only collapse is harmless.
  useAnimatedReaction(
    () => animatedIndex.value,
    (idx) => {
      if (collapseCommitted.value && idx <= COLLAPSE_SWAP_AT) {
        collapseCommitted.value = false
        runOnJS(collapseToParent)()
      }
    },
    [collapseToParent],
  )

  // ----- Dock handoff (fluid open/dismiss). -----
  // Mirror how much of the dock zone the sheet occludes into the module singleton the dock reads
  // (TabBar.native fades/sinks off it). Driven by the sheet's VISIBLE height (window bottom minus the
  // live gorhom position), so the dock tracks the card continuously in BOTH directions — it sinks away
  // as the card rises past it on open and rises back in as the card slides down past it on dismiss,
  // with no dead frame between slide-end and dock return. `height` (window) stands in for gorhom's
  // container height; on Android edge-to-edge it can under-report by the nav-bar inset, which only
  // shifts the WIDE fade band a little — the endpoints (fully shown / fully hidden) still land.
  useAnimatedReaction(
    () => animatedPosition.value,
    (pos) => {
      sheetDockOcclusion.value = dockOcclusionFromSheet(height - pos)
    },
    [height],
  )
  useEffect(
    () => () => {
      // Teardown (incl. the presence gate's sheetTeardownGuardMs safety unmount): the sheet is gone, so whatever the
      // last frame reported, the dock must end fully unoccluded — it can never be stranded hidden.
      sheetDockOcclusion.value = 0
    },
    [],
  )

  // Keep the gorhom sheet in sync with the store's intended snap. Gesture-driven changes arrive via
  // onChange -> setSnap, so when this effect re-runs for that same value the snapToIndex is a no-op
  // (already there); only programmatic transitions actually move the sheet.
  useEffect(() => {
    // Never fight the exit slide: while closing, gorhom is animating to the closed (-1) detent and the
    // store snap is stale (it belongs to the now-dismissed detail).
    if (closing) return
    if (reportedSnapRef.current !== snap) {
      sheetRef.current?.snapToIndex(snap)
    }
  }, [snap, closing])

  // Drive the exit slide the instant the shell asks the sheet to dismiss: gorhom animates the sheet DOWN to
  // its closed (off-screen) position and fires `onClose` when it lands there, which the presence gate uses to
  // finally unmount the sheet + restore the dock. The declarative `index={-1}` below is the primary trigger;
  // this imperative `close()` is a belt-and-suspenders for the same transition. The from-off-screen ENTRY is
  // gorhom's own mount animation (animateOnMount, from the closed detent up to `snap`) — a fresh mount, so a
  // lateral detail->detail swap (the sheet was already up) never re-runs it.
  useEffect(() => {
    if (closing) sheetRef.current?.close()
  }, [closing])

  // With no bottomInset the gorhom container spans the full window, so the window height IS the card's
  // first-frame screen-height fallback. makeBackground prefers gorhom's MEASURED container height
  // (rawContainerHeight) once laid out; this fallback only covers the first frame.
  const Background = useMemo(
    () => makeBackground(animatedIndex, animatedPosition, height),
    [animatedIndex, animatedPosition, height],
  )

  // Float only the HEADER in to match the glass card. The content column now carries a CONSTANT
  // CONTENT_SIDE gutter (see above), so this style only animates the REMAINDER the header needs on top of
  // it: FLOAT_SIDE(12..4) - CONTENT_SIDE(8) = +4..-4. That keeps the search bar / DetailBar locked to the
  // card edge exactly as before while confining the per-frame LAYOUT pass to the header's small subtree
  // instead of the whole body (and every row of every scrollable inside it).
  //
  // marginBottom is dropped entirely: FLOAT_BOTTOM is [0, 0] — dead at every snap (round 5 flush-modal
  // card), so it only ever wrote 0 and cost a layout invalidation per frame for it.
  const headerFloatStyle = useAnimatedStyle(() => {
    const side = interpolate(animatedIndex.value, [0, 2], FLOAT_SIDE, Extrapolation.CLAMP)
    return { marginLeft: side - CONTENT_SIDE, marginRight: side - CONTENT_SIDE }
  })

  // Fade the expanded body OUT early as the sheet collapses (peek). Fully opaque at/above BODY_FADE_FROM,
  // fully transparent at/below BODY_FADE_TO, so the text is gone in the first ~third of the mid->peek
  // leg - well before the glass card shrinks past it - and is never left "floating" over the map. The
  // sticky header (the search bar = the collapsed-state content) is OUTSIDE this fade and stays put.
  //
  // WHILE DISMISSING, THE BAND IS FROZEN, NOT APPLIED. The band is calibrated for the COLLAPSE gesture,
  // where the card stops at peek and anything still painted above that line would be left floating over
  // the map. A DISMISS drives animatedIndex from the snap all the way to -1, so replaying the same band
  // emptied the card at ~0.95 and then slid a BLANK glass rectangle for the remaining ~48% of the travel.
  // Nothing else on the card behaves that way: the blur, the wash, the sheen, the grab handle and the
  // header all ride the 180ms slide at full opacity, which is what an iOS modal dismissal looks like.
  //
  // It FREEZES rather than pinning to 1, because the two cases meet: a drag-to-peek on a detail converts
  // into a dismissal partway down (collapseToParent empties the stack, which flips `closing`). Pinning to
  // 1 there would pop a body that had already correctly faded back to full opacity mid-gesture. Holding
  // the last live value gives the programmatic dismiss a fully-painted card and the converted drag the
  // faded one it already earned.
  const exitOpacity = useSharedValue(1)
  const bodyFadeStyle = useAnimatedStyle(() => {
    if (closing) return { opacity: exitOpacity.value }
    const live = interpolate(
      animatedIndex.value,
      [BODY_FADE_TO, BODY_FADE_FROM],
      [0, 1],
      Extrapolation.CLAMP,
    )
    exitOpacity.value = live
    return { opacity: live }
  }, [closing])

  // The grab handle: a 38x5 bar in a 20px hit area. Tapping it cycles snaps (peek -> mid -> full ->
  // peek), matching the design's tap-to-cycle handle.
  const renderHandle = useCallback(() => {
    const cycle = () => {
      const next = ((currentIndexRef.current + 1) % 3) as Snap
      setSnap(next)
    }
    return (
      <Pressable
        onPress={cycle}
        accessibilityRole="adjustable"
        accessibilityLabel={t("a11y.drag_handle")}
        style={styles.handleArea}
      >
        <View style={styles.handleBar} />
      </Pressable>
    )
  }, [setSnap, t])

  // ROUND 5 SCROLL FIX (part 2): the content region's height is OWNED HERE, explicitly — the tallest
  // snap's sheet height minus the grab handle — instead of flex:1 inside gorhom's animated content mask.
  // The sim clamp survived every gesture-side fix, and our own tree has no cap, so the region the bodies
  // scroll in must be definitively bounded by numbers we control: with this height the body ScrollView's
  // viewport equals exactly the visible card area at full snap (region - header), contentSize is measured
  // naturally against it, and the scroll range is the full content overflow. At lower snaps the region
  // extends below the visible card exactly like gorhom's own highest-detent-keyed mask did; the body fade
  // (bodyFadeStyle) hides it during collapse, unchanged.
  const sheetContentHeight = snapPoints[2] - HANDLE_HEIGHT

  // .pi-sheet-header vertical padding. paddingTop is CONSTANT across snaps so the search bar stays the
  // same distance from the top of the card at every stage (a peek-aware top pad made it visibly jump
  // up/down while dragging between snaps). Only the BOTTOM pad is peek-aware (it sits below the search and
  // doesn't move it): a larger bottom buffer at peek so the search sits balanced in the short card.
  const headerVPad = { paddingTop: 0, paddingBottom: snap === 0 ? 20 : 12 }
  // Parity with CompactShell.web.tsx: the body element is rebuilt ONLY when the navigation identity
  // changes, not on every unrelated CompactShell re-render (snap changes, closing flips, keyboard
  // reserves). Payoff depends on `renderBody` being referentially stable — AppShell.tsx defaults it to a
  // module-level `defaultRenderBody`, so the default path is stable; a consumer passing an inline arrow
  // gets a no-op plus a little overhead. The keyed remount wrapper stays OUTSIDE this memo (FIX A).
  const body = useMemo(() => renderBody(active, view), [renderBody, active, view])
  const showSheetHeader = active !== null || compactBottomChrome(view) !== "docked-search"
  const bodyLayoutKey = active?.kind === "view" ? "home-view" : active?.kind ?? "home-view"
  // The SURVIVING sheet kinds only (drop-pin today), resolved through the same seam the shell uses so this
  // seam and the shell can never disagree about what a kind is. On native the flag is true, so a converted
  // kind reads "full" here - it can only ever reach this component as a page's retained sheet host, never
  // as the sheet body itself, but reading the table raw would have quietly given it the wrong scroll host.
  const sheetBodyLayout = resolveBodyLayout(bodyLayoutKey, DETAILS_ARE_FULL_PAGE)

  return (
    <BottomSheet
      ref={sheetRef}
      // DECLARATIVE snap: bind the gorhom index to the store snap so the sheet lands on the intended detent
      // whenever it (re)creates - e.g. after the full-screen /report flow re-initializes the map-home, where
      // a fresh sheet re-mounts at its initial index and the imperative snapToIndex below would race the
      // not-yet-laid-out sheet (leaving "View my report" stuck at peek). gorhom re-applies the index prop
      // reactively + at the right time, so this is robust to that re-mount; the imperative effect stays as a
      // belt-and-suspenders for in-place programmatic changes.
      // DECLARATIVE index: `snap` while live; `-1` (closed / off-screen) once the shell asks to dismiss, so
      // the sheet slides fully DOWN off the bottom before the presence gate tears it down (onClose below).
      index={closing ? -1 : snap}
      snapPoints={snapPoints}
      animatedIndex={animatedIndex}
      animatedPosition={animatedPosition}
      // Every gorhom move (snap, drag settle, mount, dismiss) runs on OUR vocabulary: 240ms while live,
      // 180ms while dismissing. See the animationConfigs memo above for why this is the real dismiss knob.
      animationConfigs={animationConfigs}
      // Fires when the exit slide lands at the closed detent: hand back to the presence gate to unmount the
      // sheet + restore the dock (kept hidden until now so it never flashes over the still-sliding card).
      onClose={onClosed}
      enableDynamicSizing={false}
      // NO bottomInset (round 5 fix): the modal detail sheet bottoms at the physical screen edge. Any
      // inset here lifts the whole glass card off the bottom, exposing the raw background beneath it and
      // slicing the scrolled content that far above the screen. Home-indicator / Android-nav-bar clearance
      // is CONTENT padding (sheetScrollHostFor + the full-body bodyHost pad), never a container inset.
      bottomInset={0}
      // ROUND 5 SCROLL FIX — gorhom's OWN content pan stays off, permanently.
      // gorhom's content-panning coordination gates ALL inner scrolling on an EXACT-equality check
      // (useScrollable: scrollables are LOCKED unless `animatedPosition === highestDetentPosition`,
      // i.e. SHEET_STATE.EXTENDED), and while LOCKED its scroll handler force-snaps the content back to
      // a captured offset on EVERY scroll frame (useScrollEventsHandlersDefault: scrollTo(lockPosition)).
      // In the portrait modal sheet that manifested as the audit's F4: the profile body scrolled to a
      // fixed offset and rubber-banded back there on every subsequent swipe ("cannot scroll further"),
      // with everything below (settings rows, delete account, recent activity) unreachable — the sheet
      // LOOKED fully up but was not registering as EXTENDED, so the lock pinned the scroll. Disabling the
      // content pan makes gorhom's scrollable status UNCONDITIONALLY UNLOCKED (first branch of the status
      // derivation) — the inner scroll is a plain native scroll with its true content range, categorically
      // immune to the lock.
      //
      // THIS MUST STAY FALSE. Re-enabling it to "get the body drag back" flips the status to LOCKED at every
      // non-EXTENDED detent (details open at MID), force-scrollTo's the content back every frame and pins
      // decelerationRate to 0 — an instant reproduction of the regression above. The body drag is provided
      // instead by makeSheetHandoffScrollHost (SheetHandoffScroll.native), which arms its own RNGH pan only
      // for a DOWNWARD drag while the content is already at offset 0 and hands the position straight to
      // `animateToPosition`. So the sheet is draggable by its grab handle AND by a pull-down at the top of
      // its content, with no scroll lock anywhere. Tap-to-cycle, drag-collapse-to-parent (onAnimate/onChange)
      // and programmatic snaps are unaffected.
      enableContentPanningGesture={false}
      // Lift the sheet to its tallest snap when a text input inside it (e.g. the report "follow-up"
      // composer) focuses, so the BottomSheetTextInput stays visible above the keyboard instead of
      // being covered; restore the prior snap on blur.
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      onChange={onChange}
      onAnimate={onAnimate}
      handleComponent={renderHandle}
      backgroundComponent={Background}
      containerStyle={styles.sheetContainer}
    >
      {/* A single column host (explicit height, see sheetContentHeight) so the sticky header sits ABOVE
          the body and the body region is definitively bounded by our own numbers — never by gorhom's
          animated content mask (round 5 scroll fix). A PLAIN RN View (never gorhom's <BottomSheetView>,
          whose focus effect used to corrupt the scrollable registration). The content sits inside the
          glass card on a CONSTANT CONTENT_SIDE gutter; only the header animates the remaining inset
          (headerFloatStyle), so no per-frame layout pass reaches the body. Bodies pad their own scroll
          content. */}
      <View style={[styles.contentHost, { height: sheetContentHeight, marginHorizontal: CONTENT_SIDE }]}>
        {showSheetHeader ? (
          <Animated.View style={[styles.headerHost, headerVPad, headerFloatStyle]}>
            <NativeSheetHeader view={view} active={active} stack={headerStack} />
          </Animated.View>
        ) : null}
        {/* Inject gorhom's sheet-coordinated scroll components so a body's scroll cooperates with the
            sheet drag. Bodies own their scroll (no double-scroll wrapper here). */}
        <ScrollHostProvider value={sheetScrollHostFor(sheetBodyLayout)}>
          {/* A "full" body (thread composer / drop wizard footer) pins its controls to the card bottom;
              reserve the bottom safe-area inset so they clear the home indicator / Android nav bar (the
              sheet has NO bottomInset anymore, so both platforms need it). Scroll bodies get the inset as
              scroll-content padding instead (sheetScrollHostFor), so their content can still slide under
              the home indicator mid-scroll. The body fades out (bodyFadeStyle) as the sheet collapses. */}
          <Animated.View
            style={[
              styles.bodyHost,
              bodyFadeStyle,
              sheetBodyLayout === "full" ? { paddingBottom: insets.bottom } : null,
            ]}
          >
            {/* FIX A (scroll-lock registration race, issue #66): give the rendered body a STABLE React key
                tied to the active entry's identity (a detail's kind+id, or the list `view` at home). gorhom
                keeps ONE shared active-scrollable registry and registers via a plain useEffect; on a
                body-to-body swap the outgoing body's removeScrollableRef can race the incoming body's
                setScrollableRef, leaving a STALE/WRONG scrollable registered so gorhom drives the wrong node
                and the content snaps back at full height. Keying the body subtree on its identity forces a
                clean unmount->remount on every navigation, so the scrollable cycle is removeScrollableRef
                then setScrollableRef with no interleaving (the new body mounts AFTER the old one's cleanup).
                The key is STABLE within a single body: the same kind+id keeps the same key across that body's
                internal state changes (loading->loaded, wizard steps - which keep one entry identity), so it
                never remounts mid-flow; it only changes when `active`/`view` actually navigates.
                The keyed subtree sits INSIDE BodyTransition (which persists across swaps and animates
                the freshly-remounted body in - entrance-only, so gorhom's scrollable registry still
                sees a clean remove-then-set cycle; see BodyTransition.native's module doc). */}
            <BodyTransition transitionKey={bodyKey} direction={direction}>
              <View key={bodyKey} style={styles.bodyKeyHost}>
                {body}
              </View>
            </BodyTransition>
          </Animated.View>
        </ScrollHostProvider>
      </View>
    </BottomSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  // The OUTER hosting container (gorhom `containerStyle`) is the view that actually sits as a sibling of
  // MapControls in AppShell. Stack IT above the controls so an expanded sheet covers the side buttons +
  // the Messaging unread dot. NB: zIndex on `style` (the inner moving sheet) does nothing here - that
  // view isn't the sibling competing with the controls.
  sheetContainer: {
    // Above the z50 map controls (AppShell `controls`) so an expanded sheet COVERS the side buttons as it
    // rises (they stay visible + tappable at peek, where the sheet sits below them). Matches the web
    // portrait shell's z60 and AppShell's intended "z60 secondary surface". Must stay below the z70 auth
    // overlay. (zIndex on the inner `style` does nothing - this container is the sibling of the controls.)
    zIndex: 60,
  },
  bgRoot: {
    backgroundColor: "transparent",
    pointerEvents: "none",
  },
  // The floating card wrapper: top-anchored to gorhom's background container, inset off the sheet edges
  // by the animated float gaps (left/right/bottom via insetStyle) + rounded, carrying the s4 drop shadow
  // and an opaque fill so the shadow casts on iOS. NO overflow:hidden here (it would clip the shadow).
  cardShadow: {
    position: "absolute",
    top: 0,
    backgroundColor: t.glass.sheet.fillFallback,
    ...t.shadows.s4,
  },
  // The clip child fills the wrapper and rounds/masks the blur + wash + sheen to the card shape.
  cardClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  cardWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: useBlur ? t.glass.sheet.fill : "transparent",
  },
  cardSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: t.glass.sheet.sheen,
  },
  handleArea: {
    height: HANDLE_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: t.space["2"],
  },
  handleBar: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: t.glass.grabHandle,
  },
  contentHost: {
    // Column that owns the whole sheet content area: header (intrinsic height) then body (fills the
    // remainder). Its HEIGHT is set inline (sheetContentHeight = tallest snap minus the handle) so the
    // body scroll region is bounded by our own numbers, never by gorhom's animated content mask — see the
    // round 5 scroll-fix comments. No flex here: the explicit height is the single source of truth.
    // Its side gutter is the CONSTANT CONTENT_SIDE, applied inline (see render) — never animated.
  },
  headerHost: {
    // .pi-sheet-header: 14px side padding. The peek-aware vertical padding and the animated float
    // remainder (headerFloatStyle) are applied inline (see render).
    paddingHorizontal: 14,
  },
  bodyHost: {
    // Fills the space under the header so the body's scrollable has a bounded height to scroll within.
    flex: 1,
  },
  // The keyed remount wrapper (FIX A): must also fill so the body's scrollable inherits the bounded height
  // (the body's ScrollView/FlatList is flex:1 within this). A bare keyed View with no flex would collapse
  // the scroll region to its content height and break the bottomed scroll handoff.
  bodyKeyHost: {
    flex: 1,
  },
}))
