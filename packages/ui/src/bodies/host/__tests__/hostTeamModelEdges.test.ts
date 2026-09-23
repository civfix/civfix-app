import { describe, expect, it } from "vitest"
import type { EventTeamInviteDTO, EventTeamMemberDTO } from "@civfix/shared"
import {
  NO_TEAM_MEMBER_ACTIONS,
  inviteDisplayName,
  inviteErrorKey,
  inviteIdentifierValue,
  orderedTeamInvites,
  teamDateLabel,
  teamMemberActions,
  teamMemberHasActions,
  teamMemberRank,
} from "../hostTeamModel"

function member(id: string, role: EventTeamMemberDTO["role"], over: Partial<EventTeamMemberDTO> = {}) {
  return {
    person: { id, name: id, handle: id, deleted: false },
    role,
    joinedAt: null,
    canRemove: true,
    canChangeRole: true,
    ...over,
  } as EventTeamMemberDTO
}

function invite(id: string, over: Partial<EventTeamInviteDTO> = {}) {
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

describe("teamMemberRank", () => {
  it("ranks the known roles by position", () => {
    expect(["organizer", "cohost", "coordinator", "staff", "member"].map((r) => teamMemberRank(r as never))).toEqual([
      0, 1, 2, 3, 4,
    ])
  })
})

describe("teamMemberActions edges", () => {
  it("offers every other settable role for a member when the viewer is unknown", () => {
    expect(teamMemberActions({ member: member("m", "member"), viewerId: null, canManageTeam: true })).toEqual({
      roles: ["cohost", "coordinator", "staff"],
      canRemove: true,
    })
  })

  it("returns the shared empty constant when nothing is allowed", () => {
    expect(teamMemberActions({ member: member("o", "organizer"), viewerId: null, canManageTeam: true })).toBe(
      NO_TEAM_MEMBER_ACTIONS,
    )
  })

  it("has actions when only removal is allowed, and none when neither is", () => {
    expect(teamMemberHasActions({ roles: [], canRemove: true })).toBe(true)
    expect(teamMemberHasActions({ roles: ["staff"], canRemove: false })).toBe(true)
    expect(teamMemberHasActions({ roles: [], canRemove: false })).toBe(false)
  })
})

describe("orderedTeamInvites edges", () => {
  it("orders pending invites newest first too", () => {
    const rows = orderedTeamInvites([
      invite("a", { createdAt: "2026-01-01T00:00:00.000Z" }),
      invite("b", { createdAt: "2026-02-01T00:00:00.000Z" }),
    ])
    expect(rows.map((row) => row.id)).toEqual(["b", "a"])
  })

  it("keeps the input order for identical timestamps and never mutates the input", () => {
    const input = [invite("a"), invite("b")]
    expect(orderedTeamInvites(input).map((row) => row.id)).toEqual(["a", "b"])
    expect(orderedTeamInvites(input)).not.toBe(input)
  })
})

describe("inviteDisplayName edges", () => {
  it("skips a whitespace-only account name and masked email", () => {
    const row = invite("a", {
      invitee: { id: "u", name: "   ", handle: "u", deleted: false },
      maskedEmail: "  ",
    } as Partial<EventTeamInviteDTO>)
    expect(inviteDisplayName(row, "fallback")).toBe("fallback")
  })

  it("trims the masked email it shows", () => {
    expect(inviteDisplayName(invite("a", { maskedEmail: "  a…@x.org " }), "f")).toBe("a…@x.org")
  })
})

describe("inviteIdentifierValue edges", () => {
  it("strips only one leading @", () => {
    expect(inviteIdentifierValue("handle", "@@ada_l")).toBeNull()
  })

  it("does not lowercase a handle", () => {
    expect(inviteIdentifierValue("handle", "Ada_L")).toBe("Ada_L")
  })

  it("accepts a handle at the three- and twenty-character bounds", () => {
    expect(inviteIdentifierValue("handle", "abc")).toBe("abc")
    expect(inviteIdentifierValue("handle", "a".repeat(20))).toBe("a".repeat(20))
  })
})

describe("inviteErrorKey edges", () => {
  it("falls back for an unrecognised code", () => {
    expect(inviteErrorKey("INTERNAL")).toBe("invite.error_generic")
    expect(inviteErrorKey("UNAUTHORIZED")).toBe("invite.error_generic")
  })
})

describe("teamDateLabel edges", () => {
  it("formats a medium date in the requested locale", () => {
    expect(teamDateLabel("2026-03-05T12:00:00.000Z", "en-US")).toBe("Mar 5, 2026")
  })

  it("is empty for an empty string", () => {
    expect(teamDateLabel("", "en-US")).toBe("")
  })
})
