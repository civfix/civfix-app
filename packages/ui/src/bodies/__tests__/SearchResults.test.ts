import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { SEARCH_RESULT_CARD_LAYOUT, groupSearchResults } from "../searchResultsModel"

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
    expect(SEARCH_RESULT_CARD_LAYOUT).toEqual({
      gap: 9,
      radius: 18,
      individualCards: true,
      dividedContainer: false,
    })
  })
})

/**
 * Source-text guards, the house pattern for a component invariant in a package with no RN renderer (see
 * SearchBody.test.ts, which guards its top-anchored layout the same way). These pin the two halves of the
 * change that a future edit could silently undo: the row is the SHARED ReportRowView rather than a
 * re-hand-rolled pin glyph with a description subtitle, and the viewer location is threaded from EVERY
 * call site (a new third call site that forgets `viewer` reds on the length assertion, not just on tsc).
 */
describe("report hits render through the shared ReportRowView", () => {
  const searchResults = readFileSync(new URL("../SearchResults.tsx", import.meta.url), "utf8")
  const searchBody = readFileSync(new URL("../SearchBody.tsx", import.meta.url), "utf8")
  const reportRow = readFileSync(new URL("../ReportRow.tsx", import.meta.url), "utf8")

  it("draws a ReportRowView, not a hand-rolled MapPin circle with a description subtitle", () => {
    expect(searchResults).toMatch(/<ReportRowView\b/)
    expect(searchResults).toMatch(/divider=\{false\}/)
    expect(searchResults).not.toMatch(/reportPin/)
    expect(searchResults).not.toMatch(/iconMap\.MapPin/)
    expect(searchResults).not.toMatch(/report\.description/)
  })

  /**
   * The press-feedback shape guard. A card hit's rounded chrome used to live on a plain wrapper `View` with
   * the Pressable nested inside its 12pt gutters, so the pressed state painted a square-cornered rectangle
   * inset from the card's 18pt corners and the gutters took no touches. The chrome and the press style must
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
    // Radius, border and fill all follow `individualCards`, the SAME switch SearchResults' `styles.row`
    // reads for the person/event/leaderboard hits - so retuning the search-card family cannot leave the
    // report hit behind as the one hard-coded card in a flat list.
    expect(rowCard).toMatch(
      /borderRadius: SEARCH_RESULT_CARD_LAYOUT\.individualCards \? SEARCH_RESULT_CARD_LAYOUT\.radius : 0/,
    )
    expect(rowCard).toMatch(/borderWidth: SEARCH_RESULT_CARD_LAYOUT\.individualCards \?/)
    expect(rowCard).toMatch(/backgroundColor: SEARCH_RESULT_CARD_LAYOUT\.individualCards \?/)
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
