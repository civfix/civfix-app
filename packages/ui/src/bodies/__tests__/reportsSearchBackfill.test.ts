import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import * as model from "../reportsListModel"

const body = readFileSync(new URL("../ReportsBody.tsx", import.meta.url), "utf8")
const field = readFileSync(new URL("../../primitives/ListSearchField.tsx", import.meta.url), "utf8")

type Backfill = (input: {
  filtering: boolean
  pagesLoaded: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPageFailed: boolean
}) => string
const searchBackfill = (model as unknown as { searchBackfill?: Backfill }).searchBackfill
const MAX = (model as unknown as { SEARCH_BACKFILL_MAX_PAGES?: number }).SEARCH_BACKFILL_MAX_PAGES

const typing = {
  filtering: true,
  pagesLoaded: 1,
  hasNextPage: true,
  isFetchingNextPage: false,
  fetchNextPageFailed: false,
}

describe("searching your reports reaches past the first page", () => {
  it("keeps loading older pages while a query is typed", () => {
    expect(typeof searchBackfill).toBe("function")
    expect(searchBackfill!(typing)).toBe("fetch")
    expect(searchBackfill!({ ...typing, isFetchingNextPage: true })).toBe("busy")
  })

  it("stops at the bound, or after a failed page, and reports the result as partial", () => {
    expect(MAX).toBe(5)
    expect(searchBackfill!({ ...typing, pagesLoaded: MAX! })).toBe("partial")
    expect(searchBackfill!({ ...typing, fetchNextPageFailed: true })).toBe("partial")
  })

  it("is complete once every page is loaded and off when nothing is typed", () => {
    expect(searchBackfill!({ ...typing, hasNextPage: false })).toBe("complete")
    expect(searchBackfill!({ ...typing, filtering: false })).toBe("off")
  })

  it("drives fetchNextPage from the backfill state and names a partial search", () => {
    expect(body).toMatch(/useEffect\(\(\) => \{\s*if \(backfill === "fetch"\) void fetchNextPage\(\)\s*\}, \[backfill, fetchNextPage\]\)/)
    expect(body).toContain('t("search.partial", { count: all.length })')
  })
})

describe("the search clear button", () => {
  it("is a 44 point target around the 22 point visual on web, where hitSlop is dropped", () => {
    expect(body).toContain('clearA11yLabel={t("search.clear_a11y")}')
    expect(body).not.toContain('clearTarget="slop"')
    expect(field).toContain('clearTarget = "box"')
    const clear = /accessibilityLabel=\{clearA11yLabel\}[\s\S]*?<\/Pressable>/.exec(field)?.[0] ?? ""
    expect(clear).not.toContain("hitSlop")
    expect(clear).toContain("style={styles.clearTarget}")
    expect(field).toMatch(/clearTarget: \{\s*width: MIN_TOUCH_TARGET,\s*height: MIN_TOUCH_TARGET,/)
  })
})
