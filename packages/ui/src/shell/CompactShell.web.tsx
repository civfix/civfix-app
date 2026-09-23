import React, { useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  View,
  PanResponder,
  useWindowDimensions,
  type ViewStyle,
} from "react-native"
import { makeThemedStyles, space, motion, focusRingProps } from "../theme"
import { useT } from "../i18n"
import { BlurSurface } from "../surface"
import { useNavStore, type DetailEntry, type Snap, type View as NavView } from "../nav"
import { SearchHeader } from "./SearchHeader.web"
import { SheetHeader } from "./SheetHeader.shared"
import { shouldCollapseOnSettle } from "./dragCollapse"
import { defaultRenderBody } from "./BodyRouter"
import { ScrollHostProvider, PLAIN_SCROLL_HOST } from "./ScrollHost"
import { makeKeyboardAwareScrollHost } from "./KeyboardAwareScroll"
import { cssTransition } from "./motionCss"
import { shellBodyKey } from "./bodyLayout"
import { SHEET_SNAP_RANGE, compactBottomChrome, sheetSnapForKey, sheetSnapPoints } from "./tabBarLogic"
import { isCoarsePointer, prefersReducedMotion } from "./webMedia"
import { BodyTransition } from "./BodyTransition.web"
import { useStackDirection } from "./useStackDirection"
import type { CompactShellProps } from "./CompactShell.types"

const SHEET_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST, {
  onKeyboardShow: () => useNavStore.getState().setSnap(2, false),
})

const SIDE_PEEK = 12
const SIDE_FULL = 4
const BOTTOM_PEEK = 0
const BOTTOM_FULL = 0
const RADIUS_PEEK = 30
const RADIUS_FULL = 22

const SETTLE_TRANSITION = cssTransition(
  ["height", "left", "right", "border-radius"],
  motion.sheetMove,
)

const FLING_VELOCITY = 0.5
const TAP_SLOP = 6

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function WebSheetHeader({
  active,
  stack,
  view,
}: {
  active: DetailEntry | null
  stack: readonly DetailEntry[]
  view: NavView
}) {
  const setSnap = useNavStore((s) => s.setSnap)
  return (
    <SheetHeader
      view={view}
      active={active}
      stack={stack}
      SearchHeaderComponent={SearchHeader}
      onSearchFocus={() => setSnap(2, !isCoarsePointer())}
    />
  )
}

export function CompactShell({ renderBody = defaultRenderBody, closing = false, onClosed }: CompactShellProps) {
  const styles = useStyles()
  const { t: tNav } = useT("nav")
  const { height: winH } = useWindowDimensions()

  useLayoutEffect(() => {
    if (closing) onClosed?.()
  }, [closing, onClosed])

  const snap = useNavStore((s) => s.snap)
  const snapAnimated = useNavStore((s) => s.snapAnimated)
  const setSnap = useNavStore((s) => s.setSnap)
  const active = useNavStore((s) => s.active)
  const view = useNavStore((s) => s.view)
  const stack = useNavStore((s) => s.stack)
  const collapseToParent = useNavStore((s) => s.collapseToParent)

  const transitionKey = shellBodyKey(active, `home:${view}`)
  const direction = useStackDirection(stack.length)

  const snapPx = useMemo(() => sheetSnapPoints(winH, space["8"]), [winH])

  const [dragHeight, setDragHeight] = useState<number | null>(null)

  const snapRef = useRef<Snap>(snap)
  const snapPxRef = useRef(snapPx)
  const startHeightRef = useRef(0)
  snapRef.current = snap
  snapPxRef.current = snapPx

  const settledHeight = snapPx[snap]
  const dragging = dragHeight !== null
  const height = dragging ? dragHeight : settledHeight

  const [peek, mid, full] = snapPx
  let frac: number
  if (height <= mid) {
    frac = mid === peek ? 0 : (height - peek) / (mid - peek)
  } else {
    frac = full === mid ? 1 : 1 + (height - mid) / (full - mid)
  }
  frac = clamp(frac, 0, 2)
  const t = frac / 2
  const side = lerp(SIDE_PEEK, SIDE_FULL, t)
  const bottom = lerp(BOTTOM_PEEK, BOTTOM_FULL, t)
  const radius = lerp(RADIUS_PEEK, RADIUS_FULL, t)

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          startHeightRef.current = snapPxRef.current[snapRef.current]
        },
        onPanResponderMove: (_e, g) => {
          const [pk, , fl] = snapPxRef.current
          setDragHeight(clamp(startHeightRef.current - g.dy, pk, fl))
        },
        onPanResponderRelease: (_e, g) => {
          const px = snapPxRef.current
          const cur = snapRef.current
          const moved = Math.abs(g.dy) + Math.abs(g.dx)
          let next: Snap
          if (moved < TAP_SLOP) {
            next = (((cur + 1) % 3) as Snap)
          } else if (g.vy < -FLING_VELOCITY) {
            next = (Math.min(cur + 1, 2) as Snap)
          } else if (g.vy > FLING_VELOCITY) {
            next = (Math.max(cur - 1, 0) as Snap)
          } else {
            const h = clamp(startHeightRef.current - g.dy, px[0], px[2])
            let best: Snap = 0
            let bestDist = Infinity
            ;([0, 1, 2] as Snap[]).forEach((i) => {
              const d = Math.abs(px[i] - h)
              if (d < bestDist) {
                bestDist = d
                best = i
              }
            })
            next = best
          }
          setDragHeight(null)
          setSnap(next)
          if (shouldCollapseOnSettle(next, cur)) collapseToParent()
        },
        onPanResponderTerminate: () => setDragHeight(null),
      }),
    [setSnap, collapseToParent],
  )

  const onHandleKeyDown = (event: { key?: string; preventDefault?: () => void }) => {
    const cur = snapRef.current
    const next = sheetSnapForKey(cur, event.key)
    if (next === null) return
    event.preventDefault?.()
    setSnap(next)
    if (shouldCollapseOnSettle(next, cur)) collapseToParent()
  }

  const settleTransition =
    dragging || !snapAnimated || prefersReducedMotion() ? "none" : SETTLE_TRANSITION
  const anchorStyle = {
    height,
    bottom: 0,
    transition: settleTransition,
  } as unknown as ViewStyle

  const cardStyle = {
    left: side,
    right: side,
    bottom,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    transition: settleTransition,
  } as unknown as ViewStyle

  const headerVPad = { paddingTop: 0, paddingBottom: snap === 0 ? 20 : 12 }

  const body = useMemo(() => renderBody(active, view), [renderBody, active, view])
  const showSheetHeader = active !== null || compactBottomChrome(view) !== "docked-search"

  return (
    <View style={[styles.anchor, anchorStyle]}>
      <BlurSurface kind="sheet" style={[styles.card, cardStyle]}>
        <View
          style={styles.handleArea}
          {...panResponder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel={tNav("a11y.drag_handle")}
          {...({
            "aria-valuemin": SHEET_SNAP_RANGE.min,
            "aria-valuemax": SHEET_SNAP_RANGE.max,
            "aria-valuenow": snap,
            "aria-orientation": "vertical",
            tabIndex: 0,
            onKeyDown: onHandleKeyDown,
          } as object)}
          {...focusRingProps}
        >
          <View style={styles.handleBar} />
        </View>
        <View style={styles.contentHost}>
          <BodyTransition transitionKey={transitionKey} direction={direction}>
            <View style={styles.transitionContent}>
              {showSheetHeader ? (
                <View style={[styles.headerHost, headerVPad]}>
                  <WebSheetHeader active={active} stack={stack} view={view} />
                </View>
              ) : null}
              <ScrollHostProvider value={SHEET_SCROLL_HOST}>
                <View style={styles.bodyHost}>{body}</View>
              </ScrollHostProvider>
            </View>
          </BodyTransition>
        </View>
      </BlurSurface>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  anchor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    pointerEvents: "box-none",
  },
  card: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
    ...t.shadows.s4,
  },
  handleArea: {
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: t.space["2"],
    ...({ touchAction: "none", cursor: "grab", userSelect: "none" } as unknown as ViewStyle),
  },
  handleBar: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: t.glass.grabHandle,
  },
  contentHost: {
    flex: 1,
  },
  transitionContent: {
    flex: 1,
  },
  headerHost: {
    paddingHorizontal: 14,
  },
  bodyHost: {
    flex: 1,
  },
}))
