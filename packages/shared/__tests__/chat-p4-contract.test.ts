import { describe, it, expect } from "vitest"
import {
  ChatGroupDTOSchema,
  GroupMemberDTOSchema,
  CreateChatGroupRequestSchema,
  UpdateChatGroupRequestSchema,
  GroupHistoryRequestSchema,
  AddGroupMembersRequestSchema,
  SetGroupMemberRoleRequestSchema,
  ListGroupMembersResponseSchema,
} from "../src/schemas/groups.js"
import { RoomKindSchema, WsServerMessageSchema } from "../src/types/ws.js"
import { endpoints } from "../src/client/endpoints.js"

/**
 * Chat P4 contract: group rooms — the "group" room kind on the unified chat rails, plus the
 * chat_groups DTOs and the 9-route /groups management surface.
 */

const GROUP = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const USER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const MSG = "cccccccc-cccc-cccc-cccc-cccccccccccc"

const PERSON = {
  id: USER,
  name: "Jane",
  handle: "jane",
  avatar: null,
  followers: 0,
  following: 0,
  isFollowing: false,
}

describe("RoomKindSchema includes 'group'", () => {
  it("parses 'group'", () => {
    expect(RoomKindSchema.safeParse("group").success).toBe(true)
  })

  it("still rejects unknown kinds", () => {
    expect(RoomKindSchema.safeParse("bogus").success).toBe(false)
  })

  it("message_update frames accept roomKind 'group' now", () => {
    expect(
      WsServerMessageSchema.safeParse({
        type: "message_update",
        roomKind: "group",
        roomId: GROUP,
        message: {
          id: MSG,
          cleanupId: GROUP,
          from: null,
          body: "edited",
          kind: "text",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      }).success,
    ).toBe(true)
  })
})

describe("ChatGroupDTOSchema", () => {
  const base = {
    id: GROUP,
    kind: "group",
    name: "Trail crew",
    visibility: "private",
    ownerId: USER,
    memberCount: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
  }

  it("parses a minimal group DTO and defaults muted to false", () => {
    const parsed = ChatGroupDTOSchema.safeParse(base)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.muted).toBe(false)
  })

  it("parses a full DTO with description/avatar/myRole", () => {
    expect(
      ChatGroupDTOSchema.safeParse({
        ...base,
        kind: "channel",
        visibility: "public",
        description: "weekly cleanups",
        avatar: null,
        myRole: "admin",
        muted: true,
      }).success,
    ).toBe(true)
  })

  it("accepts myRole null (viewer is not a member)", () => {
    expect(ChatGroupDTOSchema.safeParse({ ...base, myRole: null }).success).toBe(true)
  })

  it("rejects an unknown kind", () => {
    expect(ChatGroupDTOSchema.safeParse({ ...base, kind: "broadcast" }).success).toBe(false)
  })
})

describe("GroupMemberDTOSchema", () => {
  it("parses a member row", () => {
    expect(
      GroupMemberDTOSchema.safeParse({
        user: PERSON,
        role: "member",
        joinedAt: "2026-01-01T00:00:00.000Z",
      }).success,
    ).toBe(true)
  })

  it("rejects an unknown role", () => {
    expect(
      GroupMemberDTOSchema.safeParse({
        user: PERSON,
        role: "moderator",
        joinedAt: "2026-01-01T00:00:00.000Z",
      }).success,
    ).toBe(false)
  })
})

describe("CreateChatGroupRequestSchema", () => {
  it("applies defaults: kind=group, visibility=private, memberIds=[]", () => {
    const parsed = CreateChatGroupRequestSchema.safeParse({ name: "Trail crew" })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.kind).toBe("group")
      expect(parsed.data.visibility).toBe("private")
      expect(parsed.data.memberIds).toEqual([])
    }
  })

  it("rejects an empty name and extra keys (strict)", () => {
    expect(CreateChatGroupRequestSchema.safeParse({ name: "" }).success).toBe(false)
    expect(CreateChatGroupRequestSchema.safeParse({ name: "x", extra: 1 }).success).toBe(false)
  })

  it("caps memberIds at 50", () => {
    expect(
      CreateChatGroupRequestSchema.safeParse({ name: "x", memberIds: Array(51).fill(USER) }).success,
    ).toBe(false)
  })
})

describe("UpdateChatGroupRequestSchema", () => {
  it("accepts a partial patch (id only)", () => {
    expect(UpdateChatGroupRequestSchema.safeParse({ id: GROUP }).success).toBe(true)
  })

  it("accepts clearing the description via empty string", () => {
    expect(UpdateChatGroupRequestSchema.safeParse({ id: GROUP, description: "" }).success).toBe(true)
  })

  it("rejects description null (empty string is the clear sentinel)", () => {
    expect(UpdateChatGroupRequestSchema.safeParse({ id: GROUP, description: null }).success).toBe(false)
  })
})

describe("GroupHistoryRequestSchema", () => {
  it("parses id-only and with before", () => {
    expect(GroupHistoryRequestSchema.safeParse({ id: GROUP }).success).toBe(true)
    expect(GroupHistoryRequestSchema.safeParse({ id: GROUP, before: MSG }).success).toBe(true)
  })

  it("rejects a cursor that is not a message id", () => {
    expect(GroupHistoryRequestSchema.safeParse({ id: GROUP, before: "cursor" }).success).toBe(false)
  })

  it("parses around-mode", () => {
    expect(GroupHistoryRequestSchema.safeParse({ id: GROUP, around: MSG }).success).toBe(true)
  })

  it("rejects around combined with before (mutually exclusive)", () => {
    expect(
      GroupHistoryRequestSchema.safeParse({ id: GROUP, around: MSG, before: "cursor" }).success,
    ).toBe(false)
  })

  it("caps limit at 50", () => {
    expect(GroupHistoryRequestSchema.safeParse({ id: GROUP, limit: 51 }).success).toBe(false)
  })
})

describe("member management requests", () => {
  it("AddGroupMembers requires 1..50 ids", () => {
    expect(AddGroupMembersRequestSchema.safeParse({ id: GROUP, memberIds: [USER] }).success).toBe(true)
    expect(AddGroupMembersRequestSchema.safeParse({ id: GROUP, memberIds: [] }).success).toBe(false)
  })

  it("SetGroupMemberRole only allows admin|member (owner is not assignable)", () => {
    expect(
      SetGroupMemberRoleRequestSchema.safeParse({ id: GROUP, userId: USER, role: "admin" }).success,
    ).toBe(true)
    expect(
      SetGroupMemberRoleRequestSchema.safeParse({ id: GROUP, userId: USER, role: "owner" }).success,
    ).toBe(false)
  })

  it("ListGroupMembersResponse carries members + nextCursor", () => {
    expect(
      ListGroupMembersResponseSchema.safeParse({
        members: [{ user: PERSON, role: "owner", joinedAt: "2026-01-01T00:00:00.000Z" }],
        nextCursor: null,
      }).success,
    ).toBe(true)
  })
})

describe("group endpoints registration", () => {
  it("registers the 9 /groups routes with the right method/path/csrf", () => {
    const expected: Array<[keyof typeof endpoints, string, string, boolean]> = [
      ["createChatGroup", "POST", "/groups", true],
      ["getChatGroup", "GET", "/groups/:id", false],
      ["groupMessages", "GET", "/groups/:id/messages", false],
      ["updateChatGroup", "PATCH", "/groups/:id", true],
      ["addGroupMembers", "POST", "/groups/:id/members", true],
      ["removeGroupMember", "DELETE", "/groups/:id/members/:userId", true],
      ["setGroupMemberRole", "PUT", "/groups/:id/members/:userId/role", true],
      ["listGroupMembers", "GET", "/groups/:id/members", false],
      ["deleteGroupMessage", "DELETE", "/groups/:id/messages/:messageId", true],
    ]
    for (const [name, method, path, csrf] of expected) {
      const e = endpoints[name]
      expect(e.method).toBe(method)
      expect(e.path).toBe(path)
      expect(e.csrf).toBe(csrf)
      expect(e.auth).toBe("required")
      expect(e.version).toBe("v1")
    }
  })
})
