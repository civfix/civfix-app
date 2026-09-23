import { describe, expect, it } from "vitest"
import { resolveChannelComposerMode, resolveGroupInfoGate } from "../channelComposerMode"

describe("resolveChannelComposerMode", () => {
  it("non-group rooms (dm/report/cleanup) always keep the composer", () => {
    expect(resolveChannelComposerMode({ isGroupRoom: false })).toBe("composer")
    expect(
      resolveChannelComposerMode({ isGroupRoom: false, groupKind: "channel", myRole: null }),
    ).toBe("composer")
  })

  it("a regular chat group keeps the composer for any member (and while its role loads)", () => {
    expect(resolveChannelComposerMode({ isGroupRoom: true, groupKind: "group", myRole: "member" })).toBe("composer")
    expect(resolveChannelComposerMode({ isGroupRoom: true, groupKind: "group", myRole: null })).toBe("composer")
  })

  it("a channel lets owner/admins compose", () => {
    expect(resolveChannelComposerMode({ isGroupRoom: true, groupKind: "channel", myRole: "owner" })).toBe("composer")
    expect(resolveChannelComposerMode({ isGroupRoom: true, groupKind: "channel", myRole: "admin" })).toBe("composer")
  })

  it("a channel subscriber (member) is read-only - the Mute pill", () => {
    expect(resolveChannelComposerMode({ isGroupRoom: true, groupKind: "channel", myRole: "member" })).toBe("mute-pill")
  })

  it("a signed-in non-member of a PUBLIC channel gets the Join pill", () => {
    expect(
      resolveChannelComposerMode({ isGroupRoom: true, groupKind: "channel", myRole: null, visibility: "public" }),
    ).toBe("join-pill")
    expect(
      resolveChannelComposerMode({ isGroupRoom: true, groupKind: "channel", visibility: "public" }),
    ).toBe("join-pill")
  })

  it("a non-member of a PRIVATE channel has no affordance", () => {
    expect(
      resolveChannelComposerMode({ isGroupRoom: true, groupKind: "channel", myRole: null, visibility: "private" }),
    ).toBe("none")
  })

  it("a group room whose kind has not loaded yet resolves to none (the body keeps the composer until then)", () => {
    expect(resolveChannelComposerMode({ isGroupRoom: true, myRole: null })).toBe("none")
  })
})

/**
 * The composer's group-info gate. The regression it guards: folding `isError` into the disable path
 * muted the composer for EVERY group room whose cold GET /groups/:id failed - members of ordinary
 * groups, who could post a moment earlier, got a silently dead input until a retry happened to succeed.
 */
describe("resolveGroupInfoGate", () => {
  const base = { isGroupRoom: true, hasGroupInfo: false, isLoading: false, isError: false }

  it("never gates dm / report / cleanup rooms", () => {
    expect(resolveGroupInfoGate({ ...base, isGroupRoom: false, isLoading: true })).toBe("open")
    expect(resolveGroupInfoGate({ ...base, isGroupRoom: false, isError: true })).toBe("open")
  })

  it("opens once the group DTO has landed", () => {
    expect(resolveGroupInfoGate({ ...base, hasGroupInfo: true, isLoading: true })).toBe("open")
    expect(resolveGroupInfoGate({ ...base, hasGroupInfo: true, isError: true })).toBe("open")
  })

  it("pauses silently while the cold fetch is in flight", () => {
    expect(resolveGroupInfoGate({ ...base, isLoading: true })).toBe("loading")
  })

  it("keeps a REGULAR group posting when the fetch fails - the inbox row already proved it is not a channel", () => {
    expect(resolveGroupInfoGate({ ...base, isError: true, cachedChannel: false })).toBe("open")
  })

  it("blocks a failed fetch that could still be a channel (unknown room, or a known channel)", () => {
    expect(resolveGroupInfoGate({ ...base, isError: true })).toBe("blocked")
    expect(resolveGroupInfoGate({ ...base, isError: true, cachedChannel: undefined })).toBe("blocked")
    expect(resolveGroupInfoGate({ ...base, isError: true, cachedChannel: true })).toBe("blocked")
  })

  it("opens when the query is simply idle (no room-kind uncertainty to resolve)", () => {
    expect(resolveGroupInfoGate(base)).toBe("open")
  })
})
