import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../../__tests__/sourceGuards"
import { analyticsPageSource } from "./analyticsPageSource"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const body = code(analyticsPageSource())

describe("the analytics event picker", () => {
  it("offers the next page of hosted events instead of stopping at the first", () => {
    expect(body).toContain("const moreEvents = upcoming.hasNextPage || past.hasNextPage")
    expect(body).toContain("if (upcoming.hasNextPage && !upcoming.isFetchingNextPage) void upcoming.fetchNextPage()")
    expect(body).toContain("if (past.hasNextPage && !past.isFetchingNextPage) void past.fetchNextPage()")
    expect(body).toContain('key: "more",')
    expect(body).toContain("disabled: loadingMoreEvents,")
  })

  it("follows the route when the shell reuses the body for another event", () => {
    expect(body).toContain("if (id !== routeId) {")
    expect(body).toMatch(/setRouteId\(id\)\n\s+setPicked\(id === "" \? null : id\)\n\s+setPickedLabel\(null\)\n\s+setPreset\(null\)/)
  })
})

describe("More events in the analytics picker", () => {
  it("keeps the picker open while the next page loads into it, instead of closing and reopening it", () => {
    const more = sliceBetween(body, 'key: "more",', "]\n          : []),")
    expect(more).toContain("keepOpen: true,")
    expect(more).toMatch(/onPress: loadMoreEvents,/)
    expect(more).not.toContain("setPickerOpen(")
    expect(more).not.toContain("measurePicker(")
  })
})
