import { describe, expect, it } from "vitest"
import { REPORT_TYPE_TO_CATEGORY, REPORT_TYPE_VALUES } from "@civfix/contract"
import { REPORT_TYPES } from "../reportTypes"
import enums from "../../i18n/locales/en/enums.json"
import wizard from "../../i18n/locales/en/report-wizard.json"

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

  it("pins the English label and sub line, the label doubling as the draft's default title", () => {
    expect(REPORT_TYPES.map((row) => [enums.reportType[row.id], wizard.types[row.id].sub])).toEqual([
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
