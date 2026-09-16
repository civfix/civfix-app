import React, { useEffect, useRef, useState } from "react"
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native"
import { ArrowLeft } from "lucide-react-native/icons"
import { motion, wash, makeThemedStyles, useTheme, webCursorColResize, focusRingProps } from "../theme"
import { Text, Icon } from "../typography"
import { useT } from "../i18n"
import { useNavStore, titleForEntry, titleParamsForEntry, type DetailEntry, type View as NavView } from "../nav"
import { AppPromoCard } from "../promo"
import { defaultRenderBody } from "./BodyRouter"
import { Rail } from "./Rail"
import { BodyTransition, type BodyTransitionDirection } from "./BodyTransition"
import { useStackDirection } from "./useStackDirection"
import { ScrollHostProvider, PLAIN_SCROLL_HOST } from "./ScrollHost"
import { makeKeyboardAwareScrollHost } from "./KeyboardAwareScroll"
import { DETAIL_BACK_SIZE, DETAIL_BACK_RADIUS, DETAIL_BACK_ICON_SIZE, detailTitleStyle } from "./detailHeader"
import { showBackAffordance } from "./backAffordance"
import { detailTrailingActionFor, type DetailTrailingAction } from "./detailTrailingAction"
import { DetailTrailingButton } from "./DetailTrailingButton"
import { expandedFramePlan, NAV_FOOTPRINT, NAV_LEFT } from "./expandedFramePlan"
import { cssTransition } from "./motionCss"
import { clearOcclusionLeft, writeOcclusionLeft } from "./occlusionVar"
import { useShellKeys } from "./useShellKeys"
import { prefersReducedMotion } from "./webMedia"
import {
  useSidebarStore,
  clampSidebarWidth,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "./sidebarStore"
import type { AppShellProps } from "./types"

type RenderBody = NonNullable<AppShellProps["renderBody"]>

const RESIZE_HANDLE_W = 18
const RESIZE_STEP = 24
const ADJUST_ACTIONS = [{ name: "increment" }, { name: "decrement" }]

const CARD_SHOW_TRANSITION = cssTransition(["opacity", "transform"], motion.bodyPush)
const CARD_HIDE_TRANSITION = cssTransition(["opacity", "transform"], motion.sheetDismiss)
const HANDLE_SHOW_TRANSITION = cssTransition(["opacity"], motion.bodyPush)
const HANDLE_HIDE_TRANSITION = cssTransition(["opacity"], motion.sheetDismiss)
const CARD_HIDE_SHIFT = motion.bodyDistance
const isWeb = Platform.OS === "web"

function cardVisibilityStyle(visible: boolean, reduceMotion: boolean): ViewStyle {
  const shift = visible || reduceMotion ? 0 : -CARD_HIDE_SHIFT
  return {
    opacity: visible ? 1 : 0,
    transform: [{ translateX: shift }],
    ...(isWeb
      ? ({ transition: visible ? CARD_SHOW_TRANSITION : CARD_HIDE_TRANSITION } as unknown as ViewStyle)
      : null),
  }
}

function handleVisibilityStyle(visible: boolean): ViewStyle {
  return {
    opacity: visible ? 1 : 0,
    ...(isWeb
      ? ({ transition: visible ? HANDLE_SHOW_TRANSITION : HANDLE_HIDE_TRANSITION } as unknown as ViewStyle)
      : null),
  }
}

const PANEL_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST)

export interface ExpandedShellProps {
  renderBody?: RenderBody
  stack?: readonly DetailEntry[]
}

export function ExpandedShell({
  renderBody = defaultRenderBody,
  stack: ownedStack,
}: ExpandedShellProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("nav")
  const { width } = useWindowDimensions()
  const liveStack = useNavStore((s) => s.stack)
  const liveActive = useNavStore((s) => s.active)
  const stack = ownedStack ?? liveStack
  const active = ownedStack ? (ownedStack[ownedStack.length - 1] ?? null) : liveActive
  const view = useNavStore((s) => s.view)
  const storedWidth = useSidebarStore((s) => s.width)
  const setWidth = useSidebarStore((s) => s.setWidth)

  useShellKeys()

  const cardWidth = clampSidebarWidth(storedWidth, width)

  const { cardVisible, occlusionLeft } = expandedFramePlan({
    view,
    stackLength: stack.length,
    sidebarWidth: cardWidth,
  })
  const reduceMotion = prefersReducedMotion()

  const live = { active, view, stack }
  const heldRef = useRef(live)
  const [hideSettled, setHideSettled] = useState(!cardVisible)
  useEffect(() => {
    if (cardVisible) {
      setHideSettled(false)
      return
    }
    const id = setTimeout(() => setHideSettled(true), motion.sheetDismiss.duration)
    return () => clearTimeout(id)
  }, [cardVisible])
  const showLive = cardVisible || hideSettled
  useEffect(() => {
    if (showLive) heldRef.current = { active, view, stack }
  })
  const held = showLive ? live : heldRef.current

  const atHome = !held.active && held.view === "home"

  useEffect(() => {
    writeOcclusionLeft(occlusionLeft)
  }, [occlusionLeft])
  useEffect(() => clearOcclusionLeft, [])

  const animatedWidth = useRef(new Animated.Value(cardWidth)).current
  const widthRef = useRef(cardWidth)
  const draggingRef = useRef(false)
  const startWidthRef = useRef(cardWidth)
  const viewportRef = useRef(width)
  viewportRef.current = width

  useEffect(() => {
    if (draggingRef.current) return
    animatedWidth.setValue(cardWidth)
    widthRef.current = cardWidth
  }, [cardWidth, animatedWidth])

  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        draggingRef.current = true
        startWidthRef.current = widthRef.current
      },
      onPanResponderMove: (_e, gesture) => {
        const next = clampSidebarWidth(startWidthRef.current + gesture.dx, viewportRef.current)
        widthRef.current = next
        animatedWidth.setValue(next)
        writeOcclusionLeft(NAV_LEFT + next)
      },
      onPanResponderRelease: () => {
        draggingRef.current = false
        setWidth(widthRef.current)
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false
        setWidth(widthRef.current)
      },
    }),
  ).current

  const resizeMin = clampSidebarWidth(SIDEBAR_MIN_WIDTH, width)
  const resizeMax = clampSidebarWidth(SIDEBAR_MAX_WIDTH, width)
  const resizeNow = Math.round(cardWidth)
  const onHandleKeyDown = (event: { key?: string; preventDefault?: () => void }) => {
    let next: number
    switch (event?.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = cardWidth + RESIZE_STEP
        break
      case "ArrowLeft":
      case "ArrowDown":
        next = cardWidth - RESIZE_STEP
        break
      case "Home":
        next = resizeMin
        break
      case "End":
        next = resizeMax
        break
      default:
        return
    }
    event.preventDefault?.()
    setWidth(clampSidebarWidth(next, width))
  }

  const titleKey = held.active ? titleForEntry(held.active) : ""
  const hasHeader = titleKey.trim() !== ""
  const title = hasHeader ? t(titleKey, titleParamsForEntry(held.active)) : ""

  const transitionKey = held.active ? `${held.active.kind}:${held.active.id ?? ""}` : `view:${held.view}`

  const direction: BodyTransitionDirection = useStackDirection(held.stack.length)

  return (
    <>
      <Rail />

      <Animated.View
        pointerEvents={cardVisible ? "auto" : "none"}
        accessibilityElementsHidden={!cardVisible}
        importantForAccessibility={cardVisible ? "auto" : "no-hide-descendants"}
        style={[
          styles.card,
          th.shadows.s4,
          { width: animatedWidth },
          cardVisibilityStyle(cardVisible, reduceMotion),
        ]}
      >
        <ScrollHostProvider value={PANEL_SCROLL_HOST}>
          <BodyTransition transitionKey={transitionKey} direction={direction}>
            <View style={styles.panelContent}>
              {hasHeader ? (
                <PanelHeader
                  title={title}
                  showBack={showBackAffordance({ stack: held.stack, mode: "expanded" })}
                  trailingAction={detailTrailingActionFor(held.active)}
                />
              ) : null}
              <Body entry={held.active} view={held.view} renderBody={renderBody} />
            </View>
          </BodyTransition>
        </ScrollHostProvider>

        {atHome ? <AppPromoCard /> : null}
      </Animated.View>

      <Animated.View
        {...resizeResponder.panHandlers}
        pointerEvents={cardVisible ? "auto" : "none"}
        accessibilityRole="adjustable"
        accessibilityLabel={t("a11y.resize_sidebar")}
        accessibilityValue={{ min: resizeMin, max: resizeMax, now: resizeNow }}
        accessibilityActions={ADJUST_ACTIONS}
        accessibilityElementsHidden={!cardVisible}
        importantForAccessibility={cardVisible ? "auto" : "no-hide-descendants"}
        onAccessibilityAction={(e) => {
          const delta = e.nativeEvent.actionName === "increment" ? RESIZE_STEP : -RESIZE_STEP
          setWidth(clampSidebarWidth(cardWidth + delta, width))
        }}
        {...(isWeb
          ? ({
              "aria-valuemin": resizeMin,
              "aria-valuemax": resizeMax,
              "aria-valuenow": resizeNow,
              "aria-orientation": "horizontal",
              onKeyDown: onHandleKeyDown,
              ...(cardVisible ? { tabIndex: 0 } : { tabIndex: -1, "aria-hidden": true }),
            } as object)
          : null)}
        {...focusRingProps}
        style={[
          styles.resizeHandle,
          { transform: [{ translateX: animatedWidth }] },
          handleVisibilityStyle(cardVisible),
        ]}
      >
        <View style={styles.resizeGrip} pointerEvents="none" />
      </Animated.View>
    </>
  )
}

function PanelHeader({
  title,
  showBack,
  trailingAction,
}: {
  title: string
  showBack: boolean
  trailingAction: DetailTrailingAction | null
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("nav")
  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          onPress={() => useNavStore.getState().back()}
          {...focusRingProps}
          style={styles.back}
        >
          <Icon icon={ArrowLeft} size={DETAIL_BACK_ICON_SIZE} color={th.colors.text} />
        </Pressable>
      ) : null}
      <Text
        style={styles.title}
        numberOfLines={1}
        accessibilityRole="header"
        {...({ "data-civfix-panel-heading": "", tabIndex: -1 } as any)}
      >
        {title}
      </Text>
      <DetailTrailingButton action={trailingAction} />
    </View>
  )
}

function Body({
  entry,
  view,
  renderBody,
}: {
  entry: DetailEntry | null
  view: NavView
  renderBody: RenderBody
}) {
  const styles = useStyles()
  return <View style={styles.fill}>{renderBody(entry, view)}</View>
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    position: "absolute",
    top: NAV_FOOTPRINT,
    left: NAV_LEFT,
    bottom: 14,
    borderRadius: 24,
    backgroundColor: t.colors.bg,
    overflow: "hidden",
    zIndex: 60,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isWeb ? wash(t.colors.borderStrong, 0.45, t) : t.colors.border,
    backgroundColor: t.colors.bg,
  },
  back: {
    width: DETAIL_BACK_SIZE,
    height: DETAIL_BACK_SIZE,
    borderRadius: DETAIL_BACK_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...detailTitleStyle(18, t), flex: 1 },
  fill: { flex: 1 },
  panelContent: { flex: 1 },

  resizeHandle: {
    position: "absolute",
    top: NAV_FOOTPRINT,
    bottom: 14,
    left: NAV_LEFT - RESIZE_HANDLE_W / 2,
    width: RESIZE_HANDLE_W,
    zIndex: 61,
    alignItems: "center",
    justifyContent: "center",
    ...webCursorColResize,
    ...({ touchAction: "none", userSelect: "none" } as unknown as ViewStyle),
  },
  resizeGrip: {
    width: 6,
    height: 48,
    borderRadius: 3,
    backgroundColor: t.colors.neutral.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
}))
