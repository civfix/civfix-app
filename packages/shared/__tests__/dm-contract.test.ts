import { describe, it, expect } from "vitest"
import {
  SearchUsersRequestSchema,
  UserSearchResultDTOSchema,
  UpdateSettingsRequestSchema,
  BlockUserResponseSchema,
  ListBlocksResponseSchema,
} from "../src/schemas/social.js"
import {
  OpenDmRequestSchema,
  MessageThreadDTOSchema,
  DmHistoryRequestSchema,
} from "../src/schemas/chat.js"
import { ChatMessageDTOSchema } from "../src/schemas/entities.js"
import { UserDTOSchema } from "../src/schemas/auth.js"
import { endpoints } from "../src/client/endpoints.js"


const ID = "123e4567-e89b-12d3-a456-426614174000"
const ID2 = "223e4567-e89b-12d3-a456-426614174000"

describe("username search request", () => {
  it("requires a non-empty query (no list-everyone form)", () => {
    expect(SearchUsersRequestSchema.safeParse({}).success).toBe(false)
    expect(SearchUsersRequestSchema.safeParse({ q: "" }).success).toBe(false)
    expect(SearchUsersRequestSchema.safeParse({ q: "   " }).success).toBe(false)
  })

  it("accepts a handle prefix with an optional limit, rejects unknown keys", () => {
    expect(SearchUsersRequestSchema.safeParse({ q: "ja" }).success).toBe(true)
    expect(SearchUsersRequestSchema.safeParse({ q: "jane", limit: 10 }).success).toBe(true)
    expect(SearchUsersRequestSchema.safeParse({ q: "jane", cursor: "x" }).success).toBe(false)
  })
})

describe("search result DTO is minimal (no PII)", () => {
  it("accepts the minimal hit and has no email/bio/follower fields", () => {
    const hit = { id: ID, handle: "jane", displayName: "Jane", avatar: null }
    expect(UserSearchResultDTOSchema.safeParse(hit).success).toBe(true)
    const keys = Object.keys(UserSearchResultDTOSchema.shape)
    expect(keys).not.toContain("email")
    expect(keys).not.toContain("bio")
    expect(keys).not.toContain("followers")
  })

  it("requires a non-null handle (only handled users are searchable)", () => {
    expect(
      UserSearchResultDTOSchema.safeParse({ id: ID, handle: null, displayName: "Jane", avatar: null })
        .success,
    ).toBe(false)
  })
})

describe("open-DM + DM history requests", () => {
  it("openDm takes a single userId, strictly", () => {
    expect(OpenDmRequestSchema.safeParse({ userId: ID }).success).toBe(true)
    expect(OpenDmRequestSchema.safeParse({ userId: ID, extra: 1 }).success).toBe(false)
  })

  it("DM history coerces limit and carries the path threadId", () => {
    const parsed = DmHistoryRequestSchema.safeParse({ threadId: ID, limit: "20" })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.limit).toBe(20)
  })
})

describe("MessageThreadDTO represents a DM with a peer", () => {
  it("accepts kind:'dm' with a peer person and refId", () => {
    const thread = {
      id: ID,
      kind: "dm",
      title: "@jane",
      refId: ID,
      peer: {
        id: ID2,
        name: "Jane",
        handle: "jane",
        avatar: null,
        followers: 0,
        following: 0,
        isFollowing: false,
      },
      unread: 2,
      members: 2,
    }
    expect(MessageThreadDTOSchema.safeParse(thread).success).toBe(true)
  })

  it("accepts a dm thread carrying the last message's ISO timestamp", () => {
    const thread = {
      id: ID,
      kind: "dm",
      title: "Jane",
      refId: ID,
      unread: 0,
      members: 2,
      ago: "now",
      lastMessageAt: "2026-06-07T12:00:00.000Z",
    }
    const parsed = MessageThreadDTOSchema.parse(thread)
    expect(parsed.lastMessageAt).toBe("2026-06-07T12:00:00.000Z")
  })

  it("still accepts a cleanup thread with no peer (backward compatible)", () => {
    const thread = { id: ID, kind: "cleanup", title: "Park cleanup", unread: 0, members: 5 }
    expect(MessageThreadDTOSchema.safeParse(thread).success).toBe(true)
  })
})

describe("ChatMessageDTO.roomKind is optional + backward compatible", () => {
  const base = {
    id: ID,
    cleanupId: ID,
    from: {
      id: ID2,
      name: "Jane",
      handle: "jane",
      avatar: null,
      followers: 0,
      following: 0,
      isFollowing: false,
    },
    kind: "text",
    createdAt: "2026-06-08T00:00:00.000Z",
  }
  it("parses with roomKind omitted (legacy cleanup message)", () => {
    expect(ChatMessageDTOSchema.safeParse(base).success).toBe(true)
  })
  it("parses with roomKind:'dm'", () => {
    expect(ChatMessageDTOSchema.safeParse({ ...base, roomKind: "dm" }).success).toBe(true)
  })
  it("parses with roomKind:'group'", () => {
    expect(ChatMessageDTOSchema.safeParse({ ...base, roomKind: "group" }).success).toBe(true)
  })
  it("rejects an unknown roomKind", () => {
    expect(ChatMessageDTOSchema.safeParse({ ...base, roomKind: "bogus" }).success).toBe(false)
  })
})

describe("settings + block schemas", () => {
  it("UserDTO carries an optional allowDirectMessages", () => {
    const user = {
      id: ID,
      displayName: "Jane",
      role: "citizen",
      createdAt: "2026-06-08T00:00:00.000Z",
    }
    expect(UserDTOSchema.safeParse(user).success).toBe(true)
    expect(UserDTOSchema.safeParse({ ...user, allowDirectMessages: false }).success).toBe(true)
  })

  it("UpdateSettingsRequest is a strict partial", () => {
    expect(UpdateSettingsRequestSchema.safeParse({ allowDirectMessages: false }).success).toBe(true)
    expect(UpdateSettingsRequestSchema.safeParse({}).success).toBe(true)
    expect(UpdateSettingsRequestSchema.safeParse({ nope: 1 }).success).toBe(false)
  })

  it("block responses parse", () => {
    expect(BlockUserResponseSchema.safeParse({ blocked: true }).success).toBe(true)
    expect(ListBlocksResponseSchema.safeParse({ blocked: [] }).success).toBe(true)
  })
})

describe("endpoint registry wires the DM/privacy surface correctly", () => {
  it("searchUsers is auth-required, GET, csrf-free", () => {
    expect(endpoints.searchUsers.method).toBe("GET")
    expect(endpoints.searchUsers.path).toBe("/users/search")
    expect(endpoints.searchUsers.auth).toBe("required")
    expect(endpoints.searchUsers.csrf).toBe(false)
  })

  it("openDm is a CSRF-protected POST /dm", () => {
    expect(endpoints.openDm.method).toBe("POST")
    expect(endpoints.openDm.path).toBe("/dm")
    expect(endpoints.openDm.auth).toBe("required")
    expect(endpoints.openDm.csrf).toBe(true)
  })

  it("dmMessages reads :id from threadId", () => {
    expect(endpoints.dmMessages.path).toBe("/dm/:id/messages")
    expect(endpoints.dmMessages.auth).toBe("required")
  })

  it("listPeople is auth-required (no anonymous enumeration)", () => {
    expect(endpoints.listPeople.auth).toBe("required")
  })

  it("block/unblock/updateSettings are CSRF-protected mutations", () => {
    expect(endpoints.blockUser.method).toBe("POST")
    expect(endpoints.blockUser.csrf).toBe(true)
    expect(endpoints.unblockUser.method).toBe("DELETE")
    expect(endpoints.unblockUser.csrf).toBe(true)
    expect(endpoints.updateSettings.method).toBe("PUT")
    expect(endpoints.updateSettings.path).toBe("/me/settings")
    expect(endpoints.updateSettings.csrf).toBe(true)
  })
})
