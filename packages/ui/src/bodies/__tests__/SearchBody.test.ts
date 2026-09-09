import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { getSearchBodyMode } from "../searchRecentStore"

describe("SearchBody state", () => {
  it("keeps the resting search page for a blank navigation query", () => {
    // Resting == the discovery surface (suggested people / nearby events / nearby reports) when the docked
    // bar is unfocused, or "Recently searched" once it pins (Apple-Music model) — never Browse tiles.
    expect(getSearchBodyMode("   ")).toBe("resting")
  })

  it("switches to grouped results for a typed navigation query", () => {
    expect(getSearchBodyMode("Echo Park")).toBe("results")
  })
})

/**
 * The resting surface's TOP-ANCHORED layout. The package ships no RN renderer, so these are source-text
 * guards — but they guard a rule that a well-meaning keyboard pass has already broken once and would break
 * again: commit a637875 (@civfix/ui 0.33.0) bottom-anchored this surface while a soft keyboard was up, which
 * pushed the "Recently searched" header up to ~335pt down the screen, and the user rejected it. These guards
 * are the tripwire for the revert, so if one of them reds, read THE RULE at the top of `SearchResting`
 * BEFORE relaxing the assertion — the void between a short recents list and the search field is the
 * deliberate trade, not the bug.
 */
describe("SearchBody top-anchored recents", () => {
  const source = readFileSync(new URL("../SearchBody.tsx", import.meta.url), "utf8")

  it("top-anchors the recents surface — one unconditional content style, no flex-end", () => {
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
    // This is the spacer that clears the RESTING dock (0.33.0 dropped it while the keyboard was up, because
    // under flex-end the LAST child becomes the anchor). It must survive the revert AND stay unguarded, or
    // the tail of the discovery list sits under the dock again.
    expect(source).toMatch(/\n\s*<View style=\{styles\.bottomPad\} \/>\n/)
    expect(source).not.toMatch(/\? null : <View style=\{styles\.bottomPad\}/)
    expect(source).toMatch(/bottomPad: \{ height: t\.space\["8"\] \}/)
  })

  it("reads no keyboard signal — this surface's layout is keyboard-independent", () => {
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
    // SearchResting used to read `pinned` itself and pick its own child; that second swap fired ~1 frame
    // after the results->resting one, mounting Discovery's three react-query sections plus a horizontal
    // ScrollView of avatar cards on the fade frames. The surface value is STILL the single frozen one
    // `SearchBody` computed - both gates below read `surface`, never `pinned`.
    expect(source).not.toMatch(/\{pinned \? <RecentlySearched/)
    expect(source).toMatch(/const showRecents = surface === "recents" && \(!expanded \|\| recentCount > 0\)/)
    expect(source).toMatch(/const showDiscovery = surface === "discovery" \|\| expanded/)
    // `expanded` is a LAYOUT prop (it only tells Discovery to yield its large title to the landscape
    // head — bodies/searchField.test.ts) plus, here, the landscape-only rule that discovery STAYS under
    // the focused field. Compact is unchanged: with `expanded` false the two gates are exact opposites,
    // i.e. the old one-or-the-other swap.
    expect(source).toMatch(/\{showRecents \? <RecentlySearched \/> : null\}/)
    expect(source).toMatch(/\{showDiscovery \? <Discovery expanded=\{expanded\} \/> : null\}/)
  })

  it("never lands the LANDSCAPE search entry on an empty card, and keeps discovery in the tab order", () => {
    // Both of Search's primary entries focus the field (§9.17), and the pinned swap used to unmount the
    // whole discovery surface — so the app's most prominent affordance landed a first-run viewer on one
    // grey placeholder line over ~750px of sand, and the 25 controls below the field left the DOM at the
    // moment it took focus (the next Tab exited the document — WCAG 2.1.1 over a whole region).
    expect(source).toContain("const recentCount = useSearchRecentStore((state) => state.recent.length)")
    // With nothing recorded there is no recents block at all in expanded — the empty-recents copy has no
    // job under a field that has just been focused.
    expect(source).toMatch(/recentCount > 0/)
  })

  it("gates the freeze on the DOCK MORPH's settle, never on a keyboard signal", () => {
    // Guards THE RULE from the other direction, and it is the POSITIVE half that makes this a real test
    // rather than a restatement of the `reads no keyboard signal` case above: the freeze's release must
    // come from the morph's own settle flag. The moment its condition reads a keyboard value instead,
    // some layout here is keyboard-conditional again — which is exactly what a637875 (@civfix/ui 0.33.0)
    // shipped and this file exists to prevent.
    expect(source).toMatch(/state\.searchExitSettled/)
    expect(source).not.toMatch(/state\.keyboardReserve/)
    expect(source).not.toMatch(/useKeyboardInset\(\)/)
  })

  it("the Discovery leaderboard section smuggled in none of the banned layout tokens", () => {
    // A tripwire aimed squarely at the section added with the service-hours work: `DiscoveryLeaderboard`
    // is plain top-anchored content appended into the existing fragment, and it must stay that way. This
    // asserts the section actually landed (so the guard cannot silently pass on a file that lost it) and
    // then re-runs THE RULE's whole ban list over the file that now contains it — the three assertions
    // above were written before this section existed, and a future edit that "fixes" the void under a
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
    // And the resting surface still ends on the unconditional spacer, below the new section.
    expect(source).toMatch(/\n\s*<View style=\{styles\.bottomPad\} \/>\n/)
  })
})

/**
 * The Discovery leaderboard's you-row depends on a SERVER threshold, not on anything visible here: the
 * route computes `viewerRank`/`viewerHours` only when the request's `limit` is at least 25 and omits both
 * keys otherwise. Asking for the three rows rendered therefore made the row structurally unreachable —
 * the guard that gates it could never be true. The request limit and the render limit are two different
 * numbers now, and this is the tripwire for anyone who "optimises" them back into one.
 */
describe("Discovery leaderboard asks for the extras threshold, renders the preview", () => {
  const source = readFileSync(new URL("../SearchBody.tsx", import.meta.url), "utf8")

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
 * An EMPTY board must still render the section. This is the defect that made the leaderboard look like it
 * had been dropped from the app: the call site was gated on `sections.leaderboard.length > 0`, and almost
 * no jurisdiction has any credited hours, so the whole section — header, "See all" and all — rendered
 * nothing at all, while the FULL page showed a "be the first" empty state for the very same geoid.
 */
describe("Discovery leaderboard survives an empty board", () => {
  const source = readFileSync(new URL("../SearchBody.tsx", import.meta.url), "utf8")

  it("gates the section on the query SETTLING, never on the row count", () => {
    expect(source).toContain("const showLeaderboard = !!geo && leaderboardQuery.isSuccess")
    // The old gate, in either of its two forms. `sections.leaderboard` is still what gets RENDERED; it
    // just no longer decides whether the section exists.
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

  it("still bans the layout tokens THE RULE forbids, now that the empty branch exists too", () => {
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
