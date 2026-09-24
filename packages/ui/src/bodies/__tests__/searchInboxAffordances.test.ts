import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const searchBody = strip(read("../SearchBody.tsx"))
const searchResults = strip(read("../SearchResults.tsx"))
const leaderboardRow = strip(read("../LeaderboardRow.tsx"))
const inbox = strip(read("../MessagingListBody.tsx"))
const composer = strip(read("../conversation/ConversationComposer.tsx"))
const convoStyles = strip(read("../conversation/styles.ts"))
const reportRow = strip(read("../ReportRow.tsx"))
const events = strip(read("../EventsBody.tsx"))
const people = strip(read("../SocialBody.tsx"))
const headerIconButton = strip(read("../HeaderIconButton.tsx"))

describe("every row answers the pointer", () => {
  it.each([
    ["SearchBody (recents + discovery links)", searchBody, 2],
    ["SearchResults (the person hit)", searchResults, 1],
    ["LeaderboardRow (the row search and both host screens share)", leaderboardRow, 1],
    ["MessagingListBody (thread rows)", inbox, 1],
    ["HeaderIconButton (the compose control both list roots draw)", headerIconButton, 1],
    ["ReportRow (the row every report list draws)", reportRow, 1],
    ["SocialBody (contacts + leaderboard entries)", people, 2],
  ])("%s branches on webHover with the 120ms webTransition", (_name, src, atLeast) => {
    expect(src).toContain("webHover")
    expect(src).toContain("webTransition")
    expect((src.match(/webHover\(state\)/g) ?? []).length).toBeGreaterThanOrEqual(atLeast)
  })

  it.each([
    ["SearchResults (the event hit's card)", searchResults],
    ["SearchBody (the suggested-person card)", searchBody],
    ["SocialBody (the person + suggestion rows)", people],
    ["EventsBody (the event card)", events],
    ["MessagingListBody (the thread row + its overflow chip)", inbox],
  ])("%s reads its hover from the CONTAINER where the control is a sibling", (_name, src) => {
    expect(src).toContain("useRowHover()")
    expect(src).toContain("{...hoverProps}")
    expect(src).not.toContain("tapHovered")
  })

  it("uses the house fills: bgAlt on sand, surfaceTint + borderStrong on a card", () => {
    expect(searchBody).toMatch(/recentRowHovered: \{ backgroundColor: t\.colors\.bgAlt \}/)
    for (const src of [searchResults, leaderboardRow]) {
      expect(src).toMatch(
        /rowHovered: \{ backgroundColor: t\.colors\.surfaceTint, borderColor: t\.colors\.borderStrong \}/,
      )
    }
    expect(inbox).toMatch(/rowHovered: \{[\s\S]{0,160}?backgroundColor: t\.colors\.bgAlt/)
    expect(inbox).toMatch(/rowPressed: \{[\s\S]{0,160}?backgroundColor: wash\(t\.colors\.borderStrong, 0\.35, t\)/)
    expect(inbox).not.toMatch(/rowPressed: \{[\s\S]{0,160}?transform/)
    expect(reportRow).toMatch(/rowHovered: \{[\s\S]{0,80}?backgroundColor: t\.colors\.bgAlt/)
    expect(reportRow).toMatch(/rowCardHovered: \{[\s\S]{0,160}?backgroundColor: t\.colors\.surfaceTint/)
  })

  it("tags its Pressables for the coral keyboard ring instead of Chrome's blue UA outline", () => {
    for (const src of [searchBody, searchResults, leaderboardRow, inbox, reportRow, people, events, composer]) {
      expect(src).toContain("focusRingProps")
    }
  })

  it("keeps the you-row's moss marker through a hover", () => {
    const order = leaderboardRow.indexOf("webHover(state) ? styles.rowHovered : null")
    const you = leaderboardRow.indexOf("you ? styles.leaderYouRow : null")
    expect(order).toBeGreaterThan(-1)
    expect(order).toBeLessThan(you)
  })
})

describe("the chat composer has a visible focus state", () => {
  it("draws the coral ring from the input's OWN focus, not focusRingProps", () => {
    expect(composer).toContain("onFocus={() => setInputFocused(true)}")
    expect(composer).toContain("onBlur={() => setInputFocused(false)}")
    expect(composer).toContain("inputFocused ? styles.inputFocused : null")
  })

  it("uses the same tokens the search field's ring uses", () => {
    expect(convoStyles).toMatch(
      /inputFocused:\s*Platform\.OS === "web"\s*\?\s*\(\{ boxShadow: tokens\.shadow\.ring, borderColor: t\.colors\.accent \}/,
    )
  })
})

describe("the coral links keep their contrast in EVERY state", () => {
  it("hovers with an underline on the label, never an opacity dim", () => {
    expect(searchBody).toMatch(/linkHovered: \{ textDecorationLine: "underline" \}/)
    expect(searchBody).not.toMatch(/linkHovered: \{ opacity/)
    expect(searchBody).toMatch(/webHover\(state\) \? styles\.linkHovered : null,\s*\]\}\s*>\s*\{label\}/)
  })
})

describe("coral TEXT is accentText", () => {
  it("the link ink clears AA in every layout, not only landscape", () => {
    expect(searchBody).toMatch(/clearLabel: \{\s*color: t\.colors\.accentText,/)
    expect(searchBody).not.toContain('t.colors.bloom["600"]')
    expect(searchBody).not.toContain("clearLabelExpanded")
  })
})

describe("the hoisted head's scroll edge", () => {
  it("SearchBody's head and the conversation bar both draw the on-sand rule", () => {
    expect(searchBody).toMatch(
      /expandedHead: \{[\s\S]{0,400}?borderBottomColor: wash\(t\.colors\.borderStrong, 0\.45, t\)/,
    )
    expect(convoStyles).toMatch(
      /headerHostExpanded: \{[\s\S]{0,300}?borderBottomColor: wash\(t\.colors\.borderStrong, 0\.45, t\)/,
    )
    expect(convoStyles).not.toMatch(/headerHostCompact: \{[\s\S]{0,200}?borderBottom/)
  })
})

describe("the event hit is one uniform row", () => {
  it("clamps its meta to a single line in expanded only", () => {
    expect(searchResults).toContain("numberOfLines={expanded ? 1 : 2}")
    expect(searchResults).toContain('useLayoutMode() === "expanded"')
  })
})
