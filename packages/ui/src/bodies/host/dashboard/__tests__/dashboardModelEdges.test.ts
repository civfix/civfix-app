import { describe, expect, it } from "vitest"
import type { HostedEventDTO, OrganizationMemberDTO } from "@civfix/shared"
import { hasHostCapability } from "../../../../data/hooks/host"
import {
  type HostedEventActions,
  canSetOrgMemberRole,
  collaboratorErrorKey,
  dashboardScope,
  duplicateErrorKey,
  hostedEventHasActions,
  hostedEventWhen,
  nextDuplicateStart,
  nextUpEvent,
  orderedOrgMembers,
  orgInviteErrorKey,
  orgInviteIdentifierErrorKey,
  orgMemberActions,
  pastRowMeta,
  portfolioKpis,
} from "../dashboardModel"

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

function member(id: string, role: OrganizationMemberDTO["role"], over: Partial<OrganizationMemberDTO> = {}) {
  return {
    person: { id, name: id, handle: id, deleted: false },
    role,
    joinedAt: "2026-01-01T00:00:00.000Z",
    canRemove: true,
    ...over,
  } as OrganizationMemberDTO
}

describe("dashboard error key tables", () => {
  it("maps every duplicate error code to its own key", () => {
    expect(
      ["FORBIDDEN", "NOT_FOUND", "RATE_LIMITED", "VALIDATION", "CONFLICT", undefined].map(duplicateErrorKey),
    ).toEqual([
      "events.duplicate_error_forbidden",
      "events.duplicate_error_gone",
      "events.duplicate_error_rate_limited",
      "events.duplicate_error_invalid",
      "events.duplicate_error_generic",
      "events.duplicate_error_generic",
    ])
  })

  it("maps every collaborator error code to its own key, with CONFLICT on the conflict line", () => {
    expect(["CONFLICT", "FORBIDDEN", "NOT_FOUND", "RATE_LIMITED", undefined].map(collaboratorErrorKey)).toEqual([
      "team.error_conflict",
      "team.error_forbidden",
      "team.error_gone",
      "team.error_generic",
      "team.error_generic",
    ])
  })

  it("does not recognise the last-admin code on the collaborator path", () => {
    expect(collaboratorErrorKey("ORG_LAST_ADMIN")).toBe("team.error_generic")
  })

  it("maps every org invite error code to its own key", () => {
    expect(
      ["NOT_FOUND", "CONFLICT", "FORBIDDEN", "RATE_LIMITED", "VALIDATION", "INTERNAL"].map(orgInviteErrorKey),
    ).toEqual([
      "team.invite_error_no_account",
      "team.invite_error_conflict",
      "team.invite_error_forbidden",
      "team.invite_error_rate_limited",
      "team.invite_error_invalid",
      "team.invite_error_generic",
    ])
    expect(orgInviteIdentifierErrorKey("email")).toBe("team.invite_email_invalid")
    expect(orgInviteIdentifierErrorKey("handle")).toBe("team.invite_handle_invalid")
  })
})

describe("dashboard scope edges", () => {
  it("stays personal with no requested org even when the viewer belongs to some", () => {
    const org = { id: "o1" } as never
    expect(dashboardScope([org], null)).toEqual({ orgId: null, org: null, selectorVisible: true })
  })
})

describe("hosted event capabilities", () => {
  it("derives the legacy organizer's capabilities from the role when the server sends none", () => {
    expect(hasHostCapability(hosted({ myCapabilities: [], myRole: "organizer" }), "manage_event")).toBe(true)
  })

  it("grants nothing to a row with no capabilities and no role", () => {
    const row = hosted({ myCapabilities: [], myRole: null })
    expect(hasHostCapability(row, "manage_event")).toBe(false)
    expect(hasHostCapability(row, "view_roster")).toBe(false)
  })

  it("has no actions only when every flag is off", () => {
    const none: HostedEventActions = { hostTools: false, chat: false, announce: false, duplicate: false, edit: false }
    expect(hostedEventHasActions(none)).toBe(false)
    for (const key of Object.keys(none) as (keyof HostedEventActions)[]) {
      expect(hostedEventHasActions({ ...none, [key]: true }), key).toBe(true)
    }
  })

  it("passes the start, end and zone through to the shared when-label input", () => {
    expect(hostedEventWhen(hosted({ timezone: "America/Los_Angeles" } as Partial<HostedEventDTO>))).toEqual({
      status: "upcoming",
      scheduledAt: "2026-09-20T17:00:00.000Z",
      endsAt: "2026-09-20T21:00:00.000Z",
      timezone: "America/Los_Angeles",
    })
    expect(hostedEventWhen(hosted({ endsAt: undefined }))).toMatchObject({ endsAt: null, timezone: null })
  })
})

describe("nextUpEvent edges", () => {
  const now = new Date("2026-09-10T12:00:00.000Z")

  it("keeps an equal start time in input order", () => {
    const rows = [
      hosted({ id: "a", startsAt: "2026-09-12T17:00:00.000Z", endsAt: "2026-09-12T19:00:00.000Z" }),
      hosted({ id: "b", startsAt: "2026-09-12T17:00:00.000Z", endsAt: "2026-09-12T19:00:00.000Z" }),
    ]
    expect(nextUpEvent(rows, now)?.event.id).toBe("a")
  })

  it("skips a cancelled row even when it is the soonest", () => {
    const rows = [
      hosted({ id: "gone", status: "cancelled", startsAt: "2026-09-11T17:00:00.000Z", endsAt: null }),
      hosted({ id: "later", startsAt: "2026-09-15T17:00:00.000Z", endsAt: null }),
    ]
    expect(nextUpEvent(rows, now)?.event.id).toBe("later")
  })

  it("is null for an empty list", () => {
    expect(nextUpEvent([], now)).toBeNull()
  })
})

describe("portfolio and past-row edges", () => {
  it("has no counters without pages", () => {
    expect(portfolioKpis(undefined)).toBeNull()
    expect(portfolioKpis([])).toBeNull()
  })

  it("prefers credited hours over the not-logged hint", () => {
    expect(pastRowMeta(hosted({ hoursCredited: 3, checkedInCount: 5 } as Partial<HostedEventDTO>)).hoursToken).toBe(
      "hours",
    )
  })

  it("reports no turnout for a finished event with no registrations", () => {
    expect(pastRowMeta(hosted({ registeredCount: 0 }))).toEqual({
      cancelled: false,
      showedUp: false,
      hoursToken: null,
    })
  })
})

describe("org member edges", () => {
  it("ranks owners, admins and members, and an unknown role last", () => {
    const rows = [member("z", "future" as never), member("m", "member"), member("a", "admin"), member("o", "owner")]
    expect(orderedOrgMembers(rows).map((m) => m.person.id)).toEqual(["o", "a", "m", "z"])
  })

  it("reserves the role change for the owner alone", () => {
    expect(canSetOrgMemberRole("owner")).toBe(true)
    expect(canSetOrgMemberRole("admin")).toBe(false)
    expect(canSetOrgMemberRole(null)).toBe(false)
    expect(canSetOrgMemberRole(undefined)).toBe(false)
  })

  it("offers nothing on a deleted account", () => {
    const deleted = member("d", "member", { person: { id: "d", name: "d", handle: null, deleted: true } } as never)
    expect(
      orgMemberActions({ member: deleted, viewerId: null, canManage: true, canSetRole: true, lastAdmin: false }),
    ).toEqual({ roles: [], canRemove: false })
  })

  it("offers a promotion to admin for a member when the viewer is unknown", () => {
    expect(
      orgMemberActions({ member: member("m", "member"), viewerId: null, canManage: true, canSetRole: true, lastAdmin: true }),
    ).toEqual({ roles: ["admin"], canRemove: true })
  })
})

describe("nextDuplicateStart edges", () => {
  it("rolls a start later within the same minute forward a week, since the wall clock keeps no seconds", () => {
    const now = new Date("2026-09-10T12:00:00.000Z")
    const seed = nextDuplicateStart("2026-09-10T12:00:30.000Z", "UTC", now)
    expect(new Date(seed.instantMs).toISOString()).toBe("2026-09-17T12:00:00.000Z")
  })

  it("keeps a start one minute in the future", () => {
    const now = new Date("2026-09-10T12:00:00.000Z")
    const seed = nextDuplicateStart("2026-09-10T12:01:00.000Z", "UTC", now)
    expect(new Date(seed.instantMs).toISOString()).toBe("2026-09-10T12:01:00.000Z")
  })

  it("rolls a start equal to now forward one week", () => {
    const now = new Date("2026-09-10T12:00:00.000Z")
    const seed = nextDuplicateStart("2026-09-10T12:00:00.000Z", "UTC", now)
    expect(new Date(seed.instantMs).toISOString()).toBe("2026-09-17T12:00:00.000Z")
    expect(seed.wallClock).toEqual({ year: 2026, month: 9, day: 17, hours: 12, minutes: 0 })
  })
})
