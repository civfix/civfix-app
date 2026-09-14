import { describe, expect, it } from "vitest"
import { slotPeopleView } from "../slotPeopleVisibility"

describe("who a viewer sees inside an expanded slot row", () => {
  it("gives a member the full list, with nothing hidden", () => {
    expect(slotPeopleView({ scope: "all", claimed: 3, shown: 3 })).toEqual({
      access: "full",
      shown: 3,
      claimed: 3,
      hidden: 0,
      showGate: false,
    })
  })

  it("gates a non-member whose roster came back short, and says how many are missing", () => {
    const view = slotPeopleView({ scope: "following", claimed: 7, shown: 2 })
    expect(view.access).toBe("followed-only")
    expect(view.hidden).toBe(5)
    expect(view.showGate).toBe(true)
  })

  it("still gates when the non-member follows NOBODY in the slot", () => {
    const view = slotPeopleView({ scope: "following", claimed: 4, shown: 0 })
    expect(view.showGate).toBe(true)
    expect(view.hidden).toBe(4)
  })

  it("does not gate a non-member who can already see everyone", () => {
    const view = slotPeopleView({ scope: "following", claimed: 2, shown: 2 })
    expect(view.access).toBe("full")
    expect(view.showGate).toBe(false)
  })

  it("counts the 50-row cap as overflow for a MEMBER, without a lock", () => {
    const view = slotPeopleView({ scope: "all", claimed: 80, shown: 50 })
    expect(view.access).toBe("full")
    expect(view.hidden).toBe(30)
    expect(view.showGate).toBe(false)
  })

  it("flashes no lock while the roster is still in flight", () => {
    const view = slotPeopleView({ scope: undefined, claimed: 5, shown: 0 })
    expect(view.access).toBe("full")
    expect(view.showGate).toBe(false)
    expect(view.hidden).toBe(5)
  })

  it("clamps a stale claimed below the rows actually in hand", () => {
    expect(slotPeopleView({ scope: "all", claimed: 1, shown: 3 }).hidden).toBe(0)
  })
})
