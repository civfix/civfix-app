/**
 * The timeline row's geometry, derived from the 4pt `space` scale so every alignment is a function of the
 * numbers it depends on: the content column is inset + avatar + gutter, and the repost label lands on it.
 * The overflow box is exactly the meta row's height because Android hit-testing stops at an ancestor's
 * bounds, so a taller box would let taps above and below it open the thread instead of the menu; the 44pt
 * floor is spent on its width, and its halo is absolute decoration that may overhang. Kept free of
 * react-native imports so it unit-tests under vitest.
 */
import { space } from "@civfix/shared/tokens"
import { postActionGlyphInset, postActionLayout } from "../primitives/postActionModel"

const TIMELINE_ACTIONS = postActionLayout("timeline")

export interface PostCardRhythm {
  rowPaddingH: number
  rowPaddingTop: number
  /** Zero because the action bar's `actionRowSlack` below its glyphs already is the bottom padding. */
  rowPaddingBottom: number
  avatar: number
  gutterGap: number
  contentLeft: number
  textGap: number
  attachmentGap: number
  /** What an attachment adds on top of `textGap`, since RN `gap` cannot vary per child. */
  attachmentExtraMargin: number
  metaRowMinHeight: number
  overflowTarget: number
  overflowGlyph: number
  /**
   * Equal to `metaRowMinHeight` so the button cannot inflate the row, which would need a cancelling margin
   * that breaks `EmbeddedPostMeta` (it shares the style without the button).
   */
  overflowBoxHeight: number
  /** The action bar's timeline halo, so both circular affordances on a row match by construction. */
  overflowHalo: number
  overflowHaloLeft: number
  /** Negative: the absolute, decorative disc overhangs the text row while the glyph stays inside the box. */
  overflowHaloTop: number
  /** The button's own padding, so its glyph (not its box) is flush with the row inset. */
  overflowOverhang: number
  actionRowTarget: number
  actionGlyph: number
  actionRowSlack: number
  /** The action bar's leading glyph inset, which `rowTimeline` cancels. */
  actionGlyphInset: number
  repostGlyph: number
  repostGlyphGap: number
  repostIndent: number
  repostLabelLeft: number
}

export function postCardGeometry(): PostCardRhythm {
  const rowPaddingH = space["4"]
  const avatar = 40
  const gutterGap = space["3"]
  const textGap = space["1"]
  const attachmentGap = space["3"]
  const overflowTarget = 44
  const overflowGlyph = 17
  const actionRowTarget = TIMELINE_ACTIONS.target.minHeight
  const actionGlyph = TIMELINE_ACTIONS.glyphSize
  // The author name's lineHeight (20) plus a hair, so the meta line is text-height and nothing more.
  const metaRowMinHeight = 22
  // The repost glyph hangs into the gutter so the strip's label lines up with the content column.
  const repostGlyph = 13
  const repostGlyphGap = space["2"]
  const repostIndent = avatar + gutterGap - repostGlyph - repostGlyphGap

  return {
    rowPaddingH,
    rowPaddingTop: space["3"],
    rowPaddingBottom: 0,
    avatar,
    gutterGap,
    contentLeft: rowPaddingH + avatar + gutterGap,
    textGap,
    attachmentGap,
    attachmentExtraMargin: attachmentGap - textGap,
    metaRowMinHeight,
    overflowTarget,
    overflowGlyph,
    overflowBoxHeight: metaRowMinHeight,
    overflowHalo: TIMELINE_ACTIONS.haloSize,
    overflowHaloLeft: (overflowTarget - TIMELINE_ACTIONS.haloSize) / 2,
    overflowHaloTop: (metaRowMinHeight - TIMELINE_ACTIONS.haloSize) / 2,
    overflowOverhang: (overflowTarget - overflowGlyph) / 2,
    actionRowTarget,
    actionGlyph,
    actionRowSlack: (actionRowTarget - actionGlyph) / 2,
    actionGlyphInset: postActionGlyphInset(TIMELINE_ACTIONS),
    repostGlyph,
    repostGlyphGap,
    repostIndent,
    repostLabelLeft: rowPaddingH + repostIndent + repostGlyph + repostGlyphGap,
  }
}

/** Hoisted: the geometry never varies, so no component may rebuild it per render. */
export const POST_CARD_RHYTHM: PostCardRhythm = postCardGeometry()
