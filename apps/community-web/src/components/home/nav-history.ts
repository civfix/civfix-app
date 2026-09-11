import {
  entryIdentity,
  pathForEntry,
  pathForView,
  type DetailEntry,
  type DetailKind,
  type NavSnapshot,
  type NavTransition,
  type View,
} from "@civfix/ui/nav"

export interface NavHistoryEntry {
  v: 1
  seq: number
  depth: number
  returnDepth?: number
  returnToken?: number
  snapshot: NavSnapshot
}

const LIST_KIND_FOR_VIEW: Partial<Record<View, DetailKind>> = {
  events: "cleanups",
  messaging: "messages",
  social: "people",
  reports: "myreports",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isSnapshot(value: unknown): value is NavSnapshot {
  if (!isRecord(value)) return false
  return (
    value.v === 1 &&
    typeof value.view === "string" &&
    Array.isArray(value.stack) &&
    typeof value.query === "string" &&
    typeof value.seededDetailPage === "boolean"
  )
}

export function readNavHistory(state: unknown): NavHistoryEntry | null {
  if (!isRecord(state)) return null
  const nav = state.civfixNav
  if (!isRecord(nav)) return null
  if (nav.v !== 1) return null
  if (typeof nav.seq !== "number" || typeof nav.depth !== "number") return null
  if (!isSnapshot(nav.snapshot)) return null
  return nav as unknown as NavHistoryEntry
}

export function stampNavHistory(
  prevState: unknown,
  entry: NavHistoryEntry,
): Record<string, unknown> {
  const base = isRecord(prevState) ? { ...prevState } : {}
  base.civfixNav = entry
  return base
}

function stackIdentities(stack: readonly DetailEntry[]): string[] {
  return stack.map((entry, index) => entryIdentity(entry) ?? `~${entry.kind}@${index}`)
}

function sameIdentities(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((identity, index) => identity === b[index])
}

export function snapshotEquals(a: NavSnapshot, b: NavSnapshot): boolean {
  if (a.view !== b.view) return false
  if (a.query !== b.query) return false
  return sameIdentities(stackIdentities(a.stack), stackIdentities(b.stack))
}

export type ReconcilePlan = { type: "none" } | { type: "push" } | { type: "replace" }

export function reconcilePlan(landed: NavSnapshot, live: NavSnapshot): ReconcilePlan {
  if (snapshotEquals(landed, live)) return { type: "none" }
  if (landed.view !== live.view) return { type: "replace" }
  const landedIds = stackIdentities(landed.stack)
  const liveIds = stackIdentities(live.stack)
  if (liveIds.length === landedIds.length + 1 && sameIdentities(landedIds, liveIds.slice(0, -1)))
    return { type: "push" }
  return { type: "replace" }
}

export function traversalFor(
  transition: NavTransition | null,
  current: NavHistoryEntry | null,
): number {
  if (!transition || transition.type !== "pop") return 0
  const depth = current?.depth ?? 0
  if (depth <= 0) return 0
  if (transition.unwind === "report") {
    const returnDepth = current?.returnDepth
    if (returnDepth === undefined) return 1
    return Math.min(Math.max(depth - returnDepth, 1), depth)
  }
  return Math.min(transition.count, depth)
}

export function pathForSnapshot(snapshot: NavSnapshot): string {
  const active = snapshot.stack[snapshot.stack.length - 1]
  if (active && active.kind !== "drop-pin") return pathForEntry(active)
  const viewPath = pathForView(snapshot.view)
  if (viewPath) return viewPath
  const listKind = LIST_KIND_FOR_VIEW[snapshot.view]
  return listKind ? pathForEntry({ kind: listKind }) : "/"
}
