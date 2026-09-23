import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useNavStore } from "../../nav"
import type { DetailEntry, View } from "../../nav"
import { useMapFocus } from "../mapFocusStore"
import { useMapFlyTo } from "../mapFlyToStore"
import { disarmMapLeaveRelease, showOnMap } from "../showOnMapFlow"

const event = { kind: "cleanup" as const, id: "e1", lat: 34.05, lng: -118.24, eventKind: "cleanup" as const }
const report = { kind: "report" as const, id: "r1", lat: 34.06, lng: -118.25, category: "hazard" as const }

function seedNav(view: View, stack: DetailEntry[], mode: "compact" | "expanded"): void {
  useNavStore.setState({
    view,
    stack,
    active: stack.at(-1) ?? null,
    snap: 0,
    snapAnimated: true,
    query: "",
    mode,
    originView: stack.length > 0 ? view : null,
  })
}

beforeEach(() => {
  disarmMapLeaveRelease()
  useMapFocus.setState({ focus: null })
  useMapFlyTo.setState({ request: null, highlight: null })
})

afterEach(() => {
  disarmMapLeaveRelease()
})

describe("showOnMap: compact", () => {
  beforeEach(() => {
    seedNav("home", [{ kind: "cleanup", id: "e1" }], "compact")
  })

  it("publishes a fly-to request, not a focus, and switches to the Map tab", () => {
    showOnMap("compact", event)
    expect(useMapFlyTo.getState().request).toMatchObject({ kind: "cleanup", id: "e1", lat: 34.05, lng: -118.24 })
    expect(useMapFlyTo.getState().highlight).toEqual({ kind: "cleanup", id: "e1" })
    expect(useMapFocus.getState().focus).toBeNull()
    const nav = useNavStore.getState()
    expect(nav.view).toBe("map")
    expect(nav.stack).toEqual([])
  })

  it("publishes the request BEFORE the view flips, so a map mounting on the switch sees it", () => {
    let requestAtSwitch: unknown = "unset"
    const unsubscribe = useNavStore.subscribe((state, previous) => {
      if (state.view === "map" && previous.view !== "map") requestAtSwitch = useMapFlyTo.getState().request
    })
    showOnMap("compact", report)
    unsubscribe()
    expect(requestAtSwitch).toMatchObject({ kind: "report", id: "r1" })
  })

  it("the departing page's scoped release cannot touch the handoff", () => {
    showOnMap("compact", event)
    useMapFocus.getState().clearFor("e1")
    expect(useMapFlyTo.getState().highlight).toEqual({ kind: "cleanup", id: "e1" })
  })

  it("leaving the Map tab ends the highlight", () => {
    showOnMap("compact", event)
    useNavStore.getState().openDetail({ kind: "pin", id: "other" })
    expect(useMapFlyTo.getState().highlight).toEqual({ kind: "cleanup", id: "e1" })
    useNavStore.getState().selectView("home")
    expect(useMapFlyTo.getState().highlight).toBeNull()
    expect(useMapFlyTo.getState().request).toBeNull()
  })

  it("the leave release fires once, then a later visit keeps its own highlight", () => {
    showOnMap("compact", event)
    useNavStore.getState().selectView("home")
    useMapFlyTo.getState().requestFlyTo({ kind: "report", id: "r1", lat: 1, lng: 2 })
    useNavStore.getState().selectView("events")
    expect(useMapFlyTo.getState().highlight).toEqual({ kind: "report", id: "r1" })
  })
})

describe("showOnMap: expanded", () => {
  beforeEach(() => {
    seedNav("home", [{ kind: "pin", id: "r1" }], "expanded")
  })

  it("keeps the rail open with a page-owned focus and no fly-to request", () => {
    showOnMap("expanded", report)
    expect(useMapFocus.getState().focus).toEqual(report)
    expect(useMapFlyTo.getState().request).toBeNull()
    const nav = useNavStore.getState()
    expect(nav.view).toBe("home")
    expect(nav.stack).toEqual([{ kind: "pin", id: "r1" }])
    expect(nav.snap).toBe(1)
  })

  it("the page's own release still clears its focus", () => {
    showOnMap("expanded", report)
    useMapFocus.getState().clearFor("r1")
    expect(useMapFocus.getState().focus).toBeNull()
  })
})
