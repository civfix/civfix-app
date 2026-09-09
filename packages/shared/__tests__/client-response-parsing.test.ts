import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createApiClient, parseResponse, resetResponseWarnings } from "../src/client/client.js"
import { endpoints } from "../src/client/endpoints.js"

/**
 * The typed client parses 2xx bodies against the endpoint's response schema, so the registry's
 * `.default()` / `.catch()` compatibility rules actually apply when the deployed server is older than
 * the client (this project routinely runs skewed: manual backend deploys, lagging EAS builds). A body
 * that does NOT match still passes through raw — a schema mismatch must degrade, never throw.
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

function clientReturning(body: unknown) {
  const fetchImpl = vi.fn(async () => jsonResponse(body)) as unknown as typeof fetch
  return createApiClient({ baseURL: "https://api.civfix.test", fetchImpl })
}

beforeEach(() => {
  resetResponseWarnings()
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
