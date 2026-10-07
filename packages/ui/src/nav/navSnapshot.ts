import type { DetailEntry, View } from "./types"
import { ENTRY_IDENTITY_FIELDS, entryIdentity } from "./routes"

export interface NavReturn {
  view: View
  stack: DetailEntry[]
  originView: View | null
  query: string
  token: number
}

export interface NavSnapshot {
  v: 1
  view: View
  stack: DetailEntry[]
  originView: View | null
  query: string
  seededDetailPage: boolean
  reportReturn: NavReturn | null
}

export interface NavSnapshotSource {
  view: View
  stack: readonly DetailEntry[]
  originView: View | null
  query: string
  seededDetailPage: boolean
  reportReturn: NavReturn | null
}

const SESSION_FIELDS = [
  "view",
  "title",
  "lat",
  "lng",
  "reportId",
  "jumpToMessageId",
  "composerMode",
  "targetPostId",
  "profileTab",
  "organizationId",
] as const satisfies readonly Exclude<keyof DetailEntry, "kind">[]

// Identity fields come from the router's own list so a new addressing field
// can never be silently dropped from history and report-return snapshots.
const PERSISTED_KEYS = [...ENTRY_IDENTITY_FIELDS, ...SESSION_FIELDS] as const

export function persistableEntry(entry: DetailEntry): DetailEntry {
  const out: DetailEntry = { kind: entry.kind }
  const source = entry as unknown as Record<string, unknown>
  const target = out as unknown as Record<string, unknown>
  for (const key of PERSISTED_KEYS) {
    const value = source[key]
    if (value !== undefined) target[key] = value
  }
  return out
}

export function persistableStack(stack: readonly DetailEntry[]): DetailEntry[] {
  return stack.filter((entry) => entryIdentity(entry) !== null).map(persistableEntry)
}

export function persistableCount(entries: readonly DetailEntry[]): number {
  return entries.reduce((total, entry) => (entryIdentity(entry) === null ? total : total + 1), 0)
}

export function takeNavSnapshot(state: NavSnapshotSource): NavSnapshot {
  return {
    v: 1,
    view: state.view,
    stack: persistableStack(state.stack),
    originView: state.originView,
    query: state.query,
    seededDetailPage: state.seededDetailPage,
    reportReturn: state.reportReturn,
  }
}

export const ROOT_NAV_SNAPSHOT: NavSnapshot = {
  v: 1,
  view: "home",
  stack: [],
  originView: null,
  query: "",
  seededDetailPage: false,
  reportReturn: null,
}
