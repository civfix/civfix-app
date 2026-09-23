import React, { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from "react-native"
import { useNavStore, type DetailEntry, type View as NavView } from "../nav"
import { makeThemedStyles, motion } from "../theme"
import type { BodyTransitionDirection } from "./BodyTransition.types"
import { pageBottomReserve } from "./bodyLayout"
import { ContentBottomReserveProvider, contentBottomReserveScrollHost } from "./ContentBottomReserve"
import { IosKeyboardAvoidingView } from "./IosKeyboardAvoidingView"
import { PageActiveProvider } from "./pageActive"
import type { PageStackProps, PageStackRenderBody } from "./PageStack.types"
import {
  pageLayerPointerEvents,
  pageLayerTokens,
  type PageLayerPointerEvents,
  type PageMotionTokens,
  type PageTransitionPlan,
  type PageTransitionTiming,
} from "./pageStackModel"
import {
  isInstantPagePlan,
  pagePlanDuration,
  restingLayerProgress,
  webLayerCss,
  webLayerProgress,
  webLayerTransition,
  webPageTransitionPlan,
} from "./pageStackWebModel"
import { ScrollHostProvider, type ScrollHostValue } from "./ScrollHost"
import { DetailHeader, hasDetailHeader } from "./SheetHeader.shared"
import { isCoarsePointer, prefersReducedMotion } from "./webMedia"

const TIMING: PageTransitionTiming = {
  pushDuration: motion.pagePush.duration,
  popDuration: motion.pagePop.duration,
  fadeDuration: motion.bodyReplace.duration,
}
const PAGE_MOTION: PageMotionTokens = {
  travelRatio: motion.pageTravelRatio,
  parallaxRatio: motion.pageParallaxRatio,
  scrimOpacity: motion.pageScrimOpacity,
}
const ANIMATED_TOKENS = pageLayerTokens(PAGE_MOTION, false, false)
const REDUCED_TOKENS = pageLayerTokens(PAGE_MOTION, true, false)
const SETTLE_SLACK_MS = 60

interface StackLayer {
  key: string
  entry: DetailEntry
  stack: readonly DetailEntry[]
}

interface Phase {
  nav: number
  direction: BodyTransitionDirection
  plan: PageTransitionPlan
  leaving: StackLayer | null
  flipped: boolean
}

interface StackState {
  signature: string
  nav: number
  phase: Phase | null
}

function restoredByHistory(): boolean {
  const type = useNavStore.getState().lastTransition?.type
  return type === "restore" || type === "seed"
}

export function PageStack({
  direction,
  entries,
  insets,
  keyboardAvoidance,
  layerKeys,
  renderBody,
  scrollHost,
  stack,
  view,
  webKeyboardInset,
}: PageStackProps) {
  const styles = useStyles()
  const width = useWindowDimensions().width
  const hostRef = useRef<View>(null)
  const signature = layerKeys.join("|")
  const stackSlices = useMemo(() => stack.map((_, index) => stack.slice(0, index + 1)), [stack])
  const layers = useMemo<StackLayer[]>(
    () =>
      entries.map((entry, depth) => ({
        key: layerKeys[depth] ?? `${depth}`,
        entry,
        stack: stackSlices[stack.indexOf(entry)] ?? stack,
      })),
    [entries, layerKeys, stack, stackSlices],
  )
  const committedRef = useRef<readonly StackLayer[]>(layers)
  const [state, setState] = useState<StackState>(() => ({ signature, nav: 0, phase: null }))

  if (state.signature !== signature) {
    const plan = webPageTransitionPlan(
      direction,
      {
        restored: restoredByHistory(),
        reduceMotion: prefersReducedMotion(),
        keyboardBound: keyboardAvoidance,
        coarsePointer: isCoarsePointer(),
      },
      TIMING,
    )
    const nav = state.nav + 1
    const committed = committedRef.current
    const gone = committed[committed.length - 1]
    const leaving = plan.retainLeaving && gone && !layerKeys.includes(gone.key) ? gone : null
    setState({
      signature,
      nav,
      phase: isInstantPagePlan(plan) ? null : { nav, direction, plan, leaving, flipped: false },
    })
  }

  useLayoutEffect(() => {
    committedRef.current = layers
  }, [layers])

  const phase = state.phase
  const settle = useCallback((nav: number) => {
    setState((cur) => (cur.phase && cur.phase.nav === nav ? { ...cur, phase: null } : cur))
  }, [])

  useLayoutEffect(() => {
    if (!phase || phase.flipped) return
    const host = hostRef.current as unknown as { offsetHeight?: number } | null
    void host?.offsetHeight
    const nav = phase.nav
    setState((cur) =>
      cur.phase && cur.phase.nav === nav && !cur.phase.flipped
        ? { ...cur, phase: { ...cur.phase, flipped: true } }
        : cur,
    )
    const fallback = setTimeout(() => settle(nav), pagePlanDuration(phase.plan) + SETTLE_SLACK_MS)
    return () => clearTimeout(fallback)
  }, [phase?.nav])

  const rendered = phase?.leaving ? [...layers, phase.leaving] : layers
  const topIndex = rendered.length - 1
  const realTopIndex = layers.length - 1
  if (topIndex < 0) return null
  const tokens = prefersReducedMotion() ? REDUCED_TOKENS : ANIMATED_TOKENS
  const hasLeaving = phase?.leaving != null

  return (
    <View ref={hostRef} style={styles.host}>
      {rendered.map((layer, index) => {
        const progress = phase
          ? webLayerProgress({
              index,
              topIndex,
              hasLeaving,
              direction: phase.direction,
              flipped: phase.flipped,
              slide: phase.plan.slide,
            })
          : restingLayerProgress(index, topIndex)
        const css = webLayerCss(progress, width, tokens)
        const active = index === realTopIndex
        const topmost = index === topIndex
        return (
          <WebPageLayer
            key={layer.key}
            active={active}
            entry={layer.entry}
            keyboardAvoidance={keyboardAvoidance && active}
            onSettle={settle}
            opacity={css.opacity}
            paddingBottom={insets.paddingBottom}
            paddingTop={insets.paddingTop}
            pointer={pageLayerPointerEvents({ active, isLeaving: hasLeaving && topmost, hasLeaving })}
            renderBody={renderBody}
            scrimOpacity={topmost ? null : css.scrimOpacity}
            scrollHost={scrollHost}
            settleNav={phase?.flipped && topmost ? phase.nav : null}
            settleProperty={phase?.plan.slide ? "transform" : "opacity"}
            stack={layer.stack}
            transform={css.transform}
            transition={phase ? webLayerTransition(phase.plan, phase.flipped) : "none"}
            view={view}
            webKeyboardInset={active ? webKeyboardInset : null}
          />
        )
      })}
    </View>
  )
}

interface WebPageLayerProps {
  active: boolean
  entry: DetailEntry
  keyboardAvoidance: boolean
  onSettle: (nav: number) => void
  opacity: number
  paddingBottom: number
  paddingTop: number
  pointer: PageLayerPointerEvents
  renderBody: PageStackRenderBody
  scrimOpacity: number | null
  scrollHost: ScrollHostValue
  settleNav: number | null
  settleProperty: "transform" | "opacity"
  stack: readonly DetailEntry[]
  transform: string
  transition: string
  view: NavView
  webKeyboardInset: { paddingBottom: number } | null
}

const WebPageLayer = memo(function WebPageLayer({
  active,
  entry,
  keyboardAvoidance,
  onSettle,
  opacity,
  paddingBottom,
  paddingTop,
  pointer,
  renderBody,
  scrimOpacity,
  scrollHost,
  settleNav,
  settleProperty,
  stack,
  transform,
  transition,
  view,
  webKeyboardInset,
}: WebPageLayerProps) {
  const styles = useStyles()
  const body = useMemo(() => renderBody(entry, view), [entry, renderBody, view])
  const reserve = pageBottomReserve(entry.kind)
  const boxReserve = reserve === "box" ? paddingBottom : 0
  const contentReserve = reserve === "content" ? paddingBottom : 0
  const bodyScrollHost =
    reserve === "content" ? contentBottomReserveScrollHost(scrollHost) : scrollHost
  const motionStyle = { transform, opacity, transition } as unknown as ViewStyle
  const scrimStyle = { opacity: scrimOpacity ?? 0, transition } as unknown as ViewStyle

  const onTransitionEnd = (event: any) => {
    if (settleNav === null) return
    if (event?.target !== event?.currentTarget) return
    if (event?.propertyName && event.propertyName !== settleProperty) return
    onSettle(settleNav)
  }

  return (
    <View
      style={[styles.layer, motionStyle]}
      pointerEvents={pointer}
      aria-hidden={!active}
      {...({ onTransitionEnd } as any)}
    >
      <View style={[styles.layerContent, { paddingTop, paddingBottom: boxReserve }]}>
        <IosKeyboardAvoidingView
          style={[styles.layerContent, webKeyboardInset]}
          enabled={keyboardAvoidance}
        >
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
      {scrimOpacity === null ? null : (
        <View style={[styles.scrim, scrimStyle]} pointerEvents="none" />
      )}
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  host: { flex: 1 },
  layer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.bg,
  },
  layerContent: { flex: 1 },
  header: {
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.shadowColor,
  },
}))
