import { describe, expect, it } from "vitest"
import { OkResponseSchema, PageLimitSchema } from "../src/schemas/internal-fields.js"
import { LogoutResponseSchema } from "../src/schemas/auth.js"
import { MarkThreadReadResponseSchema, ChatHistoryQuerySchema } from "../src/schemas/chat.js"
import {
  GuestRsvpCancelResponseSchema,
  ListCleanupsRequestSchema,
  RequestEventResourcesResponseSchema,
  SetMemberRoleResponseSchema,
} from "../src/schemas/cleanups.js"
import { ReportContentResponseSchema } from "../src/schemas/content-report.js"
import { ListGroupMembersRequestSchema } from "../src/schemas/groups.js"
import { SuggestContactResponseSchema } from "../src/schemas/map.js"
import { MarkReadResponseSchema, RegisterPushTokenResponseSchema } from "../src/schemas/notifications.js"
import { DeletePostResponseSchema } from "../src/schemas/posts.js"
import { ConnectionsListQuerySchema, DeleteAccountResponseSchema } from "../src/schemas/social.js"
import { LeaderboardQuerySchema, MyVolunteerHoursEntriesQuerySchema } from "../src/schemas/volunteer.js"
import { ChatMessageDTOSchema } from "../src/schemas/entities.js"
import { RoomKindSchema } from "../src/types/ws.js"

const ID = "00000000-0000-4000-8000-000000000001"

describe("PageLimitSchema", () => {
  it("coerces a query-string limit and keeps it optional", () => {
    expect(PageLimitSchema.parse("50")).toBe(50)
    expect(PageLimitSchema.parse(1)).toBe(1)
    expect(PageLimitSchema.parse(undefined)).toBeUndefined()
  })

  it.each([0, -1, 51, 2.5, "abc"])("rejects %s", (limit) => {
    expect(PageLimitSchema.safeParse(limit).success).toBe(false)
  })

  it("is the page-size rule of every list query that uses it", () => {
    const queries = [
      () => ChatHistoryQuerySchema.safeParse({ limit: "51" }),
      () => ConnectionsListQuerySchema.safeParse({ id: "u", limit: "51" }),
      () => ListGroupMembersRequestSchema.safeParse({ id: ID, limit: "51" }),
      () => MyVolunteerHoursEntriesQuerySchema.safeParse({ limit: "51" }),
      () => LeaderboardQuerySchema.safeParse({ geoid: "06", limit: "51" }),
      () => ListCleanupsRequestSchema.safeParse({ limit: "51" }),
    ]
    for (const parse of queries) expect(parse().success).toBe(false)
    expect(ListCleanupsRequestSchema.parse({ limit: "50" })).toEqual({ limit: 50 })
  })
})

describe("OkResponseSchema", () => {
  it("accepts only ok: true and strips unknown keys", () => {
    expect(OkResponseSchema.parse({ ok: true, extra: 1 })).toEqual({ ok: true })
    expect(OkResponseSchema.safeParse({ ok: false }).success).toBe(false)
    expect(OkResponseSchema.safeParse({}).success).toBe(false)
  })

  it("backs every ok-only response under its own name", () => {
    for (const schema of [
      LogoutResponseSchema,
      MarkThreadReadResponseSchema,
      RequestEventResourcesResponseSchema,
      SetMemberRoleResponseSchema,
      GuestRsvpCancelResponseSchema,
      ReportContentResponseSchema,
      SuggestContactResponseSchema,
      MarkReadResponseSchema,
      RegisterPushTokenResponseSchema,
      DeletePostResponseSchema,
      DeleteAccountResponseSchema,
    ]) {
      expect(schema).toBe(OkResponseSchema)
    }
  })
})

describe("ChatMessageDTO roomKind", () => {
  const message = { id: ID, cleanupId: ID, kind: "text", createdAt: "2026-01-01T00:00:00.000Z" }

  it.each(RoomKindSchema.options)("accepts %s", (roomKind) => {
    expect(ChatMessageDTOSchema.parse({ ...message, roomKind }).roomKind).toBe(roomKind)
  })

  it("rejects a kind outside the room enum and still allows it to be absent", () => {
    expect(ChatMessageDTOSchema.safeParse({ ...message, roomKind: "channel" }).success).toBe(false)
    expect(ChatMessageDTOSchema.parse(message).roomKind).toBeUndefined()
  })
})
