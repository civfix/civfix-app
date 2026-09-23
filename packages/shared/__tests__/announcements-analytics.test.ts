import { describe, it, expect } from "vitest"
import {
  ANNOUNCEMENT_AUDIENCE_KINDS,
  ANNOUNCEMENT_CHANNELS,
  AnnouncementAudienceSchema,
  AnnouncementDTOSchema,
  BroadcastKindSchema,
  BroadcastSegmentSchema,
  CreateEventAnnouncementRequestSchema,
  EventAnalyticsPhaseSchema,
  EventAnalyticsScopeSchema,
  GetEventAnalyticsRequestSchema,
  GetEventAnalyticsResponseSchema,
  GetEventAnnouncementRequestSchema,
  ListEventAnnouncementsRequestSchema,
  MAX_ANNOUNCEMENT_BODY,
  MAX_ANNOUNCEMENT_TITLE,
  announcementAudienceToSegment,
  endpoints,
} from "../src/index.js"


const UUID = "123e4567-e89b-12d3-a456-426614174000"
const OTHER_UUID = "123e4567-e89b-12d3-a456-426614174001"
const ISO = "2026-09-16T12:00:00.000Z"

describe("event announcements contract", () => {
  it("rides the broadcast pipeline as a new kind", () => {
    expect(BroadcastKindSchema.options).toContain("announcement")
    expect(ANNOUNCEMENT_CHANNELS).toEqual(["inapp", "push", "email"])
  })

  it("restricts the audience to a parseable subset of the broadcast segment union", () => {
    for (const kind of ANNOUNCEMENT_AUDIENCE_KINDS) {
      const audience = kind === "slots" ? { kind, ids: [UUID] } : { kind }
      const parsed = AnnouncementAudienceSchema.parse(audience)
      expect(BroadcastSegmentSchema.safeParse(parsed).success, kind).toBe(true)
      expect(announcementAudienceToSegment(parsed)).toEqual(parsed)
    }
    expect(AnnouncementAudienceSchema.safeParse({ kind: "ticket_types", ids: [UUID] }).success).toBe(
      false,
    )
    expect(AnnouncementAudienceSchema.safeParse({ kind: "guests_only" }).success).toBe(false)
    expect(AnnouncementAudienceSchema.safeParse({ kind: "slots", ids: [] }).success).toBe(false)
  })

  it("round-trips a public projection with no delivery counts and a host one with them", () => {
    const base = {
      id: UUID,
      cleanupId: OTHER_UUID,
      status: "sent",
      title: null,
      bodyMd: "Pizza is here",
      sentAt: ISO,
      createdAt: ISO,
    }
    const publicDto = AnnouncementDTOSchema.parse(base)
    expect("recipientCount" in publicDto).toBe(false)
    expect("audience" in publicDto).toBe(false)
    const hostDto = AnnouncementDTOSchema.parse({
      ...base,
      audience: { kind: "checked_in" },
      recipientCount: 42,
      sentCount: 41,
      failedCount: 1,
    })
    expect(hostDto.recipientCount).toBe(42)
    expect(hostDto.audience).toEqual({ kind: "checked_in" })
  })

  it("requires a body, caps the title and rejects unknown compose fields", () => {
    const ok = CreateEventAnnouncementRequestSchema.parse({
      id: UUID,
      bodyMd: "  Doors open at 9  ",
      audience: { kind: "all_registered" },
    })
    expect(ok.bodyMd).toBe("Doors open at 9")
    expect(
      CreateEventAnnouncementRequestSchema.safeParse({
        id: UUID,
        bodyMd: "",
        audience: { kind: "all_registered" },
      }).success,
    ).toBe(false)
    expect(
      CreateEventAnnouncementRequestSchema.safeParse({
        id: UUID,
        title: "x".repeat(MAX_ANNOUNCEMENT_TITLE + 1),
        bodyMd: "hi",
        audience: { kind: "all_registered" },
      }).success,
    ).toBe(false)
    expect(
      CreateEventAnnouncementRequestSchema.safeParse({
        id: UUID,
        bodyMd: "x".repeat(MAX_ANNOUNCEMENT_BODY + 1),
        audience: { kind: "all_registered" },
      }).success,
    ).toBe(false)
    expect(
      CreateEventAnnouncementRequestSchema.safeParse({
        id: UUID,
        bodyMd: "hi",
        audience: { kind: "all_registered" },
        channels: ["email"],
      }).success,
    ).toBe(false)
  })

  it("registers three endpoints, one host-gated write and two open reads", () => {
    expect(endpoints.createEventAnnouncement.method).toBe("POST")
    expect(endpoints.createEventAnnouncement.path).toBe("/cleanups/:id/announcements")
    expect(endpoints.createEventAnnouncement.auth).toBe("required")
    expect(endpoints.createEventAnnouncement.csrf).toBe(true)
    expect(endpoints.listEventAnnouncements.path).toBe("/cleanups/:id/announcements")
    expect(endpoints.listEventAnnouncements.auth).toBe("optional")
    expect(endpoints.getEventAnnouncement.path).toBe(
      "/cleanups/:id/announcements/:announcementId",
    )
    expect(endpoints.getEventAnnouncement.auth).toBe("optional")
    expect(ListEventAnnouncementsRequestSchema.safeParse({ id: UUID, limit: 20 }).success).toBe(true)
    expect(
      GetEventAnnouncementRequestSchema.safeParse({ id: UUID, announcementId: OTHER_UUID }).success,
    ).toBe(true)
  })
})

describe("consolidated event analytics contract", () => {
  const response = {
    generatedAt: ISO,
    scope: "card",
    phase: "upcoming",
    lifecycle: { createdAt: ISO, startAt: ISO, endAt: null, completedAt: null },
    kpis: {
      signups: 12,
      capacity: 30,
      waitlisted: 0,
      cancelled: 1,
      checkedIn: null,
      noShow: null,
      walkUps: null,
      pageViews: 240,
      uniqueViewers: null,
      shares: null,
      donationClicks: 3,
      hoursTotal: null,
      hoursVolunteers: null,
      reportsLinked: 2,
      reportsResolved: 0,
      postsCreated: 1,
    },
    rates: {
      checkIn: { value: null, numerator: null, denominator: null, suppressed: true },
      noShow: { value: null, numerator: null, denominator: null, suppressed: true },
      fill: { value: 0.4, numerator: 12, denominator: 30 },
      viewToSignup: { value: 0.05, numerator: 12, denominator: 240 },
      waitlistConversion: { value: null, numerator: null, denominator: null, suppressed: true },
    },
    deltas: { signups7d: 4, views7d: -12 },
    signups: { cumulative: [{ day: "2026-09-15", value: 12 }] },
    reach: { viewsDaily: [{ day: "2026-09-15", value: 240 }] },
    eventDay: { arrivals: [] },
    impact: {},
  }

  it("defaults the suppression constant, the series blocks and the comparison", () => {
    const parsed = GetEventAnalyticsResponseSchema.parse(response)
    expect(parsed.k).toBe(5)
    expect(parsed.signups.daily).toEqual([])
    expect(parsed.signups.bySlot).toBeUndefined()
    expect(parsed.reach.funnel).toEqual([])
    expect(parsed.comparison).toBeUndefined()
    expect(parsed.rates.fill.suppressed).toBe(false)
    expect(parsed.signups.cumulative[0]?.suppressed).toBe(false)
  })

  it("carries the full-scope panels and the previous-events comparison", () => {
    const parsed = GetEventAnalyticsResponseSchema.parse({
      ...response,
      scope: "full",
      phase: "completed",
      signups: {
        ...response.signups,
        bySlot: { rows: [{ key: UUID, label: "Trash pickup", value: 8 }] },
        bySource: { rows: [] },
      },
      impact: { hoursBuckets: { rows: [] }, reportStatuses: { rows: [] } },
      comparison: {
        sampleSize: 4,
        medians: { signups: 18, checkInRate: 0.7, hoursPerVolunteer: 2.5, fillRate: 0.6 },
      },
    })
    expect(parsed.signups.bySlot?.rows[0]?.label).toBe("Trash pickup")
    expect(parsed.signups.bySlot?.panelSuppressed).toBe(false)
    expect(parsed.comparison?.sampleSize).toBe(4)
  })

  it("registers one consolidated read without retiring the five console endpoints", () => {
    expect(endpoints.getEventAnalytics.method).toBe("GET")
    expect(endpoints.getEventAnalytics.path).toBe("/cleanups/:id/analytics")
    expect(endpoints.getEventAnalytics.auth).toBe("required")
    expect(endpoints.getEventAnalytics.csrf).toBe(false)
    for (const name of [
      "eventAnalyticsOverview",
      "eventAnalyticsRegistrations",
      "eventAnalyticsCheckins",
      "eventAnalyticsBroadcasts",
      "eventAnalyticsSources",
    ] as const) {
      expect(endpoints[name], name).toBeDefined()
    }
    expect(EventAnalyticsScopeSchema.options).toEqual(["card", "full"])
    expect(EventAnalyticsPhaseSchema.options).toEqual([
      "upcoming",
      "day_of",
      "completed",
      "archived",
    ])
    expect(GetEventAnalyticsRequestSchema.safeParse({ id: UUID, scope: "card" }).success).toBe(true)
    expect(GetEventAnalyticsRequestSchema.safeParse({ id: UUID, range: "7d" }).success).toBe(false)
  })
})
