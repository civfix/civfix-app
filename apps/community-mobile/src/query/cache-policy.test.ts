import { test } from "node:test"
import assert from "node:assert/strict"
import {
  CACHE_SHAPE_VERSION,
  MAX_AGE_MS,
  cacheBuster,
  decideRestore,
  hasCacheOwner,
  isPersistedQueryKey,
  makePersistScheduler,
  shouldDehydrateMutation,
  type CacheEnvelope,
} from "./cache-policy.ts"

const BUSTER = cacheBuster("1.1.0")

function envelope(overrides: Partial<CacheEnvelope> = {}): string {
  const base: CacheEnvelope = {
    buster: BUSTER,
    timestamp: 1_000_000,
    userId: "user-a",
    clientState: { mutations: [], queries: [] },
    ...overrides,
  }
  return JSON.stringify(base)
}

const ctx = { buster: BUSTER, now: 1_000_000, userId: "user-a" }

test("a matching envelope hydrates", () => {
  const decision = decideRestore(envelope(), ctx)
  assert.equal(decision.action, "hydrate")
})

test("no persisted value is a skip, not a delete", () => {
  assert.equal(decideRestore(undefined, ctx).action, "skip")
  assert.equal(decideRestore("", ctx).action, "skip")
})

test("a corrupt envelope is discarded rather than thrown", () => {
  assert.equal(decideRestore("{not json", ctx).action, "discard")
  assert.equal(decideRestore("null", ctx).action, "discard")
})

test("a buster mismatch discards - this is the OTA gate", () => {
  assert.equal(decideRestore(envelope({ buster: "1.0.0+shape.1" }), ctx).action, "discard")
})

test("the buster folds the cache SHAPE version in, so an OTA on the same app version still busts", () => {
  const shipped = cacheBuster("1.1.0")
  assert.ok(shipped.includes("1.1.0"))
  assert.ok(shipped.includes(CACHE_SHAPE_VERSION))
  assert.notEqual(shipped, "1.1.0")
  assert.equal(cacheBuster(undefined), cacheBuster(null))
})

test("an over-age envelope discards; one exactly at the bound still hydrates", () => {
  const old = envelope({ timestamp: ctx.now - MAX_AGE_MS - 1 })
  assert.equal(decideRestore(old, ctx).action, "discard")
  const atBound = envelope({ timestamp: ctx.now - MAX_AGE_MS })
  assert.equal(decideRestore(atBound, ctx).action, "hydrate")
})

test("a non-numeric timestamp discards instead of comparing NaN", () => {
  assert.equal(decideRestore(envelope({ timestamp: "later" as never }), ctx).action, "discard")
})

test("a DIFFERENT user's cache never hydrates - fail closed on a shared device", () => {
  assert.equal(decideRestore(envelope({ userId: "user-b" }), ctx).action, "discard")
  assert.equal(decideRestore(envelope({ userId: null }), ctx).action, "discard")
})

test("an OWNERLESS cache never hydrates, for anyone - the writer never produces one either", () => {
  const guestCtx = { ...ctx, userId: null }
  assert.equal(decideRestore(envelope({ userId: null }), guestCtx).action, "discard")
  assert.equal(decideRestore(envelope({ userId: "user-a" }), guestCtx).action, "discard")
  assert.equal(decideRestore(envelope({ userId: null }), ctx).action, "discard")
  assert.equal(hasCacheOwner(null), false)
  assert.equal(hasCacheOwner(""), false)
  assert.equal(hasCacheOwner("user-a"), true)
})

test("a missing clientState discards rather than hydrating undefined", () => {
  assert.equal(decideRestore(envelope({ clientState: undefined as never }), ctx).action, "discard")
})

test("only the safelisted families are persisted; reports is narrowed to the mine list", () => {
  assert.equal(isPersistedQueryKey(["notifications", "list"]), true)
  assert.equal(isPersistedQueryKey(["threads"]), true)
  assert.equal(isPersistedQueryKey(["cleanups", "nearby", 34.05, -118.24]), true)
  assert.equal(isPersistedQueryKey(["profile", "me"]), true)
  assert.equal(isPersistedQueryKey(["reports", "mine"]), true)
  assert.equal(isPersistedQueryKey(["reports", "detail", "r1"]), false)
  assert.equal(isPersistedQueryKey(["chat", "room-1"]), false)
  assert.equal(isPersistedQueryKey(["map", "reports"]), false)
  assert.equal(isPersistedQueryKey([{ notReallyAKey: true }]), false)
  assert.equal(isPersistedQueryKey([]), false)
})

function fakeTimers() {
  const queued = new Map<number, () => void>()
  let next = 1
  let cleared = 0
  return {
    cleared: () => cleared,
    pending: () => queued.size,
    runAll: () => {
      const due = [...queued.entries()]
      queued.clear()
      for (const [, fn] of due) fn()
    },
    setTimer: (fn: () => void) => {
      const handle = next++
      queued.set(handle, fn)
      return handle
    },
    clearTimer: (handle: number) => {
      cleared++
      queued.delete(handle)
    },
    fireIgnoringClear: () => {
      for (const [, fn] of [...queued.entries()]) fn()
      queued.clear()
    },
  }
}

test("a burst of cache changes coalesces into ONE write", () => {
  const timers = fakeTimers()
  let flushes = 0
  const scheduler = makePersistScheduler({
    flush: () => {
      flushes++
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    debounceMs: 1000,
  })
  scheduler.schedule()
  scheduler.schedule()
  scheduler.schedule()
  assert.equal(timers.pending(), 1)
  timers.runAll()
  assert.equal(flushes, 1)
})

test("suspend() CANCELS the pending write - a sign-out purge is not undone a second later", () => {
  const timers = fakeTimers()
  let flushes = 0
  const scheduler = makePersistScheduler({
    flush: () => {
      flushes++
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    debounceMs: 1000,
  })
  scheduler.schedule()
  scheduler.suspend()
  assert.equal(timers.cleared(), 1)
  timers.runAll()
  assert.equal(flushes, 0)
})

test("a timer that ESCAPES cancellation still writes nothing while suspended", () => {
  const timers = fakeTimers()
  let flushes = 0
  const scheduler = makePersistScheduler({
    flush: () => {
      flushes++
    },
    setTimer: timers.setTimer,
    clearTimer: () => {},
    debounceMs: 1000,
  })
  scheduler.schedule()
  scheduler.suspend()
  timers.fireIgnoringClear()
  assert.equal(flushes, 0)
})

test("while suspended nothing is even scheduled, and resume() re-arms", () => {
  const timers = fakeTimers()
  let flushes = 0
  const scheduler = makePersistScheduler({
    flush: () => {
      flushes++
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    debounceMs: 1000,
  })
  scheduler.suspend()
  scheduler.schedule()
  assert.equal(timers.pending(), 0)
  timers.runAll()
  assert.equal(flushes, 0)

  scheduler.resume()
  scheduler.schedule()
  timers.runAll()
  assert.equal(flushes, 1)
})

test("stop() leaves the scheduler inert even if something schedules after teardown", () => {
  const timers = fakeTimers()
  let flushes = 0
  const scheduler = makePersistScheduler({
    flush: () => {
      flushes++
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    debounceMs: 1000,
  })
  scheduler.schedule()
  scheduler.stop()
  scheduler.schedule()
  timers.runAll()
  assert.equal(flushes, 0)
})

test("an event's day-of numbers survive a cold start; every other host surface is opt-in", () => {
  assert.equal(isPersistedQueryKey(["host", "c1", "counters"]), true)
  assert.equal(isPersistedQueryKey(["host", "c1", "ticket-types"]), true)
  assert.equal(isPersistedQueryKey(["host", "c1", "questions"]), true)
  assert.equal(isPersistedQueryKey(["host", "c1", "roster", "all", ""]), false)
  assert.equal(isPersistedQueryKey(["host", "c1", "my-registration"]), false)
  assert.equal(isPersistedQueryKey(["host", "c1", "team"]), false)
  assert.equal(isPersistedQueryKey(["host", "c1", "waitlist"]), false)
  assert.equal(isPersistedQueryKey(["host", "c1", "some-future-surface"]), false)
  assert.equal(isPersistedQueryKey(["host", "c1"]), false)
  assert.equal(isPersistedQueryKey(["tickets", "mine", "c1"]), false)
})

test("a public org page is cacheable and a donation record is not", () => {
  assert.equal(isPersistedQueryKey(["org", "acme"]), true)
  assert.equal(isPersistedQueryKey(["orgs", "mine"]), true)
  assert.equal(isPersistedQueryKey(["donations", "mine"]), false)
  assert.equal(isPersistedQueryKey(["donations", "org", "acme"]), false)
})

test("a paused mutation is never written to disk - its variables can carry a seat token", () => {
  assert.equal(shouldDehydrateMutation(), false)
})
