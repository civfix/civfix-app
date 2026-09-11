import type { DetailEntry, View } from "./types"
import { entryIdentity } from "./routes"

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

const PERSISTED_KEYS = [
  "view",
  "id",
  "roomKind",
  "title",
  "lat",
  "lng",
  "reportId",
  "geoid",
  "jumpToMessageId",
  "composerMode",
  "targetPostId",
  "profileTab",
  "slug",
  "seatId",
  "organizationId",
] as const satisfies readonly Exclude<keyof DetailEntry, "kind">[]

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
