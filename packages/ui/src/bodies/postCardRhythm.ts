/**
 * PostCard's ROW RHYTHM - the timeline row's geometry, as DERIVED numbers instead of StyleSheet literals.
 *
 * THE RULE: every distance in a timeline row comes from the 4pt `space` scale, and every ALIGNMENT claim
 * the row makes is a FUNCTION of the numbers above it - never a hand-tuned literal that happens to agree
 * today. `contentLeft` is not "68"; it is `rowPaddingH + avatar + gutterGap`. The repost strip's indent is
 * not "AVATAR + GUTTER_GAP - 20"; it is whatever puts its LABEL on `contentLeft`. The row's bottom padding
 * is not "2"; it is zero BECAUSE the action bar's 44pt box already contributes ~13pt below its glyph row.
 *
 * WHAT WENT WRONG - the reported defect was "the spacing in the feed does not look good", and it was four
 * separate bugs wearing one costume:
 *
 *  1. ONE uniform 3px gap did the work of four different gaps. RN `gap` is uniform across ALL children, so
 *     the single `content: { gap: 3 }` separated metaRow/replyingTo/body/showMore (where ~4 is right) with
 *     the SAME 3px it put between the body and a photo grid, a bordered LinkedReportCard or a quote card
 *     (where a timeline uses 12). Attachments collided with the text above them. RN cannot vary `gap` per
 *     child, so `attachmentExtraMargin` is the margin an attachment adds ON TOP of `textGap` to reach
 *     `attachmentGap`. That is why the two are related by a test, not by a comment.
 *
 *  2. TWO HEIGHT-CANCELLING NEGATIVE MARGINS on the SHARED meta-row style. `metaRow` carried
 *     `marginTop: -8, marginBottom: -6` to cancel the height that a 40pt overflow button forced onto the
 *     row - but `EmbeddedPostMeta` reuses that same style and renders NO overflow button, so on a repost
 *     row the negatives had nothing to cancel and pulled the author's name up into the row's top padding,
 *     ~18px above the avatar's centre. THE FIX, and the invariant this module pins: the meta row's height
 *     is a function of its TEXT alone (`metaRowMinHeight`), and the overflow button is `overflowBoxHeight`
 *     tall - which IS `metaRowMinHeight` - so it cannot force any height on the row to begin with. A cancel
 *     must live on the thing whose height it cancels, never on a style shared with a variant that lacks it,
 *     and best of all there is nothing to cancel.
 *
 *  3. LEFT AND RIGHT INSETS DISAGREED BY 8px. The overflow button hung out past the row's inset by a bare
 *     `marginRight: -8`, so its glyph sat 8px from the screen edge while the avatar sat at 16. The honest
 *     overhang is `(overflowTarget - overflowGlyph) / 2` - exactly the button's own internal padding -
 *     which puts the GLYPH's edge flush with the content column, matching the avatar on the other side.
 *
 *  4. OFF-SCALE LITERALS EVERYWHERE. `theme.space` was used zero times in PostCard.tsx; the row's numbers
 *     were 2, 3, 4, 5, 6, 7, 9, 10, 10.5, 11, 12.5, 13.5.
 *
 * WHAT THE FIRST CUT GOT WRONG, and why the overflow button is back IN FLOW. It was made
 * `position: absolute` with `top: "50%", marginTop: -22` inside a 22pt row, on the reasoning that
 * react-native-web drops `hitSlop` so only a real 44pt box is a real target on web. True for web - but on
 * ANDROID a touch is dispatched by walking the view tree, and each step tests the point against the CHILD's
 * layout rect, so a point outside an ANCESTOR's bounds never reaches the descendant no matter how big that
 * descendant is. The button extended 11pt above and below a 22pt parent, so those bands fell through to the
 * row's own Pressable and OPENED THE THREAD instead of the menu - a wrong action, not merely a small target.
 * The shape that survives all three platforms: the box keeps the full `overflowTarget` WIDTH (the axis the
 * 44pt floor is actually spent on here, and the axis web cares about) and takes the row's own
 * `overflowBoxHeight` so it never leaves its parent, while the DISC is drawn absolutely and may overhang -
 * decoration is free, touch is not. Growing the row to 44 instead was the other option and costs 22pt of
 * height on every post row plus an 11pt drop of the author's name away from the avatar's top, which is the
 * very rhythm this module exists to protect.
 *
 * Pure, and deliberately free of any react-native / theme import (the theme pulls `Platform`), so this
 * unit-tests directly under vitest. House style: see `postCardModel`, `shell/backAffordance`,
 * `map/dropPinCamera`. `space` comes from the shared design tokens, which is the same object `theme.space`
 * re-exports - so these are real tokens, not new ones.
 */
import { space } from "@civfix/shared/tokens"
import { postActionGlyphInset, postActionLayout } from "../primitives/postActionModel"

const TIMELINE_ACTIONS = postActionLayout("timeline")

export interface PostCardRhythm {
  /** The row's horizontal inset. The avatar starts here and the separator runs full-bleed under it. */
  rowPaddingH: number
  rowPaddingTop: number
  /**
   * ZERO on purpose. The action bar's Pressable is `actionRowTarget` tall around an `actionGlyph`-tall
   * glyph, so it already contributes `actionRowSlack` of empty space below the glyph row - which is the
   * row's bottom padding, optically. Adding a real one on top double-counted it and made the action bar's
   * rhythm visibly lopsided (5px above the glyphs, 13px below).
   */
  rowPaddingBottom: number
  avatar: number
  /** Avatar -> content column. 12, not the old off-scale 10. */
  gutterGap: number
  /** Where the content column starts, measured from the screen edge. */
  contentLeft: number
  /** Between the TEXT blocks of the content column (meta / replying-to / body / show-more). */
  textGap: number
  /** Text -> an ATTACHMENT (media grid, linked event, linked report, fix showcase, quoted post). */
  attachmentGap: number
  /** What an attachment adds on top of `textGap`, since RN `gap` cannot vary per child. */
  attachmentExtraMargin: number
  /** The meta row's floor height: its TEXT's height, independent of the overflow button. */
  metaRowMinHeight: number
  overflowTarget: number
  overflowGlyph: number
  /**
   * The overflow button's IN-FLOW height. It is `metaRowMinHeight` by definition, which is the whole point:
   * a control that is exactly as tall as the row it lives in cannot inflate that row, so the meta row needs
   * no height-cancelling margin and the button never leaves its parent's bounds (which on Android is the
   * difference between opening the menu and opening the thread). The 44pt floor is spent on the WIDTH.
   */
  overflowBoxHeight: number
  /**
   * Diameter of the overflow button's hover/press halo. Taken from the action bar's timeline halo so the
   * two circular affordances on a row are the same size BY CONSTRUCTION - the "..." used to tint its whole
   * 44pt box, which made a disc noticeably larger than the ones under the action glyphs.
   */
  overflowHalo: number
  /** The disc's `left` inside the button: it is centred on the 44pt-wide box. */
  overflowHaloLeft: number
  /**
   * The disc's `top` inside the button, which is NEGATIVE: the disc is taller than the text row it sits in,
   * so it overhangs by design. Legal because it is absolute and decorative - nothing lays out around it and
   * no touch depends on it (the glyph, which IS the at-rest affordance, is entirely inside the box).
   */
  overflowHaloTop: number
  /** How far the overflow button hangs past the content column so its GLYPH is flush with the row inset. */
  overflowOverhang: number
  actionRowTarget: number
  actionGlyph: number
  /** Empty space the action bar's own box contributes above/below its glyph row. */
  actionRowSlack: number
  /** The action bar's leading glyph inset, which `rowTimeline` cancels. */
  actionGlyphInset: number
  repostGlyph: number
  repostGlyphGap: number
  /** The repost strip's left margin, chosen so its LABEL lands on `contentLeft`. */
  repostIndent: number
  /** Where the repost strip's label actually lands. Must equal `contentLeft`. */
  repostLabelLeft: number
}

export function postCardGeometry(): PostCardRhythm {
  const rowPaddingH = space["4"]
  const avatar = 40
  const gutterGap = space["3"]
  const textGap = space["1"]
  const attachmentGap = space["3"]
  const overflowTarget = 44
  // The Ellipsis glyph PostCard renders in that button. Its optical weight is what sets the overhang.
  const overflowGlyph = 17
  const actionRowTarget = TIMELINE_ACTIONS.target.minHeight
  const actionGlyph = TIMELINE_ACTIONS.glyphSize
  // The author name's lineHeight (20) plus a hair, so the meta line is text-height and nothing more.
  const metaRowMinHeight = 22
  // The Repeat2 glyph the "X reposted" strip renders. It deliberately HANGS into the gutter (the way every
  // timeline product does) while its label lines up with the content column.
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
