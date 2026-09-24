"use client"

import * as React from "react"
import {
  useNavStore,
  layoutModeFor,
  takeNavSnapshot,
  ROOT_NAV_SNAPSHOT,
  type NavSnapshot,
  type NavTransition,
} from "@civfix/ui"
import type { OpenInternalHrefCapability } from "@civfix/ui/capabilities"

import {
  entryFromWebPath,
  pathForSnapshot,
  readNavHistory,
  reconcilePlan,
  snapshotEquals,
  stampNavHistory,
  traversalFor,
  writePlan,
  type NavHistoryEntry,
} from "./nav-history"

/** Read at call time so the mount seed matches the surface the store and shell will render. */
function liveMode(): "compact" | "expanded" {
  if (typeof window === "undefined") return "compact"
  return layoutModeFor(window.innerWidth, window.innerHeight)
}

/**
 * Under output: "export" a fallback-served deep link renders the placeholder route ("/pin/_") while
 * window.location holds the real "/pin/<id>", so the live location wins unless it is itself a placeholder.
 */
function seedPathname(): string {
  if (typeof window === "undefined") return "/"
  const live = window.location.pathname
  return live && live !== "/" && !live.includes("/_/") ? live : "/"
}

function seedStoreFromPath(pathname: string): void {
  useNavStore.getState().seed(entryFromWebPath(pathname), liveMode())
}

export const webOpenInternalHref: OpenInternalHrefCapability = {
  entryFor: entryFromWebPath,
  open: (path: string): boolean => {
    const entry = entryFromWebPath(path)
    if (!entry) return false
    useNavStore.getState().push(entry)
    return true
  },
}

function lastFocusable(selector: string): Element | undefined {
  return Array.from(document.querySelectorAll(selector))
    .filter((element) => !element.closest('[aria-hidden="true"], [inert]'))
    .pop()
}

function liveSnapshot(): NavSnapshot {
  return takeNavSnapshot(useNavStore.getState())
}

function isRootSnapshot(snapshot: NavSnapshot): boolean {
  return snapshot.view === "home" && snapshot.stack.length === 0
}

const TRAVERSAL_TIMEOUT_MS = 400

interface TraversalTarget {
  depth: number
  seq: number | undefined
}

interface PendingTraversal extends TraversalTarget {
  timer: ReturnType<typeof window.setTimeout>
}

interface NavController {
  seq: number
  adapterDriven: boolean
  handledSeq: number
  traversal: PendingTraversal | null
  abandoned: TraversalTarget | null
  queued: NavTransition[]
  seqAt: (number | undefined)[]
}

function isTarget(target: TraversalTarget, landed: NavHistoryEntry): boolean {
  if (target.seq !== undefined) return landed.seq === target.seq
  return landed.depth === target.depth
}

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
    abandoned: null,
    queued: [],
    seqAt: [],
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
        v: 2,
        seq: controller.seq,
        depth,
        ...returnFields(current, snapshot),
        beneath: mode === "push" ? (current?.snapshot ?? null) : (current?.beneath ?? null),
        snapshot,
      }
      const state = stampNavHistory(window.history.state, entry)
      const path = pathForSnapshot(snapshot)
      if (mode === "push") window.history.pushState(state, "", path)
      else window.history.replaceState(state, "", path)
      controller.seqAt[depth] = controller.seq
      controller.seqAt.length = depth + 1
    },
    [],
  )

  const stampLeftBehindQuery = React.useCallback(
    (current: NavHistoryEntry | null, left: NavSnapshot): NavHistoryEntry | null => {
      if (!current || current.snapshot.query === left.query) return current
      if (!snapshotEquals(current.snapshot, left)) return current
      const entry: NavHistoryEntry = {
        ...current,
        snapshot: { ...current.snapshot, query: left.query },
      }
      window.history.replaceState(
        stampNavHistory(window.history.state, entry),
        "",
        pathForSnapshot(entry.snapshot),
      )
      return entry
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

  const abandon = React.useCallback(() => {
    const controller = controllerRef.current
    const traversal = controller.traversal
    if (!traversal) return
    controller.traversal = null
    controller.queued = []
    controller.abandoned = { depth: traversal.depth, seq: traversal.seq }
  }, [])

  const traverse = React.useCallback(
    (steps: number, fromDepth: number) => {
      const controller = controllerRef.current
      const depth = fromDepth - steps
      controller.abandoned = null
      controller.traversal = {
        depth,
        seq: controller.seqAt[depth],
        timer: window.setTimeout(abandon, TRAVERSAL_TIMEOUT_MS),
      }
      window.history.go(-steps)
    },
    [abandon],
  )

  const reconcile = React.useCallback(
    (landed: NavHistoryEntry | null) => {
      const live = liveSnapshot()
      const base = landed?.snapshot ?? ROOT_NAV_SNAPSHOT
      const depth = landed?.depth ?? 0
      const plan = reconcilePlan(base, live)
      if (plan.type === "none") return
      if (plan.type === "restamp") {
        write("replace", depth, live, landed)
        return
      }
      if (plan.type === "push") {
        let from = landed
        for (let step = 1; step <= plan.count; step += 1) {
          const stack = live.stack.slice(0, base.stack.length + step)
          write("push", depth + step, { ...live, stack }, from)
          from = readNavHistory(window.history.state)
        }
        return
      }
      const beneath = landed?.beneath
      if (beneath && snapshotEquals(beneath, live)) {
        traverse(1, depth)
        return
      }
      if (depth === 0 && !isRootSnapshot(live)) {
        write("push", 1, live, landed)
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
    write("replace", 0, ROOT_NAV_SNAPSHOT, null)
    write("push", 1, live, readNavHistory(window.history.state))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: later changes flow through the store subscription and popstate
  }, [])

  React.useEffect(() => {
    const unsub = useNavStore.subscribe((state, prev) => {
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
      const depth = current?.depth ?? 0
      const plan = writePlan(transition, current, live)
      if (plan.type === "none") return
      if (plan.type === "traverse") {
        stampLeftBehindQuery(current, takeNavSnapshot(prev))
        traverse(plan.steps, depth)
        return
      }
      if (plan.type === "push") {
        write("push", depth + 1, live, stampLeftBehindQuery(current, takeNavSnapshot(prev)))
        return
      }
      write("replace", depth, live, current)
    })
    return unsub
  }, [stampLeftBehindQuery, traverse, write])

  React.useEffect(() => {
    const controller = controllerRef.current
    const onPop = (event: PopStateEvent) => {
      const landed = readNavHistory(event.state)
      if (landed) controller.seq = Math.max(controller.seq, landed.seq)
      const traversal = controller.traversal
      const abandoned = controller.abandoned
      controller.abandoned = null
      if (traversal) {
        window.clearTimeout(traversal.timer)
        controller.traversal = null
        if (!landed || isTarget(traversal, landed)) {
          settle(landed)
          return
        }
        controller.queued = []
      } else if (abandoned && landed && isTarget(abandoned, landed)) {
        settle(landed)
        return
      }
      if (landed) {
        drive(() => useNavStore.getState().restore(landed.snapshot))
        return
      }
      drive(() => seedStoreFromPath(window.location.pathname))
      write("replace", 0, liveSnapshot(), null)
    }
    window.addEventListener("popstate", onPop)
    return () => {
      window.removeEventListener("popstate", onPop)
      if (controller.traversal) window.clearTimeout(controller.traversal.timer)
      controller.traversal = null
      controller.abandoned = null
      controller.queued = []
    }
  }, [drive, settle, write])

  // Focus moves to the new panel's heading on route change (WCAG 2.4.3), after a frame so the panel has
  // rendered. The subscriber also fires on search keystrokes (`query` lives in the same store), so it
  // gates on the active entry changing; otherwise typing with a detail panel open would lose focus.
  React.useEffect(() => {
    let prevActive = useNavStore.getState().active
    const unsub = useNavStore.subscribe((state) => {
      const active = state.active
      if (active === prevActive) return
      prevActive = active
      if (typeof window === "undefined") return
      if (active) {
        requestAnimationFrame(() => {
          const target =
            lastFocusable("[data-civfix-panel-heading]") ?? lastFocusable("[data-civfix-page-layer]")
          if (target instanceof HTMLElement) target.focus({ preventScroll: true })
        })
      }
    })
    return unsub
  }, [])
}
