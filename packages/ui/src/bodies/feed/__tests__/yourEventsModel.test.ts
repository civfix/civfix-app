import { describe, expect, it } from "vitest"
import {
  YOUR_EVENTS_COLLAPSED_COUNT,
  buildYourEventsModel,
  inviteErrorVisible,
  yourEventsSectionVisible,
} from "../yourEventsModel"

const events = (n: number): string[] => Array.from({ length: n }, (_, i) => `e${i}`)
const invites = (n: number): string[] => Array.from({ length: n }, (_, i) => `i${i}`)

const build = (input: {
  isAuthenticated?: boolean
  events?: string[]
  invites?: string[]
  expanded?: boolean
  eventsPending?: boolean
  invitesPending?: boolean
  invitesError?: boolean
}) =>
  buildYourEventsModel({
    isAuthenticated: input.isAuthenticated ?? true,
    events: input.events ?? [],
    invites: input.invites ?? [],
    expanded: input.expanded ?? false,
    eventsPending: input.eventsPending ?? false,
    invitesPending: input.invitesPending ?? false,
    invitesError: input.invitesError ?? false,
  })

describe("yourEventsSectionVisible", () => {
  it("never renders for a signed-out reader, whatever the caches hold", () => {
    expect(
      yourEventsSectionVisible({ isAuthenticated: false, eventCount: 3, inviteCount: 2 }),
    ).toBe(false)
  })

  it("renders on an event alone, on an invite alone, and on both", () => {
    expect(yourEventsSectionVisible({ isAuthenticated: true, eventCount: 1, inviteCount: 0 })).toBe(
      true,
    )
    expect(yourEventsSectionVisible({ isAuthenticated: true, eventCount: 0, inviteCount: 1 })).toBe(
      true,
    )
    expect(yourEventsSectionVisible({ isAuthenticated: true, eventCount: 2, inviteCount: 3 })).toBe(
      true,
    )
  })

  it("renders NOTHING when a signed-in reader hosts nothing and owes no answer", () => {
    expect(yourEventsSectionVisible({ isAuthenticated: true, eventCount: 0, inviteCount: 0 })).toBe(
      false,
    )
  })
})

describe("buildYourEventsModel", () => {
  it("hides the section, and empties it, for a guest", () => {
    const model = build({ isAuthenticated: false, events: events(3), invites: invites(2) })
    expect(model).toEqual({
      visible: false,
      invites: [],
      events: [],
      inviteErrorVisible: false,
      hiddenCount: 0,
      showMoreVisible: false,
      showFewerVisible: false,
    })
  })

  it("collapses to the single earliest event - the rows arrive earliest first", () => {
    const model = build({ events: ["soonest", "later", "latest"] })
    expect(model.events).toEqual(["soonest"])
    expect(model.events).toHaveLength(YOUR_EVENTS_COLLAPSED_COUNT)
    expect(model.hiddenCount).toBe(2)
    expect(model.showMoreVisible).toBe(true)
    expect(model.showFewerVisible).toBe(false)
  })

  it("shows every loaded event once expanded, and offers the way back", () => {
    const model = build({ events: ["soonest", "later", "latest"], expanded: true })
    expect(model.events).toEqual(["soonest", "later", "latest"])
    expect(model.hiddenCount).toBe(0)
    expect(model.showMoreVisible).toBe(false)
    expect(model.showFewerVisible).toBe(true)
  })

  it("offers neither control when the collapsed view already shows everything", () => {
    for (const expanded of [false, true]) {
      const model = build({ events: ["only"], expanded })
      expect(model.events).toEqual(["only"])
      expect(model.hiddenCount).toBe(0)
      expect(model.showMoreVisible).toBe(false)
      expect(model.showFewerVisible).toBe(false)
    }
  })

  it("never collapses invites - they are action items, not a browse list", () => {
    const model = build({ invites: invites(4), events: events(5) })
    expect(model.invites).toHaveLength(4)
    expect(model.events).toHaveLength(1)
  })

  it("shows an invite-only section with no show-more control at all", () => {
    const model = build({ invites: invites(2) })
    expect(model.visible).toBe(true)
    expect(model.events).toEqual([])
    expect(model.hiddenCount).toBe(0)
    expect(model.showMoreVisible).toBe(false)
    expect(model.showFewerVisible).toBe(false)
  })
})

describe("the invite inbox when the request fails", () => {
  it("keeps the section on screen so the reader can retry, instead of vanishing", () => {
    const model = build({ invites: [], events: [], invitesError: true })
    expect(model.visible).toBe(true)
    expect(model.inviteErrorVisible).toBe(true)
    expect(model.invites).toEqual([])
    expect(model.events).toEqual([])
  })

  it("still renders the hosted lane when only the invite lane broke", () => {
    const model = build({ events: events(2), invitesError: true })
    expect(model.visible).toBe(true)
    expect(model.inviteErrorVisible).toBe(true)
    expect(model.events).toHaveLength(1)
    expect(model.showMoreVisible).toBe(true)
  })

  it("shows the cached invites rather than an error when a REFETCH failed", () => {
    const model = build({ invites: invites(2), invitesError: true })
    expect(model.visible).toBe(true)
    expect(model.inviteErrorVisible).toBe(false)
    expect(model.invites).toHaveLength(2)
  })

  it("never offers a guest a retry for an inbox they cannot have", () => {
    const model = build({ isAuthenticated: false, invitesError: true })
    expect(model.visible).toBe(false)
    expect(model.inviteErrorVisible).toBe(false)
  })

  it("waits for the request to settle before calling it an error", () => {
    const model = build({ invitesPending: true, invitesError: true })
    expect(model.visible).toBe(false)
    expect(model.inviteErrorVisible).toBe(false)
  })
})

describe("the two lanes settle independently", () => {
  it("draws the invites the moment they land, while the hosted list is still loading", () => {
    const model = build({ invites: invites(2), events: events(3), eventsPending: true })
    expect(model.visible).toBe(true)
    expect(model.invites).toHaveLength(2)
    expect(model.events).toEqual([])
    expect(model.showMoreVisible).toBe(false)
    expect(model.hiddenCount).toBe(0)
  })

  it("draws the hosted list the moment it lands, while the invites are still loading", () => {
    const model = build({ invites: invites(2), events: events(2), invitesPending: true })
    expect(model.visible).toBe(true)
    expect(model.invites).toEqual([])
    expect(model.events).toHaveLength(1)
  })

  it("renders nothing at all while both lanes are still in flight", () => {
    const model = build({ invitesPending: true, eventsPending: true })
    expect(model.visible).toBe(false)
  })
})

describe("inviteErrorVisible", () => {
  it("is true only for a signed-in reader whose settled request failed with no rows", () => {
    const base = { isAuthenticated: true, invitesPending: false, invitesError: true, inviteCount: 0 }
    expect(inviteErrorVisible(base)).toBe(true)
    expect(inviteErrorVisible({ ...base, isAuthenticated: false })).toBe(false)
    expect(inviteErrorVisible({ ...base, invitesPending: true })).toBe(false)
    expect(inviteErrorVisible({ ...base, invitesError: false })).toBe(false)
    expect(inviteErrorVisible({ ...base, inviteCount: 1 })).toBe(false)
  })
})
