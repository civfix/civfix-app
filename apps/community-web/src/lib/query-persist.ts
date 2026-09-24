"use client"

import { dehydrate, hydrate, type QueryClient, type Query } from "@tanstack/react-query"

import { readAuthSnapshot } from "@/lib/auth-snapshot"
import { useAuthStore } from "@/store/auth-store"


const STORAGE_KEY = "civfix.query.cache.v2"
const LEGACY_STORAGE_KEY = "civfix.query.cache.v1"

const BUSTER: string = process.env.NEXT_PUBLIC_APP_VERSION ?? "v1"

const MAX_AGE_MS = 24 * 60 * 60 * 1000

const WRITE_DEBOUNCE_MS = 1000

const SAFELIST: ReadonlySet<string> = new Set([
  "notifications",
  "threads",
  "reports",
  "cleanups",
  "profile",
  "volunteer",
])

type DehydratedState = ReturnType<typeof dehydrate>

interface CacheEnvelope {
  buster: string
  timestamp: number
  userId: string | null
  clientState: DehydratedState
}

function shouldDehydrateQuery(query: Query): boolean {
  if (query.state.status !== "success") return false
  const firstKey = query.queryKey[0]
  return typeof firstKey === "string" && SAFELIST.has(firstKey)
}

function shouldDehydrateMutation(): boolean {
  return false
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function restore(queryClient: QueryClient): void {
  if (!hasStorage()) return

  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return
  }
  if (raw === null) return

  let envelope: CacheEnvelope
  try {
    const parsed = JSON.parse(raw) as unknown
    const userId = (parsed as { userId?: unknown }).userId
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { buster?: unknown }).buster !== "string" ||
      typeof (parsed as { timestamp?: unknown }).timestamp !== "number" ||
      (typeof userId !== "string" && userId !== null) ||
      typeof (parsed as { clientState?: unknown }).clientState !== "object"
    ) {
      clearPersistedCache()
      return
    }
    envelope = parsed as CacheEnvelope
  } catch {
    clearPersistedCache()
    return
  }

  const expired = Date.now() - envelope.timestamp > MAX_AGE_MS
  if (envelope.buster !== BUSTER || expired) {
    clearPersistedCache()
    return
  }

  const snapshotUserId = readAuthSnapshot()?.id ?? null
  if (envelope.userId !== snapshotUserId) {
    clearPersistedCache()
    return
  }

  try {
    hydrate(queryClient, envelope.clientState)
  } catch {
    clearPersistedCache()
  }
}

function persistedViewerId(): string | null | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return undefined
    const userId = (JSON.parse(raw) as { userId?: unknown }).userId
    return typeof userId === "string" ? userId : null
  } catch {
    return undefined
  }
}

/**
 * The viewer the in-memory cache may be stamped for: the confirmed user, null for a confirmed signed-out
 * visitor, or undefined when nothing is confirmed (an optimistic guess, a session check in flight or one
 * that got no answer, which keeps its auth snapshot) and the stored envelope must be left as it is.
 */
function confirmedViewerId(): string | null | undefined {
  const { status, optimistic, user } = useAuthStore.getState()
  if (optimistic) return undefined
  if (status === "authenticated") return user ? user.id : undefined
  if (status === "anonymous" && readAuthSnapshot() === null) return null
  return undefined
}

function persist(queryClient: QueryClient): void {
  if (!hasStorage()) return
  const userId = confirmedViewerId()
  if (userId === undefined) return
  // The viewer just changed: the in-memory cache may still hold the previous viewer's notifications,
  // threads and reports, and stamping it for the new one would restore it for them on the next load.
  const storedViewerId = persistedViewerId()
  if (storedViewerId !== undefined && storedViewerId !== userId) {
    clearPersistedCache()
    return
  }
  try {
    const clientState = dehydrate(queryClient, {
      shouldDehydrateQuery,
      shouldDehydrateMutation,
    })
    if (clientState.queries.length === 0) {
      clearPersistedCache()
      return
    }
    const envelope: CacheEnvelope = {
      buster: BUSTER,
      timestamp: Date.now(),
      userId,
      clientState,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
  } catch {
  }
}

export function restorePersistedCache(queryClient: QueryClient): void {
  if (hasStorage()) {
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
    }
  }
  restore(queryClient)
}

export function installCachePersistenceWriter(queryClient: QueryClient): () => void {
  if (!hasStorage()) {
    return () => {}
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  const scheduleWrite = () => {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      persist(queryClient)
    }, WRITE_DEBOUNCE_MS)
  }

  const unsubscribe = queryClient.getQueryCache().subscribe(scheduleWrite)

  return () => {
    unsubscribe()
    if (timer) {
      clearTimeout(timer)
      timer = null
      persist(queryClient)
    }
  }
}

export function clearPersistedCache(): void {
  if (!hasStorage()) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
  }
}

export function hasPersistedCache(): boolean {
  if (!hasStorage()) return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}
