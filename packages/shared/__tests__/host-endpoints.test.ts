import { describe, it, expect } from "vitest"
import { endpoints, hostEndpoints, hostAdminEndpoints } from "../src/client/endpoints.js"
import { extractParams, fillPath } from "../src/client/client.js"


const UUID = "123e4567-e89b-12d3-a456-426614174000"

const NEW_NAMES = [
  ...Object.keys(hostEndpoints),
  ...Object.keys(hostAdminEndpoints),
] as Array<keyof typeof endpoints>

const CSRF_FREE_MUTATIONS = new Set([
  "unsubscribeBroadcasts",
  "getGuestEventTicket",
  "recordEventPageView",
])

describe("host platform endpoint registry", () => {
  it("adds 110 endpoints, of which 21 are admin", () => {
    expect(NEW_NAMES).toHaveLength(110)
    expect(Object.keys(hostEndpoints)).toHaveLength(89)
    expect(Object.keys(hostAdminEndpoints)).toHaveLength(21)
    for (const name of Object.keys(hostAdminEndpoints)) {
      expect(endpoints[name as keyof typeof endpoints].path.startsWith("/admin"), name).toBe(true)
    }
  })

  it("exposes every sub-registry entry through the composed registry, unchanged", () => {
    for (const name of NEW_NAMES) {
      const e = endpoints[name]
      expect(e, name).toBeDefined()
      expect(e.version, name).toBe("v1")
      expect(["public", "optional", "required"]).toContain(e.auth)
    }
  })

  it("guards every new mutation with csrf except the four annotated public flows", () => {
    for (const name of NEW_NAMES) {
      const e = endpoints[name]
      if (e.method === "GET") {
        expect(e.csrf, name).toBe(false)
        continue
      }
      expect(e.csrf, name).toBe(!CSRF_FREE_MUTATIONS.has(name as string))
    }
  })

  it("keeps the csrf-free mutations public or optional-auth, never session-required", () => {
    for (const name of CSRF_FREE_MUTATIONS) {
      const e = endpoints[name as keyof typeof endpoints]
      expect(e.csrf, name).toBe(false)
      expect(["public", "optional"], name).toContain(e.auth)
    }
  })

  it("routes organizations by uuid except the public slug reads", () => {
    expect(endpoints.getOrganization.path).toBe("/orgs/by-slug/:slug")
    expect(endpoints.getOrganization.auth).toBe("optional")
    for (const name of Object.keys(endpoints)) {
      const e = endpoints[name as keyof typeof endpoints]
      if (!e.path.startsWith("/orgs/")) continue
      if (e.path.startsWith("/orgs/by-slug/")) continue
      expect(e.path, name).toMatch(/^\/orgs\/:id(\/|$)/)
    }
  })

  it("pins /ticket-types/order as a STATIC sibling of /ticket-types/:ticketTypeId", () => {
    expect(endpoints.reorderEventTicketTypes.path).toBe("/cleanups/:id/ticket-types/order")
    expect(endpoints.reorderEventTicketTypes.method).toBe("PUT")
    expect(endpoints.updateEventTicketType.path).toBe("/cleanups/:id/ticket-types/:ticketTypeId")
    expect(endpoints.reorderEventTicketTypes.path).not.toContain(":ticketTypeId")
    expect(endpoints.reorderEventTicketTypes.path.endsWith("/order")).toBe(true)
  })

  it("pins /registrations/walkup as a STATIC sibling of /registrations/:registrationId", () => {
    expect(endpoints.createWalkupRegistration.path).toBe("/cleanups/:id/registrations/walkup")
    expect(endpoints.createWalkupRegistration.method).toBe("POST")
    expect(endpoints.getEventRegistration.path).toBe(
      "/cleanups/:id/registrations/:registrationId",
    )
    expect(endpoints.cancelEventRegistration.path).toBe(
      "/cleanups/:id/registrations/:registrationId/cancel",
    )
    expect(endpoints.createWalkupRegistration.path).not.toContain(":registrationId")
  })

  it("pins /waitlist/claim and /checkins/{scan,no-show,counters} as static siblings", () => {
    expect(endpoints.claimWaitlistOffer.path).toBe("/cleanups/:id/waitlist/claim")
    expect(endpoints.promoteFromWaitlist.path).toBe("/cleanups/:id/waitlist/:waitlistId/promote")
    expect(endpoints.scanEventTicket.path).toBe("/cleanups/:id/checkins/scan")
    expect(endpoints.markEventNoShows.path).toBe("/cleanups/:id/checkins/no-show")
    expect(endpoints.getEventCheckinCounters.path).toBe("/cleanups/:id/checkins/counters")
    expect(endpoints.undoEventCheckIn.path).toBe("/cleanups/:id/checkins/:seatId")
    expect(endpoints.undoEventCheckIn.method).toBe("DELETE")
    for (const p of [
      endpoints.claimWaitlistOffer.path,
      endpoints.scanEventTicket.path,
      endpoints.markEventNoShows.path,
      endpoints.getEventCheckinCounters.path,
    ]) {
      expect(p.split("/").slice(4).join("/")).not.toMatch(/^:/)
    }
  })

  it("gives the unsubscribe twins the key each one actually reads", () => {
    const shapeOf = (schema: unknown): string[] =>
      Object.keys((schema as { shape: Record<string, unknown> }).shape).sort()
    expect(endpoints.unsubscribeBroadcasts.method).toBe("POST")
    expect(endpoints.openUnsubscribeBroadcasts.method).toBe("GET")
    expect(endpoints.unsubscribeBroadcasts.path).toBe(endpoints.openUnsubscribeBroadcasts.path)
    expect(shapeOf(endpoints.unsubscribeBroadcasts.request)).toEqual(["token"])
    expect(shapeOf(endpoints.openUnsubscribeBroadcasts.request)).toEqual(["t"])
    expect(shapeOf(endpoints.openUnsubscribeBroadcasts.response)).toEqual([])
  })

  it("keeps broadcast preview off the /broadcasts/:broadcastId tree", () => {
    expect(endpoints.previewEventBroadcast.path).toBe("/cleanups/:id/broadcast-preview")
    expect(endpoints.setEventBroadcastMute.path).toBe("/cleanups/:id/broadcast-mute")
    expect(endpoints.getEventBroadcast.path).toBe("/cleanups/:id/broadcasts/:broadcastId")
    expect(endpoints.previewEventBroadcast.path).not.toContain("/broadcasts/")
  })

  it("keeps the host export download on its own /me path", () => {
    expect(endpoints.downloadHostExport.path).toBe("/me/host-exports/:id/download")
  })

  it("reads page CONTENT through the admin plane, not the public page route", () => {
    expect(endpoints.adminGetEventPage.path).toBe("/admin/pages/:id")
    expect(endpoints.adminGetEventPage.method).toBe("GET")
    expect(endpoints.adminFlagEventPage.path).toBe("/admin/pages/:id/flag")
    expect(endpoints.adminUnpublishEventPage.path).toBe("/admin/pages/:id/unpublish")
  })

  it("gives the admin plane its own media and legal reads under /admin", () => {
    for (const name of ["adminGetMedia", "adminGetLegalVersions"] as const) {
      expect(endpoints[name].path.startsWith("/admin"), name).toBe(true)
      expect(endpoints[name].auth, name).toBe("required")
    }
    expect(endpoints.adminGetMedia.path).toBe("/admin/media/:id")
    expect(endpoints.adminGetLegalVersions.path).toBe("/admin/legal/versions")
  })

  it("pins /admin/orgs/verifications as a STATIC sibling of /admin/orgs/:id", () => {
    expect(endpoints.adminListOrgVerifications.path).toBe("/admin/orgs/verifications")
    expect(endpoints.adminGetOrg.path).toBe("/admin/orgs/:id")
    expect(endpoints.adminListOrgVerifications.path).not.toContain(":")
  })

  it("gives the admin plane its own org writes under /admin/orgs (DECISIONS §32)", () => {
    expect(endpoints.adminListOrgs.path).toBe("/admin/orgs")
    expect(endpoints.adminListOrgs.method).toBe("GET")
    expect(endpoints.adminCreateOrg.path).toBe("/admin/orgs")
    expect(endpoints.adminCreateOrg.method).toBe("POST")
    expect(endpoints.adminUpdateOrg.path).toBe("/admin/orgs/:id")
    expect(endpoints.adminUpdateOrg.method).toBe("PATCH")
    expect(endpoints.adminSetOrgSuspended.path).toBe("/admin/orgs/:id/suspend")
    expect(endpoints.adminListOrgMembers.path).toBe("/admin/orgs/:id/members")
    expect(endpoints.adminAddOrgMember.path).toBe("/admin/orgs/:id/members")
    expect(endpoints.adminSetOrgMemberRole.path).toBe("/admin/orgs/:id/members/:userId")
    expect(endpoints.adminRemoveOrgMember.path).toBe("/admin/orgs/:id/members/:userId")
    expect(endpoints.adminRemoveOrgMember.method).toBe("DELETE")
    expect(endpoints.adminListOrgEvents.path).toBe("/admin/orgs/:id/events")
    for (const name of [
      "adminCreateOrg",
      "adminUpdateOrg",
      "adminSetOrgSuspended",
      "adminAddOrgMember",
      "adminSetOrgMemberRole",
      "adminRemoveOrgMember",
    ] as const) {
      expect(endpoints[name].csrf, name).toBe(true)
      expect(endpoints[name].auth, name).toBe("required")
    }
  })

  it("keeps the org-invite accept OFF /orgs/ so the uuid-only rule above holds", () => {
    expect(endpoints.listOrganizationInvites.path).toBe("/orgs/:id/invites")
    expect(endpoints.revokeOrganizationInvite.path).toBe("/orgs/:id/invites/:inviteId")
    expect(endpoints.revokeOrganizationInvite.method).toBe("DELETE")
    expect(endpoints.acceptOrganizationInvite.path).toBe("/org-invites/accept")
    expect(endpoints.acceptOrganizationInvite.path).not.toMatch(/:[A-Za-z0-9_]+/)
    expect(endpoints.acceptOrganizationInvite.auth).toBe("required")
    expect(endpoints.acceptOrganizationInvite.csrf).toBe(true)
  })

  it("keeps /me/hosted-events and /me/hosted-events/analytics fully static", () => {
    expect(endpoints.listMyHostedEvents.path).toBe("/me/hosted-events")
    expect(endpoints.hostedEventsAnalytics.path).toBe("/me/hosted-events/analytics")
    expect(endpoints.listMyHostedEvents.path).not.toMatch(/:[A-Za-z0-9_]+/)
    expect(endpoints.hostedEventsAnalytics.path).not.toMatch(/:[A-Za-z0-9_]+/)
  })

  it("seats the invitee inbox under /me, token-free, with the id in the path (DECISIONS §33)", () => {
    expect(endpoints.listMyEventInvites.method).toBe("GET")
    expect(endpoints.listMyEventInvites.path).toBe("/me/event-invites")
    expect(endpoints.listMyEventInvites.path).not.toMatch(/:[A-Za-z0-9_]+/)
    expect(endpoints.listMyEventInvites.auth).toBe("required")
    expect(endpoints.listMyEventInvites.csrf).toBe(false)
    for (const name of ["acceptMyEventInvite", "declineMyEventInvite"] as const) {
      const e = endpoints[name]
      expect(e.method, name).toBe("POST")
      expect(e.auth, name).toBe("required")
      expect(e.csrf, name).toBe(true)
      const { params, consumedKeys } = extractParams(e.path, { inviteId: UUID })
      expect(params, name).toEqual({ inviteId: UUID })
      expect(consumedKeys.has("inviteId"), name).toBe(true)
      expect(fillPath(e.path, params), name).toBe(`/me/event-invites/${UUID}/${name === "acceptMyEventInvite" ? "accept" : "decline"}`)
    }
    expect(endpoints.acceptEventTeamInvite.path).toBe("/cleanups/:id/team/invites/accept")
    expect(endpoints.acceptMyEventInvite.path.startsWith("/cleanups/")).toBe(false)
  })

  it("serves the five per-event analytics panels off one request schema", () => {
    const names = [
      "eventAnalyticsOverview",
      "eventAnalyticsRegistrations",
      "eventAnalyticsCheckins",
      "eventAnalyticsBroadcasts",
      "eventAnalyticsSources",
    ] as const
    const paths = names.map((n) => endpoints[n].path)
    expect(new Set(paths).size).toBe(5)
    for (const n of names) {
      expect(endpoints[n].method, n).toBe("GET")
      expect(endpoints[n].auth, n).toBe("required")
      expect(endpoints[n].request, n).toBe(endpoints.eventAnalyticsOverview.request)
      expect(endpoints[n].path, n).toMatch(/^\/cleanups\/:id\/analytics\//)
    }
  })

  it("seats the per-event insights read beside the analytics panels, not under them", () => {
    const e = endpoints.getEventInsights
    expect(e.method).toBe("GET")
    expect(e.path).toBe("/cleanups/:id/insights")
    expect(e.path).not.toMatch(/^\/cleanups\/:id\/analytics\//)
    expect(e.auth).toBe("required")
    expect(e.csrf).toBe(false)
    expect(e.version).toBe("v1")
    expect(e.request).not.toBe(endpoints.eventAnalyticsOverview.request)
    const { params, consumedKeys } = extractParams(e.path, { id: UUID })
    expect(params).toEqual({ id: UUID })
    expect(consumedKeys.has("id")).toBe(true)
    expect(fillPath(e.path, params)).toBe(`/cleanups/${UUID}/insights`)
  })

  it("records a page view as a POST, never a GET side effect", () => {
    expect(endpoints.recordEventPageView.method).toBe("POST")
    expect(endpoints.recordEventPageView.path).toBe("/pages/:slug/view")
    expect(endpoints.getPublicEventPage.method).toBe("GET")
    expect(endpoints.getPublicEventPage.path).toBe("/pages/:slug")
  })

  it("does not register a donation-click endpoint (clicks are a metric, not a route)", () => {
    expect((endpoints as Record<string, unknown>)["recordEventDonationClick"]).toBeUndefined()
    for (const name of Object.keys(endpoints)) {
      expect(endpoints[name as keyof typeof endpoints].path, name).not.toContain("donation-click")
    }
  })

  it("fills :slug, :registrationId, :ticketTypeId and friends from the typed input", () => {
    const cases: Array<[keyof typeof endpoints, Record<string, string>, string]> = [
      ["getOrganization", { slug: "reach-out-la" }, "/orgs/by-slug/reach-out-la"],
      ["getPublicEventPage", { slug: "beach-sweep" }, "/pages/beach-sweep"],
      [
        "getEventRegistration",
        { id: UUID, registrationId: UUID },
        `/cleanups/${UUID}/registrations/${UUID}`,
      ],
      [
        "updateEventTicketType",
        { id: UUID, ticketTypeId: UUID },
        `/cleanups/${UUID}/ticket-types/${UUID}`,
      ],
      [
        "listBroadcastDeliveries",
        { id: UUID, broadcastId: UUID },
        `/cleanups/${UUID}/broadcasts/${UUID}/deliveries`,
      ],
      ["getEventExport", { id: UUID, exportId: UUID }, `/cleanups/${UUID}/exports/${UUID}`],
      ["undoEventCheckIn", { id: UUID, seatId: UUID }, `/cleanups/${UUID}/checkins/${UUID}`],
      [
        "promoteFromWaitlist",
        { id: UUID, waitlistId: UUID },
        `/cleanups/${UUID}/waitlist/${UUID}/promote`,
      ],
      [
        "revokeEventTeamInvite",
        { id: UUID, inviteId: UUID },
        `/cleanups/${UUID}/team/invites/${UUID}`,
      ],
      ["downloadHostExport", { id: UUID }, `/me/host-exports/${UUID}/download`],
    ]
    for (const [name, input, expected] of cases) {
      const e = endpoints[name]
      const { params } = extractParams(e.path, input)
      expect(fillPath(e.path, params), name as string).toBe(expected)
    }
  })

  it("cannot fill a :param from a differently-named key (the *Id fallback is :id-only)", () => {
    const { params } = extractParams(endpoints.getEventRegistration.path, {
      id: UUID,
      regId: UUID,
    })
    expect(params).toEqual({ id: UUID })
    expect(() => fillPath(endpoints.getEventRegistration.path, params)).toThrow()
  })
})
