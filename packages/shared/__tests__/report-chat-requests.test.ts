import { describe, it, expect } from "vitest"
import {
  JoinReportChatRequestSchema,
  LeaveReportChatRequestSchema,
  ToggleMuteRequestSchema,
  ToggleMuteResponseSchema,
} from "../src/schemas/report-chat.js"
import { endpoints } from "../src/client/endpoints.js"

const UUID = "123e4567-e89b-12d3-a456-426614174000"

describe("JoinReportChatRequestSchema", () => {
  it("accepts a report id", () => {
    const parsed = JoinReportChatRequestSchema.parse({ id: UUID })
    expect(parsed).toEqual({ id: UUID })
  })

  it("rejects a non-uuid id", () => {
    expect(JoinReportChatRequestSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false)
  })

  it("rejects unknown keys (strict)", () => {
    expect(JoinReportChatRequestSchema.safeParse({ id: UUID, bogus: 1 }).success).toBe(false)
  })
})

describe("LeaveReportChatRequestSchema", () => {
  it("accepts a report id", () => {
    const parsed = LeaveReportChatRequestSchema.parse({ id: UUID })
    expect(parsed).toEqual({ id: UUID })
  })

  it("rejects unknown keys (strict)", () => {
    expect(LeaveReportChatRequestSchema.safeParse({ id: UUID, bogus: 1 }).success).toBe(false)
  })
})

describe("ToggleMuteRequestSchema", () => {
  it("accepts a valid report room mute toggle", () => {
    const parsed = ToggleMuteRequestSchema.parse({ roomKind: "report", roomId: UUID, muted: true })
    expect(parsed).toEqual({ roomKind: "report", roomId: UUID, muted: true })
  })

  it("rejects an invalid roomKind", () => {
    expect(
      ToggleMuteRequestSchema.safeParse({ roomKind: "bogus", roomId: UUID, muted: true }).success,
    ).toBe(false)
  })

  it("rejects unknown keys (strict)", () => {
    expect(
      ToggleMuteRequestSchema.safeParse({
        roomKind: "report",
        roomId: UUID,
        muted: true,
        extra: 1,
      }).success,
    ).toBe(false)
  })
})

describe("ToggleMuteResponseSchema", () => {
  it("accepts { muted: boolean }", () => {
    expect(ToggleMuteResponseSchema.parse({ muted: false })).toEqual({ muted: false })
  })
})

describe("report-chat endpoint registry", () => {
  it("registers joinReportChat as POST /reports/:id/chat/join", () => {
    const e = endpoints.joinReportChat
    expect(e.method).toBe("POST")
    expect(e.path).toBe("/reports/:id/chat/join")
    expect(e.auth).toBe("required")
    expect(e.csrf).toBe(true)
    expect(e.version).toBe("v1")
  })

  it("registers leaveReportChat as POST /reports/:id/chat/leave", () => {
    const e = endpoints.leaveReportChat
    expect(e.method).toBe("POST")
    expect(e.path).toBe("/reports/:id/chat/leave")
    expect(e.auth).toBe("required")
    expect(e.csrf).toBe(true)
    expect(e.version).toBe("v1")
  })

  it("registers toggleConversationMute as PUT /conversations/mute", () => {
    const e = endpoints.toggleConversationMute
    expect(e.method).toBe("PUT")
    expect(e.path).toBe("/conversations/mute")
    expect(e.auth).toBe("required")
    expect(e.csrf).toBe(true)
    expect(e.version).toBe("v1")
  })
})
