import { describe, expect, it } from "vitest"
import {
  ROOT_NAV_SNAPSHOT,
  entryFromPath,
  type DetailEntry,
  type NavReturn,
  type NavSnapshot,
} from "@civfix/ui/nav"

import {
  entryFromWebPath,
  pathForSnapshot,
  readNavHistory,
  reconcilePlan,
  snapshotEquals,
  stampNavHistory,
  traversalFor,
  writePlan,
  type NavHistoryEntry,
} from "./nav-history"

function snapshot(partial: Partial<NavSnapshot> = {}): NavSnapshot {
  return { ...ROOT_NAV_SNAPSHOT, stack: [], ...partial }
}

function entry(partial: Partial<NavHistoryEntry> = {}): NavHistoryEntry {
  return { v: 2, seq: 1, depth: 0, beneath: null, snapshot: snapshot(), ...partial }
}

describe("readNavHistory", () => {
  it("accepts an entry this adapter wrote", () => {
    const stamped = stampNavHistory({ __NA: true }, entry({ depth: 2 }))
    expect(readNavHistory(stamped)?.depth).toBe(2)
  })

  it("rejects foreign or malformed history states", () => {
    expect(readNavHistory(null)).toBeNull()
    expect(readNavHistory({})).toBeNull()
    expect(readNavHistory({ civfixNav: "nope" })).toBeNull()
    expect(readNavHistory({ civfixNav: { v: 3, seq: 1, depth: 0, beneath: null, snapshot: snapshot() } })).toBeNull()
    expect(readNavHistory({ civfixNav: { v: 2, seq: 1, depth: 0, beneath: null } })).toBeNull()
    expect(
      readNavHistory({ civfixNav: { v: 2, seq: 1, depth: 0, beneath: null, snapshot: { view: "home" } } }),
    ).toBeNull()
  })

  it("rejects a stamp written before the entry carried the surface beneath it", () => {
    expect(readNavHistory({ civfixNav: { v: 1, seq: 1, depth: 1, snapshot: snapshot() } })).toBeNull()
  })

  it("rejects an entry whose beneath is neither a restorable snapshot nor null", () => {
    expect(readNavHistory(stampNavHistory(null, entry({ beneath: snapshot({ view: "map" }) })))).not.toBeNull()
    expect(
      readNavHistory({ civfixNav: { v: 2, seq: 1, depth: 1, beneath: { view: "map" }, snapshot: snapshot() } }),
    ).toBeNull()
    expect(
      readNavHistory({ civfixNav: { v: 2, seq: 1, depth: 1, snapshot: snapshot() } }),
    ).toBeNull()
  })

  it("rejects a snapshot whose report-return stamp is not a state the store can restore", () => {
    const good: NavReturn = {
      view: "events",
      stack: [{ kind: "cleanup", id: "c1" }],
      originView: null,
      query: "",
      token: 3,
    }
    expect(
      readNavHistory(stampNavHistory(null, entry({ snapshot: snapshot({ reportReturn: good }) }))),
    ).not.toBeNull()
    expect(
      readNavHistory(stampNavHistory(null, entry({ snapshot: snapshot({ reportReturn: {} as never }) }))),
    ).toBeNull()
    expect(
      readNavHistory(
        stampNavHistory(null, entry({ snapshot: snapshot({ reportReturn: { ...good, stack: "nope" } as never }) })),
      ),
    ).toBeNull()
    expect(
      readNavHistory(
        stampNavHistory(null, entry({ snapshot: snapshot({ reportReturn: { ...good, view: "nonsense" } as never }) })),
      ),
    ).toBeNull()
    expect(
      readNavHistory(
        stampNavHistory(null, entry({ snapshot: snapshot({ reportReturn: { ...good, token: "1" } as never }) })),
      ),
    ).toBeNull()
  })

  it("rejects a snapshot whose originView is neither a view nor null", () => {
    expect(
      readNavHistory(
        stampNavHistory(null, entry({ snapshot: snapshot({ originView: "nonsense" as never }) })),
      ),
    ).toBeNull()
    expect(
      readNavHistory(
        stampNavHistory(null, entry({ snapshot: snapshot({ originView: undefined as never }) })),
      ),
    ).toBeNull()
  })

  it("rejects a snapshot carrying a view or an entry kind the app cannot render", () => {
    expect(
      readNavHistory(stampNavHistory(null, entry({ snapshot: snapshot({ view: "nonsense" as never }) }))),
    ).toBeNull()
    expect(
      readNavHistory(
        stampNavHistory(null, entry({ snapshot: snapshot({ stack: [{ kind: "nonsense" as never }] }) })),
      ),
    ).toBeNull()
    expect(
      readNavHistory(
        stampNavHistory(null, entry({ snapshot: snapshot({ stack: ["pin" as never] }) })),
      ),
    ).toBeNull()
    expect(
      readNavHistory(
        stampNavHistory(null, entry({ snapshot: snapshot({ stack: [{ kind: "pin", id: "a" }] }) })),
      ),
    ).not.toBeNull()
  })
})

describe("stampNavHistory", () => {
  it("preserves whatever the host router already keeps on the entry", () => {
    const stamped = stampNavHistory({ __NA: true, tree: ["x"] }, entry())
    expect(stamped.__NA).toBe(true)
    expect(stamped.tree).toEqual(["x"])
    expect(readNavHistory(stamped)).not.toBeNull()
  })

  it("starts from an empty object when there is no previous state", () => {
    expect(Object.keys(stampNavHistory(null, entry()))).toEqual(["civfixNav"])
  })
})

describe("snapshotEquals", () => {
  it("compares the view and the stack identities", () => {
    const a = snapshot({ view: "events", stack: [{ kind: "cleanup", id: "c1" }] })
    expect(snapshotEquals(a, snapshot({ view: "events", stack: [{ kind: "cleanup", id: "c1" }] }))).toBe(
      true,
    )
    expect(
      snapshotEquals(
        a,
        snapshot({ view: "events", stack: [{ kind: "cleanup", id: "c1", title: "t" }] }),
      ),
    ).toBe(true)
    expect(snapshotEquals(a, snapshot({ view: "home", stack: [{ kind: "cleanup", id: "c1" }] }))).toBe(
      false,
    )
    expect(snapshotEquals(a, snapshot({ view: "events", stack: [] }))).toBe(false)
  })

  it("treats the search query as in-place state, not a surface of its own", () => {
    const a = snapshot({ view: "map" })
    expect(snapshotEquals(a, snapshot({ view: "map", query: "abc" }))).toBe(true)
  })
})

describe("reconcilePlan", () => {
  it("does nothing when the landed entry already describes the live store", () => {
    expect(reconcilePlan(snapshot(), snapshot()).type).toBe("none")
  })

  it("restamps the landed entry when only the search query moved on", () => {
    const landed = snapshot({ view: "map" })
    expect(reconcilePlan(landed, snapshot({ view: "map", query: "abc" }))).toEqual({
      type: "restamp",
    })
    expect(reconcilePlan(snapshot({ view: "map", query: "abc" }), landed)).toEqual({
      type: "restamp",
    })
  })

  it("pushes when the live store is the landed state plus exactly one entry", () => {
    const landed = snapshot({ view: "events", stack: [{ kind: "cleanup", id: "c1" }] })
    const live = snapshot({
      view: "events",
      stack: [{ kind: "cleanup", id: "c1" }, { kind: "person", id: "p1" }],
    })
    expect(reconcilePlan(landed, live)).toEqual({ type: "push", count: 1 })
  })

  it("pushes one entry per surface when several arrived while a traversal was in flight", () => {
    const landed = snapshot({ view: "events", stack: [{ kind: "cleanup", id: "c1" }] })
    const live = snapshot({
      view: "events",
      stack: [
        { kind: "cleanup", id: "c1" },
        { kind: "person", id: "p1" },
        { kind: "post-thread", id: "t1" },
      ],
    })
    expect(reconcilePlan(landed, live)).toEqual({ type: "push", count: 2 })
  })

  it("replaces for a different view or a lateral swap", () => {
    const landed = snapshot({ view: "events", stack: [{ kind: "cleanup", id: "c1" }] })
    expect(reconcilePlan(landed, snapshot({ view: "home", stack: [] })).type).toBe("replace")
    expect(
      reconcilePlan(landed, snapshot({ view: "events", stack: [{ kind: "cleanup", id: "c2" }] })).type,
    ).toBe("replace")
    expect(
      reconcilePlan(
        landed,
        snapshot({
          view: "events",
          stack: [{ kind: "person", id: "p1" }, { kind: "cleanup", id: "c1" }],
        }),
      ).type,
    ).toBe("replace")
  })
})

describe("writePlan", () => {
  const MAP = snapshot({ view: "map" })
  const MAP_PIN = snapshot({ view: "map", stack: [{ kind: "pin", id: "a" }] })

  it("writes nothing when the transition changed nothing a URL can address", () => {
    expect(writePlan({ type: "push" }, entry({ depth: 1, snapshot: MAP }), MAP)).toEqual({
      type: "none",
    })
    expect(writePlan({ type: "pop", count: 0 }, entry({ depth: 1, snapshot: MAP }), MAP)).toEqual({
      type: "none",
    })
  })

  it("restamps in place when only the search query moved on", () => {
    expect(
      writePlan(
        { type: "push" },
        entry({ depth: 1, snapshot: MAP }),
        snapshot({ view: "map", query: "abc" }),
      ),
    ).toEqual({ type: "restamp" })
  })

  it("traverses instead of overwriting when a lateral swap lands on the entry beneath", () => {
    expect(
      writePlan({ type: "replace" }, entry({ depth: 2, snapshot: MAP_PIN, beneath: MAP }), MAP),
    ).toEqual({ type: "traverse", steps: 1 })
    expect(writePlan({ type: "replace" }, entry({ depth: 2, snapshot: MAP_PIN }), MAP)).toEqual({
      type: "replace",
    })
    expect(
      writePlan(
        { type: "replace" },
        entry({ depth: 2, snapshot: MAP_PIN, beneath: snapshot({ view: "events" }) }),
        MAP,
      ),
    ).toEqual({ type: "replace" })
  })

  it("traverses a pop, and overwrites in place only when there is nothing beneath to traverse to", () => {
    expect(
      writePlan({ type: "pop", count: 1 }, entry({ depth: 2, snapshot: MAP_PIN, beneath: MAP }), MAP),
    ).toEqual({ type: "traverse", steps: 1 })
    expect(
      writePlan({ type: "pop", count: 1 }, entry({ depth: 0, snapshot: MAP_PIN }), MAP),
    ).toEqual({ type: "replace" })
  })

  it("pushes a forward transition onto a surface the entry beneath does not hold", () => {
    for (const transition of [{ type: "push" }, { type: "select" }, { type: "reset" }, { type: "seed" }] as const) {
      expect(
        writePlan(transition, entry({ depth: 1, snapshot: MAP, beneath: ROOT_NAV_SNAPSHOT }), MAP_PIN),
      ).toEqual({ type: "push" })
    }
  })

  it("traverses instead of twinning whenever a forward transition lands on the entry beneath", () => {
    const SEARCH = snapshot({ view: "search" })
    const HOME = snapshot({ view: "home" })
    for (const transition of [
      { type: "push" },
      { type: "select" },
      { type: "reset" },
      { type: "seed" },
      { type: "replace" },
    ] as const) {
      expect(
        writePlan(transition, entry({ depth: 1, snapshot: SEARCH, beneath: HOME }), HOME),
      ).toEqual({ type: "traverse", steps: 1 })
    }
  })

  it("consumes the entry it is leaving when the transition says so, instead of twinning a surface further down", () => {
    const SEARCH = snapshot({ view: "search" })
    const HOME = snapshot({ view: "home" })
    expect(
      writePlan(
        { type: "select", consumes: true },
        entry({ depth: 2, snapshot: SEARCH, beneath: MAP }),
        HOME,
      ),
    ).toEqual({ type: "replace" })
    expect(
      writePlan({ type: "select" }, entry({ depth: 2, snapshot: SEARCH, beneath: MAP }), HOME),
    ).toEqual({ type: "push" })
  })

  it("keeps the home chip a forward push when the entry beneath is another surface", () => {
    const HOME = snapshot({ view: "home" })
    expect(
      writePlan(
        { type: "reset" },
        entry({ depth: 2, snapshot: MAP_PIN, beneath: snapshot({ view: "events" }) }),
        HOME,
      ),
    ).toEqual({ type: "push" })
    expect(writePlan({ type: "reset" }, entry({ depth: 1, snapshot: MAP }), HOME)).toEqual({
      type: "push",
    })
  })
})

describe("traversalFor", () => {
  it("does not traverse for a forward transition", () => {
    expect(traversalFor({ type: "push" }, entry({ depth: 3 }))).toBe(0)
    expect(traversalFor({ type: "replace" }, entry({ depth: 3 }))).toBe(0)
    expect(traversalFor(null, entry({ depth: 3 }))).toBe(0)
  })

  it("caps a pop at the number of in-session entries beneath the current one", () => {
    expect(traversalFor({ type: "pop", count: 1 }, entry({ depth: 3 }))).toBe(1)
    expect(traversalFor({ type: "pop", count: 5 }, entry({ depth: 2 }))).toBe(2)
    expect(traversalFor({ type: "pop", count: 1 }, entry({ depth: 0 }))).toBe(0)
    expect(traversalFor({ type: "pop", count: 1 }, null)).toBe(0)
  })

  it("unwinds a report run all the way to the surface it was launched from", () => {
    expect(
      traversalFor({ type: "pop", count: 1, unwind: "report" }, entry({ depth: 3, returnDepth: 0 })),
    ).toBe(3)
    expect(
      traversalFor({ type: "pop", count: 1, unwind: "report" }, entry({ depth: 4, returnDepth: 2 })),
    ).toBe(2)
  })

  it("falls back to one step when the run has no recorded launch depth", () => {
    expect(traversalFor({ type: "pop", count: 1, unwind: "report" }, entry({ depth: 1 }))).toBe(1)
    expect(
      traversalFor({ type: "pop", count: 1, unwind: "report" }, entry({ depth: 2, returnDepth: 2 })),
    ).toBe(1)
  })
})

describe("pathForSnapshot", () => {
  it("addresses the active detail", () => {
    expect(pathForSnapshot(snapshot({ stack: [{ kind: "pin", id: "p1" }] }))).toBe("/pin/p1/")
  })

  it("addresses the report wizard, map and search views by their own paths", () => {
    expect(pathForSnapshot(snapshot({ view: "report" }))).toBe("/report/")
    expect(pathForSnapshot(snapshot({ view: "map" }))).toBe("/map/")
    expect(pathForSnapshot(snapshot({ view: "search" }))).toBe("/search/")
  })

  it("addresses a selected list view and falls back to home", () => {
    expect(pathForSnapshot(snapshot({ view: "events" }))).toBe("/cleanups/")
    expect(pathForSnapshot(snapshot({ view: "messaging" }))).toBe("/messages/")
    expect(pathForSnapshot(snapshot({ view: "home" }))).toBe("/")
  })

  it("never addresses the transient drop-pin affordance", () => {
    expect(pathForSnapshot(snapshot({ view: "map", stack: [{ kind: "drop-pin", lat: 1, lng: 2 }] }))).toBe(
      "/map/",
    )
  })

  it("writes export-canonical paths, so a reload is served instead of redirected", () => {
    const written = [
      snapshot({ view: "map" }),
      snapshot({ view: "search" }),
      snapshot({ view: "report" }),
      snapshot({ view: "events" }),
      snapshot({ view: "messaging" }),
      snapshot({ view: "social" }),
      snapshot({ view: "reports" }),
      snapshot({ stack: [{ kind: "pin", id: "p1" }] }),
      snapshot({ stack: [{ kind: "cleanup", id: "c1" }] }),
      snapshot({ stack: [{ kind: "person", id: "u1" }] }),
      snapshot({ stack: [{ kind: "activity" }] }),
      snapshot({ stack: [{ kind: "thread", id: "t1", roomKind: "dm" }] }),
    ].map(pathForSnapshot)
    for (const path of written) expect(path.endsWith("/")).toBe(true)
    expect(pathForSnapshot(snapshot({ view: "home" }))).toBe("/")
  })

  it("round-trips a written path back through the shared path reader", () => {
    const cases: NavSnapshot[] = [
      snapshot({ view: "map" }),
      snapshot({ view: "search" }),
      snapshot({ view: "report" }),
      snapshot({ stack: [{ kind: "pin", id: "p1" }] }),
      snapshot({ stack: [{ kind: "cleanup", id: "c1" }] }),
      snapshot({ stack: [{ kind: "person", id: "u1" }] }),
      snapshot({ stack: [{ kind: "thread", id: "t1", roomKind: "dm" }] }),
      snapshot({ stack: [{ kind: "activity" }] }),
      snapshot({ stack: [{ kind: "post", id: "p1" }] }),
      snapshot({ stack: [{ kind: "post-thread", id: "p1" }] }),
    ]
    for (const source of cases) {
      const path = pathForSnapshot(source)
      const entry = entryFromWebPath(path)
      expect(entry).not.toBeNull()
      expect(pathForSnapshot(snapshot({ ...source, stack: [entry as DetailEntry] }))).toBe(path)
    }
  })
})

describe("web post addresses", () => {
  it("writes a post thread at the short shared address, never the /thread form", () => {
    expect(pathForSnapshot(snapshot({ stack: [{ kind: "post-thread", id: "p1" }] }))).toBe("/post/p1/")
  })

  it("reads a shared post link as its thread on web while the shared parser keeps it a post", () => {
    expect(entryFromPath("/post/p1")).toEqual({ kind: "post", id: "p1" })
    expect(entryFromWebPath("/post/p1")).toEqual({ kind: "post-thread", id: "p1" })
    expect(entryFromWebPath("/post/p1/thread")).toEqual({ kind: "post-thread", id: "p1" })
    expect(entryFromWebPath("/pin/a")).toEqual(entryFromPath("/pin/a"))
  })
})
