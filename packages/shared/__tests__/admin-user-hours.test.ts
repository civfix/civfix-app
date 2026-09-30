import { describe, it, expect, vi } from "vitest"
import { createApiClient } from "../src/client/client.js"
import { endpoints } from "../src/client/endpoints.js"
import { AdminReasonSchema } from "../src/schemas/admin/common.js"
import { AdminSetOrgSuspendedRequestSchema } from "../src/schemas/admin/orgs.js"
import {
  AdminCreditUserHoursRequestSchema,
  AdminCreditUserHoursResponseSchema,
  AdminUserHoursEntryDTOSchema,
  AdminUserHoursQuerySchema,
  AdminUserHoursResponseSchema,
  AdminVoidUserHoursRequestSchema,
  AdminVoidUserHoursResponseSchema,
  SERVICE_DATE_MIN,
  ServiceDateSchema,
} from "../src/schemas/admin/user-hours.js"
import {
  EventHoursResponseSchema,
  MAX_EVENT_HOURS,
  MIN_EVENT_HOURS,
} from "../src/schemas/volunteer.js"

const USER = "123e4567-e89b-12d3-a456-426614174000"
const EVENT = "223e4567-e89b-12d3-a456-426614174000"
const ENTRY = "323e4567-e89b-12d3-a456-426614174000"
const OFFICIAL = "423e4567-e89b-12d3-a456-426614174000"
const OPERATOR = "523e4567-e89b-12d3-a456-426614174000"

const eventCredit = {
  id: USER,
  kind: "event",
  eventId: EVENT,
  hours: 2.5,
  reason: "Attended before signing up",
} as const

const manualCredit = {
  id: USER,
  kind: "manual",
  hours: 1.25,
  serviceDate: "2026-09-20",
  reason: "Staffed the supply table",
} as const

const ledgerEntry = {
  id: ENTRY,
  source: "event",
  hours: 2.5,
  occurredAt: "2026-09-19T16:00:00.000Z",
  creditedAt: "2026-09-25T18:30:00.000Z",
  serviceDate: null,
  event: { id: EVENT, title: "Echo Park cleanup", referenceCode: "EV-1234" },
  jurisdiction: { geoid: "0644000", name: "Los Angeles" },
  creditedBy: { id: OFFICIAL, name: "CivFix", handle: "civfix", official: true },
  operator: { id: OPERATOR, name: "Ada Operator" },
  note: "Attended before signing up",
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
  voidable: true,
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

describe("admin user-hours registry", () => {
  it("registers the ledger read and both writes under the operator-gated users surface", () => {
    expect(endpoints.getUserHours).toMatchObject({
      method: "GET",
      path: "/admin/users/:id/hours",
      auth: "required",
      csrf: false,
      version: "v1",
    })
    expect(endpoints.getUserHours.request).toBe(AdminUserHoursQuerySchema)
    expect(endpoints.getUserHours.response).toBe(AdminUserHoursResponseSchema)

    expect(endpoints.creditUserHours).toMatchObject({
      method: "POST",
      path: "/admin/users/:id/hours",
      auth: "required",
      csrf: true,
      version: "v1",
    })
    expect(endpoints.creditUserHours.request).toBe(AdminCreditUserHoursRequestSchema)
    expect(endpoints.creditUserHours.response).toBe(AdminCreditUserHoursResponseSchema)

    expect(endpoints.voidUserHours).toMatchObject({
      method: "POST",
      path: "/admin/users/:id/hours/:entryId/void",
      auth: "required",
      csrf: true,
      version: "v1",
    })
    expect(endpoints.voidUserHours.request).toBe(AdminVoidUserHoursRequestSchema)
    expect(endpoints.voidUserHours.response).toBe(AdminVoidUserHoursResponseSchema)
  })

  it("fills the path from either credit member and from the void's two ids", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      if (init?.method === "GET") {
        return jsonResponse({
          items: [],
          nextCursor: null,
          totals: { totalHours: 0, liveEntries: 0, voidedEntries: 0 },
        })
      }
      if (String(url).endsWith("/void")) return jsonResponse({ ok: true, affectedCertificates: [] })
      return jsonResponse({ entryId: ENTRY, totalHours: 2.5 })
    }) as unknown as typeof fetch
    const warn = vi.spyOn(console, "warn")
    const client = createApiClient({
      baseURL: "https://api.civfix.test",
      fetchImpl,
      getCsrfToken: () => "csrf-1",
    })

    await client.creditUserHours(eventCredit)
    await client.creditUserHours(manualCredit)
    await client.voidUserHours({ id: USER, entryId: ENTRY, reason: "Duplicate" })
    await client.getUserHours({ id: USER, limit: 20, cursor: "c1" })

    expect(calls[0]!.url).toBe(`https://api.civfix.test/v1/admin/users/${USER}/hours`)
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual(eventCredit)
    expect(calls[1]!.url).toBe(`https://api.civfix.test/v1/admin/users/${USER}/hours`)
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual(manualCredit)
    expect(calls[2]!.url).toBe(
      `https://api.civfix.test/v1/admin/users/${USER}/hours/${ENTRY}/void`,
    )
    for (const call of calls.slice(0, 3)) {
      expect((call.init.headers as Record<string, string>)["x-csrf-token"]).toBe("csrf-1")
    }
    expect(calls[3]!.url).toBe(
      `https://api.civfix.test/v1/admin/users/${USER}/hours?limit=20&cursor=c1`,
    )
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe("AdminCreditUserHoursRequest", () => {
  it("parses each member by its kind", () => {
    expect(AdminCreditUserHoursRequestSchema.parse(eventCredit)).toEqual(eventCredit)
    expect(AdminCreditUserHoursRequestSchema.parse(manualCredit)).toEqual(manualCredit)
  })

  it("rejects an unknown kind and a missing kind", () => {
    expect(AdminCreditUserHoursRequestSchema.safeParse({ ...manualCredit, kind: "report" }).success).toBe(false)
    const { kind: _kind, ...noKind } = manualCredit
    expect(AdminCreditUserHoursRequestSchema.safeParse(noKind).success).toBe(false)
  })

  it("keeps each member strict so one kind cannot carry the other's field", () => {
    expect(
      AdminCreditUserHoursRequestSchema.safeParse({ ...eventCredit, serviceDate: "2026-09-20" }).success,
    ).toBe(false)
    expect(AdminCreditUserHoursRequestSchema.safeParse({ ...manualCredit, eventId: EVENT }).success).toBe(false)
    expect(AdminCreditUserHoursRequestSchema.safeParse({ ...eventCredit, userId: USER }).success).toBe(false)
  })

  it("requires the event on an event credit and the service date on a manual one", () => {
    const { eventId: _eventId, ...noEvent } = eventCredit
    expect(AdminCreditUserHoursRequestSchema.safeParse(noEvent).success).toBe(false)
    const { serviceDate: _serviceDate, ...noDate } = manualCredit
    expect(AdminCreditUserHoursRequestSchema.safeParse(noDate).success).toBe(false)
    expect(AdminCreditUserHoursRequestSchema.safeParse({ ...eventCredit, eventId: "EV-1234" }).success).toBe(false)
  })

  it("bounds hours to the event-hours range on both members", () => {
    for (const base of [eventCredit, manualCredit]) {
      expect(AdminCreditUserHoursRequestSchema.safeParse({ ...base, hours: MIN_EVENT_HOURS }).success).toBe(true)
      expect(AdminCreditUserHoursRequestSchema.safeParse({ ...base, hours: MAX_EVENT_HOURS }).success).toBe(true)
      expect(AdminCreditUserHoursRequestSchema.safeParse({ ...base, hours: 0 }).success).toBe(false)
      expect(AdminCreditUserHoursRequestSchema.safeParse({ ...base, hours: 0.001 }).success).toBe(false)
      expect(AdminCreditUserHoursRequestSchema.safeParse({ ...base, hours: 24.01 }).success).toBe(false)
      expect(AdminCreditUserHoursRequestSchema.safeParse({ ...base, hours: -1 }).success).toBe(false)
      expect(AdminCreditUserHoursRequestSchema.safeParse({ ...base, hours: "2" }).success).toBe(false)
    }
  })

  it("trims the reason and requires 1-1000 characters of it", () => {
    const parsed = AdminCreditUserHoursRequestSchema.parse({ ...eventCredit, reason: "  late signup  " })
    expect(parsed.reason).toBe("late signup")
    expect(AdminCreditUserHoursRequestSchema.safeParse({ ...eventCredit, reason: "   " }).success).toBe(false)
    expect(AdminCreditUserHoursRequestSchema.safeParse({ ...manualCredit, reason: "" }).success).toBe(false)
    expect(AdminCreditUserHoursRequestSchema.safeParse({ ...manualCredit, reason: "x".repeat(1000) }).success).toBe(true)
    expect(AdminCreditUserHoursRequestSchema.safeParse({ ...manualCredit, reason: "x".repeat(1001) }).success).toBe(false)
  })
})

describe("ServiceDate", () => {
  it("accepts a calendar date and nothing with a time or a loose format", () => {
    expect(ServiceDateSchema.safeParse("2026-09-20").success).toBe(true)
    expect(ServiceDateSchema.safeParse("2028-02-29").success).toBe(true)
    for (const bad of ["2026-9-20", "2026-02-30", "2026-13-01", "2026-09-20T00:00:00Z", "20/09/2026", ""]) {
      expect(ServiceDateSchema.safeParse(bad).success).toBe(false)
    }
  })

  it("refuses dates before the floor, so year 0000 never reaches Postgres", () => {
    expect(ServiceDateSchema.safeParse(SERVICE_DATE_MIN).success).toBe(true)
    for (const early of ["0000-01-01", "0001-01-01", "1900-06-15", "1999-12-31"]) {
      expect(ServiceDateSchema.safeParse(early).success).toBe(false)
      expect(AdminCreditUserHoursRequestSchema.safeParse({ ...manualCredit, serviceDate: early }).success).toBe(false)
    }
  })
})

describe("AdminVoidUserHoursRequest", () => {
  it("is strict, takes uuids for both path params and requires a reason", () => {
    const body = { id: USER, entryId: ENTRY, reason: " Duplicate credit " }
    expect(AdminVoidUserHoursRequestSchema.parse(body).reason).toBe("Duplicate credit")
    expect(AdminVoidUserHoursRequestSchema.safeParse({ ...body, entryId: "1" }).success).toBe(false)
    expect(AdminVoidUserHoursRequestSchema.safeParse({ ...body, reason: " " }).success).toBe(false)
    expect(AdminVoidUserHoursRequestSchema.safeParse({ ...body, hours: 1 }).success).toBe(false)
  })

  it("returns the live certificates that still list the entry", () => {
    const parsed = AdminVoidUserHoursResponseSchema.parse({
      ok: true,
      affectedCertificates: [{ code: "ABCD2345EFGH", issuedAt: "2026-09-01T12:00:00Z" }],
    })
    expect(parsed.affectedCertificates[0]!.issuedAt).toBe("2026-09-01T12:00:00.000Z")
    expect(AdminVoidUserHoursResponseSchema.safeParse({ ok: true }).success).toBe(false)
  })
})

describe("AdminUserHoursQuery", () => {
  it("coerces the query-string limit and bounds it to 1-50", () => {
    expect(AdminUserHoursQuerySchema.parse({ id: USER, limit: "20" }).limit).toBe(20)
    expect(AdminUserHoursQuerySchema.safeParse({ id: USER, limit: "0" }).success).toBe(false)
    expect(AdminUserHoursQuerySchema.safeParse({ id: USER, limit: "51" }).success).toBe(false)
    expect(AdminUserHoursQuerySchema.safeParse({ id: USER, filter: "voided" }).success).toBe(false)
    expect(AdminUserHoursQuerySchema.safeParse({ id: "not-a-uuid" }).success).toBe(false)
  })
})

describe("AdminUserHoursResponse", () => {
  it("parses a page of live, voided and manual entries with the totals", () => {
    const voided = {
      ...ledgerEntry,
      voidedAt: "2026-09-26T09:00:00Z",
      voidedBy: { id: OPERATOR, name: "Ada Operator" },
      voidReason: "Wrong event",
      voidable: false,
    }
    const manual = {
      ...ledgerEntry,
      id: EVENT,
      source: "manual",
      serviceDate: "2026-09-20",
      occurredAt: "2026-09-20T12:00:00.000Z",
      event: null,
      jurisdiction: null,
    }
    const parsed = AdminUserHoursResponseSchema.parse({
      items: [ledgerEntry, voided, manual],
      nextCursor: null,
      totals: { totalHours: 3.75, liveEntries: 2, voidedEntries: 1 },
    })
    expect(parsed.items).toHaveLength(3)
    expect(parsed.items[1]!.voidedAt).toBe("2026-09-26T09:00:00.000Z")
    expect(parsed.totals.totalHours).toBe(3.75)
  })

  it("requires the totals and rejects an entry with an unknown field", () => {
    expect(AdminUserHoursResponseSchema.safeParse({ items: [], nextCursor: null }).success).toBe(false)
    expect(AdminUserHoursEntryDTOSchema.safeParse({ ...ledgerEntry, extra: 1 }).success).toBe(false)
    expect(AdminUserHoursEntryDTOSchema.safeParse({ ...ledgerEntry, source: "donation" }).success).toBe(false)
  })
})

describe("EventHoursResponse.creditedByOfficial", () => {
  it("is optional so an older server still parses", () => {
    const row = { userId: USER, hours: 2, loggedAt: "2026-09-19T18:00:00Z" }
    const older = EventHoursResponseSchema.parse({ scope: "all", entries: [row] })
    expect(older.entries[0]!.creditedByOfficial).toBeUndefined()
    const newer = EventHoursResponseSchema.parse({
      scope: "all",
      entries: [{ ...row, creditedByOfficial: true }],
    })
    expect(newer.entries[0]!.creditedByOfficial).toBe(true)
  })
})

describe("AdminReasonSchema", () => {
  it("is the one reason rule the org writes and the hours writes share", () => {
    expect(AdminReasonSchema.parse("  why  ")).toBe("why")
    expect(
      AdminSetOrgSuspendedRequestSchema.safeParse({ id: USER, suspended: true, reason: "   " }).success,
    ).toBe(false)
  })
})
