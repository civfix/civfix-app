import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { QUEUED_SEND_TIMEOUT_MS, SEND_TIMEOUT_MS } from "../hooks/chat"

const SRC = readFileSync(join(__dirname, "..", "hooks", "chatOutbox.ts"), "utf8")

describe("queued sends are bounded (web queueWhileClosed)", () => {
  it("the queued timeout is a whole multiple of the ack timeout and spans several reconnect cycles", () => {
    expect(QUEUED_SEND_TIMEOUT_MS % SEND_TIMEOUT_MS).toBe(0)
    expect(QUEUED_SEND_TIMEOUT_MS).toBeGreaterThanOrEqual(3 * SEND_TIMEOUT_MS)
    expect(QUEUED_SEND_TIMEOUT_MS).toBe(60_000)
  })

  it("a 'queued' outcome arms the LONG timeout so no entry spins as sending forever", () => {
    expect(SRC).toContain('if (outcome === "queued") {')
    expect(SRC).toContain("armSendTimeout(clientId, QUEUED_SEND_TIMEOUT_MS)")
  })

  it("retrying a core-queued entry re-arms the wait instead of enqueueing a DUPLICATE frame", () => {
    expect(SRC).toContain("if (coreQueuedRef.current.has(clientId)) {")
    const guard = SRC.indexOf("if (coreQueuedRef.current.has(clientId)) {")
    const firstSend = SRC.indexOf("socket.send({", guard)
    const guardReturn = SRC.indexOf("return", guard)
    expect(guard).toBeGreaterThan(-1)
    expect(guardReturn).toBeLessThan(firstSend)
  })

  it("a promoted entry (connection open) falls back to the standard ack timeout", () => {
    expect(SRC).toContain("for (const clientId of coreQueuedRef.current) armSendTimeout(clientId)")
    expect(SRC).toContain("coreQueuedRef.current.clear()")
  })
})
