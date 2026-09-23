import { describe, expect, it } from "vitest"
import { REPORT_TYPE_TO_CATEGORY, REPORT_TYPE_VALUES } from "@civfix/shared"
import { REPORT_TYPES, reportTypeById } from "../reportTypes"

describe("REPORT_TYPES", () => {
  it("lists the rows in the wizard's display order", () => {
    expect(REPORT_TYPES.map((row) => row.id)).toEqual([
      "dump",
      "encampment",
      "graffiti",
      "infrastructure",
      "pavement",
      "vegetation",
      "other",
    ])
  })

  it("covers every contract report type exactly once", () => {
    expect([...REPORT_TYPES.map((row) => row.id)].sort()).toEqual([...REPORT_TYPE_VALUES].sort())
  })

  it("takes each row's category from the contract mapping", () => {
    for (const row of REPORT_TYPES) {
      expect(row.category).toBe(REPORT_TYPE_TO_CATEGORY[row.id])
    }
    expect(Object.fromEntries(REPORT_TYPES.map((row) => [row.id, row.category]))).toEqual({
      dump: "trash",
      encampment: "encampment",
      graffiti: "graffiti",
      infrastructure: "water",
      pavement: "hazard",
      vegetation: "recycling",
      other: "other",
    })
  })

  it("pins the English label and sub line that double as the draft's default title", () => {
    expect(REPORT_TYPES.map((row) => [row.label, row.sub])).toEqual([
      ["Dump", "Illegal dumping, bulky items"],
      ["Encampment", "Unhoused encampment"],
      ["Graffiti", "Tags, vandalism"],
      ["Broken infrastructure", "Traffic light, streetlamp, flooding"],
      ["Pavement distress", "Pothole, bad sidewalk"],
      ["Overgrown vegetation", "Brush, weeds, blocked path"],
      ["Other", "Something else"],
    ])
  })

  it("marks only the Other row with the neutral glyph", () => {
    expect(REPORT_TYPES.filter((row) => row.glyph).map((row) => row.id)).toEqual(["other"])
    expect(REPORT_TYPES.find((row) => row.id === "dump")).not.toHaveProperty("glyph")
  })
})

describe("reportTypeById", () => {
  it("returns the row for a known id", () => {
    expect(reportTypeById("pavement")).toMatchObject({ id: "pavement", category: "hazard" })
  })

  it("returns the same object the list holds", () => {
    expect(reportTypeById("graffiti")).toBe(REPORT_TYPES.find((row) => row.id === "graffiti"))
  })

  it("returns undefined for null, undefined, an unknown id or a different case", () => {
    expect(reportTypeById(null)).toBeUndefined()
    expect(reportTypeById(undefined)).toBeUndefined()
    expect(reportTypeById("pothole")).toBeUndefined()
    expect(reportTypeById("Dump")).toBeUndefined()
    expect(reportTypeById("")).toBeUndefined()
  })
})
