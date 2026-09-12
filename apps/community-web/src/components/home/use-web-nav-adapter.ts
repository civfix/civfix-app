"use client"

import * as React from "react"
import {
  useNavStore,
  entryFromPath,
  layoutModeFor,
  takeNavSnapshot,
  ROOT_NAV_SNAPSHOT,
  type NavSnapshot,
  type NavTransition,
} from "@civfix/ui"

import {
  pathForSnapshot,
  readNavHistory,
  reconcilePlan,
  snapshotEquals,
  stampNavHistory,
  traversalFor,
  type NavHistoryEntry,
} from "./nav-history"

/**
 * The WEB deep-link / URL adapter for the unified nav store.
 *
 * The shared @civfix/ui nav store + shell are platform-agnostic and NEVER touch window.history; this
 * web-app-side hook owns the URL <-> store bridge. Every history entry the shell writes carries a
 * `civfixNav` stamp (a nav SNAPSHOT plus its in-session depth), so the browser's Back button and the
 * in-app chevron land on the same surface:
 *
 *   (a) on mount it either RESTORES the stamped snapshot (reload, bfcache, a return from /manage) or
 *       seeds from the live pathname, writing a synthetic in-app root beneath any cold deep link so the
 *       first browser Back stays on the site,
 *   (b) it maps the store's transition log onto history: forward transitions push, lateral ones replace,
 *       and a POP TRAVERSES (`history.go(-n)`) instead of pushing a new entry,
 *   (c) a user-initiated popstate restores the landed snapshot into the store; a popstate landing from
 *       our own traversal reconciles the entry with whatever the store already is.

 *
 * URL sync uses raw history.pushState/replaceState (NOT next/navigation) on purpose: a Next client
 * navigation to /pin/<id> would unmount the shell (and the map) and mount the catch-all route shell. We
 * want the opposite - keep the shell, swap the active panel, and merely reflect the URL. Every write
 * SPREADS the existing window.history.state, because Next's app router keeps its own tree there and hard
 * reloads on a popstate whose state lacks it.
 */

/**
 * The live layout mode at call time, so the mount seed branches list-kinds correctly. Delegates to the
 * shared `layoutModeFor` (the same rule useLayoutMode() applies: landscape/square AND wide enough for
 * the expanded frame) so the seed matches the surface the store + shell will render.
 */
function liveMode(): "compact" | "expanded" {
  if (typeof window === "undefined") return "compact"
  return layoutModeFor(window.innerWidth, window.innerHeight)
}

/**
 * Resolve the pathname to seed from. Under output:"export" a fallback-served deep link arrives at the
 * placeholder route ("/pin/_") while window.location holds the real "/pin/<id>"; prefer the live
 * location unless it is itself a placeholder ("/.../_/...").
 */
function seedPathname(): string {
  if (typeof window === "undefined") return "/"
  const live = window.location.pathname
  return live && live !== "/" && !live.includes("/_/") ? live : "/"
}

/**
 * Seed (replace) the whole store from a pathname, branching list-kind vs detail by the live mode. The
 * store's `seed` ACTION owns the seeding invariant - this adapter only decides WHICH entry and WHICH
 * layout mode.
 */
function seedStoreFromPath(pathname: string): void {
  useNavStore.getState().seed(entryFromPath(pathname), liveMode())
}

function liveSnapshot(): NavSnapshot {
  return takeNavSnapshot(useNavStore.getState())
}

function isRootSnapshot(snapshot: NavSnapshot): boolean {
  return snapshot.view === "home" && snapshot.stack.length === 0
}

const TRAVERSAL_TIMEOUT_MS = 400

interface PendingTraversal {
  expectedDepth: number
  timer: ReturnType<typeof window.setTimeout>
}

interface NavController {
  seq: number
  adapterDriven: boolean
  handledSeq: number
  traversal: PendingTraversal | null
  queued: NavTransition[]
  written: (NavSnapshot | undefined)[]
}

/**
 * The return-depth pair an entry carries while a report run is live: the depth of the surface the wizard
 * was launched from, so one traversal unwinds the whole report -> search -> report detour. Inherited
 * while the capture token is unchanged, re-anchored on a fresh capture, absent with no run.
 */
function returnFields(
  current: NavHistoryEntry | null,
  snapshot: NavSnapshot,
): Pick<NavHistoryEntry, "returnDepth" | "returnToken"> {
  const reportReturn = snapshot.reportReturn
  if (!reportReturn) return {}
  if (current && current.returnToken === reportReturn.token && current.returnDepth !== undefined)
    return { returnDepth: current.returnDepth, returnToken: current.returnToken }
  return { returnDepth: current?.depth ?? 0, returnToken: reportReturn.token }
}

export function useWebNavAdapter(): void {
  const controllerRef = React.useRef<NavController>({
    seq: 0,
    adapterDriven: false,
    handledSeq: 0,
    traversal: null,
    queued: [],
    written: [],
  })

  const write = React.useCallback(
    (
      mode: "push" | "replace",
      depth: number,
      snapshot: NavSnapshot,
      current: NavHistoryEntry | null,
    ) => {
      const controller = controllerRef.current
      controller.seq += 1
      const entry: NavHistoryEntry = {
        v: 1,
        seq: controller.seq,
        depth,
        ...returnFields(current, snapshot),
        snapshot,
      }
      const state = stampNavHistory(window.history.state, entry)
      const path = pathForSnapshot(snapshot)
      if (mode === "push") window.history.pushState(state, "", path)
      else window.history.replaceState(state, "", path)
      controller.written[depth] = snapshot
      controller.written.length = depth + 1
    },
    [],
  )

  const drive = React.useCallback((run: () => void) => {
    const controller = controllerRef.current
    controller.adapterDriven = true
    try {
      run()
    } finally {
      controller.adapterDriven = false
    }
    controller.handledSeq = useNavStore.getState().navSeq
  }, [])

  const recover = React.useCallback(() => {
    const controller = controllerRef.current
    controller.traversal = null
    controller.queued = []
    const current = readNavHistory(window.history.state)
    write("replace", current?.depth ?? 0, liveSnapshot(), current)
  }, [write])

  const traverse = React.useCallback(
    (steps: number, fromDepth: number) => {
      const controller = controllerRef.current
      controller.traversal = {
        expectedDepth: fromDepth - steps,
        timer: window.setTimeout(recover, TRAVERSAL_TIMEOUT_MS),
      }
      window.history.go(-steps)
    },
    [recover],
  )

  const reconcile = React.useCallback(
    (landed: NavHistoryEntry | null) => {
      const controller = controllerRef.current
      const live = liveSnapshot()
      const depth = landed?.depth ?? 0
      const plan = reconcilePlan(landed?.snapshot ?? ROOT_NAV_SNAPSHOT, live)
      if (plan.type === "none") return
      if (plan.type === "push") {
        write("push", depth + 1, live, landed)
        return
      }
      const beneath = depth > 0 ? controller.written[depth - 1] : undefined
      if (beneath && snapshotEquals(beneath, live)) {
        traverse(1, depth)
        return
      }
      write("replace", depth, live, landed)
    },
    [traverse, write],
  )

  const settle = React.useCallback(
    (landed: NavHistoryEntry | null) => {
      const controller = controllerRef.current
      while (controller.queued.length > 0) {
        const queued = controller.queued.shift()
        const steps = queued ? traversalFor(queued, landed) : 0
        if (steps > 0) {
          traverse(steps, landed?.depth ?? 0)
          return
        }
      }
      reconcile(landed)
    },
    [reconcile, traverse],
  )

  // (a) Seed once on mount from the stamped history entry, or from the live URL. Done in a LAYOUT effect
  // (not useEffect) so the store is seeded BEFORE the first paint of the shell - otherwise a deep link
  // would flash the map-only home for one frame before the panel opens. Safe with no SSR guard: this hook
  // only runs inside HomeShell, which is mounted via dynamic(ssr:false).
  React.useLayoutEffect(() => {
    const controller = controllerRef.current
    const existing = readNavHistory(window.history.state)
    if (existing) {
      controller.seq = existing.seq
      drive(() => useNavStore.getState().restore(existing.snapshot))
      return
    }
    drive(() => seedStoreFromPath(seedPathname()))
    const live = liveSnapshot()
    if (isRootSnapshot(live)) {
      write("replace", 0, live, null)
      return
    }
    // A COLD DEEP LINK has no in-app entry beneath it, so the first browser Back would leave the site.
    // Write the in-app root underneath it, then push the deep-linked state on top: the address bar still
    // ends on the deep link, and Back lands on the home feed instead of the previous website.
    write("replace", 0, ROOT_NAV_SNAPSHOT, null)
    write("push", 1, live, readNavHistory(window.history.state))
    // Mount-only: subsequent changes flow through the subscription below / popstate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // (b) Map the store's transition log onto history. A forward move pushes, a lateral one replaces, and a
  // POP traverses - which is the whole point: the in-app chevron must consume a history entry rather than
  // append one, or browser Back would walk straight back into the surface the user just left.
  React.useEffect(() => {
    const unsub = useNavStore.subscribe((state) => {
      const controller = controllerRef.current
      if (controller.adapterDriven) return
      if (state.navSeq === controller.handledSeq) return
      controller.handledSeq = state.navSeq
      const transition = state.lastTransition
      if (!transition || transition.type === "restore") return
      if (controller.traversal) {
        if (transition.type === "pop") controller.queued.push(transition)
        return
      }
      const current = readNavHistory(window.history.state)
      const live = takeNavSnapshot(state)
      if (transition.type === "pop") {
        if (current && snapshotEquals(current.snapshot, live)) return
        const steps = traversalFor(transition, current)
        if (steps === 0) {
          write("replace", current?.depth ?? 0, live, current)
          return
        }
        traverse(steps, current?.depth ?? 0)
        return
      }
      if (transition.type === "replace") {
        write("replace", current?.depth ?? 0, live, current)
        return
      }
      if (current && snapshotEquals(current.snapshot, live)) return
      write("push", (current?.depth ?? 0) + 1, live, current)
    })
    return unsub
  }, [traverse, write])

  // (c) Browser Back/Forward restores the landed snapshot into the store. A popstate that is the landing
  // of OUR OWN traversal is the other direction: the store is already right, so the entry is reconciled to
  // it instead (a pop requested mid-flight is re-measured against the entry we land on).
  React.useEffect(() => {
    const controller = controllerRef.current
    const onPop = (event: PopStateEvent) => {
      const landed = readNavHistory(event.state)
      const traversal = controller.traversal
      if (traversal) {
        window.clearTimeout(traversal.timer)
        controller.traversal = null
        if (!landed || landed.depth === traversal.expectedDepth) {
          settle(landed)
          return
        }
        controller.queued = []
      }
      if (landed) {
        drive(() => useNavStore.getState().restore(landed.snapshot))
        return
      }
      // An entry this controller never wrote (a tab opened against an older build). Seed from its path,
      // then stamp it so the next pop has a depth to traverse against.
      drive(() => seedStoreFromPath(window.location.pathname))
      write("replace", 0, liveSnapshot(), null)
    }
    window.addEventListener("popstate", onPop)
    return () => {
      window.removeEventListener("popstate", onPop)
      if (controller.traversal) window.clearTimeout(controller.traversal.timer)
      controller.traversal = null
      controller.queued = []
    }
  }, [drive, settle, write])

  // (d) Move focus to the active panel's heading on route change (WCAG 2.4.3). When the store gains a
  // NEW active detail entry, jump keyboard focus to the panel heading the shared shell marks with
  // `data-civfix-panel-heading` (+ tabIndex=-1). requestAnimationFrame defers until after the panel has
  // mounted/rendered. SSR-safe via the window guard (this hook only runs in HomeShell, ssr:false).
  //
  // The subscriber fires on EVERY store change, not only nav changes - the list header's search text
  // lives in the same store (`query`) - so we gate on the active entry actually CHANGING. Without that
  // gate, every search keystroke with a detail panel open would yank focus out of the search input and
  // onto the panel heading, making typing impossible.
  React.useEffect(() => {
    let prevActive = useNavStore.getState().active
    const unsub = useNavStore.subscribe((state) => {
      const active = state.active
      if (active === prevActive) return
      prevActive = active
      if (typeof window === "undefined") return
      if (active) {
        requestAnimationFrame(() => {
          const h = document.querySelector("[data-civfix-panel-heading]")
          if (h instanceof HTMLElement) h.focus()
        })
      }
    })
    return unsub
  }, [])
}
