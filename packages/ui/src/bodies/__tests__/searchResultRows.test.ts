import { describe, expect, it } from "vitest"
import { groupSearchResults, searchResultRows } from "../search/searchResultsModel"

const hits = (events: string[], reports: string[], people: string[]) => ({
  events: events.map((id) => ({ id })),
  reports: reports.map((id) => ({ id })),
  people: people.map((id) => ({ id })),
})

describe("searchResultRows", () => {
  it("lists each group as its header then its hits, in the grouped order", () => {
    const rows = searchResultRows(hits(["e1", "e2"], ["r1"], ["p1"]), { show: false, loading: false })
    expect(rows.map((row) => row.key)).toEqual([
      "header:events",
      "event:e1",
      "event:e2",
      "header:reports",
      "report:r1",
      "header:people",
      "person:p1",
    ])
    const headers = rows.flatMap((row) => (row.kind === "header" ? [row.group] : []))
    expect(headers).toEqual(groupSearchResults(hits(["e1", "e2"], ["r1"], ["p1"])).map((group) => group.id))
  })

  it("spaces every hit after the first of its group, and none after a header", () => {
    const rows = searchResultRows(hits(["e1", "e2"], ["r1", "r2", "r3"], []), { show: false, loading: false })
    const gaps = rows.flatMap((row) => ("gapBefore" in row ? [[row.key, row.gapBefore]] : []))
    expect(gaps).toEqual([
      ["event:e1", false],
      ["event:e2", true],
      ["report:r1", false],
      ["report:r2", true],
      ["report:r3", true],
    ])
  })

  it("puts the report pager straight after the last report and carries its in-flight state", () => {
    const rows = searchResultRows(hits([], ["r1", "r2"], ["p1"]), { show: true, loading: true })
    const pager = rows.findIndex((row) => row.kind === "more-reports")
    expect(rows[pager - 1]?.key).toBe("report:r2")
    expect(rows[pager + 1]?.key).toBe("header:people")
    expect(rows[pager]).toEqual({ kind: "more-reports", key: "more:reports", loading: true })
  })

  it("offers no pager without reports, and none when the caller hides it", () => {
    expect(searchResultRows(hits(["e1"], [], []), { show: true, loading: false }).some((row) => row.kind === "more-reports")).toBe(false)
    expect(searchResultRows(hits([], ["r1"], []), { show: false, loading: false }).some((row) => row.kind === "more-reports")).toBe(false)
  })

  it("keeps keys unique when an event, a report and a person share an id", () => {
    const rows = searchResultRows(hits(["x"], ["x"], ["x"]), { show: true, loading: false })
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })

  it("draws nothing for no hits", () => {
    expect(searchResultRows(hits([], [], []), { show: true, loading: false })).toEqual([])
  })
})
