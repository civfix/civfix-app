import { dehydrate, hydrate } from "@tanstack/react-query"
import type { QueryClient, QueryKey } from "@tanstack/react-query"
import Constants from "expo-constants"
import { storage } from "@/lib/mmkv"
import { CACHED_USER_KEY } from "@/lib/mmkvKeys"
import {
  CACHE_KEY,
  WRITE_DEBOUNCE_MS,
  cacheBuster,
  decideRestore,
  hasCacheOwner,
  isPersistedQueryKey,
  makePersistScheduler,
  shouldDehydrateMutation,
  shouldDehydrateQuery,
  type CacheEnvelope,
  type PersistScheduler,
} from "@/query/cachePolicy"

const BUSTER: string = cacheBuster(Constants.expoConfig?.version)

let scheduler: PersistScheduler | null = null

function readCachedUserId(): string | null {
  try {
    const raw = storage.getString(CACHED_USER_KEY)
    if (!raw) return null
    const user = JSON.parse(raw) as { id?: unknown }
    return typeof user.id === "string" ? user.id : null
  } catch {
    return null
  }
}

function deleteCache(): void {
  try {
    storage.delete(CACHE_KEY)
  } catch {
    return
  }
}

export function installCachePersistence(queryClient: QueryClient): () => void {
  restoreCache(queryClient)

  const flush = (): void => {
    const userId = readCachedUserId()
    if (!hasCacheOwner(userId)) {
      deleteCache()
      return
    }
    try {
      const envelope: CacheEnvelope = {
        buster: BUSTER,
        timestamp: Date.now(),
        userId,
        clientState: dehydrate(queryClient, { shouldDehydrateQuery, shouldDehydrateMutation }),
      }
      storage.set(CACHE_KEY, JSON.stringify(envelope))
    } catch {
      return
    }
  }

  const active = makePersistScheduler({
    flush,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle),
    debounceMs: WRITE_DEBOUNCE_MS,
  })
  scheduler = active

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "added" && event.type !== "updated" && event.type !== "removed") return
    if (!isPersistedQueryKey(event.query.queryKey as QueryKey)) return
    active.schedule()
  })

  return () => {
    active.stop()
    if (scheduler === active) scheduler = null
    unsubscribe()
  }
}

function restoreCache(queryClient: QueryClient): void {
  let raw: string | undefined
  try {
    raw = storage.getString(CACHE_KEY)
  } catch {
    return
  }

  const decision = decideRestore(raw, {
    buster: BUSTER,
    now: Date.now(),
    userId: readCachedUserId(),
  })
  if (decision.action === "skip") return
  if (decision.action === "discard") {
    deleteCache()
    return
  }

  try {
    hydrate(queryClient, decision.clientState)
  } catch {
    deleteCache()
  }
}

export function clearPersistedCache(): void {
  scheduler?.suspend()
  deleteCache()
}

export function resumeCachePersistence(): void {
  scheduler?.resume()
}

export function purgeQueryCache(client: QueryClient): void {
  clearPersistedCache()
  client.clear()
  resumeCachePersistence()
}
