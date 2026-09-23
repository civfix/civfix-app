import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import { useMapFocus } from "../mapFocusStore"

beforeEach(() => {
  useMapFocus.setState({ focus: null })
})

describe("mapFocusStore: defaults", () => {
  it("starts with no focused entity", () => {
    expect(useMapFocus.getState().focus).toBeNull()
  })
})

describe("mapFocusStore: setReport", () => {
  it("stores the focused report (kind report, id, coordinate, category)", () => {
    useMapFocus.getState().setReport({ id: "r1", lat: 34.05, lng: -118.24, category: "hazard" })
    expect(useMapFocus.getState().focus).toEqual({
      kind: "report",
      id: "r1",
      lat: 34.05,
      lng: -118.24,
      category: "hazard",
    })
  })

  it("replaces the focus when a different report is set", () => {
    useMapFocus.getState().setReport({ id: "r1", lat: 1, lng: 2, category: "hazard" })
    useMapFocus.getState().setReport({ id: "r2", lat: 40.71, lng: -74, category: "graffiti" })
    expect(useMapFocus.getState().focus).toEqual({
      kind: "report",
      id: "r2",
      lat: 40.71,
      lng: -74,
      category: "graffiti",
    })
  })
})

describe("mapFocusStore: setEvent", () => {
  it("stores the focused event (kind cleanup, id, coordinate, eventKind)", () => {
    useMapFocus.getState().setEvent({ id: "e1", lat: 34.05, lng: -118.24, eventKind: "cleanup" })
    expect(useMapFocus.getState().focus).toEqual({
      kind: "cleanup",
      id: "e1",
      lat: 34.05,
      lng: -118.24,
      eventKind: "cleanup",
    })
  })

  it("replaces a focused report with a focused event", () => {
    useMapFocus.getState().setReport({ id: "r1", lat: 1, lng: 2, category: "hazard" })
    useMapFocus.getState().setEvent({ id: "e1", lat: 3, lng: 4, eventKind: "other_volunteer" })
    expect(useMapFocus.getState().focus).toEqual({
      kind: "cleanup",
      id: "e1",
      lat: 3,
      lng: 4,
      eventKind: "other_volunteer",
    })
  })
})

describe("mapFocusStore: clear", () => {
  it("drops the focus back to null", () => {
    useMapFocus.getState().setReport({ id: "r1", lat: 1, lng: 2, category: "hazard" })
    useMapFocus.getState().clear()
    expect(useMapFocus.getState().focus).toBeNull()
  })
})

/**
 * `clearFor` - the OWNERSHIP guard retained page layers made worth having.
 *
 * `shell/PageStack.native` keeps every page on the nav stack MOUNTED so a pop can reveal its parent, so
 * two focus-publishing bodies (ReportDetailBody / EventDetailBody) can be mounted at once over this ONE
 * focus slot.
 *
 * WHAT THIS IS NOT. It is not the thing that fixes the pop: React flushes a commit's passive effects in
 * two whole-tree passes - every cleanup (`commitPassiveUnmountOnFiber`) then every create
 * (`commitPassiveMountOnFiber`) - so the departing page's release always lands BEFORE the revealed page
 * re-asserts, and the `usePageIsActive()` gate means a buried or leaving layer registers no cleanup at
 * all. The gate is the protection; this is the ownership check that makes a LATE or out-of-order release
 * harmless whatever produces one. These tests pin that property, not a sequence React can emit.
 */
describe("mapFocusStore: clearFor", () => {
  it("releases the focus when the caller still owns it", () => {
    useMapFocus.getState().setReport({ id: "r1", lat: 1, lng: 2, category: "hazard" })
    useMapFocus.getState().clearFor("r1")
    expect(useMapFocus.getState().focus).toBeNull()
  })

  it("is a NO-OP when someone else has taken the focus - the ownership guard", () => {
    // A release that lands AFTER another body has claimed the slot must not wipe it, whatever produced
    // that ordering. (Not the pop: see the suite doc - a pop's cleanup runs before any create.)
    useMapFocus.getState().setReport({ id: "child", lat: 1, lng: 2, category: "hazard" })
    useMapFocus.getState().setReport({ id: "parent", lat: 3, lng: 4, category: "graffiti" })
    useMapFocus.getState().clearFor("child")
    expect(useMapFocus.getState().focus).toEqual({
      kind: "report",
      id: "parent",
      lat: 3,
      lng: 4,
      category: "graffiti",
    })
  })

  it("does not NOTIFY subscribers on a stale release", () => {
    // The guard is a `get()` test rather than "return the state unchanged from set", so a stale release
    // costs the map no re-render at all - which matters because it fires on every pop of a detail page.
    useMapFocus.getState().setReport({ id: "parent", lat: 3, lng: 4, category: "graffiti" })
    let notifications = 0
    const unsubscribe = useMapFocus.subscribe(() => {
      notifications += 1
    })
    useMapFocus.getState().clearFor("child")
    expect(notifications).toBe(0)
    useMapFocus.getState().clearFor("parent")
    expect(notifications).toBe(1)
    unsubscribe()
  })

  it("matches by id across KINDS - one slot, so a report and an event share the namespace", () => {
    useMapFocus.getState().setEvent({ id: "x", lat: 1, lng: 2, eventKind: "cleanup" })
    useMapFocus.getState().clearFor("x")
    expect(useMapFocus.getState().focus).toBeNull()
  })

  it("is safe with nothing focused at all", () => {
    useMapFocus.getState().clearFor("r1")
    expect(useMapFocus.getState().focus).toBeNull()
  })
})

/**
 * The two callers, pinned by source assertion: this package has no RN renderer, so "does the cleanup use
 * the scoped release" cannot be observed by executing the bodies. Both halves matter - the `isActive`
 * gate stops a BURIED page asserting focus, and the scoped release stops a DEPARTING page clearing what
 * the surviving one owns - so both are asserted, per body.
 */
describe("mapFocusStore: the retained-layer contract, at its two call sites", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

  it("ReportDetailBody gates on usePageIsActive and releases by id", () => {
    const src = read("../../bodies/ReportDetailBody.tsx")
    expect(src).toContain("const isActive = usePageIsActive()")
    expect(src).toContain("return () => useMapFocus.getState().clearFor(report.id)")
    expect(src).not.toMatch(/=> useMapFocus\.getState\(\)\.clear\(\)/)
  })

  it("EventDetailBody gates on usePageIsActive and releases by id", () => {
    const src = read("../../bodies/EventDetailBody.tsx")
    expect(src).toContain("const isActive = usePageIsActive()")
    expect(src).toContain("return () => useMapFocus.getState().clearFor(cleanup.id)")
    // Its no-coords branch keeps the UNCONDITIONAL clear on purpose: "this event has no location" really
    // does mean the map has nothing to show, and it only runs while this page is the active one.
    expect(src).toContain("useMapFocus.getState().clear()")
  })
})

describe("mapFocusStore: re-publish", () => {
  it("every publish is a fresh object, so a re-publish of the same pin still notifies the map", () => {
    const input = { id: "r1", lat: 34.05, lng: -118.24, category: "hazard" as const }
    useMapFocus.getState().setReport(input)
    const a = useMapFocus.getState().focus
    useMapFocus.getState().setReport(input)
    const b = useMapFocus.getState().focus
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })
})
