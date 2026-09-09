/**
 * ONE HEADING HIERARCHY PER SURFACE - the semantics half of the landscape pass (R3-9).
 *
 * react-native-web renders `accessibilityRole="header"` as a bare `<h1>`, every time, at every size. The
 * VISUAL hierarchy was well-formed (32 / 24 / 22 / 20 / 19 / 11) and the semantics were flat: /search
 * exposed SIX h1s at four type sizes ("civfix" the 16px brand pill, "Search" the 32px tab root, and four
 * 20px section labels), /profile five (an 11px "POSTS" eyebrow through the 22px display name). Navigating
 * by heading, a screen-reader user got a list in which a decorative wordmark, the page title and a section
 * label were peers - and the brand pill, a BUTTON, announced as the first heading on every route.
 *
 * THE LADDER (`theme/webAffordances.headingLevel` states it; this suite pins it):
 *   1 - the tab-root / stacked-panel title. Exactly one per rendered surface, and it is the only level a
 *       body may leave IMPLICIT, because an untagged RNW header already IS an <h1>.
 *   2 - a section inside that surface: "Suggested people", "Events in your area", the profile's display
 *       name under the panel's own "You", the profile's "POSTS" / "ACTIVITY" eyebrows, a prefs group.
 *   3 - a sub-label inside a section (the profile events section's "Hosting (3)" subhead).
 *
 * `aria-level` on an `<h1>` overrides the implicit level for assistive tech, so NO pixel moves and no DOM
 * tag changes. The browser-side proof that the ladder actually resolves to one level-1 per route is
 * `verify/headings.mjs`, which snapshots every h1-h6 / [role=heading] on 13 routes with its computed level
 * and fails unless each has exactly one.
 *
 * Source greps: these modules import react-native, which this package's node-environment vitest cannot
 * load, so the call sites are pinned by reading the source - the house pattern (see `focusRing.test.ts`).
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

// `webAffordances` is read as TEXT rather than imported: it pulls in react-native, whose Flow-typed source
// this package's node-environment vitest cannot parse (`import typeof ...`). Same reason `focusRing.test.ts`
// greps it. The RUNTIME shape is checked by evaluating the one-line function body below.
const affordances = strip(read("../webAffordances.ts"))
const themeIndex = read("../index.ts")
const brand = strip(read("../../primitives/Brand.tsx"))
const mapControls = strip(read("../../map/MapControls.tsx"))

describe("headingLevel", () => {
  it("emits the ARIA attribute, not an RN prop", () => {
    expect(affordances).toMatch(
      /export function headingLevel\(level: 1 \| 2 \| 3\): object \{\s*return \{ "aria-level": level \}/,
    )
  })

  it("is exported from the theme barrel, where every body imports its affordances", () => {
    expect(themeIndex).toContain("headingLevel")
  })
})

describe("the wordmark is a button, not a heading", () => {
  it.each([
    ["primitives/Brand.tsx", brand],
    ["map/MapControls.tsx", mapControls],
  ])("%s exposes no heading role", (_name, src) => {
    expect(src).not.toContain('accessibilityRole="header"')
  })
})

/**
 * A body may leave AT MOST its own title implicit. `roles - levels` counts the headers a file does not
 * level explicitly; anything above the file's title budget is a section that would announce as a peer of
 * the page title. SearchBody and ReportFlowBody have TWO title elements each - a portrait one and an
 * expanded/root one, rendered in mutually exclusive branches - so their budget is 2.
 */
const TITLE_BUDGET: Record<string, number> = {
  "bodies/SearchBody.tsx": 2,
  "bodies/ReportFlowBody.tsx": 2,
}

const HEADING_FILES = [
  "bodies/SearchBody.tsx",
  "bodies/SearchResults.tsx",
  "bodies/SocialBody.tsx",
  "bodies/ProfileView.tsx",
  "bodies/profile/SectionHeadings.tsx",
  "bodies/PostComposer.tsx",
  "bodies/NotificationPrefsBody.tsx",
  "bodies/ReportDetailBody.tsx",
  "bodies/EventDetailBody.tsx",
  "bodies/GroupInfoBody.tsx",
  "bodies/MembersBody.tsx",
  "bodies/ReportsBody.tsx",
  "bodies/ReportFlowBody.tsx",
  "bodies/FeedBody.tsx",
  "bodies/MessagingListBody.tsx",
  "bodies/EventsBody.tsx",
  "bodies/LeaderboardBody.tsx",
  "bodies/PersonDetailBody.tsx",
  "bodies/PostThreadBody.tsx",
  "bodies/ConversationBody.tsx",
  "bodies/NewGroupBody.tsx",
  "bodies/NewChannelBody.tsx",
  "promo/AppPromoCard.tsx",
  "shell/ExpandedShell.tsx",
  "shell/DetailBar.tsx",
]

const count = (src: string, re: RegExp) => (src.match(re) ?? []).length

describe("no body announces a section as a peer of its page title", () => {
  it.each(HEADING_FILES)("%s levels every heading past its title", (rel) => {
    const src = strip(read(`../../${rel}`))
    const roles = count(src, /accessibilityRole="header"/g)
    const levels = count(src, /headingLevel\(/g)
    expect(roles - levels).toBeLessThanOrEqual(TITLE_BUDGET[rel] ?? 1)
  })
})

describe("the two ladders the snapshot reads on /search and /profile", () => {
  it("search's four section labels are level 2", () => {
    const src = strip(read("../../bodies/SearchBody.tsx"))
    expect(count(src, /headingLevel\(2\)/g)).toBeGreaterThanOrEqual(4)
  })

  it("the profile's display name is level 2, under the panel's own title", () => {
    const src = strip(read("../../bodies/ProfileView.tsx"))
    expect(/heroName[\s\S]{0,120}?headingLevel\(2\)/.test(src)).toBe(true)
  })

  it("a profile section eyebrow is level 2 and the subhead INSIDE it is level 3", () => {
    const src = strip(read("../../bodies/profile/SectionHeadings.tsx"))
    expect(/SectionEyebrow[\s\S]*?headingLevel\(2\)/.test(src)).toBe(true)
    expect(/SubHead[\s\S]*?headingLevel\(3\)/.test(src)).toBe(true)
  })

  it("the promo card's title is a section of the feed, not a second page title", () => {
    expect(strip(read("../../promo/AppPromoCard.tsx"))).toMatch(/headingLevel\(2\)/)
  })
})
