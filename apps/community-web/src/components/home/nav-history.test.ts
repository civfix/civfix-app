import { describe, expect, it } from "vitest"
import { ROOT_NAV_SNAPSHOT, type NavSnapshot } from "@civfix/ui/nav"

import {
  pathForSnapshot,
  readNavHistory,
  reconcilePlan,
  snapshotEquals,
  stampNavHistory,
  traversalFor,
  type NavHistoryEntry,
} from "./nav-history"

function snapshot(partial: Partial<NavSnapshot> = {}): NavSnapshot {
  return { ...ROOT_NAV_SNAPSHOT, stack: [], ...partial }
}

function entry(partial: Partial<NavHistoryEntry> = {}): NavHistoryEntry {
  return { v: 1, seq: 1, depth: 0, snapshot: snapshot(), ...partial }
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
    expect(readNavHistory({ civfixNav: { v: 2, seq: 1, depth: 0, snapshot: snapshot() } })).toBeNull()
    expect(readNavHistory({ civfixNav: { v: 1, seq: 1, depth: 0 } })).toBeNull()
    expect(
      readNavHistory({ civfixNav: { v: 1, seq: 1, depth: 0, snapshot: { view: "home" } } }),
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
  it("compares the view, the query and the stack identities", () => {
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
    expect(
      snapshotEquals(a, snapshot({ view: "events", stack: [{ kind: "cleanup", id: "c1" }], query: "x" })),
    ).toBe(false)
  })
})

describe("reconcilePlan", () => {
  it("does nothing when the landed entry already describes the live store", () => {
    expect(reconcilePlan(snapshot(), snapshot()).type).toBe("none")
  })

  it("pushes when the live store is the landed state plus exactly one entry", () => {
    const landed = snapshot({ view: "events", stack: [{ kind: "cleanup", id: "c1" }] })
    const live = snapshot({
      view: "events",
      stack: [{ kind: "cleanup", id: "c1" }, { kind: "person", id: "p1" }],
    })
    expect(reconcilePlan(landed, live).type).toBe("push")
  })

  it("replaces for a different view, a deeper jump or a lateral swap", () => {
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
          stack: [
            { kind: "cleanup", id: "c1" },
            { kind: "person", id: "p1" },
            { kind: "post-thread", id: "t1" },
          ],
        }),
      ).type,
    ).toBe("replace")
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
    expect(pathForSnapshot(snapshot({ stack: [{ kind: "pin", id: "p1" }] }))).toBe("/pin/p1")
  })

  it("addresses the report wizard, which the old view-only rule flattened to /", () => {
    expect(pathForSnapshot(snapshot({ view: "report" }))).toBe("/report")
    expect(pathForSnapshot(snapshot({ view: "map" }))).toBe("/map")
    expect(pathForSnapshot(snapshot({ view: "search" }))).toBe("/search")
  })

  it("addresses a selected list view and falls back to home", () => {
    expect(pathForSnapshot(snapshot({ view: "events" }))).toBe("/cleanups")
    expect(pathForSnapshot(snapshot({ view: "messaging" }))).toBe("/messages")
    expect(pathForSnapshot(snapshot({ view: "home" }))).toBe("/")
  })

  it("never addresses the transient drop-pin affordance", () => {
    expect(pathForSnapshot(snapshot({ view: "map", stack: [{ kind: "drop-pin", lat: 1, lng: 2 }] }))).toBe(
      "/map",
    )
  })
})
