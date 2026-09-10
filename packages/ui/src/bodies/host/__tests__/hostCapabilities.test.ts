import { describe, expect, it } from "vitest"
import {
  actsAsHost,
  cleanupHostStanding,
  hasHostCapability,
  managesEvent,
} from "../../../data/hooks/host"

describe("hasHostCapability", () => {
  it("reads the server-computed set", () => {
    const staff = { myCapabilities: ["view_roster", "check_in"] as const, myRole: "staff" as const }
    expect(hasHostCapability(staff, "check_in")).toBe(true)
    expect(hasHostCapability(staff, "view_roster")).toBe(true)
    expect(hasHostCapability(staff, "view_guest_contact")).toBe(false)
    expect(hasHostCapability(staff, "manage_event")).toBe(false)
    expect(hasHostCapability(staff, "broadcast")).toBe(false)
  })

  it("grants an ORG owner host powers with no event role at all", () => {
    const owner = { myCapabilities: ["manage_event", "broadcast"] as const, myRole: null }
    expect(hasHostCapability(owner, "manage_event")).toBe(true)
    expect(actsAsHost(owner)).toBe(true)
  })

  it("gives a plain attendee nothing", () => {
    const member = { myCapabilities: [] as const, myRole: "member" as const }
    expect(hasHostCapability(member, "check_in")).toBe(false)
    expect(actsAsHost(member)).toBe(false)
  })

  it("falls back for an ORGANIZER when the server sent no capability set (rolling deploy)", () => {
    const legacy = { myCapabilities: [] as const, myRole: "organizer" as const }
    expect(hasHostCapability(legacy, "manage_event")).toBe(true)
    expect(actsAsHost(legacy)).toBe(true)
  })

  it("derives the WHOLE legacy set from the role, so every gate reads the same standing", () => {
    const legacyCohost = { myCapabilities: [] as const, myRole: "cohost" as const }
    expect(hasHostCapability(legacyCohost, "manage_event")).toBe(true)
    expect(hasHostCapability(legacyCohost, "view_roster")).toBe(true)
    expect(hasHostCapability(legacyCohost, "manage_team")).toBe(false)

    const legacyCoordinator = { myCapabilities: [] as const, myRole: "coordinator" as const }
    expect(hasHostCapability(legacyCoordinator, "view_roster")).toBe(true)
    expect(hasHostCapability(legacyCoordinator, "moderate_chat")).toBe(true)
    expect(hasHostCapability(legacyCoordinator, "manage_event")).toBe(false)
    expect(hasHostCapability(legacyCoordinator, "view_guest_contact")).toBe(false)
    expect(hasHostCapability(legacyCoordinator, "export")).toBe(false)

    const legacyStaff = { myCapabilities: [] as const, myRole: "staff" as const }
    expect(hasHostCapability(legacyStaff, "check_in")).toBe(true)
    expect(hasHostCapability(legacyStaff, "manage_event")).toBe(false)

    for (const capability of ["manage_event", "view_roster", "check_in"] as const) {
      expect(hasHostCapability({ myCapabilities: [], myRole: "member" }, capability)).toBe(false)
    }
  })

  it("keeps the dashboard row and the dashboard body in agreement for a legacy co-host", () => {
    const legacyCohost = { myCapabilities: [] as const, myRole: "cohost" as const }
    expect(managesEvent(legacyCohost)).toBe(true)
    expect(hasHostCapability(legacyCohost, "view_roster")).toBe(true)
  })

  it("does not apply the fallback once the server HAS sent a set (a demoted organizer loses powers)", () => {
    const demoted = { myCapabilities: ["view_roster"] as const, myRole: "organizer" as const }
    expect(hasHostCapability(demoted, "manage_event")).toBe(false)
  })

  it("is safe on a missing cleanup", () => {
    expect(hasHostCapability(null, "check_in")).toBe(false)
    expect(hasHostCapability(undefined, "check_in")).toBe(false)
    expect(actsAsHost(null)).toBe(false)
  })
})

describe("managesEvent", () => {
  it("reads the server's capability set, not the role string", () => {
    expect(managesEvent({ myCapabilities: ["manage_event"], myRole: null })).toBe(true)
    expect(managesEvent({ myCapabilities: ["check_in", "view_roster"], myRole: "staff" })).toBe(false)
  })

  it("does NOT re-grant a demoted organizer the manage affordances", () => {
    expect(managesEvent({ myCapabilities: ["view_roster"], myRole: "organizer" })).toBe(false)
    expect(managesEvent({ myCapabilities: ["view_roster"], myRole: "cohost" })).toBe(false)
  })

  it("admits the role string ONLY when the server sent no capabilities at all", () => {
    expect(managesEvent({ myCapabilities: [], myRole: "organizer" })).toBe(true)
    expect(managesEvent({ myCapabilities: [], myRole: "cohost" })).toBe(true)
    expect(managesEvent({ myCapabilities: [], myRole: "coordinator" })).toBe(false)
    expect(managesEvent({ myCapabilities: [], myRole: "staff" })).toBe(false)
    expect(managesEvent({ myCapabilities: [], myRole: "member" })).toBe(false)
    expect(managesEvent({ myCapabilities: [], myRole: null })).toBe(false)
  })

  it("is exactly hasHostCapability(manage_event) - one predicate, no second legacy rule", () => {
    for (const role of ["organizer", "cohost", "coordinator", "staff", "member", null] as const) {
      const standing = { myCapabilities: [] as const, myRole: role }
      expect(managesEvent(standing), String(role)).toBe(
        hasHostCapability(standing, "manage_event"),
      )
    }
  })

  it("is false without a cleanup", () => {
    expect(managesEvent(null)).toBe(false)
    expect(managesEvent(undefined)).toBe(false)
  })
})

describe("cleanupHostStanding", () => {
  const organizer = { id: "u-1" }

  it("keeps the server role when it sent one", () => {
    const standing = cleanupHostStanding(
      { myCapabilities: ["view_roster"], myRole: "coordinator", organizer },
      "u-9",
    )
    expect(standing).toEqual({ myCapabilities: ["view_roster"], myRole: "coordinator" })
  })

  it("falls back to organizer when the viewer IS the organizer and no role came back", () => {
    expect(cleanupHostStanding({ myCapabilities: [], organizer }, "u-1")).toEqual({
      myCapabilities: [],
      myRole: "organizer",
    })
  })

  it("leaves a stranger roleless", () => {
    expect(cleanupHostStanding({ myCapabilities: [], organizer }, "u-2")).toEqual({
      myCapabilities: [],
      myRole: null,
    })
    expect(cleanupHostStanding({ myCapabilities: [], organizer }, null)).toEqual({
      myCapabilities: [],
      myRole: null,
    })
  })

  it("is null without a cleanup, so every capability read stays false", () => {
    expect(cleanupHostStanding(null, "u-1")).toBeNull()
    expect(hasHostCapability(cleanupHostStanding(undefined, "u-1"), "view_roster")).toBe(false)
  })
})
