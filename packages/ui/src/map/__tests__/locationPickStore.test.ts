/**
 * Unit tests for the shared "pick a location on the main map" store (event-linking follow-up 2). Pure
 * zustand, so vitest exercises it directly (no RN renderer).
 *
 * Coverage:
 *   - defaults: inactive, no draft, no map registered.
 *   - start: seeds the draft (or null) and goes active.
 *   - setDraft: moves the pending point without ending the pick.
 *   - confirm / cancel: both END the pick (active false, draft null) - the picker reads `draft` before
 *     calling confirm, so the store never resolves onChange itself.
 *   - setMapRegistered: flips the main-map-available flag the picker reads to choose overlay vs inline.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { useLocationPick } from "../locationPickStore"

beforeEach(() => {
  useLocationPick.setState({ active: false, draft: null, mapRegistered: false })
})

describe("locationPickStore: defaults", () => {
  it("starts inactive, with no draft and no map registered", () => {
    const s = useLocationPick.getState()
    expect(s.active).toBe(false)
    expect(s.draft).toBeNull()
    expect(s.mapRegistered).toBe(false)
  })
})

describe("locationPickStore: start", () => {
  it("activates and seeds the draft from the initial point", () => {
    useLocationPick.getState().start({ lat: 40, lng: -75 })
    const s = useLocationPick.getState()
    expect(s.active).toBe(true)
    expect(s.draft).toEqual({ lat: 40, lng: -75 })
  })

  it("activates with a null draft when no initial point is given", () => {
    useLocationPick.getState().start()
    const s = useLocationPick.getState()
    expect(s.active).toBe(true)
    expect(s.draft).toBeNull()
  })
})

describe("locationPickStore: setDraft", () => {
  it("moves the pending point without ending the pick", () => {
    useLocationPick.getState().start(null)
    useLocationPick.getState().setDraft(12.5, -34.25)
    const s = useLocationPick.getState()
    expect(s.active).toBe(true)
    expect(s.draft).toEqual({ lat: 12.5, lng: -34.25 })
  })
})

describe("locationPickStore: confirm / cancel", () => {
  it("confirm ends the pick (active false, draft cleared)", () => {
    useLocationPick.getState().start({ lat: 1, lng: 2 })
    useLocationPick.getState().confirm()
    const s = useLocationPick.getState()
    expect(s.active).toBe(false)
    expect(s.draft).toBeNull()
  })

  it("cancel ends the pick (active false, draft cleared)", () => {
    useLocationPick.getState().start({ lat: 1, lng: 2 })
    useLocationPick.getState().cancel()
    const s = useLocationPick.getState()
    expect(s.active).toBe(false)
    expect(s.draft).toBeNull()
  })
})

describe("locationPickStore: setMapRegistered", () => {
  it("flips the main-map-available flag", () => {
    useLocationPick.getState().setMapRegistered(true)
    expect(useLocationPick.getState().mapRegistered).toBe(true)
    useLocationPick.getState().setMapRegistered(false)
    expect(useLocationPick.getState().mapRegistered).toBe(false)
  })
})
