import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const src = readFileSync(new URL("../SearchResults.tsx", import.meta.url), "utf8")

describe("search results report paging", () => {
  it("offers the next page of matching reports instead of silently stopping at the first", () => {
    expect(src).toContain("onPress={reportSearch.fetchNextPage}")
    expect(src).toContain('t("results.load_more_reports")')
  })

  it("only offers more when the painted reports are the live query's, never the held previous ones", () => {
    expect(src).toContain("const showMoreReports = hits === live && reportSearch.hasNextPage")
  })

  it("exposes the in-flight page to assistive tech and blocks a double fetch", () => {
    expect(src).toContain("disabled={reportSearch.isFetchingNextPage}")
    expect(src).toMatch(
      /accessibilityState=\{\{\s*disabled: reportSearch\.isFetchingNextPage,\s*busy: reportSearch\.isFetchingNextPage,\s*\}\}/,
    )
  })
})
