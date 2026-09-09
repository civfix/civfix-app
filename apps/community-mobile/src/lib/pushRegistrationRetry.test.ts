import { test } from "node:test"
import assert from "node:assert/strict"
import {
  PUSH_ATTEMPT_LIMIT,
  freshPushAttemptState,
  isForegroundEdge,
  isPushOutcomeTerminal,
  shouldAttemptPushRegistration,
} from "./pushRegistrationRetry.ts"

test("only a decided outcome is terminal - a transient error stays retryable", () => {
  assert.equal(isPushOutcomeTerminal("registered"), true)
  assert.equal(isPushOutcomeTerminal("denied"), true)
  assert.equal(isPushOutcomeTerminal("unsupported"), true)
  assert.equal(isPushOutcomeTerminal("error"), false)
})

test("a fresh authed session attempts registration", () => {
  assert.equal(
    shouldAttemptPushRegistration({ ...freshPushAttemptState() }),
    true,
  )
})

test("a settled session never re-registers, however many foregrounds follow", () => {
  assert.equal(shouldAttemptPushRegistration({ ...freshPushAttemptState(), attempts: 1, settled: true }), false)
})

test("an attempt already in flight is not duplicated by a foreground event", () => {
  assert.equal(shouldAttemptPushRegistration({ ...freshPushAttemptState(), attempts: 1, inFlight: true }), false)
})

test("retries are bounded, so a permanently failing device cannot hot-loop", () => {
  const at = (attempts: number) =>
    shouldAttemptPushRegistration({ ...freshPushAttemptState(), attempts })
  assert.equal(at(PUSH_ATTEMPT_LIMIT - 1), true)
  assert.equal(at(PUSH_ATTEMPT_LIMIT), false)
  assert.equal(at(PUSH_ATTEMPT_LIMIT + 1), false)
})

test("only a real background round trip counts as a foreground - not an app-switcher peek", () => {
  const state = freshPushAttemptState()
  assert.equal(isForegroundEdge(state, "inactive"), false)
  assert.equal(isForegroundEdge(state, "active"), false)

  assert.equal(isForegroundEdge(state, "background"), false)
  assert.equal(isForegroundEdge(state, "inactive"), false)
  assert.equal(isForegroundEdge(state, "active"), true)
})

test("a foreground edge is consumed once, so one background round trip buys one retry", () => {
  const state = freshPushAttemptState()
  isForegroundEdge(state, "background")
  assert.equal(isForegroundEdge(state, "active"), true)
  assert.equal(isForegroundEdge(state, "active"), false)
  assert.equal(isForegroundEdge(state, "inactive"), false)
  assert.equal(isForegroundEdge(state, "active"), false)
})
