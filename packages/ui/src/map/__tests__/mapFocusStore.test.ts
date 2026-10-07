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
 * `PageStack.native` keeps every stacked page mounted, so two focus-publishing bodies can share the one
 * focus slot. The `usePageIsActive()` gate is the protection; these tests pin the ownership check that
 * makes a late or out-of-order release harmless, not a sequence React emits today.
 */
describe("mapFocusStore: clearFor", () => {
  it("releases the focus when the caller still owns it", () => {
    useMapFocus.getState().setReport({ id: "r1", lat: 1, lng: 2, category: "hazard" })
    useMapFocus.getState().clearFor("r1")
    expect(useMapFocus.getState().focus).toBeNull()
  })

  it("is a NO-OP when someone else has taken the focus - the ownership guard", () => {
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
    // A stale release fires on every pop of a detail page, so it must cost the map no re-render.
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
 * Pinned by source because this package has no RN renderer. The `isActive` gate stops a buried page
 * asserting focus and the scoped release stops a departing page clearing what the survivor owns.
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
    // Unconditional on purpose: an event with no location leaves the map nothing to show, and this branch
    // runs only while the page is active.
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
