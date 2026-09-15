import { describe, expect, it } from "vitest"
import { chatInfoRosterView } from "../chatInfoVisibility"

const member = {
  roomKind: "cleanup",
  scope: "all" as const,
  going: 16,
  shown: 16,
  participant: true,
}

const nonMember = {
  roomKind: "cleanup",
  scope: "following" as const,
  going: 16,
  shown: 1,
  participant: false,
}

describe("chatInfoRosterView access", () => {
  it("gives a member the full roster, so the hero shows the plain member count", () => {
    expect(chatInfoRosterView(member).access).toBe("full")
  })

  it("marks a non-member's roster followed-only, so the hero must show shown-of-going", () => {
    const view = chatInfoRosterView(nonMember)
    expect(view.access).toBe("followed-only")
    expect(view.shown).toBe(1)
    expect(view.going).toBe(16)
  })

  it("stays full while the roster is still in flight rather than flashing a gated hero", () => {
    expect(chatInfoRosterView({ ...nonMember, scope: undefined, shown: 0 }).access).toBe("full")
  })

  it("stays full when the followed subset already IS everyone going - nothing is hidden", () => {
    expect(chatInfoRosterView({ ...nonMember, going: 2, shown: 2 }).access).toBe("full")
  })

  it("stays full on an event nobody has joined, so the empty state reads 'no members yet'", () => {
    expect(chatInfoRosterView({ ...nonMember, going: 0, shown: 0 }).access).toBe("full")
  })

  it("gates an anonymous viewer exactly like a signed-out non-member", () => {
    expect(chatInfoRosterView({ ...nonMember, shown: 0, participant: undefined }).access).toBe(
      "followed-only",
    )
  })

  it("never gates a report room - its roster carries no scope", () => {
    expect(
      chatInfoRosterView({
        roomKind: "report",
        scope: undefined,
        going: 12,
        shown: 3,
        participant: false,
      }).access,
    ).toBe("full")
  })
})

describe("chatInfoRosterView restricted notice", () => {
  it("explains the gap above a partial list", () => {
    expect(chatInfoRosterView(nonMember).showRestrictedNotice).toBe(true)
  })

  it("stays hidden when the list is empty - the empty state carries the explanation instead", () => {
    expect(chatInfoRosterView({ ...nonMember, shown: 0 }).showRestrictedNotice).toBe(false)
  })

  it("stays hidden for a member, who is seeing everyone", () => {
    expect(chatInfoRosterView(member).showRestrictedNotice).toBe(false)
  })
})

describe("chatInfoRosterView canMute", () => {
  it("offers mute to an event participant", () => {
    expect(chatInfoRosterView(member).canMute).toBe(true)
  })

  it("hides mute from a non-participant, whose mute call the server forbids", () => {
    expect(chatInfoRosterView(nonMember).canMute).toBe(false)
  })

  it("hides mute while participation is still unknown, rather than offering a call that would 403", () => {
    expect(chatInfoRosterView({ ...member, participant: undefined }).canMute).toBe(false)
  })

  it("keeps mute on a report room, whose chat has its own join model", () => {
    expect(
      chatInfoRosterView({
        roomKind: "report",
        scope: undefined,
        going: 12,
        shown: 12,
        participant: false,
      }).canMute,
    ).toBe(true)
  })
})
