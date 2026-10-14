import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type * as ClientModule from "../src/client/client.js"
import type * as EndpointsModule from "../src/client/endpoints.js"

/**
 * The typed client parses 2xx bodies against the endpoint's response schema, so the registry's
 * `.default()` / `.catch()` compatibility rules actually apply when the deployed server is older than
 * the client, which is routine. A body that does NOT match still passes through raw: a schema mismatch
 * must degrade, never throw.
 */

const UUID = "123e4567-e89b-12d3-a456-426614174000"

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

/** A CleanupDTO as an OLD server sends it: no linkedReports, no eventKind, no address. */
function legacyCleanup() {
  return {
    id: UUID,
    title: "Echo Park cleanup",
    type: "site",
    lat: 34.07,
    lng: -118.26,
    scheduledAt: "2026-07-24T17:00:00.000Z",
    status: "upcoming",
    organizer: {
      id: UUID,
      name: "Ada",
      avatar: null,
      followers: 0,
      following: 0,
      isFollowing: false,
    },
    going: 3,
    joined: false,
    bring: [],
  }
}

let createApiClient: typeof ClientModule.createApiClient
let parseResponse: typeof ClientModule.parseResponse
let endpoints: typeof EndpointsModule.endpoints

function clientReturning(body: unknown) {
  const fetchImpl = vi.fn(async () => jsonResponse(body)) as unknown as typeof fetch
  return createApiClient({ baseURL: "https://api.civfix.test", fetchImpl })
}

// A fresh module per test resets the client's once-per-endpoint warning memo.
beforeEach(async () => {
  vi.resetModules()
  ;({ createApiClient, parseResponse } = await import("../src/client/client.js"))
  ;({ endpoints } = await import("../src/client/endpoints.js"))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("typed client response parsing", () => {
  it("applies schema defaults a legacy server omitted", async () => {
    const client = clientReturning({ items: [legacyCleanup()], nextCursor: null })
    const res = await client.listCleanups({})
    const cleanup = res.items[0]!
    // Without parsing these were `undefined` while the inferred type promised an array / a value.
    expect(cleanup.linkedReports).toEqual([])
    expect(cleanup.eventKind).toBe("cleanup")
    expect(cleanup.address).toBeNull()
  })

  it("passes a mismatching body through raw and warns exactly once per endpoint", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const bogus = { items: "not-an-array" }
    const client = clientReturning(bogus)

    expect(await client.listCleanups({})).toEqual(bogus)
    expect(await client.listCleanups({})).toEqual(bogus)

    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain("listCleanups")
  })

  it("never throws on a mismatching body", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const client = clientReturning(null)
    await expect(client.listCleanups({})).resolves.toBeNull()
  })

  it("leaves a 204 / empty body alone without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(parseResponse(endpoints.listCleanups, undefined)).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("typed client 2xx body decoding", () => {
  function clientWith(res: () => Response) {
    const fetchImpl = vi.fn(async () => res()) as unknown as typeof fetch
    return createApiClient({ baseURL: "https://api.civfix.test", fetchImpl })
  }

  it("rejects a 2xx body that is not JSON with an INTERNAL AppError carrying the request id", async () => {
    const client = clientWith(
      () =>
        new Response("<html>gateway</html>", {
          status: 200,
          headers: { "content-type": "text/html", "x-request-id": "req-1" },
        }),
    )
    await expect(client.listCleanups({})).rejects.toMatchObject({
      name: "AppError",
      code: "INTERNAL",
      httpStatus: 500,
      requestId: "req-1",
    })
  })

  it("rejects an empty 200 body instead of resolving undefined", async () => {
    const client = clientWith(() => new Response("", { status: 200 }))
    await expect(client.listCleanups({})).rejects.toMatchObject({ code: "INTERNAL" })
  })

  it("still resolves a 204 to undefined", async () => {
    const client = clientWith(() => new Response(null, { status: 204 }))
    await expect(client.listCleanups({})).resolves.toBeUndefined()
  })

  it("rethrows the abort, not an AppError, when the caller aborted during the body read", async () => {
    const controller = new AbortController()
    controller.abort()
    const abort = new DOMException("The operation was aborted.", "AbortError")
    const client = clientWith(
      () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => {
            throw abort
          },
        }) as unknown as Response,
    )
    await expect(client.listCleanups({}, { signal: controller.signal })).rejects.toBe(abort)
  })
})
