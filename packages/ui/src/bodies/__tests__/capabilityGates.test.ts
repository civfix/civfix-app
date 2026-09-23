import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const detail = strip(read("../EventDetailBody.tsx"))
const edit = strip(read("../EditCleanupBody.tsx"))
const conversation = strip(read("../ConversationBody.tsx"))
const members = strip(read("../MembersBody.tsx"))
const powers = strip(read("../chatPowers.ts"))
const hooks = strip(read("../../data/hooks/host.ts"))

describe("one legacy-role predicate, shared by every host gate", () => {
  it("derives the fallback from the shared capability matrix instead of naming roles", () => {
    expect(hooks).toContain('import { hostCapabilities } from "@civfix/shared/host"')
    expect(hooks).toContain(
      "return hostCapabilities({ eventRole: cleanup.myRole ?? null, orgRole: null })",
    )
  })

  it("leaves managesEvent with no second legacy rule to drift from", () => {
    expect(hooks).toMatch(
      /export function managesEvent\([^)]*\): boolean \{\s*return hasHostCapability\(cleanup, "manage_event"\)\s*\}/,
    )
    expect(hooks).not.toContain('cleanup.myRole === "organizer" || cleanup.myRole === "cohost"')
  })

  it("builds the standing once, from the DTO plus the viewer, everywhere it is needed", () => {
    expect(hooks).toContain("export function cleanupHostStanding(")
    for (const [name, src] of [
      ["EventDetailBody", detail],
      ["EditCleanupBody", edit],
      ["ConversationBody", conversation],
      ["MembersBody", members],
    ] as const) {
      expect(src, `${name} rebuilds the standing by hand`).toContain("cleanupHostStanding(")
    }
  })
})

describe("the host gates read capabilities, not role strings", () => {
  it("EditCleanupBody admits whoever may manage the event", () => {
    expect(edit).toContain(
      "const isHost = managesEvent(cleanupHostStanding(query.data, user?.id ?? null))",
    )
    expect(edit).not.toContain('myRole === "organizer" || myRole === "cohost"')
  })

  it("chat moderation is `moderate_chat`, not the organizer's user id", () => {
    expect(powers).toContain("canModerateCleanupChat: boolean")
    expect(powers).not.toContain("isCleanupOrganizer")
    expect(conversation).toContain(
      'hasHostCapability(cleanupHostStanding(cleanup.data, viewerId), "moderate_chat")',
    )
    expect(conversation).not.toContain("cleanup.data?.organizer.id === viewerId")
  })

  it("MembersBody gates role changes on manage_team and removal on manage_event", () => {
    expect(members).toContain('hasHostCapability(viewerStanding, "manage_team")')
    expect(members).toContain('hasHostCapability(viewerStanding, "manage_event")')
    expect(members).toContain("const canSetRole = manageable && viewerManagesTeam")
    expect(members).toContain(
      "manageable && (viewerManagesTeam || (viewerManagesEvent && targetRole === \"member\"))",
    )
    expect(members).not.toContain('viewerRole === "organizer"')
    expect(members).not.toContain('viewerRole === "cohost"')
  })

  it("MembersBody offers every settable tier from the shared list, not a cohost toggle", () => {
    expect(members).toContain("settableRolesOtherThan(targetRole).map((role) => ({")
    expect(members).toContain("t(\"manage.make_role\", { role: tEnums(`cleanupMemberRole.${role}`) })")
    expect(members).not.toContain("manage.makeCohost")
    expect(members).not.toContain("manage.removeCohost")
  })

  it("EventDetailBody's organizer-only actions stay organizer-only", () => {
    expect(detail).toContain('const isOrganizer = myRole === "organizer"')
  })
})

describe("the invite inbox mutations", () => {
  it("invalidate the inbox, the hosted list and the notification feed together", () => {
    expect(hooks).toContain("export function invalidateMyEventInvites(qc: QueryClient): void {")
    for (const key of ["myEventInvites", "hostedEventsRoot", "notificationsRoot"]) {
      expect(hooks, `invalidateMyEventInvites misses ${key}`).toMatch(
        new RegExp(`queryKeys\\.${key}`),
      )
    }
  })

  it("also refresh the accepted event's own detail, from the response's event id", () => {
    expect(hooks).toContain("invalidateHostEvent(qc, res.event.id)")
  })
})
