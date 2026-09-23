/**
 * THE INBOX ROW'S TWO NEW AFFORDANCES - a live timestamp, and per-row mute / mark-read - pinned at the
 * seams a screenshot cannot reach.
 *
 *  1. THE TIMESTAMP IS RENDERED, NOT RECEIVED. The row used to print the server's `ago` string, which is
 *     computed once per response and then frozen: an inbox left open reads "now" an hour later. The row
 *     now formats `lastMessageAt` (the ISO stamp the API sends beside `ago`) through the SAME localized
 *     seam every other list uses, and only falls back to `ago` for pages cached before the field existed.
 *     Ticking is ONE module-level interval with a `useSyncExternalStore` subscription per row - a
 *     `setInterval` inside the row component would be one timer per visible thread.
 *
 *  2. THE ACTIONS ARE PLATFORM-SPLIT, NOT PLATFORM-BLIND. Native reveals them by swipe (plain
 *     PanResponder - `react-native-gesture-handler` is banned in this package, see useSwipeReply's
 *     header); web has no swipe affordance at all and reveals an overflow chip on hover instead. Both
 *     paths are non-gestural for assistive tech: the row exposes `accessibilityActions`, which is the
 *     RN convention for exactly this (a gesture that must also be reachable from the rotor / TalkBack
 *     menu).
 *
 *  3. MARK-READ IS INVALIDATE-ONLY. Same reasoning `useToggleMute` documents: there is no helper for
 *     patching one row inside the infinite thread-list cache, so both mutations settle by refetching
 *     `queryKeys.threads` - which is also where the tab's unread badge reads from.
 *
 * Source greps: these files import react-native, which this package's node-environment vitest cannot
 * load, so component invariants are pinned by reading the source - the house pattern (see
 * `inboxListSurface.test.ts`, `searchInboxAffordances.test.ts`).
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const inbox = strip(read("../MessagingListBody.tsx"))
const timeAgoHook = strip(read("../useListTimeAgo.ts"))
const swipeHook = strip(read("../../primitives/useSwipeActions.ts"))
const swipeModel = strip(read("../../primitives/swipeActionsModel.ts"))
const reportChat = strip(read("../../data/hooks/report-chat.ts"))
const LOCALES = ["en", "es", "de", "ko"] as const

describe("the row's timestamp is client-rendered and ticks", () => {
  it("formats lastMessageAt through the localized seam, falling back to the server string", () => {
    expect(inbox).toContain("const timeAgo = useTickingListTimeAgo()")
    expect(inbox).toContain("const stamp = thread.lastMessageAt ? timeAgo(thread.lastMessageAt) : thread.ago")
    expect(inbox).toContain("{stamp ? <Text style={styles.ago}>{stamp}</Text> : null}")
    // The raw server string is no longer rendered directly.
    expect(inbox).not.toContain("{thread.ago ? <Text")
  })

  it("ticks off ONE shared interval, never a timer per row", () => {
    expect(timeAgoHook).toContain("useSyncExternalStore(subscribeTick, readTick, readTick)")
    expect(timeAgoHook).toMatch(/if \(tickTimer === null\)/)
    expect(timeAgoHook).toMatch(/if \(tickListeners\.size === 0 && tickTimer !== null\)/)
    expect(timeAgoHook).toContain("clearInterval(tickTimer)")
    expect((timeAgoHook.match(/setInterval\(/g) ?? []).length).toBe(1)
    expect(inbox, "the row subscribes to the shared clock - it does not own one").not.toContain("setInterval")
  })

  it("keeps the un-ticking formatter for the surfaces that never asked for one", () => {
    expect(timeAgoHook).toContain("export function useListTimeAgo()")
    expect(timeAgoHook).toContain("export function useTickingListTimeAgo()")
  })
})

describe("the native swipe uses the house gesture primitive", () => {
  it("is plain PanResponder - no react-native-gesture-handler anywhere near it", () => {
    expect(swipeHook).toContain("PanResponder.create")
    for (const src of [swipeHook, swipeModel, inbox]) {
      expect(src).not.toContain("react-native-gesture-handler")
      expect(src).not.toContain("Swipeable")
    }
  })

  it("never claims on touch-down, so a row tap still opens the thread", () => {
    expect(swipeHook).toContain("onStartShouldSetPanResponder: () => false")
    expect(swipeHook).toContain("onPanResponderTerminationRequest: () => false")
    const at = swipeHook.indexOf("onStartShouldSetPanResponderCapture: (evt) => {")
    expect(at, "the capture handler no longer exists").toBeGreaterThan(-1)
    const body = swipeHook.slice(at, swipeHook.indexOf("onMoveShouldSetPanResponderCapture", at))
    expect(body).toContain("return false")
  })

  it("negotiates the move against the RECORDED touch-down x, never gestureState.x0", () => {
    expect(swipeHook).toContain("startTracker.noteTouchStart(evt.nativeEvent.pageX)")
    expect(swipeHook).toContain(
      "shouldCaptureActionsSwipe(g.dx, g.dy, openRef.current, startTracker.startX())",
    )
    expect(swipeHook).not.toContain("g.x0")
  })

  it("keeps every threshold in the pure model, the way swipeReplyModel does", () => {
    for (const fn of [
      "actionsWidth",
      "actionsRestingX",
      "shouldCaptureActionsSwipe",
      "actionsTranslate",
      "actionsProgress",
      "shouldSnapOpen",
    ]) {
      expect(swipeModel).toContain(`export function ${fn}(`)
    }
    expect(swipeHook, "no re-typed thresholds in the hook").not.toMatch(/=== 10|\* 0\.5/)
  })

  it("snaps on the app's motion tokens rather than a hand-typed duration", () => {
    expect(swipeHook).toContain("motion.fade.duration")
    expect(swipeHook).toContain("Easing.bezier(...motion.easing)")
    expect(swipeHook).toContain("useNativeDriver: true")
  })

  it("keeps at most ONE row open, and ticks the haptic once per gesture", () => {
    expect(swipeHook).toContain("let openRowCloser: (() => void) | null = null")
    expect(swipeHook).toMatch(/if \(other && other !== closeRef\.current\) other\(\)/)
    expect(swipeHook).toContain("stateRef.current.haptics.impactLight()")
    expect(swipeHook).toContain("tickedRef.current = true")
  })

  it("is inert on web: the lane only arms off web and behind a real action count", () => {
    expect(swipeHook).toContain('const isNative = Platform.OS !== "web"')
    expect(swipeHook).toContain("const active = isNative && enabled && width > 0")
    expect(inbox).toContain("useSwipeActions({ enabled: !IS_WEB, actionCount: unread ? 3 : 2 })")
  })

  it("always animates home on release - a short drag on a CLOSED row never parks mid-lane", () => {
    expect(swipeHook).toMatch(/if \(shouldSnapOpen\(x, w, g\.vx\)\) openActions\(\)\s*else snapClosed\(\)/)
    expect(swipeHook).toMatch(
      /const snapClosed = useCallback\(\(\) => \{\s*if \(openRowCloser === closeRef\.current\) openRowCloser = null\s*settle\(false\)\s*\}/,
    )
    expect(swipeHook, "the public close stays idempotent for rows already at rest").toMatch(
      /const close = useCallback\(\(\) => \{\s*if \(openRef\.current\) snapClosed\(\)\s*\}/,
    )
    expect(swipeHook).toContain("onPanResponderTerminate: () => settle(openRef.current)")
  })

  it("shuts any other open row the moment a drag engages, not only once it snaps open", () => {
    expect(swipeHook).toMatch(/onPanResponderGrant: \(\) => \{\s*tickedRef\.current = false\s*closeOtherRow\(\)\s*\}/)
    expect(swipeHook).toMatch(/const openActions = useCallback\(\(\) => \{\s*closeOtherRow\(\)/)
  })

  it("hands a tap on an OPEN row to the lane instead of the thread", () => {
    expect(inbox).toMatch(
      /if \(swipe\.open\) \{\s*closeActions\(\)\s*return\s*\}\s*if \(closeOpenSwipeActions\(\)\) return\s*onPress\(thread\)/,
    )
  })

  it("closes whichever row is open on any other interaction with the list", () => {
    expect(swipeHook).toContain("export function closeOpenSwipeActions(): boolean")
    expect(inbox).toContain("onScrollBeginDrag={dismissSwipe}")
    expect(inbox).toContain("onTouchStart={dismissSwipe}")
    expect(inbox).toMatch(/useEffect\(\s*\(\) => \(\) => \{\s*closeOpenSwipeActions\(\)/)
  })
})

describe("the destructive third action", () => {
  it("hides the conversation for THIS viewer through the shared mutation, never a local filter", () => {
    expect(inbox).toContain("const hideConversation = useHideConversation(roomKind, roomId)")
    expect(inbox).toContain("hideConversation.mutate({ hidden: true })")
    expect(reportChat).toContain("export function useHideConversation(")
    expect(reportChat).toContain("api.toggleConversationHidden({ roomKind, roomId, hidden })")
  })

  it("removes the row optimistically and puts it back, in place, if the server refuses", () => {
    expect(reportChat).toContain("onMutate")
    expect(reportChat).toContain("qc.cancelQueries({ queryKey: queryKeys.threads })")
    expect(reportChat).toMatch(/onError[\s\S]*?items\.splice\(Math\.min\(slot\.index, items\.length\), 0, slot\.item\)/)
    expect(reportChat).toMatch(/onSettled[\s\S]*?invalidateQueries\(\{ queryKey: queryKeys\.threads \}\)/)
  })

  it("reads destructive from the token scale and is reachable without a gesture", () => {
    expect(inbox).toContain("backgroundColor: t.colors.bloom[\"600\"]")
    expect(inbox).toContain('icon="Trash2"')
    expect(inbox).toMatch(/actionName === "delete"/)
    expect(inbox).toContain('{ name: "delete", label: deleteA11yLabel }')
  })
})

describe("web gets a hover menu instead, and both platforms get a non-gesture path", () => {
  it("reveals the overflow chip on hover (or while its menu is open) and opens the house PopoverMenu", () => {
    expect(inbox).toContain("const { hovered, hoverProps } = useRowHover()")
    expect(inbox).toContain("{IS_WEB ? (")
    expect(inbox).toContain("rowMenuChipShown(state, hovered || menuOpen) ? null : styles.menuChipConcealed")
    expect(inbox).toContain("icon={iconMap.Ellipsis}")
    expect(inbox).toContain("<PopoverMenu")
    expect(inbox).toContain("usePopoverAnchor(setAnchorRect)")
    // The chip clears the 44pt floor by slop, on the file's own arithmetic.
    expect(inbox).toContain("const ROW_MENU_HIT_SLOP = (MIN_TOUCH_TARGET - ROW_MENU_CHIP) / 2")
    expect(inbox).toContain("hitSlop={ROW_MENU_HIT_SLOP}")
  })

  it("exposes the SAME two actions to assistive tech on the row itself", () => {
    expect(inbox).toContain("accessibilityActions={a11yActions}")
    expect(inbox).toContain("onAccessibilityAction={onA11yAction}")
    expect(inbox).toMatch(/actionName === "markRead"/)
    expect(inbox).toMatch(/actionName === "mute"/)
  })

  it("offers mark-read ONLY where there is something to clear", () => {
    expect(inbox).toMatch(/unread\s*\?\s*\[\s*\{ name: "mute", label: muteLabel \},\s*\{ name: "markRead", label: markReadLabel \},/)
    expect(inbox).toMatch(/if \(unread\) \{\s*items\.push\(\{ key: "markRead"/)
    expect(inbox).toMatch(/actionCount: unread \? 3 : 2/)
  })

  it("takes every label from the catalog, in all four locales", () => {
    for (const key of [
      "row.action.mute",
      "row.action.unmute",
      "row.action.mark_read",
      "row.action.more",
      "row.action.delete",
      "row.action.delete_a11y",
    ]) {
      expect(inbox).toContain(key)
    }
    for (const lng of LOCALES) {
      const catalog = JSON.parse(read(`../../i18n/locales/${lng}/messages-list.json`)) as {
        row: { action?: Record<string, string> }
      }
      expect(Object.keys(catalog.row.action ?? {}).sort()).toEqual([
        "delete",
        "delete_a11y",
        "mark_read",
        "more",
        "mute",
        "unmute",
      ])
    }
  })
})

describe("the two mutations", () => {
  it("reuse the existing mute hook and add a mark-read one with the same invalidate-only posture", () => {
    expect(inbox).toContain("const toggleMute = useToggleMute(roomKind, roomId)")
    expect(inbox).toContain("const markRead = useMarkThreadRead()")
    expect(inbox).toContain("toggleMute.mutate({ muted: !muted })")
    expect(inbox).toContain("markRead.mutate({ roomKind, roomId })")
    expect(reportChat).toContain("export function useMarkThreadRead()")
    expect(reportChat).toContain("api.markThreadRead(vars)")
    expect(reportChat).toMatch(
      /useMarkThreadRead\(\)[\s\S]*?onSuccess: \(\) => \{\s*void qc\.invalidateQueries\(\{ queryKey: queryKeys\.threads \}\)/,
    )
  })

  it("addresses the room the way the rest of the package does", () => {
    expect(inbox).toContain("const roomId = thread.refId ?? thread.id")
    expect(inbox).toContain("const roomKind = thread.kind")
  })
})
