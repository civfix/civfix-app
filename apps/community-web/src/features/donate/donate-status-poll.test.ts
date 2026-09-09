import { describe, expect, it } from "vitest"

import {
  POLL_GIVE_UP_MS,
  elapsedAfterAttempts,
  isTerminalDonationStatus,
  nextPollDelayMs,
  pollDecision,
} from "./donate-status-poll"

describe("donation status polling", () => {
  it("treats only pending as non-terminal", () => {
    expect(isTerminalDonationStatus("pending")).toBe(false)
    for (const status of ["succeeded", "failed", "refunded", "partially_refunded"] as const) {
      expect(isTerminalDonationStatus(status)).toBe(true)
    }
  })

  it("backs off exponentially and then holds", () => {
    expect([0, 1, 2, 3, 4, 5].map(nextPollDelayMs)).toEqual([1000, 2000, 4000, 5000, 5000, 5000])
  })

  it("stops the moment the donation settles", () => {
    expect(pollDecision("succeeded", 0, 0)).toEqual({ kind: "stop", reason: "settled" })
  })

  it("keeps waiting while pending and inside the budget", () => {
    expect(pollDecision("pending", 0, 0)).toEqual({ kind: "wait", delayMs: 1000 })
    expect(pollDecision(null, 1, 1000)).toEqual({ kind: "wait", delayMs: 2000 })
  })

  it("gives up rather than polling past the budget", () => {
    expect(pollDecision("pending", 6, POLL_GIVE_UP_MS - 1)).toEqual({
      kind: "stop",
      reason: "timed_out",
    })
  })

  it("never exceeds the budget across a full run", () => {
    let attempt = 0
    let elapsed = 0
    for (;;) {
      const decision = pollDecision("pending", attempt, elapsed)
      if (decision.kind === "stop") break
      elapsed += decision.delayMs
      attempt += 1
      expect(attempt).toBeLessThan(100)
    }
    expect(elapsed).toBeLessThanOrEqual(POLL_GIVE_UP_MS)
    expect(elapsed).toBe(elapsedAfterAttempts(attempt))
  })
})
