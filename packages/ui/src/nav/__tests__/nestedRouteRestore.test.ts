import { beforeEach, describe, expect, it } from "vitest"
import { useNavStore } from "../useNavStore"
import { seedFor } from "../routes"
import { fullEntryStack, pageLayerKey } from "../../shell/bodyLayout"
import type { DetailEntry, View } from "../types"

const dashboard: DetailEntry = { kind: "event-dashboard" }
const checkin: DetailEntry = { kind: "host-checkin", id: "e1" }

function layerKeys(): string[] {
  const { view, stack } = useNavStore.getState()
  return fullEntryStack(stack, true).map((entry, depth) => pageLayerKey(view, entry, depth))
}

function reset(): void {
  useNavStore.setState({
    view: "map",
    stack: [],
    active: null,
    snap: 0,
    query: "",
    mode: "compact",
    originView: null,
    seededDetailPage: false,
    reportReturn: null,
    navSeq: 0,
    lastTransition: null,
  })
}

describe("a host child opened from the event dashboard stays in the same shell", () => {
  beforeEach(reset)

  it("pops back onto the identical layer keys, so the dashboard body is never remounted", () => {
    useNavStore.getState().selectView("events")
    useNavStore.getState().push(dashboard)
    const parked = layerKeys()
    expect(parked).toHaveLength(1)

    useNavStore.getState().push(checkin)
    expect(layerKeys()).toEqual([...parked, expect.any(String)])
    expect(useNavStore.getState().lastTransition).toEqual({ type: "push" })

    useNavStore.getState().back()
    expect(layerKeys()).toEqual(parked)
    expect(useNavStore.getState().lastTransition).toEqual({ type: "pop", count: 1 })
  })

  it("never empties the stack in between, which is what flashed the home view", () => {
    useNavStore.getState().selectView("events")
    useNavStore.getState().push(dashboard)

    const depths: number[] = []
    const unsubscribe = useNavStore.subscribe((state) => depths.push(state.stack.length))
    useNavStore.getState().push(checkin)
    useNavStore.getState().back()
    unsubscribe()

    expect(depths).toEqual([2, 1])
  })
})

describe("seeding a nested route wipes the stack, which is why no shell kind may be bridged", () => {
  beforeEach(reset)

  it("replaces the whole stack rather than appending to it", () => {
    expect(seedFor(checkin, "compact", "events")).toEqual({ stack: [checkin], view: "events" })
  })

  it("restoring a wiped stack reads as a push and rebuilds the layer, remounting the body", () => {
    useNavStore.getState().selectView("events")
    useNavStore.getState().push(dashboard)
    const parked = layerKeys()

    useNavStore.getState().seed(checkin, "compact")
    expect(layerKeys()).not.toEqual(parked)

    useNavStore.getState().back()
    expect(useNavStore.getState().stack).toEqual([])
    expect(layerKeys()).toEqual([])

    useNavStore.getState().setStack([dashboard])
    expect(layerKeys()).toEqual(parked)
    expect(useNavStore.getState().lastTransition).toEqual({ type: "push" })
  })
})

describe("every shell view the dashboard family collapses to", () => {
  beforeEach(reset)

  it("collapses the dashboard to the events view instead of stranding it", () => {
    useNavStore.getState().selectView("home")
    useNavStore.getState().push(dashboard)
    useNavStore.setState({ originView: null })
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().view).toBe<View>("events")
    expect(useNavStore.getState().stack).toEqual([])
  })
})
