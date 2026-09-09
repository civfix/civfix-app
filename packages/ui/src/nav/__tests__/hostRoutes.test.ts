import { describe, expect, it } from "vitest"
import { entryFromPath, pathForEntry, parentViewForEntry, titleForEntry } from "../routes"
import { ALL_DETAIL_KINDS, type DetailEntry } from "../types"
import { FLOW_KINDS } from "../flowKinds"
import { DETAIL_BODY } from "../../shell/bodyRoutes"
import { BODY_LAYOUT } from "../../shell/bodyLayout"

const HOST_KINDS = [
  "host-mode",
  "host-checkin",
  "host-broadcast-quick",
  "my-ticket",
  "org",
  "my-donations",
] as const

describe("the new kinds are registered everywhere a kind must be registered", () => {
  it.each(HOST_KINDS)("%s is in the canonical kind list", (kind) => {
    expect(ALL_DETAIL_KINDS).toContain(kind)
  })

  it.each(HOST_KINDS)("%s routes to a real body and has a layout", (kind) => {
    expect(DETAIL_BODY[kind]).toBeDefined()
    expect(DETAIL_BODY[kind]).not.toBe("stub")
    expect(BODY_LAYOUT[kind]).toBeDefined()
  })

  it.each(HOST_KINDS)("%s has a header title, so a full page always has an exit", (kind) => {
    expect(titleForEntry({ kind } as DetailEntry)).not.toBe("")
  })
})

describe("URL round trip", () => {
  const cases: Array<[string, DetailEntry]> = [
    ["/cleanups/e1/host", { kind: "host-mode", id: "e1" }],
    ["/cleanups/e1/checkin", { kind: "host-checkin", id: "e1" }],
    ["/cleanups/e1/broadcast", { kind: "host-broadcast-quick", id: "e1" }],
    ["/cleanups/e1/ticket", { kind: "my-ticket", id: "e1" }],
    ["/cleanups/e1/ticket/seat-9", { kind: "my-ticket", id: "e1", seatId: "seat-9" }],
    ["/orgs/river-keepers", { kind: "org", slug: "river-keepers" }],
    ["/me/donations", { kind: "my-donations" }],
  ]

  it.each(cases)("%s", (path, entry) => {
    expect(pathForEntry(entry)).toBe(path)
    expect(entryFromPath(path)).toEqual(entry)
  })

  it("keeps the plain event detail and the edit route intact", () => {
    expect(entryFromPath("/cleanups/e1")).toEqual({ kind: "cleanup", id: "e1" })
    expect(entryFromPath("/cleanups/e1/edit")).toEqual({ kind: "edit-cleanup", id: "e1" })
    expect(entryFromPath("/cleanups")).toEqual({ kind: "cleanups" })
  })

  it("aliases a shared signup-page link /e/:slug onto the in-app event detail", () => {
    expect(entryFromPath("/e/river-cleanup-june")).toEqual({
      kind: "cleanup",
      id: "river-cleanup-june",
    })
    expect(entryFromPath("/e")).toBeNull()
  })

  it("refuses a host path with no event and an org path with no slug", () => {
    expect(entryFromPath("/orgs")).toBeNull()
    expect(entryFromPath("/me")).toBeNull()
    expect(entryFromPath("/me/anything-else")).toBeNull()
    expect(pathForEntry({ kind: "host-mode" })).toBe("/cleanups")
    expect(pathForEntry({ kind: "org" })).toBe("/")
  })

  it("keeps an unknown /cleanups/:id/<sub> on the event detail rather than 404ing the shell", () => {
    expect(entryFromPath("/cleanups/e1/nonsense")).toEqual({ kind: "cleanup", id: "e1" })
  })
})

describe("parent view + flow protection", () => {
  it("puts every event-scoped host surface under the events view", () => {
    for (const kind of ["host-mode", "host-checkin", "host-broadcast-quick", "my-ticket", "org"] as const) {
      expect(parentViewForEntry({ kind } as DetailEntry), kind).toBe("events")
    }
  })

  it("protects the quick broadcast draft - and ONLY it - among the new kinds", () => {
    expect(FLOW_KINDS.has("host-broadcast-quick")).toBe(true)
    for (const kind of ["host-mode", "host-checkin", "my-ticket", "org", "my-donations"] as const) {
      expect(FLOW_KINDS.has(kind), kind).toBe(false)
    }
  })
})
