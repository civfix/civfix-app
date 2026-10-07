import { describe, it, expect } from "vitest"
import {
  REPORT_CATEGORY_LABELS,
  REPORT_STATUS_LABELS,
  ReportCategorySchema,
  ReportTypeSchema,
  REPORT_TYPE_VALUES,
  REPORT_TYPE_LABELS,
  REPORT_TYPE_TO_CATEGORY,
  WEB_REPORT_TYPES,
  LatLngFields,
  MediaPurposeSchema,
} from "../src/schemas/common.js"
import {
  MarkThreadReadRequestSchema,
  MarkThreadReadResponseSchema,
  MessageThreadDTOSchema,
  ToggleCleanupMessageReactionRequestSchema,
  ToggleDmMessageReactionRequestSchema,
} from "../src/schemas/chat.js"
import { endpoints } from "../src/client/endpoints.js"
import {
  CreateReportRequestSchema,
  ListReportsSearchRequestSchema,
} from "../src/schemas/reports.js"
import { MentionSearchRequestSchema } from "../src/schemas/social.js"
import {
  ChatMessageDTOSchema,
  REACTION_EMOJIS,
  ReactionEmojiSchema,
  ReportPinDTOSchema,
  UserMentionDTOSchema,
} from "../src/schemas/entities.js"
import { WsServerMessageSchema, WsClientMessageSchema } from "../src/types/ws.js"
import {
  JoinCleanupResponseSchema,
  LeaveCleanupResponseSchema,
  CreateCleanupRequestSchema,
  DuplicateCleanupRequestSchema,
  UpdateCleanupRequestSchema,
} from "../src/schemas/cleanups.js"
import { UpdateSettingsRequestSchema, UserProfileDTOSchema } from "../src/schemas/social.js"
import { UserDTOSchema } from "../src/schemas/auth.js"
import { PostComposeInputSchema } from "../src/schemas/posts.js"
import {
  PersonDTOSchema,
  AvatarPairSchema,
  CleanupDTOSchema,
  ReportDTOSchema,
  EventKindSchema,
  EVENT_KIND_VALUES,
  EVENT_KIND_LABELS,
  LinkedReportRefSchema,
  LinkedEventRefSchema,
  PostDTOSchema,
  PostRefDTOSchema,
} from "../src/schemas/entities.js"
import { CleanupPinDTOSchema } from "../src/schemas/map.js"
import { AdminEventDTOSchema, AdminEventListItemDTOSchema } from "../src/schemas/admin/events.js"
import { AdminReportDTOSchema } from "../src/schemas/admin/reports.js"
import { z } from "zod"


const UUID = "123e4567-e89b-12d3-a456-426614174000"

describe("REPORT_CATEGORY_LABELS", () => {
  it("has a label for every canonical report category", () => {
    for (const cat of ReportCategorySchema.options) {
      expect(typeof REPORT_CATEGORY_LABELS[cat]).toBe("string")
      expect(REPORT_CATEGORY_LABELS[cat].length).toBeGreaterThan(0)
    }
  })

  it("matches the human labels the clients previously hardcoded", () => {
    expect(REPORT_CATEGORY_LABELS).toEqual({
      trash: "Trash",
      recycling: "Recycling",
      graffiti: "Graffiti",
      hazard: "Hazard",
      encampment: "Encampment",
      water: "Water",
      other: "Other",
    })
  })

  it("sits beside the already-shared status labels (both exported)", () => {
    expect(REPORT_STATUS_LABELS.held).toBe("Under review")
  })
})

describe("MessageThreadDTO.refId", () => {
  const base = {
    id: UUID,
    kind: "cleanup" as const,
    title: "Cleanup chat",
    unread: 0,
    members: 3,
  }

  it("parses when refId is present", () => {
    const parsed = MessageThreadDTOSchema.parse({ ...base, refId: UUID })
    expect(parsed.refId).toBe(UUID)
  })

  it("parses when refId is null or omitted (backward compatible)", () => {
    expect(MessageThreadDTOSchema.parse({ ...base, refId: null }).refId).toBeNull()
    const omitted = MessageThreadDTOSchema.parse(base)
    expect(omitted.refId).toBeUndefined()
    expect(omitted.lastFromMe).toBe(false)
  })
})

describe("MessageThreadDTO.lastMessageAt", () => {
  const base = {
    id: UUID,
    kind: "cleanup" as const,
    title: "Cleanup chat",
    unread: 0,
    members: 3,
  }

  it("parses an ISO timestamp beside the server-rendered ago string", () => {
    const parsed = MessageThreadDTOSchema.parse({
      ...base,
      ago: "30m",
      lastMessageAt: "2026-06-01T11:30:00.000Z",
    })
    expect(parsed.lastMessageAt).toBe("2026-06-01T11:30:00.000Z")
    expect(parsed.ago).toBe("30m")
  })

  it("parses when lastMessageAt is null (empty room) or omitted (older server)", () => {
    expect(MessageThreadDTOSchema.parse({ ...base, lastMessageAt: null }).lastMessageAt).toBeNull()
    expect(MessageThreadDTOSchema.parse(base).lastMessageAt).toBeUndefined()
  })

  it("rejects a non-ISO timestamp", () => {
    expect(
      MessageThreadDTOSchema.safeParse({ ...base, lastMessageAt: "30m" }).success,
    ).toBe(false)
  })
})

describe("markThreadRead (PUT /threads/read)", () => {
  it("is registered as an auth+csrf v1 mutation", () => {
    const e = endpoints.markThreadRead
    expect(e.method).toBe("PUT")
    expect(e.path).toBe("/threads/read")
    expect(e.auth).toBe("required")
    expect(e.csrf).toBe(true)
    expect(e.version).toBe("v1")
  })

  it("takes the four room kinds and rejects unknown keys / kinds", () => {
    for (const roomKind of ["cleanup", "dm", "report", "group"] as const) {
      expect(MarkThreadReadRequestSchema.safeParse({ roomKind, roomId: UUID }).success).toBe(true)
    }
    expect(
      MarkThreadReadRequestSchema.safeParse({ roomKind: "report_discussion", roomId: UUID }).success,
    ).toBe(false)
    expect(
      MarkThreadReadRequestSchema.safeParse({ roomKind: "dm", roomId: UUID, upToId: UUID }).success,
    ).toBe(false)
  })

  it("answers with the minimal ok payload", () => {
    expect(MarkThreadReadResponseSchema.parse({ ok: true })).toEqual({ ok: true })
    expect(MarkThreadReadResponseSchema.safeParse({ ok: false }).success).toBe(false)
  })
})

describe("Join/Leave membership response dedup", () => {
  it("both schemas validate the identical { joined, going } shape", () => {
    const payload = { joined: true, going: 4 }
    expect(JoinCleanupResponseSchema.parse(payload)).toEqual(payload)
    expect(LeaveCleanupResponseSchema.parse(payload)).toEqual(payload)
  })

  it("both reject a negative going count", () => {
    expect(JoinCleanupResponseSchema.safeParse({ joined: false, going: -1 }).success).toBe(false)
    expect(LeaveCleanupResponseSchema.safeParse({ joined: false, going: -1 }).success).toBe(false)
  })
})

describe("UserProfileDTO derived from PersonDTO core", () => {
  it("carries the PersonDTO core keys plus pastEvents + stats", () => {
    const personKeys = Object.keys(PersonDTOSchema.shape)
    const profileKeys = Object.keys(UserProfileDTOSchema.shape)
    for (const k of personKeys) expect(profileKeys).toContain(k)
    expect(profileKeys).toContain("pastEvents")
    expect(profileKeys).toContain("stats")
  })

  it("validates a full profile payload", () => {
    const profile = {
      id: UUID,
      name: "Jane",
      handle: "jane",
      bio: null,
      avatar: ["#FF7A6B", "#6FB36F"],
      followers: 2,
      following: 1,
      isFollowing: true,
      pastEvents: [],
      stats: { reports: 4, cleanups: 2 },
    }
    expect(UserProfileDTOSchema.parse(profile)).toMatchObject({ id: UUID, name: "Jane" })
  })
})

describe("AvatarPairSchema shared fragment", () => {
  it("accepts a [from,to] tuple, null, or undefined", () => {
    const s = z.object({ avatar: AvatarPairSchema })
    expect(s.parse({ avatar: ["#111", "#222"] }).avatar).toEqual(["#111", "#222"])
    expect(s.parse({ avatar: null }).avatar).toBeNull()
    expect(s.parse({}).avatar).toBeUndefined()
  })

  it("rejects a non-2 tuple", () => {
    const s = z.object({ avatar: AvatarPairSchema })
    expect(s.safeParse({ avatar: ["#111"] }).success).toBe(false)
  })
})

describe("LatLngFields composition keeps the flat position contract", () => {
  it("validates in-bounds lat/lng on a composed DTO", () => {
    const ok = CleanupDTOSchema.safeParse({
      id: UUID,
      title: "Sweep",
      type: "site",
      lat: 34.05,
      lng: -118.24,
      scheduledAt: "2026-06-01T12:00:00.000Z",
      status: "upcoming",
      organizer: {
        id: UUID,
        name: "Org",
        followers: 0,
        following: 0,
        isFollowing: false,
      },
      going: 1,
      joined: true,
      bring: [],
    })
    expect(ok.success).toBe(true)
  })

  it("rejects out-of-bounds lat and lng via the shared bounds", () => {
    const standalone = z.object({ ...LatLngFields })
    expect(standalone.safeParse({ lat: 91, lng: 0 }).success).toBe(false)
    expect(standalone.safeParse({ lat: 0, lng: 181 }).success).toBe(false)
    expect(standalone.safeParse({ lat: -90, lng: 180 }).success).toBe(true)
  })
})

describe("event<->report linking contract additions", () => {
  const ISO = "2026-06-01T12:00:00.000Z"

  it("EventKind enum has both kinds with human labels", () => {
    expect(EVENT_KIND_VALUES).toEqual(["cleanup", "other_volunteer"])
    for (const k of EventKindSchema.options) {
      expect(typeof EVENT_KIND_LABELS[k]).toBe("string")
      expect(EVENT_KIND_LABELS[k].length).toBeGreaterThan(0)
    }
    expect(EVENT_KIND_LABELS).toEqual({ cleanup: "Cleanup", other_volunteer: "Other Volunteer" })
  })

  it("LinkedReportRefSchema parses a representative report ref", () => {
    const ref = LinkedReportRefSchema.parse({
      id: UUID,
      category: "trash",
      title: "Broken glass",
      status: "published",
      lat: 34.05,
      lng: -118.24,
      addr: "5th St",
      thumbUrl: null,
      linkedAt: ISO,
    })
    expect(ref.category).toBe("trash")
    expect(LinkedReportRefSchema.safeParse({ id: UUID, category: "water", title: "x", status: "resolved", lat: 0, lng: 0, linkedAt: ISO }).success).toBe(true)
  })

  it("LinkedEventRefSchema parses a representative event ref", () => {
    const ref = LinkedEventRefSchema.parse({
      id: UUID,
      title: "Park sweep",
      eventKind: "cleanup",
      scheduledAt: ISO,
      lat: 34.05,
      lng: -118.24,
      going: 3,
      organizer: { id: UUID, name: "Org", followers: 0, following: 0, isFollowing: false },
      linkedAt: ISO,
    })
    expect(ref.eventKind).toBe("cleanup")
    expect(ref.status).toBe("upcoming")
    expect(
      LinkedEventRefSchema.parse({
        id: UUID,
        title: "Cancelled sweep",
        eventKind: "cleanup",
        status: "cancelled",
        scheduledAt: ISO,
        lat: 0,
        lng: 0,
        going: 0,
        organizer: { id: UUID, name: "Org", followers: 0, following: 0, isFollowing: false },
        linkedAt: ISO,
      }).status,
    ).toBe("cancelled")
  })

  it("CleanupDTO defaults eventKind to 'cleanup' and linkedReports to [] (backward compatible)", () => {
    const parsed = CleanupDTOSchema.parse({
      id: UUID,
      title: "Sweep",
      type: "site",
      scheduledAt: ISO,
      status: "upcoming",
      organizer: { id: UUID, name: "Org", followers: 0, following: 0, isFollowing: false },
      going: 0,
      joined: false,
      bring: [],
      lat: 0,
      lng: 0,
    })
    expect(parsed.eventKind).toBe("cleanup")
    expect(parsed.linkedReports).toEqual([])
  })

  it("ReportDTO defaults linkedEvents to [] (backward compatible)", () => {
    expect(z.object({ linkedEvents: ReportDTOSchema.shape.linkedEvents }).parse({}).linkedEvents).toEqual([])
  })

  it("CleanupPinDTO + Admin DTOs carry the additive fields with safe defaults", () => {
    expect(z.object({ eventKind: CleanupPinDTOSchema.shape.eventKind }).parse({}).eventKind).toBe("cleanup")
    expect(z.object({ eventKind: AdminEventListItemDTOSchema.shape.eventKind }).parse({}).eventKind).toBe("cleanup")
    expect(z.object({ linkedReports: AdminEventDTOSchema.shape.linkedReports }).parse({}).linkedReports).toEqual([])
    expect(z.object({ linkedEvents: AdminReportDTOSchema.shape.linkedEvents }).parse({}).linkedEvents).toEqual([])
  })

  it("CreateCleanupRequest defaults eventKind when omitted and accepts it with linkedReportIds", () => {
    const parsed = CreateCleanupRequestSchema.parse({
      title: "Sweep",
      type: "site",
      lat: 34.05,
      lng: -118.24,
      scheduledAt: ISO,
    })
    expect(parsed.eventKind).toBe("cleanup")
    expect(parsed.linkedReportIds).toBeUndefined()
    expect(CreateCleanupRequestSchema.safeParse({ title: "S", type: "route", lat: 0, lng: 0, scheduledAt: ISO, eventKind: "other_volunteer", linkedReportIds: [UUID] }).success).toBe(true)
  })

  it("UpdateCleanupRequest is strict + all-optional beside the required id, with bounded coordinates", () => {
    expect(UpdateCleanupRequestSchema.safeParse({ id: UUID }).success).toBe(true)
    expect(UpdateCleanupRequestSchema.safeParse({}).success).toBe(false)
    expect(UpdateCleanupRequestSchema.safeParse({ id: UUID, lat: 34.05 }).success).toBe(true)
    expect(
      UpdateCleanupRequestSchema.safeParse({
        id: UUID,
        eventKind: "other_volunteer",
        linkedReportIds: [UUID],
      }).success,
    ).toBe(true)
    expect(UpdateCleanupRequestSchema.safeParse({ id: UUID, lat: 91 }).success).toBe(false)
    expect(UpdateCleanupRequestSchema.safeParse({ id: UUID, title: "x", bogus: 1 }).success).toBe(
      false,
    )
  })
})

describe("canonical report type taxonomy", () => {
  it("REPORT_TYPE_VALUES enumerates the 7 canonical types", () => {
    expect(REPORT_TYPE_VALUES).toEqual([
      "dump",
      "encampment",
      "graffiti",
      "infrastructure",
      "pavement",
      "vegetation",
      "other",
    ])
  })

  it("has a label + a valid category mapping for every type", () => {
    for (const t of ReportTypeSchema.options) {
      expect(typeof REPORT_TYPE_LABELS[t]).toBe("string")
      expect(REPORT_TYPE_LABELS[t].length).toBeGreaterThan(0)
      expect(ReportCategorySchema.safeParse(REPORT_TYPE_TO_CATEGORY[t]).success).toBe(true)
    }
    expect(REPORT_TYPE_TO_CATEGORY).toEqual({
      dump: "trash",
      encampment: "encampment",
      graffiti: "graffiti",
      infrastructure: "water",
      pavement: "hazard",
      vegetation: "recycling",
      other: "other",
    })
  })

  it("WEB_REPORT_TYPES categories agree with REPORT_TYPE_TO_CATEGORY for the overlapping ids", () => {
    const categoryOf = (id: string) => WEB_REPORT_TYPES.find((t) => t.id === id)?.category
    expect(categoryOf("infrastructure")).toBe(REPORT_TYPE_TO_CATEGORY.infrastructure)
    expect(categoryOf("vegetation")).toBe(REPORT_TYPE_TO_CATEGORY.vegetation)
    expect(categoryOf("infrastructure")).toBe("water")
    expect(categoryOf("vegetation")).toBe("recycling")
  })

  it("CreateReportRequest requires a type", () => {
    const base = {
      idempotencyKey: UUID,
      category: "trash",
      lat: 34.05,
      lng: -118.24,
      geomSource: "device",
      mediaUploadIds: [],
    }
    expect(CreateReportRequestSchema.safeParse(base).success).toBe(false)
    expect(CreateReportRequestSchema.safeParse({ ...base, type: "dump" }).success).toBe(true)
    expect(CreateReportRequestSchema.safeParse({ ...base, type: "bogus" }).success).toBe(false)
  })

  it("ListReportsSearchRequest keeps categories AND adds an optional types filter", () => {
    expect(ListReportsSearchRequestSchema.safeParse({}).success).toBe(true)
    const parsed = ListReportsSearchRequestSchema.parse({ categories: ["trash"], types: ["dump"] })
    expect(parsed.categories).toEqual(["trash"])
    expect(parsed.types).toEqual(["dump"])
    expect(ListReportsSearchRequestSchema.safeParse({ types: ["bogus"] }).success).toBe(false)
  })

  it("ReportDTO + ReportPinDTO carry an optional type (additive)", () => {
    expect(z.object({ type: ReportDTOSchema.shape.type }).parse({}).type).toBeUndefined()
    expect(z.object({ type: ReportPinDTOSchema.shape.type }).parse({ type: "graffiti" }).type).toBe(
      "graffiti",
    )
  })
})

describe("chat message reactions", () => {
  it("ChatMessageDTO.reactions defaults to [] (additive)", () => {
    expect(z.object({ reactions: ChatMessageDTOSchema.shape.reactions }).parse({}).reactions).toEqual(
      [],
    )
  })

  it("widens the reaction allowlist to 8 (append-only; laugh + sad accepted, unknowns rejected)", () => {
    expect(REACTION_EMOJIS).toEqual([
      "like",
      "heart",
      "celebrate",
      "support",
      "insightful",
      "concerned",
      "laugh",
      "sad",
    ])
    expect(ReactionEmojiSchema.safeParse("laugh").success).toBe(true)
    expect(ReactionEmojiSchema.safeParse("sad").success).toBe(true)
    expect(ReactionEmojiSchema.safeParse("angry").success).toBe(false)
  })

  it("ToggleChatReaction request schemas carry their path ids so the typed client fills the URL", () => {
    expect(
      ToggleCleanupMessageReactionRequestSchema.safeParse({
        cleanupId: UUID,
        messageId: UUID,
        emoji: "like",
      }).success,
    ).toBe(true)
    expect(
      ToggleCleanupMessageReactionRequestSchema.safeParse({ messageId: UUID, emoji: "like" }).success,
    ).toBe(false)
    expect(
      ToggleDmMessageReactionRequestSchema.safeParse({
        threadId: UUID,
        messageId: UUID,
        emoji: "heart",
      }).success,
    ).toBe(true)
  })

  it("adds a server 'reaction' frame carrying the updated message + room scope", () => {
    const msg = {
      id: UUID,
      cleanupId: UUID,
      from: { id: UUID, name: "U", handle: null, bio: null, avatar: null, followers: 0, following: 0, isFollowing: false },
      body: "hi",
      kind: "text",
      attachments: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      editedAt: null,
    }
    expect(
      WsServerMessageSchema.safeParse({ type: "reaction", cleanupId: UUID, message: msg }).success,
    ).toBe(true)
    expect(
      WsServerMessageSchema.safeParse({ type: "reaction", cleanupId: UUID, roomKind: "dm", message: msg })
        .success,
    ).toBe(true)
    expect(WsServerMessageSchema.safeParse({ type: "message", message: msg }).success).toBe(true)
  })
})

describe("user @-mentions", () => {
  it("UserMentionDTO is { id, handle, displayName }", () => {
    expect(
      UserMentionDTOSchema.safeParse({ id: UUID, handle: "jane", displayName: "Jane" }).success,
    ).toBe(true)
    expect(Object.keys(UserMentionDTOSchema.shape).sort()).toEqual(["displayName", "handle", "id"])
  })

  it("ChatMessageDTO defaults mentions to [] (additive)", () => {
    expect(z.object({ mentions: ChatMessageDTOSchema.shape.mentions }).parse({}).mentions).toEqual([])
  })

  it("the WS send client frame accepts an optional capped mentionedUserIds", () => {
    expect(
      WsClientMessageSchema.safeParse({
        type: "send",
        cleanupId: UUID,
        clientId: "c1",
        body: "hi @jane",
        mentionedUserIds: [UUID],
      }).success,
    ).toBe(true)
    expect(
      WsClientMessageSchema.safeParse({
        type: "send",
        cleanupId: UUID,
        clientId: "c1",
        body: "x",
        mentionedUserIds: Array(21).fill(UUID),
      }).success,
    ).toBe(false)
  })

  it("MentionSearchRequest requires a non-empty q (1-64), strict", () => {
    expect(MentionSearchRequestSchema.safeParse({ q: "ja" }).success).toBe(true)
    expect(MentionSearchRequestSchema.safeParse({ q: "" }).success).toBe(false)
    expect(MentionSearchRequestSchema.safeParse({ q: "x".repeat(65) }).success).toBe(false)
    expect(MentionSearchRequestSchema.safeParse({ q: "ja", extra: 1 }).success).toBe(false)
  })
})

describe("affiliation, posting as an org, duplicating an event", () => {
  const ISO_43 = "2026-09-01T10:00:00.000Z"
  const ORG_ID = "123e4567-e89b-12d3-a456-426614174009"
  const orgRef = { id: ORG_ID, slug: "reach-out-la", name: "Reach Out LA" }
  const person = { id: UUID, name: "Ada", followers: 0, following: 0, isFollowing: false }

  it("echoes the pinned affiliation on UserDTO and lets settings clear it", () => {
    const base = {
      id: UUID,
      displayName: "Ada",
      role: "citizen",
      createdAt: ISO_43,
    }
    expect(UserDTOSchema.parse(base).primaryOrganizationId).toBeUndefined()
    expect(UserDTOSchema.parse({ ...base, primaryOrganizationId: null }).primaryOrganizationId).toBeNull()
    expect(
      UserDTOSchema.parse({ ...base, primaryOrganizationId: ORG_ID }).primaryOrganizationId,
    ).toBe(ORG_ID)
    expect(UpdateSettingsRequestSchema.safeParse({ primaryOrganizationId: null }).success).toBe(true)
    expect(UpdateSettingsRequestSchema.safeParse({ primaryOrganizationId: ORG_ID }).success).toBe(
      true,
    )
    expect(UpdateSettingsRequestSchema.safeParse({ primaryOrganizationId: "nope" }).success).toBe(
      false,
    )
  })

  it("attributes a post to an org but refuses to attribute a repost", () => {
    expect(
      PostComposeInputSchema.parse({ body: "hello", organizationId: ORG_ID }).organizationId,
    ).toBe(ORG_ID)
    expect(
      PostComposeInputSchema.safeParse({ kind: "reply", replyToId: UUID, body: "hi", organizationId: ORG_ID })
        .success,
    ).toBe(true)
    expect(
      PostComposeInputSchema.safeParse({
        kind: "quote",
        repostOfId: UUID,
        body: "hi",
        organizationId: ORG_ID,
      }).success,
    ).toBe(true)
    const repost = PostComposeInputSchema.safeParse({
      kind: "repost",
      repostOfId: UUID,
      body: "hi",
      organizationId: ORG_ID,
    })
    expect(repost.success).toBe(false)
    if (!repost.success) {
      expect(repost.error.issues.some((issue) => issue.path[0] === "organizationId")).toBe(true)
    }
    expect(PostComposeInputSchema.safeParse({ body: "hi", organizationId: "nope" }).success).toBe(
      false,
    )
  })

  it("carries the org byline on PostDTO and on the embedded PostRefDTO", () => {
    const post = {
      id: UUID,
      author: person,
      kind: "post",
      body: "hello",
      createdAt: ISO_43,
      counts: { likes: 0, reposts: 0, replies: 0, saves: 0 },
      viewer: { liked: false, reposted: false, saved: false },
    }
    expect(PostDTOSchema.parse(post).organization).toBeUndefined()
    expect(PostDTOSchema.parse({ ...post, organization: orgRef }).organization?.name).toBe(
      "Reach Out LA",
    )
    expect(PostDTOSchema.parse({ ...post, organization: null }).organization).toBeNull()
    expect(
      PostRefDTOSchema.safeParse({
        id: UUID,
        author: person,
        organization: orgRef,
        kind: "post",
        excerpt: "hello",
        createdAt: ISO_43,
      }).success,
    ).toBe(true)
  })

  it("duplicates an event with ticket types and questions but not the page", () => {
    expect(DuplicateCleanupRequestSchema.parse({ id: UUID, scheduledAt: ISO_43 })).toEqual({
      id: UUID,
      scheduledAt: ISO_43,
      includeTicketTypes: true,
      includeQuestions: true,
      includePage: false,
    })
    expect(
      DuplicateCleanupRequestSchema.safeParse({ id: UUID, scheduledAt: ISO_43, endsAt: null })
        .success,
    ).toBe(true)
    expect(DuplicateCleanupRequestSchema.safeParse({ id: UUID }).success).toBe(false)
    expect(
      DuplicateCleanupRequestSchema.safeParse({ id: UUID, scheduledAt: ISO_43, title: "Copy" })
        .success,
    ).toBe(false)
    expect(endpoints.duplicateCleanup.path).toBe("/cleanups/:id/duplicate")
    expect(endpoints.duplicateCleanup.method).toBe("POST")
    expect(endpoints.duplicateCleanup.csrf).toBe(true)
    expect(endpoints.duplicateCleanup.response).toBe(endpoints.createCleanup.response)
  })

  it("retires the verified neighbor: no media purpose, no endpoints, no PersonDTO flag", () => {
    expect(MediaPurposeSchema.options).not.toContain("verification")
    expect("myVerification" in endpoints).toBe(false)
    expect("setUserVerified" in endpoints).toBe(false)
    const paths = Object.values(endpoints).map((e) => e.path)
    expect(paths).not.toContain("/me/verification")
    expect(paths).not.toContain("/admin/users/:id/verify")
    expect(paths).toContain("/orgs/:id/verification")
    expect("verified" in PersonDTOSchema.parse(person)).toBe(false)
  })
})
