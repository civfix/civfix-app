import { create } from "zustand"
import type { DetailEntry, DetailKind, NavState, Snap, View } from "./types"
import { entryIdentity, parentViewForEntry, seedFor } from "./routes"
import { isFlowKind } from "./flowKinds"

type NavMode = "compact" | "expanded"

const PAGE_SEED_KINDS: ReadonlySet<DetailKind> = new Set<DetailKind>(["cleanup", "pin", "post"])

export interface NavStore extends NavState {
  mode: NavMode
  setMode: (mode: NavMode) => void

  originView: View | null
  seededDetailPage: boolean

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

  setMode: (mode) => set({ mode }),

  selectView: (view) =>
    set((s) => {
      if (view === s.view && s.stack.length === 0) {
        if (view === "map") return s
        return {
          view: "home",
          query: "",
          originView: null,
          seededDetailPage: false,
          snapAnimated: true,
        }
      }
      return {
        view,
        stack: s.stack.length === 0 ? s.stack : [],
        active: null,
        query: "",
        originView: null,
        seededDetailPage: false,
        snap: snapForView(view, s.snap),
        snapAnimated: true,
      }
    }),

  push: (entry) => {
    if (entry.kind === "view" && entry.view) {
      get().selectView(entry.view)
      return
    }
    set((s) => {
      const stack = [...s.stack, entry]
      return {
        stack,
        active: entry,
        snap: openIfPeeked(s.snap),
        snapAnimated: true,
        originView: s.stack.length === 0 ? s.view : s.originView,
        seededDetailPage: false,
      }
    })
  },

  openDetail: (entry) => {
    if (entry.kind === "view" && entry.view) {
      get().selectView(entry.view)
      return
    }
    set((s) => ({
      stack: [entry],
      active: entry,
      snap: openIfPeeked(s.snap),
      snapAnimated: true,
      originView: s.stack.length === 0 ? s.view : s.originView,
      seededDetailPage: false,
    }))
  },

  back: () =>
    set((s) => {
      if (s.stack.length === 0)
        return { stack: [], active: null, originView: null, seededDetailPage: false }
      const stack = s.stack.slice(0, -1)
      return {
        stack,
        active: stack[stack.length - 1] ?? null,
        originView: stack.length === 0 ? null : s.originView,
        seededDetailPage: stack.length === 0 ? false : s.seededDetailPage,
      }
    }),

  collapseToParent: () =>
    set((s) => {
      if (!s.active) return {}
      if (s.stack.some((entry) => isFlowKind(entry.kind))) return {}
      const parent = s.originView ?? parentViewForEntry(s.active)
      return parent
        ? {
            view: parent,
            stack: [],
            active: null,
            query: parent === s.view ? s.query : "",
            originView: null,
            seededDetailPage: false,
          }
        : { stack: [], active: null, originView: null, seededDetailPage: false }
    }),

  reset: () =>
    set({
      stack: [],
      active: null,
      view: "home",
      snap: 2,
      snapAnimated: true,
      query: "",
      originView: null,
      seededDetailPage: false,
    }),

  setSnap: (snap, animated = true) => set({ snap, snapAnimated: animated }),

  setQuery: (query) => set({ query }),

  setStack: (stack) =>
    set((s) => ({
      stack,
      active: stack[stack.length - 1] ?? null,
      originView: stack.length === 0 ? null : s.originView,
      seededDetailPage: false,
    })),

  seed: (entry, mode) =>
    set((s) => {
      if (!entry)
        return {
          stack: [],
          active: null,
          view: "home",
          snap: snapForView("home", s.snap),
          snapAnimated: true,
          originView: null,
          seededDetailPage: false,
        }
      const partial = seedFor(entry, mode, s.view)
      const stack = partial.stack ?? s.stack
      const active = stack[stack.length - 1] ?? null
      const view = partial.view ?? s.view
      const viewSnap = snapForView(view, s.snap)
      return {
        ...partial,
        stack,
        active,
        snap: partial.snap ?? (active ? openIfPeeked(viewSnap) : viewSnap),
        snapAnimated: true,
        originView: null,
        seededDetailPage: seedsDetailPage(active),
      }
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
    set({
      stack: [...s.stack.slice(0, index), merged],
      active: merged,
      snap: openIfPeeked(s.snap),
      snapAnimated: true,
      seededDetailPage: index === s.stack.length - 1 && s.seededDetailPage,
    })
  },
}))
