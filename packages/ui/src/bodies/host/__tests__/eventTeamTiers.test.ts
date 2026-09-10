import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { EventTeamRoleSchema, SetMemberRoleRequestSchema } from "@civfix/shared"
import {
  INVITABLE_EVENT_TEAM_ROLES,
  SETTABLE_EVENT_MEMBER_ROLES,
  eventRoleCapabilities,
  eventRoleLabelKey,
  eventTeamTiers,
  settableRolesOtherThan,
} from "../eventTeamTiers"

const catalog = (lng: string, ns: string): Record<string, Record<string, string>> =>
  JSON.parse(
    readFileSync(new URL(`../../../i18n/locales/${lng}/${ns}.json`, import.meta.url), "utf8"),
  )

describe("the invitable tiers", () => {
  it("reads most to least privileged, which is NOT the contract's append order", () => {
    expect(INVITABLE_EVENT_TEAM_ROLES).toEqual(["cohost", "coordinator", "staff"])
    expect([...INVITABLE_EVENT_TEAM_ROLES].sort()).toEqual([...EventTeamRoleSchema.options].sort())
  })

  it("carries a label and a hint key per tier, resolvable in all four catalogs", () => {
    for (const tier of eventTeamTiers()) {
      expect(tier.labelKey).toBe(`enums:cleanupMemberRole.${tier.role}`)
      expect(tier.hintKey).toBe(`host-team:role.hint_${tier.role}`)
      for (const lng of ["en", "es", "de", "ko"]) {
        expect(catalog(lng, "enums").cleanupMemberRole?.[tier.role], `${lng} ${tier.role}`).toBeTruthy()
        expect(catalog(lng, "host-team").role?.[`hint_${tier.role}`], `${lng} ${tier.role}`).toBeTruthy()
      }
    }
  })

  it("derives each tier's capabilities from the shared matrix, not a hand-typed list", () => {
    const coordinator = eventRoleCapabilities("coordinator")
    expect([...coordinator].sort()).toEqual(
      [
        "broadcast",
        "check_in",
        "moderate_chat",
        "view_analytics",
        "view_answers",
        "view_event_private",
        "view_roster",
      ].sort(),
    )
    expect(coordinator).not.toContain("view_guest_contact")
    expect(coordinator).not.toContain("export")
    expect(coordinator).not.toContain("manage_event")
  })

  it("names an enums key for any member role, seated tiers included", () => {
    expect(eventRoleLabelKey("organizer")).toBe("enums:cleanupMemberRole.organizer")
    expect(eventRoleLabelKey("member")).toBe("enums:cleanupMemberRole.member")
  })
})

describe("the settable roles on an existing member", () => {
  it("is the invitable set plus the demotion back to attendee", () => {
    expect(SETTABLE_EVENT_MEMBER_ROLES).toEqual(["cohost", "coordinator", "staff", "member"])
    expect([...SETTABLE_EVENT_MEMBER_ROLES].sort()).toEqual(
      [...EventTeamRoleSchema.options, "member"].sort(),
    )
    for (const role of SETTABLE_EVENT_MEMBER_ROLES) {
      expect(
        SetMemberRoleRequestSchema.safeParse({
          id: "11111111-1111-4111-8111-111111111111",
          userId: "22222222-2222-4222-8222-222222222222",
          role,
        }).success,
      ).toBe(true)
    }
  })

  it("never offers the role a person already holds", () => {
    expect(settableRolesOtherThan("coordinator")).toEqual(["cohost", "staff", "member"])
    expect(settableRolesOtherThan("member")).toEqual(["cohost", "coordinator", "staff"])
  })

  it("offers everything to a person with no seated role yet", () => {
    expect(settableRolesOtherThan(null)).toEqual(SETTABLE_EVENT_MEMBER_ROLES)
    expect(settableRolesOtherThan(undefined)).toEqual(SETTABLE_EVENT_MEMBER_ROLES)
  })

  it("never offers organizer - the seat is immutable", () => {
    expect(settableRolesOtherThan("organizer")).not.toContain("organizer")
  })
})
