import { describe, it, expect } from "vitest"
import { ReportDTOSchema } from "../src/schemas/entities.js"

/**
 * The report-chat fields are populated only on the report-detail payload, so the DTO must parse both
 * with and without them, and enforce their bounds when present.
 */

const UUID = "123e4567-e89b-12d3-a456-426614174000"

function baseReport() {
  return {
    id: UUID,
    category: "trash" as const,
    status: "published" as const,
    visibility: "public" as const,
    lat: 34.05,
    lng: -118.24,
    geomSource: "device" as const,
    createdAt: "2026-06-01T12:00:00.000Z",
    mine: false,
    gov: false,
    following: false,
    media: [],
    timeline: [],
  }
}

describe("ReportDTO report-chat metadata", () => {
  it("parses WITHOUT the chat fields (list/pin payload: all four stay undefined)", () => {
    const parsed = ReportDTOSchema.parse(baseReport())
    expect(parsed.chatJoined).toBeUndefined()
    expect(parsed.chatMemberCount).toBeUndefined()
    expect(parsed.chatMessageCount).toBeUndefined()
    expect(parsed.chatUnread).toBeUndefined()
  })

  it("parses WITH the chat fields (report-detail payload)", () => {
    const parsed = ReportDTOSchema.parse({
      ...baseReport(),
      chatJoined: true,
      chatMemberCount: 3,
      chatMessageCount: 12,
      chatUnread: 4,
    })
    expect(parsed.chatJoined).toBe(true)
    expect(parsed.chatMemberCount).toBe(3)
    expect(parsed.chatMessageCount).toBe(12)
    expect(parsed.chatUnread).toBe(4)
  })

  it("accepts the anon-detail shape (chatJoined false, zero unread, valid counts)", () => {
    const parsed = ReportDTOSchema.parse({
      ...baseReport(),
      chatJoined: false,
      chatMemberCount: 1,
      chatMessageCount: 0,
      chatUnread: 0,
    })
    expect(parsed.chatJoined).toBe(false)
    expect(parsed.chatUnread).toBe(0)
  })

  it("rejects a negative count and a non-boolean joined flag", () => {
    expect(ReportDTOSchema.safeParse({ ...baseReport(), chatMemberCount: -1 }).success).toBe(false)
    expect(ReportDTOSchema.safeParse({ ...baseReport(), chatMessageCount: -2 }).success).toBe(false)
    expect(ReportDTOSchema.safeParse({ ...baseReport(), chatUnread: -1 }).success).toBe(false)
    expect(ReportDTOSchema.safeParse({ ...baseReport(), chatMemberCount: 1.5 }).success).toBe(false)
    expect(ReportDTOSchema.safeParse({ ...baseReport(), chatJoined: "yes" }).success).toBe(false)
  })
})
