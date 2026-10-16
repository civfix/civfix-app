import { beforeEach, describe, expect, it } from "vitest"
import { needsDuplicateCheck, useDraftReportStore } from "../draftStore"

const A = { lat: 34.1, lng: -118.3 }
const B = { lat: 34.1002, lng: -118.3 }

const store = () => useDraftReportStore.getState()
const needsCheck = () => needsDuplicateCheck(store().draft)

describe("the draft's duplicate-checked point", () => {
  beforeEach(() => store().reset())

  it("T10: a point that was never checked needs a check", () => {
    store().setLocation(A.lat, A.lng, "manual")
    expect(store().draft.duplicateCheckedPoint).toBeNull()
    expect(needsCheck()).toBe(true)
  })

  it("T11: the checked point needs no check", () => {
    store().setLocation(A.lat, A.lng, "manual")
    store().setDuplicateCheckedPoint(A)
    expect(store().draft.duplicateCheckedPoint).toEqual(A)
    expect(needsCheck()).toBe(false)
  })

  it("T12: moving the point after its check needs a check again", () => {
    store().setLocation(A.lat, A.lng, "manual")
    store().setDuplicateCheckedPoint(A)
    store().setLocation(B.lat, B.lng, "manual")
    expect(needsCheck()).toBe(true)
  })

  it("T13: only the last checked point counts, so moving back to an earlier one checks again", () => {
    store().setLocation(A.lat, A.lng, "manual")
    store().setDuplicateCheckedPoint(A)
    store().setLocation(B.lat, B.lng, "manual")
    store().setDuplicateCheckedPoint(B)
    store().setLocation(A.lat, A.lng, "manual")
    expect(store().draft.duplicateCheckedPoint).toEqual(B)
    expect(needsCheck()).toBe(true)
  })

  it("T14: a draft without a point needs no check", () => {
    expect(store().draft.lat).toBeNull()
    expect(store().draft.lng).toBeNull()
    expect(needsCheck()).toBe(false)
  })

  it("T15: reset forgets the checked point", () => {
    store().setLocation(A.lat, A.lng, "manual")
    store().setDuplicateCheckedPoint(A)
    store().reset()
    expect(store().draft.duplicateCheckedPoint).toBeNull()
  })
})
