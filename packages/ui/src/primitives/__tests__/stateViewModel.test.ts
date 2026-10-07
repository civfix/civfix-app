import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { space } from "@civfix/shared/tokens"
import { INLINE_EMPTY_LAYOUT, inlineEmptyHeight } from "../stateViewModel"

const source = readFileSync(new URL("../StateView.tsx", import.meta.url), "utf8")
const emptyState = source.slice(
  source.indexOf("export function EmptyState("),
  source.indexOf("export interface SignInPromptProps"),
)
const inlineBranch = emptyState.slice(
  emptyState.indexOf('if (variant === "inline") {'),
  emptyState.indexOf("<CenterBox variant={variant}>"),
)
const fullScreenBranch = emptyState.slice(emptyState.indexOf("<CenterBox variant={variant}>"))

describe("EmptyState inline layout", () => {
  it("costs less than a leaderboard row's worth of dead space", () => {
    expect(inlineEmptyHeight(0)).toBe(44)
    expect(inlineEmptyHeight(1)).toBeLessThanOrEqual(60)
  })

  it("pads with the space token the compact rhythm asks for, not the full-screen one", () => {
    expect(INLINE_EMPTY_LAYOUT.paddingVertical).toBe(space["3"])
    expect(INLINE_EMPTY_LAYOUT.gap).toBe(space["3"])
  })

  it("keeps the glyph at row scale: there is no bubble to inflate the block", () => {
    expect(INLINE_EMPTY_LAYOUT.iconSize).toBeGreaterThanOrEqual(20)
    expect(INLINE_EMPTY_LAYOUT.iconSize).toBeLessThanOrEqual(24)
    expect(inlineBranch).not.toContain("IconBubble")
    expect(inlineBranch).not.toContain("styles.bubble")
  })

  it("sets the title at body scale and the copy below it, never the 20pt display title", () => {
    expect(inlineBranch).toContain('variant="bodyStrong"')
    expect(inlineBranch).not.toContain('variant="title"')
    expect(inlineBranch).toContain('variant="label"')
    expect(INLINE_EMPTY_LAYOUT.titleLineHeight).toBe(20)
    expect(INLINE_EMPTY_LAYOUT.bodyLineHeight).toBeLessThan(INLINE_EMPTY_LAYOUT.titleLineHeight)
  })

  it("leads with the glyph on the title's line instead of stacking it", () => {
    expect(inlineBranch).toContain("styles.inlineRow")
    expect(source).toMatch(/inlineRow: \{\s*flexDirection: "row"/)
  })

  it("leaves the full-screen variants on the bubble", () => {
    expect(fullScreenBranch).toContain("IconBubble")
    expect(source).toMatch(/bubble: \{\s*width: 64/)
  })
})
