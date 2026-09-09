import { beforeEach, describe, expect, it } from "vitest"
import { useDroppedPin, DROPPED_PIN_PRECISION } from "../droppedPinStore"

beforeEach(() => {
  useDroppedPin.setState({ pin: null })
})

describe("droppedPinStore: defaults", () => {
  it("starts with no dropped pin", () => {
    expect(useDroppedPin.getState().pin).toBeNull()
  })

  it("normalises to 6 decimal places (~11cm)", () => {
    expect(DROPPED_PIN_PRECISION).toBe(6)
  })
})

describe("droppedPinStore: drop", () => {
  it("stores the pressed coordinate", () => {
    useDroppedPin.getState().drop(34.05, -118.24)
    expect(useDroppedPin.getState().pin).toEqual({ lat: 34.05, lng: -118.24 })
  })

  it("rounds both axes to 6dp so the two map seams' projections agree", () => {
    useDroppedPin.getState().drop(37.77491234567, -122.41939876543)
    expect(useDroppedPin.getState().pin).toEqual({ lat: 37.774912, lng: -122.419399 })
  })

  it("rounds half away from zero at the 7th place", () => {
    useDroppedPin.getState().drop(1.00000050001, 2.0000004)
    expect(useDroppedPin.getState().pin).toEqual({ lat: 1.000001, lng: 2 })
  })

  it("normalises a rounded -0 to 0 so idempotence is not defeated by the sign bit", () => {
    useDroppedPin.getState().drop(-0.0000001, 0)
    const pin = useDroppedPin.getState().pin
    expect(pin).toEqual({ lat: 0, lng: 0 })
    expect(Object.is(pin?.lat, -0)).toBe(false)
  })

  it("MOVES the pin when a different point is dropped", () => {
    useDroppedPin.getState().drop(34.05, -118.24)
    useDroppedPin.getState().drop(40.7128, -74.006)
    expect(useDroppedPin.getState().pin).toEqual({ lat: 40.7128, lng: -74.006 })
  })

  it("is IDEMPOTENT at 6dp: re-dropping the same point keeps the SAME object identity", () => {
    useDroppedPin.getState().drop(37.7749, -122.4194)
    const first = useDroppedPin.getState().pin
    // Sub-6dp jitter (a StrictMode re-invoke replaying a slightly different double) must not churn.
    useDroppedPin.getState().drop(37.77490000001, -122.41940000004)
    expect(useDroppedPin.getState().pin).toBe(first)
  })
})

describe("droppedPinStore: clear", () => {
  it("removes the pin", () => {
    useDroppedPin.getState().drop(34.05, -118.24)
    useDroppedPin.getState().clear()
    expect(useDroppedPin.getState().pin).toBeNull()
  })

  it("is a no-op when nothing is dropped", () => {
    useDroppedPin.getState().clear()
    expect(useDroppedPin.getState().pin).toBeNull()
  })
})
