import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { INVITE_MAX_ROWS, inviteRowSlice } from "../profile/invitesModel"
import { surfaceSource } from "../../__tests__/sourceGuards"

const source = (file: string): string => readFileSync(new URL(file, import.meta.url), "utf8")

const catalog = (lng: string, ns: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(new URL(`../../i18n/locales/${lng}/${ns}.json`, import.meta.url), "utf8"),
  ) as Record<string, unknown>

const ev = (id: string): { id: string } => ({ id })

describe("the invitation rows a card is allowed to show", () => {
  it("caps the list at three, event invitations first", () => {
    expect(INVITE_MAX_ROWS).toBe(3)
    const slice = inviteRowSlice([ev("a"), ev("b")], [ev("o1"), ev("o2"), ev("o3")])
    expect(slice.events.map((row) => row.id)).toEqual(["a", "b"])
    expect(slice.orgs.map((row) => row.id)).toEqual(["o1"])
    expect(slice.events.length + slice.orgs.length).toBe(INVITE_MAX_ROWS)
  })

  it("counts every pending invitation, not just the ones that fit", () => {
    expect(inviteRowSlice([ev("a"), ev("b"), ev("c"), ev("d")], [ev("o1")]).total).toBe(5)
  })

  it("leaves the org list alone when the events already fill the card", () => {
    const slice = inviteRowSlice([ev("a"), ev("b"), ev("c"), ev("d")], [ev("o1")])
    expect(slice.events.map((row) => row.id)).toEqual(["a", "b", "c"])
    expect(slice.orgs).toEqual([])
  })

  it("reports nothing to show when both sides are empty", () => {
    const slice = inviteRowSlice([], [])
    expect(slice.total).toBe(0)
    expect(slice.events).toEqual([])
    expect(slice.orgs).toEqual([])
  })
})

describe("invitations live on the viewer's own profile", () => {
  it("mounts the section in the profile's dashboard slot, above the dashboard row", () => {
    const body = source("../ProfileBody.tsx")
    expect(body).toContain('import { InvitationsSection } from "./profile/InvitationsSection"')
    expect(body).toContain("<InvitationsSection />")
    expect(body.indexOf("<InvitationsSection />")).toBeLessThan(body.indexOf("<DashboardRow"))
    expect(body).toContain("dashboardSlot={")
  })

  it("keeps it off other people's profiles", () => {
    expect(surfaceSource("personDetail")).not.toContain("Invitation")
    expect(source("../ProfileView.tsx")).not.toContain("Invitation")
  })

  it("owns the queries and the accept/decline wiring in one container", () => {
    const section = source("../profile/InvitationsSection.tsx")
    expect(section).toContain("useMyEventInvites()")
    expect(section).toContain("useMyOrgInvites()")
    expect(section).toContain("useAcceptMyEventInvite()")
    expect(section).toContain("useDeclineMyEventInvite()")
    expect(section).toContain("useAcceptMyOrgInvite()")
    expect(section).toContain("useDeclineMyOrgInvite()")
    expect(section).toContain("cleanupMemberRole.")
    expect(section).toContain("organizationMemberRole.")
    expect(section).toContain("<InvitationsCard")
  })

  it("renders nothing at all until there is something to answer", () => {
    const card = source("../profile/InvitationsCard.tsx")
    expect(card).toContain("if (slice.total === 0) return null")
    expect(card).toContain("inviteRowSlice(eventInvites, orgInvites)")
  })

  it("keeps the accept secondary and the decline a plain link", () => {
    const rows = source("../profile/InviteRows.tsx")
    expect(rows).not.toContain("PrimaryButton")
    expect(rows).toContain("<SecondaryButton")
    expect(rows).toContain("<TextLink")
    expect(rows.match(/footer=\{/g) ?? [], "both invite rows act below their text").toHaveLength(2)
    expect(rows, "the trailing slot no longer squeezes the text column").not.toContain("trailing={")
    expect(rows.match(/titleLines=\{2\}/g) ?? []).toHaveLength(2)
  })

  it("leaves no raw hex or bloom fill behind in the moved files", () => {
    for (const file of [
      "../profile/InvitationsCard.tsx",
      "../profile/InviteRows.tsx",
      "../profile/InvitationsSection.tsx",
    ]) {
      expect(source(file)).not.toContain("brand.bloom")
      expect(source(file)).not.toContain('"#')
    }
  })

  it("is gone from the event dashboard entirely", () => {
    const dashboard = [
      "../host/EventDashboardBody.tsx",
      "../host/dashboard/DashboardHeader.tsx",
      "../host/dashboard/HostedEventsSection.tsx",
      "../host/dashboard/useHostedEventNav.ts",
    ]
      .map(source)
      .join("\n")
    expect(dashboard).not.toContain("Invitation")
    expect(dashboard).not.toContain("Invite")
    expect(dashboard).not.toContain("invite")
    expect(
      existsSync(new URL("../host/dashboard/InvitationsCard.tsx", import.meta.url)),
    ).toBe(false)
    expect(existsSync(new URL("../host/dashboard/InviteRows.tsx", import.meta.url))).toBe(false)
  })

  it("names every invitation string in the profile namespace, in all four locales", () => {
    const keys = [
      "section",
      "invited_by_unknown",
      "event_invited_as",
      "org_invited_as",
      "accept",
      "decline",
      "accept_a11y",
      "decline_a11y",
      "error",
      "error_title",
      "error_body",
      "retry",
    ]
    for (const lng of ["en", "es", "de", "ko"]) {
      const profile = catalog(lng, "profile") as Record<string, Record<string, string>>
      for (const key of keys) {
        expect(profile.invites?.[key], `${lng} invites.${key}`).toBeTruthy()
      }
      const dashboard = catalog(lng, "event-dashboard") as Record<string, unknown>
      expect(dashboard.invites, `${lng} event-dashboard.invites`).toBeUndefined()
    }
  })
})
