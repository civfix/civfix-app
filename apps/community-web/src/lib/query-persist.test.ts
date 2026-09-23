import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { UserDTO } from "@civfix/shared"

import {
  restorePersistedCache,
  installCachePersistenceWriter,
  clearPersistedCache,
  hasPersistedCache,
} from "@/lib/query-persist"
import { writeAuthSnapshot } from "@/lib/auth-snapshot"
import { useAuthStore } from "@/store/auth-store"

/**
 * The persisted query cache lets a warm reload repaint instantly from localStorage and revalidate
 * silently. These tests run in the node env (no jsdom / no real localStorage), so we stub `window` with
 * a Map-backed fake storage (as auth-snapshot.test.ts does) and assert:
 *  - a round-trip: a success query on the safelist is persisted and restored into a fresh client;
 *  - the safelist EXCLUDES volatile/sensitive queries (map, chat, search, session);
 *  - a buster mismatch and a max-age expiry both discard (and remove) the persisted entry on restore;
 *  - an empty cache on persist REMOVES the key rather than writing an empty envelope (fail-closed);
 *  - user scoping is fail-closed: only a server-confirmed viewer is ever persisted, and restore hydrates
 *    only when the envelope user id matches the optimistic auth snapshot, discarding (and removing) a
 *    different id or a signed-out (null) envelope;
 *  - every path is a no-op when `window` is absent (the static-export build has no window).
 *
 * `shouldDehydrateQuery` is exercised through the public writer rather than imported directly, so the
 * test pins observable behavior, not a private function.
 */

/**
 * Boot a client the way Providers does: restore synchronously, then subscribe the debounced writer
 * (the two halves are separate exports so the writer can be re-subscribed from an effect on remount).
 * Returns the writer's teardown.
 */
function installCachePersistence(queryClient: QueryClient): () => void {
  restorePersistedCache(queryClient)
  return installCachePersistenceWriter(queryClient)
}

// Must mirror the live STORAGE_KEY in query-persist.ts. The writer was bumped to v2 (commit 9cc8f26,
// "discard pre-unification cache") but this test was not updated, so it asserted against the stale v1
// key and never observed the writer's output. Keep this in lockstep with the source key.
const STORAGE_KEY = "civfix.query.cache.v2"

/** A valid UserDTO for stamping the persist user / the optimistic snapshot (mirrors auth-snapshot.test). */
const USER: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada Lovelace",
  handle: "ada",
  role: "citizen",
  locale: "en",
  profileComplete: true,
  createdAt: "2026-01-01T00:00:00.000Z",
}

/** Minimal Storage stand-in backed by a Map (the subset query-persist touches). */
function makeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string): string | null => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string): void => {
      map.set(key, value)
    },
    removeItem: (key: string): void => {
      map.delete(key)
    },
    map,
  }
}

let storage: ReturnType<typeof makeStorage>

beforeEach(() => {
  storage = makeStorage()
  vi.stubGlobal("window", { localStorage: storage })
  // The persist writer only writes for a confirmed session and stamps it with that user. Start each test
  // signed out; a test that needs a persisted envelope signs in explicitly.
  useAuthStore.getState().clear()
})

afterEach(() => {
  // Sign out so a session set during a test cannot bleed into the next one's persist stamp.
  useAuthStore.getState().clear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** The persisted envelope shape (for asserting buster/timestamp/userId without re-importing internals). */
interface Envelope {
  buster: string
  timestamp: number
  userId: string | null
  clientState: { queries: Array<{ queryKey: unknown[] }> }
}

function readEnvelope(): Envelope {
  const raw = storage.map.get(STORAGE_KEY)
  if (!raw) throw new Error("no persisted envelope")
  return JSON.parse(raw) as Envelope
}

describe("installCachePersistence writer", () => {
  beforeEach(() => {
    useAuthStore.getState().setSession({ user: USER })
  })

  it("persists only safelisted success queries and excludes map/chat/search/session", () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    // Safelisted (should persist):
    qc.setQueryData(["notifications", 20], { items: [1] })
    qc.setQueryData(["threads"], { items: [] })
    qc.setQueryData(["reports", "mine", 3], { items: [] })
    qc.setQueryData(["cleanups", "upcoming"], { items: [] })
    qc.setQueryData(["profile", "me"], { id: "x" })
    // Excluded (volatile / large / sensitive):
    qc.setQueryData(["map", "reports", "bbox", []], { pins: [] })
    qc.setQueryData(["chat", "cleanup", "room"], { pages: [] })
    qc.setQueryData(["users", "search", "q"], { items: [] })
    qc.setQueryData(["session"], { authenticated: true })

    const teardown = installCachePersistence(qc)
    // A cache mutation schedules the debounced write; advance past the debounce window.
    qc.setQueryData(["notifications", 20], { items: [1, 2] })
    vi.advanceTimersByTime(1000)

    const persistedKeys = readEnvelope().clientState.queries.map((q) => JSON.stringify(q.queryKey))
    expect(persistedKeys).toContain(JSON.stringify(["notifications", 20]))
    expect(persistedKeys).toContain(JSON.stringify(["threads"]))
    expect(persistedKeys).toContain(JSON.stringify(["reports", "mine", 3]))
    expect(persistedKeys).toContain(JSON.stringify(["cleanups", "upcoming"]))
    expect(persistedKeys).toContain(JSON.stringify(["profile", "me"]))
    // Excluded keys must be absent.
    expect(persistedKeys.some((k) => k.startsWith('["map"'))).toBe(false)
    expect(persistedKeys.some((k) => k.startsWith('["chat"'))).toBe(false)
    expect(persistedKeys.some((k) => k.startsWith('["users"'))).toBe(false)
    expect(persistedKeys).not.toContain(JSON.stringify(["session"]))

    teardown()
  })

  it("persists the volunteer family but NEVER the certificate list (it carries presigned urls)", () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    // The whole service-hours family is keyed ["volunteer", ...] by the shared key factory, so the
    // single "volunteer" safelist entry covers the summary, the paged ledger, a public profile's
    // ledger, the leaderboard and an event's logged hours.
    qc.setQueryData(["volunteer", "me"], { totalHours: 12 })
    qc.setQueryData(["volunteer", "entries"], { pages: [] })
    qc.setQueryData(["volunteer", "leaderboard", "0644000", 50], { entries: [] })
    // ...but NOT the certificate list. Each ServiceHoursCertificateDTO carries a PRESIGNED url with a
    // 15-minute TTL; the persister's max age is 24h, so persisting this would leave live capability
    // URLs in localStorage for ~96x their intended lifetime. It is keyed off the safelist on purpose.
    qc.setQueryData(["certificates", "mine"], [
      {
        code: "A1B2C3D4E5F6",
        status: "valid",
        url: "https://r2.example.com/certificates/service-hours/2026/07/x.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeefdeadbeef",
      },
    ])

    const teardown = installCachePersistence(qc)
    qc.setQueryData(["volunteer", "me"], { totalHours: 13 })
    vi.advanceTimersByTime(1000)

    const persistedKeys = readEnvelope().clientState.queries.map((q) => JSON.stringify(q.queryKey))
    expect(persistedKeys).toContain(JSON.stringify(["volunteer", "me"]))
    expect(persistedKeys).toContain(JSON.stringify(["volunteer", "entries"]))
    expect(persistedKeys).toContain(JSON.stringify(["volunteer", "leaderboard", "0644000", 50]))
    expect(persistedKeys.some((k) => k.startsWith('["certificates"'))).toBe(false)

    // Belt and braces: whatever else ends up on the safelist, no presigned capability URL may ever
    // reach localStorage. This asserts against the raw serialized envelope, not the key list.
    expect(storage.map.get(STORAGE_KEY)).not.toContain("X-Amz-Signature")

    teardown()
  })

  it("round-trips: a fresh client restores the persisted safelisted query on install", () => {
    vi.useFakeTimers()
    const writer = new QueryClient()
    writer.setQueryData(["notifications", 20], { items: ["a", "b"] })
    const teardown = installCachePersistence(writer)
    writer.setQueryData(["notifications", 20], { items: ["a", "b", "c"] })
    vi.advanceTimersByTime(1000)
    teardown()

    // A brand-new client hydrates the persisted state synchronously on install.
    const reader = new QueryClient()
    const teardown2 = installCachePersistence(reader)
    expect(reader.getQueryData(["notifications", 20])).toEqual({ items: ["a", "b", "c"] })
    teardown2()
  })

  it("removes the key (does not write an empty envelope) when there is nothing to persist", () => {
    vi.useFakeTimers()
    // Seed a real persisted entry first, so there IS a key to clobber.
    const writer = new QueryClient()
    writer.setQueryData(["notifications", 20], { items: [1] })
    const teardown = installCachePersistence(writer)
    writer.setQueryData(["notifications", 20], { items: [1, 2] })
    vi.advanceTimersByTime(1000)
    expect(storage.map.has(STORAGE_KEY)).toBe(true)

    // Now clear the cache (the logout/user-switch shape: removed events schedule a debounced write that
    // fires ~1s later against an empty cache). The pending write must REMOVE the key, not re-create it
    // with an empty envelope (which a later restore would treat as a real warm cache).
    writer.clear()
    vi.advanceTimersByTime(1000)
    expect(storage.map.has(STORAGE_KEY)).toBe(false)

    teardown()
    // Teardown flushes nothing (no pending timer) and must not resurrect the key.
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
  })
})

describe("installCachePersistence restore guards", () => {
  it("discards (and removes) a persisted entry whose buster does not match", () => {
    // Hand-write an envelope with a foreign buster (userId matches the signed-out snapshot so the buster
    // check, not the user-scope check, is what discards it).
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        buster: "some-other-version",
        timestamp: Date.now(),
        userId: null,
        clientState: { queries: [{ queryKey: ["notifications", 20], state: {} }] },
      }),
    )

    const qc = new QueryClient()
    const teardown = installCachePersistence(qc)
    expect(qc.getQueryData(["notifications", 20])).toBeUndefined()
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
    teardown()
  })

  it("discards (and removes) a persisted entry older than the max age", () => {
    const dayMs = 24 * 60 * 60 * 1000
    // Build a valid round-trip envelope, then back-date its timestamp beyond the 24h window.
    vi.useFakeTimers()
    useAuthStore.getState().setSession({ user: USER })
    const writer = new QueryClient()
    writer.setQueryData(["notifications", 20], { items: [1] })
    const tw = installCachePersistence(writer)
    writer.setQueryData(["notifications", 20], { items: [1, 2] })
    vi.advanceTimersByTime(1000)
    tw()
    vi.useRealTimers()

    const envelope = JSON.parse(storage.map.get(STORAGE_KEY)!) as Envelope
    envelope.timestamp = Date.now() - (dayMs + 60_000)
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope))

    const reader = new QueryClient()
    const tr = installCachePersistence(reader)
    expect(reader.getQueryData(["notifications", 20])).toBeUndefined()
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
    tr()
  })

  it("ignores a corrupt envelope without throwing and clears the key", () => {
    storage.setItem(STORAGE_KEY, "{ not json")
    const qc = new QueryClient()
    expect(() => installCachePersistence(qc)()).not.toThrow()
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
  })

  /**
   * Build a valid persisted envelope stamped with USER.id by signing in as USER and letting the writer
   * stamp the cache (and the optimistic snapshot). Returns with the store signed out again so the caller
   * controls the snapshot identity restore() will compare against.
   */
  function writeEnvelopeForUser(): void {
    vi.useFakeTimers()
    useAuthStore.getState().setSession({ user: USER })
    const writer = new QueryClient()
    writer.setQueryData(["notifications", 20], { items: [1] })
    const tw = installCachePersistence(writer)
    writer.setQueryData(["notifications", 20], { items: [1, 2] })
    vi.advanceTimersByTime(1000)
    tw()
    vi.useRealTimers()
    useAuthStore.getState().clear()
  }

  it("hydrates when the envelope userId matches the optimistic auth snapshot", () => {
    writeEnvelopeForUser()
    expect((JSON.parse(storage.map.get(STORAGE_KEY)!) as Envelope).userId).toBe(USER.id)
    // The snapshot must record the SAME user restore() compares against.
    writeAuthSnapshot(USER)

    const reader = new QueryClient()
    const tr = installCachePersistence(reader)
    expect(reader.getQueryData(["notifications", 20])).toEqual({ items: [1, 2] })
    expect(storage.map.has(STORAGE_KEY)).toBe(true)
    tr()
  })

  it("discards (and removes) when the envelope userId differs from the snapshot user (user switch)", () => {
    writeEnvelopeForUser()
    // A DIFFERENT user is signed in on this browser now (their snapshot, USER's cache): fail closed.
    const otherUser: UserDTO = { ...USER, id: "22222222-2222-4222-8222-222222222222" }
    writeAuthSnapshot(otherUser)

    const reader = new QueryClient()
    const tr = installCachePersistence(reader)
    expect(reader.getQueryData(["notifications", 20])).toBeUndefined()
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
    tr()
  })

  it("discards (and removes) when the envelope userId is null but a snapshot user is present", () => {
    // Only an older build wrote a signed-out (userId:null) envelope; the writer no longer does.
    writeEnvelopeForUser()
    const envelope = JSON.parse(storage.map.get(STORAGE_KEY)!) as Envelope
    envelope.userId = null
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope))

    // ...but a user is signed in by boot time (snapshot present): null-vs-present is a mismatch.
    writeAuthSnapshot(USER)

    const reader = new QueryClient()
    const tr = installCachePersistence(reader)
    expect(reader.getQueryData(["notifications", 20])).toBeUndefined()
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
    tr()
  })
})

describe("installCachePersistence only persists a server-confirmed viewer", () => {
  function seedSignedInEnvelope(qc: QueryClient): () => void {
    vi.useFakeTimers()
    useAuthStore.getState().setSession({ user: USER })
    qc.setQueryData(["notifications", 20], { items: ["private"] })
    const teardown = installCachePersistence(qc)
    qc.setQueryData(["volunteer", "me"], { totalHours: 12 })
    vi.advanceTimersByTime(1000)
    expect(readEnvelope().userId).toBe(USER.id)
    return teardown
  }

  it("persists nothing while signed out", () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    qc.setQueryData(["cleanups", "upcoming"], { items: [] })
    const teardown = installCachePersistence(qc)
    qc.setQueryData(["reports", "mine", 3], { items: [] })
    vi.advanceTimersByTime(1000)
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
    teardown()
  })

  it("drops the persisted cache when the session is lost instead of re-stamping it for nobody", () => {
    const qc = new QueryClient()
    const teardown = seedSignedInEnvelope(qc)

    // The 401 path: auth is cleared while the in-memory cache still holds the previous viewer's data.
    useAuthStore.getState().clear()
    qc.setQueryData(["notifications", 20], { items: ["private", "newer"] })
    vi.advanceTimersByTime(1000)
    expect(storage.map.has(STORAGE_KEY)).toBe(false)

    teardown()
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
  })

  it("leaves the stored envelope alone while the session is only an optimistic guess", () => {
    const qc = new QueryClient()
    const teardown = seedSignedInEnvelope(qc)
    const before = storage.map.get(STORAGE_KEY)

    useAuthStore.setState({ optimistic: true })
    qc.setQueryData(["notifications", 20], { items: ["unconfirmed"] })
    vi.advanceTimersByTime(1000)
    expect(storage.map.get(STORAGE_KEY)).toBe(before)
    teardown()
  })

  it("never restores a signed-out (userId:null) envelope, even for a signed-out visitor", () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        buster: "v1",
        timestamp: Date.now(),
        userId: null,
        clientState: { mutations: [], queries: [] },
      }),
    )
    const qc = new QueryClient()
    const teardown = installCachePersistence(qc)
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
    teardown()
  })
})

describe("hasPersistedCache / clearPersistedCache", () => {
  it("reports presence and clears the persisted entry", () => {
    expect(hasPersistedCache()).toBe(false)
    storage.setItem(STORAGE_KEY, JSON.stringify({ buster: "v1", timestamp: Date.now(), clientState: {} }))
    expect(hasPersistedCache()).toBe(true)
    clearPersistedCache()
    expect(hasPersistedCache()).toBe(false)
    expect(storage.map.has(STORAGE_KEY)).toBe(false)
  })
})

describe("query-persist is SSR-safe (no window)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", undefined)
  })

  it("install is a no-op, hasPersistedCache is false, and clear does not throw", () => {
    const qc = new QueryClient()
    const teardown = installCachePersistence(qc)
    expect(typeof teardown).toBe("function")
    expect(() => teardown()).not.toThrow()
    expect(hasPersistedCache()).toBe(false)
    expect(() => clearPersistedCache()).not.toThrow()
  })
})
