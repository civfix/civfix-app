import { create } from "zustand"
import type { DetailEntry, DetailKind, NavState, Snap, View } from "./types"
import { entryIdentity, parentViewForEntry, seedFor } from "./routes"
import { isFlowKind } from "./flowKinds"
import { stackTransition, type NavTransition } from "./navTransition"
import {
  persistableStack,
  type NavReturn,
  type NavSnapshot,
} from "./navSnapshot"

type NavMode = "compact" | "expanded"

const PAGE_SEED_KINDS: ReadonlySet<DetailKind> = new Set<DetailKind>(["cleanup", "pin", "post"])

export interface NavStore extends NavState {
  mode: NavMode
  setMode: (mode: NavMode) => void

  originView: View | null
  seededDetailPage: boolean
  reportReturn: NavReturn | null
  navSeq: number
  lastTransition: NavTransition | null

  selectView: (view: View) => void
  push: (entry: DetailEntry) => void
  openDetail: (entry: DetailEntry) => void
  back: () => void
  collapseToParent: () => void
  reset: () => void
  snapAnimated: boolean
  setSnap: (snap: Snap, animated?: boolean) => void
  setQuery: (query: string) => void
  setStack: (stack: DetailEntry[]) => void
  seed: (entry: DetailEntry | null, mode: NavMode) => void
  navigateTo: (entry: DetailEntry | null, mode: NavMode) => void
  restore: (snapshot: NavSnapshot) => void
  leaveReportFlow: () => void
  finishReportFlow: (next: DetailEntry) => void
  unwindTo: (entry: DetailEntry) => boolean
}

function openIfPeeked(snap: Snap): Snap {
  return snap === 0 ? 1 : snap
}

function lastIndexOfIdentity(stack: readonly DetailEntry[], identity: string): number {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (entryIdentity(stack[i]) === identity) return i
  }
  return -1
}

function mergeEntryParams(existing: DetailEntry, incoming: DetailEntry): DetailEntry {
  const merged: DetailEntry = { ...existing }
  const fields = merged as unknown as Record<string, unknown>
  let changed = false
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || Object.is(fields[key], value)) continue
    fields[key] = value
    changed = true
  }
  return changed ? merged : existing
}

function seedsDetailPage(entry: DetailEntry | null): boolean {
  return entry !== null && entry.kind !== "view" && PAGE_SEED_KINDS.has(entry.kind)
}

function snapForView(view: View, current: Snap): Snap {
  if (view === "map") return 0
  if (view === "home" || view === "messaging" || view === "search" || view === "report") return 2
  return openIfPeeked(current)
}

function reportRunSurvives(view: View): boolean {
  return view === "report" || view === "search"
}

const COLD_REPORT_RETURN: NavReturn = {
  view: "home",
  stack: [],
  originView: null,
  query: "",
  token: 0,
}

function advance(
  s: { navSeq: number },
  patch: Partial<NavStore>,
  transition: NavTransition,
): Partial<NavStore> {
  return { ...patch, navSeq: s.navSeq + 1, lastTransition: transition }
}

function captureReportReturn(s: NavStore): NavReturn {
  return {
    view: s.view,
    stack: persistableStack(s.stack),
    originView: s.stack.length === 0 ? null : s.originView,
    query: s.query,
    token: s.navSeq + 1,
  }
}

function reportReturnForView(s: NavStore, view: View): NavReturn | null {
  if (!reportRunSurvives(view)) return null
  if (reportRunSurvives(s.view)) return s.reportReturn
  return view === "report" ? captureReportReturn(s) : null
}

function stateForReportReturn(s: NavStore, appended: DetailEntry | null): Partial<NavStore> {
  const target = s.reportReturn ?? COLD_REPORT_RETURN
  const stack = appended ? [...target.stack, appended] : target.stack
  const active = stack[stack.length - 1] ?? null
  const viewSnap = snapForView(target.view, s.snap)
  return {
    view: target.view,
    stack,
    active,
    originView: appended
      ? target.stack.length === 0
        ? target.view
        : target.originView
      : stack.length === 0
        ? null
        : target.originView,
    query: target.query,
    snap: active ? openIfPeeked(viewSnap) : viewSnap,
    snapAnimated: true,
    seededDetailPage: false,
    reportReturn: null,
  }
}

export const useNavStore = create<NavStore>((set, get) => ({
  view: "map",
  stack: [],
  active: null,
  snap: 0,
  snapAnimated: true,
  query: "",
  mode: "compact",
  originView: null,
  seededDetailPage: false,
  reportReturn: null,
  navSeq: 0,
  lastTransition: null,

  setMode: (mode) => set({ mode }),

  selectView: (view) =>
    set((s) => {
      if (view === s.view && s.stack.length === 0) {
        if (view === "map") return s
        return advance(
          s,
          {
            view: "home",
            query: "",
            originView: null,
            seededDetailPage: false,
            snapAnimated: true,
            reportReturn: null,
          },
          { type: "select" },
        )
      }
      return advance(
        s,
        {
          view,
          stack: s.stack.length === 0 ? s.stack : [],
          active: null,
          query: "",
          originView: null,
          seededDetailPage: false,
          snap: snapForView(view, s.snap),
          snapAnimated: true,
          reportReturn: reportReturnForView(s, view),
        },
        { type: "select" },
      )
    }),

  push: (entry) => {
    if (entry.kind === "view" && entry.view) {
      get().selectView(entry.view)
      return
    }
    set((s) => {
      const stack = [...s.stack, entry]
      return advance(
        s,
        {
          stack,
          active: entry,
          snap: openIfPeeked(s.snap),
          snapAnimated: true,
          originView: s.stack.length === 0 ? s.view : s.originView,
          seededDetailPage: false,
        },
        { type: "push" },
      )
    })
  },

  openDetail: (entry) => {
    if (entry.kind === "view" && entry.view) {
      get().selectView(entry.view)
      return
    }
    set((s) =>
      advance(
        s,
        {
          stack: [entry],
          active: entry,
          snap: openIfPeeked(s.snap),
          snapAnimated: true,
          originView: s.stack.length === 0 ? s.view : s.originView,
          seededDetailPage: false,
        },
        s.stack.length === 0 ? { type: "push" } : { type: "replace" },
      ),
    )
  },

  back: () =>
    set((s) => {
      if (s.stack.length === 0)
        return { stack: [], active: null, originView: null, seededDetailPage: false }
      const stack = s.stack.slice(0, -1)
      return advance(
        s,
        {
          stack,
          active: stack[stack.length - 1] ?? null,
          originView: stack.length === 0 ? null : s.originView,
          seededDetailPage: stack.length === 0 ? false : s.seededDetailPage,
        },
        { type: "pop", count: 1 },
      )
    }),

  collapseToParent: () =>
    set((s) => {
      if (!s.active) return {}
      if (s.stack.some((entry) => isFlowKind(entry.kind))) return {}
      const parent = s.originView ?? parentViewForEntry(s.active)
      const count = s.stack.length
      return parent
        ? advance(
            s,
            {
              view: parent,
              stack: [],
              active: null,
              query: parent === s.view ? s.query : "",
              originView: null,
              seededDetailPage: false,
              reportReturn: reportRunSurvives(parent) ? s.reportReturn : null,
            },
            { type: "pop", count },
          )
        : advance(
            s,
            { stack: [], active: null, originView: null, seededDetailPage: false },
            { type: "pop", count },
          )
    }),

  reset: () =>
    set((s) =>
      advance(
        s,
        {
          stack: [],
          active: null,
          view: "home",
          snap: 2,
          snapAnimated: true,
          query: "",
          originView: null,
          seededDetailPage: false,
          reportReturn: null,
        },
        { type: "reset" },
      ),
    ),

  setSnap: (snap, animated = true) => set({ snap, snapAnimated: animated }),

  setQuery: (query) => set({ query }),

  setStack: (stack) =>
    set((s) => {
      const patch: Partial<NavStore> = {
        stack,
        active: stack[stack.length - 1] ?? null,
        originView: stack.length === 0 ? null : s.originView,
        seededDetailPage: false,
      }
      const transition = stackTransition(s.stack, stack)
      return transition ? advance(s, patch, transition) : patch
    }),

  seed: (entry, mode) =>
    set((s) => {
      if (!entry)
        return advance(
          s,
          {
            stack: [],
            active: null,
            view: "home",
            snap: snapForView("home", s.snap),
            snapAnimated: true,
            originView: null,
            seededDetailPage: false,
            reportReturn: null,
          },
          { type: "seed" },
        )
      const partial = seedFor(entry, mode, s.view)
      const stack = partial.stack ?? s.stack
      const active = stack[stack.length - 1] ?? null
      const view = partial.view ?? s.view
      const viewSnap = snapForView(view, s.snap)
      return advance(
        s,
        {
          ...partial,
          stack,
          active,
          snap: partial.snap ?? (active ? openIfPeeked(viewSnap) : viewSnap),
          snapAnimated: true,
          originView: null,
          seededDetailPage: seedsDetailPage(active),
          reportReturn: reportRunSurvives(view) ? s.reportReturn : null,
        },
        { type: "seed" },
      )
    }),

  navigateTo: (entry, mode) => {
    const identity = entryIdentity(entry)
    const s = get()
    const index = identity ? lastIndexOfIdentity(s.stack, identity) : -1
    const existing = index === -1 ? null : s.stack[index]
    if (!entry || !existing) {
      get().seed(entry, mode)
      return
    }
    const merged = mergeEntryParams(existing, entry)
    if (merged === existing && index === s.stack.length - 1) {
      const snap = openIfPeeked(s.snap)
      if (snap !== s.snap) set({ snap, snapAnimated: true })
      return
    }
    const stack = [...s.stack.slice(0, index), merged]
    set(
      advance(
        s,
        {
          stack,
          active: merged,
          snap: openIfPeeked(s.snap),
          snapAnimated: true,
          seededDetailPage: index === s.stack.length - 1 && s.seededDetailPage,
        },
        index === s.stack.length - 1
          ? { type: "replace" }
          : { type: "pop", count: s.stack.length - index - 1 },
      ),
    )
  },

  restore: (snapshot) =>
    set((s) => {
      const stack = persistableStack(snapshot.stack)
      const active = stack[stack.length - 1] ?? null
      const viewSnap = snapForView(snapshot.view, s.snap)
      return advance(
        s,
        {
          view: snapshot.view,
          stack,
          active,
          originView: stack.length === 0 ? null : snapshot.originView,
          query: snapshot.query,
          seededDetailPage: snapshot.seededDetailPage,
          reportReturn: snapshot.reportReturn,
          snap: active ? openIfPeeked(viewSnap) : viewSnap,
          snapAnimated: false,
        },
        { type: "restore" },
      )
    }),

  leaveReportFlow: () =>
    set((s) =>
      advance(s, stateForReportReturn(s, null), { type: "pop", count: 1, unwind: "report" }),
    ),

  finishReportFlow: (next) =>
    set((s) =>
      advance(s, stateForReportReturn(s, next), { type: "pop", count: 1, unwind: "report" }),
    ),

  unwindTo: (entry) => {
    const identity = entryIdentity(entry)
    if (!identity) return false
    const s = get()
    const index = lastIndexOfIdentity(s.stack, identity)
    if (index === -1) return false
    if (index === s.stack.length - 1) return true
    const stack = s.stack.slice(0, index + 1)
    set(
      advance(
        s,
        {
          stack,
          active: stack[stack.length - 1] ?? null,
          snap: openIfPeeked(s.snap),
          snapAnimated: true,
          seededDetailPage: false,
        },
        { type: "pop", count: s.stack.length - stack.length },
      ),
    )
    return true
  },
}))
