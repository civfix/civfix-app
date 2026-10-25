import { afterEach, beforeEach, mock, test } from "node:test"
import assert from "node:assert/strict"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"

const STUBS = new URL("../../tests/helpers/nativeStubs.ts", import.meta.url)
const CONSTANTS = new URL("../../tests/helpers/expoConstantsStub.ts", import.meta.url)
installModuleStubs({ "@/lib/mmkv": STUBS, "expo-constants": CONSTANTS })

const { memory, resetStubs } = await import("../../tests/helpers/nativeStubs.ts")
const { STUB_APP_VERSION } = await import("../../tests/helpers/expoConstantsStub.ts")
const { CACHED_USER_KEY } = await import("../lib/mmkvKeys.ts")
const { CACHE_KEY, WRITE_DEBOUNCE_MS, cacheBuster } = await import("./cachePolicy.ts")
const { clearQueryCache, installCachePersistence } = await import("./mmkvPersister.ts")

const NOTIFICATIONS = ["notifications"]
const PROFILE = ["profile", "u1"]

let client: QueryClient
let uninstall: () => void = () => {}
let unsubscribe: () => void = () => {}

beforeEach(() => {
  resetStubs()
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  unsubscribe()
  uninstall()
  client.clear()
  mock.timers.reset()
})

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve()
    mock.timers.tick(0)
  }
}

async function cachedSession() {
  memory.set(CACHED_USER_KEY, JSON.stringify({ id: "u1" }))
  memory.set(
    CACHE_KEY,
    JSON.stringify({
      buster: cacheBuster(STUB_APP_VERSION),
      timestamp: Date.now(),
      userId: "u1",
      clientState: { mutations: [], queries: [] },
    }),
  )
  uninstall = installCachePersistence(client)

  let fetches = 0
  const fetchNotifications = async () => {
    fetches += 1
    return { items: [], fetch: fetches }
  }
  const observer = new QueryObserver(client, { queryKey: NOTIFICATIONS, queryFn: fetchNotifications })
  unsubscribe = observer.subscribe(() => {})
  client.setQueryData(PROFILE, { id: "u1" })
  await settle()
  return { fetches: () => fetches }
}

test("T12: clearing deletes the stored cache, refetches what is observed and drops the rest", async () => {
  const session = await cachedSession()
  assert.equal(session.fetches(), 1)
  assert.ok(memory.has(CACHE_KEY))

  void clearQueryCache(client)

  assert.equal(memory.has(CACHE_KEY), false)
  assert.equal(session.fetches(), 2)
  assert.equal(client.getQueryData(PROFILE), undefined)
})

test("T13: once the refetch lands, the cache is persisted again", async () => {
  const session = await cachedSession()
  const before = memory.get(CACHE_KEY)

  await clearQueryCache(client)
  await settle()
  mock.timers.tick(WRITE_DEBOUNCE_MS)

  const stored = memory.get(CACHE_KEY)
  assert.ok(stored, "the cache is stored again")
  assert.notEqual(stored, before)
  const envelope = JSON.parse(stored) as {
    userId: string
    clientState: { queries: { queryKey: unknown[]; state: { data: unknown } }[] }
  }
  assert.equal(envelope.userId, "u1")
  assert.deepEqual(
    envelope.clientState.queries.map((query) => [query.queryKey, query.state.data]),
    [[NOTIFICATIONS, { items: [], fetch: session.fetches() }]],
  )
})
