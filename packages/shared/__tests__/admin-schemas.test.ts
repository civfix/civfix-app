import { describe, it, expect } from "vitest"
import {
  AdminListQuerySchema,
  ADMIN_REPORT_STATUS_LABELS,
  AdminReportStatusSchema,
  EventStatusSchema,
  EVENT_STATUS_LABELS,
  MailStatusSchema,
  MAIL_STATUS_LABELS,
  UserStatusSchema,
  USER_STATUS_LABELS,
  RiskSchema,
  RISK_LABELS,
  ModerationKindSchema,
  ModerationToneSchema,
  GovVerificationCheckSchema,
  GovCheckStatusSchema,
  GovMethodSchema,
  DiscoveryReviewStatusSchema,
} from "../src/schemas/admin/common.js"
import {
  AdminSessionResponseSchema,
  AdminOperatorDTOSchema,
} from "../src/schemas/admin/auth.js"
import { HomeSummaryResponseSchema, HomeMapResponseSchema } from "../src/schemas/admin/home.js"
import {
  DiscoveryTaskDTOSchema,
  DiscoveryListQuerySchema,
  DiscoveryListResponseSchema,
  AddNoteRequestSchema,
} from "../src/schemas/admin/discovery.js"
import {
  SaveContactsRequestSchema,
  JurisdictionDirectoryDTOSchema,
  JurisdictionListQuerySchema,
  PatchJurisdictionRequestSchema,
} from "../src/schemas/admin/jurisdictions.js"
import {
  FORWARD_TEMPLATE_VARIABLES,
  interpolateForwardTemplate,
} from "../src/schemas/admin/forward-template.js"
import {
  AdminReportListItemDTOSchema,
  AdminReportDTOSchema,
  SetReportStatusRequestSchema,
  SendFollowupRequestSchema,
} from "../src/schemas/admin/reports.js"
import { AdminEventDTOSchema, SetEventStatusRequestSchema } from "../src/schemas/admin/events.js"
import {
  AdminAddOrgMemberRequestSchema,
  AdminCreateOrgRequestSchema,
  AdminOrgDTOSchema,
  AdminOrgEventListRequestSchema,
  AdminOrgEventListResponseSchema,
  AdminOrgListQuerySchema,
  AdminOrgListResponseSchema,
  AdminOrgMemberListRequestSchema,
  AdminOrgMemberListResponseSchema,
  AdminRemoveOrgMemberRequestSchema,
  AdminSetOrgMemberRoleRequestSchema,
  AdminSetOrgSuspendedRequestSchema,
  AdminUpdateOrgRequestSchema,
} from "../src/schemas/admin/orgs.js"
import {
  AdminUserDTOSchema,
  AdminUserListItemDTOSchema,
  SetUserStatusRequestSchema,
  UserMessagesResponseSchema,
  UserReportsResponseSchema,
} from "../src/schemas/admin/users.js"
import {
  GovClaimDTOSchema,
  VerifyCheckRequestSchema,
  RejectGovClaimRequestSchema,
} from "../src/schemas/admin/gov.js"
import {
  ModerationListItemDTOSchema,
  ModerationItemDTOSchema,
  AppealModerationRequestSchema,
} from "../src/schemas/admin/moderation.js"
import {
  MailThreadListItemDTOSchema,
  MailStatsResponseSchema,
  ComposeRequestSchema,
} from "../src/schemas/admin/mail.js"
import {
  AnalyticsByCategoryResponseSchema,
  AnalyticsKpisResponseSchema,
  AnalyticsRetentionResponseSchema,
} from "../src/schemas/admin/analytics.js"
import { ActivityItemDTOSchema } from "../src/schemas/admin/activity.js"
import { AuditLogEntryDTOSchema, AuditListQuerySchema } from "../src/schemas/admin/audit.js"
import { SystemHealthResponseSchema } from "../src/schemas/admin/system.js"

const UUID = "123e4567-e89b-12d3-a456-426614174000"

const actor = {
  id: UUID,
  name: "Ada Neighbor",
  handle: "ada",
  joined: "Jan 2026",
}

describe("admin enums + label maps", () => {
  it("reuses the civfix report-status enum (NOT the design's in-progress/completed)", () => {
    for (const s of AdminReportStatusSchema.options) {
      expect(typeof ADMIN_REPORT_STATUS_LABELS[s]).toBe("string")
    }
    // The design's hyphenated form is not a member.
    expect(AdminReportStatusSchema.safeParse("in-progress").success).toBe(false)
    expect(AdminReportStatusSchema.safeParse("in_progress").success).toBe(true)
    // "removed" is the label for the rejected status (Remove report -> rejected).
    expect(ADMIN_REPORT_STATUS_LABELS.rejected).toBe("Removed")
  })

  it("event status adds cancelled and uses the underscore form", () => {
    expect([...EventStatusSchema.options]).toEqual([
      "upcoming",
      "in_progress",
      "completed",
      "cancelled",
    ])
    for (const s of EventStatusSchema.options) {
      expect(typeof EVENT_STATUS_LABELS[s]).toBe("string")
    }
    expect(EventStatusSchema.safeParse("in-progress").success).toBe(false)
  })

  it("mail status uses needs_action (underscore) and has a full label map", () => {
    expect(MailStatusSchema.safeParse("needs_action").success).toBe(true)
    expect(MailStatusSchema.safeParse("needs-action").success).toBe(false)
    for (const s of MailStatusSchema.options) {
      expect(typeof MAIL_STATUS_LABELS[s]).toBe("string")
    }
  })

  it("user status is active|suspended|review|banned with labels", () => {
    expect([...UserStatusSchema.options]).toEqual(["active", "suspended", "review", "banned"])
    for (const s of UserStatusSchema.options) {
      expect(typeof USER_STATUS_LABELS[s]).toBe("string")
    }
  })

  it("risk is low|watch|elevated|high with labels", () => {
    expect([...RiskSchema.options]).toEqual(["low", "watch", "elevated", "high"])
    for (const s of RiskSchema.options) {
      expect(typeof RISK_LABELS[s]).toBe("string")
    }
  })

  it("moderation, gov, and discovery-review enums carry their canonical members", () => {
    expect([...ModerationKindSchema.options]).toEqual([
      "image",
      "pattern",
      "appeal",
      "gps",
      "duplicate",
      "user_report",
    ])
    expect([...ModerationToneSchema.options]).toEqual(["ok", "warn", "bad"])
    expect([...GovVerificationCheckSchema.options]).toEqual(["linkedin", "directory", "callback"])
    expect([...GovCheckStatusSchema.options]).toEqual(["verified", "pending"])
    expect([...GovMethodSchema.options]).toEqual(["email", "cold_outreach"])
    expect([...DiscoveryReviewStatusSchema.options]).toEqual(["open", "in_progress", "done"])
  })
})

describe("admin list query", () => {
  it("coerces a numeric string limit and is non-strict (tolerates extra facets)", () => {
    const parsed = AdminListQuerySchema.parse({ q: "wayne", filter: "attention", limit: "20" })
    expect(parsed.limit).toBe(20)
    expect(parsed.q).toBe("wayne")
    // Non-strict: a per-domain extra (e.g. geoid) does not throw at the base.
    expect(AdminListQuerySchema.safeParse({ geoid: "0644000" }).success).toBe(true)
  })
  it("rejects a limit over the 100 cap", () => {
    expect(AdminListQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
  })
})

describe("admin auth schemas", () => {
  it("round-trips an operator session and rejects unknown keys (strict)", () => {
    const operator = { id: UUID, name: "Op", email: "op@civfix.org", role: "operator" }
    expect(AdminOperatorDTOSchema.safeParse(operator).success).toBe(true)
    expect(AdminOperatorDTOSchema.safeParse({ ...operator, extra: 1 }).success).toBe(false)
    expect(
      AdminSessionResponseSchema.safeParse({ authenticated: true, operator, csrfToken: "x" })
        .success,
    ).toBe(true)
    expect(AdminSessionResponseSchema.safeParse({ authenticated: false }).success).toBe(true)
  })
})

describe("home aggregates", () => {
  it("round-trips a full HomeSummaryResponse", () => {
    const summary = {
      discovery: { queue: 12, reportsWaiting: 40, overSla: 3 },
      reports: { flagged: 2, inProgress: 7, completed: 31 },
      events: { upcoming: 5, live: 1, attending: 88 },
      mail: { unread: 4, needsAction: 2 },
      users: { flagged: 1, highRisk: 2, suspended: 0 },
      analytics: {
        pinsThisMonth: 240,
        resolvedPct: 89,
        coveragePct: 62,
        cleanups: 34,
        eventsThisMonth: 12,
        newUsers: 140,
        pinsByWeek: [10, 20, 15, 30, 25, 40, 35, 50],
      },
      livePins24h: 18,
    }
    expect(HomeSummaryResponseSchema.safeParse(summary).success).toBe(true)
    // strict: a stray top-level key is rejected.
    expect(HomeSummaryResponseSchema.safeParse({ ...summary, bogus: 1 }).success).toBe(false)
  })

  it("validates a HomeMapResponse with report + event pins", () => {
    const res = {
      pins: [
        {
          refType: "report",
          id: "REP-1",
          lat: 38.0,
          lng: -78.9,
          category: "trash",
          status: "submitted",
          flagged: true,
          title: "Dumping",
          place: "Waynesboro, VA",
        },
        {
          refType: "event",
          id: "EVT-1",
          lat: 38.1,
          lng: -78.8,
          category: null,
          status: "upcoming",
          flagged: false,
          title: "Park cleanup",
          place: "Waynesboro, VA",
          attendees: 12,
        },
      ],
    }
    expect(HomeMapResponseSchema.safeParse(res).success).toBe(true)
  })
})

describe("discovery schemas", () => {
  const task = {
    id: "JUR-1",
    geoid: "0644000",
    place: "Waynesboro, VA",
    layer: "place",
    category: "trash",
    catLabel: "Trash",
    pop: 22_630,
    reports: 8,
    perCategoryCounts: { trash: 5, hazard: 3 },
    lastReport: "2h ago",
    age: "26h",
    overSla: true,
    priority: "high",
    contactState: { routed: ["graffiti"], missing: ["trash", "hazard"] },
    notes: [{ text: "Called the city", who: "op", when: "yesterday" }],
  }

  it("round-trips a DiscoveryTaskDTO and rejects an unknown category in the counts map", () => {
    expect(DiscoveryTaskDTOSchema.safeParse(task).success).toBe(true)
    expect(
      DiscoveryTaskDTOSchema.safeParse({
        ...task,
        perCategoryCounts: { cleanup: 2 },
      }).success,
    ).toBe(false)
  })

  it("discovery list query takes the attention/clear facet + pop/reports sort", () => {
    expect(
      DiscoveryListQuerySchema.safeParse({ filter: "attention", sort: "reports" }).success,
    ).toBe(true)
    expect(DiscoveryListQuerySchema.safeParse({ filter: "bogus" }).success).toBe(false)
  })

  it("paginates a discovery list response", () => {
    const res = DiscoveryListResponseSchema.parse({ items: [task], nextCursor: null })
    expect(res.items).toHaveLength(1)
    expect(res.nextCursor).toBeNull()
  })

  it("AddNoteRequest requires non-empty text + the task id", () => {
    expect(AddNoteRequestSchema.safeParse({ id: "JUR-1", text: "hi" }).success).toBe(true)
    expect(AddNoteRequestSchema.safeParse({ id: "JUR-1", text: "" }).success).toBe(false)
  })
})

describe("jurisdictions schemas", () => {
  it("SaveContactsRequest takes a per-category email map + form url and rejects a bad category", () => {
    expect(
      SaveContactsRequestSchema.safeParse({
        geoid: "0644000",
        contacts: { trash: "sanitation@city.gov", water: null },
        defaultEmails: ["info@city.gov"],
        formUrl: "https://city.gov/report",
        forwardSubjectTemplate: "Report {title}",
        forwardBodyTemplate: "Please review {description}",
      }).success,
    ).toBe(true)
    expect(
      SaveContactsRequestSchema.safeParse({ geoid: "0644000", contacts: { cleanup: "x@city.gov" } })
        .success,
    ).toBe(false)
    // strict: unknown top-level key rejected.
    expect(SaveContactsRequestSchema.safeParse({ geoid: "0644000", bogus: 1 }).success).toBe(false)
  })

  it("validates a JurisdictionDirectoryDTO row", () => {
    const row = {
      geoid: "0644000",
      org: "City of Waynesboro",
      dept: "Public Works",
      email: "pw@waynesboro.gov",
      form: null,
      method: "email",
      status: "verified",
      coverage: "All categories",
      lastRouted: "3d ago",
      layer: "place",
      population: 22630,
      reportsWaiting: 8,
      perCategoryCounts: { trash: 5, hazard: 3 },
      contacts: [{ category: "trash", email: "pw@waynesboro.gov" }],
      flaggedAt: null,
      handle: "waynesboro",
      oldestReportAt: "2026-06-01T12:00:00.000Z",
      forwardSubjectTemplate: null,
      forwardBodyTemplate: null,
    }
    expect(JurisdictionDirectoryDTOSchema.safeParse(row).success).toBe(true)
    expect(JurisdictionDirectoryDTOSchema.safeParse({ ...row, method: "fax" }).success).toBe(false)
    // handle is part of the contract (nullable) - a null handle is valid; a missing one is not (strict).
    expect(JurisdictionDirectoryDTOSchema.safeParse({ ...row, handle: null }).success).toBe(true)
  })

  it("PatchJurisdictionRequest normalizes + validates the @handle", () => {
    // Strips a leading "@", trims, lowercases -> a bare slug.
    expect(PatchJurisdictionRequestSchema.parse({ geoid: "1", handle: "  @SF_Bay " }).handle).toBe(
      "sf_bay",
    )
    // Empty string clears the handle (-> null).
    expect(PatchJurisdictionRequestSchema.parse({ geoid: "1", handle: "" }).handle).toBeNull()
    // An explicit null also clears it.
    expect(PatchJurisdictionRequestSchema.parse({ geoid: "1", handle: null }).handle).toBeNull()
    // Omitted -> undefined (leave unchanged).
    expect(PatchJurisdictionRequestSchema.parse({ geoid: "1" }).handle).toBeUndefined()
    // Illegal characters (spaces, punctuation) + too-short are rejected.
    expect(
      PatchJurisdictionRequestSchema.safeParse({ geoid: "1", handle: "san francisco" }).success,
    ).toBe(false)
    expect(PatchJurisdictionRequestSchema.safeParse({ geoid: "1", handle: "a" }).success).toBe(false)
  })

  it("accepts the new oldest sort + needs_mapping filter and the template overrides", () => {
    expect(JurisdictionListQuerySchema.safeParse({ sort: "oldest" }).success).toBe(true)
    expect(JurisdictionListQuerySchema.safeParse({ filter: "needs_mapping" }).success).toBe(true)
    // existing values still parse
    expect(JurisdictionListQuerySchema.safeParse({ sort: "population", filter: "none" }).success).toBe(
      true,
    )
    expect(JurisdictionListQuerySchema.safeParse({ sort: "bogus" }).success).toBe(false)
    // template overrides accept a string or explicit null (clear); over-long is rejected.
    expect(
      PatchJurisdictionRequestSchema.safeParse({
        geoid: "1",
        forwardSubjectTemplate: "Report {referenceCode}",
        forwardBodyTemplate: null,
      }).success,
    ).toBe(true)
    expect(
      PatchJurisdictionRequestSchema.safeParse({ geoid: "1", forwardSubjectTemplate: "x".repeat(301) })
        .success,
    ).toBe(false)
  })

  it("interpolateForwardTemplate fills known tokens, leaves unknown ones, and HTML is caller's job", () => {
    const out = interpolateForwardTemplate(
      "Ref {referenceCode} at {address} — {unknownToken} {reporterName}",
      { referenceCode: "CVX-2K4P", address: "100 Main St", reporterName: "" },
    )
    // known tokens replaced (missing/empty value -> ""), unknown token left verbatim
    expect(out).toBe("Ref CVX-2K4P at 100 Main St — {unknownToken} ")
    // no HTML escaping is performed by the helper (caller must escape)
    expect(interpolateForwardTemplate("{title}", { title: "<b>hi</b>" })).toBe("<b>hi</b>")
    // every palette token is a {curly} string and interpolates to its value
    for (const v of FORWARD_TEMPLATE_VARIABLES) {
      expect(v.token.startsWith("{") && v.token.endsWith("}")).toBe(true)
      const bare = v.token.slice(1, -1)
      expect(interpolateForwardTemplate(v.token, { [bare]: "OK" })).toBe("OK")
    }
  })
})

describe("reports schemas", () => {
  const listItem = {
    id: "REP-1",
    category: "graffiti",
    status: "in_progress",
    flagged: false,
    title: "Tag on wall",
    place: "Waynesboro, VA",
    reporter: actor,
    confirmations: 3,
    submitted: { rel: "2h ago", abs: "Jun 3, 2026, 4:12 PM" },
    coords: [38.0, -78.9],
    address: "100 Main St",
    hasPhoto: true,
  }

  it("round-trips an AdminReportListItemDTO with the civfix status enum", () => {
    expect(AdminReportListItemDTOSchema.safeParse(listItem).success).toBe(true)
    expect(
      AdminReportListItemDTOSchema.safeParse({
        ...listItem,
        reporter: { ...listItem.reporter, id: null },
      }).success,
    ).toBe(true)
    expect(
      AdminReportListItemDTOSchema.safeParse({ ...listItem, status: "completed" }).success,
    ).toBe(false)
  })

  it("extends to a detail DTO with timeline + routing + media", () => {
    const detail = {
      ...listItem,
      desc: "Spray paint",
      timeline: [{ who: "Ada", what: "Submitted", when: "2h ago", kind: "submit" }],
      city: { dept: "Public Works", place: "Waynesboro, VA", contact: "pw@city.gov", routed: true },
      media: [{ id: "m1", kind: "image", url: "https://r2/x.jpg" }],
    }
    expect(AdminReportDTOSchema.safeParse(detail).success).toBe(true)
  })

  it("SetReportStatus only accepts civfix statuses; followup targets reporter|city", () => {
    expect(
      SetReportStatusRequestSchema.safeParse({ id: "REP-1", status: "resolved" }).success,
    ).toBe(true)
    expect(
      SetReportStatusRequestSchema.safeParse({ id: "REP-1", status: "completed" }).success,
    ).toBe(false)
    expect(
      SendFollowupRequestSchema.safeParse({ id: "REP-1", to: "city", body: "Following up" })
        .success,
    ).toBe(true)
    expect(
      SendFollowupRequestSchema.safeParse({ id: "REP-1", to: "everyone", body: "x" }).success,
    ).toBe(false)
  })
})

describe("events schemas", () => {
  it("round-trips an AdminEventDTO and gates status to the cleanup lifecycle", () => {
    const detail = {
      id: "EVT-1",
      status: "upcoming",
      flagged: false,
      title: "Park cleanup",
      place: "Waynesboro, VA",
      attendees: 12,
      capacity: 30,
      bags: 0,
      organizer: actor,
      date: { rel: "in 3 days", abs: "Jun 9, 2026" },
      coords: [38.1, -78.8],
      desc: "Bring gloves",
      address: "Ridgeview Park",
      timeline: [{ who: "Ada", what: "Created", when: "1d ago", kind: "create" }],
      messages: [{ who: "Ada", text: "See you there", when: "1h ago" }],
    }
    expect(AdminEventDTOSchema.safeParse(detail).success).toBe(true)
    expect(
      SetEventStatusRequestSchema.safeParse({ id: "EVT-1", status: "cancelled" }).success,
    ).toBe(true)
    expect(SetEventStatusRequestSchema.safeParse({ id: "EVT-1", status: "resolved" }).success).toBe(
      false,
    )
  })
})

describe("admin org management", () => {
  const ISO = "2026-09-01T10:00:00.000Z"
  const org = {
    id: UUID,
    slug: "reach-out-la",
    name: "Reach Out LA",
    verifiedStatus: "verified",
    verifiedKind: "nonprofit",
    createdAt: ISO,
    owner: actor,
  }

  it("parses a 0.40.0 AdminOrgDTO and the 0.41.0 suspension fields", () => {
    const base = AdminOrgDTOSchema.safeParse(org)
    expect(base.success).toBe(true)
    if (base.success) {
      expect(base.data.memberCount).toBe(0)
      expect(base.data.donationsEnabled).toBe(false)
      expect(base.data.suspendedAt).toBeUndefined()
    }
    expect(
      AdminOrgDTOSchema.safeParse({
        ...org,
        suspendedAt: ISO,
        suspendedReason: "Spam events",
        updatedAt: ISO,
        socialLinks: { instagram: "reachoutla" },
        logoMediaId: UUID,
      }).success,
    ).toBe(true)
  })

  it("parses the org list query from query strings and the facet counts on page one", () => {
    const q = AdminOrgListQuerySchema.safeParse({
      q: "reach",
      verified: "verified",
      kind: "nonprofit",
      suspended: "false",
      donationsEnabled: "1",
      limit: "25",
    })
    expect(q.success).toBe(true)
    if (q.success) {
      expect(q.data.suspended).toBe(false)
      expect(q.data.donationsEnabled).toBe(true)
      expect(q.data.limit).toBe(25)
    }
    expect(AdminOrgListQuerySchema.safeParse({ suspended: "yes" }).success).toBe(false)
    expect(AdminOrgListQuerySchema.safeParse({ verified: "maybe" }).success).toBe(false)
    expect(
      AdminOrgListResponseSchema.safeParse({
        items: [org],
        nextCursor: null,
        counts: { all: 3, verified: 1, pending: 1, suspended: 0 },
      }).success,
    ).toBe(true)
    expect(AdminOrgListResponseSchema.safeParse({ items: [], nextCursor: "c1" }).success).toBe(true)
  })

  it("creates an org for an owner by userId, optionally pre-verified, and always with a reason", () => {
    const base = {
      name: "Reach Out LA",
      slug: "Reach-Out-LA",
      ownerUserId: UUID,
      reason: "Onboarded from the city partner list",
    }
    const ok = AdminCreateOrgRequestSchema.safeParse(base)
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.slug).toBe("reach-out-la")
    expect(
      AdminCreateOrgRequestSchema.safeParse({ ...base, verifiedKind: "government" }).success,
    ).toBe(true)
    expect(AdminCreateOrgRequestSchema.safeParse({ ...base, reason: "  " }).success).toBe(false)
    expect(AdminCreateOrgRequestSchema.safeParse({ ...base, ownerHandle: "ada" }).success).toBe(false)
    expect(
      AdminCreateOrgRequestSchema.safeParse({ ...base, websiteUrl: "http://x.org" }).success,
    ).toBe(false)
    expect(
      AdminCreateOrgRequestSchema.safeParse({ ...base, verifiedStatus: "verified" }).success,
    ).toBe(false)
  })

  it("edits any org field including the slug, nulls clear, and rejects unknown keys", () => {
    expect(
      AdminUpdateOrgRequestSchema.safeParse({
        id: UUID,
        slug: "reach-out-los-angeles",
        description: null,
        websiteUrl: null,
        logoMediaId: null,
        socialLinks: null,
        reason: "Rebrand",
      }).success,
    ).toBe(true)
    expect(AdminUpdateOrgRequestSchema.safeParse({ id: UUID, name: "X" }).success).toBe(false)
    expect(
      AdminUpdateOrgRequestSchema.safeParse({ id: UUID, reason: "r", suspended: true }).success,
    ).toBe(false)
  })

  it("suspends and unsuspends with a reason", () => {
    expect(
      AdminSetOrgSuspendedRequestSchema.safeParse({ id: UUID, suspended: true, reason: "Spam" })
        .success,
    ).toBe(true)
    expect(
      AdminSetOrgSuspendedRequestSchema.safeParse({ id: UUID, suspended: "true", reason: "Spam" })
        .success,
    ).toBe(false)
    expect(
      AdminSetOrgSuspendedRequestSchema.safeParse({ id: UUID, suspended: false }).success,
    ).toBe(false)
  })

  it("lists members as actor refs and mutates them by userId with every role incl. owner", () => {
    expect(AdminOrgMemberListRequestSchema.safeParse({ id: UUID, limit: "20" }).success).toBe(true)
    expect(AdminOrgMemberListRequestSchema.safeParse({ id: UUID, q: "ada" }).success).toBe(false)
    expect(
      AdminOrgMemberListResponseSchema.safeParse({
        items: [{ user: actor, role: "owner", joinedAt: ISO }],
        nextCursor: null,
      }).success,
    ).toBe(true)
    for (const role of ["owner", "admin", "member"] as const) {
      expect(
        AdminAddOrgMemberRequestSchema.safeParse({ id: UUID, userId: UUID, role, reason: "r" })
          .success,
        role,
      ).toBe(true)
      expect(
        AdminSetOrgMemberRoleRequestSchema.safeParse({ id: UUID, userId: UUID, role, reason: "r" })
          .success,
        role,
      ).toBe(true)
    }
    expect(
      AdminAddOrgMemberRequestSchema.safeParse({ id: UUID, userId: UUID, role: "staff", reason: "r" })
        .success,
    ).toBe(false)
    expect(
      AdminRemoveOrgMemberRequestSchema.safeParse({ id: UUID, userId: UUID, reason: "Left the org" })
        .success,
    ).toBe(true)
    expect(AdminRemoveOrgMemberRequestSchema.safeParse({ id: UUID, userId: UUID }).success).toBe(
      false,
    )
  })

  it("lists an org's events with the admin events-list row and a when facet", () => {
    expect(AdminOrgEventListRequestSchema.safeParse({ id: UUID, when: "upcoming" }).success).toBe(
      true,
    )
    expect(AdminOrgEventListRequestSchema.safeParse({ id: UUID, when: "soon" }).success).toBe(false)
    expect(
      AdminOrgEventListResponseSchema.safeParse({
        items: [
          {
            id: "EVT-1",
            status: "upcoming",
            flagged: false,
            title: "Park cleanup",
            place: "Waynesboro, VA",
            attendees: 12,
            capacity: 30,
            bags: 0,
            organizer: actor,
            date: { rel: "in 3 days", abs: "Jun 9, 2026" },
            coords: [38.1, -78.8],
          },
        ],
        nextCursor: null,
      }).success,
    ).toBe(true)
  })
})

describe("users schemas", () => {
  const listItem = {
    id: UUID,
    name: "Ada Neighbor",
    handle: "ada",
    city: "Waynesboro, VA",
    joined: "Jan 2026",
    status: "active",
    reports: 4,
    cleanups: 2,
    removals: 0,
    strikes: 0,
    risk: "low",
    lastActive: "2h ago",
    flagged: false,
    flagReason: null,
  }

  it("lists a user's org memberships and no longer carries a verification status", () => {
    const detail = { ...listItem, role: "citizen", messages: 3 }
    expect(AdminUserDTOSchema.parse(detail).organizations).toBeUndefined()
    const withOrgs = AdminUserDTOSchema.parse({
      ...detail,
      organizations: [{ id: UUID, slug: "reach-out-la", name: "Reach Out LA", role: "admin" }],
    })
    expect(withOrgs.organizations?.[0]?.role).toBe("admin")
    expect(
      AdminUserDTOSchema.safeParse({ ...detail, verificationStatus: "verified" }).success,
    ).toBe(false)
    expect(AdminUserDTOSchema.safeParse({ ...detail, reportVerified: true }).success).toBe(true)
    expect(
      AdminUserDTOSchema.safeParse({
        ...detail,
        organizations: [{ id: UUID, slug: "reach-out-la", name: "Reach Out LA", role: "boss" }],
      }).success,
    ).toBe(false)
  })

  it("round-trips a user list item and a paginated sub-activity list", () => {
    expect(AdminUserListItemDTOSchema.safeParse(listItem).success).toBe(true)
    const reports = UserReportsResponseSchema.parse({
      items: [
        {
          id: "REP-1",
          category: "trash",
          title: "Pile",
          place: "Main St",
          status: "submitted",
          age: "2h",
        },
      ],
      nextCursor: null,
    })
    expect(reports.items).toHaveLength(1)
  })

  it("accepts standalone group-chat messages without conflating them with cleanup chat", () => {
    const messages = UserMessagesResponseSchema.parse({
      items: [
        {
          id: UUID,
          text: "Planning the block party",
          thread: "Neighbors",
          when: "2h",
          deletedAt: null,
          source: "group",
          sourceId: "group-1",
        },
      ],
      nextCursor: null,
    })
    expect(messages.items[0]).toMatchObject({ source: "group", sourceId: "group-1" })
  })

  it("SetUserStatus accepts banned and rejects an unknown status", () => {
    expect(SetUserStatusRequestSchema.safeParse({ id: UUID, status: "banned" }).success).toBe(true)
    expect(SetUserStatusRequestSchema.safeParse({ id: UUID, status: "deleted" }).success).toBe(
      false,
    )
  })
})

describe("gov schemas", () => {
  it("round-trips a GovClaimDTO with the per-check map", () => {
    const claim = {
      id: "GOV-1",
      name: "Jordan Smith",
      title: "Public Works Director",
      org: "City of Waynesboro",
      jurisdictionGeoid: "0644000",
      method: "cold_outreach",
      status: "pending",
      age: "2d",
      contactEmail: "jordan@waynesboro.gov",
      verified: ["linkedin"],
      pending: ["directory", "callback"],
      checks: {
        linkedin: { status: "verified", evidence: "https://linkedin.com/in/jordan" },
        directory: { status: "pending" },
        callback: { status: "pending", note: "left voicemail" },
      },
    }
    expect(GovClaimDTOSchema.safeParse(claim).success).toBe(true)
  })

  it("VerifyCheck targets a known check; reject requires a reason", () => {
    expect(
      VerifyCheckRequestSchema.safeParse({ id: "GOV-1", check: "directory", status: "verified" })
        .success,
    ).toBe(true)
    expect(
      VerifyCheckRequestSchema.safeParse({ id: "GOV-1", check: "twitter", status: "verified" })
        .success,
    ).toBe(false)
    expect(
      RejectGovClaimRequestSchema.safeParse({ id: "GOV-1", reason: "Could not verify" }).success,
    ).toBe(true)
    expect(RejectGovClaimRequestSchema.safeParse({ id: "GOV-1", reason: "" }).success).toBe(false)
  })
})

describe("moderation schemas", () => {
  it("round-trips a ModerationItemDTO with signals/user/similar/media", () => {
    const item = {
      id: "MOD-1",
      flag: "NSFW image",
      reporter: "Anonymous session",
      category: "graffiti",
      reason: "Auto-held by NSFW model",
      age: "12m",
      priority: "high",
      kind: "image",
      subjectId: "REP-42",
      destinationKind: "report",
      destinationId: "REP-42",
      reporterId: null,
      desc: "Held photo",
      autoAction: "Hidden pending review - auto-publishes in 4m",
      place: "Main St",
      signals: [{ label: "NSFW model", val: "0.84", tone: "bad" }],
      user: {
        id: UUID,
        handle: "anon",
        name: "Anon",
        joined: "today",
        priorReports: 0,
        priorRemovals: 0,
        strikes: 0,
        device: "iOS - Waynesboro, VA",
      },
      similar: [{ id: "MOD-0", note: "Original post (kept)", when: "1h ago" }],
      media: [{ id: "m1", kind: "image", url: "https://r2/held.jpg" }],
    }
    expect(ModerationItemDTOSchema.safeParse(item).success).toBe(true)
    // category may be null (appeals).
    expect(ModerationItemDTOSchema.safeParse({ ...item, category: null }).success).toBe(true)
    // a bad signal tone is rejected.
    expect(
      ModerationItemDTOSchema.safeParse({
        ...item,
        signals: [{ label: "x", val: "1", tone: "ugly" }],
      }).success,
    ).toBe(false)
  })

  it("keeps the moderated subject distinct from its nullable admin destination", () => {
    const base = {
      id: "MOD-1",
      flag: "User report",
      reporter: "@flagger",
      category: null,
      reason: "spam",
      age: "1h",
      priority: "med" as const,
      kind: "user_report" as const,
      subjectType: "photo" as const,
      subjectId: "PHOTO-1",
      reporterId: "USER-1",
    }

    expect(
      ModerationListItemDTOSchema.parse({
        ...base,
        destinationKind: "event",
        destinationId: "EVENT-1",
      }),
    ).toMatchObject({
      subjectId: "PHOTO-1",
      destinationKind: "event",
      destinationId: "EVENT-1",
    })
    expect(
      ModerationListItemDTOSchema.parse({
        ...base,
        destinationKind: null,
        destinationId: null,
      }),
    ).toMatchObject({ destinationKind: null, destinationId: null })
  })

  it("AppealModeration decision is uphold|overturn", () => {
    expect(
      AppealModerationRequestSchema.safeParse({ id: "MOD-1", decision: "uphold" }).success,
    ).toBe(true)
    expect(
      AppealModerationRequestSchema.safeParse({ id: "MOD-1", decision: "maybe" }).success,
    ).toBe(false)
  })
})

describe("mail schemas", () => {
  it("round-trips a mail thread list item + stats response", () => {
    const row = {
      id: "MAIL-1",
      dir: "in",
      from: "streets@city.gov",
      to: "outreach@civfix.org",
      org: "City of Waynesboro",
      subject: "Re: Trash pile",
      preview: "Thanks, we will send a crew.",
      ts: "2h ago",
      unread: true,
      status: "needs_action",
      jurisdictionGeoid: "0644000",
      reportId: "REP-1",
    }
    expect(MailThreadListItemDTOSchema.safeParse(row).success).toBe(true)
    const stats = {
      unread: 4,
      threads: 38,
      sent: 1240,
      bounced: 13,
      failed: 2,
    }
    expect(MailStatsResponseSchema.safeParse(stats).success).toBe(true)
  })

  it("ComposeRequest requires a valid recipient + non-empty subject/body", () => {
    expect(
      ComposeRequestSchema.safeParse({ to: "a@b.com", subject: "Hi", body: "Hello" }).success,
    ).toBe(true)
    expect(
      ComposeRequestSchema.safeParse({ to: "nope", subject: "Hi", body: "Hello" }).success,
    ).toBe(false)
  })
})

describe("analytics + activity + audit + system schemas", () => {
  it("by-category uses the 6 real categories (cleanup is not one)", () => {
    expect(
      AnalyticsByCategoryResponseSchema.safeParse({
        rows: [{ cat: "trash", count: 10, pct: 40 }],
      }).success,
    ).toBe(true)
    expect(
      AnalyticsByCategoryResponseSchema.safeParse({
        rows: [{ cat: "cleanup", count: 10, pct: 40 }],
      }).success,
    ).toBe(false)
  })

  it("validates the kpis + retention shapes", () => {
    expect(
      AnalyticsKpisResponseSchema.safeParse({
        kpis: [{ label: "Pins", num: 240, delta: "+12%", dir: "up" }],
      }).success,
    ).toBe(true)
    expect(
      AnalyticsRetentionResponseSchema.safeParse({
        cohorts: [{ cohort: "Jan", size: 100, values: [1, 0.6, 0.4] }],
        periodLabels: ["W0", "W1", "W2"],
      }).success,
    ).toBe(true)
  })

  it("validates an activity item, an audit entry, and system health", () => {
    expect(
      ActivityItemDTOSchema.safeParse({
        kind: "outreach_bounce",
        who: "system",
        what: "Bounced",
        where: "City of X",
        ts: "1h ago",
        hue: "rose",
      }).success,
    ).toBe(true)
    expect(
      AuditLogEntryDTOSchema.safeParse({
        id: UUID,
        actorId: UUID,
        actorName: "Op",
        action: "report.status_changed",
        target: "REP-1",
        meta: { from: "submitted", to: "in_progress" },
        createdAt: "2026-06-03T00:00:00.000Z",
      }).success,
    ).toBe(true)
    expect(AuditListQuerySchema.safeParse({ action: "user.banned", limit: "10" }).success).toBe(
      true,
    )
    expect(
      SystemHealthResponseSchema.safeParse({
        services: [
          { name: "API", status: "ok", val: "p95 142ms" },
          { name: "VRP router", status: "not_deployed", val: "Phase 3" },
        ],
      }).success,
    ).toBe(true)
  })
})
