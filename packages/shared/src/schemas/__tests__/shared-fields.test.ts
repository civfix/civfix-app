import { describe, expect, it } from "vitest"
import { AnonReportRequestSchema } from "../anon.js"
import { EditChatMessageRequestSchema, EditMessageRequestSchema } from "../chat.js"
import {
  CreateCleanupRequestSchema,
  GUEST_MANAGE_TOKEN_MAX_LENGTH,
  GUEST_MANAGE_TOKEN_MIN_LENGTH,
  SetMemberRoleRequestSchema,
  UpdateCleanupRequestSchema,
} from "../cleanups.js"
import { MESSAGE_BODY_MAX } from "../../types/ws.js"
import { ChatGroupDTOSchema, CreateChatGroupRequestSchema, SetGroupMemberRoleRequestSchema } from "../groups.js"
import {
  MAX_BROADCAST_SUBJECT,
  PreviewEventBroadcastRequestSchema,
  PUSH_REQUIRES_INAPP_MESSAGE,
  UpdateEventBroadcastRequestSchema,
} from "../host/broadcasts.js"
import { GetGuestEventTicketRequestSchema } from "../host/checkin.js"
import {
  InviteOrganizationMemberRequestSchema,
  SetOrganizationMemberRoleRequestSchema,
} from "../host/organizations.js"
import { EventQuestionConditionSchema, EventQuestionOptionSchema } from "../host/questions.js"
import { CreateReportRequestSchema, MAX_REPORT_ADDR_LENGTH } from "../reports.js"

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const OTHER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

function ids(count: number): string[] {
  return Array.from({ length: count }, () => ID)
}

function issuePaths(result: { success: boolean; error?: { issues: { path: (string | number)[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? []
}

const report = {
  idempotencyKey: ID,
  category: "trash",
  type: "dump",
  lat: 34.05,
  lng: -118.25,
  geomSource: "manual",
  mediaUploadIds: [],
} as const

describe("report submission requests", () => {
  it("report every missing required field in declaration order", () => {
    expect(issuePaths(CreateReportRequestSchema.safeParse({}))).toEqual([
      "idempotencyKey",
      "category",
      "type",
      "lat",
      "lng",
      "geomSource",
      "mediaUploadIds",
    ])
    expect(issuePaths(AnonReportRequestSchema.safeParse({}))).toEqual([
      "idempotencyKey",
      "turnstileToken",
      "category",
      "type",
      "lat",
      "lng",
      "geomSource",
      "mediaUploadIds",
    ])
  })

  it("bound media, address and coordinates the same way for signed-in and anonymous reports", () => {
    const anon = { ...report, turnstileToken: "t" }
    for (const [schema, base] of [
      [CreateReportRequestSchema, report],
      [AnonReportRequestSchema, anon],
    ] as const) {
      expect(schema.safeParse({ ...base, mediaUploadIds: ids(5) }).success).toBe(true)
      expect(schema.safeParse({ ...base, mediaUploadIds: ids(6) }).success).toBe(false)
      expect(schema.safeParse({ ...base, addr: "a".repeat(MAX_REPORT_ADDR_LENGTH) }).success).toBe(true)
      expect(schema.safeParse({ ...base, addr: "a".repeat(MAX_REPORT_ADDR_LENGTH + 1) }).success).toBe(false)
      expect(schema.safeParse({ ...base, title: "a".repeat(121) }).success).toBe(false)
      expect(schema.safeParse({ ...base, description: "a".repeat(2001) }).success).toBe(false)
      expect(schema.safeParse({ ...base, lat: 90.5 }).success).toBe(false)
      expect(schema.safeParse({ ...base, lng: -180.5 }).success).toBe(false)
    }
  })

  it("accept capturedAt only on the signed-in request and anonToken only on the anonymous one", () => {
    const capturedAt = "2026-07-24T17:00:00.000Z"
    expect(CreateReportRequestSchema.safeParse({ ...report, capturedAt }).success).toBe(true)
    expect(AnonReportRequestSchema.safeParse({ ...report, turnstileToken: "t", capturedAt }).success).toBe(false)
    expect(AnonReportRequestSchema.safeParse({ ...report, turnstileToken: "t", anonToken: "x" }).success).toBe(true)
    expect(CreateReportRequestSchema.safeParse({ ...report, anonToken: "x" }).success).toBe(false)
  })
})

describe("broadcast draft patches", () => {
  const update = { id: ID, broadcastId: OTHER_ID }

  it("let update and preview omit every draft field", () => {
    expect(UpdateEventBroadcastRequestSchema.safeParse(update).success).toBe(true)
    expect(PreviewEventBroadcastRequestSchema.safeParse({ id: ID }).success).toBe(true)
  })

  it("apply the draft's own bounds to each field that is present", () => {
    for (const schema of [UpdateEventBroadcastRequestSchema, PreviewEventBroadcastRequestSchema]) {
      expect(issuePaths(schema.safeParse({ ...update, subject: "" }))).toEqual(["subject"])
      expect(schema.safeParse({ ...update, subject: "a".repeat(MAX_BROADCAST_SUBJECT) }).success).toBe(true)
      expect(schema.safeParse({ ...update, subject: "a".repeat(MAX_BROADCAST_SUBJECT + 1) }).success).toBe(false)
      expect(schema.safeParse({ ...update, ctaLabel: null, ctaUrl: null }).success).toBe(true)
      expect(schema.safeParse({ ...update, ctaUrl: "http://example.org" }).success).toBe(false)
      expect(schema.safeParse({ ...update, ctaUrl: "https://example.org" }).success).toBe(true)
      const pushOnly = schema.safeParse({ ...update, channels: ["push"] })
      expect(pushOnly.error?.issues.map((issue) => issue.message)).toEqual([PUSH_REQUIRES_INAPP_MESSAGE])
      expect(schema.safeParse({ ...update, segment: { kind: "everyone" } }).success).toBe(false)
      expect(schema.safeParse({ ...update, unknown: true }).success).toBe(false)
    }
  })
})

describe("guest manage tokens", () => {
  it("bound the guest ticket lookup token like the guest RSVP token", () => {
    const parse = (token: string) => GetGuestEventTicketRequestSchema.safeParse({ token }).success
    expect(parse("a".repeat(GUEST_MANAGE_TOKEN_MIN_LENGTH))).toBe(true)
    expect(parse("a".repeat(GUEST_MANAGE_TOKEN_MIN_LENGTH - 1))).toBe(false)
    expect(parse("a".repeat(GUEST_MANAGE_TOKEN_MAX_LENGTH))).toBe(true)
    expect(parse("a".repeat(GUEST_MANAGE_TOKEN_MAX_LENGTH + 1))).toBe(false)
  })
})

describe("role pickers", () => {
  it("offer admin and member, never owner, when inviting or re-roling an org member", () => {
    const invite = { id: ID, identifierKind: "handle", identifier: "ada" }
    const setRole = { id: ID, userId: OTHER_ID }
    for (const [schema, base] of [
      [InviteOrganizationMemberRequestSchema, invite],
      [SetOrganizationMemberRoleRequestSchema, setRole],
    ] as const) {
      expect(schema.safeParse({ ...base, role: "admin" }).success).toBe(true)
      expect(schema.safeParse({ ...base, role: "member" }).success).toBe(true)
      expect(schema.safeParse({ ...base, role: "owner" }).error?.issues[0]?.message).toBe(
        "Invalid enum value. Expected 'admin' | 'member', received 'owner'",
      )
    }
  })

  it("offer the team roles plus member, never organizer, on an event", () => {
    const base = { id: ID, userId: OTHER_ID }
    expect(SetMemberRoleRequestSchema.safeParse({ ...base, role: "member" }).success).toBe(true)
    expect(SetMemberRoleRequestSchema.safeParse({ ...base, role: "organizer" }).error?.issues[0]?.message).toBe(
      "Invalid enum value. Expected 'cohost' | 'staff' | 'coordinator' | 'member', received 'organizer'",
    )
  })

  it("offer admin and member, never owner, in a chat group", () => {
    const base = { id: ID, userId: OTHER_ID }
    expect(SetGroupMemberRoleRequestSchema.safeParse({ ...base, role: "admin" }).success).toBe(true)
    expect(SetGroupMemberRoleRequestSchema.safeParse({ ...base, role: "owner" }).success).toBe(false)
  })
})

describe("chat groups", () => {
  it("default a new group to a private group and reject unknown kinds and visibilities", () => {
    const created = CreateChatGroupRequestSchema.parse({ name: "Block 12" })
    expect(created.kind).toBe("group")
    expect(created.visibility).toBe("private")
    expect(CreateChatGroupRequestSchema.safeParse({ name: "x", kind: "forum" }).success).toBe(false)
    expect(CreateChatGroupRequestSchema.safeParse({ name: "x", visibility: "secret" }).success).toBe(false)
    const dto = {
      id: ID,
      kind: "channel",
      name: "News",
      visibility: "public",
      ownerId: OTHER_ID,
      memberCount: 3,
      createdAt: "2026-07-24T17:00:00.000Z",
    }
    expect(ChatGroupDTOSchema.safeParse(dto).success).toBe(true)
    expect(ChatGroupDTOSchema.safeParse({ ...dto, visibility: "unlisted" }).success).toBe(false)
  })
})

describe("message edits", () => {
  it("cap mentions at twenty and the body at the message limit", () => {
    const dm = { threadId: ID, messageId: OTHER_ID, body: "hi" }
    const room = { roomKind: "cleanup", roomId: ID, messageId: OTHER_ID, body: "hi" }
    for (const [schema, base] of [
      [EditChatMessageRequestSchema, dm],
      [EditMessageRequestSchema, room],
    ] as const) {
      expect(schema.safeParse({ ...base, mentionedUserIds: ids(20) }).success).toBe(true)
      expect(schema.safeParse({ ...base, mentionedUserIds: ids(21) }).success).toBe(false)
      expect(schema.safeParse({ ...base, body: "a".repeat(MESSAGE_BODY_MAX) }).success).toBe(true)
      expect(schema.safeParse({ ...base, body: "a".repeat(MESSAGE_BODY_MAX + 1) }).success).toBe(false)
    }
  })
})

describe("event question options", () => {
  it("cap an option value, and the value a condition compares against, at 80 characters", () => {
    expect(EventQuestionOptionSchema.safeParse({ value: "a".repeat(80), label: "A" }).success).toBe(true)
    expect(EventQuestionOptionSchema.safeParse({ value: "a".repeat(81), label: "A" }).success).toBe(false)
    expect(EventQuestionConditionSchema.safeParse({ questionId: ID, equals: "a".repeat(80) }).success).toBe(true)
    expect(EventQuestionConditionSchema.safeParse({ questionId: ID, equals: "a".repeat(81) }).success).toBe(false)
    expect(EventQuestionConditionSchema.safeParse({ questionId: ID, equals: true }).success).toBe(true)
  })
})

describe("cleanup create and update", () => {
  const create = {
    title: "Beach",
    type: "site",
    lat: 34.05,
    lng: -118.25,
    scheduledAt: "2026-07-24T17:00:00.000Z",
  }

  it("bound the create idempotency key to 8-128 characters", () => {
    expect(CreateCleanupRequestSchema.safeParse({ ...create, idempotencyKey: "a".repeat(8) }).success).toBe(true)
    expect(CreateCleanupRequestSchema.safeParse({ ...create, idempotencyKey: "a".repeat(7) }).success).toBe(false)
    expect(CreateCleanupRequestSchema.safeParse({ ...create, idempotencyKey: "a".repeat(128) }).success).toBe(true)
    expect(CreateCleanupRequestSchema.safeParse({ ...create, idempotencyKey: "a".repeat(129) }).success).toBe(false)
    expect(CreateCleanupRequestSchema.safeParse({ ...create, type: "loop" }).success).toBe(false)
  })

  it("let an update move the pin within the globe and change the event type", () => {
    const parse = (patch: object) => UpdateCleanupRequestSchema.safeParse({ id: ID, ...patch }).success
    expect(parse({ lat: 90, lng: -180, type: "route" })).toBe(true)
    expect(parse({ lat: 90.5 })).toBe(false)
    expect(parse({ lng: 180.5 })).toBe(false)
    expect(parse({ type: "loop" })).toBe(false)
  })

  it("bound slot sort order to 0-1000", () => {
    const slot = (sortOrder: number) => ({ title: "Shift", sortOrder })
    expect(UpdateCleanupRequestSchema.safeParse({ id: ID, slots: [slot(1000)] }).success).toBe(true)
    expect(UpdateCleanupRequestSchema.safeParse({ id: ID, slots: [slot(1001)] }).success).toBe(false)
    expect(UpdateCleanupRequestSchema.safeParse({ id: ID, slots: [slot(-1)] }).success).toBe(false)
  })
})
