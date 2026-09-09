import { beforeEach, describe, expect, it } from "vitest"
import { useNavStore } from "../useNavStore"
import { entryFromPath } from "../routes"
import type { DetailEntry } from "../types"

function resetStore(mode: "compact" | "expanded" = "compact"): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 0,
    snapAnimated: true,
    query: "",
    mode,
    originView: null,
    seededDetailPage: false,
  })
}

const store = () => useNavStore.getState()

beforeEach(() => resetStore())

describe("seed raises the flag for shareable content only", () => {
  it.each([
    ["/cleanups/c1"],
    ["/pin/r1"],
    ["/post/p1"],
    ["/reports/r1"],
    ["/cleanups/c1/?utm=share"],
  ])("raises it for a cold %s", (path) => {
    store().seed(entryFromPath(path), "compact")
    expect(store().seededDetailPage).toBe(true)
  })

  it("leaves it down for a seeded VIEW - there is no detail to present at all", () => {
    store().seed({ kind: "view", view: "map" }, "compact")
    expect(store().seededDetailPage).toBe(false)
    expect(store().active).toBeNull()
  })

  it("leaves it down for a seeded LIST kind, which seeds its view with an empty stack", () => {
    store().seed({ kind: "cleanups" }, "compact")
    expect(store().seededDetailPage).toBe(false)
  })

  it("leaves it down for a detail kind outside the allowlist", () => {
    store().seed({ kind: "settings" }, "compact")
    expect(store().seededDetailPage).toBe(false)
    store().seed({ kind: "person", id: "u1" }, "compact")
    expect(store().seededDetailPage).toBe(false)
  })

  it("lowers it again on a seed of home (null), which clears the whole world", () => {
    store().seed({ kind: "cleanup", id: "c1" }, "compact")
    store().seed(null, "compact")
    expect(store().seededDetailPage).toBe(false)
  })

  it("re-raises it on a popstate seed of another linkable detail", () => {
    store().seed({ kind: "cleanup", id: "c1" }, "compact")
    store().seed({ kind: "pin", id: "r1" }, "compact")
    expect(store().seededDetailPage).toBe(true)
  })
})

describe("in-app navigation hands the sheet back", () => {
  it("lowers it on a LATERAL open (tapping a map pin behind the seeded page)", () => {
    store().seed({ kind: "cleanup", id: "c1" }, "compact")
    store().openDetail({ kind: "pin", id: "r1" })
    expect(store().seededDetailPage).toBe(false)
  })

  it("lowers it on a drill-down PUSH out of the seeded page", () => {
    store().seed({ kind: "pin", id: "r1" }, "compact")
    store().push({ kind: "person", id: "u1" })
    expect(store().seededDetailPage).toBe(false)
  })

  it("lowers it on selectView, setStack, collapseToParent and reset", () => {
    store().seed({ kind: "pin", id: "r1" }, "compact")
    store().selectView("events")
    expect(store().seededDetailPage).toBe(false)

    store().seed({ kind: "pin", id: "r1" }, "compact")
    store().setStack([{ kind: "thread", id: "t1", roomKind: "dm" }])
    expect(store().seededDetailPage).toBe(false)

    store().seed({ kind: "pin", id: "r1" }, "compact")
    store().collapseToParent()
    expect(store().seededDetailPage).toBe(false)

    store().seed({ kind: "pin", id: "r1" }, "compact")
    store().reset()
    expect(store().seededDetailPage).toBe(false)
  })

  it("lowers it when back() empties the stack (nothing is active to present)", () => {
    store().seed({ kind: "cleanup", id: "c1" }, "compact")
    store().back()
    expect(store().seededDetailPage).toBe(false)
    expect(store().active).toBeNull()
  })

  it("holds the invariant: the flag is never up while nothing is active", () => {
    const assertInvariant = () => {
      const s = store()
      if (s.active === null) expect(s.seededDetailPage).toBe(false)
    }
    store().seed({ kind: "cleanup", id: "c1" }, "compact")
    assertInvariant()
    store().push({ kind: "person", id: "u1" })
    assertInvariant()
    store().back()
    assertInvariant()
    store().back()
    assertInvariant()
    store().seed({ kind: "post", id: "p1" }, "compact")
    assertInvariant()
    store().selectView("map")
    assertInvariant()
  })
})

describe("navigateTo answers per branch, because its two branches are two different acts", () => {
  it("SEEDS (and raises the flag) when the target is nowhere in the stack", () => {
    store().push({ kind: "profile" })
    store().navigateTo(entryFromPath("/cleanups/c1"), "compact")
    expect(store().seededDetailPage).toBe(true)
    expect(store().stack).toEqual([{ kind: "cleanup", id: "c1" }])
  })

  it("KEEPS it while merging params into the entry that is already active", () => {
    store().seed({ kind: "pin", id: "r1" }, "compact")
    store().navigateTo({ kind: "pin", id: "r1", lat: 1, lng: 2 }, "compact")
    expect(store().seededDetailPage).toBe(true)
    expect(store().active).toEqual({ kind: "pin", id: "r1", lat: 1, lng: 2 })
  })

  it("lowers it when it collapses back to an entry deeper in the stack", () => {
    store().seed({ kind: "cleanup", id: "c1" }, "compact")
    store().push({ kind: "person", id: "u1" })
    store().navigateTo({ kind: "cleanup", id: "c1" }, "compact")
    expect(store().seededDetailPage).toBe(false)
    expect(store().active).toEqual({ kind: "cleanup", id: "c1" })
  })

  it("changes nothing at all when the target is already active (the total no-op stays total)", () => {
    store().seed({ kind: "pin", id: "r1" }, "compact")
    let calls = 0
    const unsub = useNavStore.subscribe(() => {
      calls += 1
    })
    store().navigateTo({ kind: "pin", id: "r1" }, "compact")
    unsub()
    expect(calls).toBe(0)
    expect(store().seededDetailPage).toBe(true)
  })
})

describe("the expanded shell is untouched", () => {
  it("still records the seed, and AppShell is what gates it on compact", () => {
    resetStore("expanded")
    const entry: DetailEntry = { kind: "cleanup", id: "c1" }
    store().seed(entry, "expanded")
    expect(store().seededDetailPage).toBe(true)
    expect(store().stack).toEqual([entry])
  })
})
