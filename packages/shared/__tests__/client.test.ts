import { describe, it, expect, vi } from "vitest"
import { createApiClient } from "../src/client/client.js"
import { endpoints } from "../src/client/endpoints.js"
import { AppError, ErrorCode } from "../src/types/errors.js"
import {
  GetApproximateLocationRequestSchema,
  GetApproximateLocationResponseSchema,
} from "../src/schemas/geo.js"

const UUID = "123e4567-e89b-12d3-a456-426614174000"

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  })
}

describe("endpoint registry", () => {
  it("covers the full Phase 1 + admin surface with unique paths per method", () => {
    const names = Object.keys(endpoints)
    expect(names.length).toBe(324)
    const seen = new Set<string>()
    for (const name of names) {
      const e = endpoints[name as keyof typeof endpoints]
      const key = `${e.method} ${e.path}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
      expect(["public", "optional", "required"]).toContain(e.auth)
    }
  })

  it("registers exactly 104 admin endpoints under /admin", () => {
    const adminNames = Object.keys(endpoints).filter((n) =>
      endpoints[n as keyof typeof endpoints].path.startsWith("/admin"),
    )
    expect(adminNames.length).toBe(104)
  })

  it("registers GET /geo/approximate as an optional, csrf-free v1 endpoint", () => {
    const e = endpoints.getApproximateLocation
    expect(e.method).toBe("GET")
    expect(e.path).toBe("/geo/approximate")
    expect(e.auth).toBe("optional")
    expect(e.csrf).toBe(false)
    expect(e.version).toBe("v1")
    expect(e.request).toBe(GetApproximateLocationRequestSchema)
    expect(e.response).toBe(GetApproximateLocationResponseSchema)
  })

  it("parses an approximate location and rejects an off-globe or zero-radius one", () => {
    expect(
      GetApproximateLocationResponseSchema.parse({
        lat: 34.0522,
        lng: -118.2437,
        radiusKm: 25,
        source: "ip",
      }).source,
    ).toBe("ip")
    expect(
      GetApproximateLocationResponseSchema.safeParse({
        lat: 34.0522,
        lng: -118.2437,
        radiusKm: 25,
        source: "region",
      }).success,
    ).toBe(true)
    expect(
      GetApproximateLocationResponseSchema.safeParse({
        lat: 91,
        lng: -118.2437,
        radiusKm: 25,
        source: "ip",
      }).success,
    ).toBe(false)
    expect(
      GetApproximateLocationResponseSchema.safeParse({
        lat: 34.0522,
        lng: -118.2437,
        radiusKm: 0,
        source: "ip",
      }).success,
    ).toBe(false)
    expect(
      GetApproximateLocationResponseSchema.safeParse({
        lat: 34.0522,
        lng: -118.2437,
        radiusKm: 25,
        source: "gps",
      }).success,
    ).toBe(false)
    expect(GetApproximateLocationRequestSchema.safeParse({ lat: 1 }).success).toBe(false)
  })

  it("registers GET /map/cleanups as an optional, csrf-free endpoint", () => {
    const e = endpoints.mapCleanups
    expect(e.method).toBe("GET")
    expect(e.path).toBe("/map/cleanups")
    expect(e.auth).toBe("optional")
    expect(e.csrf).toBe(false)
  })

  it("registers POST /reports/:id/unlist as an auth-required, csrf-guarded owner action", () => {
    const e = endpoints.unlistReport
    expect(e.method).toBe("POST")
    expect(e.path).toBe("/reports/:id/unlist")
    expect(e.auth).toBe("required")
    expect(e.csrf).toBe(true)
  })

  it("registers POST /cleanups/:id/cancel as an auth-required, csrf-guarded host action", () => {
    const e = endpoints.cancelCleanup
    expect(e.method).toBe("POST")
    expect(e.path).toBe("/cleanups/:id/cancel")
    expect(e.auth).toBe("required")
    expect(e.csrf).toBe(true)
  })

  it("marks exactly /healthz and the OAuth start/callback routes unversioned, all else v1", () => {
    const unversioned = Object.keys(endpoints)
      .filter((n) => endpoints[n as keyof typeof endpoints].version === "unversioned")
      .map((n) => endpoints[n as keyof typeof endpoints].path)
      .sort()
    expect(unversioned).toEqual([
      "/auth/apple/callback",
      "/auth/apple/start",
      "/auth/google/callback",
      "/auth/google/start",
      "/healthz",
    ])

    for (const name of Object.keys(endpoints)) {
      const e = endpoints[name as keyof typeof endpoints]
      const expected =
        e.path === "/healthz" || /^\/auth\/[^/]+\/(start|callback)$/.test(e.path)
          ? "unversioned"
          : "v1"
      expect(e.version).toBe(expected)
    }
  })
})

describe("admin endpoint registry", () => {
  it("makes the Access exchange public and csrf-free, everything else operator-gated", () => {
    expect(endpoints.adminAccessExchange.auth).toBe("public")
    expect(endpoints.adminAccessExchange.csrf).toBe(false)
    for (const name of Object.keys(endpoints)) {
      const e = endpoints[name as keyof typeof endpoints]
      if (!e.path.startsWith("/admin")) continue
      if (name === "adminAccessExchange") continue
      expect(e.auth).toBe("required")
    }
  })

  it("sets csrf on admin mutations (POST/PATCH) and clears it on admin GETs", () => {
    for (const name of Object.keys(endpoints)) {
      const e = endpoints[name as keyof typeof endpoints]
      if (!e.path.startsWith("/admin")) continue
      if (name === "adminAccessExchange") continue
      if (e.method === "GET") {
        expect(e.csrf).toBe(false)
      } else {
        expect(e.csrf).toBe(true)
      }
    }
  })

  it("maps a representative sample to the right method/path/auth/csrf", () => {
    expect(endpoints.adminHomeSummary.method).toBe("GET")
    expect(endpoints.adminHomeSummary.path).toBe("/admin/home/summary")
    expect(endpoints.adminHomeSummary.csrf).toBe(false)

    expect(endpoints.setReportStatus.method).toBe("POST")
    expect(endpoints.setReportStatus.path).toBe("/admin/reports/:id/status")
    expect(endpoints.setReportStatus.auth).toBe("required")
    expect(endpoints.setReportStatus.csrf).toBe(true)

    expect(endpoints.saveJurisdictionContacts.path).toBe("/admin/jurisdictions/:geoid/contacts")
    expect(endpoints.saveJurisdictionContacts.csrf).toBe(true)

    expect(endpoints.patchJurisdiction.method).toBe("PATCH")
    expect(endpoints.patchJurisdiction.path).toBe("/admin/jurisdictions/:geoid")
    expect(endpoints.patchJurisdiction.csrf).toBe(true)

    expect(endpoints.analyticsRetention.method).toBe("GET")
    expect(endpoints.analyticsRetention.path).toBe("/admin/analytics/retention")
  })

  it("fills :id and :geoid admin path params from the typed input", async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url))
      return jsonResponse({ ok: true })
    }) as unknown as typeof fetch
    const client = createApiClient({
      baseURL: "https://api.civfix.test",
      fetchImpl,
      getCsrfToken: () => "csrf-1",
    })

    await client.setReportStatus({ id: UUID, status: "in_progress" })
    expect(calls[0]).toBe(`https://api.civfix.test/v1/admin/reports/${UUID}/status`)

    await client.saveJurisdictionContacts({
      geoid: "0644000",
      contacts: { trash: "sanitation@city.gov" },
    })
    expect(calls[1]).toBe("https://api.civfix.test/v1/admin/jurisdictions/0644000/contacts")
  })
})

describe("createApiClient", () => {
  it("fills path params, injects auth + csrf, and returns parsed JSON", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return jsonResponse({ ok: true })
    }) as unknown as typeof fetch

    const client = createApiClient({
      baseURL: "https://api.civfix.test/",
      fetchImpl,
      getAuthHeader: () => ({ Authorization: "Bearer T" }),
      getCsrfToken: () => "csrf-123",
    })

    const res = await client.joinReportChat({ id: UUID })
    expect(res).toEqual({ ok: true })

    const call = calls[0]!
    expect(call.url).toBe(`https://api.civfix.test/v1/reports/${UUID}/chat/join`)
    const headers = call.init.headers as Record<string, string>
    expect(headers["Authorization"]).toBe("Bearer T")
    expect(headers["x-csrf-token"]).toBe("csrf-123")
    expect(call.init.method).toBe("POST")
  })

  it("serializes a typed body for POST and sets content-type", async () => {
    let captured: RequestInit | undefined
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      captured = init
      return jsonResponse({ sent: true, resendAfterSec: 30 })
    }) as unknown as typeof fetch

    const client = createApiClient({ baseURL: "https://api.civfix.test", fetchImpl })
    const out = await client.otpRequest({ email: "a@b.com" })
    expect(out).toEqual({ sent: true, resendAfterSec: 30 })
    expect(JSON.parse(captured!.body as string)).toEqual({ email: "a@b.com" })
    expect((captured!.headers as Record<string, string>)["content-type"]).toBe("application/json")
  })

  it("encodes GET query params", async () => {
    let url = ""
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      url = String(u)
      return jsonResponse({ items: [], nextCursor: null })
    }) as unknown as typeof fetch

    const client = createApiClient({ baseURL: "https://api.civfix.test", fetchImpl })
    await client.listMyReports({ limit: 10 })
    expect(url).toContain("/v1/reports?")
    expect(url).toContain("limit=10")
  })

  it("throws a typed AppError on non-2xx using the error envelope", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ code: "NOT_FOUND", message: "no report" }, { status: 404 }),
    ) as unknown as typeof fetch

    const client = createApiClient({ baseURL: "https://api.civfix.test", fetchImpl })
    await expect(client.getReport({ id: UUID })).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
      httpStatus: 404,
    })
  })

  it("invokes onUnauthorized for a 401", async () => {
    const onUnauthorized = vi.fn()
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ code: "UNAUTHORIZED", message: "nope" }, { status: 401 }),
    ) as unknown as typeof fetch

    const client = createApiClient({
      baseURL: "https://api.civfix.test",
      fetchImpl,
      onUnauthorized,
    })
    await expect(client.logout()).rejects.toBeInstanceOf(AppError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it("does not send auth header for public endpoints", async () => {
    let headers: Record<string, string> = {}
    const fetchImpl = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      headers = (init?.headers as Record<string, string>) ?? {}
      return jsonResponse({ ok: true })
    }) as unknown as typeof fetch

    const getAuthHeader = vi.fn(() => ({ Authorization: "Bearer T" }))
    const client = createApiClient({ baseURL: "https://api.civfix.test", fetchImpl, getAuthHeader })
    await client.health()
    expect(getAuthHeader).not.toHaveBeenCalled()
    expect(headers["Authorization"]).toBeUndefined()
  })

  it("targets the /v1 wire path for a versioned endpoint", async () => {
    let url = ""
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      url = String(u)
      return jsonResponse({ items: [], nextCursor: null })
    }) as unknown as typeof fetch

    const client = createApiClient({ baseURL: "https://api.civfix.test", fetchImpl })
    await client.listCleanups({})
    expect(url).toBe("https://api.civfix.test/v1/cleanups")
  })

  it("targets the bare (unversioned) path for an unversioned endpoint", async () => {
    let url = ""
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      url = String(u)
      return jsonResponse({ url: "https://accounts.google.com/o/oauth2/auth" })
    }) as unknown as typeof fetch

    const client = createApiClient({ baseURL: "https://api.civfix.test", fetchImpl })
    await client.googleStart({})
    expect(url).toBe("https://api.civfix.test/auth/google/start")
  })
})
