import type { DehydratedState, Query } from "@tanstack/react-query"

export const CACHE_KEY = "civfix.query.cache.v1"

export const MAX_AGE_MS = 24 * 60 * 60 * 1000

export const WRITE_DEBOUNCE_MS = 1000

export const CACHE_SHAPE_VERSION = "2"

const PERSIST_KEY_PREFIXES: readonly string[] = [
  "notifications",
  "threads",
  "cleanups",
  "cleanup",
  "profile",
  "host",
  "org",
  "orgs",
]

const PERSISTED_REPORTS_SEGMENT = "mine"

const PERSISTED_HOST_SEGMENTS: ReadonlySet<string> = new Set([
  "counters",
  "ticket-types",
  "questions",
])

const PERSIST_PREFIX_SET: ReadonlySet<string> = new Set(PERSIST_KEY_PREFIXES)

export const PERSISTED_QUERY_KEYS: readonly (readonly string[])[] = [
  ...PERSIST_KEY_PREFIXES.map((prefix) => [prefix]),
  ["reports", PERSISTED_REPORTS_SEGMENT],
]

export function cacheBuster(appVersion: string | null | undefined): string {
  return `${appVersion ?? "unknown"}+shape.${CACHE_SHAPE_VERSION}`
}

export function isPersistedQueryKey(queryKey: readonly unknown[]): boolean {
  const [head, second, third] = queryKey
  if (typeof head !== "string") return false
  if (head === "reports") return second === PERSISTED_REPORTS_SEGMENT
  if (head === "host") return typeof third === "string" && PERSISTED_HOST_SEGMENTS.has(third)
  return PERSIST_PREFIX_SET.has(head)
}

export function shouldDehydrateMutation(): boolean {
  return false
}

export function shouldDehydrateQuery(query: Query): boolean {
  if (query.state.status !== "success") return false
  return isPersistedQueryKey(query.queryKey)
}

export interface CacheEnvelope {
  buster: string
  timestamp: number
  userId: string | null
  clientState: DehydratedState
}

export interface RestoreContext {
  buster: string
  now: number
  userId: string | null
}

export type RestoreDecision =
  | { action: "hydrate"; clientState: DehydratedState }
  | { action: "discard" }
  | { action: "skip" }

export function hasCacheOwner(userId: string | null): userId is string {
  return typeof userId === "string" && userId.length > 0
}

export function decideRestore(raw: string | undefined, ctx: RestoreContext): RestoreDecision {
  if (!raw) return { action: "skip" }

  let envelope: CacheEnvelope
  try {
    envelope = JSON.parse(raw) as CacheEnvelope
  } catch {
    return { action: "discard" }
  }

  if (!envelope || typeof envelope !== "object") return { action: "discard" }
  if (envelope.buster !== ctx.buster) return { action: "discard" }
  if (typeof envelope.timestamp !== "number") return { action: "discard" }
  if (ctx.now - envelope.timestamp > MAX_AGE_MS) return { action: "discard" }
  if (!hasCacheOwner(ctx.userId)) return { action: "discard" }
  if (envelope.userId !== ctx.userId) return { action: "discard" }
  if (!envelope.clientState) return { action: "discard" }

  return { action: "hydrate", clientState: envelope.clientState }
}

export interface PersistScheduler {
  schedule: () => void
  suspend: () => void
  resume: () => void
  stop: () => void
}

export interface PersistSchedulerDeps<H> {
  flush: () => void
  setTimer: (fn: () => void, ms: number) => H
  clearTimer: (handle: H) => void
  debounceMs: number
}

export function makePersistScheduler<H>(deps: PersistSchedulerDeps<H>): PersistScheduler {
  let pending: { handle: H } | null = null
  let suspended = false

  const cancel = (): void => {
    if (!pending) return
    deps.clearTimer(pending.handle)
    pending = null
  }

  return {
    schedule: () => {
      if (suspended || pending) return
      pending = {
        handle: deps.setTimer(() => {
          pending = null
          if (suspended) return
          deps.flush()
        }, deps.debounceMs),
      }
    },
    suspend: () => {
      suspended = true
      cancel()
    },
    resume: () => {
      suspended = false
    },
    stop: () => {
      suspended = true
      cancel()
    },
  }
}
