import { describe, expect, it } from "vitest"
import { getSearchBodyMode } from "../searchRecentStore"
import { inlineEmptyHeight } from "../../primitives/stateViewModel"
import { searchBodySource } from "../search/__tests__/searchBodySource"

describe("SearchBody state", () => {
  it("keeps the resting search page for a blank navigation query", () => {
    // Resting is the discovery surface while the docked bar is unfocused, or "Recently searched" once it
    // pins (Apple-Music model), never Browse tiles.
    expect(getSearchBodyMode("   ")).toBe("resting")
  })

  it("switches to grouped results for a typed navigation query", () => {
    expect(getSearchBodyMode("Echo Park")).toBe("results")
  })
})

/**
 * The resting surface's TOP-ANCHORED layout. The package ships no RN renderer, so these are source-text
 * guards. Bottom-anchoring this surface while a soft keyboard is up pushes the "Recently searched" header
 * to ~335pt down the screen and was rejected, so the void between a short recents list and the search
 * field is the deliberate trade, not the bug.
 */
describe("SearchBody top-anchored recents", () => {
  const source = searchBodySource()

  it("top-anchors the recents surface: one unconditional content style, no flex-end", () => {
    // A single content style, applied as a bare style (not an array), so there is no seam for a
    // keyboard-conditional variant to slip back into. The banned properties are asserted against the whole
    // file, so a RENAMED reintroduction (`contentBottom`, `contentKeyboard`, …) reds too.
    expect(source).toMatch(/contentContainerStyle=\{styles\.content\}/)
    expect(source).not.toMatch(/contentContainerStyle=\{\[/)
    expect(source).not.toMatch(/contentPinned/)
    expect(source).not.toMatch(/bottomAnchored/)
    expect(source).not.toMatch(/flexGrow/)
    expect(source).not.toMatch(/justifyContent: "flex-end"/)
  })

  it("keeps the resting bottom spacer, unconditionally, so the dock is always cleared", () => {
    // This spacer clears the RESTING dock. It must stay unguarded (under flex-end the LAST child becomes
    // the anchor, so a keyboard-conditional layout drops it), or the tail of the discovery list sits under
    // the dock.
    expect(source).toMatch(/\n\s*<View style=\{styles\.bottomPad\} \/>\n/)
    expect(source).not.toMatch(/\? null : <View style=\{styles\.bottomPad\}/)
    expect(source).toMatch(/bottomPad: \{ height: t\.space\["8"\] \}/)
  })

  it("reads no keyboard signal: this surface's layout is keyboard-independent", () => {
    // The dock's `keyboardReserve` publish and the web visual-viewport inset both still exist (the native
    // reveal layer's padding consumes the reserve), but SearchBody must not read either one: the moment it
    // does, some layout here is keyboard-conditional again.
    expect(source).not.toMatch(/^import[^\n]*useKeyboardInset/m)
    expect(source).not.toMatch(/useKeyboardInset\(\)/)
    expect(source).not.toMatch(/state\.keyboardReserve/)
  })

  it("freezes the rendered surface during a Search EXIT so no remount lands on the fade frames", () => {
    // DERIVED, not published: `selectView` clears `query` in the SAME store update that changes `view`, so
    // a flag published from an effect would commit one render after the swap it exists to prevent.
    expect(source).toMatch(/isSearchBodyFrozen\(view, exitSettled\)/)
    expect(source).toMatch(/resolveSearchSurfaceState\(live, heldRef\.current, frozen\)/)
  })

  it("makes ONE surface decision, so the recents<->discovery swap cannot fire underneath the freeze", () => {
    // If SearchResting read `pinned` itself, that second swap would fire ~1 frame after the
    // results->resting one, mounting Discovery's three react-query sections plus a horizontal ScrollView
    // of avatar cards on the fade frames. Both gates below read the single frozen `surface`, never `pinned`.
    expect(source).not.toMatch(/\{pinned \? <RecentlySearched/)
    expect(source).toMatch(/const showRecents = surface === "recents" && \(!expanded \|\| recentCount > 0\)/)
    expect(source).toMatch(/const showDiscovery = surface === "discovery" \|\| expanded/)
    // `expanded` is a LAYOUT prop (it only tells Discovery to yield its large title to the landscape
    // head, see bodies/__tests__/searchField.test.ts) plus, here, the landscape-only rule that discovery STAYS under
    // the focused field. With `expanded` false (compact) the two gates are exact opposites.
    expect(source).toMatch(/\{showRecents \? <RecentlySearched \/> : null\}/)
    expect(source).toMatch(/\{showDiscovery \? <Discovery expanded=\{expanded\} \/> : null\}/)
  })

  it("never lands the LANDSCAPE search entry on an empty card, and keeps discovery in the tab order", () => {
    // Both of Search's primary entries focus the field. Unmounting the whole discovery surface on the
    // pinned swap would land a first-run viewer on one grey placeholder line over ~750px of sand, and the
    // 25 controls below the field would leave the DOM the moment it took focus (the next Tab would exit
    // the document: WCAG 2.1.1 over a whole region).
    expect(source).toContain("const recentCount = useSearchRecentStore((state) => state.recent.length)")
    // With nothing recorded there is no recents block at all in expanded: the empty-recents copy has no
    // job under a field that has just been focused.
    expect(source).toMatch(/recentCount > 0/)
  })

  it("gates the freeze on the DOCK MORPH's settle, never on a keyboard signal", () => {
    // The POSITIVE half is what makes this more than a restatement of the `reads no keyboard signal` case
    // above: the freeze's release must come from the morph's own settle flag. The moment its condition
    // reads a keyboard value instead, some layout here is keyboard-conditional again.
    expect(source).toMatch(/state\.searchExitSettled/)
    expect(source).not.toMatch(/state\.keyboardReserve/)
    expect(source).not.toMatch(/useKeyboardInset\(\)/)
  })

  it("the Discovery leaderboard section smuggled in none of the banned layout tokens", () => {
    // `DiscoveryLeaderboard` is plain top-anchored content appended into the existing fragment, and it
    // must stay that way. This asserts the section exists (so the guard cannot silently pass on a file that
    // lost it) and then re-runs the whole ban list, because a future edit that "fixes" the void under a
    // three-row preview would land HERE first.
    expect(source).toMatch(/export function DiscoveryLeaderboard\(/)
    expect(source).toMatch(/<DiscoveryLeaderboard\b/)
    for (const banned of [
      /contentContainerStyle=\{\[/,
      /contentPinned/,
      /bottomAnchored/,
      /flexGrow/,
      /justifyContent: "flex-end"/,
      /useKeyboardInset/,
      /keyboardReserve/,
    ]) {
      expect(source).not.toMatch(banned)
    }
    // The resting surface still ends on the unconditional spacer, below this section.
    expect(source).toMatch(/\n\s*<View style=\{styles\.bottomPad\} \/>\n/)
  })
})

/**
 * The Discovery leaderboard's you-row depends on a SERVER threshold, not on anything visible here: the
 * route computes `viewerRank`/`viewerHours` only when the request's `limit` is at least 25 and omits both
 * keys otherwise. Asking for only the three rows rendered would make the row structurally unreachable,
 * so the request limit and the render limit are two different numbers, and this is the tripwire for
 * anyone who "optimises" them back into one.
 */
describe("Discovery leaderboard asks for the extras threshold, renders the preview", () => {
  const source = searchBodySource()

  it("requests LEADERBOARD_REQUEST_LIMIT, never the preview limit", () => {
    expect(source).toContain("useJurisdictionLeaderboard(geo?.geoid, { limit: LEADERBOARD_REQUEST_LIMIT })")
    expect(source).not.toContain("{ limit: LEADERBOARD_PREVIEW_LIMIT }")
  })

  it("keeps the you-row wired to the page the request returns, gated on the RENDER limit", () => {
    // The rows shown are still three (`assembleSearchSuggestions` slices), so the "am I already above
    // this list?" test stays keyed to the preview limit.
    expect(source).toContain("viewerRank={leaderboardPage?.viewerRank ?? null}")
    expect(source).toContain("viewerHours={leaderboardPage?.viewerHours ?? null}")
    expect(source).toContain("viewerRank > LEADERBOARD_PREVIEW_LIMIT")
  })
})

/**
 * An EMPTY board must still render the section. Almost no jurisdiction has any credited hours, so gating
 * the call site on `sections.leaderboard.length > 0` makes the whole section (header, "See all" and all)
 * vanish, while the FULL page shows a "be the first" empty state for the very same geoid.
 */
describe("Discovery leaderboard survives an empty board", () => {
  const source = searchBodySource()
  const emptyNoticeHeight = inlineEmptyHeight
  const LEGACY_EMPTY_CARD_HEIGHT = { titleOnly: 52, withBody: 94 }

  it("gates the section on the query SETTLING, never on the row count", () => {
    expect(source).toContain("const showLeaderboard = !!geo && leaderboardQuery.isSuccess")
    // The row-count gate, in either of its two forms. `sections.leaderboard` is what gets RENDERED; it
    // must not decide whether the section exists.
    expect(source).not.toMatch(/geo && sections\.leaderboard\.length > 0/)
    expect(source).not.toMatch(/sections\.leaderboard\.length > 0\s*\?\s*\(?\s*<DiscoveryLeaderboard/)
  })

  it("renders the FULL page's empty copy rather than a second, drifting wording", () => {
    // Cross-namespace `leaderboard:` keys, so the preview and LeaderboardBody say the same thing in all
    // four locales without a new namespace to keep in sync.
    expect(source).toContain('t("leaderboard:empty.title")')
    expect(source).toContain('t("leaderboard:empty.body")')
    expect(source).toContain("entries.length === 0")
  })

  it("plumbs participantCount, the count the server computes for exactly this reading", () => {
    expect(source).toContain("participantCount={leaderboardPage?.participantCount ?? null}")
    expect(source).toContain("participantCount === 0")
  })

  it("ends up SHORTER than the bespoke card it replaced, not taller", () => {
    expect(emptyNoticeHeight(0)).toBeLessThan(LEGACY_EMPTY_CARD_HEIGHT.titleOnly)
    expect(emptyNoticeHeight(2)).toBeLessThan(LEGACY_EMPTY_CARD_HEIGHT.withBody)
    expect(emptyNoticeHeight(1)).toBeLessThanOrEqual(60)
  })

  it("renders the empty branch through the compact shared primitive", () => {
    expect(source).toMatch(/isEmpty \? \(\s*<View style=\{styles\.leaderboardEmpty\}>\s*<EmptyState\s+variant="inline"/)
    expect(source).not.toMatch(/leaderboardEmptyTitle|leaderboardEmptyBody/)
    expect(source).not.toMatch(/leaderboardEmpty: \{[^}]*paddingVertical/)
  })

  it("drops the section's own dead space when the board is empty", () => {
    expect(source).toContain("const isEmpty = entries.length === 0")
    expect(source).toContain("styles.sectionHeader, precededBySection ? styles.laterTitle : null")
    expect(source).not.toContain("[styles.sectionHeader, styles.laterTitle]")
    expect(source).toContain("precededBySection={sections.people.length > 0 || sections.events.length > 0}")
    expect(source).toMatch(/\{name && !isEmpty \? \(/)
    expect(source).not.toMatch(/\{name \? <Text style=\{styles\.leaderboardSub\}/)
  })

  it("keeps the empty-board branch free of the layout tokens the top-anchored recents ban", () => {
    for (const banned of [
      /contentContainerStyle=\{\[/,
      /flexGrow/,
      /justifyContent: "flex-end"/,
      /useKeyboardInset/,
      /keyboardReserve/,
    ]) {
      expect(source).not.toMatch(banned)
    }
  })
})

/**
 * The Discovery preview draws the SHARED row, not a second copy of it. A re-inlined row here is how the
 * search page and the host screens drift apart.
 */
describe("the Discovery leaderboard draws the shared row", () => {
  const source = searchBodySource()

  it("imports LeaderboardRow from its own module and renders it for both the list and the you-row", () => {
    expect(source).toContain('import { LeaderboardRow } from "../LeaderboardRow"')
    expect(source).not.toMatch(/LeaderboardHitRow/)
    expect(source).toContain("<LeaderboardRow key={entry.userId} entry={entry} />")
    expect(source).toContain("<LeaderboardRow key={youEntry.userId} entry={youEntry} you />")
  })
})
