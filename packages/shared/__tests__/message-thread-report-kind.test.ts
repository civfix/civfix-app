import { describe, it, expect } from "vitest"
import { MessageThreadDTOSchema } from "../src/schemas/chat.js"
import { NotificationTypeSchema } from "../src/schemas/notifications.js"


const UUID = "123e4567-e89b-12d3-a456-426614174000"

describe("MessageThreadDTO kind:'report'", () => {
  it("parses a report thread and defaults muted to false when omitted", () => {
    const thread = {
      id: UUID,
      kind: "report" as const,
      title: "Report chat",
      unread: 0,
      members: 3,
    }
    const parsed = MessageThreadDTOSchema.parse(thread)
    expect(parsed.kind).toBe("report")
    expect(parsed.muted).toBe(false)
    expect(parsed.lastMessageAt).toBeUndefined()
  })

  it("carries the last message's timestamp when the room has one", () => {
    const parsed = MessageThreadDTOSchema.parse({
      id: UUID,
      kind: "report" as const,
      title: "Report chat",
      unread: 1,
      members: 3,
      ago: "5m",
      lastMessageAt: "2026-06-01T11:55:00.000Z",
    })
    expect(parsed.lastMessageAt).toBe("2026-06-01T11:55:00.000Z")
  })
})

describe("NotificationTypeSchema report_chat", () => {
  it("accepts 'report_chat'", () => {
    expect(NotificationTypeSchema.parse("report_chat")).toBe("report_chat")
  })
})
