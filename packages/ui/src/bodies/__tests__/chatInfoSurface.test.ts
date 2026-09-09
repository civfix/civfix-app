import { describe, expect, it } from "vitest"
import {
  canLeaveChat,
  chatMemberCount,
  isChatInfoRoomKind,
} from "../chatInfoSurface"

describe("isChatInfoRoomKind", () => {
  it("covers report and event rooms - the two kinds MembersBody gives an info surface", () => {
    expect(isChatInfoRoomKind("report")).toBe(true)
    expect(isChatInfoRoomKind("cleanup")).toBe(true)
  })

  it("excludes group (it has GroupInfoBody) and dm (there is no room to describe)", () => {
    expect(isChatInfoRoomKind("group")).toBe(false)
    expect(isChatInfoRoomKind("dm")).toBe(false)
  })
})

describe("canLeaveChat", () => {
  it("offers leaving a report chat the viewer has joined", () => {
    expect(canLeaveChat("report", true)).toBe(true)
  })

  it("hides it when the viewer has not joined the report chat", () => {
    expect(canLeaveChat("report", false)).toBe(false)
  })

  it("hides it while chatJoined is still unknown, rather than offering an action that would 409", () => {
    expect(canLeaveChat("report", undefined)).toBe(false)
  })

  it("NEVER offers it on an event chat - leaving there would silently un-RSVP the viewer", () => {
    // This is the rule most likely to be 'helpfully' relaxed later; it is load-bearing.
    expect(canLeaveChat("cleanup", true)).toBe(false)
    expect(canLeaveChat("cleanup", undefined)).toBe(false)
  })

  it("never offers it on group or dm rooms either", () => {
    expect(canLeaveChat("group", true)).toBe(false)
    expect(canLeaveChat("dm", true)).toBe(false)
  })
})

describe("chatMemberCount", () => {
  it("prefers the roster endpoint's authoritative total", () => {
    expect(chatMemberCount(7, 3)).toBe(7)
  })

  it("falls back to the entity's cached count while the roster is still loading", () => {
    expect(chatMemberCount(undefined, 3)).toBe(3)
  })

  it("renders 0 rather than nothing when neither source has landed", () => {
    expect(chatMemberCount(undefined, undefined)).toBe(0)
  })

  it("keeps a real zero from the roster instead of falling through to a stale cached count", () => {
    // ?? not ||: a room that genuinely emptied must not resurrect the entity's older number.
    expect(chatMemberCount(0, 9)).toBe(0)
  })
})
