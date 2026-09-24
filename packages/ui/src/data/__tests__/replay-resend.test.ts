/**
 * On reconnect an offline-failed message is re-sent, and its bubble must flip back to "sending" at once.
 * The outbox updater runs lazily, after dispatch() has cleared the id from offlineFailedRef, so the ids
 * must be captured before dispatch.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"
import type { ChatMessageDTO, OutboxEntry } from "@civfix/shared"
import { markResending } from "../hooks/chat"

const entry = (clientId: string, status: OutboxEntry["status"]): OutboxEntry =>
  ({ clientId, status, message: { id: clientId } as ChatMessageDTO }) as OutboxEntry

describe("markResending", () => {
  it("flips exactly the captured failed entries back to sending", () => {
    const outbox = [entry("a", "failed"), entry("b", "failed"), entry("c", "sending")]
    const next = markResending(outbox, new Set(["a"]))
    expect(next.map((e) => [e.clientId, e.status])).toEqual([
      ["a", "sending"],
      ["b", "failed"],
      ["c", "sending"],
    ])
  })

  it("returns the same array when nothing is captured", () => {
    const outbox = [entry("a", "failed")]
    expect(markResending(outbox, new Set())).toBe(outbox)
  })
})

describe("useChat reconnect replay", () => {
  const chat = readFileSync(new URL("../hooks/chat.ts", import.meta.url), "utf8")
  const reconnect = sliceBetween(chat, "const replay = replayableEntries(", "for (const entry of replay)")

  it("captures the ids to flip before dispatch clears offlineFailedRef", () => {
    expect(reconnect).toContain("markResending(prev, resend)")
    expect(reconnect).not.toContain("offlineFailedRef.current.has(e.clientId)")
  })
})
