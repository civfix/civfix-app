import { describe, expect, it } from "vitest"
import {
  CleanupMemberRoleSchema,
  HostCapabilitySchema,
  OrganizationMemberRoleSchema,
  type CleanupMemberRole,
  type HostCapability,
  type OrganizationMemberRole,
} from "../../schemas/common.js"
import { can, hostCapabilities, NO_HOST_STANDING, type HostStanding } from "../capabilities.js"

const EVENT_ROLES: (CleanupMemberRole | null)[] = [null, ...CleanupMemberRoleSchema.options]
const ORG_ROLES: (OrganizationMemberRole | null)[] = [null, ...OrganizationMemberRoleSchema.options]
const ALL_CAPABILITIES = HostCapabilitySchema.options

const ORG_ONLY: HostCapability[] = ["manage_payments", "view_donations", "manage_org_members"]
const NOT_COHOST: HostCapability[] = [
  "manage_team",
  "cancel_event",
  "manage_org_link",
  "request_resources",
]

const COORDINATOR: HostCapability[] = [
  "view_event_private",
  "view_roster",
  "view_answers",
  "view_analytics",
  "check_in",
  "broadcast",
  "moderate_chat",
]

const NOT_COORDINATOR: HostCapability[] = ALL_CAPABILITIES.filter(
  (cap) => !COORDINATOR.includes(cap),
)

function sorted(set: ReadonlySet<HostCapability>): HostCapability[] {
  return [...set].sort()
}

function expected(standing: HostStanding): HostCapability[] {
  const out = new Set<HostCapability>()
  const eventCaps = ALL_CAPABILITIES.filter((cap) => !ORG_ONLY.includes(cap))
  if (standing.eventRole === "organizer") for (const cap of eventCaps) out.add(cap)
  if (standing.eventRole === "cohost") {
    for (const cap of eventCaps) if (!NOT_COHOST.includes(cap)) out.add(cap)
  }
  if (standing.eventRole === "coordinator") for (const cap of COORDINATOR) out.add(cap)
  if (standing.eventRole === "staff") {
    out.add("view_event_private")
    out.add("view_roster")
    out.add("check_in")
  }
  if (standing.orgRole === "owner") {
    for (const cap of ALL_CAPABILITIES) out.add(cap)
  }
  if (standing.orgRole === "admin") {
    for (const cap of eventCaps) if (!NOT_COHOST.includes(cap) && cap !== "export") out.add(cap)
    out.add("view_donations")
    out.add("manage_org_members")
  }
  return [...out].sort()
}

describe("hostCapabilities", () => {
  it("covers the whole eventRole x orgRole matrix", () => {
    const combos = EVENT_ROLES.flatMap((eventRole) => ORG_ROLES.map((orgRole) => ({ eventRole, orgRole })))
    expect(combos).toHaveLength(EVENT_ROLES.length * ORG_ROLES.length)
    for (const standing of combos) {
      expect(sorted(hostCapabilities(standing))).toEqual(expected(standing))
    }
  })

  it("grants nothing to a non-member", () => {
    expect(hostCapabilities(NO_HOST_STANDING).size).toBe(0)
    expect(hostCapabilities({ eventRole: "member", orgRole: "member" }).size).toBe(0)
  })

  it("gives an organizer every capability except the org-only payment ones", () => {
    const caps = hostCapabilities({ eventRole: "organizer", orgRole: null })
    for (const cap of ALL_CAPABILITIES) {
      expect(caps.has(cap)).toBe(!ORG_ONLY.includes(cap))
    }
  })

  it("withholds team, cancel, org link and resource requests from a cohost", () => {
    const caps = hostCapabilities({ eventRole: "cohost", orgRole: null })
    for (const cap of NOT_COHOST) expect(caps.has(cap)).toBe(false)
    expect(caps.has("export")).toBe(true)
    expect(caps.has("view_analytics")).toBe(true)
    expect(caps.has("broadcast")).toBe(true)
  })

  it("seats a coordinator on exactly the seven day-of capabilities", () => {
    expect(sorted(hostCapabilities({ eventRole: "coordinator", orgRole: null }))).toEqual(
      [...COORDINATOR].sort(),
    )
  })

  it("never lets a coordinator read guest contact details, export or change the event", () => {
    const caps = hostCapabilities({ eventRole: "coordinator", orgRole: null })
    expect(NOT_COORDINATOR).toEqual(
      expect.arrayContaining([
        "view_guest_contact",
        "export",
        "manage_event",
        "manage_tickets",
        "manage_page",
        "manage_team",
        "cancel_event",
        "manage_org_link",
        "request_resources",
        "manage_payments",
        "view_donations",
      ]),
    )
    for (const cap of NOT_COORDINATOR) expect(caps.has(cap), cap).toBe(false)
  })

  it("sits a coordinator strictly between staff and cohost", () => {
    const staff = hostCapabilities({ eventRole: "staff", orgRole: null })
    const coordinator = hostCapabilities({ eventRole: "coordinator", orgRole: null })
    const cohost = hostCapabilities({ eventRole: "cohost", orgRole: null })
    for (const cap of staff) expect(coordinator.has(cap), cap).toBe(true)
    for (const cap of coordinator) expect(cohost.has(cap), cap).toBe(true)
    expect(coordinator.size).toBeGreaterThan(staff.size)
    expect(coordinator.size).toBeLessThan(cohost.size)
  })

  it("limits staff to roster and check-in", () => {
    expect(sorted(hostCapabilities({ eventRole: "staff", orgRole: null }))).toEqual(
      ["check_in", "view_event_private", "view_roster"].sort(),
    )
  })

  it("gives view_analytics to organizer, cohost, coordinator, org owner and org admin only", () => {
    const holders = EVENT_ROLES.flatMap((eventRole) =>
      ORG_ROLES.map((orgRole) => ({ eventRole, orgRole })),
    ).filter((standing) => can(standing, "view_analytics"))
    for (const standing of holders) {
      const viaEvent =
        standing.eventRole === "organizer" ||
        standing.eventRole === "cohost" ||
        standing.eventRole === "coordinator"
      const viaOrg = standing.orgRole === "owner" || standing.orgRole === "admin"
      expect(viaEvent || viaOrg).toBe(true)
    }
    expect(can({ eventRole: "staff", orgRole: null }, "view_analytics")).toBe(false)
    expect(can({ eventRole: "member", orgRole: "member" }, "view_analytics")).toBe(false)
  })

  it("gives manage_payments to the org owner only", () => {
    for (const eventRole of EVENT_ROLES) {
      expect(can({ eventRole, orgRole: "owner" }, "manage_payments")).toBe(true)
      expect(can({ eventRole, orgRole: "admin" }, "manage_payments")).toBe(false)
      expect(can({ eventRole, orgRole: "member" }, "manage_payments")).toBe(false)
      expect(can({ eventRole, orgRole: null }, "manage_payments")).toBe(false)
    }
  })

  it("gives view_donations to org owner and org admin only", () => {
    for (const eventRole of EVENT_ROLES) {
      expect(can({ eventRole, orgRole: "owner" }, "view_donations")).toBe(true)
      expect(can({ eventRole, orgRole: "admin" }, "view_donations")).toBe(true)
      expect(can({ eventRole, orgRole: "member" }, "view_donations")).toBe(false)
      expect(can({ eventRole, orgRole: null }, "view_donations")).toBe(false)
    }
  })

  it("withholds export, manage_team, cancel_event, manage_org_link, request_resources and manage_payments from an org admin", () => {
    const caps = hostCapabilities({ eventRole: null, orgRole: "admin" })
    const withheld = ["export", ...NOT_COHOST, "manage_payments"] as HostCapability[]
    for (const cap of withheld) {
      expect(caps.has(cap)).toBe(false)
    }
  })

  it("gives an org admin the org roster without the event team it could seat a cohost from", () => {
    const caps = hostCapabilities({ eventRole: null, orgRole: "admin" })
    expect(caps.has("manage_org_members")).toBe(true)
    expect(caps.has("manage_team")).toBe(false)
    expect(caps.has("export")).toBe(false)
    expect(hostCapabilities({ eventRole: null, orgRole: "owner" }).has("manage_org_members")).toBe(
      true,
    )
    expect(hostCapabilities({ eventRole: "organizer", orgRole: null }).has("manage_org_members")).toBe(
      false,
    )
  })

  it("adds org standing on top of event standing", () => {
    const staffOwner = hostCapabilities({ eventRole: "staff", orgRole: "owner" })
    const owner = hostCapabilities({ eventRole: null, orgRole: "owner" })
    expect(sorted(staffOwner)).toEqual(sorted(owner))
    const memberAdmin = hostCapabilities({ eventRole: "member", orgRole: "admin" })
    expect(memberAdmin.has("broadcast")).toBe(true)
  })

  it("memoizes one frozen set per combo", () => {
    const a = hostCapabilities({ eventRole: "organizer", orgRole: null })
    const b = hostCapabilities({ eventRole: "organizer", orgRole: null })
    expect(a).toBe(b)
    expect(Object.isFrozen(a)).toBe(true)
    expect(() => (a as Set<HostCapability>).add("broadcast")).toThrow(TypeError)
    expect(() => (a as Set<HostCapability>).delete("broadcast")).toThrow(TypeError)
    expect(() => (a as Set<HostCapability>).clear()).toThrow(TypeError)
  })

  it("treats an unknown role as no standing", () => {
    const standing = { eventRole: "wat", orgRole: null } as unknown as HostStanding
    expect(hostCapabilities(standing).size).toBe(0)
  })
})
