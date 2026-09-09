import { describe, expect, it, vi } from "vitest"
import type { HostExportDTO, HostExportStatus } from "@civfix/shared"
import { queryKeys } from "../keys"
import { invalidationKeysForTopic } from "../signals"
import { ORG_DONATION_EXPORTS_POLL_MS, exportsPollInterval } from "../hooks/orgs"
import { fetchEventIcs } from "../eventIcs"

function row(status: HostExportStatus): HostExportDTO {
  return {
    id: `x-${status}`,
    cleanupId: null,
    organizationId: "o1",
    kind: "donations",
    status,
    truncated: false,
    requestedAt: "2026-05-01T10:00:00.000Z",
  }
}

describe("queryKeys.eventIcs", () => {
  it("is a CHILD of the event, so a reschedule invalidates the calendar file with it", () => {
    const prefix = queryKeys.cleanup("e1")
    expect(queryKeys.eventIcs("e1").slice(0, prefix.length)).toEqual([...prefix])
  })

  it("keeps two events' documents apart", () => {
    expect(queryKeys.eventIcs("e1")).not.toEqual(queryKeys.eventIcs("e2"))
  })
})

describe("queryKeys.orgDonationExports", () => {
  it("sits on a first segment NEITHER host persists - not the org namespaces mobile writes to disk", () => {
    expect(queryKeys.orgDonationExports("o1")).toEqual(["host-exports", "org", "o1"])
    const head = queryKeys.orgDonationExports("o1")[0]
    expect(["org", "orgs", "cleanup", "cleanups", "profile", "host", "notifications", "threads"]).not.toContain(head)
  })

  it("keeps two organizations' ledgers apart", () => {
    expect(queryKeys.orgDonationExports("o1")).not.toEqual(queryKeys.orgDonationExports("o2"))
  })
})

describe("exportsPollInterval", () => {
  it("polls while a row is still being built", () => {
    expect(exportsPollInterval([row("queued")], 3000, false)).toBe(3000)
    expect(exportsPollInterval([row("ready"), row("running")], 3000, false)).toBe(3000)
  })

  it("stops the moment nothing is unfinished", () => {
    expect(exportsPollInterval([row("ready")], 3000, false)).toBe(false)
    expect(exportsPollInterval([row("failed"), row("expired")], 3000, false)).toBe(false)
    expect(exportsPollInterval([], 3000, false)).toBe(false)
    expect(exportsPollInterval(undefined, 3000, false)).toBe(false)
  })

  it("stops on a FAILED read even with an unfinished row cached, so it cannot hammer a failing endpoint", () => {
    expect(exportsPollInterval([row("queued")], 3000, true)).toBe(false)
  })

  it("ships a poll interval that is polite to a per-identity budget", () => {
    expect(ORG_DONATION_EXPORTS_POLL_MS).toBeGreaterThanOrEqual(2000)
  })
})

describe("the host realtime topic does not pretend to cover exports", () => {
  it("still resolves to the event subtree only - nothing publishes a signal when an export is ready", () => {
    expect(invalidationKeysForTopic("host", undefined, "e1")).toEqual([queryKeys.hostEvent("e1")])
    expect(invalidationKeysForTopic("host", undefined, "e1").flat()).not.toContain("host-exports")
  })
})

describe("fetchEventIcs", () => {
  it("goes through the typed client with the event id, and returns the document as served", async () => {
    const getEventIcs = vi.fn().mockResolvedValue({ ics: "BEGIN:VCALENDAR", filename: "e1.ics" })
    const served = await fetchEventIcs({ getEventIcs } as never, "e1")
    expect(getEventIcs).toHaveBeenCalledWith({ id: "e1" })
    expect(served).toEqual({ ics: "BEGIN:VCALENDAR", filename: "e1.ics" })
  })

  it("propagates a refusal instead of inventing a document", async () => {
    const getEventIcs = vi.fn().mockRejectedValue(new Error("404"))
    await expect(fetchEventIcs({ getEventIcs } as never, "e1")).rejects.toThrow("404")
  })
})
