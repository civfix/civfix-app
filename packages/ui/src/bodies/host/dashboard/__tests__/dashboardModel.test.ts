import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type {
  HostedEventDTO,
  OrgBalanceDTO,
  OrganizationDTO,
  OrganizationInviteDTO,
  OrganizationMemberDTO,
  SeriesPoint,
} from "@civfix/shared"
import { MAX_ORG_INVITES_PER_ORG } from "@civfix/shared"
import { can } from "@civfix/shared/host"
import {
  DASHBOARD_RANGES,
  DEFAULT_DASHBOARD_RANGE,
  buildDashboardTabs,
  canManageOrgPayments,
  canManageOrgTeam,
  canSetOrgMemberRole,
  canViewOrgMoney,
  collaboratorErrorKey,
  donationSummaryFrom,
  duplicateErrorKey,
  duplicateReady,
  hostedEventActions,
  hostedEventCan,
  hostedEventHasActions,
  nextDuplicateStart,
  orderedOrgMembers,
  orgInviteErrorKey,
  orgInviteIdentifierErrorKey,
  orgInviteQuotaReached,
  orgMemberActions,
  orgMemberHasActions,
  payoutBlockedKey,
  payoutButtonModel,
  payoutErrorKey,
  pendingOrgInvites,
  seriesChartable,
  sparklineBars,
  suppressed,
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

describe("dashboard tabs", () => {
  it("hides the org tab and falls back to personal when the viewer is in no org", () => {
    const model = buildDashboardTabs({ orgs: [], requestedTab: "org", requestedOrgId: "o1" })
    expect(model.orgTabVisible).toBe(false)
    expect(model.tab).toBe("personal")
    expect(model.selectedOrgId).toBeNull()
  })

  it("shows the org tab with no picker for a single org", () => {
    const model = buildDashboardTabs({
      orgs: [org("o1")],
      requestedTab: "org",
      requestedOrgId: null,
    })
    expect(model.orgTabVisible).toBe(true)
    expect(model.orgPickerVisible).toBe(false)
    expect(model.selectedOrgId).toBe("o1")
  })

  it("shows the picker for more than one org and honours the remembered choice", () => {
    const model = buildDashboardTabs({
      orgs: [org("o1"), org("o2")],
      requestedTab: "org",
      requestedOrgId: "o2",
    })
    expect(model.orgPickerVisible).toBe(true)
    expect(model.selectedOrg?.id).toBe("o2")
  })

  it("falls back to the first org when the remembered one is gone", () => {
    const model = buildDashboardTabs({
      orgs: [org("o1")],
      requestedTab: "org",
      requestedOrgId: "vanished",
    })
    expect(model.selectedOrgId).toBe("o1")
  })

  it("never shows the picker on the personal tab", () => {
    const model = buildDashboardTabs({
      orgs: [org("o1"), org("o2")],
      requestedTab: "personal",
      requestedOrgId: "o1",
    })
    expect(model.orgPickerVisible).toBe(false)
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

describe("analytics suppression", () => {
  it("treats a null count as suppressed", () => {
    expect(suppressed(null)).toBe(true)
    expect(suppressed(0)).toBe(false)
  })

  it("needs two real points before it draws a sparkline", () => {
    const points = (values: (number | null)[]): SeriesPoint[] =>
      values.map((value, index) => ({ day: `d${index}`, value, suppressed: value === null }))
    expect(seriesChartable(points([1, null]))).toBe(false)
    expect(seriesChartable(points([1, 2]))).toBe(true)
  })

  it("scales bars against the peak and marks suppressed points", () => {
    const bars = sparklineBars([
      { day: "d0", value: 5, suppressed: false },
      { day: "d1", value: 10, suppressed: false },
      { day: "d2", value: null, suppressed: true },
    ])
    expect(bars).toEqual([
      { height: 0.5, suppressed: false },
      { height: 1, suppressed: false },
      { height: 0, suppressed: true },
    ])
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

  it("defaults to the shortest range", () => {
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
    expect(body).toContain("./dashboard/InviteRows")
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
