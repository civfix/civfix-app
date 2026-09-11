import type { DetailEntry } from "./types"
import { entryIdentity } from "./routes"

export type NavTransition =
  | { type: "push" }
  | { type: "select" }
  | { type: "reset" }
  | { type: "seed" }
  | { type: "restore" }
  | { type: "replace" }
  | { type: "pop"; count: number; unwind?: "report" }

function identityOf(entry: DetailEntry | undefined): string {
  if (!entry) return ""
  return entryIdentity(entry) ?? `~${entry.kind}`
}

function commonPrefixLength(a: readonly DetailEntry[], b: readonly DetailEntry[]): number {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && identityOf(a[i]) === identityOf(b[i])) i += 1
  return i
}

export function stackTransition(
  prev: readonly DetailEntry[],
  next: readonly DetailEntry[],
): NavTransition | null {
  const common = commonPrefixLength(prev, next)
  if (common === prev.length && common === next.length) return null
  if (common === next.length) return { type: "pop", count: prev.length - next.length }
  if (common === prev.length) return { type: "push" }
  return { type: "replace" }
}
