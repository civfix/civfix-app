import { beforeEach, describe, expect, it } from "vitest"
import { persistableEntry, persistableStack, takeNavSnapshot } from "../navSnapshot"
import { ENTRY_IDENTITY_FIELDS, entryIdentity, pathForEntry } from "../routes"
import { useNavStore } from "../useNavStore"
import type { DetailEntry } from "../types"

function resetStore(): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 0,
    snapAnimated: true,
    query: "",
    mode: "compact",
    originView: null,
    seededDetailPage: false,
    reportReturn: null,
    navSeq: 0,
    lastTransition: null,
  })
}

describe("persistableEntry / persistableStack", () => {
  it("drops the cache-warming DTO payloads and keeps the addressing fields", () => {
    const entry = {
      kind: "person",
      id: "p1",
      title: "Ada",
      profileTab: "posts",
      peer: { id: "p1", name: "Ada" },
      reports: [{ id: "r1" }],
      event: { id: "e1" },
    } as unknown as DetailEntry
    expect(persistableEntry(entry)).toEqual({
      kind: "person",
      id: "p1",
      title: "Ada",
      profileTab: "posts",
    })
  })

  it("drops the unaddressable transient kinds", () => {
    const stack: DetailEntry[] = [
      { kind: "pin", id: "a" },
      { kind: "cluster" },
      { kind: "blend" },
      { kind: "drop-pin", lat: 1, lng: 2 },
      { kind: "person", id: "b" },
    ]
    expect(persistableStack(stack)).toEqual([
      { kind: "pin", id: "a" },
      { kind: "person", id: "b" },
    ])
  })
})

describe("takeNavSnapshot / restore", () => {
  beforeEach(resetStore)

  it("round-trips the navigable state and re-derives active and snap", () => {
    useNavStore.getState().selectView("events")
    useNavStore.getState().push({ kind: "cleanup", id: "c1" })
    useNavStore.getState().push({ kind: "person", id: "p1" })
    useNavStore.setState({ query: "park" })

    const snapshot = takeNavSnapshot(useNavStore.getState())
    expect(snapshot.v).toBe(1)
    expect(snapshot.view).toBe("events")
    expect(snapshot.originView).toBe("events")

    useNavStore.getState().reset()
    expect(useNavStore.getState().stack).toEqual([])

    useNavStore.getState().restore(snapshot)
    const s = useNavStore.getState()
    expect(s.view).toBe("events")
    expect(s.stack).toEqual([
      { kind: "cleanup", id: "c1" },
      { kind: "person", id: "p1" },
    ])
    expect(s.active).toEqual({ kind: "person", id: "p1" })
    expect(s.originView).toBe("events")
    expect(s.query).toBe("park")
    expect(s.seededDetailPage).toBe(false)
    expect(s.reportReturn).toBeNull()
    expect(s.snap).toBe(2)
    expect(s.snapAnimated).toBe(false)
    expect(s.lastTransition).toEqual({ type: "restore" })
  })

  it("restoring an empty stack nulls originView and leaves no active entry", () => {
    useNavStore.getState().push({ kind: "pin", id: "a" })
    useNavStore.getState().restore({
      v: 1,
      view: "map",
      stack: [],
      originView: "events",
      query: "",
      seededDetailPage: false,
      reportReturn: null,
    })
    const s = useNavStore.getState()
    expect(s.view).toBe("map")
    expect(s.active).toBeNull()
    expect(s.originView).toBeNull()
    expect(s.snap).toBe(0)
  })

  it("carries the report return across a restore", () => {
    const reportReturn = {
      view: "events" as const,
      stack: [{ kind: "cleanup" as const, id: "c1" }],
      originView: "events" as const,
      query: "",
      token: 7,
    }
    useNavStore.getState().restore({
      v: 1,
      view: "report",
      stack: [],
      originView: null,
      query: "",
      seededDetailPage: false,
      reportReturn,
    })
    expect(useNavStore.getState().reportReturn).toEqual(reportReturn)
  })
})

describe("persistableEntry keeps every identity field", () => {
  it("round-trips each ENTRY_IDENTITY_FIELDS key", () => {
    for (const field of ENTRY_IDENTITY_FIELDS) {
      const entry = { kind: "announcement", [field]: "x" } as unknown as DetailEntry
      expect(persistableEntry(entry)).toHaveProperty(field, "x")
    }
  })

  it("keeps an announcement's own id so its path and identity survive persistence", () => {
    const entry: DetailEntry = { kind: "announcement", id: "c1", announcementId: "a9" }
    const persisted = persistableEntry(entry)
    expect(persisted).toEqual(entry)
    expect(pathForEntry(persisted)).toBe("/cleanups/c1/announcements/a9")
    expect(entryIdentity(persisted)).toBe(entryIdentity(entry))
  })
})
