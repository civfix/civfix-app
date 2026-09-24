/**
 * CompactShell (native seam): the draggable home bottom sheet (@gorhom/bottom-sheet).
 *
 * The gorhom snap is the sheet HEIGHT and the sheet sits flush to the screen bottom (no `bottomInset`).
 * The float is one translucent glass card rendered as gorhom's `backgroundComponent`, whose side gap and
 * corner radius interpolate continuously off `animatedIndex` and whose height is derived from gorhom's
 * `animatedPosition`, so it tracks the sheet exactly at every drag fraction. Stepping an inset from React
 * state or re-deriving the card height by interpolation both left the card edge lagging the content.
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
import { resolveBodyLayout, shellBodyKey } from "./bodyLayout"
import { DETAILS_ARE_FULL_PAGE } from "./detailPresentationPlatform"
import { BodyTransition } from "./BodyTransition.native"
import { sheetDismissConfig, sheetMoveConfig } from "./motionConfigs.native"
import { useStackDirection } from "./useStackDirection"
import {
  SHEET_SNAP_RANGE,
  compactBottomChrome,
  dockOcclusionFromSheet,
  sheetSnapForAccessibilityAction,
  sheetSnapPoints,
  sheetSnapValueKey,
} from "./tabBarLogic"
import { sheetDockOcclusion } from "./sheetDockOcclusion.native"
import type { CompactShellProps } from "./CompactShell.types"

/**
 * The native-sheet scroll host is plain RN ScrollView / FlatList, not gorhom's BottomSheetScrollView /
 * FlatList: their drag handoff is inseparable from their scroll lock (useScrollable is LOCKED at every
 * detent except the exact-equality EXTENDED one, and while locked it force-scrollTo's the content back
 * every frame and pins decelerationRate to 0), which clamped a tall body's scroll range at a fixed offset.
 * The consequence: the sheet is not draggable by its body through gorhom, only by its grab handle and by
 * the pull-down handoff below.
 *
 * Three decorators, innermost to outermost:
 *  - makeSheetHandoffScrollHost gives a downward drag at the top of the content back to the sheet. It must
 *    be innermost so its reanimated `useAnimatedScrollHandler` is the handler the scrollable mounts,
 *    reading the offset on the UI thread.
 *  - makeKeyboardAwareScrollHost scrolls a focused field above the soft keyboard and grows the sheet to its
 *    tallest snap. gorhom's keyboardBehavior="extend" does neither for a plain RN TextInput: it only tracks
 *    BottomSheetTextInput and never scrolls the inner list.
 *  - makeMinimizeAwareScrollHost feeds both the ScrollView and the FlatList to the dock's scroll-minimize.
 *    It sits outside keyboard-aware, which only wraps the ScrollView, so the FlatList is caught too.
 */
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
 * The card is flush to the screen bottom, so scroll content reserves insets.bottom to let the last row
 * clear the home indicator / Android nav bar. ContentBottomReserve's merge is additive, so a body's own
 * bottom gutter is kept on top of the inset.
 */
function useSafeAreaBottom(): number {
  return useSafeAreaInsets().bottom
}

const SHEET_SCROLL_HOST_SAFE_BOTTOM = makeContentBottomReserveScrollHost(
  SHEET_SCROLL_HOST,
  useSafeAreaBottom,
)

/**
 * "full" bodies keep the raw host: they own their layout and bodyHost already reserves insets.bottom for
 * their pinned footers, so padding their inner lists too would double the gutter.
 */
function sheetScrollHostFor(layout: "scroll" | "full") {
  return layout === "full" ? SHEET_SCROLL_HOST : SHEET_SCROLL_HOST_SAFE_BOTTOM
}

// Card insets interpolated off animatedIndex (0 = peek, 2 = full). The bottom gap is 0 at every snap: the
// sheet presents as a modal flush to the screen bottom, because any gap exposed the raw background under
// the card and sliced the scrolled content above the screen edge.
const FLOAT_SIDE: [number, number] = [12, 4]
const FLOAT_BOTTOM: [number, number] = [0, 0]
const FLOAT_RADIUS: [number, number] = [30, 22]

/**
 * The body's side gutter is constant (the midpoint of FLOAT_SIDE) rather than animated: margin is a layout
 * property, so animating it re-ran layout for the whole body subtree on every drag frame. Only the header
 * animates the remainder (headerFloatStyle). Accepted delta: at full the body sits 4pt inside the card edge.
 */
const CONTENT_SIDE = (FLOAT_SIDE[0] + FLOAT_SIDE[1]) / 2

const HANDLE_HEIGHT = 20

// The body fades out early in the mid-to-peek leg so its text is gone before the card shrinks past it,
// instead of floating over the map. BODY_FADE_TO is COLLAPSE_SWAP_AT, where the header swaps DetailBar for
// SearchHeader, so the body's detail-to-list change is already invisible when the swap fires.
const BODY_FADE_FROM = 0.95
const BODY_FADE_TO = COLLAPSE_SWAP_AT

const useBlur = Platform.OS === "ios"
const AnimatedBlur = Animated.createAnimatedComponent(BlurView)

const ADJUST_ACTIONS = [{ name: "increment" }, { name: "decrement" }]

// Its own component so the live snap value re-renders only the handle: a new
// handleComponent identity would remount it and drop screen-reader focus mid-adjust.
function SheetGrabHandle({
  label,
  onCycle,
  onAdjust,
}: {
  label: string
  onCycle: () => void
  onAdjust: (actionName: string) => void
}) {
  const styles = useStyles()
  const { t } = useT("nav")
  const snap = useNavStore((s) => s.snap)
  return (
    <Pressable
      onPress={onCycle}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ ...SHEET_SNAP_RANGE, now: snap, text: t(sheetSnapValueKey(snap)) }}
      accessibilityActions={ADJUST_ACTIONS}
      onAccessibilityAction={(e) => onAdjust(e.nativeEvent.actionName)}
      style={styles.handleArea}
    >
      <View style={styles.handleBar} />
    </Pressable>
  )
}

function makeBackground(
  animatedIndex: SharedValue<number>,
  animatedPosition: SharedValue<number>,
  screenH: number,
) {
  return function GlassBackground({ style }: BottomSheetBackgroundProps) {
    const styles = useStyles()
    const th = useTheme()
    // gorhom's measured container height is where the sheet bottoms in animatedPosition's space.
    // useWindowDimensions under-reports it by varying system-bar amounts on Android edge-to-edge.
    const { animatedLayoutState } = useBottomSheetInternal()
    // No overflow:hidden on the shadow wrapper: iOS masksToBounds would eat the shadow, so a clip child
    // masks the blur/wash/sheen instead.
    const cardStyle = useAnimatedStyle(() => {
      const i = animatedIndex.value
      const side = interpolate(i, [0, 2], FLOAT_SIDE, Extrapolation.CLAMP)
      const gap = interpolate(i, [0, 2], FLOAT_BOTTOM, Extrapolation.CLAMP)
      const radius = interpolate(i, [0, 2], FLOAT_RADIUS, Extrapolation.CLAMP)
      // rawContainerHeight is -999 until laid out, so the first frame falls back to the window height.
      const rawH = animatedLayoutState.value.rawContainerHeight
      const sheetBottom = rawH > 0 ? rawH : screenH
      const cardH = Math.max(sheetBottom - animatedPosition.value - gap, 0)
      return {
        left: side,
        right: side,
        height: cardH,
        // Rounded top only: rounding the flush bottom edge would open background slivers at the corners.
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
 * `view`/`active` come in as props, not from the store, because a dismissing sheet renders the frozen
 * snapshot of them (see the exit freeze below).
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
  const sheetRef = useRef<BottomSheet>(null)
  const animatedIndex = useSharedValue(0)
  // Seeded at `height` (the closed detent, where animateOnMount starts), not 0, so the dock-occlusion
  // mirror reads "sheet off-screen" on the pre-layout frame and the dock fades out with the rising card
  // instead of vanishing the instant the sheet mounts.
  const animatedPosition = useSharedValue(height)
  // Tracked on the JS thread so the grab-handle tap can cycle snaps without reading a shared value.
  const currentIndexRef = useRef(0)
  const collapseCommitted = useSharedValue(false)

  const snap = useNavStore((s) => s.snap)
  const setSnap = useNavStore((s) => s.setSnap)
  const haptics = useHaptics()
  const storeActive = useNavStore((s) => s.active)
  const storeView = useNavStore((s) => s.view)
  const stack = useNavStore((s) => s.stack)
  const collapseToParent = useNavStore((s) => s.collapseToParent)

  // Exit freeze: on dismiss the store drops the detail synchronously while the sheet is still sliding off,
  // so rendering the live store would flash the underlying view's header and body on the dismissing card.
  // While `closing`, render the last live detail, view and stack instead. The stack is frozen too because
  // the header's back chevron reads it and would otherwise pop off the sliding card.
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

  // The same identity the keyed remount below uses; a change drives BodyTransition's entrance animation.
  const bodyKey = shellBodyKey(active, `home:${view}`)
  const direction = useStackDirection(stack.length)

  // What the sheet last reported, so the sync effect only snaps for programmatic changes and never echoes
  // the user's own drag.
  const reportedSnapRef = useRef(0)

  // The sheet bottoms at the screen edge, so only the top headroom is reserved.
  const snapPoints = useMemo<[number, number, number]>(
    () => sheetSnapPoints(height, insets.top + space["8"]),
    [height, insets.top],
  )

  // The single knob for every gorhom animation, including the dismiss. The declarative `index={-1}` is inert
  // after mount (gorhom's index effect reads `detents[-1]`, which is undefined, and early-returns), so the
  // real dismiss driver is the imperative `close()` below, which animates with these configs. It sees the
  // fresh configs because useImperativeHandle republishes `close` in a layout effect of the same commit
  // that flips `closing`, and that flushes before this component's useEffect. On Android gorhom's default
  // is already a 250ms timing, so this only changes the curve there.
  const animationConfigs = useMemo(() => (closing ? sheetDismissConfig() : sheetMoveConfig()), [closing])

  const onChange = useCallback(
    (index: number) => {
      if (index >= 0 && index <= 2) {
        const prevIndex = currentIndexRef.current
        currentIndexRef.current = index
        reportedSnapRef.current = index
        setSnap(index as Snap)
        if (index !== prevIndex) haptics.impactLight()
        // Settle-time backstop for the detail-to-parent collapse; the swap usually already happened mid-
        // animation (onAnimate + the reaction below). Gating on the arrival index alone matters: after an
        // interrupted pull-up then a quick pull-down, `prevIndex` is still 0. collapseToParent no-ops at home
        // and mid-flow, so the initial mount at peek is harmless.
        if (shouldCollapseOnSettle(index, prevIndex)) collapseToParent()
      }
    },
    [setSnap, collapseToParent, haptics],
  )

  // gorhom fires this at the start of a settle, before onChange (which fires on arrival). Gate on the
  // destination only: an interrupted pull-up never settles, so the following pull-down still reports
  // `fromIndex` 0.
  const onAnimate = useCallback(
    (fromIndex: number, toIndex: number) => {
      collapseCommitted.value = armCollapse(fromIndex, toIndex)
    },
    [collapseCommitted],
  )

  // Swapping to the origin view while the sheet is still moving hides the DetailBar-to-SearchHeader change
  // in the motion instead of popping it after the sheet settles at peek.
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

  // The dock fades off the sheet's visible height, so it tracks the card continuously on open and dismiss
  // with no dead frame between slide end and dock return. On Android edge-to-edge the window height can
  // under-report the container by the nav-bar inset, which only shifts the wide fade band slightly.
  useAnimatedReaction(
    () => animatedPosition.value,
    (pos) => {
      sheetDockOcclusion.value = dockOcclusionFromSheet(height - pos)
    },
    [height],
  )
  useEffect(
    () => () => {
      // Covers the presence gate's safety unmount too: the dock must never be stranded hidden.
      sheetDockOcclusion.value = 0
    },
    [],
  )

  useEffect(() => {
    // Never fight the exit slide: while closing, the store snap belongs to the dismissed detail.
    if (closing) return
    if (reportedSnapRef.current !== snap) {
      sheetRef.current?.snapToIndex(snap)
    }
  }, [snap, closing])

  // gorhom fires `onClose` when the slide lands, which the presence gate uses to unmount the sheet and
  // restore the dock. Entry is gorhom's own mount animation, so a lateral detail-to-detail swap never
  // re-runs it.
  useEffect(() => {
    if (closing) sheetRef.current?.close()
  }, [closing])

  const Background = useMemo(
    () => makeBackground(animatedIndex, animatedPosition, height),
    [animatedIndex, animatedPosition, height],
  )

  // Only the header animates, by the remainder FLOAT_SIDE - CONTENT_SIDE (+4..-4), which keeps the search
  // bar locked to the card edge while confining the per-frame layout pass to the header's small subtree.
  const headerFloatStyle = useAnimatedStyle(() => {
    const side = interpolate(animatedIndex.value, [0, 2], FLOAT_SIDE, Extrapolation.CLAMP)
    return { marginLeft: side - CONTENT_SIDE, marginRight: side - CONTENT_SIDE }
  })

  // While dismissing, the fade band is frozen rather than applied: a dismiss drives animatedIndex to -1, so
  // replaying the collapse band emptied the card early and slid a blank glass rectangle for half the
  // travel. It freezes rather than pinning to 1 because a drag-to-peek can convert into a dismissal partway
  // down (collapseToParent empties the stack), and pinning would pop a body that had already faded.
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

  const renderHandle = useCallback(() => {
    const cycle = () => {
      const next = ((currentIndexRef.current + 1) % 3) as Snap
      setSnap(next)
    }
    const adjust = (actionName: string) => {
      const next = sheetSnapForAccessibilityAction(currentIndexRef.current as Snap, actionName)
      if (next !== null) setSnap(next)
    }
    return <SheetGrabHandle label={t("a11y.drag_handle")} onCycle={cycle} onAdjust={adjust} />
  }, [setSnap, t])

  // The content region's height is owned here rather than flex:1 inside gorhom's animated content mask, so
  // the body's scroll viewport is bounded by numbers we control and the full content overflow scrolls. At
  // lower snaps the region extends below the visible card; the body fade hides it during collapse.
  const sheetContentHeight = snapPoints[2] - HANDLE_HEIGHT

  // paddingTop stays constant across snaps: a peek-aware top pad made the search bar jump while dragging.
  const headerVPad = { paddingTop: 0, paddingBottom: snap === 0 ? 20 : 12 }
  // Rebuilt only when the navigation identity changes, not on snap or keyboard re-renders; this relies on
  // `renderBody` being referentially stable, which the module-level default is.
  const body = useMemo(() => renderBody(active, view), [renderBody, active, view])
  const showSheetHeader = active !== null || compactBottomChrome(view) !== "docked-search"
  const bodyLayoutKey = active?.kind === "view" ? "home-view" : active?.kind ?? "home-view"
  // Resolved through the same seam the shell uses so the two never disagree about a kind's layout; reading
  // the table raw would give a converted kind the wrong scroll host.
  const sheetBodyLayout = resolveBodyLayout(bodyLayoutKey, DETAILS_ARE_FULL_PAGE)

  return (
    <BottomSheet
      ref={sheetRef}
      // Binding the index to the store snap makes a re-created sheet (e.g. after the full-screen report flow
      // re-initializes the map home) land on the intended detent; an imperative snapToIndex would race the
      // not-yet-laid-out sheet. `-1` while closing keeps the prop consistent; close() drives the dismiss.
      index={closing ? -1 : snap}
      snapPoints={snapPoints}
      animatedIndex={animatedIndex}
      animatedPosition={animatedPosition}
      animationConfigs={animationConfigs}
      onClose={onClosed}
      enableDynamicSizing={false}
      // Any inset lifts the card off the screen bottom; home-indicator clearance is content padding instead.
      bottomInset={0}
      // Must stay false. With content panning on, useScrollable locks inner scrolling at every detent but
      // the exact-equality EXTENDED one (details open at mid) and force-scrollTo's the content back every
      // frame, so a tall body rubber-bands at a fixed offset. The body drag comes from
      // makeSheetHandoffScrollHost instead, which only arms for a downward drag at scroll offset 0.
      enableContentPanningGesture={false}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      onChange={onChange}
      onAnimate={onAnimate}
      handleComponent={renderHandle}
      backgroundComponent={Background}
      containerStyle={styles.sheetContainer}
    >
      {/* A plain RN View, never gorhom's BottomSheetView, whose focus effect interfered with scrollable
          registration. */}
      <View style={[styles.contentHost, { height: sheetContentHeight, marginHorizontal: CONTENT_SIDE }]}>
        {showSheetHeader ? (
          <Animated.View style={[styles.headerHost, headerVPad, headerFloatStyle]}>
            <NativeSheetHeader view={view} active={active} stack={headerStack} />
          </Animated.View>
        ) : null}
        <ScrollHostProvider value={sheetScrollHostFor(sheetBodyLayout)}>
          {/* A "full" body pins its footer to the card bottom, so bodyHost reserves the safe-area inset;
              scroll bodies get it as scroll-content padding so content can still slide under the home
              indicator mid-scroll. */}
          <Animated.View
            style={[
              styles.bodyHost,
              bodyFadeStyle,
              sheetBodyLayout === "full" ? { paddingBottom: insets.bottom } : null,
            ]}
          >
            {/* Keyed on the entry identity so every navigation mounts a fresh body with fresh state, while
                a body's own state changes (loading, wizard steps) keep the key and never remount. */}
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
  // zIndex goes on gorhom's containerStyle because that outer view, not the inner moving sheet, is the
  // sibling of AppShell's z50 map controls. Above them so an expanded sheet covers the side buttons; below
  // the z70 auth overlay.
  sheetContainer: {
    zIndex: 60,
  },
  bgRoot: {
    backgroundColor: "transparent",
    pointerEvents: "none",
  },
  // An opaque fill so the shadow casts on iOS.
  cardShadow: {
    position: "absolute",
    top: 0,
    backgroundColor: t.glass.sheet.fillFallback,
    ...t.shadows.s4,
  },
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
  contentHost: {},
  headerHost: {
    paddingHorizontal: 14,
  },
  bodyHost: {
    flex: 1,
  },
  // Without flex the keyed wrapper collapses the scroll region to its content height.
  bodyKeyHost: {
    flex: 1,
  },
}))
