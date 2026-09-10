import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { EventTeamInviteDTO, EventTeamMemberDTO } from "@civfix/shared"
import { MAX_TEAM_INVITES_PER_EVENT } from "@civfix/shared"
import {
  INVITE_IDENTIFIER_MAX,
  TEAM_MEMBER_ROLE_ORDER,
  inviteDisplayName,
  inviteErrorKey,
  inviteIdentifierErrorKey,
  inviteIdentifierValue,
  inviteQuotaReached,
  orderedTeamInvites,
  orderedTeamMembers,
  pendingInviteCount,
  teamDateLabel,
  teamManageErrorKey,
  teamMemberActions,
  teamMemberHasActions,
  teamMemberRank,
} from "../hostTeamModel"

const catalog = (lng: string, ns: string): Record<string, Record<string, string>> =>
  JSON.parse(
    readFileSync(new URL(`../../../i18n/locales/${lng}/${ns}.json`, import.meta.url), "utf8"),
  )

function member(
  id: string,
  role: EventTeamMemberDTO["role"],
  over: Partial<EventTeamMemberDTO> = {},
): EventTeamMemberDTO {
  return {
    person: { id, name: id, handle: id, verified: false, deleted: false },
    role,
    joinedAt: null,
    canRemove: true,
    canChangeRole: true,
    ...over,
  } as EventTeamMemberDTO
}

function invite(
  id: string,
  over: Partial<EventTeamInviteDTO> = {},
): EventTeamInviteDTO {
  return {
    id,
    role: "staff",
    status: "pending",
    invitee: null,
    maskedEmail: null,
    invitedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: null,
    acceptedAt: null,
    ...over,
  } as EventTeamInviteDTO
}

describe("team ordering", () => {
  it("puts the organizer first and descends the tiers, attendees last", () => {
    expect(TEAM_MEMBER_ROLE_ORDER).toEqual([
      "organizer",
      "cohost",
      "coordinator",
      "staff",
      "member",
    ])
    const ordered = orderedTeamMembers([
      member("d", "member"),
      member("c", "staff"),
      member("a", "organizer"),
      member("b", "cohost"),
      member("x", "coordinator"),
    ])
    expect(ordered.map((m) => m.person.id)).toEqual(["a", "b", "x", "c", "d"])
  })

  it("breaks a tier tie by name so the list never reshuffles between renders", () => {
    const ordered = orderedTeamMembers([member("zoe", "staff"), member("ada", "staff")])
    expect(ordered.map((m) => m.person.id)).toEqual(["ada", "zoe"])
  })

  it("sorts a role the client does not know to the end rather than dropping it", () => {
    expect(teamMemberRank("member")).toBeLessThan(
      teamMemberRank("future_tier" as EventTeamMemberDTO["role"]),
    )
    const ordered = orderedTeamMembers([
      member("future", "future_tier" as EventTeamMemberDTO["role"]),
      member("host", "organizer"),
    ])
    expect(ordered.map((m) => m.person.id)).toEqual(["host", "future"])
  })
})

describe("who a manager may act on", () => {
  const viewerId = "me"

  it("offers nothing at all without manage_team", () => {
    const actions = teamMemberActions({
      member: member("other", "staff"),
      viewerId,
      canManageTeam: false,
    })
    expect(actions.roles).toEqual([])
    expect(actions.canRemove).toBe(false)
    expect(teamMemberHasActions(actions)).toBe(false)
  })

  it("never offers an action on the organizer - the seat is immutable", () => {
    expect(
      teamMemberHasActions(
        teamMemberActions({ member: member("owner", "organizer"), viewerId, canManageTeam: true }),
      ),
    ).toBe(false)
  })

  it("never offers an action on yourself", () => {
    expect(
      teamMemberHasActions(
        teamMemberActions({ member: member(viewerId, "cohost"), viewerId, canManageTeam: true }),
      ),
    ).toBe(false)
  })

  it("never offers an action on a deleted account", () => {
    const deleted = member("gone", "staff", {
      person: { id: "gone", name: "gone", handle: null, deleted: true },
    } as Partial<EventTeamMemberDTO>)
    expect(
      teamMemberHasActions(teamMemberActions({ member: deleted, viewerId, canManageTeam: true })),
    ).toBe(false)
  })

  it("honors the server's per-row verdict rather than assuming it", () => {
    const noRoleChange = teamMemberActions({
      member: member("other", "staff", { canChangeRole: false }),
      viewerId,
      canManageTeam: true,
    })
    expect(noRoleChange.roles).toEqual([])
    expect(noRoleChange.canRemove).toBe(true)

    const noRemove = teamMemberActions({
      member: member("other", "staff", { canRemove: false }),
      viewerId,
      canManageTeam: true,
    })
    expect(noRemove.canRemove).toBe(false)
    expect(noRemove.roles).toEqual(["cohost", "coordinator", "member"])
  })
})

describe("pending invites", () => {
  it("shows pending first, then the newest of the rest", () => {
    const rows = orderedTeamInvites([
      invite("old", { status: "revoked", createdAt: "2026-01-01T00:00:00.000Z" }),
      invite("new", { status: "revoked", createdAt: "2026-03-01T00:00:00.000Z" }),
      invite("open", { status: "pending", createdAt: "2025-01-01T00:00:00.000Z" }),
    ])
    expect(rows.map((row) => row.id)).toEqual(["open", "new", "old"])
  })

  it("counts only the open offers against the per-event cap", () => {
    const rows = [
      ...Array.from({ length: MAX_TEAM_INVITES_PER_EVENT - 1 }, (_, i) => invite(`p${i}`)),
      invite("revoked", { status: "revoked" }),
      invite("declined", { status: "declined" }),
    ]
    expect(pendingInviteCount(rows)).toBe(MAX_TEAM_INVITES_PER_EVENT - 1)
    expect(inviteQuotaReached(rows)).toBe(false)
    expect(inviteQuotaReached([...rows, invite("last")])).toBe(true)
  })

  it("names an invitee by account, else by the masked email, else by the fallback", () => {
    expect(
      inviteDisplayName(
        invite("a", {
          invitee: { id: "u1", name: "Ada", handle: "ada", deleted: false },
        } as Partial<EventTeamInviteDTO>),
        "fallback",
      ),
    ).toBe("Ada")
    expect(inviteDisplayName(invite("b", { maskedEmail: "a…@example.org" }), "fallback")).toBe(
      "a…@example.org",
    )
    expect(inviteDisplayName(invite("c"), "fallback")).toBe("fallback")
  })
})

describe("the identifier a host types", () => {
  it("accepts a handle with or without the leading @, and normalizes it away", () => {
    expect(inviteIdentifierValue("handle", " @ada_l ")).toBe("ada_l")
    expect(inviteIdentifierValue("handle", "ada_l")).toBe("ada_l")
  })

  it("refuses a handle the contract's own regex would refuse", () => {
    expect(inviteIdentifierValue("handle", "ab")).toBeNull()
    expect(inviteIdentifierValue("handle", "has spaces")).toBeNull()
    expect(inviteIdentifierValue("handle", "a".repeat(21))).toBeNull()
  })

  it("lowercases an email and refuses an incomplete one", () => {
    expect(inviteIdentifierValue("email", " Ada@Example.ORG ")).toBe("ada@example.org")
    expect(inviteIdentifierValue("email", "ada@example")).toBeNull()
    expect(inviteIdentifierValue("email", "")).toBeNull()
  })

  it("stays inside the contract's identifier length", () => {
    expect(INVITE_IDENTIFIER_MAX).toBe(254)
    expect(inviteIdentifierValue("email", `${"a".repeat(250)}@example.org`)).toBeNull()
  })

  it("names the field-specific hint per kind", () => {
    expect(inviteIdentifierErrorKey("handle")).toBe("invite.handle_invalid")
    expect(inviteIdentifierErrorKey("email")).toBe("invite.email_invalid")
  })
})

describe("error copy routing", () => {
  it("maps every AppError code the invite endpoint can raise onto its own line", () => {
    expect(inviteErrorKey("NOT_FOUND")).toBe("invite.error_no_account")
    expect(inviteErrorKey("CONFLICT")).toBe("invite.error_conflict")
    expect(inviteErrorKey("FORBIDDEN")).toBe("invite.error_forbidden")
    expect(inviteErrorKey("RATE_LIMITED")).toBe("invite.error_rate_limited")
    expect(inviteErrorKey("VALIDATION")).toBe("invite.error_invalid")
    expect(inviteErrorKey(undefined)).toBe("invite.error_generic")
  })

  it("routes the seat and invite mutations onto the manage lines", () => {
    expect(teamManageErrorKey("CONFLICT")).toBe("manage.error_conflict")
    expect(teamManageErrorKey("FORBIDDEN")).toBe("manage.error_forbidden")
    expect(teamManageErrorKey("NOT_FOUND")).toBe("manage.error_gone")
    expect(teamManageErrorKey("INTERNAL")).toBe("manage.error_generic")
  })

  it("resolves every routed key in all four catalogs", () => {
    const keys = [
      ...["NOT_FOUND", "CONFLICT", "FORBIDDEN", "RATE_LIMITED", "VALIDATION", undefined].map(
        inviteErrorKey,
      ),
      ...["CONFLICT", "FORBIDDEN", "NOT_FOUND", undefined].map(teamManageErrorKey),
      inviteIdentifierErrorKey("handle"),
      inviteIdentifierErrorKey("email"),
    ]
    for (const lng of ["en", "es", "de", "ko"]) {
      const team = catalog(lng, "host-team")
      for (const key of keys) {
        const [section, leaf] = key.split(".") as [string, string]
        expect(team[section]?.[leaf], `${lng} ${key}`).toBeTruthy()
      }
    }
  })
})

describe("dates on the team screen", () => {
  it("renders an absolute day, because an invite deadline is triaged by date", () => {
    expect(teamDateLabel("2026-03-04T10:00:00.000Z", "en-US")).toContain("2026")
  })

  it("says nothing at all for a missing or unparseable timestamp", () => {
    expect(teamDateLabel(null, "en-US")).toBe("")
    expect(teamDateLabel(undefined, "en-US")).toBe("")
    expect(teamDateLabel("not-a-date", "en-US")).toBe("")
  })

  it("falls back to the ISO day rather than throwing on a locale the runtime rejects", () => {
    expect(teamDateLabel("2026-03-04T10:00:00.000Z", "!!not-a-locale")).toBe("2026-03-04")
  })
})
