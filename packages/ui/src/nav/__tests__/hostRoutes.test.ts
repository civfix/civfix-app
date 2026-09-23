import { describe, expect, it } from "vitest"
import { entryFromPath, isRootLink, pathForEntry, parentViewForEntry, titleForEntry } from "../routes"
import { ALL_DETAIL_KINDS, type DetailEntry } from "../types"
import { FLOW_KINDS } from "../flowKinds"
import { DETAIL_BODY } from "../../shell/bodyRoutes"
import { BODY_LAYOUT } from "../../shell/bodyLayout"

const HOST_KINDS = [
  "host-mode",
  "host-checkin",
  "host-announce",
  "host-team",
  "host-log-hours",
  "my-ticket",
  "org",
  "event-dashboard",
  "announcement",
  "announcements",
  "event-analytics",
  "host-analytics",
  "org-manage",
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
    ["/cleanups/e1/announce", { kind: "host-announce", id: "e1" }],
    ["/cleanups/e1/team", { kind: "host-team", id: "e1" }],
    ["/cleanups/e1/hours", { kind: "host-log-hours", id: "e1" }],
    ["/cleanups/e1/ticket", { kind: "my-ticket", id: "e1" }],
    ["/cleanups/e1/ticket/seat-9", { kind: "my-ticket", id: "e1", seatId: "seat-9" }],
    ["/cleanups/e1/analytics", { kind: "event-analytics", id: "e1" }],
    ["/host/analytics", { kind: "host-analytics" }],
    ["/cleanups/e1/announcements", { kind: "announcements", id: "e1" }],
    [
      "/cleanups/e1/announcements/a-9",
      { kind: "announcement", id: "e1", announcementId: "a-9" },
    ],
    ["/orgs/river-keepers", { kind: "org", slug: "river-keepers" }],
    ["/orgs/river-keepers/manage", { kind: "org-manage", slug: "river-keepers" }],
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
    expect(pathForEntry({ kind: "host-team" })).toBe("/cleanups")
    expect(pathForEntry({ kind: "host-log-hours" })).toBe("/cleanups")
    expect(pathForEntry({ kind: "org" })).toBe("/")
    expect(pathForEntry({ kind: "org-manage" })).toBe("/")
  })

  it("keeps an unknown /cleanups/:id/<sub> on the event detail rather than 404ing the shell", () => {
    expect(entryFromPath("/cleanups/e1/nonsense")).toEqual({ kind: "cleanup", id: "e1" })
  })

  it("keeps /host on the host-an-event form and takes only /host/analytics elsewhere", () => {
    expect(entryFromPath("/host")).toEqual({ kind: "create-cleanup" })
    expect(entryFromPath("/host/nonsense")).toEqual({ kind: "create-cleanup" })
  })

  it("addresses the all-events page with no id at all, unlike the per-event one", () => {
    expect(pathForEntry({ kind: "host-analytics" })).toBe("/host/analytics")
    expect(pathForEntry({ kind: "host-analytics", id: "e1" })).toBe("/host/analytics")
  })
})

describe("parent view + flow protection", () => {
  it("puts every event-scoped host surface under the events view", () => {
    for (const kind of [
      "host-mode",
      "host-checkin",
      "host-announce",
      "host-team",
      "host-log-hours",
      "my-ticket",
      "org",
      "event-dashboard",
      "announcement",
      "announcements",
      "event-analytics",
      "host-analytics",
      "org-manage",
    ] as const) {
      expect(parentViewForEntry({ kind } as DetailEntry), kind).toBe("events")
    }
  })

  it("protects the announcement draft - and ONLY it - among the new kinds", () => {
    expect(FLOW_KINDS.has("host-announce")).toBe(true)
    for (const kind of [
      "host-mode",
      "host-checkin",
      "host-team",
      "host-log-hours",
      "my-ticket",
      "org",
      "event-dashboard",
      "announcement",
      "announcements",
      "event-analytics",
      "host-analytics",
      "org-manage",
    ] as const) {
      expect(FLOW_KINDS.has(kind), kind).toBe(false)
    }
  })
})

describe("the home-feed link a team invite notification carries", () => {
  it("has no addressable detail entry, which is why the tap needs its own verb", () => {
    expect(entryFromPath("/")).toBeNull()
  })

  it("recognises the bare root link, which is the only shape the server emits", () => {
    expect(isRootLink("/")).toBe(true)
  })

  it("recognises nothing else as the root, so no other link silently opens home", () => {
    for (const path of [
      "",
      "//",
      "//evil.example",
      "/?from=push",
      "/?next=%2Fsettings",
      "/#top",
      "/?from=push#top",
      " /",
      "/cleanups/e1",
      "/notifications",
      null,
      undefined,
    ]) {
      expect(isRootLink(path), String(path)).toBe(false)
    }
  })
})
