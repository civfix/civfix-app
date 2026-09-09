import { describe, expect, it } from "vitest"
import { canReactIn, canReplyIn, canVoteIn, type LiveGateSignals } from "../conversation/liveGates"

const live: LiveGateSignals = {
  liveDisabled: false,
  composerDisabled: false,
  composerSlotMode: "composer",
  pinnedOnly: false,
}

describe("canVoteIn", () => {
  it("tracks canReactIn exactly - a live interaction, never the composer", () => {
    const cases: LiveGateSignals[] = [
      live,
      { ...live, liveDisabled: true },
      { ...live, composerDisabled: true },
      { ...live, composerSlotMode: "mute-pill" },
      { ...live, composerSlotMode: "join-pill" },
      { ...live, composerSlotMode: "none" },
      { ...live, pinnedOnly: true },
    ]
    for (const signals of cases) {
      expect(canVoteIn(signals)).toBe(canReactIn(signals))
    }
  })

  it("a read-only channel subscriber can vote (they cannot post or reply)", () => {
    const subscriber: LiveGateSignals = { ...live, composerSlotMode: "mute-pill" }
    expect(canVoteIn(subscriber)).toBe(true)
    expect(canReplyIn(subscriber)).toBe(false)
  })

  it("a report-chat reader who has not joined yet can vote (the join banner gates the COMPOSER)", () => {
    const preJoin: LiveGateSignals = { ...live, composerDisabled: true }
    expect(canVoteIn(preJoin)).toBe(true)
    expect(canReplyIn(preJoin)).toBe(false)
  })

  it("signed-out / live-disabled rooms vote no more than they react", () => {
    expect(canVoteIn({ ...live, liveDisabled: true })).toBe(false)
    expect(canReactIn({ ...live, liveDisabled: true })).toBe(false)
  })

  it("the pinned-messages variant is read-only in every direction", () => {
    const pinned: LiveGateSignals = { ...live, pinnedOnly: true }
    expect(canVoteIn(pinned)).toBe(false)
    expect(canReactIn(pinned)).toBe(false)
    expect(canReplyIn(pinned)).toBe(false)
  })
})

describe("canReplyIn", () => {
  it("needs a live room AND an available composer slot", () => {
    expect(canReplyIn(live)).toBe(true)
    expect(canReplyIn({ ...live, liveDisabled: true })).toBe(false)
    expect(canReplyIn({ ...live, composerDisabled: true })).toBe(false)
    expect(canReplyIn({ ...live, composerSlotMode: "none" })).toBe(false)
  })
})
