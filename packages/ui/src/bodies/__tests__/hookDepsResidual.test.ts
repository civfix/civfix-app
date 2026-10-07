import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

/** The dependency list of the hook call that closes the slice: the entries of its last `[...]`. */
function depsOf(hookSource: string): string[] {
  const open = hookSource.lastIndexOf("[")
  const close = hookSource.lastIndexOf("]")
  expect(open, "the slice no longer ends in a dependency array").toBeGreaterThan(-1)
  expect(close).toBeGreaterThan(open)
  return hookSource
    .slice(open + 1, close)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

describe("feed header re-renders on a scheme switch", () => {
  it("lists the themed styles it reads among the header memo's dependencies", () => {
    const header = sliceBetween(read("../FeedBody.tsx"), "const header = useMemo(", "const empty = useMemo(")
    expect(header).toContain("styles.header")
    expect(depsOf(header)).toContain("styles")
  })
})

describe("linked report row caches the report it fetched", () => {
  it("re-runs the cache write when the fetched report arrives or changes", () => {
    const effect = sliceBetween(read("../ReportLinkRow.tsx"), "useEffect(() => {", "const resolved")
    expect(effect).toContain("reportToCardData(query.data)")
    expect(depsOf(effect)).toEqual(["fetchedId", "query.data"])
  })
})

describe("reply dock keyboard listeners", () => {
  it("names the resting-height ref they read, which keeps them subscribed once per mount", () => {
    const effect = sliceBetween(
      read("../thread/useReplyDockInset.ts"),
      "useEffect(() => {",
      "const inset = Math.max",
    )
    expect(effect).toContain("restingWindowHeight.current")
    expect(depsOf(effect)).toEqual(["restingWindowHeight"])
  })
})

describe("memo inputs keep their identity between renders", () => {
  it("events list: the empty fallback is memoized with the query data", () => {
    expect(read("../EventsBody.tsx")).toContain("const all = useMemo(() => query.data ?? [], [query.data])")
  })

  it("native date and time rows: the Android dialog opener does not depend on a per-render date", () => {
    const src = read("../InlineDateTimePicker.native.tsx")
    const dateOpener = sliceBetween(src, "const openDialog = useCallback(", "return (")
    expect(depsOf(dateOpener)).toEqual(["commit", "minDate", "value"])
    const timeRow = src.slice(src.indexOf("export function TimeFieldRow("))
    const timeOpener = sliceBetween(timeRow, "const openDialog = useCallback(", "return (")
    expect(depsOf(timeOpener)).toEqual(["commit", "day", "locale", "minuteInterval", "value"])
  })

  it("report review: the draft point is memoized on its coordinates", () => {
    const review = sliceBetween(read("../reportFlow/ReviewStep.tsx"), "function ReviewStep(", "const addressResolution")
    expect(review).toContain("const point = useMemo(")
    expect(depsOf(sliceBetween(review, "const point = useMemo(", "const setLocation"))).toEqual([
      "draft.lat",
      "draft.lng",
    ])
  })
})

describe("report wizard resume target", () => {
  it("is read from the draft store, so it follows every draft field resumeStep reads", () => {
    const active = sliceBetween(read("../ReportFlowBody.tsx"), "const orphaned =", "const viewfinderVisible")
    expect(active).toContain("useDraftReportStore((s) => resumeStep(s.draft, mode))")
    expect(active).not.toContain("getState()")
  })
})

describe("ticking list time formatter", () => {
  it("derives a new formatter from each tick instead of listing an unread dependency", () => {
    const hook = sliceBetween(read("../useListTimeAgo.ts"), "export function useTickingListTimeAgo()", "\n}")
    expect(hook).toContain("formatterForTick(format, tick)")
    expect(depsOf(hook)).toEqual(["format", "tick"])
  })
})
