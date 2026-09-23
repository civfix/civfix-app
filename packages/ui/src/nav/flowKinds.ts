import type { DetailEntry } from "./types"

type EntryKind = DetailEntry["kind"]

export const FLOW_KINDS: ReadonlySet<EntryKind> = new Set<EntryKind>([
  "create-cleanup",
  "edit-cleanup",
  "composer",
  "host-announce",
])

export function isFlowKind(kind: EntryKind): boolean {
  return FLOW_KINDS.has(kind)
}
