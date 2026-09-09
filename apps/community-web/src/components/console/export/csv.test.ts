import { describe, expect, it } from "vitest"

import { csvFilename, csvString } from "./csv"
import { provenanceRows } from "./provenance"

const LABELS = {
  source: "Source",
  reference: "Reference",
  generatedAt: "Generated",
  filters: "Filters",
  none: "None",
  suppression: "Suppression k",
  note: "Note",
}

describe("csvString", () => {
  it("quotes cells containing a comma, a quote or a newline", () => {
    expect(csvString([["a,b"]])).toBe('"a,b"')
    expect(csvString([['say "hi"']])).toBe('"say ""hi"""')
    expect(csvString([["line1\nline2"]])).toBe('"line1\nline2"')
  })

  it("renders null and undefined as an empty cell, not the string null", () => {
    expect(csvString([["a", null, undefined, 0, false]])).toBe("a,,,0,false")
  })

  it("neutralizes spreadsheet formula injection", () => {
    expect(csvString([["=1+1"]])).toBe("'=1+1")
    expect(csvString([["+cmd"]])).toBe("'+cmd")
    expect(csvString([["-2"]])).toBe("'-2")
    expect(csvString([["@SUM(A1)"]])).toBe("'@SUM(A1)")
    expect(csvString([["=HYPERLINK(\"x\",\"y\")"]])).toBe(
      '"\'=HYPERLINK(""x"",""y"")"',
    )
  })

  it("leaves an ordinary value untouched", () => {
    expect(csvString([["Ann Rivera", 3]])).toBe("Ann Rivera,3")
  })

  it("joins rows with CRLF", () => {
    expect(csvString([["a"], ["b"]])).toBe("a\r\nb")
  })
})

describe("csvFilename", () => {
  it("slugifies the parts and stamps the date", () => {
    expect(csvFilename(["Creek Sweep!", "roster"], new Date("2026-03-04T12:00:00Z"))).toBe(
      "creek-sweep-roster-2026-03-04.csv",
    )
  })

  it("falls back to a generic name when nothing survives slugification", () => {
    expect(csvFilename(["***"], new Date("2026-03-04T00:00:00Z"))).toBe(
      "civfix-export-2026-03-04.csv",
    )
  })
})

describe("provenanceRows", () => {
  it("carries source, reference, generation time and the filters in force", () => {
    const rows = provenanceRows({
      title: "Creek Sweep — Registration",
      reference: "CF-123",
      generatedAt: "2026-03-04T12:00:00.000Z",
      generatedAtLabel: "4 Mar 2026, 12:00",
      filters: [{ label: "Range", value: "30 days" }],
      labels: LABELS,
    })
    const flat = csvString(rows)
    expect(flat).toContain("Source,Creek Sweep")
    expect(flat).toContain("Reference,CF-123")
    expect(flat).toContain("2026-03-04T12:00:00.000Z")
    expect(flat).toContain("Filters,Range=30 days")
  })

  it("states no filters explicitly rather than leaving the row blank", () => {
    const flat = csvString(provenanceRows({
      title: "t",
      generatedAt: "2026-03-04T12:00:00.000Z",
      generatedAtLabel: "x",
      labels: LABELS,
    }))
    expect(flat).toContain("Filters,None")
  })

  it("records the k-anonymity note when the source was suppressed", () => {
    const flat = csvString(provenanceRows({
      title: "t",
      generatedAt: "2026-03-04T12:00:00.000Z",
      generatedAtLabel: "x",
      suppressed: true,
      suppressionK: 5,
      notes: ["Blank cells are suppressed, not zero."],
      labels: LABELS,
    }))
    expect(flat).toContain("Suppression k,5")
    expect(flat).toContain('Note,"Blank cells are suppressed, not zero."')
  })

  it("ends with a blank separator row so the header is not glued to the provenance", () => {
    const rows = provenanceRows({
      title: "t",
      generatedAt: "2026-03-04T12:00:00.000Z",
      generatedAtLabel: "x",
      labels: LABELS,
    })
    expect(rows[rows.length - 1]).toEqual([])
  })
})
