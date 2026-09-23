import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { cleanupHostStanding, hasHostCapability, managesEvent } from "../../../data/hooks/host"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const read = (rel: string): string => code(readFileSync(new URL(rel, import.meta.url), "utf8"))

const ORGANIZER = "user-organizer"

const legacyOrganizerEvent = {
  myCapabilities: [],
  myRole: null,
  organizer: { id: ORGANIZER },
}

describe("a legacy organizer (no role, no capabilities on the DTO)", () => {
  it("only passes a capability check once the standing adds the organizer fallback", () => {
    expect(hasHostCapability(legacyOrganizerEvent, "check_in")).toBe(false)
    expect(hasHostCapability(cleanupHostStanding(legacyOrganizerEvent, ORGANIZER), "check_in")).toBe(
      true,
    )
    expect(managesEvent(cleanupHostStanding(legacyOrganizerEvent, ORGANIZER))).toBe(true)
  })

  it("gives a stranger nothing through the same fallback", () => {
    expect(hasHostCapability(cleanupHostStanding(legacyOrganizerEvent, "someone-else"), "check_in")).toBe(
      false,
    )
  })
})

describe("every host screen gates on the same standing host mode uses", () => {
  it.each([
    ["HostCheckinBody.tsx", '"check_in"'],
    ["HostAnnounceBody.tsx", '"broadcast"'],
    ["EventAnalyticsBody.tsx", '"view_analytics"'],
    ["AnnouncementsBody.tsx", '"broadcast"'],
  ])("%s", (file, capability) => {
    const src = read(`../${file}`)
    expect(src).toContain("const viewerId = useAuthState().user?.id ?? null")
    expect(src).toContain(`hasHostCapability(cleanupHostStanding(cleanup.data, viewerId), ${capability})`)
    expect(src).not.toContain("hasHostCapability(cleanup.data,")
  })

  it("HostLogHoursBody", () => {
    const src = read("../HostLogHoursBody.tsx")
    expect(src).toContain("managesEvent(cleanupHostStanding(event, viewerId))")
    expect(src).not.toContain("managesEvent(event)")
  })
})

describe("the log hours screen", () => {
  it("never asks for the hours of an event the viewer does not manage, so a 403 cannot beat the denied state", () => {
    const src = read("../HostLogHoursBody.tsx")
    expect(src).toContain("useEventHours(manages ? id : undefined)")
    expect(src).not.toContain("useEventHours(id)")
    const hook = read("../../../data/hooks/volunteer.ts")
    expect(hook).toContain("enabled: isAuthenticated && !!cleanupId,")
  })
})

describe("host mode's action switch", () => {
  it("names the cancel action instead of routing every unknown key to it", () => {
    const src = read("../HostModeBody.tsx")
    expect(src).toContain('case "cancel":\n          return () => setCancelling(true)')
    const actionFor = src.slice(src.indexOf("const actionFor = useCallback("))
    expect(actionFor.slice(0, actionFor.indexOf("[onAnnounce,"))).not.toContain("default:")
  })
})
