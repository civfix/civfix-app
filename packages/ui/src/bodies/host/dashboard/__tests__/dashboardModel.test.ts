import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type {
  HostedEventDTO,
  HostedEventsAnalyticsResponse,
  OrganizationDTO,
  OrganizationInviteDTO,
  OrganizationMemberDTO,
} from "@civfix/shared"
import { MAX_ORG_INVITES_PER_ORG } from "@civfix/shared"
import { can } from "@civfix/shared/host"
import {
  canManageOrgTeam,
  canSetOrgMemberRole,
  collaboratorErrorKey,
  dashboardScope,
  duplicateErrorKey,
  duplicateReady,
  firstEventState,
  hostedEventActions,
  hostedEventCan,
  hostedEventHasActions,
  hostedEventPhase,
  hostedEventStatus,
  impactModel,
  nextDuplicateStart,
  nextUpEvent,
  orderedOrgMembers,
  orgInviteErrorKey,
  orgInviteIdentifierErrorKey,
  orgInviteQuotaReached,
  orgMemberActions,
  orgMemberHasActions,
  pastRowMeta,
  pendingOrgInvites,
  portfolioKpis,
  sharePathFor,
} from "../dashboardModel"

const DAY_MS = 86_400_000

const source = (file: string): string =>
  readFileSync(new URL(file, import.meta.url), "utf8")

const DASHBOARD_PAGE_FILES = [
  "../../EventDashboardBody.tsx",
  "../DashboardHeader.tsx",
  "../HostedEventsSection.tsx",
  "../useHostedEventNav.ts",
]

const dashboardNavSource = (): string => source("../useHostedEventNav.ts")

const catalog = (lng: string, ns: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../../../../i18n/locales/${lng}/${ns}.json`, import.meta.url), "utf8"))

function org(id: string, over: Partial<OrganizationDTO> = {}): OrganizationDTO {
  return {
    id,
    slug: id,
    name: id.toUpperCase(),
    verifiedStatus: "unverified",
    createdAt: "2026-01-01T00:00:00.000Z",
    myRole: "member",
    ...over,
  } as OrganizationDTO
}

function hosted(over: Partial<HostedEventDTO> = {}): HostedEventDTO {
  return {
    id: "e1",
    title: "Cleanup",
    startsAt: "2026-09-20T17:00:00.000Z",
    endsAt: "2026-09-20T21:00:00.000Z",
    status: "upcoming",
    visibility: "public",
    registeredCount: 4,
    checkedInCount: 0,
    waitlistCount: 0,
    myCapabilities: [],
    myRole: null,
    ...over,
  } as HostedEventDTO
}

function member(
  id: string,
  role: OrganizationMemberDTO["role"],
  over: Partial<OrganizationMemberDTO> = {},
): OrganizationMemberDTO {
  return {
    person: { id, name: id, handle: id, deleted: false },
    role,
    joinedAt: "2026-01-01T00:00:00.000Z",
    canRemove: true,
    ...over,
  } as OrganizationMemberDTO
}

function invite(id: string, over: Partial<OrganizationInviteDTO> = {}): OrganizationInviteDTO {
  return {
    id,
    organizationId: "o1",
    email: null,
    user: null,
    role: "member",
    status: "pending",
    invitedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-02-01T00:00:00.000Z",
    ...over,
  } as OrganizationInviteDTO
}

describe("dashboard scope", () => {
  it("hides the selector and stays personal when the viewer is in no org", () => {
    const scope = dashboardScope([], "o1")
    expect(scope.selectorVisible).toBe(false)
    expect(scope.orgId).toBeNull()
    expect(scope.org).toBeNull()
  })

  it("shows the selector as soon as the viewer can act for one org", () => {
    const scope = dashboardScope([org("o1")], null)
    expect(scope.selectorVisible).toBe(true)
    expect(scope.orgId).toBeNull()
  })

  it("honours the remembered org", () => {
    const scope = dashboardScope([org("o1"), org("o2")], "o2")
    expect(scope.org?.id).toBe("o2")
    expect(scope.orgId).toBe("o2")
  })

  it("falls back to you when the remembered org is no longer actable", () => {
    const scope = dashboardScope([org("o1")], "vanished")
    expect(scope.orgId).toBeNull()
    expect(scope.org).toBeNull()
    expect(scope.selectorVisible).toBe(true)
  })
})

describe("event row actions", () => {
  const now = new Date("2026-09-10T12:00:00.000Z")

  it("gives an organizer every action", () => {
    const actions = hostedEventActions(hosted({ myRole: "organizer" }), now)
    expect(actions).toEqual({
      hostTools: true,
      chat: true,
      announce: true,
      duplicate: true,
      edit: true,
    })
  })

  it("gives a staff member only host tools", () => {
    const actions = hostedEventActions(hosted({ myRole: "staff" }), now)
    expect(actions).toEqual({
      hostTools: true,
      chat: true,
      announce: false,
      duplicate: false,
      edit: false,
    })
    expect(hostedEventHasActions(actions)).toBe(true)
  })

  it("prefers the server capability list over the legacy role fallback", () => {
    const event = hosted({ myRole: "organizer", myCapabilities: ["view_roster"] })
    expect(hostedEventCan(event, "manage_event")).toBe(false)
    expect(hostedEventActions(event, now)).toEqual({
      hostTools: true,
      chat: true,
      announce: false,
      duplicate: false,
      edit: false,
    })
  })

  it("gives a plain attendee the group chat and nothing else - the chat is every event's", () => {
    const actions = hostedEventActions(hosted(), now)
    expect(actions).toEqual({
      hostTools: false,
      chat: true,
      announce: false,
      duplicate: false,
      edit: false,
    })
    expect(hostedEventHasActions(actions)).toBe(true)
  })

  it("lets broadcast alone unlock the announcement action", () => {
    const actions = hostedEventActions(hosted({ myCapabilities: ["broadcast"] }), now)
    expect(actions.announce).toBe(true)
    expect(actions.duplicate).toBe(false)
  })

  it("retires Edit once the event has ended, because the server freezes it there", () => {
    const organizer = { myRole: "organizer" as const }
    const past = hosted({
      ...organizer,
      startsAt: "2026-09-08T17:00:00.000Z",
      endsAt: "2026-09-08T21:00:00.000Z",
    })
    expect(hostedEventActions(past, now).edit).toBe(false)
    expect(hostedEventActions(past, now).duplicate).toBe(true)
  })

  it("keeps Edit on an UNDERWAY event and drops it on a cancelled one", () => {
    const organizer = { myRole: "organizer" as const }
    const underway = hosted({
      ...organizer,
      startsAt: "2026-09-10T11:00:00.000Z",
      endsAt: "2026-09-10T15:00:00.000Z",
    })
    expect(hostedEventActions(underway, now).edit).toBe(true)
    const gone = hosted({ ...organizer, status: "cancelled" })
    expect(hostedEventActions(gone, now).edit).toBe(false)
    expect(hostedEventActions(gone, now).announce).toBe(false)
    expect(hostedEventActions(gone, now).chat).toBe(false)
  })
})

describe("org role gating", () => {
  it("lets owners and admins manage the team", () => {
    expect(canManageOrgTeam("owner")).toBe(true)
    expect(canManageOrgTeam("admin")).toBe(true)
    expect(canManageOrgTeam("member")).toBe(false)
    expect(canManageOrgTeam(null)).toBe(false)
  })

})

describe("collaborator actions", () => {
  it("reserves the ROLE change for the owner and leaves removal to any manager, as the console does", () => {
    expect(canSetOrgMemberRole("owner")).toBe(true)
    expect(canSetOrgMemberRole("admin")).toBe(false)
    expect(canSetOrgMemberRole("member")).toBe(false)
    expect(
      orgMemberActions({
        member: member("u1", "member"),
        viewerId: "u9",
        canManage: true,
        canSetRole: false,
        lastAdmin: false,
      }),
    ).toEqual({ roles: [], canRemove: true })
    expect(
      orgMemberActions({
        member: member("u1", "member", { canRemove: false }),
        viewerId: "u9",
        canManage: true,
        canSetRole: false,
        lastAdmin: false,
      }),
    ).toEqual({ roles: [], canRemove: false })
  })

  it("lets an org admin manage the roster without inheriting the event team", () => {
    expect(canManageOrgTeam("admin")).toBe(true)
    expect(can({ eventRole: null, orgRole: "admin" }, "manage_org_members")).toBe(true)
    expect(can({ eventRole: null, orgRole: "admin" }, "manage_team")).toBe(false)
    expect(can({ eventRole: null, orgRole: "owner" }, "manage_org_members")).toBe(true)
  })

  it("offers nothing to a member who cannot manage the team", () => {
    expect(orgMemberActions({ member: member("u1", "member"), viewerId: "u9", canManage: false, canSetRole: false, lastAdmin: false }))
      .toEqual({ roles: [], canRemove: false })
  })

  it("never offers actions on the owner or on yourself", () => {
    expect(
      orgMemberHasActions(
        orgMemberActions({ member: member("u1", "owner"), viewerId: "u9", canManage: true, canSetRole: true, lastAdmin: false }),
      ),
    ).toBe(false)
    expect(
      orgMemberHasActions(
        orgMemberActions({ member: member("u9", "admin"), viewerId: "u9", canManage: true, canSetRole: true, lastAdmin: false }),
      ),
    ).toBe(false)
  })

  it("offers the other role and removal to a manager", () => {
    expect(orgMemberActions({ member: member("u1", "member"), viewerId: "u9", canManage: true, canSetRole: true, lastAdmin: false }))
      .toEqual({ roles: ["admin"], canRemove: true })
  })

  it("honours canRemove from the server", () => {
    const actions = orgMemberActions({
      member: member("u1", "admin", { canRemove: false }),
      viewerId: "u9",
      canManage: true,
      canSetRole: true,
      lastAdmin: false,
    })
    expect(actions).toEqual({ roles: ["member"], canRemove: false })
  })

  it("pre-disables demotion and removal on the last admin seat rather than waiting for the server", () => {
    expect(
      orgMemberActions({
        member: member("u1", "admin"),
        viewerId: "u9",
        canManage: true,
        canSetRole: true,
        lastAdmin: true,
      }),
    ).toEqual({ roles: [], canRemove: false })
  })

  it("still manages plain members while the org is down to one admin", () => {
    expect(
      orgMemberActions({
        member: member("u1", "member"),
        viewerId: "u9",
        canManage: true,
        canSetRole: true,
        lastAdmin: true,
      }),
    ).toEqual({ roles: ["admin"], canRemove: true })
  })

  it("orders owners first, then admins, then members by name", () => {
    const ordered = orderedOrgMembers([
      member("zoe", "member"),
      member("amy", "member"),
      member("bo", "owner"),
      member("cy", "admin"),
    ])
    expect(ordered.map((row) => row.person.id)).toEqual(["bo", "cy", "amy", "zoe"])
  })

  it("counts only pending invites against the org quota", () => {
    const pending = Array.from({ length: MAX_ORG_INVITES_PER_ORG }, (_unused, index) =>
      invite(`i${index}`),
    )
    expect(orgInviteQuotaReached(pending)).toBe(true)
    expect(orgInviteQuotaReached([...pending.slice(1), invite("gone", { status: "revoked" })])).toBe(
      false,
    )
    expect(pendingOrgInvites([invite("a"), invite("b", { status: "declined" })])).toHaveLength(1)
  })
})

describe("duplicate scheduling", () => {
  const now = new Date("2026-09-10T12:00:00.000Z")
  const LA = "America/Los_Angeles"
  const carrier = (wall: { year: number; month: number; day: number; hours: number; minutes: number }) =>
    new Date(wall.year, wall.month - 1, wall.day, wall.hours, wall.minutes, 0, 0)

  it("keeps a future start as the default", () => {
    const seeded = nextDuplicateStart("2026-09-20T17:00:00.000Z", LA, now)
    expect(new Date(seeded.instantMs).toISOString()).toBe("2026-09-20T17:00:00.000Z")
    expect(seeded.wallClock).toEqual({ year: 2026, month: 9, day: 20, hours: 10, minutes: 0 })
  })

  it("rolls a past start forward in whole weeks so the weekday and the EVENT-zone clock survive", () => {
    const seeded = nextDuplicateStart("2026-08-20T17:00:00.000Z", LA, now)
    expect(seeded.instantMs).toBeGreaterThan(now.getTime())
    expect(seeded.wallClock.hours).toBe(10)
    expect(seeded.wallClock.minutes).toBe(0)
    expect((seeded.instantMs - Date.parse("2026-08-20T17:00:00.000Z")) % (7 * DAY_MS)).toBe(0)
  })

  it("holds the wall clock across a daylight-saving boundary in the EVENT's zone", () => {
    const afterSpring = new Date("2027-03-13T19:00:00.000Z")
    const seeded = nextDuplicateStart("2027-03-06T18:00:00.000Z", LA, afterSpring)
    expect(seeded.instantMs).toBeGreaterThan(afterSpring.getTime())
    expect(seeded.wallClock.hours).toBe(10)
    expect(new Date(seeded.instantMs).toISOString()).toBe("2027-03-20T17:00:00.000Z")
    expect(duplicateReady(carrier(seeded.wallClock), carrier(seeded.wallClock), LA, afterSpring)).toBe(
      true,
    )
  })

  it("falls back to a week out when the source start does not parse", () => {
    const seeded = nextDuplicateStart("not-a-date", LA, now)
    expect(seeded.instantMs).toBe(now.getTime() + 7 * DAY_MS)
  })

  it("reads the wall clock in the EVENT zone, not the viewer's, when judging the future", () => {
    const nine = new Date(2026, 8, 10, 9, 0, 0, 0)
    expect(duplicateReady(nine, nine, "Pacific/Honolulu", now)).toBe(true)
    expect(duplicateReady(nine, nine, "Europe/Berlin", now)).toBe(false)
  })

  it("refuses a copy scheduled in the past", () => {
    const past = new Date(now.getTime() - DAY_MS)
    expect(duplicateReady(past, past, LA, now)).toBe(false)
    const future = new Date(now.getTime() + DAY_MS)
    expect(duplicateReady(future, future, LA, now)).toBe(true)
    expect(duplicateReady(null, future, LA, now)).toBe(false)
  })
})

describe("error copy", () => {
  const en = catalog("en", "event-dashboard") as {
    events: Record<string, string>
    team: Record<string, string>
  }

  const leaf = (key: string): string | undefined => {
    const [section, rest] = key.split(".") as ["events" | "team", string]
    return en[section]?.[rest]
  }

  it("maps every duplicate error code to real copy", () => {
    for (const code of ["FORBIDDEN", "NOT_FOUND", "RATE_LIMITED", "VALIDATION", undefined]) {
      expect(leaf(duplicateErrorKey(code))).toBeTruthy()
    }
  })

  it("maps every collaborator and invite error code to real copy", () => {
    for (const code of ["CONFLICT", "FORBIDDEN", "NOT_FOUND", undefined]) {
      expect(leaf(collaboratorErrorKey(code))).toBeTruthy()
    }
    for (const code of ["NOT_FOUND", "CONFLICT", "FORBIDDEN", "RATE_LIMITED", "VALIDATION", undefined]) {
      expect(leaf(orgInviteErrorKey(code))).toBeTruthy()
    }
    expect(leaf(orgInviteIdentifierErrorKey("email"))).toBeTruthy()
    expect(leaf(orgInviteIdentifierErrorKey("handle"))).toBeTruthy()
  })
})

describe("dashboard wiring", () => {
  it("puts the dashboard row on the own-profile body", () => {
    const body = source("../../../ProfileBody.tsx")
    expect(body).toContain("dashboard.title")
    expect(body).toContain('pushKind("event-dashboard")')
    expect(body).toContain("requireAuth")
  })

  it("names the dashboard row in every locale", () => {
    for (const lng of ["en", "es", "de", "ko"]) {
      const profile = catalog(lng, "profile") as { dashboard?: Record<string, string> }
      expect(profile.dashboard?.title).toBeTruthy()
      expect(profile.dashboard?.sub).toBeTruthy()
    }
  })

  it("keeps the dashboard body clear of the feed", () => {
    for (const file of DASHBOARD_PAGE_FILES) {
      expect(source(file), file).not.toContain("FeedBody")
      expect(source(file), file).not.toContain("feed/")
    }
    expect(source("../../EventDashboardBody.tsx")).toContain("./dashboard/NextUpCard")
  })

  it("routes the row actions at the nav kinds the plan named", () => {
    const body = dashboardNavSource()
    expect(body).toContain('kind: "create-cleanup"')
    expect(body).toContain('kind: "edit-cleanup"')
    expect(body).toContain('kind: "host-announce"')
    expect(body).toContain('roomKind: "cleanup"')
    expect(body).toContain("openHostDashboard")
  })

  it("stops pointing the host at the web console at all", () => {
    for (const file of DASHBOARD_PAGE_FILES) {
      expect(source(file), file).not.toContain("ConsoleLinkRow")
    }
    expect(source("../../HostModeBody.tsx")).not.toContain("ConsoleLinkRow")
  })

  it("sends an announcement straight through the new endpoint, with no draft machine in between", () => {
    const announce = source("../../HostAnnounceBody.tsx")
    expect(announce).toContain("useCreateAnnouncement")
    expect(announce).toContain("useAudiencePreview")
    expect(announce).not.toContain("useQuickBroadcast")
    expect(announce).not.toContain("retainedDraft")
    const store = source("../dashboardStore.ts")
    expect(store).not.toContain("broadcastPreset")
  })
})

function row(id: string, over: Partial<HostedEventDTO> = {}): HostedEventDTO {
  return hosted({ id, title: id.toUpperCase(), ...over })
}

describe("next up", () => {
  const now = new Date("2026-09-10T12:00:00.000Z")

  it("picks the soonest event that has not ended", () => {
    const next = nextUpEvent(
      [
        row("late", { startsAt: "2026-09-25T17:00:00.000Z" }),
        row("soon", { startsAt: "2026-09-12T17:00:00.000Z" }),
      ],
      now,
    )
    expect(next?.event.id).toBe("soon")
    expect(next?.phase).toBe("upcoming")
  })

  it("promotes a live event over a sooner-listed upcoming one", () => {
    const next = nextUpEvent(
      [
        row("soon", { startsAt: "2026-09-11T09:00:00.000Z" }),
        row("live", { startsAt: "2026-09-10T13:00:00.000Z", status: "active" }),
      ],
      now,
    )
    expect(next?.event.id).toBe("live")
    expect(next?.phase).toBe("live")
  })

  it("has nothing to show once every event is over or cancelled", () => {
    expect(
      nextUpEvent(
        [
          row("over", { startsAt: "2026-09-08T17:00:00.000Z", endsAt: "2026-09-08T21:00:00.000Z" }),
          row("gone", { status: "cancelled" }),
        ],
        now,
      ),
    ).toBeNull()
  })

  it("ignores a STORED done on a row whose window has not closed - status is a clock reading", () => {
    const stale = row("stale", {
      status: "done",
      startsAt: "2026-09-10T11:00:00.000Z",
      endsAt: "2026-09-10T15:00:00.000Z",
    })
    expect(hostedEventStatus(stale, now)).toBe("active")
    expect(nextUpEvent([stale], now)?.event.id).toBe("stale")
  })

  it("reads the phase of a hosted row the same way the shared clock does", () => {
    expect(hostedEventPhase(row("a", { status: "cancelled" }), now)).toBe("cancelled")
    expect(hostedEventPhase(row("b", { startsAt: "2026-09-10T13:00:00.000Z" }), now)).toBe("live")
    expect(hostedEventPhase(row("c"), now)).toBe("upcoming")
  })

  it("finds a LIVE event in the past window, which is where the server puts it", () => {
    const upcomingWindow = [row("soon", { startsAt: "2026-09-14T09:00:00.000Z" })]
    const pastWindow = [
      row("live", { startsAt: "2026-09-10T11:00:00.000Z", endsAt: "2026-09-10T15:00:00.000Z" }),
      row("finished", { startsAt: "2026-09-08T17:00:00.000Z", endsAt: "2026-09-08T21:00:00.000Z" }),
    ]
    expect(nextUpEvent(upcomingWindow, now)?.event.id).toBe("soon")
    const both = nextUpEvent([...upcomingWindow, ...pastWindow], now)
    expect(both?.event.id).toBe("live")
    expect(both?.phase).toBe("live")
  })

  it("still refuses a finished past row, however recent", () => {
    const justDone = row("done", {
      startsAt: "2026-09-10T08:00:00.000Z",
      endsAt: "2026-09-10T12:00:00.000Z",
    })
    expect(nextUpEvent([justDone], now)).toBeNull()
    expect(nextUpEvent([justDone, row("soon", { startsAt: "2026-09-14T09:00:00.000Z" })], now)?.event.id).toBe(
      "soon",
    )
  })

  it("is fed BOTH windows by the dashboard body, not just the upcoming one", () => {
    const body = source("../../EventDashboardBody.tsx")
    expect(body).toContain("nextUpEvent([...upcomingEvents, ...pastEvents], now)")
  })

  it("reads the portfolio counters off the first page only", () => {
    const kpis = { eventsHosted: 9, upcomingEvents: 2, totalRegistrations: 40, totalCheckedIn: 31 }
    expect(portfolioKpis([{ items: [], nextCursor: null, kpis }])).toEqual(kpis)
    expect(portfolioKpis([{ items: [], nextCursor: null }])).toBeNull()
    expect(portfolioKpis(undefined)).toBeNull()
  })
})

describe("impact", () => {
  const rate = (value: number | null) => ({
    value,
    numerator: value === null ? null : 10,
    denominator: value === null ? null : 20,
    suppressed: value === null,
  })

  const analytics = (over: Partial<HostedEventsAnalyticsResponse> = {}): HostedEventsAnalyticsResponse => ({
    generatedAt: "2026-09-10T12:00:00.000Z",
    range: "all",
    k: 5,
    totals: { events: 6, registrations: 120, checkIns: 90, uniqueAttendees: 79 },
    series: [],
    byEvent: { panelSuppressed: false, rows: [] },
    repeatAttendance: rate(0.15),
    averageCheckInRate: rate(0.82),
    bestDayTime: null,
    topVolunteers: [],
    totalHours: 1284,
    volunteersCredited: 62,
    ...over,
  })

  it("has nothing to say before anyone has turned up", () => {
    expect(impactModel(undefined)).toBeNull()
    expect(
      impactModel(
        analytics({ totals: { events: 1, registrations: 0, checkIns: 0, uniqueAttendees: 0 } }),
      ),
    ).toBeNull()
  })

  it("leads with credited hours when there are any", () => {
    const model = impactModel(analytics())
    expect(model?.hero).toEqual({ value: 1284, unit: "hours" })
    expect(model?.volunteersCredited).toBe(62)
    expect(model?.uniqueAttendees).toBe(79)
    expect(model?.events).toBe(6)
  })

  it("falls back to the volunteer head-count when no hours are credited yet", () => {
    const model = impactModel(analytics({ totalHours: 0, volunteersCredited: 0 }))
    expect(model?.hero).toEqual({ value: 79, unit: "volunteers" })
  })

  it("reads a payload without the hours fields", () => {
    const legacy = analytics()
    delete (legacy as { totalHours?: number }).totalHours
    delete (legacy as { volunteersCredited?: number }).volunteersCredited
    const model = impactModel(legacy)
    expect(model?.hero.unit).toBe("volunteers")
    expect(model?.volunteersCredited).toBeNull()
  })

  it("only claims a turnout rate once somebody registered", () => {
    expect(impactModel(analytics())?.showedUp).toBe(0.82)
    expect(
      impactModel(
        analytics({ totals: { events: 6, registrations: 0, checkIns: 0, uniqueAttendees: 79 } }),
      )?.showedUp,
    ).toBeNull()
  })

  it("only claims a came-back rate from the second event on", () => {
    expect(impactModel(analytics())?.cameBack).toBe(0.15)
    expect(
      impactModel(
        analytics({ totals: { events: 1, registrations: 10, checkIns: 8, uniqueAttendees: 8 } }),
      )?.cameBack,
    ).toBeNull()
  })
})

const dashboardRowSource = (): string => source("../HostedEventRow.tsx")

describe("first event and past rows", () => {
  it("teaches only a host who has hosted nothing and has nothing coming", () => {
    const kpis = { eventsHosted: 0, upcomingEvents: 0, totalRegistrations: 0, totalCheckedIn: 0 }
    expect(firstEventState(kpis, [])).toBe(true)
    expect(firstEventState(kpis, [row("soon")])).toBe(false)
    expect(firstEventState({ ...kpis, eventsHosted: 2 }, [])).toBe(false)
    expect(firstEventState(null, [])).toBe(false)
  })

  it("prints turnout once anyone registered and hours once anyone was credited", () => {
    expect(pastRowMeta(row("a", { registeredCount: 38, checkedInCount: 31, hoursCredited: 62 })))
      .toEqual({ cancelled: false, showedUp: true, hoursToken: "hours" })
  })

  it("calls out a finished event whose hours nobody logged", () => {
    expect(pastRowMeta(row("b", { registeredCount: 8, checkedInCount: 6, hoursCredited: 0 })))
      .toEqual({ cancelled: false, showedUp: true, hoursToken: "not_logged" })
  })

  it("says nothing about hours for an event nobody checked in to", () => {
    expect(pastRowMeta(row("c", { registeredCount: 0, checkedInCount: 0 }))).toEqual({
      cancelled: false,
      showedUp: false,
      hoursToken: null,
    })
  })

  it("says a cancelled event was cancelled instead of counting a turnout it never had", () => {
    expect(
      pastRowMeta(
        row("d", { status: "cancelled", registeredCount: 6, checkedInCount: 0, hoursCredited: 0 }),
      ),
    ).toEqual({ cancelled: true, showedUp: false, hoursToken: null })
  })

  it("keeps the cancelled token off a completed event that simply had no arrivals", () => {
    expect(pastRowMeta(row("e", { status: "done", registeredCount: 6, checkedInCount: 0 })))
      .toEqual({ cancelled: false, showedUp: true, hoursToken: null })
  })

  it("prints the cancelled token in the past row instead of the showed-up and hours ones", () => {
    const source = dashboardRowSource()
    expect(source).toContain("past.cancelled")
    expect(source).toContain('t("events.meta_cancelled")')
    expect(source).toContain('tone: "muted" as const')
    expect(source).toContain("color: t.colors.textSubtle")
  })

  it("shares the public page slug, then the reference code, then the id", () => {
    expect(sharePathFor(row("a", { pageSlug: "ted-watkins" }))).toBe("/cleanups/ted-watkins")
    expect(sharePathFor(row("b", { referenceCode: "CF-1234" }))).toBe("/cleanups/CF-1234")
    expect(sharePathFor(row("c"))).toBe("/cleanups/c")
  })
})

describe("portfolio surface", () => {
  const dashboardSource = (file: string): string => source(`../${file}`)

  it("ships no KPI strip, sparkline, portfolio stats or top-events card", () => {
    expect(existsSync(new URL("../KpiStrip.tsx", import.meta.url))).toBe(false)
    expect(existsSync(new URL("../Sparkline.tsx", import.meta.url))).toBe(false)
    expect(existsSync(new URL("../PortfolioStats.tsx", import.meta.url))).toBe(false)
    expect(existsSync(new URL("../TopEventsCard.tsx", import.meta.url))).toBe(false)
  })

  it("keeps one coral fill on the page, in whichever card is showing", () => {
    for (const file of DASHBOARD_PAGE_FILES) {
      expect(source(file), file).not.toContain("<PrimaryButton")
    }
    expect(dashboardSource("NextUpCard.tsx").match(/<PrimaryButton/g)).toHaveLength(1)
    expect(dashboardSource("FirstEventCard.tsx").match(/<PrimaryButton/g)).toHaveLength(1)
  })

  it("leaves no bloom selection fill anywhere under the dashboard", () => {
    const files = [
      ...DASHBOARD_PAGE_FILES,
      "../NextUpCard.tsx",
      "../ImpactCard.tsx",
      "../FirstEventCard.tsx",
      "../HostedEventRow.tsx",
      "../CollaboratorsSection.tsx",
      "../OrgInviteSheet.tsx",
      "../DuplicateEventSheet.tsx",
      "../AnalyticsCarouselCard.tsx",
    ]
    for (const file of files) {
      expect(source(file)).not.toContain("brand.bloom")
      expect(source(file)).not.toContain('"#')
    }
  })

  it("keeps the only window switch inside the events card", () => {
    const page = DASHBOARD_PAGE_FILES.map(source).join("\n")
    expect(page.match(/<SegmentedControl/g)).toHaveLength(1)
    expect(page).not.toContain("SegmentedRow")
    const section = dashboardSource("HostedEventsSection.tsx")
    expect(section.match(/<SegmentedControl/g)).toHaveLength(1)
    expect(section).toContain("listHeader")
    expect(source("../../EventDashboardBody.tsx")).toContain("<HostedEventsSection")
  })

  it("drops the tab and range state the page no longer owns", () => {
    const store = source("../dashboardStore.ts")
    expect(store).not.toContain("setTab")
    expect(store).not.toContain("setRange")
    expect(store).not.toContain("broadcastPreset")
  })

  it("reads the portfolio through the new all-time model", () => {
    const body = source("../../EventDashboardBody.tsx")
    expect(body).toContain("portfolioKpis(upcoming.data?.pages)")
    expect(body).toContain("kpis={kpis}")
    expect(dashboardSource("DashboardHeader.tsx")).toContain("header.summary")
    expect(body).toContain('useHostedEventsAnalytics(ANALYTICS_RANGE')
    expect(body).toContain('const ANALYTICS_RANGE = "all"')
    expect(body).toContain("<ImpactCard")
    expect(body).toContain("<TopVolunteersCard")
    expect(body).toContain("<FirstEventCard")
  })

  it("demotes create-event to secondary", () => {
    expect(dashboardSource("DashboardHeader.tsx")).toContain("<SecondaryButton")
  })

  it("keeps the team in the shared list card, and leaves donation editing to the org page", () => {
    for (const file of DASHBOARD_PAGE_FILES) {
      expect(source(file), file).not.toContain("DonationLinkRow")
    }
    const team = dashboardSource("CollaboratorsSection.tsx")
    expect(team).toContain('variant="list"')
    expect(team).toContain("<ListRow")
  })

  it("names every portfolio string the redesign reads, in all four locales", () => {
    const keys: readonly [string, string][] = [
      ["header", "title"],
      ["header", "summary"],
      ["scope", "you"],
      ["scope", "a11y"],
      ["create", "short"],
      ["next_up", "section"],
      ["next_up", "host_tools"],
      ["next_up", "host_tools_a11y"],
      ["next_up", "share_a11y"],
      ["next_up", "signed_up_of"],
      ["next_up", "signed_up"],
      ["next_up", "waiting"],
      ["next_up", "checked_in"],
      ["next_up", "starts_in"],
      ["next_up", "started"],
      ["next_up", "more_shifts"],
      ["next_up", "more_shifts_a11y"],
      ["next_up", "meter_a11y"],
      ["impact", "section"],
      ["impact", "all_time"],
      ["impact", "unit_hours"],
      ["impact", "unit_volunteers"],
      ["impact", "credited_one"],
      ["impact", "credited_other"],
      ["impact", "volunteers_one"],
      ["impact", "volunteers_other"],
      ["impact", "events_other"],
      ["impact", "showed_up"],
      ["impact", "came_back"],
      ["top_volunteers", "section"],
      ["top_volunteers", "caption"],
      ["top_volunteers", "open_hint"],
      ["events", "section"],
      ["events", "meta_capacity"],
      ["events", "meta_waiting"],
      ["events", "meta_signed_up"],
      ["events", "meta_showed_up"],
      ["events", "meta_hours"],
      ["events", "meta_hours_not_logged"],
      ["events", "meta_cancelled"],
      ["events", "meta_underway"],
      ["events", "empty_past"],
      ["events", "empty_upcoming"],
      ["events", "check_in_a11y"],
      ["first_event", "title"],
      ["first_event", "cta"],
      ["team", "section"],
      ["team", "invite_row_sub"],
    ]
    for (const lng of ["en", "es", "de", "ko"]) {
      const cat = catalog(lng, "event-dashboard") as Record<string, Record<string, string>>
      for (const [section, leaf] of keys) {
        expect(cat[section]?.[leaf], `${lng} ${section}.${leaf}`).toBeTruthy()
      }
    }
  })

  it("retires the strings the redesign deleted, in all four locales", () => {
    for (const lng of ["en", "es", "de", "ko"]) {
      const cat = catalog(lng, "event-dashboard") as Record<string, Record<string, string> | undefined>
      expect(cat.tabs).toBeUndefined()
      expect(cat.org_picker).toBeUndefined()
      expect(cat.numbers).toBeUndefined()
      expect(cat.kpi).toBeUndefined()
      expect(cat.top_events).toBeUndefined()
      expect(cat.range?.all).toBeUndefined()
      expect(cat.next_up?.empty_title).toBeUndefined()
      expect(cat.next_up?.check_in).toBeUndefined()
      expect(cat.next_up?.check_in_a11y).toBeUndefined()
      expect(cat.next_up?.message).toBeUndefined()
      expect(cat.next_up?.message_a11y).toBeUndefined()
      expect(cat.next_up?.share).toBeUndefined()
      expect(cat.events?.empty_past_title).toBeUndefined()
      expect(cat.attention).toBeUndefined()
    }
  })

  it("shows an underway row live, under Upcoming", () => {
    const rowSource = dashboardRowSource()
    expect(rowSource).toContain('hostedEventStatus(event, now) === "active"')
    expect(rowSource).toContain('t("events.meta_underway", { ago: relative(event.startsAt, now) })')
    expect(rowSource).toContain('<PhaseDot phase="live" />')
  })

  it("drops the needs-attention card, and leaves invitations to the profile", () => {
    for (const file of DASHBOARD_PAGE_FILES) {
      const body = source(file)
      expect(body, file).not.toContain("AttentionCard")
      expect(body, file).not.toContain("attentionRows")
      expect(body, file).not.toContain("host-log-hours")
      expect(body, file).not.toContain("Invite")
      expect(body, file).not.toContain("invite")
    }
    expect(existsSync(new URL("../AttentionCard.tsx", import.meta.url))).toBe(false)
    expect(existsSync(new URL("../InvitationsCard.tsx", import.meta.url))).toBe(false)
    expect(existsSync(new URL("../InviteRows.tsx", import.meta.url))).toBe(false)
  })

  it("scopes the analytics carousel to the dashboard's own org scope, not to one event", () => {
    const body = source("../../EventDashboardBody.tsx")
    expect(body).toContain("<AnalyticsCarouselCard orgId={activeOrgId} />")
    expect(body).not.toContain("analyticsFocus")
    expect(body).not.toContain("analytics.for_event")
    expect(dashboardSource("AnalyticsCarouselCard.tsx")).toContain(
      "useHostAnalyticsSummary(orgId)",
    )
  })

  it("makes the hidden-shift line a pressable route into host tools", () => {
    const card = dashboardSource("NextUpCard.tsx")
    expect(card).toContain("<TextLink")
    expect(card).toContain('t("next_up.more_shifts_a11y"')
    expect(card).toContain("onHostTools")
  })

  it("opens the event page when the card body is pressed", () => {
    const card = dashboardSource("NextUpCard.tsx")
    expect(card).toContain("const open = useCallback(() => onOpen(event), [event, onOpen])")
    expect(card).toMatch(/<Pressable\s+onPress=\{open\}/)
    expect(card).toContain("accessibilityLabel={cardLabel}")
    const body = source("../../EventDashboardBody.tsx")
    expect(body).toContain("onOpen={onOpenEvent}")
    expect(body).toContain("const { onCreate, onOpenEvent, onHostTools, onShare } = nav")
    expect(dashboardNavSource()).toContain('push({ kind: "cleanup", id: event.id, title: event.title })')
  })

  it("keeps the staffing and shift lines audible by folding them into the card label", () => {
    const card = dashboardSource("NextUpCard.tsx")
    expect(card).toMatch(
      /const cardLabel = \[\s*t\("events\.open_a11y", \{ title: event\.title \}\),\s*whenLine,\s*seats,/,
    )
    expect(card).toContain('t("next_up.waiting", { count: event.waitlistCount }) : null')
    expect(card).toContain('t("next_up.checked_in", { count: liveCheckedIn }) : null')
  })

  it("points the one card button at host tools, whatever the stage", () => {
    const card = dashboardSource("NextUpCard.tsx")
    expect(card).toMatch(/<PrimaryButton[\s\S]*?label=\{t\("next_up\.host_tools"\)\}/)
    expect(card).toMatch(/<PrimaryButton[\s\S]*?onPress=\{hostTools\}/)
    expect(card).not.toContain("cta")
    expect(source("../dashboardModel.ts")).not.toContain("nextUpCta")
    const body = source("../../EventDashboardBody.tsx")
    expect(body).toContain("onHostTools={onHostTools}")
    expect(dashboardNavSource()).toContain("openHostDashboard({ eventId: event.id })")
  })

  it("shares from an icon button pinned to the top right of the card", () => {
    const card = dashboardSource("NextUpCard.tsx")
    expect(card).toContain("const MIN_TOUCH_TARGET = 44")
    expect(card).toContain("const SHARE_HIT_SLOP = (MIN_TOUCH_TARGET - SHARE_SIZE) / 2")
    expect(card).toMatch(/<Pressable\s+onPress=\{share\}/)
    expect(card).toContain('accessibilityLabel={t("next_up.share_a11y", { title: event.title })}')
    expect(card).toContain("hitSlop={SHARE_HIT_SLOP}")
    expect(card).toContain("<Icon icon={iconMap.Share}")
    expect(card).toMatch(/share: \{\s*position: "absolute",\s*top: 0,\s*right: 0,\s*zIndex: 1,/)
    expect(card).toContain("paddingRight: SHARE_SIZE + t.space[\"2\"]")
    const body = source("../../EventDashboardBody.tsx")
    expect(body).toContain("onShare={onShare}")
    expect(dashboardNavSource()).toContain("shareLink({ title: event.title, path: sharePathFor(event) })")
  })

  it("reaches the card body, then host tools, then the share icon on a web tab sweep", () => {
    const card = dashboardSource("NextUpCard.tsx")
    expect(card.indexOf("onPress={open}")).toBeLessThan(card.indexOf("onPress={hostTools}"))
    expect(card.indexOf("onPress={hostTools}")).toBeLessThan(card.indexOf("onPress={share}"))
    expect(card).toMatch(/share: \{\s*position: "absolute",\s*top: 0,\s*right: 0,/)
  })

  it("keeps the share icon and the host-tools button OUTSIDE the card pressable", () => {
    const card = dashboardSource("NextUpCard.tsx")
    expect(card.match(/<Pressable/g)).toHaveLength(2)
    const opens = card.indexOf("onPress={open}")
    const region = card.slice(opens, card.indexOf("</Pressable>", opens))
    expect(region).not.toContain("<Pressable")
    expect(region).not.toContain("<PrimaryButton")
    expect(region).not.toContain("<TextLink")
    expect(region).not.toContain("onPress={share}")
    expect(region).not.toContain("onPress={hostTools}")
  })

  it("keeps the live dot, the started line and the shifts strip inside the card body", () => {
    const card = dashboardSource("NextUpCard.tsx")
    expect(card).toContain("<PhaseDot phase={phase} />")
    expect(card).toContain('t("next_up.started", { ago: relative(event.startsAt, now) })')
    expect(card).toContain("<ShiftRow")
    expect(card).toContain("when.timeWithZone")
  })

  it("ticks the dashboard clock off the shared hook instead of reading it mid-render", () => {
    const body = source("../../EventDashboardBody.tsx")
    expect(body).toContain("const nowMs = useNow(NOW_TICK_MS, { boundaryAt })")
    expect(body).not.toContain("const now = new Date()")
  })

  it("re-reads the soonest boundary each tick, so a later one still schedules a refresh", () => {
    const body = source("../../EventDashboardBody.tsx")
    expect(body).toContain("const boundaryAt = soonestBoundary(upcomingEvents, Date.now())")
    expect(body).not.toMatch(/useMemo\(\(\) => soonestBoundary\([^)]*\), \[upcomingEvents\]\)/)
    expect(body).toContain("function soonestBoundary(events: readonly HostedEventDTO[], at: number)")
  })
})
