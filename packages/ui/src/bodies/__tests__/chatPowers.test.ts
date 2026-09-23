/**
 * These flags only gate the UI (the server matrix stays authoritative and re-checks every request), so
 * the suite exercises the FULL client mirror.
 */
import { describe, expect, it } from "vitest"
import { canPinIn, canDeleteOthersIn, type ChatPowerSignals } from "../chatPowers"

function signals(overrides: Partial<ChatPowerSignals> = {}): ChatPowerSignals {
  return {
    roomKind: "cleanup",
    isDmParticipant: false,
    canModerateCleanupChat: false,
    isReportChatOwner: false,
    isOperator: false,
    ...overrides,
  }
}

describe("canPinIn", () => {
  it("dm: any participant may pin", () => {
    expect(canPinIn(signals({ roomKind: "dm", isDmParticipant: true }))).toBe(true)
  })

  it("dm: a non-participant may not (defensive - the room would not render)", () => {
    expect(canPinIn(signals({ roomKind: "dm" }))).toBe(false)
  })

  it("cleanup: the organizer may pin", () => {
    expect(canPinIn(signals({ roomKind: "cleanup", canModerateCleanupChat: true }))).toBe(true)
  })

  it("cleanup: an ordinary member may not", () => {
    expect(canPinIn(signals({ roomKind: "cleanup" }))).toBe(false)
  })

  it("cleanup: operator status alone grants nothing in a cleanup room", () => {
    expect(canPinIn(signals({ roomKind: "cleanup", isOperator: true }))).toBe(false)
  })

  it("report: the report-chat owner may pin", () => {
    expect(canPinIn(signals({ roomKind: "report", isReportChatOwner: true }))).toBe(true)
  })

  it("report: an operator may pin", () => {
    expect(canPinIn(signals({ roomKind: "report", isOperator: true }))).toBe(true)
  })

  it("report: an ordinary member may not", () => {
    expect(canPinIn(signals({ roomKind: "report" }))).toBe(false)
  })

  it("group: the owner and admins may pin", () => {
    expect(canPinIn(signals({ roomKind: "group", myGroupRole: "owner" }))).toBe(true)
    expect(canPinIn(signals({ roomKind: "group", myGroupRole: "admin" }))).toBe(true)
  })

  it("group: an ordinary member may not, nor a non-member / unknown role", () => {
    expect(canPinIn(signals({ roomKind: "group", myGroupRole: "member" }))).toBe(false)
    expect(canPinIn(signals({ roomKind: "group", myGroupRole: null }))).toBe(false)
    expect(canPinIn(signals({ roomKind: "group" }))).toBe(false)
  })

  it("group: platform operator status alone grants nothing (role-driven, not operator-driven)", () => {
    expect(canPinIn(signals({ roomKind: "group", isOperator: true }))).toBe(false)
  })
})

describe("canDeleteOthersIn", () => {
  it("dm: never - even for a participant or an operator", () => {
    expect(canDeleteOthersIn(signals({ roomKind: "dm", isDmParticipant: true }))).toBe(false)
    expect(
      canDeleteOthersIn(signals({ roomKind: "dm", isDmParticipant: true, isOperator: true })),
    ).toBe(false)
  })

  it("cleanup: the organizer may delete others' messages", () => {
    expect(canDeleteOthersIn(signals({ roomKind: "cleanup", canModerateCleanupChat: true }))).toBe(true)
  })

  it("cleanup: an ordinary member may not", () => {
    expect(canDeleteOthersIn(signals({ roomKind: "cleanup" }))).toBe(false)
  })

  it("report: an operator may delete others' messages", () => {
    expect(canDeleteOthersIn(signals({ roomKind: "report", isOperator: true }))).toBe(true)
  })

  it("report: the report OWNER may NOT (pin power without moderator delete)", () => {
    expect(canDeleteOthersIn(signals({ roomKind: "report", isReportChatOwner: true }))).toBe(false)
  })

  it("report: an ordinary member may not", () => {
    expect(canDeleteOthersIn(signals({ roomKind: "report" }))).toBe(false)
  })

  it("group: the owner and admins may delete others' messages", () => {
    expect(canDeleteOthersIn(signals({ roomKind: "group", myGroupRole: "owner" }))).toBe(true)
    expect(canDeleteOthersIn(signals({ roomKind: "group", myGroupRole: "admin" }))).toBe(true)
  })

  it("group: an ordinary member / non-member / operator may not", () => {
    expect(canDeleteOthersIn(signals({ roomKind: "group", myGroupRole: "member" }))).toBe(false)
    expect(canDeleteOthersIn(signals({ roomKind: "group", myGroupRole: null }))).toBe(false)
    expect(canDeleteOthersIn(signals({ roomKind: "group", isOperator: true }))).toBe(false)
  })
})
