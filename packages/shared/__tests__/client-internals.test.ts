import { describe, it, expect, vi } from "vitest"
import {
  createApiClient,
  fillPath,
  buildQuery,
  extractParams,
  parseError,
} from "../src/client/client.js"
import { ErrorCode } from "../src/types/errors.js"

/**
 * Focused unit tests for the typed client's pure helpers (fillPath / buildQuery / extractParams /
 * parseError) and, end-to-end, GET path-param de-duplication: a key consumed as a PATH param
 * must NOT also be serialized into the query string.
 */

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

describe("fillPath", () => {
  it("substitutes and URL-encodes named params", () => {
    expect(fillPath("/cleanups/:id/messages", { id: "a b/c" })).toBe(
      "/cleanups/a%20b%2Fc/messages",
    )
  })

  it("supports multiple params and numeric values", () => {
    expect(fillPath("/media/:uploadId", { uploadId: 42 })).toBe("/media/42")
  })

  it("throws a VALIDATION AppError when a required param is missing", () => {
    expect(() => fillPath("/cleanups/:id/messages", {})).toThrowError(/Missing path param ":id"/)
    try {
      fillPath("/cleanups/:id", {})
    } catch (e) {
      expect((e as { code: ErrorCode }).code).toBe(ErrorCode.VALIDATION)
    }
  })

  it("returns the path unchanged when there are no params", () => {
    expect(fillPath("/healthz")).toBe("/healthz")
  })
})

describe("buildQuery", () => {
  it("returns an empty string for no/empty query", () => {
    expect(buildQuery(undefined)).toBe("")
    expect(buildQuery({})).toBe("")
  })

  it("skips null and undefined values", () => {
    expect(buildQuery({ a: null, b: undefined, c: 1 })).toBe("?c=1")
  })

  it("repeats a key for array values (array-repeat convention)", () => {
    const qs = buildQuery({ categories: ["trash", "water"] })
    expect(qs).toBe("?categories=trash&categories=water")
  })

  it("JSON-encodes object values (bbox/near convention)", () => {
    const qs = buildQuery({ bbox: { west: -1, south: -2, east: 3, north: 4 } })
    const params = new URLSearchParams(qs.slice(1))
    expect(JSON.parse(params.get("bbox")!)).toEqual({ west: -1, south: -2, east: 3, north: 4 })
  })

  it("stringifies scalar values", () => {
    expect(buildQuery({ limit: 10, q: "hi" })).toBe("?limit=10&q=hi")
  })

  it("omits keys listed in omitKeys (path params already consumed)", () => {
    const qs = buildQuery({ cleanupId: UUID, limit: 20, before: "x" }, new Set(["cleanupId"]))
    const params = new URLSearchParams(qs.slice(1))
    expect(params.has("cleanupId")).toBe(false)
    expect(params.get("limit")).toBe("20")
    expect(params.get("before")).toBe("x")
  })
})

describe("extractParams", () => {
  it("returns undefined params and no consumed keys when the path has no params", () => {
    const { params, consumedKeys } = extractParams("/threads", { limit: 5 })
    expect(params).toBeUndefined()
    expect(consumedKeys.size).toBe(0)
  })

  it("fills :id for /cleanups/:id/messages from the cleanupId field via the *Id tolerance", () => {
    // The real cleanupMessages endpoint: path says ":id" but ChatHistoryRequest carries `cleanupId`.
    // The tolerance resolves :id from cleanupId and reports cleanupId as the consumed key (so it is
    // later excluded from the GET query rather than duplicated).
    const { params, consumedKeys } = extractParams("/cleanups/:id/messages", {
      cleanupId: UUID,
      limit: 30,
    })
    expect(params).toEqual({ id: UUID })
    expect([...consumedKeys]).toEqual(["cleanupId"])
  })

  it("matches an exact param name and consumes that key", () => {
    const { params, consumedKeys } = extractParams("/media/:uploadId/finalize", {
      uploadId: "u-1",
      sha256: "abc",
    })
    expect(params).toEqual({ uploadId: "u-1" })
    expect([...consumedKeys]).toEqual(["uploadId"])
  })

  it("tolerates :id mapping to a single *Id-suffixed key and consumes THAT key (reportId)", () => {
    const { params, consumedKeys } = extractParams("/anon/reports/:id/status", {
      reportId: "r-1",
      claimCode: "code",
    })
    expect(params).toEqual({ id: "r-1" })
    expect([...consumedKeys]).toEqual(["reportId"])
  })

  it("leaves :id unfilled when several *Id-suffixed keys make the tolerance ambiguous", () => {
    const input = { messageId: "m-1", cleanupId: "c-1" }
    const { params, consumedKeys } = extractParams("/cleanups/:id/messages", input)
    expect(params).toEqual({})
    expect(consumedKeys.size).toBe(0)
    expect(() => fillPath("/cleanups/:id/messages", params)).toThrow()
  })
})

describe("parseError", () => {
  it("parses the canonical envelope and keeps the HTTP status", async () => {
    const res = jsonResponse({ code: "NOT_FOUND", message: "gone" }, { status: 404 })
    const err = await parseError(res, "req-1")
    expect(err.code).toBe(ErrorCode.NOT_FOUND)
    expect(err.httpStatus).toBe(404)
    expect(err.message).toBe("gone")
  })

  it("coerces an unknown envelope code to INTERNAL", async () => {
    const res = jsonResponse({ code: "WAT", message: "weird" }, { status: 500 })
    const err = await parseError(res)
    expect(err.code).toBe(ErrorCode.INTERNAL)
  })

  it("falls back to a status-derived code when the body is not our envelope", async () => {
    const res = new Response("not json", { status: 429, statusText: "Too Many Requests" })
    const err = await parseError(res, "req-2")
    expect(err.code).toBe(ErrorCode.RATE_LIMITED)
    expect(err.httpStatus).toBe(429)
    expect(err.requestId).toBe("req-2")
  })

  it("uses INTERNAL for an unmapped status with a non-envelope body", async () => {
    const res = new Response("", { status: 418, statusText: "I'm a teapot" })
    const err = await parseError(res)
    expect(err.code).toBe(ErrorCode.INTERNAL)
    expect(err.httpStatus).toBe(418)
  })

  it("prefers the envelope requestId over the header-provided one", async () => {
    const res = jsonResponse(
      { code: "VALIDATION", message: "bad", requestId: "from-body" },
      { status: 422 },
    )
    const err = await parseError(res, "from-header")
    expect(err.requestId).toBe("from-body")
  })
})

describe("createApiClient GET path-param de-duplication", () => {
  it("does NOT duplicate the path-param key into the query for GET /cleanups/:id/messages", async () => {
    let url = ""
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      url = String(u)
      return jsonResponse({ items: [], nextCursor: null })
    }) as unknown as typeof fetch

    const client = createApiClient({ baseURL: "https://api.civfix.test", fetchImpl })
    await client.cleanupMessages({ cleanupId: UUID, limit: 30, before: "cursor-x" })

    expect(url).toContain(`/cleanups/${UUID}/messages`)
    const qs = url.includes("?") ? url.slice(url.indexOf("?") + 1) : ""
    const params = new URLSearchParams(qs)
    expect(params.has("cleanupId")).toBe(false)
    expect(params.get("limit")).toBe("30")
    expect(params.get("before")).toBe("cursor-x")
  })

  it("excludes the *Id-tolerated key (reportId) from the GET query while keeping other fields", async () => {
    let url = ""
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      url = String(u)
      return jsonResponse({ status: "submitted" })
    }) as unknown as typeof fetch

    const client = createApiClient({ baseURL: "https://api.civfix.test", fetchImpl })
    await client.anonReportStatus({ reportId: UUID, claimCode: "code-123" })

    expect(url).toContain(`/anon/reports/${UUID}/status`)
    const qs = url.includes("?") ? url.slice(url.indexOf("?") + 1) : ""
    const params = new URLSearchParams(qs)
    expect(params.has("reportId")).toBe(false)
    expect(params.get("claimCode")).toBe("code-123")
  })

  it("still serializes object (JSON) and array (repeat) query fields on a GET with no path param", async () => {
    let url = ""
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      url = String(u)
      return jsonResponse({ clusters: [], pins: [] })
    }) as unknown as typeof fetch

    const client = createApiClient({ baseURL: "https://api.civfix.test", fetchImpl })
    await client.mapReports({
      bbox: { west: -118.5, south: 34.0, east: -118.2, north: 34.2 },
      categories: ["trash", "graffiti"],
      zoom: 12,
    })

    const qs = url.slice(url.indexOf("?") + 1)
    const params = new URLSearchParams(qs)
    expect(JSON.parse(params.get("bbox")!)).toEqual({
      west: -118.5,
      south: 34.0,
      east: -118.2,
      north: 34.2,
    })
    expect(params.getAll("categories")).toEqual(["trash", "graffiti"])
    expect(params.get("zoom")).toBe("12")
  })
})
