import { describe, expect, it } from "vitest"

import {
  EVENT_SECTIONS,
  ORG_MANAGE_SECTIONS,
  ORG_SECTIONS,
  eventIdForRoute,
  hrefForRoute,
  inviteTokenForPath,
  inviteTokenQuery,
  isOrgInviteAcceptPath,
  parseConsoleRoute,
  railSectionForRoute,
} from "./route"
import type { ConsoleRoute } from "./route"

describe("parseConsoleRoute", () => {
  it("treats the export placeholder as the portfolio", () => {
    expect(parseConsoleRoute("/manage/_/")).toEqual({ kind: "portfolio" })
    expect(parseConsoleRoute("/manage/")).toEqual({ kind: "portfolio" })
    expect(parseConsoleRoute("/manage")).toEqual({ kind: "portfolio" })
  })

  it("parses every event section", () => {
    for (const section of EVENT_SECTIONS) {
      const path = `/manage/events/e1/${section}/`
      const route = parseConsoleRoute(path)
      if (section === "broadcasts") {
        expect(route).toEqual({ kind: "broadcasts", eventId: "e1" })
      } else {
        expect(route).toEqual({ kind: "event", eventId: "e1", section })
      }
    }
  })

  it("defaults an event with no section to the overview", () => {
    expect(parseConsoleRoute("/manage/events/e1/")).toEqual({
      kind: "event",
      eventId: "e1",
      section: "overview",
    })
  })

  it("separates the broadcast new/detail routes from the list", () => {
    expect(parseConsoleRoute("/manage/events/e1/broadcasts/new/")).toEqual({
      kind: "broadcast-new",
      eventId: "e1",
    })
    expect(parseConsoleRoute("/manage/events/e1/broadcasts/b7/")).toEqual({
      kind: "broadcast",
      eventId: "e1",
      broadcastId: "b7",
    })
  })

  it("parses org routes and their sections", () => {
    expect(parseConsoleRoute("/manage/orgs/o1/")).toEqual({
      kind: "org",
      orgId: "o1",
      section: "overview",
    })
    expect(parseConsoleRoute("/manage/orgs/o1/payments/")).toEqual({
      kind: "org",
      orgId: "o1",
      section: "payments",
    })
  })

  it("parses every org section", () => {
    for (const section of ORG_SECTIONS) {
      expect(parseConsoleRoute(`/manage/orgs/o1/${section}/`)).toEqual({
        kind: "org",
        orgId: "o1",
        section,
      })
    }
  })

  it("keeps the manage-only sections inside the section list", () => {
    for (const section of ORG_MANAGE_SECTIONS) expect(ORG_SECTIONS).toContain(section)
    expect(ORG_MANAGE_SECTIONS).not.toContain("overview")
    expect(ORG_MANAGE_SECTIONS).not.toContain("members")
  })

  it("treats /manage/orgs/new as the create screen, never as an org id", () => {
    expect(parseConsoleRoute("/manage/orgs/new/")).toEqual({ kind: "org-new" })
    expect(parseConsoleRoute("/manage/orgs/new")).toEqual({ kind: "org-new" })
    expect(parseConsoleRoute("/manage/orgs/new/members/").kind).toBe("not-found")
    expect(hrefForRoute({ kind: "org-new" })).toBe("/manage/orgs/new/")
  })

  it("parses the org invite accept landing and its token from the fragment or the query", () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123"
    // The emailed link: no trailing slash, token in the fragment (never sent to a server).
    expect(parseConsoleRoute("/manage/org-invites/accept", `#token=${token}`)).toEqual({
      kind: "org-invite-accept",
      token,
    })
    expect(parseConsoleRoute("/manage/org-invites/accept/", `?token=${token}`)).toEqual({
      kind: "org-invite-accept",
      token,
    })
    // search + hash together, as the browser exposes them; the fragment wins.
    expect(parseConsoleRoute("/manage/org-invites/accept/", `?token=query#token=${token}`)).toEqual(
      { kind: "org-invite-accept", token },
    )
    // The pathname may carry the query or fragment itself (hrefForRoute output, a pasted link).
    expect(parseConsoleRoute(`/manage/org-invites/accept/?token=${token}`)).toEqual({
      kind: "org-invite-accept",
      token,
    })
    expect(parseConsoleRoute(`/manage/org-invites/accept#token=${token}`)).toEqual({
      kind: "org-invite-accept",
      token,
    })
    expect(parseConsoleRoute("/manage/org-invites/accept")).toEqual({
      kind: "org-invite-accept",
      token: null,
    })
    expect(parseConsoleRoute("/manage/org-invites/accept/", "?token=%20%20")).toEqual({
      kind: "org-invite-accept",
      token: null,
    })
    expect(parseConsoleRoute("/manage/org-invites/accept/", "?tab=welcome#top")).toEqual({
      kind: "org-invite-accept",
      token: null,
    })
    expect(hrefForRoute({ kind: "org-invite-accept", token })).toBe(
      `/manage/org-invites/accept/#token=${token}`,
    )
    expect(hrefForRoute({ kind: "org-invite-accept", token: "a b&c#d" })).toBe(
      "/manage/org-invites/accept/#token=a%20b%26c%23d",
    )
    expect(hrefForRoute({ kind: "org-invite-accept", token: null })).toBe(
      "/manage/org-invites/accept/",
    )
    expect(eventIdForRoute({ kind: "org-invite-accept", token })).toBeNull()
    expect(railSectionForRoute({ kind: "org-invite-accept", token })).toBeNull()
  })

  it("only reads the invite token on the accept path, and round-trips it through inviteTokenQuery", () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123"
    expect(isOrgInviteAcceptPath("/manage/org-invites/accept/")).toBe(true)
    expect(isOrgInviteAcceptPath("/manage/org-invites/accept")).toBe(true)
    expect(isOrgInviteAcceptPath("/manage/org-invites/")).toBe(false)
    expect(isOrgInviteAcceptPath("/manage/orgs/o1/")).toBe(false)
    expect(inviteTokenForPath("/manage/org-invites/accept/", `#token=${token}`)).toBe(token)
    expect(inviteTokenForPath("/manage/org-invites/accept/", "?tab=welcome")).toBeNull()
    // The same fragment on any other route is noise, not a token.
    expect(inviteTokenForPath("/manage/orgs/o1/", `#token=${token}`)).toBeNull()
    expect(inviteTokenQuery(null)).toBe("")
    expect(parseConsoleRoute("/manage/org-invites/accept/", inviteTokenQuery("a b&c#d"))).toEqual({
      kind: "org-invite-accept",
      token: "a b&c#d",
    })
  })

  it("rejects unknown sections and depths rather than guessing", () => {
    for (const path of [
      "/manage/events/e1/nope/",
      "/manage/events/e1/attendees/extra/",
      "/manage/orgs/o1/nope/",
      "/manage/orgs/o1/members/extra/",
      "/manage/orgs/",
      "/manage/nope/",
      "/manage/events/",
      "/manage/events/../secret/",
      "/manage/org-invites/",
      "/manage/org-invites/decline/",
      "/manage/org-invites/accept/extra/",
    ]) {
      expect(parseConsoleRoute(path).kind, path).toBe("not-found")
    }
  })

  it("round-trips through hrefForRoute", () => {
    const routes: ConsoleRoute[] = [
      { kind: "portfolio" },
      { kind: "org-new" },
      { kind: "org", orgId: "o1", section: "overview" },
      { kind: "org", orgId: "o1", section: "payments" },
      ...ORG_SECTIONS.map((section): ConsoleRoute => ({ kind: "org", orgId: "o2", section })),
      { kind: "org-invite-accept", token: null },
      { kind: "org-invite-accept", token: "abcdefghijklmnopqrstuvwxyz0123" },
      { kind: "event", eventId: "e1", section: "overview" },
      { kind: "event", eventId: "e1", section: "attendees" },
      { kind: "broadcasts", eventId: "e1" },
      { kind: "broadcast-new", eventId: "e1" },
      { kind: "broadcast", eventId: "e1", broadcastId: "b1" },
    ]
    for (const route of routes) {
      expect(parseConsoleRoute(hrefForRoute(route)), hrefForRoute(route)).toEqual(route)
    }
  })

  it("scopes the event id and lights the right rail entry", () => {
    expect(eventIdForRoute({ kind: "broadcast", eventId: "e1", broadcastId: "b1" })).toBe("e1")
    expect(eventIdForRoute({ kind: "portfolio" })).toBeNull()
    expect(railSectionForRoute({ kind: "broadcast-new", eventId: "e1" })).toBe("broadcasts")
    expect(railSectionForRoute({ kind: "org", orgId: "o1", section: "overview" })).toBeNull()
  })
})
