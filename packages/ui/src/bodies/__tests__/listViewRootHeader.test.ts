import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { searchBodySource } from "../search/__tests__/searchBodySource"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const feed = strip(read("../FeedBody.tsx"))
const search = strip(searchBodySource())
const inbox = ["../MessagingListBody.tsx", "../inbox/inboxLayout.ts", "../inbox/ThreadRow.tsx"]
  .map((file) => strip(read(file)))
  .join("\n")
const people = strip(read("../SocialBody.tsx"))
const reports = strip(read("../ReportsBody.tsx"))
const events = strip(read("../EventsBody.tsx"))

const hasTabRootType = (src: string): boolean =>
  /fontFamily: (?:theme|t)\.fontFamily\.bodyExtraBold[\s\S]{0,200}?fontSize: 32[\s\S]{0,200}?lineHeight: 39[\s\S]{0,200}?letterSpacing: -0\.5/.test(
    src,
  ) ||
  /fontSize: 32[\s\S]{0,200}?lineHeight: 39[\s\S]{0,200}?letterSpacing: -0\.5[\s\S]{0,200}?fontFamily: (?:theme|t)\.fontFamily\.bodyExtraBold/.test(
    src,
  )

describe("the tab-root title type is one recipe", () => {
  it("FeedBody is the reference: Hanken 800, 32/39, tracking -0.5", () => {
    expect(hasTabRootType(feed)).toBe(true)
  })

  it.each([
    ["MessagingListBody", inbox],
    ["SocialBody", people],
    ["ReportsBody", reports],
    ["EventsBody", events],
  ])("%s draws the same 32/800 title at its view root", (_name, src) => {
    expect(hasTabRootType(src)).toBe(true)
  })

  it("SearchBody layers the recipe over its portrait title instead of forking a second one", () => {
    expect(search).toMatch(
      /titleTabRoot: \{\s*fontFamily: t\.fontFamily\.bodyExtraBold,\s*lineHeight: 39,\s*letterSpacing: -0\.5,/,
    )
    expect(search).toContain("[styles.title, styles.titleTabRoot]")
    expect(search).toMatch(/title: \{[\s\S]{0,160}?fontFamily: t\.fontFamily\.displayBold/)
  })
})

describe("every tab-root title is a HEADING, not just 32pt text", () => {
  it.each([
    ["FeedBody", feed],
    ["SearchBody", search],
    ["MessagingListBody", inbox],
    ["SocialBody", people],
    ["ReportsBody", reports],
    ["EventsBody", events],
  ])("%s names its view-root title with accessibilityRole=header", (_name, src) => {
    expect(src).toContain('accessibilityRole="header"')
  })
})

describe("the tab-root title row is one box", () => {
  it("FeedBody's header row is the reference: exactly the header control it carries", () => {
    expect(feed).toMatch(/header: \{[^}]*alignItems: "center"[^}]*minHeight: HEADER_CONTROL_SIZE/)
  })

  it.each([
    ["SearchBody", search],
    ["MessagingListBody", inbox],
  ])("%s carries the same header control, so its row is the same box", (_name, src) => {
    expect(src).toMatch(/alignItems: "center",[\s\S]{0,120}?minHeight: HEADER_CONTROL_SIZE/)
    expect(src).toContain("HeaderProfileButton")
  })

  it.each([
    ["SocialBody", people],
    ["ReportsBody", reports],
    ["EventsBody", events],
  ])("%s carries no header control, so its row keeps the bare 44pt minimum", (_name, src) => {
    expect(src).toMatch(/alignItems: "center",[\s\S]{0,120}?minHeight: (?:44|MIN_TOUCH_TARGET)/)
    expect(src).not.toContain("HeaderProfileButton")
  })
})

describe("the title is inset with the rows, not past them", () => {
  it("the inbox header shares ONE inset with the rows, on both layouts", () => {
    expect(inbox).toMatch(/const ROW_GUTTER = space\["4"\]/)
    expect(inbox).toMatch(/headerInset: \{ paddingHorizontal: ROW_GUTTER \}/)
    expect(inbox).toMatch(/row: \{[\s\S]{0,240}?paddingHorizontal: ROW_GUTTER/)
    expect(inbox).toContain("<View style={styles.headerInset} onTouchStart={dismissSwipe}>")
    expect(inbox).not.toMatch(/content: \{[^}]*paddingHorizontal/)
    expect(inbox).not.toContain("headerCompactInset")
    expect(inbox).not.toMatch(/header: \{[^}]*marginHorizontal/)
  })
})

describe("a view root and a stacked panel start on the same rule", () => {
  it.each([
    ["SearchBody", search, /paddingTop: 14/],
    ["MessagingListBody", inbox, /contentExpanded: \{ paddingTop: 14 \}/],
    ["SocialBody", people, /minHeight: 44,\s*marginTop: 14/],
    ["ReportsBody", reports, /minHeight: 44,\s*marginTop: 14/],
    ["EventsBody", events, /minHeight: 44,\s*marginTop: 14/],
  ])("%s opens its first line 14 below the card edge", (_name, src, re) => {
    expect(src).toMatch(re)
  })
})

describe("title first, then the surface's own field", () => {
  it("ReportsBody no longer renders its filter above its own title", () => {
    const header = reports.match(/ListHeaderComponent=\{[\s\S]*?\n {6}\}/)?.[0]
    expect(header, "the ListHeaderComponent block must still be findable").toBeTruthy()
    expect(header!.indexOf("ReportsHeader")).toBeLessThan(header!.indexOf("ReportsSearchField"))
  })

  it("SocialBody and EventsBody keep the same order", () => {
    const social = people.match(/ListHeaderComponent=\{[\s\S]*?\n {6}\}/)?.[0]
    expect(social).toBeTruthy()
    expect(social!.indexOf("PeopleHeader")).toBeLessThan(social!.indexOf("PeopleSearchField"))
    const from = events.indexOf("function EventsHeader(")
    const to = events.indexOf("const useStyles = makeThemedStyles(")
    expect(from, "EventsHeader must still be a top-level function here").toBeGreaterThan(0)
    const head = events.slice(from, to)
    expect(head.indexOf("showTitle ?")).toBeGreaterThan(-1)
    expect(head.indexOf("showTitle ?")).toBeLessThan(head.indexOf("showSearch ?"))
  })
})

describe("every view root names itself, and only at a view root", () => {
  it("EventsBody titles the events root, the surface the rail deliberately lights no lozenge for", () => {
    expect(events).toContain("useNavStore((s) => s.stack.length === 0)")
    expect(events).toMatch(/showTitle=\{layout === "expanded" && atViewRoot\}/)
    expect(events).toContain('tNav("title.cleanups")')
  })

  it.each([
    ["SocialBody", people],
    ["ReportsBody", reports],
  ])("%s keeps its own view-root gate", (_name, src) => {
    expect(src).toContain("useNavStore((s) => s.stack.length === 0)")
  })
})

describe("portrait keeps its own rhythms", () => {
  it("ReportsBody still draws the 19px section label in compact", () => {
    expect(reports).toContain("expanded ? styles.title : styles.sectionTitle")
    expect(reports).toMatch(/sectionTitle: \{[\s\S]{0,160}?fontSize: 19/)
  })

  it("the landscape-only surfaces are all gated on the layout mode, never on a width literal", () => {
    for (const src of [search, inbox, people, reports, events]) {
      expect(src).toMatch(/useLayoutMode\(\)/)
    }
  })
})
