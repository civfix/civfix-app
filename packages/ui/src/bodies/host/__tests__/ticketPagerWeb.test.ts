import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const body = code(readFileSync(new URL("../MyTicketBody.tsx", import.meta.url), "utf8"))

describe("the ticket pager's page indicator", () => {
  it("settles from momentum on native and from a throttled onScroll on web", () => {
    expect(body).toContain('Platform.OS === "web"')
    expect(body).toContain(
      "? { onScroll: onPagerSettled, scrollEventThrottle: WEB_PAGE_SCROLL_THROTTLE_MS }",
    )
    expect(body).toContain(": { onMomentumScrollEnd: onPagerSettled }")
    expect(body).toContain("{...pagerSettleProps}")
  })

  it("never wires the page only to a momentum event react-native-web does not emit", () => {
    expect(body).not.toContain("onMomentumScrollEnd={")
  })
})
