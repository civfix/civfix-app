import React, { useEffect, useMemo, useRef, useState } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { useNavStore, type DetailEntry, type View as NavView } from "../nav"
import { makeThemedStyles, motion } from "../theme"
import { BodyTransition } from "./BodyTransition"
import { CompactShell } from "./CompactShell"
import { makeKeyboardAwareScrollHost } from "./KeyboardAwareScroll"
import { useDraftReportStore } from "../report/draftStore"
import { PageActiveProvider } from "./pageActive"
import { PageStack } from "./PageStack"
import { PLAIN_SCROLL_HOST, ScrollHostProvider } from "./ScrollHost"
import { SearchBodyReveal } from "./SearchBodyReveal"
import { TabBar } from "./TabBar"
import { portraitFramePlan, reportDraftStartsFresh, type PortraitShellPlan } from "./bodyLayout"
import { useTabBarStore } from "./tabBarStore"
import type { AppShellProps } from "./types"
import { useStackDirection } from "./useStackDirection"

type RenderBody = NonNullable<AppShellProps["renderBody"]>

function baseSurfaceUnderSearchOverlay(): boolean {
  return Platform.OS !== "web" && useNavStore.getState().view === "search"
}

const PORTRAIT_BASE_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST, {
  ownsFocusedInput: () => !baseSurfaceUnderSearchOverlay(),
  reserveKeyboardPadding: () => !baseSurfaceUnderSearchOverlay(),
})

const PORTRAIT_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST)

const RETAIN_REPORT_BODY = Platform.OS !== "web"

const REPORT_PREWARM_DELAY_MS = 3000

const RETAIN_TAB_BODIES = Platform.OS !== "web"

const HOME_PREWARM_DELAY_MS = 3400
const MESSAGING_PREWARM_DELAY_MS = 3800

function useKeepAliveSlotMounted(
  visible: boolean,
  retained: boolean,
  prewarmDelayMs: number,
): boolean {
  const [mounted, setMounted] = useState(visible)
  useEffect(() => {
    if (visible) setMounted(true)
  }, [visible])
  useEffect(() => {
    if (!retained || mounted) return
    const handle = setTimeout(() => setMounted(true), prewarmDelayMs)
    return () => clearTimeout(handle)
  }, [retained, mounted, prewarmDelayMs])
  return mounted
}

export interface PortraitShellProps {
  active: DetailEntry | null
  plan: PortraitShellPlan
  renderBody: RenderBody
  view: NavView
  baseView: NavView
  fullPageDetails?: boolean
  stack?: readonly DetailEntry[]
}

interface PortraitShellFrameProps extends PortraitShellProps {
  bottomChromeFallback: number
  keyboardInset: number
  topInset: number
  bottomSafeArea: number
}

export function PortraitShellFrame({
  active,
  baseView,
  bottomChromeFallback,
  bottomSafeArea,
  fullPageDetails = false,
  keyboardInset,
  plan,
  renderBody,
  stack: ownedStack,
  topInset,
  view,
}: PortraitShellFrameProps) {
  const styles = useStyles()
  const tabBarHeight = useTabBarStore((state) => state.tabBarHeight)
  const liveStack = useNavStore((state) => state.stack)
  const stack = ownedStack ?? liveStack
  const direction = useStackDirection(stack.length)
  const frame = portraitFramePlan(
    baseView,
    active,
    plan,
    tabBarHeight,
    bottomChromeFallback,
    stack,
    fullPageDetails,
  )
  const baseInsets = { paddingTop: topInset, paddingBottom: frame.base.bottomInset }
  const overlayInsets = useMemo(
    () => ({ paddingTop: topInset, paddingBottom: frame.overlay.bottomInset || bottomSafeArea }),
    [topInset, frame.overlay.bottomInset, bottomSafeArea],
  )
  const overlayScrollHost = frame.overlay.keyboardAvoidance
    ? PLAIN_SCROLL_HOST
    : PORTRAIT_SCROLL_HOST
  const baseScrollHost = PORTRAIT_BASE_SCROLL_HOST
  const webKeyboardInset =
    frame.overlay.keyboardAvoidance && keyboardInset > 0 ? { paddingBottom: keyboardInset } : null

  const sheetActive = frame.sheet.visible
  const [sheetMounted, setSheetMounted] = useState(sheetActive)
  useEffect(() => {
    if (sheetActive) setSheetMounted(true)
  }, [sheetActive])
  const sheetClosing = sheetMounted && !sheetActive
  const closeGuard = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!sheetClosing) return
    closeGuard.current = setTimeout(() => setSheetMounted(false), motion.sheetTeardownGuardMs)
    return () => {
      if (closeGuard.current) clearTimeout(closeGuard.current)
    }
  }, [sheetClosing])
  const onSheetClosed = () => {
    if (closeGuard.current) clearTimeout(closeGuard.current)
    setSheetMounted(false)
  }
  const reportSlotVisible = RETAIN_REPORT_BODY && frame.base.bodyMounted && baseView === "report"
  const reportSlotMounted = useKeepAliveSlotMounted(
    reportSlotVisible,
    RETAIN_REPORT_BODY,
    REPORT_PREWARM_DELAY_MS,
  )
  const homeSlotVisible = RETAIN_TAB_BODIES && frame.base.bodyMounted && baseView === "home"
  const messagingSlotVisible = RETAIN_TAB_BODIES && frame.base.bodyMounted && baseView === "messaging"
  const homeSlotMounted = useKeepAliveSlotMounted(
    homeSlotVisible,
    RETAIN_TAB_BODIES,
    HOME_PREWARM_DELAY_MS,
  )
  const messagingSlotMounted = useKeepAliveSlotMounted(
    messagingSlotVisible,
    RETAIN_TAB_BODIES,
    MESSAGING_PREWARM_DELAY_MS,
  )
  const homeSlotBody = useMemo(() => renderBody(null, "home"), [renderBody])
  const messagingSlotBody = useMemo(() => renderBody(null, "messaging"), [renderBody])
  const reportSlotStale = useRef(false)
  useEffect(() => {
    if (!RETAIN_REPORT_BODY) return
    return useDraftReportStore.subscribe((state, prevState) => {
      const seeded = state.freshSeeds !== prevState.freshSeeds
      const mediaCleared =
        reportDraftStartsFresh(state.draft.media.length) &&
        !reportDraftStartsFresh(prevState.draft.media.length)
      if (seeded || mediaCleared) reportSlotStale.current = true
    })
  }, [])
  const [reportSlotGeneration, setReportSlotGeneration] = useState(0)
  const [seenBaseView, setSeenBaseView] = useState(baseView)
  if (seenBaseView !== baseView) {
    setSeenBaseView(baseView)
    if (baseView === "report" && reportSlotStale.current) {
      reportSlotStale.current = false
      setReportSlotGeneration((generation) => generation + 1)
    }
  }
  const reportSlotBody = useMemo(() => renderBody(null, "report"), [renderBody])
  const reportSlotActive = reportSlotVisible && stack.length === 0

  const baseBody = useMemo(
    () =>
      frame.base.bodyMounted && !reportSlotVisible && !homeSlotVisible && !messagingSlotVisible
        ? renderBody(frame.base.entry, baseView)
        : null,
    [
      frame.base.bodyMounted,
      frame.base.entry,
      renderBody,
      baseView,
      reportSlotVisible,
      homeSlotVisible,
      messagingSlotVisible,
    ],
  )

  const dockVisible =
    Platform.OS === "web"
      ? frame.bottomChrome.visible && !sheetMounted
      : frame.bottomChrome.visible || sheetActive || sheetMounted

  return (
    <>
      <View
        style={[
          styles.surface,
          frame.base.bodyMounted ? styles.opaqueSurface : styles.hiddenSurface,
          frame.overlay.bodyMounted ? styles.coveredSurface : null,
          { zIndex: frame.base.zIndex },
          baseInsets,
        ]}
      >
        <ScrollHostProvider value={baseScrollHost}>
          <View style={styles.surfaceContent}>
            <BodyTransition transitionKey={frame.base.transitionKey} direction={direction}>
              {baseBody}
              {homeSlotMounted ? (
                <View
                  style={[styles.keepAliveSlot, homeSlotVisible ? null : styles.keepAliveHidden]}
                  pointerEvents={homeSlotVisible ? "auto" : "none"}
                  accessibilityElementsHidden={!homeSlotVisible}
                  importantForAccessibility={homeSlotVisible ? "auto" : "no-hide-descendants"}
                >
                  <PageActiveProvider value={homeSlotVisible}>{homeSlotBody}</PageActiveProvider>
                </View>
              ) : null}
              {messagingSlotMounted ? (
                <View
                  style={[
                    styles.keepAliveSlot,
                    messagingSlotVisible ? null : styles.keepAliveHidden,
                  ]}
                  pointerEvents={messagingSlotVisible ? "auto" : "none"}
                  accessibilityElementsHidden={!messagingSlotVisible}
                  importantForAccessibility={messagingSlotVisible ? "auto" : "no-hide-descendants"}
                >
                  <PageActiveProvider value={messagingSlotVisible}>
                    {messagingSlotBody}
                  </PageActiveProvider>
                </View>
              ) : null}
            </BodyTransition>
            {reportSlotMounted ? (
              <View
                key={`report:${reportSlotGeneration}`}
                style={[styles.keepAliveSlot, reportSlotVisible ? null : styles.keepAliveHidden]}
                pointerEvents={reportSlotVisible ? "auto" : "none"}
                accessibilityElementsHidden={!reportSlotVisible}
                importantForAccessibility={reportSlotVisible ? "auto" : "no-hide-descendants"}
              >
                <PageActiveProvider value={reportSlotActive}>{reportSlotBody}</PageActiveProvider>
              </View>
            ) : null}
          </View>
        </ScrollHostProvider>
      </View>

      <SearchBodyReveal
        active={view === "search"}
        renderBody={renderBody}
        topInset={topInset}
        bottomInset={frame.base.bottomInset}
      />

      <View
        style={[
          styles.surface,
          frame.overlay.bodyMounted ? styles.opaqueSurface : styles.hiddenSurface,
          frame.overlay.interactive ? null : styles.coveredSurface,
          { zIndex: frame.overlay.zIndex },
        ]}
      >
        <PageStack
          direction={direction}
          entries={frame.overlay.entries}
          insets={overlayInsets}
          interactive={frame.overlay.interactive}
          keyboardAvoidance={frame.overlay.keyboardAvoidance}
          layerKeys={frame.overlay.layerKeys}
          renderBody={renderBody}
          scrollHost={overlayScrollHost}
          stack={stack}
          view={view}
          webKeyboardInset={webKeyboardInset}
        />
      </View>

      {sheetMounted ? (
        <CompactShell renderBody={renderBody} closing={sheetClosing} onClosed={onSheetClosed} />
      ) : null}

      {dockVisible ? (
        <View
          style={[styles.tabBar, { zIndex: frame.bottomChrome.zIndex }]}
          pointerEvents={sheetActive ? "none" : "box-none"}
        >
          <TabBar />
        </View>
      ) : null}
    </>
  )
}

const useStyles = makeThemedStyles((t) => ({
  surface: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  opaqueSurface: {
    backgroundColor: t.colors.bg,
  },
  hiddenSurface: {
    pointerEvents: "none",
  },
  coveredSurface: {
    pointerEvents: "none",
  },
  surfaceContent: {
    flex: 1,
  },
  keepAliveSlot: {
    ...StyleSheet.absoluteFillObject,
  },
  keepAliveHidden: {
    opacity: 0,
    pointerEvents: "none",
  },
  tabBar: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none",
  },
}))
