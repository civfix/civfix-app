import { describe, expect, it } from "vitest"
import {
  ADMIN_REPORT_STATUS_BUCKETS,
  AdminOkResponseSchema,
  AdminReportStatusBucketSchema,
  AdminReportStatusSchema,
  ModerationItemStatusSchema,
} from "../src/schemas/admin/common.js"
import { MailAttachmentSchema } from "../src/schemas/admin/mail.js"
import {
  AdminUserListQuerySchema,
  FlagUserRequestSchema,
  UserMessageItemDTOSchema,
  UserSubListQuerySchema,
} from "../src/schemas/admin/users.js"
import { FlagEventRequestSchema } from "../src/schemas/admin/events.js"
import { FlagReportRequestSchema, SetReportVerdictResponseSchema } from "../src/schemas/admin/reports.js"
import { ModerationItemDTOSchema } from "../src/schemas/admin/moderation.js"
import { DiscoveryContactSchema } from "../src/schemas/admin/discovery.js"
import { AnalyticsKpiKey, AnalyticsKpiSchema } from "../src/schemas/admin/analytics.js"
import { HomeSummaryResponseSchema } from "../src/schemas/admin/home.js"
import { CreateWalkupRegistrationRequestSchema } from "../src/schemas/host/registrations.js"

const UUID = "11111111-2222-4333-8444-555555555555"

describe("ADMIN_REPORT_STATUS_BUCKETS", () => {
  it("holds the backend's status buckets exactly", () => {
    expect(ADMIN_REPORT_STATUS_BUCKETS).toEqual({
      submitted: ["submitted", "held", "published"],
      in_progress: ["acknowledged", "in_progress"],
      completed: ["resolved"],
    })
  })

  it("keys every bucket the schema names and puts every live status in exactly one bucket", () => {
    expect(Object.keys(ADMIN_REPORT_STATUS_BUCKETS).sort()).toEqual(
      [...AdminReportStatusBucketSchema.options].sort(),
    )
    const bucketed = Object.values(ADMIN_REPORT_STATUS_BUCKETS).flat()
    expect(new Set(bucketed).size).toBe(bucketed.length)
    const unbucketed = AdminReportStatusSchema.options.filter((s) => !bucketed.includes(s))
    expect(unbucketed).toEqual(["rejected"])
  })
})

describe("MailAttachmentSchema url", () => {
  const attachment = { key: "https://r2.example/a.pdf?sig=1", filename: "a.pdf", size: 10 }

  it("still parses a payload without url", () => {
    expect(MailAttachmentSchema.safeParse(attachment).success).toBe(true)
  })

  it("parses a url and rejects a non-url", () => {
    expect(MailAttachmentSchema.safeParse({ ...attachment, url: attachment.key }).success).toBe(true)
    expect(MailAttachmentSchema.safeParse({ ...attachment, url: "inbound/a.pdf" }).success).toBe(false)
  })
})

describe("AdminUserListQuerySchema excludeOrgId", () => {
  it("stays optional and non-strict", () => {
    expect(AdminUserListQuerySchema.safeParse({}).success).toBe(true)
    expect(AdminUserListQuerySchema.safeParse({ echoed: "x" }).success).toBe(true)
  })

  it("accepts an org id and rejects a non-uuid", () => {
    expect(AdminUserListQuerySchema.parse({ excludeOrgId: UUID }).excludeOrgId).toBe(UUID)
    expect(AdminUserListQuerySchema.safeParse({ excludeOrgId: "org-1" }).success).toBe(false)
  })
})

describe("UserSubListQuerySchema cursor", () => {
  it("parses the same inputs as before", () => {
    expect(UserSubListQuerySchema.safeParse({ id: "u" }).success).toBe(true)
    expect(UserSubListQuerySchema.parse({ id: "u", cursor: "abc" }).cursor).toBe("abc")
    expect(UserSubListQuerySchema.safeParse({ id: "u", cursor: 5 }).success).toBe(false)
    expect(UserSubListQuerySchema.safeParse({ id: "u", echoed: 1 }).success).toBe(true)
  })
})

describe("UserMessageItemDTOSchema removedBy", () => {
  const message = { id: "m", text: "hi", thread: "t", when: "now", sourceId: null }

  it("still parses a payload without removedBy", () => {
    expect(UserMessageItemDTOSchema.safeParse(message).success).toBe(true)
  })

  it("parses author, operator and null, and rejects anything else", () => {
    for (const removedBy of ["author", "operator", null]) {
      expect(UserMessageItemDTOSchema.safeParse({ ...message, removedBy }).success).toBe(true)
    }
    expect(UserMessageItemDTOSchema.safeParse({ ...message, removedBy: "system" }).success).toBe(false)
  })
})

describe("flag requests flagged", () => {
  const schemas = [FlagEventRequestSchema, FlagReportRequestSchema, FlagUserRequestSchema]

  it("still parses a toggle request", () => {
    for (const schema of schemas) expect(schema.safeParse({ id: "x" }).success).toBe(true)
  })

  it("parses an explicit value and rejects a non-boolean", () => {
    for (const schema of schemas) {
      expect(schema.parse({ id: "x", flagged: false }).flagged).toBe(false)
      expect(schema.safeParse({ id: "x", flagged: "yes" }).success).toBe(false)
    }
  })
})

describe("SetReportVerdictResponseSchema", () => {
  it("is the admin ok schema, still strict", () => {
    expect(SetReportVerdictResponseSchema).toBe(AdminOkResponseSchema)
    expect(SetReportVerdictResponseSchema.safeParse({ ok: true }).success).toBe(true)
    expect(SetReportVerdictResponseSchema.safeParse({ ok: true, extra: 1 }).success).toBe(false)
    expect(SetReportVerdictResponseSchema.safeParse({ ok: false }).success).toBe(false)
  })
})

describe("ModerationItemDTOSchema status", () => {
  const item = {
    id: "MOD-1",
    flag: "NSFW image",
    reporter: "Anonymous session",
    category: "graffiti",
    reason: "Auto-held",
    age: "12m",
    priority: "high",
    kind: "image",
    subjectId: "REP-42",
    reporterId: null,
    desc: "Held photo",
    autoAction: null,
    place: null,
    signals: [],
    user: {
      id: null,
      handle: "anon",
      name: "Anon",
      joined: "today",
      priorReports: 0,
      priorRemovals: 0,
      strikes: 0,
      device: "iOS",
    },
    similar: [],
    media: [],
  }

  it("still parses a payload without status", () => {
    expect(ModerationItemDTOSchema.safeParse(item).success).toBe(true)
  })

  it("parses every stored status and rejects an unknown one", () => {
    for (const status of ModerationItemStatusSchema.options) {
      expect(ModerationItemDTOSchema.safeParse({ ...item, status }).success).toBe(true)
    }
    expect(ModerationItemDTOSchema.safeParse({ ...item, status: "resolved" }).success).toBe(false)
  })
})

describe("DiscoveryContactSchema bouncedAt", () => {
  const contact = { category: "graffiti", email: "city@example.gov" }

  it("still parses a payload without bouncedAt", () => {
    expect(DiscoveryContactSchema.safeParse(contact).success).toBe(true)
  })

  it("parses a timestamp or null", () => {
    const at = "2026-09-01T10:00:00.000Z"
    expect(DiscoveryContactSchema.parse({ ...contact, bouncedAt: at }).bouncedAt).toBe(at)
    expect(DiscoveryContactSchema.parse({ ...contact, bouncedAt: null }).bouncedAt).toBeNull()
  })
})

describe("AnalyticsKpiSchema key and unit", () => {
  const kpi = { label: "Resolved", num: 88.5, delta: "+1pt", dir: "up" }

  it("still parses a payload without key or unit", () => {
    expect(AnalyticsKpiSchema.safeParse(kpi).success).toBe(true)
  })

  it("parses a known key, an unknown future key and each unit", () => {
    expect(AnalyticsKpiSchema.safeParse({ ...kpi, key: AnalyticsKpiKey.resolved, unit: "percent" }).success).toBe(true)
    expect(AnalyticsKpiSchema.safeParse({ ...kpi, key: "a_later_kpi" }).success).toBe(true)
    for (const unit of ["count", "percent", "hours"]) {
      expect(AnalyticsKpiSchema.safeParse({ ...kpi, unit }).success).toBe(true)
    }
    expect(AnalyticsKpiSchema.safeParse({ ...kpi, unit: "days" }).success).toBe(false)
    expect(AnalyticsKpiSchema.safeParse({ ...kpi, key: "" }).success).toBe(false)
  })
})

describe("HomeSummaryResponseSchema degraded", () => {
  const summary = {
    discovery: { queue: 1, reportsWaiting: 2, overSla: 0 },
    reports: { flagged: 0, inProgress: 1, completed: 2 },
    events: { upcoming: 1, live: 0, attending: 3 },
    mail: { unread: 0, needsAction: 0 },
    users: { flagged: 0, highRisk: 0, suspended: 0 },
    analytics: {
      pinsThisMonth: 1,
      resolvedPct: 50,
      coveragePct: 10,
      cleanups: 0,
      eventsThisMonth: 0,
      newUsers: 1,
      pinsByWeek: [1],
    },
    livePins24h: 0,
  }

  it("still parses a payload without degraded", () => {
    expect(HomeSummaryResponseSchema.safeParse(summary).success).toBe(true)
  })

  it("parses a list of degraded sections", () => {
    expect(HomeSummaryResponseSchema.parse({ ...summary, degraded: ["mail"] }).degraded).toEqual(["mail"])
    expect(HomeSummaryResponseSchema.safeParse({ ...summary, degraded: [1] }).success).toBe(false)
  })
})

describe("CreateWalkupRegistrationRequestSchema idempotencyKey", () => {
  const walkup = { id: UUID, name: "Rosa" }

  it("still parses a request without idempotencyKey", () => {
    expect(CreateWalkupRegistrationRequestSchema.safeParse(walkup).success).toBe(true)
  })

  it("applies the shared idempotency key bounds", () => {
    const parse = (idempotencyKey: string) =>
      CreateWalkupRegistrationRequestSchema.safeParse({ ...walkup, idempotencyKey }).success
    expect(parse("a".repeat(8))).toBe(true)
    expect(parse("a".repeat(128))).toBe(true)
    expect(parse("a".repeat(7))).toBe(false)
    expect(parse("a".repeat(129))).toBe(false)
  })
})
