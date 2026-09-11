import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const MIN_TOUCH_TARGET = 44

const num = (source: string, name: string): number => {
  const found = new RegExp(`const ${name} = ([0-9.]+)`).exec(source)
  expect(found, `${name} is gone - re-scope the guard, do not delete it`).not.toBeNull()
  return Number.parseFloat(found![1] as string)
}

const grown = (
  source: string,
  slopName: string,
  a: string,
  b: string,
  size: number,
): number => {
  const block = new RegExp(`const ${slopName} = \\{([\\s\\S]*?)\\n\\}`).exec(source)
  expect(block, `${slopName} is not an object literal - re-scope the guard`).not.toBeNull()
  const side = (name: string): number => {
    const line = new RegExp(`${name}: ([^,\\n]+)`).exec(block![1] as string)
    expect(line, `${slopName}.${name} is missing`).not.toBeNull()
    const raw = (line![1] as string).trim()
    if (/^[0-9.]+$/.test(raw)) return Number.parseFloat(raw)
    const expr = /^\(([A-Z_]+) - ([A-Z_]+)\) \/ 2$/.exec(raw)
    expect(expr, `unrecognised slop expression: ${raw}`).not.toBeNull()
    return (num(source, expr![1] as string) - num(source, expr![2] as string)) / 2
  }
  return size + side(a) + side(b)
}

describe("ComposerThumbs: the remove button lives INSIDE the thumb it belongs to", () => {
  const SRC = read("../../primitives/ComposerThumbs.tsx")

  it("is positioned flush in the cell corner, not overhanging it", () => {
    expect(SRC).toMatch(/thumbRemove: \{\s*position: "absolute",\s*top: 0,\s*right: 0,/)
    expect(SRC).not.toContain("top: -6")
    expect(SRC).not.toContain("right: -6")
  })

  it("spends its whole hitSlop inwards, reaching 44pt without leaving the parent", () => {
    const size = num(SRC, "THUMB_REMOVE_SIZE")
    const target = num(SRC, "THUMB_REMOVE_TARGET")
    const cell = num(SRC, "THUMB_SIZE")
    expect(target).toBe(MIN_TOUCH_TARGET)
    expect(SRC).toMatch(/top: 0,\s*right: 0,\s*bottom: THUMB_REMOVE_TARGET - THUMB_REMOVE_SIZE,/)
    expect(SRC).toMatch(/left: THUMB_REMOVE_TARGET - THUMB_REMOVE_SIZE,/)
    expect(size + (target - size)).toBeLessThanOrEqual(cell)
  })

  it("takes its scrim from the token, not a re-typed rgba", () => {
    expect(SRC).toContain("t.colors.scrimModal")
    expect(SRC).not.toMatch(/rgba\(26,\s?23,\s?20/)
  })
})

describe("SearchBody: the field clear chip and the link actions clear 44pt", () => {
  const SRC = read("../SearchBody.tsx")

  it("caps the clear chip's slop at the pinned 40pt pill it lives in", () => {
    const size = num(SRC, "FIELD_CLEAR_SIZE")
    const field = num(SRC, "FIELD_HEIGHT")
    expect(SRC).toContain("height: FIELD_HEIGHT")
    expect(SRC).toContain("hitSlop={FIELD_CLEAR_HIT_SLOP}")
    const vertical = grown(SRC, "FIELD_CLEAR_HIT_SLOP", "top", "bottom", size)
    const horizontal = grown(SRC, "FIELD_CLEAR_HIT_SLOP", "left", "right", size)
    expect(vertical, "the slop must not escape the pill").toBeLessThanOrEqual(field)
    expect(vertical).toBe(field)
    expect(horizontal).toBe(MIN_TOUCH_TARGET)
  })

  it("gives the text link a 44pt BOX rather than slop its header would clip", () => {
    expect(SRC).toContain("clear: { minHeight: MIN_TOUCH_TARGET, justifyContent: \"center\"")
    const linkAction = SRC.slice(SRC.indexOf("function LinkAction"), SRC.indexOf("function SuggestedPersonCard"))
    expect(linkAction, "the box IS the target now - no slop to clip").not.toContain("hitSlop")
  })

  it("reads the shared result-card layout instead of re-typing 18 and 9", () => {
    expect(SRC).toContain('import { SEARCH_RESULT_CARD_LAYOUT } from "./searchResultsModel"')
    expect(SRC).toContain("borderRadius: SEARCH_RESULT_CARD_LAYOUT.radius")
    expect(SRC).toContain("gap: SEARCH_RESULT_CARD_LAYOUT.gap")
    expect(SRC).not.toMatch(/borderRadius: 18,/)
    expect(SRC).not.toMatch(/suggestGroup: \{ gap: 9 \}/)
  })
})

describe("SocialBody: the message button and the field clear chip clear 44pt", () => {
  const SRC = read("../SocialBody.tsx")

  it("grows the search field to fit its clear chip's slop", () => {
    const size = num(SRC, "CLEAR_BTN_SIZE")
    expect(SRC).toContain("minHeight: MIN_TOUCH_TARGET")
    expect(SRC).toContain("hitSlop={CLEAR_BTN_HIT_SLOP}")
    expect(SRC).toContain("const CLEAR_BTN_HIT_SLOP = (MIN_TOUCH_TARGET - CLEAR_BTN_SIZE) / 2")
    const slop = (num(SRC, "MIN_TOUCH_TARGET") - size) / 2
    expect(size + slop * 2).toBe(MIN_TOUCH_TARGET)
  })

  it("spends the message button's slop INWARD, across the dead sibling gap", () => {
    const size = num(SRC, "ICON_BTN_SIZE")
    expect(SRC).toContain("hitSlop={ICON_BTN_HIT_SLOP}")
    expect(SRC).toMatch(/left: ROW_GAP,\s*\n\s*right: 0,/)
    expect(SRC).toContain('const ROW_GAP = space["3"]')
    expect(SRC).toContain("gap: ROW_GAP,")
    const vertical = grown(SRC, "ICON_BTN_HIT_SLOP", "top", "bottom", size)
    expect(vertical).toBe(MIN_TOUCH_TARGET)
    expect(size + 12).toBe(MIN_TOUCH_TARGET)
  })
})

describe("MessagingListBody: the inbox's own field clear chip clears 44pt", () => {
  const SRC = read("../MessagingListBody.tsx")

  it("takes SocialBody's slop arithmetic rather than a second one", () => {
    expect(num(SRC, "MIN_TOUCH_TARGET")).toBe(MIN_TOUCH_TARGET)
    expect(SRC).toContain("minHeight: MIN_TOUCH_TARGET")
    expect(SRC).toContain("hitSlop={CLEAR_BTN_HIT_SLOP}")
    expect(SRC).toContain("const CLEAR_BTN_HIT_SLOP = (MIN_TOUCH_TARGET - CLEAR_BTN_SIZE) / 2")
    const size = num(SRC, "CLEAR_BTN_SIZE")
    const slop = (MIN_TOUCH_TARGET - size) / 2
    expect(size + slop * 2).toBe(MIN_TOUCH_TARGET)
  })

  it("the thread row IS its own target - the flat row is taller than the floor, not shorter", () => {
    expect(num(SRC, "ROW_MIN_HEIGHT")).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
    expect(SRC).toContain("minHeight: ROW_MIN_HEIGHT")
  })

  it("the title row is the box the compose + profile controls sit in, itself past 44pt", () => {
    expect(SRC).toMatch(/header: \{[\s\S]{0,160}?minHeight: HEADER_CONTROL_SIZE/)
    const controls = read("../headerControls.ts")
    expect(num(controls, "HEADER_CONTROL_SIZE")).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
  })
})

describe("ProfileStatsRow: the inline counts are targets, not just text", () => {
  const SRC = read("../ProfileStatsRow.tsx")

  it("gives the two pressable counts a 44pt BOX, never slop", () => {
    expect(num(SRC, "MIN_TOUCH_TARGET")).toBe(MIN_TOUCH_TARGET)
    expect(SRC).toMatch(/stat: \{\s*flex: 1,\s*minHeight: MIN_TOUCH_TARGET,/)
    expect(SRC, "slop cannot reach the web target - the box has to").not.toContain("hitSlop")
  })

  it("shares width by flex columns, with no gap/padding spacing to skew them", () => {
    expect(SRC).not.toMatch(/gap:/)
    expect(SRC).not.toMatch(/paddingHorizontal|marginHorizontal/)
  })

  it("gives ALL FIVE the same box, so the two pressable ones are not the odd metric out", () => {
    expect(SRC).toMatch(/<View key=\{item\.key\} style=\{styles\.stat\}>/)
    expect(SRC).toContain("styles.stat,")
    expect(SRC).not.toMatch(/React\.Fragment/)
  })

  it("renders all five in ONE row of equal columns", () => {
    expect(SRC).toContain("<View style={styles.row}>{items.map(renderStat)}</View>")
    expect(SRC).not.toMatch(/const connections = items\.filter/)
  })
})

describe("the Posts tab's Saved affordance is a target, not just a text link", () => {
  const SRC = read("../profile/ProfilePostsSection.tsx")

  it("carries the 44pt floor as a box and the house focus ring", () => {
    expect(num(SRC, "SAVED_MIN_HEIGHT")).toBe(MIN_TOUCH_TARGET)
    expect(SRC).toMatch(/saved: \{[\s\S]*?minHeight: SAVED_MIN_HEIGHT/)
    expect(SRC).toContain("{...focusRingProps}")
    expect(SRC, "the box IS the target - no slop to clip").not.toContain("hitSlop")
  })

  it("sits inline opposite the POSTS eyebrow as soft underlined text, not a filled pill", () => {
    expect(SRC).toMatch(/headRow: \{[\s\S]*?justifyContent: "space-between",/)
    expect(SRC).toMatch(/<View style=\{styles\.headRow\}>\s*<SectionEyebrow>/)
    expect(SRC).toMatch(/savedText: \{[\s\S]*?textDecorationLine: "underline",/)
    expect(SRC).toMatch(/savedText: \{[\s\S]*?color: t\.colors\.textMuted,/)
    expect(SRC).not.toMatch(/saved: \{[\s\S]*?backgroundColor/)
    expect(SRC).not.toContain("iconMap.Bookmark")
  })
})
