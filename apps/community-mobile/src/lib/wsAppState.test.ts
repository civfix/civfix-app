import { test } from "node:test"
import assert from "node:assert/strict"
import { applyAppStateTransition, type AppStateSocket } from "./wsAppState.ts"
import type { ChatConnState } from "@civfix/ui/data"

/**
 * A faithful stand-in for the parts of ChatSocketCore this policy drives: `resume()` is a NO-OP unless a
 * "background" previously suspended the core, `suspend()` closes + clears the pending backoff, and the
 * reopen is gated on connection intent (an always-on channel or a live chat screen).
 */
class FakeCore implements AppStateSocket {
  status: ChatConnState = "open"
  suspended = false
  /** Reconnect attempts accumulated so far - the jittered backoff grows with this. */
  attempt = 0
  /** A scheduled reconnect is pending (the socket is backing off). */
  pendingReconnect = false
  hasIntent = true
  opens = 0

  getStatus(): ChatConnState {
    return this.status
  }

  suspend(): void {
    this.suspended = true
    this.pendingReconnect = false
    this.status = "closed"
  }

  resume(): void {
    if (!this.suspended) return
    this.suspended = false
    this.attempt = 0
    this.pendingReconnect = false
    this.ensureOpen()
  }

  private ensureOpen(): void {
    if (this.suspended || !this.hasIntent) return
    this.opens += 1
    // The native transport is async, so the core reports "connecting" for the duration.
    this.status = "connecting"
  }

  /** The socket dropped (OS killed the TCP connection) and is now waiting out a jittered backoff. */
  dropIntoBackoff(attempt: number): void {
    this.status = "closed"
    this.attempt = attempt
    this.pendingReconnect = true
  }
}

test("backgrounding suspends the socket", () => {
  const core = new FakeCore()
  applyAppStateTransition("background", core)
  assert.equal(core.suspended, true)
  assert.equal(core.status, "closed")
})

test("a background -> active cycle resumes and reopens once", () => {
  const core = new FakeCore()
  applyAppStateTransition("background", core)
  applyAppStateTransition("active", core)
  assert.equal(core.suspended, false)
  assert.equal(core.opens, 1)
  assert.equal(core.status, "connecting")
})

test("foregrounding after an INACTIVE-period drop reconnects at once and resets the backoff", () => {
  // Screen lock / Control Center / an incoming call: no 'background' ever fired, so the core was never
  // suspended and resume() alone would no-op - the regression this guards.
  const core = new FakeCore()
  core.dropIntoBackoff(5)

  applyAppStateTransition("active", core)

  assert.equal(core.opens, 1, "must reopen immediately instead of waiting out the jittered backoff")
  assert.equal(core.attempt, 0, "the backoff schedule must restart at ~1s, not at the 15s cap")
  assert.equal(core.pendingReconnect, false, "the pending timer must be cleared, not raced")
  assert.equal(core.suspended, false)
})

test("foregrounding a healthy open socket leaves it alone", () => {
  const core = new FakeCore()
  applyAppStateTransition("active", core)
  assert.equal(core.status, "open")
  assert.equal(core.opens, 0, "a live socket must not be dropped and re-joined on every foreground")
  assert.equal(core.suspended, false)
})

test("foregrounding while a connect is already in flight does not start a second one", () => {
  const core = new FakeCore()
  core.status = "connecting"
  applyAppStateTransition("active", core)
  assert.equal(core.opens, 0)
  assert.equal(core.status, "connecting")
})

test("foregrounding with no connection intent opens nothing", () => {
  // Signed out / every chat screen closed: the kick must stay a no-op rather than force a socket.
  const core = new FakeCore()
  core.hasIntent = false
  core.status = "closed"

  applyAppStateTransition("active", core)

  assert.equal(core.opens, 0)
  assert.equal(core.suspended, false, "the kick must not leave the core stuck in the suspended state")
})

test("inactive and other transitions are ignored", () => {
  const core = new FakeCore()
  for (const state of ["inactive", "unknown", "extension"] as const) {
    applyAppStateTransition(state, core)
  }
  assert.equal(core.status, "open")
  assert.equal(core.opens, 0)
  assert.equal(core.suspended, false)
})
