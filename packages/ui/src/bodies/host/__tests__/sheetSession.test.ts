import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const read = (rel: string): string => code(readFileSync(new URL(rel, import.meta.url), "utf8"))

const duplicate = read("../dashboard/DuplicateEventSheet.tsx")
const orgInvite = read("../dashboard/OrgInviteSheet.tsx")
const teamInvite = read("../HostTeamInviteSheet.tsx")
const walkup = read("../HostWalkupSheet.tsx")
const linked = read("../LinkedReportsSheet.tsx")

describe("the duplicate sheet seeds once per open, not once per parent render", () => {
  it("keys the seed on the event id, so a rebuilt DTO for the same event changes nothing", () => {
    expect(duplicate).toContain("const eventId = event?.id ?? null")
    expect(duplicate).toContain("if (eventId !== seededFor) {")
    expect(duplicate).not.toContain("}, [event])")
    expect(duplicate).not.toContain("useEffect(")
  })

  it("never resets the mutation while a duplicate is in flight", () => {
    expect(duplicate).toContain("if (!duplicate.isPending) duplicate.reset()")
    expect(duplicate.match(/duplicate\.reset\(\)/g) ?? []).toHaveLength(1)
    expect(duplicate).toContain("onClosed={onClosed}")
  })
})

describe("form sheets clear themselves after the close animation, not on open", () => {
  it.each([
    ["OrgInviteSheet", orgInvite, "invite"],
    ["HostTeamInviteSheet", teamInvite, "invite"],
    ["HostWalkupSheet", walkup, "walkup"],
  ])("%s resets in onClosed and leaves an in-flight mutation alone", (_name, src, mutation) => {
    expect(src).not.toContain("useEffect(")
    expect(src).not.toContain("}, [visible])")
    expect(src).toContain("onClosed={onClosed}")
    expect(src).toContain(`if (!${mutation}.isPending) ${mutation}.reset()`)
  })
})

describe("the linked-reports sheet", () => {
  it("re-seeds the card cache when the event's links change while it is open", () => {
    expect(linked).toContain("}, [visible, cleanup.linkedReports])")
    expect(linked).not.toContain("}, [visible])")
  })

  it("clears a stale error on each open", () => {
    expect(linked).toContain("if (visible !== shown) {")
    expect(linked).toContain("if (visible) setErrorText(null)")
  })
})
