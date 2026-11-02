import { describe, expect, it } from "vitest"
import { haversineMeters } from "@civfix/contract"
import { createI18n } from "../../../i18n/config"
import { duplicateDistance, duplicateMatches, stepChecksDuplicates } from "../duplicateModel"
import { exactlyNorthOf, northOf, pinAt } from "./duplicateTestPoints"

const CENTER = { lat: 34.1, lng: -118.3 }

describe("duplicateMatches", () => {
  it("T1: keeps open pins within 20 m, nearest first, and drops resolved and farther ones", () => {
    const pins = [
      pinAt("far", northOf(CENTER, 60)),
      pinAt("resolved", northOf(CENTER, 5), "resolved"),
      pinAt("in-progress", northOf(CENTER, 19.9), "in_progress"),
      pinAt("acknowledged", northOf(CENTER, 15), "acknowledged"),
      pinAt("published", northOf(CENTER, 10)),
    ]
    expect(duplicateMatches(pins, CENTER).map((row) => row.pin.id)).toEqual([
      "published",
      "acknowledged",
      "in-progress",
    ])
  })

  it("T2: includes a pin at exactly 20.0 m and excludes one at 20.5 m", () => {
    // The equator, because no double near 34.1° N lies exactly 20 m north of it.
    const center = { lat: 0, lng: 0 }
    const edge = exactlyNorthOf(center, 20)
    expect(haversineMeters(center, edge)).toBe(20)
    const pins = [pinAt("edge", edge), pinAt("past", northOf(center, 20.5))]
    expect(duplicateMatches(pins, center).map((row) => row.pin.id)).toEqual(["edge"])
  })

  it("T3: matches nothing in a status that is not open", () => {
    const pins = [
      pinAt("submitted", northOf(CENTER, 3), "submitted"),
      pinAt("held", northOf(CENTER, 6), "held"),
      pinAt("resolved", northOf(CENTER, 9), "resolved"),
      pinAt("rejected", northOf(CENTER, 12), "rejected"),
    ]
    expect(duplicateMatches(pins, CENTER)).toEqual([])
  })

  it("T4: lists at most 5, the nearest, ascending", () => {
    const pins = [14, 12, 10, 8, 6, 4, 2].map((m) => pinAt(`m${m}`, northOf(CENTER, m)))
    const rows = duplicateMatches(pins, CENTER)
    expect(rows.map((row) => row.pin.id)).toEqual(["m2", "m4", "m6", "m8", "m10"])
    expect(rows.map((row) => Math.round(row.distanceM))).toEqual([2, 4, 6, 8, 10])
  })

  it("T5: matches nothing when there are no pins", () => {
    expect(duplicateMatches([], CENTER)).toEqual([])
  })

  it("T6: keeps the caller's own open report, since a pin carries no owner", () => {
    const own = pinAt("mine", northOf(CENTER, 8))
    expect(duplicateMatches([own], CENTER).map((row) => row.pin)).toEqual([own])
  })
})

describe("duplicateDistance", () => {
  it("T7: reads close under 5 m", () => {
    expect(duplicateDistance(0)).toEqual({ key: "close" })
    expect(duplicateDistance(4.99)).toEqual({ key: "close" })
  })

  it("T8: reads about N m from 5 m, rounded to the nearest 5 m", () => {
    const cases: Array<[number, number]> = [
      [5, 5],
      [7.49, 5],
      [7.5, 10],
      [12.49, 10],
      [17.5, 20],
      [20, 20],
    ]
    for (const [meters, about] of cases) {
      expect(duplicateDistance(meters)).toEqual({ key: "about", meters: about })
    }
    const { t } = createI18n("en")
    expect(t("report-wizard:wizard.duplicate.distance_about", { meters: 10 })).toBe(
      "About 10 m away",
    )
    expect(t("report-wizard:wizard.duplicate.distance_close")).toBe("Less than 5 m away")
  })
})

describe("report-row:confirm_count", () => {
  it("T9: counts neighbors in the en catalog, singular and plural", () => {
    const { t } = createI18n("en")
    expect(t("report-row:confirm_count", { count: 1 })).toBe("1 neighbor confirmed this")
    expect(t("report-row:confirm_count", { count: 12 })).toBe("12 neighbors confirmed this")
  })
})

describe("stepChecksDuplicates", () => {
  it("checks when leaving capture, location or review on compact, and only on review on expanded", () => {
    const steps = ["capture", "location", "category", "details", "review"] as const
    expect(steps.filter((step) => stepChecksDuplicates(step, "compact"))).toEqual([
      "capture",
      "location",
      "review",
    ])
    expect(steps.filter((step) => stepChecksDuplicates(step, "expanded"))).toEqual(["review"])
  })
})
