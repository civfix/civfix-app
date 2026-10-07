/**
 * Each test pins an alignment claim the row makes, so prose and numbers cannot quietly disagree: the content
 * column, the repost label on it, the attachment gap versus the text gap, and a meta row whose height is its
 * text's with no height-cancelling negative margin.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { POST_CARD_RHYTHM, postCardGeometry } from "../../primitives/postCardRhythm"
import {
  postActionGlyphInset,
  postActionLayout,
  postActionRowAvailableWidth,
  postActionRowWidth,
} from "../../primitives/postActionModel"

const r = POST_CARD_RHYTHM
const POST_CARD_SOURCE = readFileSync(new URL("../PostCard.tsx", import.meta.url), "utf8")
const OVERFLOW_BUTTON_SOURCE = readFileSync(
  new URL("../../primitives/PostOverflowButton.tsx", import.meta.url),
  "utf8",
)

/**
 * `//` comments are stripped because these blocks may describe the margins they must not contain, and a
 * naive grep would fail on the comment that documents the invariant.
 */
function styleBlock(name: string, source: string = POST_CARD_SOURCE): string {
  const start = source.indexOf(name)
  expect(start, `${name} is gone - rename the guard, do not delete it`).toBeGreaterThan(-1)
  const open = source.indexOf("{", start)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1
    if (source[i] === "}") {
      depth -= 1
      if (depth === 0) {
        return source.slice(open, i + 1).replace(/^\s*\/\/.*$/gm, "")
      }
    }
  }
  throw new Error(`unbalanced braces after ${name}`)
}

describe("PostCard row rhythm", () => {
  it("hoists ONE geometry - the exported constant is the function's result", () => {
    expect(POST_CARD_RHYTHM).toEqual(postCardGeometry())
  })

  it("starts the content column at exactly rowPaddingH + avatar + gutterGap", () => {
    expect(r.contentLeft).toBe(r.rowPaddingH + r.avatar + r.gutterGap)
    expect(r.contentLeft).toBe(68)
  })

  it("keeps every distance on the 4pt scale", () => {
    for (const value of [
      r.rowPaddingH,
      r.rowPaddingTop,
      r.rowPaddingBottom,
      r.gutterGap,
      r.textGap,
      r.attachmentGap,
      r.attachmentExtraMargin,
      r.repostGlyphGap,
    ]) {
      expect(value % 4).toBe(0)
    }
  })

  // RN `gap` is uniform across a column's children, so a single value cannot serve both the text blocks and
  // the attachments. `attachmentExtraMargin` is the difference an attachment wrapper adds; if the two
  // converge, photos collide with the body text.
  it("separates an attachment from the body by three text gaps, not one", () => {
    expect(r.attachmentGap).toBe(r.textGap * 3)
    expect(r.attachmentGap).toBeGreaterThanOrEqual(12)
    expect(r.attachmentExtraMargin).toBe(r.attachmentGap - r.textGap)
    expect(r.attachmentExtraMargin).toBeGreaterThan(0)
  })

  /**
   * PostMediaGrid returns null with no media, but a mounted zero-height wrapper still spends the column's
   * `gap` on each side plus its own `marginTop`, doubling the space under the body text. Read from the
   * source because it is a JSX condition, not a number.
   */
  it("mounts the media attachment wrapper only when there IS media", () => {
    expect(POST_CARD_SOURCE).toMatch(/media\.length > 0 \? \(\s*<View style=\{styles\.attachment\}>\s*<PostMediaGrid/)
  })

  // The overflow button is the only thing in the meta row that ever wanted to be taller than the text, so
  // this is the property that makes a height-cancelling margin unnecessary rather than merely absent.
  it("sizes the overflow button to the row, so it has no height for a margin to cancel", () => {
    expect(r.overflowBoxHeight).toBe(r.metaRowMinHeight)
    // The 44pt floor is spent on the width, the axis react-native-web can deliver since it drops hitSlop;
    // the height stays the row's, which keeps the button inside its parent's bounds.
    expect(r.overflowTarget).toBeGreaterThan(r.overflowBoxHeight)
    // The absolute disc may overhang; the glyph may not, or on Android a tap on it dispatches to the row
    // Pressable and opens the thread instead of the menu.
    expect(r.overflowHaloTop).toBeLessThan(0)
    expect(r.overflowGlyph).toBeLessThanOrEqual(r.overflowBoxHeight)
    expect(r.overflowHaloLeft).toBe((r.overflowTarget - r.overflowHalo) / 2)
    expect(r.overflowHaloTop).toBe((r.overflowBoxHeight - r.overflowHalo) / 2)
  })

  /**
   * A negative margin on the shared meta-row style is the absence-of-a-declaration that no rhythm number can
   * see. Only the source can show it.
   */
  it("lets no negative margin back into the shared meta-row style", () => {
    const block = styleBlock("const META_ROW: ViewStyle =")
    expect(block).toContain("minHeight: POST_CARD_RHYTHM.metaRowMinHeight")
    expect(block).not.toMatch(/margin[A-Za-z]*:\s*-/)
    // The button's own height must stay the row's rather than being cancelled back to it, and an absolute
    // button would extend past its parent, where Android dispatches the tap to the row.
    const button = styleBlock("moreButton: {", OVERFLOW_BUTTON_SOURCE)
    expect(button).toContain("height: RHYTHM.overflowBoxHeight")
    expect(button).not.toContain("position: \"absolute\"")
    expect(button).not.toMatch(/margin(Top|Bottom|Vertical):\s*-/)
  })

  /**
   * The one negative margin allowed: on web, where hit-testing has no ancestor-bounds rule, `WEB_MORE_TARGET`
   * grows the button to the full `overflowTarget` square and hands the growth back as margin. It cancels its
   * own box's growth only while the two halves agree, so the identity is pinned rather than the literals.
   */
  it("gives back exactly what the web target grows, so the row's rhythm is unchanged", () => {
    const grown = styleBlock("const WEB_MORE_TARGET: ViewStyle =", OVERFLOW_BUTTON_SOURCE)
    expect(grown).toContain("height: RHYTHM.overflowTarget")
    expect(grown).toContain("marginTop: -WEB_MORE_TARGET_GROWTH")
    expect(grown).toContain("marginBottom: -WEB_MORE_TARGET_GROWTH")
    // The margin box - the only thing the meta row measures - is still the row's own text height.
    const growth = (r.overflowTarget - r.overflowBoxHeight) / 2
    expect(r.overflowTarget - growth - growth).toBe(r.overflowBoxHeight)
    // The disc has to re-centre on the taller box or it would paint `growth` px low on web.
    expect((r.overflowTarget - r.overflowHalo) / 2 - growth).toBe(r.overflowHaloTop)
    // WCAG 2.5.8 (Target Size Minimum, AA) is 24x24; the grown box is the same 44 its four siblings get.
    expect(r.overflowTarget).toBeGreaterThanOrEqual(44)
    // ...and it is big enough to CONTAIN the halo, which is the affordance the reader aims at.
    expect(r.overflowTarget).toBeGreaterThanOrEqual(r.overflowHalo)
  })

  // The avatar sits at `rowPaddingH` on the left; the overflow glyph must sit at the same inset on the
  // right, which means the 44pt box hangs out by exactly its own internal padding.
  it("hangs the overflow button out by its own glyph padding, so both insets agree", () => {
    expect(r.overflowOverhang).toBe((r.overflowTarget - r.overflowGlyph) / 2)
    expect(r.overflowOverhang).toBeLessThan(r.rowPaddingH)
    expect(r.overflowTarget).toBeGreaterThanOrEqual(44)
  })

  // The row's two circular affordances (the "..." and each action glyph) must be the same disc, or the one
  // on the "..." reads as an oversized blob.
  it("gives the overflow button the same halo the action glyphs get, inside a bigger target", () => {
    expect(r.overflowHalo).toBe(postActionLayout("timeline").haloSize)
    expect(r.overflowHalo).toBeLessThan(r.overflowTarget)
    expect(r.overflowHalo).toBeGreaterThan(r.overflowGlyph)
  })

  it("lands the repost strip's LABEL on the content column while its glyph hangs into the gutter", () => {
    expect(r.repostLabelLeft).toBe(r.contentLeft)
    // The glyph itself is deliberately LEFT of the column - that is the timeline convention.
    expect(r.rowPaddingH + r.repostIndent).toBeLessThan(r.contentLeft)
    expect(r.repostIndent).toBeGreaterThan(0)
  })

  // The action bar's own 44pt box already contributes ~12pt of empty space under its glyph row, matching the
  // row's top padding; a real bottom padding on top of it double-counts and reads lopsided.
  it("lets the action bar's intrinsic slack BE the row's bottom padding", () => {
    expect(r.actionRowSlack).toBe((r.actionRowTarget - r.actionGlyph) / 2)
    expect(r.rowPaddingBottom).toBe(0)
    expect(Math.abs(r.actionRowSlack - r.rowPaddingTop)).toBeLessThanOrEqual(1)
  })

  // The rhythm module and the action bar must agree, or the action row drifts out of the content column.
  it("reads its action-row numbers straight off the timeline action density", () => {
    const timeline = postActionLayout("timeline")
    expect(r.actionRowTarget).toBe(timeline.target.minHeight)
    expect(r.actionGlyph).toBe(timeline.glyphSize)
    expect(r.actionGlyphInset).toBe(postActionGlyphInset(timeline))
  })

  // The loading state has to reproduce the loaded row's vertical rhythm, or the feed jumps under the reader
  // as the placeholders are replaced. Flat rows have no list gap (each draws its own hairline), so the
  // skeleton list must not add one either.
  it("gives the loading skeleton the same row-to-row rhythm as a loaded row", () => {
    const feed = readFileSync(new URL("../FeedBody.tsx", import.meta.url), "utf8")
    expect(feed).toContain('list: { gap: POST_SURFACE === "flat" ? 0 : t.space["3"] }')
    // Skeleton pitch = its own paddingVertical, twice; loaded pitch = the row's top padding, its zero bottom
    // padding and a hairline. They must agree to within a pixel.
    const skeletonPitch = 2 * r.rowPaddingTop
    const loadedPitch = r.rowPaddingTop + r.rowPaddingBottom + r.rowPaddingTop + 1
    expect(Math.abs(skeletonPitch - loadedPitch)).toBeLessThanOrEqual(1)
  })
})

/**
 * Whether the row fits is not self-evident from a StyleSheet (an in-flow halo or a count `<Text>` without
 * `flexShrink` makes the numbers print over the neighbouring disc), so it is checked as arithmetic.
 *
 * The widths below are text measurements, not tokens: Hanken Grotesk Medium at 13px has a digit advance of
 * ~0.55em (7.2px), a full stop ~0.28em (3.7px) and a K/M/B ~0.62em (8.1px). Deliberately generous.
 */
describe("the timeline action row fits the narrowest supported screen", () => {
  const timeline = postActionLayout("timeline")
  // iPhone SE / 13 mini, the narrowest device the app supports.
  const SCREEN = 375
  const available = postActionRowAvailableWidth(timeline, {
    screenWidth: SCREEN,
    rowPaddingH: r.rowPaddingH,
    gutterWidth: r.avatar + r.gutterGap,
  })

  const label = (text: string): number =>
    [...text].reduce((w, ch) => w + (ch === "." ? 3.7 : /[KMB]/.test(ch) ? 8.1 : 7.2), 0)

  it("measures the column the row actually has, negative margins included", () => {
    // 375 - 2x16 inset - 52 gutter = 291 of content column, plus the 13pt the row's own negative margins
    // hand back on each side. If this ever stops being the real geometry the assertions below are fiction.
    expect(available).toBe(SCREEN - 2 * r.rowPaddingH - (r.avatar + r.gutterGap) + 2 * r.actionGlyphInset)
    expect(available).toBe(317)
  })

  it("fits a popular post with room to spare", () => {
    // 1243 likes, 214 replies, 88 reposts, 41 saves: a popular post's realistic counts.
    const natural = postActionRowWidth(timeline, {
      comment: label("214"),
      repost: label("88"),
      like: label("1.2K"),
      save: label("41"),
    })
    expect(natural).toBeLessThanOrEqual(available)
    // A row with no slack has none for a larger system font either.
    expect(available - natural).toBeGreaterThanOrEqual(12)
  })

  it("fits an unengaged post, where every box is exactly its 44pt target", () => {
    const natural = postActionRowWidth(timeline, {})
    // 5 x 44 + 5 gaps. No count is rendered at zero, so nothing is content-driven.
    expect(natural).toBe(5 * timeline.target.minWidth + 5 * timeline.gap)
    expect(natural).toBeLessThanOrEqual(available)
  })

  it("degrades by truncating a count rather than colliding, once nothing could fit", () => {
    // Four simultaneous four-character counts cannot fit, so the guarantee is that the boxes can still reach
    // their 44pt floor, which leaves the overflow inside a shrinkable `<Text>` instead of on the row.
    const worst = postActionRowWidth(timeline, {
      comment: label("9.9K"), repost: label("9.9K"), like: label("9.9K"), save: label("9.9K"),
    })
    const floor = 5 * timeline.target.minWidth + 5 * timeline.gap
    expect(worst).toBeGreaterThan(available)
    expect(floor).toBeLessThanOrEqual(available)
  })
})
