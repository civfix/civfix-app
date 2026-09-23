/**
 * The result of the first successful read is written into a query cache with an infinite staleTime, so a
 * `withTimeout` that swallowed a value or rejected, or a bound widened to Infinity, would make one bad read
 * last the whole session.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { GPS_TIMEOUT_MS, LAST_KNOWN_MAX_AGE_MS, withTimeout } from "./withTimeout.ts"

test("a promise that settles in time resolves with its own value, untouched", async () => {
  const value = { coords: { latitude: 1, longitude: 2 } }
  assert.equal(await withTimeout(Promise.resolve(value), 50), value)
  // Falsy values are values, not misses: 0/""/false must survive rather than read as a timeout.
  assert.equal(await withTimeout(Promise.resolve(0), 50), 0)
  assert.equal(await withTimeout(Promise.resolve(false), 50), false)
})

test("a promise that never settles resolves NULL at the cap instead of hanging the caller", async () => {
  const started = Date.now()
  // The shutter/capability case: getCurrentPositionAsync with no fix available never calls back at all.
  const result = await withTimeout(new Promise<string>(() => {}), 20)
  assert.equal(result, null)
  assert.ok(Date.now() - started >= 15, "should have waited for the cap, not resolved immediately")
})

test("a REJECTION resolves null rather than propagating - callers must not need a try/catch", async () => {
  assert.equal(await withTimeout(Promise.reject(new Error("services off")), 50), null)
})

test("a slow value that lands AFTER the cap cannot overwrite the null the caller already got", async () => {
  let settle: (v: string) => void = () => {}
  const slow = new Promise<string>((resolve) => {
    settle = resolve
  })
  const raced = withTimeout(slow, 10)
  assert.equal(await raced, null)
  settle("late fix")
  // A second settle on an already-settled promise is a no-op; assert the caller still sees null.
  assert.equal(await raced, null)
})

test("the fresh-fix cap is a real, short bound - not zero and not effectively infinite", () => {
  assert.ok(Number.isFinite(GPS_TIMEOUT_MS))
  // Zero would mean "never wait for a fresh fix" (always fall through to IP); anything above a few seconds
  // is indistinguishable from the uncapped hang this module exists to bound.
  assert.ok(GPS_TIMEOUT_MS > 0 && GPS_TIMEOUT_MS <= 10_000)
})

test("the cached-fix age bound is finite - an unbounded maxAge is the bug it was added for", () => {
  assert.ok(Number.isFinite(LAST_KNOWN_MAX_AGE_MS))
  // Unbounded (or hours-wide) lets a fix from another city become the session's location; zero would
  // discard every cached fix and make the instant path useless. A minute is "somewhere the user still is".
  assert.ok(LAST_KNOWN_MAX_AGE_MS > 0 && LAST_KNOWN_MAX_AGE_MS <= 5 * 60_000)
})
