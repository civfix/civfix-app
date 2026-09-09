import { describe, it, expect } from "vitest"
import {
  LogEventHoursRequestSchema,
  LeaderboardQuerySchema,
  LeaderboardResponseSchema,
  MyVolunteerHoursDTOSchema,
  LeaderboardEntryDTOSchema,
  VolunteerHoursCreditorSchema,
  VolunteerHoursEntryDTOSchema,
  MyVolunteerHoursEntriesQuerySchema,
  MyVolunteerHoursEntriesResponseSchema,
  PublicVolunteerHoursQuerySchema,
  PublicVolunteerHoursResponseSchema,
  EventHoursQuerySchema,
  EventHoursResponseSchema,
  REPORT_VOLUNTEER_HOURS,
  VOLUNTEER_HOURS_SOURCES,
  VolunteerHoursSourceSchema,
  MAX_EVENT_HOURS,
  MAX_EVENT_HOURS_ENTRIES,
} from "../src/schemas/volunteer.js"

const UUID = "00000000-0000-0000-0000-000000000001"

const UUID2 = "00000000-0000-0000-0000-000000000002"

describe("LogEventHoursRequestSchema (per-attendee entries)", () => {
  it("accepts the merged { id, entries } body the route parses (path id folded in)", () => {
    const parsed = LogEventHoursRequestSchema.parse({
      id: UUID,
      entries: [
        { userId: UUID, hours: 2.5 },
        { userId: UUID2, hours: 1 },
      ],
    })
    expect(parsed.entries).toHaveLength(2)
    expect(parsed.entries[0]).toEqual({ userId: UUID, hours: 2.5 })
  })

  it("rejects a body missing the id (strict, so the route MUST merge the path id)", () => {
    expect(
      LogEventHoursRequestSchema.safeParse({ entries: [{ userId: UUID, hours: 2 }] }).success,
    ).toBe(false)
  })

  it("rejects the old flat { id, hours } body (no fallback - apps move in lockstep)", () => {
    expect(LogEventHoursRequestSchema.safeParse({ id: UUID, hours: 2 }).success).toBe(false)
  })

  it("requires at least one entry", () => {
    expect(LogEventHoursRequestSchema.safeParse({ id: UUID, entries: [] }).success).toBe(false)
  })

  it("rejects unknown keys, non-positive hours, and over-cap hours per entry", () => {
    const req = (entry: Record<string, unknown>) =>
      LogEventHoursRequestSchema.safeParse({ id: UUID, entries: [entry] }).success
    expect(
      LogEventHoursRequestSchema.safeParse({
        id: UUID,
        entries: [{ userId: UUID, hours: 2 }],
        extra: 1,
      }).success,
    ).toBe(false)
    expect(req({ userId: UUID, hours: 2, extra: 1 })).toBe(false)
    expect(req({ userId: UUID, hours: 0 })).toBe(false)
    expect(req({ userId: UUID, hours: -1 })).toBe(false)
    expect(req({ userId: UUID, hours: MAX_EVENT_HOURS + 1 })).toBe(false)
  })

  it("accepts exactly MAX_EVENT_HOURS_ENTRIES entries and rejects one more", () => {
    const entries = (n: number) =>
      Array.from({ length: n }, () => ({ userId: UUID, hours: 1 }))
    expect(MAX_EVENT_HOURS_ENTRIES).toBe(2000)
    expect(
      LogEventHoursRequestSchema.safeParse({ id: UUID, entries: entries(MAX_EVENT_HOURS_ENTRIES) })
        .success,
    ).toBe(true)
    expect(
      LogEventHoursRequestSchema.safeParse({
        id: UUID,
        entries: entries(MAX_EVENT_HOURS_ENTRIES + 1),
      }).success,
    ).toBe(false)
  })
})

describe("LeaderboardQuerySchema", () => {
  it("coerces + bounds limit/offset (query string values)", () => {
    expect(LeaderboardQuerySchema.parse({ geoid: "0644000", limit: "20", offset: "40" })).toEqual({
      geoid: "0644000",
      limit: 20,
      offset: 40,
    })
    expect(LeaderboardQuerySchema.safeParse({ geoid: "0644000", limit: 51 }).success).toBe(false)
    expect(LeaderboardQuerySchema.safeParse({ geoid: "0644000", offset: 501 }).success).toBe(false)
  })

  it("REQUIRES geoid - the route must merge the path param before parsing request.query", () => {
    expect(LeaderboardQuerySchema.safeParse({ limit: 20 }).success).toBe(false)
    expect(LeaderboardQuerySchema.safeParse({}).success).toBe(false)
    expect(LeaderboardQuerySchema.safeParse({ geoid: "" }).success).toBe(false)
    expect(LeaderboardQuerySchema.safeParse({ geoid: "x".repeat(65) }).success).toBe(false)
    expect(LeaderboardQuerySchema.safeParse({ geoid: "0644000" }).success).toBe(true)
  })
})

describe("LeaderboardResponseSchema viewer fields (flat optionals)", () => {
  it("parses a minimal legacy payload with every new field absent", () => {
    const res = LeaderboardResponseSchema.safeParse({ geoid: "0644000", entries: [] })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.participantCount).toBeUndefined()
      expect(res.data.viewerRank).toBeUndefined()
      expect(res.data.viewerHours).toBeUndefined()
    }
  })

  it("accepts participantCount/viewerRank/viewerHours flat, and null viewer standing", () => {
    const parsed = LeaderboardResponseSchema.parse({
      geoid: "0644000",
      entries: [],
      participantCount: 42,
      viewerRank: null,
      viewerHours: null,
    })
    expect(parsed.participantCount).toBe(42)
    expect(parsed.viewerRank).toBeNull()
    expect(
      LeaderboardResponseSchema.safeParse({
        geoid: "0644000",
        entries: [],
        viewerRank: 7,
        viewerHours: 12.5,
      }).success,
    ).toBe(true)
    // rank is 1-based; 0 is not a rank
    expect(
      LeaderboardResponseSchema.safeParse({ geoid: "0644000", entries: [], viewerRank: 0 }).success,
    ).toBe(false)
  })
})

describe("volunteer hours transcript DTOs", () => {
  const MINIMAL_ENTRY = {
    id: UUID,
    source: "event",
    hours: 2.5,
    occurredAt: "2026-07-01T17:00:00.000Z",
    creditedAt: "2026-07-02T01:00:00.000Z",
  }

  it("VolunteerHoursEntryDTO parses with every optional omitted", () => {
    const parsed = VolunteerHoursEntryDTOSchema.parse(MINIMAL_ENTRY)
    expect(parsed.source).toBe("event")
    expect(parsed.eventTitle).toBeUndefined()
    expect(parsed.creditedBy).toBeUndefined()
  })

  it("VolunteerHoursEntryDTO carries the event/report/jurisdiction context and creditor", () => {
    const parsed = VolunteerHoursEntryDTOSchema.parse({
      ...MINIMAL_ENTRY,
      eventId: UUID2,
      eventTitle: "Beach cleanup",
      eventReferenceCode: "DU-42-000001",
      reportId: null,
      jurisdictionGeoid: "0644000",
      jurisdictionName: "Los Angeles, CA",
      creditedBy: { id: UUID2, name: "Ada", handle: "ada", verified: true },
    })
    expect(parsed.creditedBy?.name).toBe("Ada")
    expect(parsed.eventReferenceCode).toBe("DU-42-000001")
  })

  it("VolunteerHoursCreditor is not a PersonDTO - no follower counts required", () => {
    const parsed = VolunteerHoursCreditorSchema.parse({ id: UUID, name: "Ada" })
    expect(parsed.handle).toBeUndefined()
    expect(parsed.verified).toBeUndefined()
  })
})

describe("MyVolunteerHoursEntries (GET /me/volunteer-hours/entries)", () => {
  it("coerces limit from a query string and rejects unknown keys", () => {
    expect(MyVolunteerHoursEntriesQuerySchema.parse({ limit: "10" })).toEqual({ limit: 10 })
    expect(MyVolunteerHoursEntriesQuerySchema.parse({})).toEqual({})
    expect(MyVolunteerHoursEntriesQuerySchema.safeParse({ cursor: "abc" }).success).toBe(true)
    expect(MyVolunteerHoursEntriesQuerySchema.safeParse({ limit: 51 }).success).toBe(false)
    expect(MyVolunteerHoursEntriesQuerySchema.safeParse({ limit: 0 }).success).toBe(false)
    expect(MyVolunteerHoursEntriesQuerySchema.safeParse({ extra: 1 }).success).toBe(false)
  })

  it("response parses a minimal legacy payload (every field defaulted)", () => {
    const parsed = MyVolunteerHoursEntriesResponseSchema.parse({})
    expect(parsed).toEqual({ items: [], nextCursor: null, totalHours: 0 })
  })
})

describe("PublicVolunteerHours (GET /people/:id/volunteer-hours)", () => {
  it("requires id (path param merged in) and rejects unknown keys", () => {
    expect(PublicVolunteerHoursQuerySchema.parse({ id: UUID, limit: "10" })).toEqual({
      id: UUID,
      limit: 10,
    })
    expect(PublicVolunteerHoursQuerySchema.safeParse({ limit: 10 }).success).toBe(false)
    expect(PublicVolunteerHoursQuerySchema.safeParse({ id: UUID, extra: 1 }).success).toBe(false)
  })

  it("response parses a minimal legacy payload and defaults visible to false", () => {
    const parsed = PublicVolunteerHoursResponseSchema.parse({})
    expect(parsed).toEqual({
      visible: false,
      totalHours: 0,
      byJurisdiction: [],
      items: [],
      reportHours: 0,
      nextCursor: null,
    })
  })

  it("reports opted-out honestly rather than as zero hours", () => {
    const hidden = PublicVolunteerHoursResponseSchema.parse({ visible: false })
    const zero = PublicVolunteerHoursResponseSchema.parse({ visible: true, totalHours: 0 })
    expect(hidden.visible).toBe(false)
    expect(zero.visible).toBe(true)
    expect(zero.totalHours).toBe(0)
  })
})

describe("EventHours read-back (GET /cleanups/:id/hours)", () => {
  it("query requires the merged path id and rejects unknown keys", () => {
    expect(EventHoursQuerySchema.parse({ id: UUID })).toEqual({ id: UUID })
    expect(EventHoursQuerySchema.safeParse({}).success).toBe(false)
    expect(EventHoursQuerySchema.safeParse({ id: "nope" }).success).toBe(false)
    expect(EventHoursQuerySchema.safeParse({ id: UUID, extra: 1 }).success).toBe(false)
  })

  it("response parses a minimal legacy payload - scope defaults to self, entries to []", () => {
    const parsed = EventHoursResponseSchema.parse({})
    expect(parsed.scope).toBe("self")
    expect(parsed.entries).toEqual([])
    // absent on an older server; the client must treat undefined as false (degrade to "pending")
    expect(parsed.anyLogged).toBeUndefined()
  })

  it("carries the host's full roster on scope=all and anyLogged on scope=self", () => {
    const all = EventHoursResponseSchema.parse({
      scope: "all",
      entries: [
        { userId: UUID, hours: 2.5, loggedAt: "2026-07-02T01:00:00.000Z" },
        { userId: UUID2, hours: 1, loggedAt: "2026-07-02T01:00:00.000Z" },
      ],
      anyLogged: true,
    })
    expect(all.entries).toHaveLength(2)
    expect(all.entries[0]?.loggedAt).toBe("2026-07-02T01:00:00.000Z")

    // uncredited attendee: no row of their own, but the host HAS logged -> "not-credited"
    const self = EventHoursResponseSchema.parse({ scope: "self", entries: [], anyLogged: true })
    expect(self.anyLogged).toBe(true)
    expect(EventHoursResponseSchema.safeParse({ scope: "everyone" }).success).toBe(false)
  })
})

describe("volunteer DTOs", () => {
  it("constants are the agreed values", () => {
    expect(MAX_EVENT_HOURS).toBe(24)
  })

  /**
   * REPORT_VOLUNTEER_HOURS is RETIRED (deprecated 2026-07-28): filing a report is not volunteer service,
   * nothing credits it any more, and backend migration 0065 voided every credit it ever wrote. It is kept
   * only to document what the historical `source='report'` rows are worth — hence a frozen value, not an
   * "agreed" one. `"report"` likewise stays in VOLUNTEER_HOURS_SOURCES: those old ledger rows, the frozen
   * snapshot of every issued certificate, and older servers all still carry it, so dropping the enum
   * member would make their payloads fail to parse.
   */
  it("the retired report auto-award constant is frozen, and its source stays parseable", () => {
    expect(REPORT_VOLUNTEER_HOURS).toBe(0.1)
    expect(VOLUNTEER_HOURS_SOURCES).toContain("report")
    expect(VolunteerHoursSourceSchema.safeParse("report").success).toBe(true)
  })

  it("MyVolunteerHoursDTO + LeaderboardEntryDTO parse a representative payload", () => {
    expect(
      MyVolunteerHoursDTOSchema.parse({
        totalHours: 3.4,
        byJurisdiction: [{ geoid: "0644000", name: "Los Angeles, CA", hours: 3.4 }],
      }).totalHours,
    ).toBe(3.4)
    expect(
      LeaderboardEntryDTOSchema.parse({
        rank: 1,
        userId: UUID,
        name: "Jane",
        handle: "jane",
        avatar: ["#aaaaaa", "#bbbbbb"],
        verified: true,
        hours: 12.4,
      }).rank,
    ).toBe(1)
  })
})
