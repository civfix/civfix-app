import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const src = readFileSync(new URL("../search/SearchResults.tsx", import.meta.url), "utf8")

describe("search results report paging", () => {
  it("offers the next page of matching reports instead of silently stopping at the first", () => {
    expect(src).toContain("const loadMoreReports = reportSearch.fetchNextPage")
    expect(src).toContain("<MoreReportsPill loading={item.loading} onLoadMore={loadMoreReports} />")
    expect(src).toContain('t("results.load_more_reports")')
  })

  it("only offers more when the painted reports are the live query's, never the held previous ones", () => {
    expect(src).toContain("const showMoreReports = hits === live && reportSearch.hasNextPage")
    expect(src).toMatch(/searchResultRows\(hits, \{\s*show: showMoreReports,\s*loading: reportSearch\.isFetchingNextPage,\s*\}\)/)
  })

  it("never hands the press event to fetchNextPage and ignores a press while a page is in flight", () => {
    expect(src).not.toContain("onPress={reportSearch.fetchNextPage}")
    expect(src).not.toContain("onPress={onLoadMore}")
    expect(src).not.toContain("onPress={loadMoreReports}")
    expect(src).toContain("onPress={() => {\n        if (!loading) onLoadMore()\n      }}")
  })

  it("exposes the in-flight page to assistive tech and blocks a double fetch", () => {
    expect(src).toContain("disabled={loading}")
    expect(src).toMatch(/accessibilityState=\{\{\s*disabled: loading,\s*busy: loading,\s*\}\}/)
  })
})
