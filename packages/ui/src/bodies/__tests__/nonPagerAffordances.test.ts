import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { surfaceSource } from "../../__tests__/sourceGuards"

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8")

const POST_DETAIL = read("../PostDetailBody.tsx")
const PROFILE_EVENTS = read("../profile/ProfileEventsSection.tsx")
const SECTION_STYLES = read("../profile/sectionStyles.ts")
const SAVED_POSTS = read("../SavedPostsBody.tsx")
const PERSON_DETAIL = surfaceSource("personDetail")
const EVENT_HOURS = read("../EventHoursBlock.tsx")

function styleBlock(source: string, name: string): string {
  const start = source.indexOf(`  ${name}: {`)
  expect(start, name).toBeGreaterThan(-1)
  return source.slice(start, source.indexOf("\n  },", start))
}

describe("the pill's ink separates a pager from an affordance that is not one", () => {
  it("offers an accent variant alongside the muted pager text", () => {
    expect(styleBlock(SECTION_STYLES, "loadMoreText")).toMatch(/color: t\.colors\.textMuted/)
    expect(styleBlock(SECTION_STYLES, "loadMoreAccentText")).toMatch(/color: t\.colors\.accentText/)
    expect(styleBlock(SECTION_STYLES, "loadMoreError")).toMatch(/color: t\.colors\.dangerInk/)
  })

  it("paints View conversation - the only way into a thread - in accent, not pager grey", () => {
    expect(POST_DETAIL).toContain("sectionStyles.loadMoreAccentText")
    expect(POST_DETAIL).not.toContain("sectionStyles.loadMoreText")
    expect(POST_DETAIL).toContain("sectionStyles.loadMore,")
  })

  it("paints a failed page's retry in accent and its error line in danger ink", () => {
    expect(PROFILE_EVENTS).toContain(
      "more.isRetry ? sectionStyles.loadMoreAccentText : sectionStyles.loadMoreText",
    )
    expect(PROFILE_EVENTS).toContain("sectionStyles.loadMoreError")
    expect(PROFILE_EVENTS).not.toContain("sectionStyles.empty}>{t(\"events.load_more_error\")")
  })

  it("keeps the muted pill on the surfaces that really are pagers", () => {
    for (const source of [SAVED_POSTS, PERSON_DETAIL]) {
      expect(source).toContain("sectionStyles.loadMoreText")
      expect(source).not.toContain("sectionStyles.loadMoreAccentText")
    }
  })
})

describe("the credited-hours receipt is readable, not clipped", () => {
  it("lets the shift + time-range sentence wrap instead of clamping it to one line", () => {
    const at = EVENT_HOURS.indexOf("styles.creditedText")
    expect(at).toBeGreaterThan(-1)
    expect(EVENT_HOURS.slice(at, at + 120)).not.toContain("numberOfLines")
  })

  it("keeps the one-line clamp on the affiliation row's person name", () => {
    const at = EVENT_HOURS.indexOf("styles.personName")
    expect(at).toBeGreaterThan(-1)
    expect(EVENT_HOURS.slice(at, at + 60)).toContain("numberOfLines={1}")
  })
})
