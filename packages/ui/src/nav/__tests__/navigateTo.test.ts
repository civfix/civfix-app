import { beforeEach, describe, expect, it } from "vitest"
import { useNavStore } from "../useNavStore"
import { entryFromPath, entryIdentity } from "../routes"
import type { DetailEntry } from "../types"

function resetStore(mode: "compact" | "expanded" = "compact"): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 2,
    snapAnimated: true,
    query: "",
    mode,
    originView: null,
    seededDetailPage: false,
  })
}

const store = () => useNavStore.getState()

function countNotifications(run: () => void): number {
  let calls = 0
  const unsub = useNavStore.subscribe(() => {
    calls += 1
  })
  run()
  unsub()
  return calls
}

const expectInvariant = (): void => {
  const s = store()
  expect(s.active).toEqual(s.stack[s.stack.length - 1] ?? null)
}

beforeEach(() => resetStore())

describe("entryIdentity", () => {
  it("is kind + the discriminating ids, so session-only fields never fork an entry", () => {
    const bare: DetailEntry = { kind: "person", id: "u1" }
    const dressed: DetailEntry = {
      kind: "person",
      id: "u1",
      title: "Ada",
      profileTab: "reports",
      lat: 1,
      lng: 2,
      peer: { id: "u1" } as DetailEntry["peer"],
    }
    expect(entryIdentity(dressed)).toBe(entryIdentity(bare))
  })

  it("discriminates the room kind, the geoid and the composer target", () => {
    expect(entryIdentity({ kind: "thread", id: "r1", roomKind: "dm" })).not.toBe(
      entryIdentity({ kind: "thread", id: "r1", roomKind: "group" }),
    )
    expect(entryIdentity({ kind: "leaderboard", geoid: "06" })).not.toBe(
      entryIdentity({ kind: "leaderboard", geoid: "0644000" }),
    )
    expect(entryIdentity({ kind: "composer", composerMode: "quote", targetPostId: "p1" })).not.toBe(
      entryIdentity({ kind: "composer", composerMode: "quote", targetPostId: "p2" })
    )
    expect(entryIdentity({ kind: "composer" })).toBe(
      entryIdentity({ kind: "composer", composerMode: "post" }),
    )
  })

  it("refuses an identity to the map selections that carry no addressable target", () => {
    expect(entryIdentity({ kind: "cluster", reports: [] })).toBeNull()
    expect(entryIdentity({ kind: "blend", reports: [] })).toBeNull()
    expect(entryIdentity({ kind: "drop-pin", lat: 1, lng: 2 })).toBeNull()
    expect(entryIdentity(null)).toBeNull()
  })

  it("names a view entry by its view", () => {
    expect(entryIdentity({ kind: "view", view: "map" })).toBe("view:map")
    expect(entryIdentity({ kind: "view", view: "search" })).not.toBe("view:map")
  })
})

describe("navigateTo: applying a target that is already open", () => {
  const pin: DetailEntry = { kind: "pin", id: "p1" }

  it("seeds normally when the target is nowhere in the stack", () => {
    store().navigateTo(pin, "compact")
    expect(store().stack).toEqual([pin])
    expect(store().active).toEqual(pin)
    expectInvariant()
  })

  it("is a TOTAL no-op when the target is already the active entry", () => {
    store().navigateTo(pin, "compact")
    const before = useNavStore.getState()
    const calls = countNotifications(() => store().navigateTo({ kind: "pin", id: "p1" }, "compact"))
    expect(calls).toBe(0)
    expect(useNavStore.getState().stack).toBe(before.stack)
    expect(useNavStore.getState().active).toBe(before.active)
  })

  it("re-applying the SAME href twice notifies exactly once (the duplicate open is dropped)", () => {
    const href = "/pin/p1"
    const calls = countNotifications(() => {
      store().navigateTo(entryFromPath(href), "compact")
      store().navigateTo(entryFromPath(href), "compact")
    })
    expect(calls).toBe(1)
    expect(store().stack).toHaveLength(1)
  })

  it("raises a peeked sheet instead of re-seeding, so the target the user tapped is visible", () => {
    store().navigateTo(pin, "compact")
    useNavStore.setState({ snap: 0 })
    const active = store().active
    store().navigateTo({ kind: "pin", id: "p1" }, "compact")
    expect(store().snap).toBe(1)
    expect(store().active).toBe(active)
    expect(store().stack).toHaveLength(1)
  })

  it("updates a session-only param IN PLACE rather than stacking a twin", () => {
    store().navigateTo({ kind: "person", id: "u1", profileTab: "posts" }, "compact")
    store().navigateTo({ kind: "person", id: "u1", profileTab: "reports" }, "compact")
    expect(store().stack).toEqual([{ kind: "person", id: "u1", profileTab: "reports" }])
    expectInvariant()
  })

  it("keeps richer detail the incoming entry does not carry (a deep link never drops the DM peer)", () => {
    const peer = { id: "u1", name: "Ada" } as DetailEntry["peer"]
    store().navigateTo({ kind: "thread", id: "r1", roomKind: "dm", peer }, "compact")
    store().navigateTo(entryFromPath("/messages/dm/r1"), "compact")
    expect(store().active?.peer).toBe(peer)
    expect(store().stack).toHaveLength(1)
  })
})

describe("navigateTo: applying a target that is deeper in the stack", () => {
  it("collapses back to the existing entry instead of pushing a second copy", () => {
    store().selectView("messaging")
    store().push({ kind: "activity" })
    store().push({ kind: "person", id: "u1" })
    store().navigateTo({ kind: "activity" }, "compact")
    expect(store().stack).toEqual([{ kind: "activity" }])
    expect(store().active).toEqual({ kind: "activity" })
    expectInvariant()
  })

  it("preserves the view and the origin the plain seed would have thrown away", () => {
    store().selectView("messaging")
    store().push({ kind: "activity" })
    store().push({ kind: "person", id: "u1" })
    store().navigateTo({ kind: "activity" }, "compact")
    expect(store().view).toBe("messaging")
    expect(store().originView).toBe("messaging")

    store().navigateTo({ kind: "person", id: "u2" }, "compact")
    expect(store().view).toBe("messaging")
    expect(store().originView).toBeNull()
  })

  it("matches the copy nearest the TOP of the stack and merges its params on the way back", () => {
    store().push({ kind: "person", id: "u1" })
    store().push({ kind: "pin", id: "p1" })
    store().navigateTo({ kind: "person", id: "u1", profileTab: "hours" }, "compact")
    expect(store().stack).toEqual([{ kind: "person", id: "u1", profileTab: "hours" }])
    expectInvariant()
  })

  it("never matches an unaddressable map selection", () => {
    store().push({ kind: "cluster", reports: [] })
    store().navigateTo({ kind: "cluster", reports: [] }, "compact")
    expect(store().stack).toHaveLength(1)
    expect(store().view).toBe("home")
  })
})

describe("navigateTo: the seeding paths it must not regress", () => {
  it("seeds a cold (empty) stack exactly like seed does", () => {
    const entry = entryFromPath("/cleanups/c1")
    store().navigateTo(entry, "compact")
    const navigated = useNavStore.getState()
    resetStore()
    store().seed(entry, "compact")
    const seeded = useNavStore.getState()
    expect(navigated.stack).toEqual(seeded.stack)
    expect(navigated.view).toBe(seeded.view)
  })

  it("routes a list kind to its view with an empty stack", () => {
    store().push({ kind: "pin", id: "p1" })
    store().navigateTo({ kind: "messages" }, "compact")
    expect(store().view).toBe("messaging")
    expect(store().stack).toEqual([])
    expect(store().active).toBeNull()
    expectInvariant()
  })

  it("clears a stale panel on a null (home) target", () => {
    store().push({ kind: "pin", id: "p1" })
    store().navigateTo(null, "compact")
    expect(store().stack).toEqual([])
    expect(store().view).toBe("home")
    expectInvariant()
  })

  it("carries a view entry's snap through", () => {
    store().navigateTo({ kind: "view", view: "map" }, "compact")
    expect(store().view).toBe("map")
    expect(store().snap).toBe(0)
    expectInvariant()
  })
})
