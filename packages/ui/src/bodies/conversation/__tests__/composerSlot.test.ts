import { describe, expect, it } from "vitest"
import { resolveComposerSlot, type ComposerSlotSignals } from "../composerSlot"

function signals(overrides: Partial<ComposerSlotSignals> = {}): ComposerSlotSignals {
  return {
    roomKind: "report",
    channelMode: "composer",
    hasGroupInfo: false,
    groupInfoGate: "open",
    hasRoomError: false,
    showJoinBanner: false,
    isReport: true,
    isGroup: true,
    pinnedOnly: false,
    hasCityMention: true,
    ...overrides,
  }
}

describe("resolveComposerSlot", () => {
  it("keeps the normal composer for a group room until its info loads", () => {
    const slot = resolveComposerSlot(signals({ roomKind: "group", channelMode: "none", isReport: false }))
    expect(slot.mode).toBe("composer")
    expect(resolveComposerSlot(signals({ roomKind: "group", channelMode: "mute-pill", hasGroupInfo: true })).mode).toBe(
      "mute-pill",
    )
  })

  it("offers polls everywhere but DMs, and only in composer mode", () => {
    expect(resolveComposerSlot(signals()).canCreatePoll).toBe(true)
    expect(resolveComposerSlot(signals({ roomKind: "dm", isReport: false, isGroup: false })).canCreatePoll).toBe(false)
    expect(
      resolveComposerSlot(signals({ roomKind: "group", channelMode: "join-pill", hasGroupInfo: true })).canCreatePoll,
    ).toBe(false)
  })

  it("disables the composer on a room error, the join banner, or an unresolved group gate", () => {
    expect(resolveComposerSlot(signals()).disabled).toBe(false)
    expect(resolveComposerSlot(signals({ hasRoomError: true })).disabled).toBe(true)
    expect(resolveComposerSlot(signals({ showJoinBanner: true })).disabled).toBe(true)
    expect(resolveComposerSlot(signals({ groupInfoGate: "loading" })).disabled).toBe(true)
    expect(resolveComposerSlot(signals({ groupInfoGate: "blocked" })).disabled).toBe(true)
  })

  it("shows the forward notice only on a live, enabled report composer with a city to mention", () => {
    expect(resolveComposerSlot(signals()).showForwardNotice).toBe(true)
    expect(resolveComposerSlot(signals({ isReport: false })).showForwardNotice).toBe(false)
    expect(resolveComposerSlot(signals({ pinnedOnly: true })).showForwardNotice).toBe(false)
    expect(resolveComposerSlot(signals({ hasRoomError: true })).showForwardNotice).toBe(false)
    expect(resolveComposerSlot(signals({ hasCityMention: false })).showForwardNotice).toBe(false)
  })

  it("picks the placeholder: unavailable on an error or a blocked gate, else by room shape", () => {
    expect(resolveComposerSlot(signals({ hasRoomError: true })).placeholder).toBe("unavailable")
    expect(resolveComposerSlot(signals({ groupInfoGate: "blocked" })).placeholder).toBe("unavailable")
    expect(resolveComposerSlot(signals({ groupInfoGate: "loading" })).placeholder).toBe("group")
    expect(resolveComposerSlot(signals({ isGroup: false })).placeholder).toBe("dm")
  })
})
