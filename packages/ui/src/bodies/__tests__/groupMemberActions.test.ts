/**
 * Exercised as a FULL matrix (every viewer role against every target role, plus the self-row override)
 * so a regression in any single cell fails a named case.
 */
import { describe, expect, it } from "vitest"
import { groupMemberActions } from "../groupMemberActions"

describe("groupMemberActions", () => {
  it("owner on an admin: demote + remove", () => {
    expect(groupMemberActions("owner", "admin", false)).toEqual(["remove-admin", "remove"])
  })

  it("owner on a member: promote + remove", () => {
    expect(groupMemberActions("owner", "member", false)).toEqual(["make-admin", "remove"])
  })

  it("admin on a member: remove only", () => {
    expect(groupMemberActions("admin", "member", false)).toEqual(["remove"])
  })

  it("admin on another admin: nothing (peers cannot manage peers)", () => {
    expect(groupMemberActions("admin", "admin", false)).toEqual([])
  })

  it("nobody can act on the owner's row", () => {
    expect(groupMemberActions("owner", "owner", false)).toEqual([])
    expect(groupMemberActions("admin", "owner", false)).toEqual([])
    expect(groupMemberActions("member", "owner", false)).toEqual([])
  })

  it("the viewer's own row offers nothing, whatever the roles", () => {
    expect(groupMemberActions("owner", "owner", true)).toEqual([])
    expect(groupMemberActions("owner", "member", true)).toEqual([])
    expect(groupMemberActions("admin", "admin", true)).toEqual([])
    expect(groupMemberActions("member", "member", true)).toEqual([])
  })

  it("a plain member manages nobody", () => {
    expect(groupMemberActions("member", "member", false)).toEqual([])
    expect(groupMemberActions("member", "admin", false)).toEqual([])
  })

  it("a non-member viewer (null/undefined role) manages nobody", () => {
    expect(groupMemberActions(null, "member", false)).toEqual([])
    expect(groupMemberActions(null, "admin", false)).toEqual([])
    expect(groupMemberActions(undefined, "member", false)).toEqual([])
  })
})
