import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import * as model from "../reportPickerModel"

const surface = ["../ReportPicker.tsx", "../usePickerData.ts"]
  .map((rel) => readFileSync(new URL(rel, import.meta.url), "utf8"))
  .join("\n")

type Failures = (input: {
  regionError: boolean
  searching: boolean
  searchError: boolean
  lookupActive: boolean
  lookupError: boolean
  lookupErrorCode?: string
}) => { region: boolean; search: boolean; lookup: boolean }
const pickerQueryFailures = (model as unknown as { pickerQueryFailures?: Failures }).pickerQueryFailures

const quiet = {
  regionError: false,
  searching: true,
  searchError: false,
  lookupActive: true,
  lookupError: false,
}

describe("report picker query failures", () => {
  it("reports a failed search as a failure, so the list shows the error instead of no_match", () => {
    expect(typeof pickerQueryFailures).toBe("function")
    expect(pickerQueryFailures!({ ...quiet, searchError: true }).search).toBe(true)
    expect(
      model.pickerListState({
        hasRegion: true,
        pending: false,
        error: pickerQueryFailures!({ ...quiet, searchError: true }).search,
        searching: true,
        pinCount: 0,
        layerCount: 7,
        rowCount: 0,
      }),
    ).toBe("error")
  })

  it("ignores a stale search error once the query is too short to search", () => {
    expect(pickerQueryFailures!({ ...quiet, searching: false, searchError: true }).search).toBe(false)
  })

  it("treats a failed code lookup as a failure but NOT_FOUND as an honest no match", () => {
    expect(pickerQueryFailures!({ ...quiet, lookupError: true, lookupErrorCode: "INTERNAL" }).lookup).toBe(true)
    expect(pickerQueryFailures!({ ...quiet, lookupError: true, lookupErrorCode: "NOT_FOUND" }).lookup).toBe(false)
    expect(pickerQueryFailures!({ ...quiet, lookupActive: false, lookupError: true }).lookup).toBe(false)
  })

  it("feeds every failure into the list state and retries the queries that failed", () => {
    expect(surface).toContain("error: failed.region || failed.search || failed.lookup,")
    expect(surface).toContain("if (failed.search) search.refetch()")
    expect(surface).toContain("if (failed.lookup) void lookup.refetch()")
  })
})
