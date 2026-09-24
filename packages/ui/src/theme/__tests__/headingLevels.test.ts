import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { reportDetailSourceFiles } from "../../bodies/reportDetail/__tests__/reportDetailSource"
import { surfaceSource as splitSurfaceSource } from "../../__tests__/sourceGuards"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

// These modules import react-native, whose Flow-typed source (`import typeof ...`) this package's node
// vitest cannot parse, so they are read as text. The heading ladder itself is documented on `headingLevel`.
const affordances = strip(read("../webAffordances.ts"))
const themeIndex = read("../index.ts")
const brand = strip(read("../../primitives/Brand.tsx"))
const mapControls = strip(read("../../map/MapControls.tsx"))

describe("headingLevel", () => {
  it("emits the ARIA attribute, not an RN prop", () => {
    expect(affordances).toContain("export type HeadingLevel = 1 | 2 | 3")
    expect(affordances).toMatch(
      /export function headingLevel\(level: HeadingLevel\): \{ "aria-level": HeadingLevel \} \{\s*return \{ "aria-level": level \}/,
    )
  })

  it("is exported from the theme barrel, where every body imports its affordances", () => {
    expect(themeIndex).toContain("headingLevel")
  })
})

describe("the report detail's split-out parts leave its title the surface's only heading", () => {
  it.each(reportDetailSourceFiles().slice(1))("%s exposes no heading role", (file) => {
    expect(strip(readFileSync(file, "utf8"))).not.toContain('accessibilityRole="header"')
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
 * A body may leave at most its own title implicit: any other unleveled header would announce as a peer
 * of the page title. SearchBody and ReportFlowBody render a portrait and an expanded title in mutually
 * exclusive branches, so their budget is 2. A body split across a folder is counted as one surface.
 */
const TITLE_BUDGET: Record<string, number> = {
  "bodies/SearchBody.tsx": 2,
  "bodies/ReportFlowBody.tsx": 2,
}

const HEADING_FILES = [
  "bodies/SearchBody.tsx",
  "bodies/search/SearchResults.tsx",
  "bodies/SocialBody.tsx",
  "bodies/ProfileView.tsx",
  "bodies/profile/SectionHeadings.tsx",
  "bodies/PostComposer.tsx",
  "bodies/NotificationPrefsBody.tsx",
  "bodies/ReportDetailBody.tsx",
  "bodies/EventDetailBody.tsx",
  "bodies/GroupInfoBody.tsx",
  "bodies/MembersBody.tsx",
  "bodies/ChatInfoParts.tsx",
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
  "bodies/GroupWizardHeader.tsx",
  "promo/AppPromoCard.tsx",
  "shell/ExpandedShell.tsx",
  "shell/DetailBar.tsx",
]

const SURFACE_SOURCE: Record<string, () => string> = {
  "bodies/SearchBody.tsx": () => splitSurfaceSource("search"),
  "bodies/PersonDetailBody.tsx": () => splitSurfaceSource("personDetail"),
  "bodies/PostComposer.tsx": () => splitSurfaceSource("postComposer"),
}

const surfaceSource = (rel: string): string => SURFACE_SOURCE[rel]?.() ?? read(`../../${rel}`)

const count = (src: string, re: RegExp) => (src.match(re) ?? []).length

describe("no body announces a section as a peer of its page title", () => {
  it.each(HEADING_FILES)("%s levels every heading past its title", (rel) => {
    const src = strip(surfaceSource(rel))
    const roles = count(src, /accessibilityRole="header"/g)
    const levels = count(src, /headingLevel\(/g)
    expect(roles - levels).toBeLessThanOrEqual(TITLE_BUDGET[rel] ?? 1)
  })
})

describe("the two ladders the snapshot reads on /search and /profile", () => {
  it("search's four section labels are level 2", () => {
    const src = strip(splitSurfaceSource("search"))
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
