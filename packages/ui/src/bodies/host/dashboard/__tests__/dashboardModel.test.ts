import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type {
  HostedEventDTO,
  HostedEventsAnalyticsResponse,
  OrgBalanceDTO,
  OrganizationDTO,
  OrganizationInviteDTO,
  OrganizationMemberDTO,
} from "@civfix/shared"
import { MAX_ORG_INVITES_PER_ORG } from "@civfix/shared"
import { can } from "@civfix/shared/host"
import {
  ATTENTION_MAX_ROWS,
  attentionRows,
  canManageOrgPayments,
  canManageOrgTeam,
  canSetOrgMemberRole,
  canViewOrgMoney,
  collaboratorErrorKey,
  dashboardScope,
  DASHBOARD_RANGES,
  DEFAULT_DASHBOARD_RANGE,
  donationSummaryFrom,
  duplicateErrorKey,
  duplicateReady,
  firstEventState,
  hostedEventActions,
  hostedEventCan,
  hostedEventHasActions,
  hostedEventPhase,
  impactModel,
  nextDuplicateStart,
  nextUpCta,
  nextUpEvent,
  NEXT_UP_MESSAGE_WITHIN_MS,
  orderedOrgMembers,
  orgInviteErrorKey,
  orgInviteIdentifierErrorKey,
  orgInviteQuotaReached,
  orgMemberActions,
  orgMemberHasActions,
  pastRowMeta,
  payoutBlockedKey,
  payoutButtonModel,
  payoutErrorKey,
  pendingOrgInvites,
  portfolioKpis,
  sharePathFor,
} from "../dashboardModel"

const DAY_MS = 86_400_000

const source = (file: string): string =>
  readFileSync(new URL(file, import.meta.url), "utf8")

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

function balance(over: Partial<OrgBalanceDTO> = {}): OrgBalanceDTO {
  return {
    available: { amountMinor: 5000, currency: "USD" },
    pending: { amountMinor: 200, currency: "USD" },
    payoutsEnabled: true,
    payoutSchedule: { interval: "manual" },
    lastSyncedAt: "2026-09-10T00:00:00.000Z",
    ...over,
  } as OrgBalanceDTO
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
  it("gives an organizer every action", () => {
    const actions = hostedEventActions(hosted({ myRole: "organizer" }))
    expect(actions).toEqual({
      hostTools: true,
      emailAttendees: true,
      duplicate: true,
      edit: true,
    })
  })

  it("gives a staff member only host tools", () => {
    const actions = hostedEventActions(hosted({ myRole: "staff" }))
    expect(actions).toEqual({
      hostTools: true,
      emailAttendees: false,
      duplicate: false,
      edit: false,
    })
    expect(hostedEventHasActions(actions)).toBe(true)
  })

  it("prefers the server capability list over the legacy role fallback", () => {
    const event = hosted({ myRole: "organizer", myCapabilities: ["view_roster"] })
    expect(hostedEventCan(event, "manage_event")).toBe(false)
    expect(hostedEventActions(event)).toEqual({
      hostTools: true,
      emailAttendees: false,
      duplicate: false,
      edit: false,
    })
  })

  it("gives a plain attendee nothing, so the row shows no menu", () => {
    const actions = hostedEventActions(hosted())
    expect(hostedEventHasActions(actions)).toBe(false)
  })

  it("lets broadcast alone unlock the email action", () => {
    const actions = hostedEventActions(hosted({ myCapabilities: ["broadcast"] }))
    expect(actions.emailAttendees).toBe(true)
    expect(actions.duplicate).toBe(false)
  })
})

describe("org role gating", () => {
  it("lets owners and admins manage the team", () => {
    expect(canManageOrgTeam("owner")).toBe(true)
    expect(canManageOrgTeam("admin")).toBe(true)
    expect(canManageOrgTeam("member")).toBe(false)
    expect(canManageOrgTeam(null)).toBe(false)
  })

  it("lets owners and admins see money but only owners move it", () => {
    expect(canViewOrgMoney("owner")).toBe(true)
    expect(canViewOrgMoney("admin")).toBe(true)
    expect(canViewOrgMoney("member")).toBe(false)
    expect(canManageOrgPayments("owner")).toBe(true)
    expect(canManageOrgPayments("admin")).toBe(false)
  })
})

describe("payout button", () => {
  it("stays hidden for an admin, who is read-only on money", () => {
    expect(payoutButtonModel({ role: "admin", balance: balance(), pending: false })).toEqual({
      visible: false,
      enabled: false,
      reason: "role",
    })
  })

  it("is enabled for an owner with an available balance", () => {
    expect(payoutButtonModel({ role: "owner", balance: balance(), pending: false })).toEqual({
      visible: true,
      enabled: true,
      reason: null,
    })
  })

  it("explains itself when Stripe has not enabled payouts", () => {
    const model = payoutButtonModel({
      role: "owner",
      balance: balance({ payoutsEnabled: false }),
      pending: false,
    })
    expect(model).toEqual({ visible: true, enabled: false, reason: "payouts_disabled" })
    expect(payoutBlockedKey(model.reason)).toBe("money.payout_blocked_disabled")
  })

  it("explains itself when nothing is available", () => {
    const model = payoutButtonModel({
      role: "owner",
      balance: balance({ available: { amountMinor: 0, currency: "USD" } }),
      pending: false,
    })
    expect(model).toEqual({ visible: true, enabled: false, reason: "no_balance" })
    expect(payoutBlockedKey(model.reason)).toBe("money.payout_blocked_empty")
  })

  it("blocks a second press while one payout is in flight", () => {
    expect(payoutButtonModel({ role: "owner", balance: balance(), pending: true }).enabled).toBe(
      false,
    )
  })

  it("shows no blocked explanation while the balance is still loading", () => {
    const model = payoutButtonModel({ role: "owner", balance: null, pending: false })
    expect(model).toEqual({ visible: true, enabled: false, reason: null })
    expect(payoutBlockedKey(model.reason)).toBeNull()
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
      }),
    ).toEqual({ roles: [], canRemove: true })
    expect(
      orgMemberActions({
        member: member("u1", "member", { canRemove: false }),
        viewerId: "u9",
        canManage: true,
        canSetRole: false,
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
    expect(orgMemberActions({ member: member("u1", "member"), viewerId: "u9", canManage: false, canSetRole: false }))
      .toEqual({ roles: [], canRemove: false })
  })

  it("never offers actions on the owner or on yourself", () => {
    expect(
      orgMemberHasActions(
        orgMemberActions({ member: member("u1", "owner"), viewerId: "u9", canManage: true, canSetRole: true }),
      ),
    ).toBe(false)
    expect(
      orgMemberHasActions(
        orgMemberActions({ member: member("u9", "admin"), viewerId: "u9", canManage: true, canSetRole: true }),
      ),
    ).toBe(false)
  })

  it("offers the other role and removal to a manager", () => {
    expect(orgMemberActions({ member: member("u1", "member"), viewerId: "u9", canManage: true, canSetRole: true }))
      .toEqual({ roles: ["admin"], canRemove: true })
  })

  it("honours canRemove from the server", () => {
    const actions = orgMemberActions({
      member: member("u1", "admin", { canRemove: false }),
      viewerId: "u9",
      canManage: true,
      canSetRole: true,
    })
    expect(actions).toEqual({ roles: ["member"], canRemove: false })
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

  it("keeps a future start as the default", () => {
    expect(nextDuplicateStart("2026-09-20T17:00:00.000Z", now).toISOString()).toBe(
      "2026-09-20T17:00:00.000Z",
    )
  })

  it("rolls a past start forward in whole weeks so the weekday and the wall clock survive", () => {
    const original = "2026-08-20T17:00:00.000Z"
    const seeded = nextDuplicateStart(original, now)
    expect(seeded.getTime()).toBeGreaterThan(now.getTime())
    expect(seeded.getDay()).toBe(new Date(original).getDay())
    expect(seeded.getHours()).toBe(new Date(original).getHours())
    expect(seeded.getMinutes()).toBe(new Date(original).getMinutes())
  })

  it("still lands in the future when the roll crosses a daylight-saving boundary", () => {
    const acrossDst = new Date("2027-03-15T17:30:00.000Z")
    const seeded = nextDuplicateStart("2027-03-01T18:00:00.000Z", acrossDst)
    expect(seeded.getTime()).toBeGreaterThan(acrossDst.getTime())
    expect(duplicateReady(seeded, seeded, acrossDst)).toBe(true)
  })

  it("refuses a copy scheduled in the past", () => {
    const past = new Date(now.getTime() - DAY_MS)
    expect(duplicateReady(past, past, now)).toBe(false)
    const future = new Date(now.getTime() + DAY_MS)
    expect(duplicateReady(future, future, now)).toBe(true)
    expect(duplicateReady(null, future, now)).toBe(false)
  })
})

describe("donation summary range", () => {
  it("turns each range chip into a from-date", () => {
    const now = new Date("2026-09-10T00:00:00.000Z")
    expect(donationSummaryFrom("30d", now)).toBe("2026-08-11T00:00:00.000Z")
    expect(donationSummaryFrom("365d", now)).toBe("2025-09-10T00:00:00.000Z")
  })

  it("keeps three money ranges and defaults to the shortest", () => {
    expect(DEFAULT_DASHBOARD_RANGE).toBe("30d")
    expect(DASHBOARD_RANGES).toEqual(["30d", "90d", "365d"])
  })
})

describe("error copy", () => {
  const en = catalog("en", "event-dashboard") as {
    events: Record<string, string>
    money: Record<string, string>
    team: Record<string, string>
  }

  const leaf = (key: string): string | undefined => {
    const [section, rest] = key.split(".") as ["events" | "money" | "team", string]
    return en[section]?.[rest]
  }

  it("maps every duplicate error code to real copy", () => {
    for (const code of ["FORBIDDEN", "NOT_FOUND", "RATE_LIMITED", "VALIDATION", undefined]) {
      expect(leaf(duplicateErrorKey(code))).toBeTruthy()
    }
  })

  it("maps every payout error code to real copy", () => {
    for (const code of ["VALIDATION", "CONFLICT", "FORBIDDEN", "RATE_LIMITED", undefined]) {
      expect(leaf(payoutErrorKey(code))).toBeTruthy()
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
    const body = source("../../EventDashboardBody.tsx")
    expect(body).not.toContain("FeedBody")
    expect(body).not.toContain("feed/")
    expect(body).toContain("./dashboard/AttentionCard")
  })

  it("routes the row actions at the nav kinds the plan named", () => {
    const body = source("../../EventDashboardBody.tsx")
    expect(body).toContain('kind: "create-cleanup"')
    expect(body).toContain('kind: "edit-cleanup"')
    expect(body).toContain('kind: "host-broadcast-quick"')
    expect(body).toContain("openHostDashboard")
  })

  it("opens the Stripe link through the injected capability, never a raw window call", () => {
    const money = source("../MoneySection.tsx")
    expect(money).toContain("openExternal?.openInAppBrowser ?? openExternal?.open")
    expect(money).not.toContain("window.")
  })

  it("renders the console link only on web", () => {
    expect(source("../ConsoleLinkRow.native.tsx")).toContain("return null")
    expect(source("../ConsoleLinkRow.web.tsx")).toContain("manageOrgPath")
    expect(source("../ConsoleLinkRow.tsx")).toContain("./ConsoleLinkRow.web")
  })

  it("preselects email and the registered segment for the email-attendees entry", () => {
    const broadcast = source("../../HostBroadcastQuickBody.tsx")
    expect(broadcast).toContain("EMAIL_CHANNELS")
    expect(broadcast).toContain('preset?.segment ?? "all_registered"')
    const store = source("../dashboardStore.ts")
    expect(store).toContain('segment: "all_registered"')
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

  it("has nothing to show once every event is done or cancelled", () => {
    expect(
      nextUpEvent(
        [
          row("done", { status: "done" }),
          row("gone", { status: "cancelled" }),
        ],
        now,
      ),
    ).toBeNull()
  })

  it("reads the phase of a hosted row the same way the shared clock does", () => {
    expect(hostedEventPhase(row("a", { status: "cancelled" }), now)).toBe("cancelled")
    expect(hostedEventPhase(row("b", { startsAt: "2026-09-10T13:00:00.000Z" }), now)).toBe("live")
    expect(hostedEventPhase(row("c"), now)).toBe("upcoming")
  })

  it("sends a live event to check-in", () => {
    const event = row("live", { startsAt: "2026-09-10T11:00:00.000Z", myRole: "organizer" })
    expect(nextUpCta({ phase: "live", event, now })).toBe("check_in")
  })

  it("offers a message when the event is close, has sign-ups and the viewer can broadcast", () => {
    const event = row("soon", {
      startsAt: new Date(now.getTime() + NEXT_UP_MESSAGE_WITHIN_MS - 1).toISOString(),
      registeredCount: 12,
      capacity: 20,
      myRole: "organizer",
    })
    expect(nextUpCta({ phase: "upcoming", event, now })).toBe("message")
  })

  it("stops offering the message once the event is further out than the window", () => {
    const event = row("later", {
      startsAt: new Date(now.getTime() + NEXT_UP_MESSAGE_WITHIN_MS + 1).toISOString(),
      registeredCount: 12,
      capacity: 20,
      myRole: "organizer",
    })
    expect(nextUpCta({ phase: "upcoming", event, now })).toBe("host_tools")
  })

  it("offers a share while the event is under half full, or has nobody at all", () => {
    const thin = row("thin", {
      startsAt: "2026-09-25T17:00:00.000Z",
      registeredCount: 4,
      capacity: 20,
      myRole: "organizer",
    })
    expect(nextUpCta({ phase: "upcoming", event: thin, now })).toBe("share")
    const uncapped = row("uncapped", {
      startsAt: "2026-09-25T17:00:00.000Z",
      registeredCount: 0,
      myRole: "organizer",
    })
    expect(nextUpCta({ phase: "upcoming", event: uncapped, now })).toBe("share")
  })

  it("falls back to host tools for a healthy event that is not close yet", () => {
    const event = row("healthy", {
      startsAt: "2026-09-25T17:00:00.000Z",
      registeredCount: 18,
      capacity: 20,
      myRole: "organizer",
    })
    expect(nextUpCta({ phase: "upcoming", event, now })).toBe("host_tools")
    expect(nextUpCta({ phase: "ended", event, now })).toBe("host_tools")
  })

  it("finds a LIVE event in the past window, which is where the server puts it", () => {
    const upcomingWindow = [row("soon", { startsAt: "2026-09-14T09:00:00.000Z" })]
    const pastWindow = [
      row("live", { startsAt: "2026-09-10T11:00:00.000Z", endsAt: "2026-09-10T15:00:00.000Z" }),
      row("finished", { status: "done", startsAt: "2026-09-08T17:00:00.000Z" }),
    ]
    expect(nextUpEvent(upcomingWindow, now)?.event.id).toBe("soon")
    const both = nextUpEvent([...upcomingWindow, ...pastWindow], now)
    expect(both?.event.id).toBe("live")
    expect(both?.phase).toBe("live")
    expect(nextUpCta({ phase: both?.phase ?? "upcoming", event: both?.event as HostedEventDTO, now })).toBe(
      "check_in",
    )
  })

  it("still refuses a finished past row, however recent", () => {
    const justDone = row("done", { status: "done", startsAt: "2026-09-10T08:00:00.000Z" })
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

describe("needs attention", () => {
  const now = new Date("2026-09-10T12:00:00.000Z")

  it("queues an event that ended without being marked completed", () => {
    const ended = row("ended", {
      status: "upcoming",
      startsAt: "2026-09-08T17:00:00.000Z",
      endsAt: "2026-09-08T21:00:00.000Z",
    })
    expect(attentionRows({ past: [ended], now })).toEqual([{ kind: "complete", event: ended }])
  })

  it("queues a finished event whose hours were never credited", () => {
    const unpaid = row("unpaid", { status: "done", checkedInCount: 6, hoursCredited: 0 })
    expect(attentionRows({ past: [unpaid], now })).toEqual([
      { kind: "credit_hours", event: unpaid },
    ])
  })

  it("leaves credited, empty and cancelled events alone", () => {
    const credited = row("credited", { status: "done", checkedInCount: 6, hoursCredited: 12 })
    const nobody = row("nobody", { status: "done", checkedInCount: 0 })
    const gone = row("gone", { status: "cancelled", startsAt: "2026-09-01T17:00:00.000Z" })
    expect(attentionRows({ past: [credited, nobody, gone], now })).toEqual([])
  })

  it("says nothing about hours the payload never carried: absent is UNKNOWN, not zero", () => {
    const silent = row("silent", { status: "done", checkedInCount: 6 })
    expect(silent.hoursCredited).toBeUndefined()
    expect(attentionRows({ past: [silent], now })).toEqual([])
    const explicit = row("explicit", { status: "done", checkedInCount: 6, hoursCredited: 0 })
    expect(attentionRows({ past: [explicit], now })).toEqual([
      { kind: "credit_hours", event: explicit },
    ])
  })

  it("puts every mark-completed ahead of every credit-hours, newest first", () => {
    const older = row("older", {
      status: "upcoming",
      startsAt: "2026-09-01T17:00:00.000Z",
      endsAt: "2026-09-01T21:00:00.000Z",
    })
    const newer = row("newer", {
      status: "upcoming",
      startsAt: "2026-09-08T17:00:00.000Z",
      endsAt: "2026-09-08T21:00:00.000Z",
    })
    const unpaid = row("unpaid", { status: "done", checkedInCount: 6, hoursCredited: 0 })
    const rows = attentionRows({ past: [unpaid, older, newer], now })
    expect(rows.map((entry) => entry.event.id)).toEqual(["newer", "older", "unpaid"])
  })

  it("caps the queue at three rows for the caller", () => {
    expect(ATTENTION_MAX_ROWS).toBe(3)
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

  it("reads a 0.44-shaped payload without the hours fields", () => {
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

  it("retires the old strip, bar row, tile grid and top-events card", () => {
    expect(existsSync(new URL("../KpiStrip.tsx", import.meta.url))).toBe(false)
    expect(existsSync(new URL("../Sparkline.tsx", import.meta.url))).toBe(false)
    expect(existsSync(new URL("../PortfolioStats.tsx", import.meta.url))).toBe(false)
    expect(existsSync(new URL("../TopEventsCard.tsx", import.meta.url))).toBe(false)
  })

  it("keeps one coral fill on the page, in whichever card is showing", () => {
    const body = source("../../EventDashboardBody.tsx")
    expect(body).not.toContain("<PrimaryButton")
    expect(dashboardSource("NextUpCard.tsx").match(/<PrimaryButton/g)).toHaveLength(1)
    expect(dashboardSource("FirstEventCard.tsx").match(/<PrimaryButton/g)).toHaveLength(1)
  })

  it("leaves no bloom selection fill anywhere under the dashboard", () => {
    const files = [
      "../../EventDashboardBody.tsx",
      "../NextUpCard.tsx",
      "../AttentionCard.tsx",
      "../ImpactCard.tsx",
      "../FirstEventCard.tsx",
      "../HostedEventRow.tsx",
      "../InviteRows.tsx",
      "../MoneySection.tsx",
      "../CollaboratorsSection.tsx",
      "../OrgInviteSheet.tsx",
      "../DuplicateEventSheet.tsx",
      "../ConsoleLinkRow.web.tsx",
    ]
    for (const file of files) {
      expect(source(file)).not.toContain("brand.bloom")
      expect(source(file)).not.toContain('"#')
    }
  })

  it("keeps the only window switch inside the events card", () => {
    const body = source("../../EventDashboardBody.tsx")
    expect(body.match(/<SegmentedControl/g)).toHaveLength(1)
    expect(body).toContain("listHeader")
    expect(body).not.toContain("SegmentedRow")
  })

  it("drops the tab and range state the page no longer owns", () => {
    const store = source("../dashboardStore.ts")
    expect(store).not.toContain("setTab")
    expect(store).not.toContain("setRange")
    expect(store).toContain('segment: "all_registered"')
  })

  it("reads the portfolio through the new all-time model", () => {
    const body = source("../../EventDashboardBody.tsx")
    expect(body).toContain("portfolioKpis(upcoming.data?.pages)")
    expect(body).toContain("header.summary")
    expect(body).toContain('useHostedEventsAnalytics(ANALYTICS_RANGE')
    expect(body).toContain('const ANALYTICS_RANGE = "all"')
    expect(body).toContain("<ImpactCard")
    expect(body).toContain("<TopVolunteersCard")
    expect(body).toContain("<AttentionCard")
    expect(body).toContain("<FirstEventCard")
    expect(body).toContain("./dashboard/AttentionCard")
    expect(dashboardSource("AttentionCard.tsx")).toContain("./InviteRows")
  })

  it("demotes create-event and the invitation accept to secondary", () => {
    const body = source("../../EventDashboardBody.tsx")
    expect(body).toContain("<SecondaryButton")
    const invites = dashboardSource("InviteRows.tsx")
    expect(invites).not.toContain("PrimaryButton")
    expect(invites).toContain("<SecondaryButton")
    expect(invites).toContain("<TextLink")
  })

  it("gives an invitation its own action line, so the title and the inviter stay readable", () => {
    const invites = dashboardSource("InviteRows.tsx")
    expect(invites.match(/footer=\{/g) ?? [], "both invite rows act below their text")
      .toHaveLength(2)
    expect(invites, "the trailing slot no longer squeezes the text column").not.toContain(
      "trailing={",
    )
    expect(invites.match(/titleLines=\{2\}/g) ?? []).toHaveLength(2)
    expect(invites).not.toContain('justifyContent: "flex-end"')
  })

  it("keeps money, team and the console link in the shared list card", () => {
    const money = dashboardSource("MoneySection.tsx")
    expect(money).toContain('variant="list"')
    expect(money).toContain('icon="ReceiptText"')
    expect(money).not.toContain("StatTileRow")
    const team = dashboardSource("CollaboratorsSection.tsx")
    expect(team).toContain('variant="list"')
    expect(team).toContain("<ListRow")
    expect(dashboardSource("ConsoleLinkRow.web.tsx")).toContain("<ListRow")
  })

  it("names every portfolio string the redesign reads, in all four locales", () => {
    const keys: readonly [string, string][] = [
      ["header", "title"],
      ["header", "summary"],
      ["scope", "you"],
      ["scope", "a11y"],
      ["create", "short"],
      ["next_up", "section"],
      ["next_up", "check_in"],
      ["next_up", "host_tools"],
      ["next_up", "message"],
      ["next_up", "share"],
      ["next_up", "signed_up_of"],
      ["next_up", "signed_up"],
      ["next_up", "waiting"],
      ["next_up", "checked_in"],
      ["next_up", "starts_in"],
      ["next_up", "started"],
      ["next_up", "more_shifts"],
      ["next_up", "meter_a11y"],
      ["attention", "section"],
      ["attention", "complete"],
      ["attention", "credit_hours"],
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
      ["events", "section"],
      ["events", "meta_capacity"],
      ["events", "meta_waiting"],
      ["events", "meta_signed_up"],
      ["events", "meta_showed_up"],
      ["events", "meta_hours"],
      ["events", "meta_hours_not_logged"],
      ["events", "meta_cancelled"],
      ["events", "empty_past"],
      ["events", "empty_upcoming"],
      ["events", "check_in_a11y"],
      ["first_event", "title"],
      ["first_event", "cta"],
      ["money", "range_a11y"],
      ["money", "sent_on"],
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
      expect(cat.events?.empty_past_title).toBeUndefined()
    }
  })
})
