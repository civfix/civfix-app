/**
 * PostCard's row rhythm (bodies/postCardRhythm.ts).
 *
 * These are not "does the object have keys" tests. Each one pins an ALIGNMENT CLAIM that PostCard.tsx used
 * to make in a prose comment while the numbers underneath it quietly disagreed - which is how the reported
 * "the spacing in the feed does not look good" shipped:
 *
 *   - the content column starts at AVATAR + GUTTER_GAP (a comment; nothing checked it);
 *   - the repost strip's label lines up with that column (true only by coincidence of a 13px icon and a
 *     6px gap, and it de-synced the moment the gutter moved);
 *   - an attachment is separated from the body by a timeline-sized gap, not by the text gap (the actual
 *     defect: RN `gap` is uniform, so a photo grid sat 3px under the body text);
 *   - the meta row's height is its TEXT's height and carries no height-cancelling negative margin (the
 *     invariant whose violation made every repost row sit ~18px above its avatar's centre).
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { POST_CARD_RHYTHM, postCardGeometry } from "../postCardRhythm"
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
 * The body of a `const NAME: ViewStyle = { ... }` / `NAME: { ... }` block, for the source-grep guards, with
 * `//` comments stripped - these blocks DESCRIBE the margins they must not contain, so a naive grep would
 * fail on the very comment that documents the invariant.
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

  // THE REPORTED DEFECT. RN `gap` is uniform across a column's children, so a single value cannot serve
  // both the text blocks and the attachments. `attachmentExtraMargin` is the difference an attachment
  // wrapper adds; if these two ever converge again, photos collide with the body text like they did.
  it("separates an attachment from the body by three text gaps, not one", () => {
    expect(r.attachmentGap).toBe(r.textGap * 3)
    expect(r.attachmentGap).toBeGreaterThanOrEqual(12)
    expect(r.attachmentExtraMargin).toBe(r.attachmentGap - r.textGap)
    expect(r.attachmentExtraMargin).toBeGreaterThan(0)
  })

  /**
   * ...and the gap is only that gap while a wrapper exists ONLY when its payload does. This one is invisible
   * to every assertion about the rhythm object: PostMediaGrid returns null with no media, but the wrapper
   * `View` still mounted, and a zero-height flex child still spends the column's `gap` on each side plus its
   * own `marginTop` - so a media-less quote sat `attachmentGap` + `textGap` + `attachmentExtraMargin` = 24pt
   * under the body text, exactly double, while ThreadFocalPost and ThreadReplyRow (which do guard on length)
   * showed the same post at 12pt. Read from the source because it is a JSX condition, not a number.
   */
  it("mounts the media attachment wrapper only when there IS media", () => {
    expect(POST_CARD_SOURCE).toMatch(/media\.length > 0 \? \(\s*<View style=\{styles\.attachment\}>\s*<PostMediaGrid/)
  })

  // The overflow button is the only thing in the meta row that ever wanted to be taller than the text, so
  // this is the property that makes a height-cancelling margin unnecessary rather than merely absent.
  it("sizes the overflow button to the row, so it has no height for a margin to cancel", () => {
    expect(r.overflowBoxHeight).toBe(r.metaRowMinHeight)
    // The 44pt floor is spent on the WIDTH - the axis react-native-web can actually deliver, since it drops
    // hitSlop entirely - and the height stays the row's, which is what keeps it inside its parent's bounds.
    expect(r.overflowTarget).toBeGreaterThan(r.overflowBoxHeight)
    // The disc may overhang, because it is drawn (absolute) rather than laid out. The GLYPH may not: it is
    // the at-rest affordance and every pixel of it has to be inside the button, or a tap on it dispatches
    // to the row Pressable on Android and opens the thread instead of the menu.
    expect(r.overflowHaloTop).toBeLessThan(0)
    expect(r.overflowGlyph).toBeLessThanOrEqual(r.overflowBoxHeight)
    expect(r.overflowHaloLeft).toBe((r.overflowTarget - r.overflowHalo) / 2)
    expect(r.overflowHaloTop).toBe((r.overflowBoxHeight - r.overflowHalo) / 2)
  })

  /**
   * THE REGRESSION TEST FOR THE REPOST BUG, and the only shape of it that can actually fail.
   *
   * The bug was `metaRow: { marginTop: -8, marginBottom: -6 }` in PostCard.tsx's StyleSheet. `PostCardRhythm`
   * does not model those margins and never will - they are the ABSENCE of a declaration - so no assertion
   * about this object can see them come back. Re-add them and every numeric test in this file still passes
   * while every repost row is ~18px misaligned again. So this one reads the source, the way
   * shell/__tests__/backAffordance.test.ts and tabBar.test.ts already do for claims that live in markup.
   */
  it("lets no negative margin back into the shared meta-row style", () => {
    const block = styleBlock("const META_ROW: ViewStyle =")
    expect(block).toContain("minHeight: POST_CARD_RHYTHM.metaRowMinHeight")
    expect(block).not.toMatch(/margin[A-Za-z]*:\s*-/)
    // ...and the same for the button, whose own height must stay the row's rather than being cancelled back
    // to it. `position: absolute` here is the Android wrong-action bug (see postCardRhythm's header).
    const button = styleBlock("moreButton: {", OVERFLOW_BUTTON_SOURCE)
    expect(button).toContain("height: RHYTHM.overflowBoxHeight")
    expect(button).not.toContain("position: \"absolute\"")
    expect(button).not.toMatch(/margin(Top|Bottom|Vertical):\s*-/)
  })

  /**
   * ...and the ONE negative margin the rule above does allow: `WEB_MORE_TARGET` grows the overflow button
   * to the full `overflowTarget` SQUARE on web (where hit-testing has no ancestor-bounds rule, so the
   * Android reason for the 22pt cap does not apply) and hands the growth straight back as margin. That is
   * legal precisely because it cancels its OWN box's growth rather than a height a shared style forced on
   * somebody else - but only while the two halves agree, so pin the identity rather than the literals.
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

  // The row has TWO circular affordances (the "..." and each action glyph). They must be the same disc, or
  // the one on the "..." reads as an oversized blob - which it did, because it tinted its whole 44pt box.
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

  // Why `rowPaddingBottom` is 0 rather than sloppy: the action bar's own 44pt box already contributes
  // ~12pt of empty space under its glyph row, which matches the row's TOP padding. A real bottom padding
  // on top of it double-counts, which is what made the action row's rhythm read lopsided.
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

  // The loading state has to reproduce the LOADED row's vertical rhythm, or the feed jumps under the reader
  // as the placeholders are replaced - which is what `skeletonCard` matching the flat row's avatar and
  // gutter was for. It was only half delivered: the wrapper still carried `gap: 12` while the real rows have
  // none (the flat feed's ItemSeparatorComponent is null and each row draws its own hairline), so three
  // skeletons sat 36pt apart and the rows that replaced them 25pt apart.
  it("gives the loading skeleton the same row-to-row rhythm as a loaded row", () => {
    const feed = readFileSync(new URL("../FeedBody.tsx", import.meta.url), "utf8")
    expect(feed).toContain("list: { gap: POST_SURFACE === \"flat\" ? 0 : 12 }")
    // Skeleton pitch = its own paddingVertical, twice; loaded pitch = the row's top padding, its zero bottom
    // padding and a hairline. They must agree to within a pixel.
    const skeletonPitch = 2 * r.rowPaddingTop
    const loadedPitch = r.rowPaddingTop + r.rowPaddingBottom + r.rowPaddingTop + 1
    expect(Math.abs(skeletonPitch - loadedPitch)).toBeLessThanOrEqual(1)
  })
})

/**
 * DOES THE ACTION ROW FIT? - the question the first cut answered in prose and got wrong.
 *
 * Making the 34pt halo the in-flow content of each button grew every counted button by ~14pt. Four counted
 * buttons plus a 40 -> 44 target is ~+46pt on a column that had ~37pt of slack, so a popular post's row
 * needed ~334pt inside ~317pt on a 375pt screen - and because a count `<Text>` has no `flexShrink` by
 * default, the boxes shrank to their 44pt floor and the numbers printed over the neighbouring disc. The
 * halo is absolute now and the count is shrinkable, but neither of those is self-evident from reading a
 * StyleSheet, so the fit is arithmetic here instead.
 *
 * The widths below are TEXT MEASUREMENTS, not tokens: Hanken Grotesk Medium at 13px has a digit advance of
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
    // 1243 likes, 214 replies, 88 reposts, 41 saves - the exact profile that overflowed by 17pt.
    const natural = postActionRowWidth(timeline, {
      comment: label("214"),
      repost: label("88"),
      like: label("1.2K"),
      save: label("41"),
    })
    expect(natural).toBeLessThanOrEqual(available)
    // Not "it just fits": a row with no slack has none for a larger system font either. 20pt today.
    expect(available - natural).toBeGreaterThanOrEqual(12)
  })

  it("fits an unengaged post, where every box is exactly its 44pt target", () => {
    const natural = postActionRowWidth(timeline, {})
    // 5 x 44 + 5 gaps. No count is rendered at zero, so nothing is content-driven.
    expect(natural).toBe(5 * timeline.target.minWidth + 5 * timeline.gap)
    expect(natural).toBeLessThanOrEqual(available)
  })

  it("degrades by truncating a count rather than colliding, once nothing could fit", () => {
    // Four simultaneous four-character counts. This has NEVER fitted - the 40pt-target row it replaced
    // needed 325 of 303 - so the guarantee is not that it fits but that the boxes can still reach their
    // 44pt floor, which is what leaves the overflow inside a shrinkable `<Text>` instead of on the row.
    const worst = postActionRowWidth(timeline, {
      comment: label("9.9K"), repost: label("9.9K"), like: label("9.9K"), save: label("9.9K"),
    })
    const floor = 5 * timeline.target.minWidth + 5 * timeline.gap
    expect(worst).toBeGreaterThan(available)
    expect(floor).toBeLessThanOrEqual(available)
  })
})
