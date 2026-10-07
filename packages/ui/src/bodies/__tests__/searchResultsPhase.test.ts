import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  filterEventHits,
  groupSearchResults,
  isSearchSourceSettled,
  searchAnnouncement,
  searchResultsView,
  searchSourcesSettled,
  selectSearchHits,
  type SearchSourceState,
} from "../search/searchResultsModel"

function source(over: Partial<SearchSourceState> = {}): SearchSourceState {
  return { enabled: true, matchesQuery: true, fetching: false, errored: false, ...over }
}

describe("search source settling", () => {
  it("counts a disabled source as settled so a signed-out viewer never waits on people", () => {
    expect(isSearchSourceSettled(source({ enabled: false, matchesQuery: false, fetching: true }))).toBe(true)
  })

  it("is unsettled while a source still answers the PREVIOUS query", () => {
    expect(isSearchSourceSettled(source({ matchesQuery: false }))).toBe(false)
  })

  it("is unsettled while a source is in flight", () => {
    expect(isSearchSourceSettled(source({ fetching: true }))).toBe(false)
  })

  it("treats a failed source as settled even mid-retry, so a retry cannot hold the spinner open", () => {
    expect(isSearchSourceSettled(source({ errored: true }))).toBe(true)
    expect(isSearchSourceSettled(source({ errored: true, fetching: true }))).toBe(true)
  })

  it("does NOT let a failure on the PREVIOUS query count as an answer for the new one", () => {
    expect(isSearchSourceSettled(source({ errored: true, matchesQuery: false }))).toBe(false)
    expect(isSearchSourceSettled(source({ errored: true, matchesQuery: false, fetching: true }))).toBe(false)
  })

  it("settles only once EVERY source has settled", () => {
    expect(searchSourcesSettled([source(), source({ fetching: true }), source()])).toBe(false)
    expect(searchSourcesSettled([source(), source(), source()])).toBe(true)
  })
})

describe("search results phase", () => {
  it("shows ONE loading state while any source is in flight with nothing to render", () => {
    expect(searchResultsView([source(), source({ fetching: true })], 0)).toEqual({
      phase: "loading",
      settled: false,
      showErrorNotice: false,
    })
  })

  it("never flashes the empty state before every constituent query has settled", () => {
    const stillDebouncing = searchResultsView([source({ matchesQuery: false }), source()], 0)
    expect(stillDebouncing.phase).toBe("loading")
    expect(stillDebouncing.phase).not.toBe("empty")
  })

  it("reports the empty state only once everything settled with no hits", () => {
    expect(searchResultsView([source(), source(), source()], 0)).toEqual({
      phase: "empty",
      settled: true,
      showErrorNotice: false,
    })
  })

  it("keeps rendering results while the next search is in flight, instead of blanking to a spinner", () => {
    const view = searchResultsView([source({ matchesQuery: false, fetching: true }), source()], 3)
    expect(view.phase).toBe("results")
    expect(view.settled).toBe(false)
  })

  it("goes to the terminal error state only when EVERY source failed", () => {
    expect(searchResultsView([source({ errored: true }), source({ errored: true })], 0).phase).toBe("error")
  })

  it("never turns one source's failure into a whole-surface outage over a truthful empty", () => {
    const view = searchResultsView([source({ errored: true }), source()], 0)
    expect(view.phase).toBe("empty")
    expect(view.showErrorNotice).toBe(true)
  })

  it("holds the error state back until every source has settled", () => {
    expect(searchResultsView([source({ errored: true }), source({ fetching: true })], 0).phase).toBe("loading")
  })

  it("keeps a partial failure visible as a notice above the results that did land", () => {
    const view = searchResultsView([source({ errored: true }), source()], 2)
    expect(view).toEqual({ phase: "results", settled: true, showErrorNotice: true })
  })

  it("suppresses the partial-failure notice while the surface is still unsettled", () => {
    expect(searchResultsView([source({ errored: true }), source({ fetching: true })], 2).showErrorNotice).toBe(
      false,
    )
  })

  it("ignores a disabled source's error, which is a stale flag from a query that is not running", () => {
    const view = searchResultsView([source({ enabled: false, errored: true }), source()], 0)
    expect(view.phase).toBe("empty")
    expect(view.showErrorNotice).toBe(false)
  })
})

describe("search settle announcement", () => {
  const settledEmpty = searchResultsView([source(), source()], 0)
  const settledResults = searchResultsView([source(), source()], 4)
  const unsettled = searchResultsView([source({ fetching: true }), source()], 4)

  it("says nothing while the surface is unsettled, so typing cannot narrate stale counts", () => {
    expect(searchAnnouncement(unsettled, "park", 4)).toBeNull()
  })

  it("says nothing for the error phase, which speaks through its own block", () => {
    expect(searchAnnouncement(searchResultsView([source({ errored: true })], 0), "park", 0)).toBeNull()
  })

  it("keys the results announcement on the query AND the count, so it repeats for neither", () => {
    expect(searchAnnouncement(settledResults, "park", 4)).toEqual({
      kind: "results",
      key: "results:park:4",
    })
    expect(searchAnnouncement(settledResults, "park", 4)?.key).toBe(
      searchAnnouncement(settledResults, "park", 4)?.key,
    )
    expect(searchAnnouncement(settledResults, "parks", 4)?.key).not.toBe(
      searchAnnouncement(settledResults, "park", 4)?.key,
    )
  })

  it("keys the empty announcement on the query alone", () => {
    expect(searchAnnouncement(settledEmpty, "zzz", 0)).toEqual({ kind: "empty", key: "empty:zzz" })
  })
})

describe("event hit filtering", () => {
  const events = [
    { id: "a", title: "Echo Park cleanup", address: "Glendale Blvd" },
    { id: "b", title: "Beach sweep", address: null },
  ]

  it("matches on title or address, case-insensitively", () => {
    expect(filterEventHits(events, "echo").map((e) => e.id)).toEqual(["a"])
    expect(filterEventHits(events, "GLENDALE").map((e) => e.id)).toEqual(["a"])
  })

  it("matches nothing for a blank query rather than returning the whole list", () => {
    expect(filterEventHits(events, "   ")).toEqual([])
  })
})

interface Hits {
  events: readonly { id: string }[]
  reports: readonly { id: string }[]
  people: readonly { id: string }[]
}

const NO_HITS: Hits = { events: [], reports: [], people: [] }

const CACHED_EVENTS = [
  { id: "e1", title: "Park cleanup", address: null },
  { id: "e2", title: "Playground repair", address: null },
]

interface Keystroke {
  rawQuery: string
  debouncedQuery: string
  reportsFetching: boolean
  reports?: readonly { id: string }[]
}

function runKeystrokes(steps: readonly Keystroke[]) {
  let held: Hits = NO_HITS
  return steps.map((step) => {
    const sources: SearchSourceState[] = [
      { enabled: true, matchesQuery: true, fetching: false, errored: false },
      {
        enabled: true,
        matchesQuery: step.debouncedQuery === step.rawQuery,
        fetching: step.reportsFetching,
        errored: false,
      },
      { enabled: false, matchesQuery: false, fetching: false, errored: false },
    ]
    const live: Hits = {
      events: filterEventHits(CACHED_EVENTS, step.rawQuery),
      reports: step.reports ?? [],
      people: [],
    }
    const liveCount = live.events.length + live.reports.length + live.people.length
    const settled = searchSourcesSettled(sources)
    const selection = selectSearchHits(live, held, liveCount, settled)
    if (selection.record) held = live
    const hitCount = groupSearchResults(selection.hits).reduce((n, group) => n + group.count, 0)
    return { phase: searchResultsView(sources, hitCount).phase, hits: selection.hits }
  })
}

describe("a keystroke sequence over a warm cache never regresses to a spinner", () => {
  it("holds the painted surface across the debounce tick and lands on the CURRENT query's events", () => {
    const frames = runKeystrokes([
      { rawQuery: "p", debouncedQuery: "p", reportsFetching: true },
      { rawQuery: "park", debouncedQuery: "p", reportsFetching: true },
      { rawQuery: "park", debouncedQuery: "park", reportsFetching: true },
      { rawQuery: "park", debouncedQuery: "park", reportsFetching: false },
    ])
    expect(frames.map((frame) => frame.phase)).toEqual(["results", "results", "results", "results"])
    expect(frames.map((frame) => frame.hits.events.map((event) => event.id))).toEqual([
      ["e1", "e2"],
      ["e1"],
      ["e1"],
      ["e1"],
    ])
  })

  it("falls back to the RECORDED hits, not to nothing, when the live set empties mid-flight", () => {
    const frames = runKeystrokes([
      { rawQuery: "p", debouncedQuery: "p", reportsFetching: true },
      { rawQuery: "zzz", debouncedQuery: "p", reportsFetching: true },
      { rawQuery: "zzz", debouncedQuery: "zzz", reportsFetching: true },
      { rawQuery: "zzz", debouncedQuery: "zzz", reportsFetching: false },
    ])
    expect(frames.map((frame) => frame.phase)).toEqual(["results", "results", "results", "empty"])
    expect(frames.map((frame) => frame.hits.events.map((event) => event.id))).toEqual([
      ["e1", "e2"],
      ["e1", "e2"],
      ["e1", "e2"],
      [],
    ])
  })

  it("shows the spinner exactly once, on a cold first search, and never again", () => {
    const frames = runKeystrokes([
      { rawQuery: "zzz", debouncedQuery: "zzz", reportsFetching: true },
      { rawQuery: "zzz", debouncedQuery: "zzz", reportsFetching: false, reports: [{ id: "r1" }] },
      { rawQuery: "zzzz", debouncedQuery: "zzz", reportsFetching: true },
      { rawQuery: "zzzz", debouncedQuery: "zzzz", reportsFetching: true },
      { rawQuery: "zzzz", debouncedQuery: "zzzz", reportsFetching: false },
    ])
    expect(frames.map((frame) => frame.phase)).toEqual([
      "loading",
      "results",
      "results",
      "results",
      "empty",
    ])
  })
})

describe("SearchResults renders one coherent state at a time", () => {
  const source = readFileSync(new URL("../search/SearchResults.tsx", import.meta.url), "utf8")
  const model = readFileSync(new URL("../search/searchResultsModel.ts", import.meta.url), "utf8")

  it("gates every section header on the SETTLED results phase, never on a per-query flag", () => {
    expect(source).toMatch(/data=\{view\.phase === "results" \? rows : NO_ROWS\}/)
    for (const section of ["events", "reports", "people"]) {
      expect(model).toMatch(new RegExp(`if \\(hits\\.${section}\\.length > 0\\) \\{`))
    }
    expect(source).not.toMatch(/peopleLoading/)
    expect(source).not.toMatch(/anyLoading/)
    expect(source).not.toMatch(/SectionHeader title=\{t\("results\.people"\)\} \/>\s*<View style=\{styles\.group\}>\{peopleLoading/)
  })

  it("keeps section headers out of the DOM until the phase says results", () => {
    const sectionHeaders = [...source.matchAll(/<SectionHeader\b/g)]
    expect(sectionHeaders).toHaveLength(1)
    const renderItem = source.slice(source.indexOf("const renderItem = useCallback("), source.indexOf("const phaseState ="))
    expect(renderItem).toMatch(/case "header":\s*return \(\s*<SectionHeader\b/)
    for (const key of ["results.events", "results.reports", "results.people"]) {
      expect(renderItem).toContain(`t("${key}")`)
    }
    expect(source.match(/renderItem=\{/g) ?? []).toHaveLength(1)
    expect(source).toContain("renderItem={renderItem}")
  })

  it("shows result-shaped skeleton rows while loading - never a bare spinner", () => {
    expect(source).toMatch(/view\.phase === "loading" \? \(/)
    expect(source).toContain("ListEmptyComponent={phaseState}")
    expect(source).toMatch(/<SkeletonGroup>/)
    expect(source).toMatch(/<SkeletonList rows=\{\d+\} kind="report" style=\{styles\.group\} \/>/)
    expect(source).toMatch(/<SkeletonList rows=\{\d+\} kind="person" style=\{styles\.group\} \/>/)
    expect(source).not.toMatch(/LoadingState/)
    expect(source).not.toMatch(/ActivityIndicator/)
  })

  it("announces the loading state and speaks the outcome ONCE per settled answer", () => {
    expect(source).toMatch(/accessibilityRole="progressbar"/)
    expect(source).toMatch(/accessibilityLabel=\{t\("search\.loading_a11y"\)\}/)
    expect(source).toMatch(/accessibilityLiveRegion="polite"/)
    expect(source).toMatch(/const announcement = searchAnnouncement\(view, rawQuery, hitCount\)/)
    expect(source).toMatch(/announcedRef\.current === announceKey\) return/)
    expect(source).toMatch(/announcedRef\.current = announceKey/)
    expect(source).toMatch(/\}, \[announceKey, announceMessage\]\)/)
    expect(source).not.toMatch(/\}, \[view\.phase, hitCount, emptyBody, t\]\)/)
  })

  it("marks held results busy while the next answer is still in flight", () => {
    expect(source).toMatch(
      /accessibilityState=\{view\.phase === "results" \? \{ busy: !view\.settled \} : undefined\}/,
    )
  })

  it("records exactly what it paints, so a painted surface can never fall back to a spinner", () => {
    expect(source).toMatch(
      /const selection = selectSearchHits\(live, heldRef\.current, liveCount, settled\)/,
    )
    expect(source).toMatch(/if \(selection\.record\) heldRef\.current = live/)
    expect(source).toMatch(/const hits = selection\.hits/)
    expect(source).not.toMatch(/if \(settled\) heldRef\.current = live/)
  })

  it("filters the cached events list on the LIVE query - there is no request to debounce", () => {
    expect(source).toMatch(/filterEventHits\(cleanupsQuery\.data \?\? \[\], rawQuery\)/)
    expect(source).not.toMatch(/filterEventHits\([^)]*debouncedQuery\)/)
  })

  it("settles each source on 'no data for this query yet', not on any background refetch", () => {
    expect(source).toMatch(/fetching: cleanupsQuery\.isPending/)
    expect(source).toMatch(/fetching: reportSearch\.isLoading/)
    expect(source).toMatch(/fetching: peopleSearch\.isPending/)
    expect(source).not.toMatch(/fetching: \w+\.isFetching/)
  })

  it("renders the empty state only on the empty phase", () => {
    expect(source).toMatch(/view\.phase === "empty" \? \(/)
    expect(source).toMatch(/title=\{t\("search\.no_results_title"\)\}/)
    expect(source).not.toMatch(/groups\.length === 0 && !anyLoading/)
  })

  it("holds the last SETTLED hits so a keystroke cannot blank the surface", () => {
    expect(source).toMatch(/const settled = searchSourcesSettled\(sources\)/)
  })

  it("settles people and reports on the SAME debounce clock", () => {
    expect(source).toMatch(/useDebouncedValue\(rawQuery, SEARCH_DEBOUNCE_MS\)/)
    expect(source).not.toMatch(/useDebouncedValue\(rawQuery, 250\)/)
    expect(source).not.toMatch(/function useDebouncedValue/)
  })
})
