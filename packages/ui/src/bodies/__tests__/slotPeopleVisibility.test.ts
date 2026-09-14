import { describe, expect, it } from "vitest"
import { facePileOverflow, slotPeopleView } from "../slotPeopleVisibility"

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

describe("the collapsed facepile's +N counts everyone it did not name", () => {
  it("counts against the names PRINTED, not the two-name cap", () => {
    expect(facePileOverflow(5, 1)).toBe(4)
    expect(facePileOverflow(5, 0)).toBe(5)
  })

  it("agrees with the row's hidden count once the cap is the only truncation", () => {
    const view = slotPeopleView({ scope: "all", claimed: 5, shown: 2 })
    expect(facePileOverflow(5, 2)).toBe(3)
    expect(view.hidden).toBe(3)
  })

  it("prints nothing extra when the printed names already cover the claims", () => {
    expect(facePileOverflow(2, 2)).toBe(0)
    expect(facePileOverflow(1, 1)).toBe(0)
    expect(facePileOverflow(0, 0)).toBe(0)
  })

  it("clamps a stale claimed below the names in hand", () => {
    expect(facePileOverflow(1, 3)).toBe(0)
  })
})
