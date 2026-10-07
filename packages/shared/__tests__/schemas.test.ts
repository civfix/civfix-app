import { describe, it, expect } from "vitest"
import {
  ReportCategorySchema,
  ReportStatusSchema,
  REPORT_STATUS_LABELS,
  LatLngSchema,
  PaginationQuerySchema,
  pageResponse,
  WEB_REPORT_TYPES,
  PushPlatformSchema,
  OAuthProviderSchema,
  CleanupMemberRoleSchema,
  AbuseSubjectTypeSchema,
  AbuseReasonSchema,
  AbuseSourceSchema,
  DiscoveryStatusSchema,
  ISODateSchema,
} from "../src/schemas/common.js"
import {
  EmailOtpRequestRequestSchema,
  EmailOtpVerifyRequestSchema,
  AppleSignInRequestSchema,
  OAuthStartQuerySchema,
  OAuthCallbackQuerySchema,
  SessionResponseSchema,
  SessionCheckResponseSchema,
  UserDTOSchema,
  REVIEWER_OTP_EMAIL,
  REVIEWER_OTP_CODE_MIN_LENGTH,
  REVIEWER_OTP_CODE_MAX_LENGTH,
} from "../src/schemas/auth.js"
import {
  CreateReportRequestSchema,
  ReportDTOSchema,
  ReportClusterResponseSchema,
} from "../src/schemas/reports.js"
import {
  CreateCleanupRequestSchema,
  CleanupDTOSchema,
  ListCleanupsRequestSchema,
} from "../src/schemas/cleanups.js"
import { UserProfileDTOSchema } from "../src/schemas/social.js"
import {
  ChatMessageDTOSchema,
  MessageThreadDTOSchema,
  ChatHistoryQuerySchema,
} from "../src/schemas/chat.js"
import {
  TileInfoResponseSchema,
  CleanupPinDTOSchema,
  ListCleanupsInBBoxRequestSchema,
  MapCleanupsResponseSchema,
  JurisdictionDTOSchema,
  SuggestContactRequestSchema,
} from "../src/schemas/map.js"
import { CreateMediaUploadRequestSchema } from "../src/schemas/media.js"
import { AnonReportRequestSchema } from "../src/schemas/anon.js"
import {
  NotificationPrefsDTOSchema,
  RegisterPushTokenRequestSchema,
} from "../src/schemas/notifications.js"

const UUID = "123e4567-e89b-12d3-a456-426614174000"
const UUID2 = "123e4567-e89b-12d3-a456-426614174111"

const person = {
  id: UUID,
  name: "Ada",
  handle: "ada",
  bio: null,
  avatar: ["#FF7A6B", "#6FB36F"] as [string, string],
  followers: 3,
  following: 1,
  isFollowing: false,
}

describe("common enums + taxonomy", () => {
  it("accepts every canonical report category", () => {
    for (const c of ["trash", "recycling", "graffiti", "hazard", "encampment", "water", "other"]) {
      expect(ReportCategorySchema.safeParse(c).success).toBe(true)
    }
  })

  it("rejects event as a report category", () => {
    expect(ReportCategorySchema.safeParse("event").success).toBe(false)
  })

  it("has a label for every status", () => {
    for (const s of ReportStatusSchema.options) {
      expect(typeof REPORT_STATUS_LABELS[s]).toBe("string")
    }
  })

  it("WEB_REPORT_TYPES map to valid canonical categories", () => {
    for (const t of WEB_REPORT_TYPES) {
      expect(ReportCategorySchema.safeParse(t.category).success).toBe(true)
    }
    expect(WEB_REPORT_TYPES.find((t) => t.id === "graffiti")?.category).toBe("graffiti")
    expect(WEB_REPORT_TYPES.find((t) => t.id === "dump")?.category).toBe("trash")
  })
})

describe("LatLng bounds", () => {
  it("accepts valid coordinates", () => {
    expect(LatLngSchema.safeParse({ lat: 34.05, lng: -118.24 }).success).toBe(true)
  })
  it("rejects out-of-range lat/lng", () => {
    expect(LatLngSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false)
    expect(LatLngSchema.safeParse({ lat: 0, lng: 181 }).success).toBe(false)
  })
})

describe("pagination", () => {
  it("leaves limit undefined when omitted (each service owns its default page size)", () => {
    const parsed = PaginationQuerySchema.parse({})
    expect(parsed.limit).toBeUndefined()
  })
  it("rejects limit over 50", () => {
    expect(PaginationQuerySchema.safeParse({ limit: 51 }).success).toBe(false)
  })
  it("coerces a numeric string limit (GET query params are always strings)", () => {
    const parsed = PaginationQuerySchema.parse({ limit: "3" })
    expect(parsed.limit).toBe(3)
  })
  it("enforces bounds after coercing a string limit", () => {
    expect(PaginationQuerySchema.safeParse({ limit: "51" }).success).toBe(false)
    expect(PaginationQuerySchema.safeParse({ limit: "0" }).success).toBe(false)
  })
  it("rejects a non-numeric limit string", () => {
    expect(PaginationQuerySchema.safeParse({ limit: "abc" }).success).toBe(false)
  })
  it("coerces string limit on the cleanups + chat-history query schemas too", () => {
    expect(ListCleanupsRequestSchema.parse({ limit: "5" }).limit).toBe(5)
    expect(ChatHistoryQuerySchema.parse({ limit: "5" }).limit).toBe(5)
  })
  it("chat-history query tolerates the cleanupId path-param echo (non-strict)", () => {
    const cursor = "11111111-1111-4111-8111-111111111111"
    const parsed = ChatHistoryQuerySchema.parse({ cleanupId: "ignored", before: cursor, limit: "5" })
    expect(parsed.limit).toBe(5)
    expect(parsed.before).toBe(cursor)
    expect("cleanupId" in parsed).toBe(false)
  })
  it("chat-history cursors are message ids on every room kind", () => {
    expect(ChatHistoryQuerySchema.safeParse({ before: "x" }).success).toBe(false)
  })
  it("pageResponse factory validates shape", () => {
    const schema = pageResponse(ReportCategorySchema)
    expect(schema.safeParse({ items: ["trash"], nextCursor: null }).success).toBe(true)
    expect(schema.safeParse({ items: ["nope"], nextCursor: null }).success).toBe(false)
  })
})

describe("auth schemas", () => {
  it("accepts a valid email otp request", () => {
    expect(EmailOtpRequestRequestSchema.safeParse({ email: "a@b.com" }).success).toBe(true)
  })
  it("rejects a bad email", () => {
    expect(EmailOtpRequestRequestSchema.safeParse({ email: "not-an-email" }).success).toBe(false)
  })
  it("accepts a 6-digit otp code and rejects others", () => {
    expect(
      EmailOtpVerifyRequestSchema.safeParse({ email: "a@b.com", code: "123456" }).success,
    ).toBe(true)
    expect(EmailOtpVerifyRequestSchema.safeParse({ email: "a@b.com", code: "12345" }).success).toBe(
      false,
    )
    expect(
      EmailOtpVerifyRequestSchema.safeParse({ email: "a@b.com", code: "abcdef" }).success,
    ).toBe(false)
  })
  it("accepts a reviewer-length bypass code and rejects out-of-bounds lengths", () => {
    const reviewer = "civfixReviewer2026alpha7"
    expect(reviewer.length).toBe(24)
    expect(
      EmailOtpVerifyRequestSchema.safeParse({ email: REVIEWER_OTP_EMAIL, code: reviewer }).success,
    ).toBe(true)
    expect(
      EmailOtpVerifyRequestSchema.safeParse({ email: "a@b.com", code: "a".repeat(19) }).success,
    ).toBe(false)
    expect(
      EmailOtpVerifyRequestSchema.safeParse({ email: "a@b.com", code: "a".repeat(129) }).success,
    ).toBe(false)
    expect(
      EmailOtpVerifyRequestSchema.safeParse({
        email: "a@b.com",
        code: "a".repeat(REVIEWER_OTP_CODE_MIN_LENGTH),
      }).success,
    ).toBe(true)
    expect(
      EmailOtpVerifyRequestSchema.safeParse({
        email: "a@b.com",
        code: "a".repeat(REVIEWER_OTP_CODE_MAX_LENGTH),
      }).success,
    ).toBe(true)
  })
  it("pins the reviewer bypass account and code bounds", () => {
    expect(REVIEWER_OTP_EMAIL).toBe("reviewer@civfix.org")
    expect(REVIEWER_OTP_CODE_MIN_LENGTH).toBe(20)
    expect(REVIEWER_OTP_CODE_MAX_LENGTH).toBe(128)
  })
  it("strict request rejects unknown keys", () => {
    expect(AppleSignInRequestSchema.safeParse({ identityToken: "x", extra: 1 }).success).toBe(false)
  })
  it("our own OAuth start query is strict (rejects unknown keys)", () => {
    expect(OAuthStartQuerySchema.safeParse({ redirect: "/home", utm: "x" }).success).toBe(false)
  })
  it("the OAuth callback query strips provider-appended keys (Google sends iss/scope/authuser/prompt/hd)", () => {
    const parsed = OAuthCallbackQuerySchema.parse({
      code: "4/0Adk",
      state: "abc",
      iss: "https://accounts.google.com",
      scope: "email profile openid",
      authuser: "0",
      prompt: "consent",
      hd: "example.com",
    })
    expect(parsed).toEqual({ code: "4/0Adk", state: "abc" })
    expect(OAuthCallbackQuerySchema.safeParse({ state: "abc" }).success).toBe(false)
    expect(OAuthCallbackQuerySchema.safeParse({ code: "x", state: "" }).success).toBe(false)
  })
  it("round-trips a SessionResponse (with an account email on the user)", () => {
    const user = UserDTOSchema.parse({
      id: UUID,
      displayName: "Ada",
      handle: "ada",
      email: "ada@example.com",
      role: "citizen",
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    expect(user.email).toBe("ada@example.com")
    expect(SessionResponseSchema.safeParse({ user, token: "bearer-x" }).success).toBe(true)
  })

  it("UserDTO email is optional/nullable and a bad email is rejected", () => {
    expect(
      UserDTOSchema.safeParse({
        id: UUID,
        displayName: "NoEmail",
        role: "citizen",
        createdAt: "2026-01-01T00:00:00.000Z",
      }).success,
    ).toBe(true)
    expect(
      UserDTOSchema.safeParse({
        id: UUID,
        displayName: "NullEmail",
        email: null,
        role: "citizen",
        createdAt: "2026-01-01T00:00:00.000Z",
      }).success,
    ).toBe(true)
    expect(
      UserDTOSchema.safeParse({
        id: UUID,
        displayName: "BadEmail",
        email: "not-an-email",
        role: "citizen",
        createdAt: "2026-01-01T00:00:00.000Z",
      }).success,
    ).toBe(false)
  })

  it("SessionCheckResponse composes with optional enabledProviders", () => {
    expect(
      SessionCheckResponseSchema.safeParse({ authenticated: false, roles: [] }).success,
    ).toBe(true)
    const parsed = SessionCheckResponseSchema.parse({
      authenticated: false,
      roles: [],
      enabledProviders: ["apple", "google", "email"],
    })
    expect(parsed.enabledProviders).toEqual(["apple", "google", "email"])
    expect(
      SessionCheckResponseSchema.safeParse({
        authenticated: false,
        roles: [],
        enabledProviders: ["facebook"],
      }).success,
    ).toBe(false)
  })

  it("SessionCheckResponse carries an optional csrfToken for SPA recovery", () => {
    expect(
      SessionCheckResponseSchema.safeParse({ authenticated: true, roles: ["citizen"] }).success,
    ).toBe(true)
    const parsed = SessionCheckResponseSchema.parse({
      authenticated: true,
      roles: ["citizen"],
      csrfToken: "csrf-abc123",
    })
    expect(parsed.csrfToken).toBe("csrf-abc123")
  })
})

describe("report schemas", () => {
  const validCreate = {
    idempotencyKey: UUID,
    category: "trash",
    type: "dump",
    description: "Pile of trash",
    lat: 34.05,
    lng: -118.24,
    geomSource: "device",
    mediaUploadIds: [UUID2],
  }

  it("accepts a valid CreateReportRequest", () => {
    expect(CreateReportRequestSchema.safeParse(validCreate).success).toBe(true)
  })
  it("rejects an oversized description", () => {
    expect(
      CreateReportRequestSchema.safeParse({ ...validCreate, description: "x".repeat(2001) })
        .success,
    ).toBe(false)
  })
  it("rejects more than 5 media ids", () => {
    expect(
      CreateReportRequestSchema.safeParse({
        ...validCreate,
        mediaUploadIds: Array(6).fill(UUID2),
      }).success,
    ).toBe(false)
  })
  it("round-trips a full ReportDTO", () => {
    const dto = {
      id: UUID,
      category: "graffiti",
      title: null,
      description: "tag on wall",
      addr: null,
      status: "published",
      visibility: "public",
      lat: 34.05,
      lng: -118.24,
      geomSource: "device",
      jurisdictionGeoid: "0644000",
      createdAt: "2026-01-01T00:00:00.000Z",
      publishedAt: "2026-01-02T00:00:00.000Z",
      mine: true,
      gov: false,
      following: false,
      media: [],
      timeline: [{ status: "submitted", at: "2026-01-01T00:00:00.000Z", note: null }],
    }
    expect(ReportDTOSchema.safeParse(dto).success).toBe(true)
  })
})

describe("cleanup + chat schemas", () => {
  it("accepts a valid CreateCleanupRequest and rejects a too-long title", () => {
    const base = {
      title: "Beach cleanup",
      type: "site",
      lat: 34.0,
      lng: -118.5,
      scheduledAt: "2026-06-01T17:00:00.000Z",
    }
    expect(CreateCleanupRequestSchema.safeParse(base).success).toBe(true)
    expect(CreateCleanupRequestSchema.safeParse({ ...base, title: "x".repeat(121) }).success).toBe(
      false,
    )
  })
  it("CreateCleanupRequest carries an optional address, capped at 200 chars", () => {
    const base = {
      title: "Beach cleanup",
      type: "site",
      lat: 34.0,
      lng: -118.5,
      scheduledAt: "2026-06-01T17:00:00.000Z",
    }
    expect(CreateCleanupRequestSchema.safeParse(base).success).toBe(true)
    const parsed = CreateCleanupRequestSchema.parse({ ...base, address: "Santa Monica Pier" })
    expect(parsed.address).toBe("Santa Monica Pier")
    expect(
      CreateCleanupRequestSchema.safeParse({ ...base, address: "x".repeat(201) }).success,
    ).toBe(false)
    expect(CreateCleanupRequestSchema.safeParse({ ...base, bogus: 1 }).success).toBe(false)
  })
  it("round-trips a CleanupDTO with organizer person; address defaults to null", () => {
    const dto = {
      id: UUID,
      title: "Park cleanup",
      type: "route",
      description: null,
      lat: 34.0,
      lng: -118.5,
      scheduledAt: "2026-06-01T17:00:00.000Z",
      status: "upcoming",
      organizer: person,
      going: 4,
      joined: true,
      bring: ["gloves"],
      dist: 1.2,
    }
    const parsed = CleanupDTOSchema.parse(dto)
    expect(parsed.address).toBeNull()
    const withAddr = CleanupDTOSchema.parse({ ...dto, address: "123 Main St, Los Angeles, CA" })
    expect(withAddr.address).toBe("123 Main St, Los Angeles, CA")
  })
  it("round-trips a ChatMessageDTO", () => {
    const msg = {
      id: UUID,
      cleanupId: UUID2,
      from: person,
      body: "hi",
      kind: "text",
      attachments: null,
      createdAt: "2026-06-01T17:00:00.000Z",
      editedAt: null,
      clientId: "c-1",
    }
    expect(ChatMessageDTOSchema.safeParse(msg).success).toBe(true)
  })
  it("UserProfileDTO carries an optional avatar gradient matching PersonDTO", () => {
    const base = {
      id: UUID,
      name: "Ada",
      handle: "ada",
      bio: null,
      followers: 3,
      following: 1,
      isFollowing: false,
      pastEvents: [],
      stats: { reports: 2, cleanups: 1 },
    }
    expect(UserProfileDTOSchema.safeParse(base).success).toBe(true)
    const parsed = UserProfileDTOSchema.parse({ ...base, avatar: ["#FF7A6B", "#6FB36F"] })
    expect(parsed.avatar).toEqual(["#FF7A6B", "#6FB36F"])
    expect(UserProfileDTOSchema.parse({ ...base, avatar: null }).avatar).toBeNull()
  })
})

describe("media + anon + prefs", () => {
  it("enforces per-kind byte limits", () => {
    const img = { kind: "image", contentType: "image/jpeg", byteSize: 10_000_000, sha256: "abc" }
    expect(CreateMediaUploadRequestSchema.safeParse(img).success).toBe(true)
    const bigImg = { ...img, byteSize: 20 * 1024 * 1024 }
    expect(CreateMediaUploadRequestSchema.safeParse(bigImg).success).toBe(false)
    const vid = { kind: "video", contentType: "video/mp4", byteSize: 40 * 1024 * 1024, sha256: "x" }
    expect(CreateMediaUploadRequestSchema.safeParse(vid).success).toBe(true)
    const bigVid = { ...vid, byteSize: 60 * 1024 * 1024 }
    expect(CreateMediaUploadRequestSchema.safeParse(bigVid).success).toBe(false)
  })
  it("requires a turnstile token on anon reports", () => {
    const ok = {
      idempotencyKey: UUID,
      turnstileToken: "tok",
      category: "trash",
      type: "dump",
      lat: 34,
      lng: -118,
      geomSource: "device",
      mediaUploadIds: [],
    }
    expect(AnonReportRequestSchema.safeParse(ok).success).toBe(true)
    expect(AnonReportRequestSchema.safeParse({ ...ok, turnstileToken: "" }).success).toBe(false)
  })
  it("accepts notification prefs with and without quiet hours", () => {
    const base = {
      push: true,
      cleanupChat: true,
      reportUpdates: false,
      follows: true,
      mentions: true,
      postInteractions: true,
    }
    expect(NotificationPrefsDTOSchema.safeParse(base).success).toBe(true)
    expect(
      NotificationPrefsDTOSchema.safeParse({
        ...base,
        quietHours: { start: "22:00", end: "07:00" },
      }).success,
    ).toBe(true)
  })
})

describe("new standalone enums", () => {
  it("PushPlatformSchema accepts its members and rejects others", () => {
    for (const v of ["ios", "android", "web"]) {
      expect(PushPlatformSchema.safeParse(v).success).toBe(true)
    }
    expect(PushPlatformSchema.safeParse("desktop").success).toBe(false)
  })

  it("RegisterPushTokenRequest.platform is backed by PushPlatformSchema", () => {
    expect([...RegisterPushTokenRequestSchema.shape.platform.options]).toEqual([
      ...PushPlatformSchema.options,
    ])
    expect(
      RegisterPushTokenRequestSchema.safeParse({ platform: "ios", token: "t" }).success,
    ).toBe(true)
    expect(
      RegisterPushTokenRequestSchema.safeParse({ platform: "desktop", token: "t" }).success,
    ).toBe(false)
  })

  it("OAuthProviderSchema = apple|google|email", () => {
    expect([...OAuthProviderSchema.options]).toEqual(["apple", "google", "email"])
    expect(OAuthProviderSchema.safeParse("facebook").success).toBe(false)
  })

  it("CleanupMemberRoleSchema = organizer|cohost|member|staff|coordinator (order mirrored by backend enums.test.ts)", () => {
    expect([...CleanupMemberRoleSchema.options]).toEqual([
      "organizer",
      "cohost",
      "member",
      "staff",
      "coordinator",
    ])
    expect(CleanupMemberRoleSchema.safeParse("attendee").success).toBe(false)
  })

  it("abuse enums carry their canonical members", () => {
    expect([...AbuseSubjectTypeSchema.options]).toEqual(["report", "media", "user", "anon_token"])
    expect([...AbuseReasonSchema.options]).toEqual([
      "nsfw",
      "phash_dup",
      "honeypot",
      "gps",
      "manual",
      "other",
    ])
    expect([...AbuseSourceSchema.options]).toEqual(["worker", "api", "user_report"])
    expect(AbuseReasonSchema.safeParse("spam").success).toBe(false)
  })

  it("DiscoveryStatusSchema = open|in_progress|done", () => {
    expect([...DiscoveryStatusSchema.options]).toEqual(["open", "in_progress", "done"])
    expect(DiscoveryStatusSchema.safeParse("closed").success).toBe(false)
  })
})

describe("refined response fields stay backward compatible", () => {
  it("ReportClusterResponse parses without counts and with a partial per-category record", () => {
    const base = { clusters: [], pins: [] }
    expect(ReportClusterResponseSchema.safeParse(base).success).toBe(true)
    const withCounts = ReportClusterResponseSchema.parse({
      ...base,
      counts: { trash: 3, graffiti: 1 },
    })
    expect(withCounts.counts).toEqual({ trash: 3, graffiti: 1 })
    expect(
      ReportClusterResponseSchema.safeParse({ ...base, counts: { event: 2 } }).success,
    ).toBe(false)
  })

  it("MessageThreadDTO.lastFromMe defaults to false and accepts true", () => {
    const base = { id: UUID, kind: "cleanup", title: "Crew", unread: 0, members: 3 }
    const parsed = MessageThreadDTOSchema.parse(base)
    expect(parsed.lastFromMe).toBe(false)
    expect(MessageThreadDTOSchema.parse({ ...base, lastFromMe: true }).lastFromMe).toBe(true)
  })

  it("TileInfoResponse keeps pmtilesUrl and allows raster/style fallbacks", () => {
    const base = {
      pmtilesUrl: "https://tiles.example/base.pmtiles",
      attribution: "(c) civfix",
      minZoom: 0,
      maxZoom: 14,
      bounds: [-118.7, 33.7, -118.1, 34.3] as [number, number, number, number],
    }
    expect(TileInfoResponseSchema.safeParse(base).success).toBe(true)
    const withFallbacks = TileInfoResponseSchema.parse({
      ...base,
      rasterUrl: "https://tiles.example/{z}/{x}/{y}.png",
      styleUrl: "https://tiles.example/style.json",
    })
    expect(withFallbacks.rasterUrl).toContain("{z}")
    expect(withFallbacks.styleUrl).toContain("style.json")
  })
})

describe("map cleanups contract", () => {
  it("CleanupPinDTO round-trips and coerces scheduledAt to an ISO string", () => {
    const pin = CleanupPinDTOSchema.parse({
      id: UUID,
      lat: 34.05,
      lng: -118.24,
      scheduledAt: "2026-06-01T17:00:00.000Z",
      going: 5,
    })
    expect(pin.scheduledAt).toBe("2026-06-01T17:00:00.000Z")
  })

  it("ListCleanupsInBBoxRequest requires a bbox, allows an optional when, rejects extras", () => {
    const bbox = { west: -118.7, south: 33.7, east: -118.1, north: 34.3 }
    expect(ListCleanupsInBBoxRequestSchema.safeParse({ bbox }).success).toBe(true)
    expect(ListCleanupsInBBoxRequestSchema.safeParse({ bbox, when: "upcoming" }).success).toBe(true)
    expect(ListCleanupsInBBoxRequestSchema.safeParse({ when: "past" }).success).toBe(false)
    expect(ListCleanupsInBBoxRequestSchema.safeParse({ bbox, extra: 1 }).success).toBe(false)
  })

  it("MapCleanupsResponse wraps a pins array", () => {
    expect(MapCleanupsResponseSchema.safeParse({ pins: [] }).success).toBe(true)
  })
})

describe("jurisdiction routing contract", () => {
  const base = {
    geoid: "0644000",
    name: "Los Angeles",
    layer: "place",
    cityStateLabel: "Los Angeles, CA",
  }

  it("JurisdictionDTO requires the routable flag", () => {
    expect(JurisdictionDTOSchema.safeParse(base).success).toBe(false)
    expect(JurisdictionDTOSchema.parse({ ...base, routable: true }).routable).toBe(true)
  })

  it("SuggestContactRequest requires an email or a form URL", () => {
    expect(SuggestContactRequestSchema.safeParse({ geoid: "0644000" }).success).toBe(false)
    expect(
      SuggestContactRequestSchema.safeParse({ geoid: "0644000", email: "311@city.gov" }).success,
    ).toBe(true)
    expect(
      SuggestContactRequestSchema.safeParse({
        geoid: "0644000",
        formUrl: "https://city.gov/report",
      }).success,
    ).toBe(true)
    expect(
      SuggestContactRequestSchema.safeParse({ geoid: "0644000", email: "not-an-email" }).success,
    ).toBe(false)
  })
})

describe("ISODateSchema", () => {
  it("accepts ISO strings and Dates, normalizing both to an ISO string", () => {
    expect(ISODateSchema.parse("2026-07-24T17:00:00.000Z")).toBe("2026-07-24T17:00:00.000Z")
    expect(ISODateSchema.parse(new Date(Date.UTC(2026, 6, 24)))).toBe("2026-07-24T00:00:00.000Z")
  })

  it("rejects null, booleans, numbers, and objects instead of coercing them to the epoch", () => {
    for (const bad of [null, false, true, 0, 1_700_000_000_000, {}, []]) {
      expect(ISODateSchema.safeParse(bad).success).toBe(false)
    }
  })

  it("rejects a string that is not a date", () => {
    expect(ISODateSchema.safeParse("not-a-date").success).toBe(false)
    expect(ISODateSchema.safeParse("").success).toBe(false)
  })

  it("still lets .optional() skip an omitted field", () => {
    expect(ISODateSchema.optional().safeParse(undefined).success).toBe(true)
  })
})
