import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { SEARCH_RESULT_CARD_LAYOUT, groupSearchResults } from "../searchResultsModel"
import { searchBodySource } from "../search/__tests__/searchBodySource"

describe("SearchResults groups", () => {
  it("orders live results as events, reports, then suggested people", () => {
    expect(
      groupSearchResults({
        people: [{ id: "person-1" }],
        events: [{ id: "event-1" }],
        reports: [{ id: "report-1" }],
      }),
    ).toEqual([
      { id: "events", count: 1 },
      { id: "reports", count: 1 },
      { id: "people", count: 1 },
    ])
  })

  it("omits empty groups so an active search has no blank headings", () => {
    expect(
      groupSearchResults({
        people: [],
        events: [{ id: "event-1" }],
        reports: [],
      }),
    ).toEqual([{ id: "events", count: 1 }])
  })

  it("renders each result as its own rounded card with nine-pixel spacing", () => {
    expect(SEARCH_RESULT_CARD_LAYOUT).toEqual({ gap: 9, radius: 18 })
    const styles = readFileSync(new URL("../SearchResults.tsx", import.meta.url), "utf8")
    const row = styles.match(/\n {2}row: \{([\s\S]*?)\n {2}\},/)?.[1] ?? ""
    expect(row).toMatch(/borderRadius: SEARCH_RESULT_CARD_LAYOUT\.radius,/)
    expect(row).toMatch(/borderWidth: StyleSheet\.hairlineWidth,/)
    expect(row).toMatch(/backgroundColor: t\.colors\.surface,/)
    expect(row).not.toMatch(/borderBottomWidth/)
    expect(styles).toContain("group: { gap: SEARCH_RESULT_CARD_LAYOUT.gap },")
  })
})

/**
 * Source-text guards, the house pattern for a component invariant in a package with no RN renderer (see
 * SearchBody.test.ts, which guards its top-anchored layout the same way). These pin two invariants a
 * future edit could silently undo: the row is the SHARED ReportRowView rather than a
 * re-hand-rolled pin glyph with a description subtitle, and the viewer location is threaded from EVERY
 * call site (a new third call site that forgets `viewer` reds on the length assertion, not just on tsc).
 */
describe("report hits render through the shared ReportRowView", () => {
  const searchResults = readFileSync(new URL("../SearchResults.tsx", import.meta.url), "utf8")
  const searchBody = searchBodySource()
  const reportRow = readFileSync(new URL("../ReportRow.tsx", import.meta.url), "utf8")

  it("draws a ReportRowView, not a hand-rolled MapPin circle with a description subtitle", () => {
    expect(searchResults).toMatch(/<ReportRowView\b/)
    expect(searchResults).toMatch(/divider=\{false\}/)
    expect(searchResults).not.toMatch(/reportPin/)
    expect(searchResults).not.toMatch(/iconMap\.MapPin/)
    expect(searchResults).not.toMatch(/report\.description/)
  })

  /**
   * The press-feedback shape guard. With a card hit's rounded chrome on a plain wrapper `View` and the
   * Pressable nested inside its 12pt gutters, the pressed state paints a square-cornered rectangle inset
   * from the card's 18pt corners and the gutters take no touches. The chrome and the press style must
   * stay on the ROW's own Pressable - and `overflow: "hidden"` is never the way to reconcile them, because on
   * iOS it clips the layer drawing the card's shadow.
   */
  it("gives the row itself the card chrome instead of wrapping it in a bare card View", () => {
    expect(searchResults).toMatch(/<ReportRowView\b[^>]*\bcard\b/)
    // `\bcard\b` alone also matches `card={false}`, which would turn the card presentation OFF while
    // leaving this guard green - so the off switch is banned outright. (The row's default is already
    // false; a search hit that does not want the card would simply omit the prop.)
    expect(searchResults).not.toMatch(/card=\{false\}/)
    expect(searchResults).not.toMatch(/reportCard:/)
    expect(searchResults).not.toMatch(/<View style=\{styles\.reportCard\}/)
  })

  it("paints the card radius and its press feedback on one Pressable, with no overflow clip", () => {
    const pressableStyles = reportRow.match(/style=\{\(state\) => \[([\s\S]*?)\]\}/)?.[1] ?? ""
    expect(pressableStyles).toMatch(/styles\.rowCard\b/)
    expect(pressableStyles).toMatch(/styles\.rowCardPressed\b/)
    // The pointer answer rides on the same one Pressable, in whichever vocabulary the presentation speaks.
    expect(pressableStyles).toMatch(
      /webHover\(state\) \? \(card \? styles\.rowCardHovered : styles\.rowHovered\) : null/,
    )
    const rowCard = reportRow.match(/\n {2}rowCard: \{([\s\S]*?)\n {2}\},/)?.[1] ?? ""
    // The card reads the SAME radius SearchResults' `styles.row` reads for the person/event/leaderboard
    // hits, and the same hairline + surface card chrome - so retuning the search-card family cannot leave
    // the report hit behind as the one hard-coded card in the list.
    expect(rowCard).toMatch(/borderRadius: SEARCH_RESULT_CARD_LAYOUT\.radius,/)
    expect(rowCard).toMatch(/borderWidth: StyleSheet\.hairlineWidth,/)
    expect(rowCard).toMatch(/backgroundColor: t\.colors\.surface,/)
    expect(rowCard).toMatch(/paddingHorizontal: t\.space\["3"\]/)
    // No `overflow` style KEY anywhere in the row (the standing warning in the comments is fine).
    expect(reportRow).not.toMatch(/^\s*overflow:/m)
    // Card hits fade like their person/leaderboard siblings; the divided lists keep the opaque fill.
    expect(reportRow).toMatch(/rowCardPressed: \{\s*opacity: 0\.65,/)
    expect(reportRow).toMatch(/rowPressed: \{\s*backgroundColor: t\.colors\.bgAlt,/)
  })

  it("threads the viewer location into every ReportHitRow call site", () => {
    const callSites = [
      ...searchResults.matchAll(/<ReportHitRow\b[^/]*\/>/g),
      ...searchBody.matchAll(/<ReportHitRow\b[^/]*\/>/g),
    ]
    expect(callSites).toHaveLength(2)
    for (const [tag] of callSites) expect(tag).toMatch(/\bviewer=\{/)
  })
})

/**
 * The leaderboard row is ONE component for two families of surface: the search page and the two host
 * screens (`TopVolunteersCard`). Source guards, because neither half is renderable here: the shared row
 * only holds while `SearchResults.tsx` keeps no copy of it and the shared file keeps the 56pt list
 * geometry every other list row in the app uses.
 */
describe("the leaderboard row lives in its own module", () => {
  const searchResults = readFileSync(new URL("../SearchResults.tsx", import.meta.url), "utf8")
  const leaderboardRow = readFileSync(new URL("../LeaderboardRow.tsx", import.meta.url), "utf8")
  const row = leaderboardRow.match(/\n {2}row: \{([\s\S]*?)\n {2}\},/)?.[1] ?? ""

  it("left SearchResults.tsx entirely, styles included", () => {
    expect(searchResults).not.toMatch(/LeaderboardHitRow|LeaderboardRow/)
    expect(searchResults).not.toMatch(/leaderRank|leaderName|leaderHandle|leaderHours|leaderYouRow/)
    expect(searchResults).not.toMatch(/formatHoursDisplay/)
  })

  it("exports the shared row with the emphasis switch both surfaces need", () => {
    expect(leaderboardRow).toMatch(/export function LeaderboardRow\(/)
    expect(leaderboardRow).toMatch(/emphasis = "accent"/)
    expect(leaderboardRow).toMatch(/emphasis === "ink" \? styles\.leaderHoursInk : null/)
    expect(leaderboardRow).toMatch(/leaderHoursInk: \{ color: t\.colors\.text \}/)
    expect(leaderboardRow).toMatch(/color: t\.colors\.accentText/)
  })

  it("carries the 56pt list geometry and a 40pt avatar, in tokens", () => {
    expect(row).toMatch(/gap: t\.space\["3"\]/)
    expect(row).toMatch(/minHeight: LIST_ROW_MIN_HEIGHT/)
    expect(row).toMatch(/paddingVertical: t\.space\["2"\]/)
    expect(row).toMatch(/paddingHorizontal: t\.space\["4"\]/)
    expect(leaderboardRow).toMatch(/size=\{40\}/)
    expect(leaderboardRow).toMatch(/width: t\.space\["6"\]/)
    expect(leaderboardRow.match(/"#[0-9a-fA-F]{3,8}"/g) ?? []).toHaveLength(0)
  })

  it("keeps the search card chrome off the flat host row", () => {
    expect(leaderboardRow).toMatch(/emphasis === "accent" \? styles\.rowCard : null/)
    expect(row).not.toMatch(/borderRadius|backgroundColor|shadows/)
  })
})
