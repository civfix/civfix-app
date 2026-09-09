import { describe, expect, it } from "vitest"
import type { OrganizationInviteDTO } from "@civfix/shared"

import { daysUntil, inviteIsExpired, visibleInvites } from "./org-invites"

const NOW = Date.parse("2026-09-08T12:00:00.000Z")

function invite(over: Partial<OrganizationInviteDTO> = {}): OrganizationInviteDTO {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    organizationId: "11111111-1111-4111-8111-111111111111",
    email: "rosa@example.org",
    user: null,
    role: "member",
    status: "pending",
    invitedBy: null,
    createdAt: "2026-09-08T00:00:00.000Z",
    expiresAt: "2026-09-22T00:00:00.000Z",
    ...over,
  }
}

describe("daysUntil", () => {
  it("rounds up so a still-valid invite never reads as 0 days", () => {
    expect(daysUntil("2026-09-08T12:00:01.000Z", NOW)).toBe(1)
    expect(daysUntil("2026-09-09T12:00:00.000Z", NOW)).toBe(1)
    expect(daysUntil("2026-09-22T00:00:00.000Z", NOW)).toBe(14)
  })

  it("is zero or negative once the moment has passed, and zero for garbage", () => {
    expect(daysUntil("2026-09-08T12:00:00.000Z", NOW)).toBe(0)
    expect(daysUntil("2026-09-01T12:00:00.000Z", NOW)).toBe(-7)
    expect(daysUntil("not a date", NOW)).toBe(0)
  })
})

describe("inviteIsExpired", () => {
  it("trusts the server status and also catches an unswept past expiresAt", () => {
    expect(inviteIsExpired(invite(), NOW)).toBe(false)
    expect(inviteIsExpired(invite({ status: "expired" }), NOW)).toBe(true)
    expect(inviteIsExpired(invite({ expiresAt: "2026-09-08T11:59:59.000Z" }), NOW)).toBe(true)
  })
})

describe("visibleInvites", () => {
  it("keeps pending and expired rows and drops history", () => {
    const rows = [
      invite({ id: "a", status: "pending" }),
      invite({ id: "b", status: "expired" }),
      invite({ id: "c", status: "accepted" }),
      invite({ id: "d", status: "revoked" }),
    ]
    expect(visibleInvites(rows).map((row) => row.id)).toEqual(["a", "b"])
  })
})
