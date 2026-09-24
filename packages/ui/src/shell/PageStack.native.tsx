import React, { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { isFlowKind, useNavStore, type DetailEntry, type View as NavView } from "../nav"
import { makeThemedStyles, motion } from "../theme"
import { detailLeadingAffordance } from "./backAffordance"
import { pageBottomReserve } from "./bodyLayout"
import { ContentBottomReserveProvider, contentBottomReserveScrollHost } from "./ContentBottomReserve"
import {
  pagePopConfig,
  pagePushConfig,
  pageSwipeCancelConfig,
  pageSwipeSettleConfig,
} from "./motionConfigs.native"
import { timingConfig } from "../theme/motionTiming.native"
import { IosKeyboardAvoidingView } from "./IosKeyboardAvoidingView"
import { useNestedShellHost } from "./nestedShellHost"
import { PageActiveProvider } from "./pageActive"
import type { PageStackProps, PageStackRenderBody } from "./PageStack.types"
import {
  canSwipeBack,
  pageLayerPointerEvents,
  pageLayerStyle,
  pageLayerTokens,
  pageTransitionPlan,
  swipeBackDecision,
  type PageLayerPointerEvents,
  type PageLayerTokens,
  type SwipeBackTokens,
} from "./pageStackModel"
import { PAGE_HEADER_STYLE, PAGE_MOTION, PAGE_TIMING } from "./pageStackMotion"
import { ScrollHostProvider, type ScrollHostValue } from "./ScrollHost"
import { useKeyboardReserve } from "./useKeyboardReserve"
import { DetailHeader, hasDetailHeader } from "./SheetHeader.shared"

const PUSH_CFG = pagePushConfig()
const POP_CFG = pagePopConfig()
const SETTLE_CFG = pageSwipeSettleConfig()
const CANCEL_CFG = pageSwipeCancelConfig()
const FADE_CFG = timingConfig(motion.bodyReplace)

const SWIPE_TOKENS: SwipeBackTokens = {
  completeFraction: motion.pageCompleteFraction,
  completeVelocity: motion.pageCompleteVelocity,
}
const EDGE_WIDTH = motion.pageEdgeWidth
const ANIMATED_TOKENS = pageLayerTokens(PAGE_MOTION, false, false)
const DRAG_TOKENS = pageLayerTokens(PAGE_MOTION, false, true)
const REDUCED_TOKENS = pageLayerTokens(PAGE_MOTION, true, false)
const REDUCED_DRAG_TOKENS = pageLayerTokens(PAGE_MOTION, true, true)
const ACTIVATE_X = 12
const FAIL_Y = 14

type LayerDriver = "front" | "exit" | "zero" | "one"

let reduceMotionCache = false

interface LeavingLayer {
  key: string
  entry: DetailEntry
  stack: readonly DetailEntry[]
}

export function PageStack({
  entries,
  insets,
  interactive,
  keyboardAvoidance,
  layerKeys,
  renderBody,
  scrollHost,
  stack,
  view,
}: PageStackProps) {
  const styles = useStyles()
  const width = useWindowDimensions().width
  const front = useSharedValue(0)
  const exit = useSharedValue(0)
  const fade = useSharedValue(1)
  const dragging = useSharedValue(0)
  const [leaving, setLeaving] = useState<LeavingLayer | null>(null)

  const [reduceMotion, setReduceMotion] = useState(reduceMotionCache)
  useLayoutEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        reduceMotionCache = !!enabled
        if (mounted) setReduceMotion(!!enabled)
      })
      // A failed probe keeps motion on; the reduceMotionChanged listener below still corrects it.
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      reduceMotionCache = !!enabled
      setReduceMotion(!!enabled)
    })
    return () => {
      mounted = false
      sub?.remove()
    }
  }, [])

  const dropLeaving = useCallback((key: string) => {
    setLeaving((current) => (current && current.key === key ? null : current))
  }, [])

  const prevKeysRef = useRef<readonly string[]>(layerKeys)
  const prevEntriesRef = useRef<readonly DetailEntry[]>(entries)
  const prevStackRef = useRef<readonly DetailEntry[]>(stack)
  const pendingSwipeRef = useRef<{ key: string; progress: number } | null>(null)

  useLayoutEffect(() => {
    const prevKeys = prevKeysRef.current
    // The snapshot moves only with the layer keys: a re-render that keeps them must neither animate
    // nor replace the entries the retained leaving layer will render.
    if (prevKeys.length === layerKeys.length && prevKeys.every((key, i) => key === layerKeys[i])) return
    const prevEntries = prevEntriesRef.current
    const prevStack = prevStackRef.current
    prevKeysRef.current = layerKeys
    prevEntriesRef.current = entries
    prevStackRef.current = stack

    const direction =
      layerKeys.length > prevKeys.length
        ? "push"
        : layerKeys.length < prevKeys.length
          ? "pop"
          : "replace"
    const goneKey = prevKeys[prevKeys.length - 1]
    const goneEntry = prevEntries[prevEntries.length - 1]
    const pending = pendingSwipeRef.current
    pendingSwipeRef.current = null
    const swipeProgress = pending && pending.key === goneKey ? pending.progress : null

    if (direction === "pop" && swipeProgress !== null && goneKey && goneEntry) {
      fade.value = 1
      exit.value = swipeProgress
      front.value = 0
      setLeaving({ key: goneKey, entry: goneEntry, stack: prevStack })
      exit.value = withTiming(1, SETTLE_CFG, (finished) => {
        "worklet"
        dragging.value = 0
        if (finished) runOnJS(dropLeaving)(goneKey)
      })
      return
    }

    const plan = pageTransitionPlan(direction, reduceMotion, PAGE_TIMING)
    dragging.value = 0

    if (plan.retainLeaving && goneKey && goneEntry) {
      fade.value = 1
      front.value = plan.fromFront
      exit.value = 0
      setLeaving({ key: goneKey, entry: goneEntry, stack: prevStack })
      exit.value = withTiming(1, POP_CFG, (finished) => {
        "worklet"
        if (finished) runOnJS(dropLeaving)(goneKey)
      })
      return
    }

    setLeaving(null)
    front.value = plan.fromFront
    if (plan.slide) {
      fade.value = 1
      front.value = withTiming(0, direction === "push" ? PUSH_CFG : POP_CFG)
    } else {
      fade.value = 0
      fade.value = withTiming(1, FADE_CFG)
    }
  }, [dragging, dropLeaving, entries, exit, fade, front, layerKeys, reduceMotion, stack])

  const nestedInNativeStack = useNestedShellHost()
  const leading = detailLeadingAffordance({ stack, mode: "compact", dismissGesture: false })
  const topEntry = stack[stack.length - 1]
  const swipeArmed = canSwipeBack({
    layerCount: entries.length,
    leading,
    interactive,
    platformIsIOS: Platform.OS === "ios",
    discardsFlow: topEntry !== undefined && isFlowKind(topEntry.kind),
    nestedInNativeStack,
  })

  const commitSwipeBack = useCallback(
    (progress: number) => {
      const committed = prevKeysRef.current
      const topKey = committed[committed.length - 1]
      pendingSwipeRef.current = topKey === undefined ? null : { key: topKey, progress }
      const before = useNavStore.getState().stack.length
      useNavStore.getState().back()
      if (useNavStore.getState().stack.length >= before) {
        pendingSwipeRef.current = null
        front.value = withTiming(0, CANCEL_CFG, (finished) => {
          "worklet"
          if (finished) dragging.value = 0
        })
      }
    },
    [dragging, front],
  )

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(swipeArmed)
        .hitSlop({ left: 0, width: EDGE_WIDTH })
        .activeOffsetX(ACTIVATE_X)
        .failOffsetY([-FAIL_Y, FAIL_Y])
        .onStart(() => {
          dragging.value = 1
        })
        .onUpdate((e) => {
          const raw = width > 0 ? e.translationX / width : 0
          front.value = raw < 0 ? 0 : raw > 1 ? 1 : raw
        })
        .onEnd((e, success) => {
          if (!success || swipeBackDecision(e.translationX, e.velocityX, width, SWIPE_TOKENS) === "cancel") {
            front.value = withTiming(0, CANCEL_CFG, (finished) => {
              if (finished) dragging.value = 0
            })
            return
          }
          runOnJS(commitSwipeBack)(front.value)
        }),
    [commitSwipeBack, dragging, front, swipeArmed, width],
  )

  const stackSlices = useMemo(() => stack.map((_, index) => stack.slice(0, index + 1)), [stack])
  const rendered: Array<{
    key: string
    entry: DetailEntry
    stack: readonly DetailEntry[]
  }> = entries.map((entry, depth) => ({
    key: layerKeys[depth] ?? `${depth}`,
    entry,
    stack: stackSlices[stack.indexOf(entry)] ?? stack,
  }))
  if (leaving) rendered.push({ key: leaving.key, entry: leaving.entry, stack: leaving.stack })

  const topIndex = rendered.length - 1
  const realTopIndex = entries.length - 1
  const restTokens = reduceMotion ? REDUCED_TOKENS : ANIMATED_TOKENS
  const dragTokens = reduceMotion ? REDUCED_DRAG_TOKENS : DRAG_TOKENS

  const ownDriver = (index: number): LayerDriver =>
    leaving && index === topIndex ? "exit" : index === realTopIndex ? "front" : "zero"
  const aboveDriver = (index: number): LayerDriver =>
    index === topIndex ? "one" : ownDriver(index + 1)

  if (topIndex < 0) return null

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.host} collapsable={false}>
        {rendered.map((layer, index) => (
          <PageLayer
            key={layer.key}
            active={index === realTopIndex}
            above={aboveDriver(index)}
            dragTokens={dragTokens}
            dragging={dragging}
            entry={layer.entry}
            exit={exit}
            fade={fade}
            fades={index === realTopIndex}
            front={front}
            keyboardAvoidance={keyboardAvoidance && index === realTopIndex}
            own={ownDriver(index)}
            paddingBottom={insets.paddingBottom}
            paddingTop={insets.paddingTop}
            restTokens={restTokens}
            pointer={pageLayerPointerEvents({
              active: index === realTopIndex,
              isLeaving: leaving !== null && index === topIndex,
              hasLeaving: leaving !== null,
            })}
            renderBody={renderBody}
            scrollHost={scrollHost}
            stack={layer.stack}
            view={view}
            width={width}
          />
        ))}
      </View>
    </GestureDetector>
  )
}

interface PageLayerProps {
  active: boolean
  above: LayerDriver
  dragTokens: PageLayerTokens
  dragging: SharedValue<number>
  entry: DetailEntry
  exit: SharedValue<number>
  fade: SharedValue<number>
  fades: boolean
  front: SharedValue<number>
  keyboardAvoidance: boolean
  own: LayerDriver
  paddingBottom: number
  paddingTop: number
  restTokens: PageLayerTokens
  pointer: PageLayerPointerEvents
  renderBody: PageStackRenderBody
  scrollHost: ScrollHostValue
  stack: readonly DetailEntry[]
  view: NavView
  width: number
}

const PageLayer = memo(function PageLayer({
  above,
  active,
  dragTokens,
  dragging,
  entry,
  exit,
  fade,
  fades,
  front,
  keyboardAvoidance,
  own,
  paddingBottom,
  paddingTop,
  restTokens,
  pointer,
  renderBody,
  scrollHost,
  stack,
  view,
  width,
}: PageLayerProps) {
  const styles = useStyles()
  const body = useMemo(() => renderBody(entry, view), [entry, renderBody, view])
  const keyboardReserve = useKeyboardReserve({ enabled: keyboardAvoidance && active })
  const reserve = pageBottomReserve(entry.kind)
  const boxReserve = (reserve === "box" ? paddingBottom : 0) + keyboardReserve
  const contentReserve = reserve === "content" ? paddingBottom : 0
  const bodyScrollHost = reserve === "content" ? contentBottomReserveScrollHost(scrollHost) : scrollHost

  const layerStyle = useAnimatedStyle(() => {
    const ownProgress = own === "exit" ? exit.value : own === "front" ? front.value : 0
    const aboveProgress =
      above === "exit" ? exit.value : above === "front" ? front.value : above === "zero" ? 0 : 1
    const tokens = dragging.value === 1 ? dragTokens : restTokens
    const layer = pageLayerStyle(ownProgress, aboveProgress, width, tokens)
    return {
      opacity: (fades ? fade.value : 1) * layer.opacity,
      transform: [{ translateX: layer.translateX }],
    }
  })
  const scrimStyle = useAnimatedStyle(() => {
    const aboveProgress =
      above === "exit" ? exit.value : above === "front" ? front.value : above === "zero" ? 0 : 1
    const tokens = dragging.value === 1 ? dragTokens : restTokens
    return { opacity: pageLayerStyle(0, aboveProgress, width, tokens).scrimOpacity }
  })

  return (
    <Animated.View
      style={[styles.layer, layerStyle]}
      pointerEvents={pointer}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      <View style={[styles.layerContent, { paddingBottom: boxReserve, paddingTop }]}>
        <IosKeyboardAvoidingView style={styles.layerContent} enabled={keyboardAvoidance}>
          {hasDetailHeader(entry) ? (
            <View style={styles.header}>
              <DetailHeader active={entry} stack={stack} dismissGesture={false} />
            </View>
          ) : null}
          <ContentBottomReserveProvider value={contentReserve}>
            <ScrollHostProvider value={bodyScrollHost}>
              <PageActiveProvider value={active}>{body}</PageActiveProvider>
            </ScrollHostProvider>
          </ContentBottomReserveProvider>
        </IosKeyboardAvoidingView>
      </View>
      {above === "one" ? null : <Animated.View style={[styles.scrim, scrimStyle]} pointerEvents="none" />}
    </Animated.View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  host: { flex: 1 },
  layer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.bg,
  },
  layerContent: { flex: 1 },
  header: PAGE_HEADER_STYLE,
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.shadowColor,
  },
}))
