import { describe, expect, it } from "vitest"
import { inviteRowSlice } from "../profile/invitesModel"

const rows = (...ids: string[]): { id: string }[] => ids.map((id) => ({ id }))

describe("inviteRowSlice with an explicit cap", () => {
  it("fills the remainder with org invitations under a larger cap", () => {
    const slice = inviteRowSlice(rows("a"), rows("o1", "o2", "o3", "o4"), 4)
    expect(slice.events.map((row) => row.id)).toEqual(["a"])
    expect(slice.orgs.map((row) => row.id)).toEqual(["o1", "o2", "o3"])
    expect(slice.total).toBe(5)
  })

  it("shows only org invitations when there are no event invitations", () => {
    const slice = inviteRowSlice([], rows("o1", "o2", "o3", "o4"))
    expect(slice.events).toEqual([])
    expect(slice.orgs.map((row) => row.id)).toEqual(["o1", "o2", "o3"])
    expect(slice.total).toBe(4)
  })

  it("shows nothing under a zero cap but still counts every invitation", () => {
    const slice = inviteRowSlice(rows("a", "b"), rows("o1"), 0)
    expect(slice.events).toEqual([])
    expect(slice.orgs).toEqual([])
    expect(slice.total).toBe(3)
  })

  it("treats a negative cap as zero rather than slicing from the end", () => {
    const slice = inviteRowSlice(rows("a", "b"), rows("o1", "o2"), -1)
    expect(slice.events).toEqual([])
    expect(slice.orgs).toEqual([])
    expect(slice.total).toBe(4)
  })

  it("returns copies, leaving the source lists untouched", () => {
    const events = rows("a", "b", "c", "d")
    const orgs = rows("o1")
    const slice = inviteRowSlice(events, orgs)
    expect(slice.events).not.toBe(events)
    expect(slice.orgs).not.toBe(orgs)
    expect(events).toHaveLength(4)
    expect(orgs).toHaveLength(1)
  })
})
