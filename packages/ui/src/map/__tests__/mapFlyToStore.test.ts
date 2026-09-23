import { beforeEach, describe, expect, it } from "vitest"
import { useMapFlyTo } from "../mapFlyToStore"

const target = { kind: "cleanup" as const, id: "e1", lat: 34.05, lng: -118.24, eventKind: "cleanup" as const }
const reportTarget = { kind: "report" as const, id: "r1", lat: 34.06, lng: -118.25, category: "hazard" as const }

beforeEach(() => {
  useMapFlyTo.setState({ request: null, highlight: null })
})

describe("mapFlyToStore", () => {
  it("starts idle", () => {
    expect(useMapFlyTo.getState().request).toBeNull()
    expect(useMapFlyTo.getState().highlight).toBeNull()
  })

  it("publishes a request and a highlight for the same pin", () => {
    useMapFlyTo.getState().requestFlyTo(target)
    expect(useMapFlyTo.getState().request).toMatchObject(target)
    expect(useMapFlyTo.getState().highlight).toEqual(target)
  })

  it("carries the pin styling on both, so the map can draw a target it has not loaded", () => {
    useMapFlyTo.getState().requestFlyTo(target)
    expect(useMapFlyTo.getState().request).toMatchObject({ eventKind: "cleanup" })
    expect(useMapFlyTo.getState().highlight).toMatchObject({ eventKind: "cleanup", lat: 34.05, lng: -118.24 })
    useMapFlyTo.getState().requestFlyTo(reportTarget)
    expect(useMapFlyTo.getState().request).toMatchObject({ category: "hazard" })
    expect(useMapFlyTo.getState().highlight).toEqual(reportTarget)
  })

  it("consume drops the request once and keeps the highlight, so the camera never replays", () => {
    useMapFlyTo.getState().requestFlyTo(target)
    const generation = useMapFlyTo.getState().request!.generation
    useMapFlyTo.getState().consume(generation)
    expect(useMapFlyTo.getState().request).toBeNull()
    expect(useMapFlyTo.getState().highlight).toEqual(target)
    let notifications = 0
    const unsubscribe = useMapFlyTo.subscribe(() => {
      notifications += 1
    })
    useMapFlyTo.getState().consume(generation)
    expect(notifications).toBe(0)
    unsubscribe()
  })

  it("a stale consume cannot swallow a newer request", () => {
    useMapFlyTo.getState().requestFlyTo(target)
    const first = useMapFlyTo.getState().request!.generation
    useMapFlyTo.getState().requestFlyTo({ ...target, id: "e2" })
    useMapFlyTo.getState().consume(first)
    expect(useMapFlyTo.getState().request).toMatchObject({ id: "e2" })
    expect(useMapFlyTo.getState().request!.generation).toBeGreaterThan(first)
  })

  it("re-requesting the same pin is a fresh request", () => {
    useMapFlyTo.getState().requestFlyTo(target)
    const first = useMapFlyTo.getState().request
    useMapFlyTo.getState().consume(first!.generation)
    useMapFlyTo.getState().requestFlyTo(target)
    expect(useMapFlyTo.getState().request).not.toBeNull()
    expect(useMapFlyTo.getState().request).not.toBe(first)
  })

  it("clear ends the highlight and any pending request, and is silent when idle", () => {
    useMapFlyTo.getState().requestFlyTo(target)
    useMapFlyTo.getState().clear()
    expect(useMapFlyTo.getState().request).toBeNull()
    expect(useMapFlyTo.getState().highlight).toBeNull()
    let notifications = 0
    const unsubscribe = useMapFlyTo.subscribe(() => {
      notifications += 1
    })
    useMapFlyTo.getState().clear()
    expect(notifications).toBe(0)
    unsubscribe()
  })
})
