/**
 * The result of the first successful read is written into a query cache with an infinite staleTime, so a
 * bound widened to Infinity would make one bad read last the whole session.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { GPS_TIMEOUT_MS, LAST_KNOWN_MAX_AGE_MS } from "./locationTimeouts.ts"

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
