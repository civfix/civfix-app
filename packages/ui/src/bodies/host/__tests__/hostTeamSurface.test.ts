import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const mode = strip(read("../HostModeBody.tsx"))
const body = strip(read("../HostTeamBody.tsx"))
const sheet = strip(read("../HostTeamInviteSheet.tsx"))
const members = strip(read("../../MembersBody.tsx"))
const detail = strip(read("../../EventDetailBody.tsx"))

describe("host mode reaches the team", () => {
  it("gates the Team row on manage_team, not on a role string", () => {
    expect(mode).toContain('const canManageTeam = hasHostCapability(standing, "manage_team")')
    expect(mode).toMatch(/\{canManageTeam \? \(\s*<EventActionRow/)
    expect(mode).not.toMatch(/myRole === "(organizer|cohost)"/)
  })

  it("builds the standing once from the DTO plus the viewer, so a legacy organizer still passes", () => {
    expect(mode).toContain("const standing = cleanupHostStanding(cleanup.data, viewerId)")
    expect(mode).not.toContain('hasHostCapability(cleanup.data, "check_in")')
  })

  it("pushes the addressable team entry rather than opening a sheet in place", () => {
    expect(mode).toContain('useNavStore.getState().push({ kind: "host-team", id })')
  })

  it("leaves the event detail page's own host rows alone - it is not a mirror of host mode", () => {
    expect(detail).not.toContain('kind: "host-team"')
    expect(detail).toContain("openHostDashboard({ eventId: cleanup.id, openExternal })")
  })
})

describe("HostTeamBody wiring", () => {
  it("gates the whole screen on manage_team with the same standing helper", () => {
    expect(body).toContain("const standing = cleanupHostStanding(cleanup.data, viewerId)")
    expect(body).toContain('const canManageTeam = hasHostCapability(standing, "manage_team")')
    expect(body).toContain("if (!canManageTeam) {")
    expect(body).toContain('icon="Lock"')
  })

  it("only asks the server for the team once the viewer may manage it", () => {
    expect(body).toContain("useHostTeam(id, { enabled: canManageTeam })")
  })

  it("wires all four team mutations through the shared hooks", () => {
    for (const hook of [
      "useSetMemberRole()",
      "useRemoveMember()",
      "useRevokeEventTeamInvite(id)",
    ]) {
      expect(body, `HostTeamBody misses ${hook}`).toContain(hook)
    }
    expect(sheet).toContain("useInviteEventTeamMember(cleanupId)")
    expect(body).toContain("<HostTeamInviteSheet")
  })

  it("routes every mutation failure through the shared error-code mapping", () => {
    expect(body).toContain("t(teamManageErrorKey(appErrorCode(err)))")
    expect(sheet).toContain("t(inviteErrorKey(appErrorCode(err)))")
  })

  it("orders and gates the rows in the pure model, not inline in the view", () => {
    expect(body).toContain("orderedTeamMembers(team.data?.members ?? [])")
    expect(body).toContain("orderedTeamInvites(team.data?.invites ?? [])")
    expect(body).toContain("teamMemberActions({ member, viewerId, canManageTeam })")
    expect(body).not.toMatch(/\.sort\(/)
  })

  it("covers loading, error and empty for the team query", () => {
    expect(body).toContain("team.isLoading ? (")
    expect(body).toContain("team.isError ? (")
    expect(body).toContain("members.length === 0 ? (")
  })

  it("stops the invite CTA at the contract's per-event cap", () => {
    expect(body).toContain("inviteQuotaReached(team.data?.invites ?? [])")
    expect(body).toContain("disabled={quotaReached}")
    expect(body).toContain('t("invite.limit_reached")')
  })

  it("reuses the roster row, its kebab and the extracted chip instead of a second copy", () => {
    expect(body).toContain("<RosterRow")
    expect(body).toContain("<RoleChip")
    expect(members).toContain("<RoleChip")
    expect(members).not.toContain("styles.roleChip")
  })
})

describe("the invite sheet", () => {
  it("draws its tiers from the shared helper, hint included", () => {
    expect(sheet).toContain("const tiers = eventTeamTiers()")
    expect(sheet).toContain("t(tier.labelKey)")
    expect(sheet).toContain("t(tier.hintKey)")
    expect(sheet).not.toContain('"cohost", "coordinator", "staff"')
  })

  it("validates the identifier client-side before it ever reaches the wire", () => {
    expect(sheet).toContain("inviteIdentifierValue(identifierKind, identifier)")
    expect(sheet).toContain("t(inviteIdentifierErrorKey(identifierKind))")
    expect(sheet).toContain("{ identifierKind, identifier: value, role }")
  })

  it("rides the existing modal sheet's keyboard handling rather than adding a second one", () => {
    expect(sheet).toContain("<ModalCardSheet")
    expect(sheet).not.toContain("KeyboardAvoidingView")
    expect(sheet).not.toContain("useKeyboardInset")
  })

  it("offers both identifier kinds as one accessible radio group", () => {
    expect(sheet).toContain('accessibilityRole="radiogroup"')
    expect(sheet).toContain('const IDENTIFIER_KINDS: readonly EventTeamInviteIdentifierKind[] = ["handle", "email"]')
  })
})
