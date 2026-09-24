import {
  ALL_DETAIL_KINDS,
  ALL_VIEWS,
  entryFromPlatformPath,
  entryIdentity,
  pathForEntry,
  pathForView,
  platformPathForEntry,
  type DetailEntry,
  type DetailKind,
  type NavReturn,
  type NavSnapshot,
  type NavTransition,
  type View,
} from "@civfix/ui/nav"

export interface NavHistoryEntry {
  v: 2
  seq: number
  depth: number
  returnDepth?: number
  returnToken?: number
  beneath: NavSnapshot | null
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

const ENTRY_KINDS: ReadonlySet<string> = new Set<string>([...ALL_DETAIL_KINDS, "view"])
const VIEWS: ReadonlySet<string> = new Set<string>(ALL_VIEWS)

function isEntry(value: unknown): value is DetailEntry {
  return isRecord(value) && typeof value.kind === "string" && ENTRY_KINDS.has(value.kind)
}

function isView(value: unknown): value is View {
  return typeof value === "string" && VIEWS.has(value)
}

function isViewOrNull(value: unknown): value is View | null {
  return value === null || isView(value)
}

function isEntryList(value: unknown): value is DetailEntry[] {
  return Array.isArray(value) && value.every(isEntry)
}

function isReturn(value: unknown): value is NavReturn {
  if (!isRecord(value)) return false
  return (
    isView(value.view) &&
    isEntryList(value.stack) &&
    isViewOrNull(value.originView) &&
    typeof value.query === "string" &&
    typeof value.token === "number"
  )
}

function isSnapshot(value: unknown): value is NavSnapshot {
  if (!isRecord(value)) return false
  return (
    value.v === 1 &&
    isView(value.view) &&
    isEntryList(value.stack) &&
    isViewOrNull(value.originView) &&
    typeof value.query === "string" &&
    typeof value.seededDetailPage === "boolean" &&
    (value.reportReturn === null || isReturn(value.reportReturn))
  )
}

export function readNavHistory(state: unknown): NavHistoryEntry | null {
  if (!isRecord(state)) return null
  const nav = state.civfixNav
  if (!isRecord(nav)) return null
  if (nav.v !== 2) return null
  if (typeof nav.seq !== "number" || typeof nav.depth !== "number") return null
  if (nav.beneath !== null && !isSnapshot(nav.beneath)) return null
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
  return sameIdentities(stackIdentities(a.stack), stackIdentities(b.stack))
}

export type ReconcilePlan =
  | { type: "none" }
  | { type: "restamp" }
  | { type: "push"; count: number }
  | { type: "replace" }

function samePlacePlan(
  a: NavSnapshot,
  b: NavSnapshot,
): { type: "none" } | { type: "restamp" } | null {
  if (!snapshotEquals(a, b)) return null
  return a.query === b.query ? { type: "none" } : { type: "restamp" }
}

export function reconcilePlan(landed: NavSnapshot, live: NavSnapshot): ReconcilePlan {
  const samePlace = samePlacePlan(landed, live)
  if (samePlace) return samePlace
  if (landed.view !== live.view) return { type: "replace" }
  const landedIds = stackIdentities(landed.stack)
  const liveIds = stackIdentities(live.stack)
  if (liveIds.length > landedIds.length && sameIdentities(landedIds, liveIds.slice(0, landedIds.length)))
    return { type: "push", count: liveIds.length - landedIds.length }
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

export type WritePlan =
  | { type: "none" }
  | { type: "restamp" }
  | { type: "push" }
  | { type: "replace" }
  | { type: "traverse"; steps: number }

function consumesCurrentEntry(transition: NavTransition): boolean {
  if (transition.type === "replace") return true
  return transition.type === "select" && transition.consumes === true
}

export function writePlan(
  transition: NavTransition,
  current: NavHistoryEntry | null,
  live: NavSnapshot,
): WritePlan {
  const samePlace = current ? samePlacePlan(current.snapshot, live) : null
  if (samePlace) return samePlace
  if (transition.type === "pop") {
    const steps = traversalFor(transition, current)
    return steps === 0 ? { type: "replace" } : { type: "traverse", steps }
  }
  const beneath = current?.beneath
  if (beneath && snapshotEquals(beneath, live)) return { type: "traverse", steps: 1 }
  if (consumesCurrentEntry(transition)) return { type: "replace" }
  return { type: "push" }
}

function exportPath(path: string): string {
  return path.endsWith("/") ? path : `${path}/`
}

export function entryFromWebPath(path: string | null | undefined): DetailEntry | null {
  return entryFromPlatformPath(path, "web")
}

export function pathForSnapshot(snapshot: NavSnapshot): string {
  const active = snapshot.stack[snapshot.stack.length - 1]
  if (active && active.kind !== "drop-pin") return exportPath(platformPathForEntry(active, "web"))
  const viewPath = pathForView(snapshot.view)
  if (viewPath) return exportPath(viewPath)
  const listKind = LIST_KIND_FOR_VIEW[snapshot.view]
  return listKind ? exportPath(pathForEntry({ kind: listKind })) : "/"
}
