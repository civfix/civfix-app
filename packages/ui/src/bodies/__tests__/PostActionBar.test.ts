import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { PostCounts, PostViewer } from "@civfix/shared"
import {
  buildPostActionMenuModel,
  buildPostActionModel,
  buildPostActionMotionModel,
  formatPostActionCount,
  postActionButtonWidth,
  postActionCountGap,
  postActionGlyphInset,
  postActionHaloFamily,
  postActionHaloInset,
  postActionHaloOverhang,
  postActionLayout,
  postActionRowWidth,
  type PostActionVariant,
} from "../../primitives/postActionModel"

const counts: PostCounts = {
  likes: 1240,
  reposts: 8,
  replies: 23,
  saves: 4,
}

const viewer: PostViewer = {
  liked: true,
  reposted: false,
  saved: true,
}

describe("PostActionBar timeline density", () => {
  const timeline = postActionLayout("timeline")

  it("left-packs the reciprocal actions with reply first and pins share trailing", () => {
    expect(timeline.keys).toEqual(["comment", "repost", "like", "save"])
    expect(timeline.trailing).toBe("share")
    expect(timeline.justify).toBe("flex-start")
  })

  it("carries its whole 44pt target in the box, because rn-web drops hitSlop", () => {
    expect(timeline.target).toEqual({ minWidth: 44, minHeight: 44 })
    expect(timeline.minHeight).toBe(44)
  })

  it("shows counts (the timeline row is the surface that has no stats row above it)", () => {
    expect(timeline.showCounts).toBe(true)
  })

  it("leaves every other density without a trailing key, so their layout is unchanged", () => {
    expect(postActionLayout("card").trailing).toBeUndefined()
    expect(postActionLayout("focal").trailing).toBeUndefined()
    expect(postActionLayout("reply").trailing).toBeUndefined()
  })

  // The component orders its buttons by `layout.keys`, so every key a density names has to exist in the
  // built model - otherwise that action silently disappears from the row.
  it("names only keys the model actually builds", () => {
    const built = new Set(
      buildPostActionModel({ postId: "post-1", counts, viewer }).map((action) => action.key),
    )
    for (const key of [...timeline.keys, timeline.trailing]) {
      expect(built.has(key as never)).toBe(true)
    }
  })
})

describe("PostActionBar model", () => {
  it("orders the complete X-style action set and exposes compact counts", () => {
    const model = buildPostActionModel({ postId: "post-1", counts, viewer })

    expect(model.map((action) => action.key)).toEqual([
      "like",
      "repost",
      "comment",
      "save",
      "share",
    ])
    expect(model.map((action) => action.countLabel)).toEqual(["1.2K", "8", "23", "4", null])
    expect(model.find((action) => action.key === "like")?.active).toBe(true)
    expect(model.find((action) => action.key === "save")?.active).toBe(true)
    expect(model.find((action) => action.key === "share")?.sharePath).toBe("/post/post-1")
  })

  it("calls each interaction with the current viewer state", () => {
    const onLike = vi.fn()
    const onRepost = vi.fn()
    const onComment = vi.fn()
    const onSave = vi.fn()
    const model = buildPostActionModel(
      { postId: "post-1", counts, viewer },
      { onLike, onRepost, onComment, onSave },
    )

    model.find((action) => action.key === "like")?.onPress?.()
    model.find((action) => action.key === "repost")?.onPress?.()
    model.find((action) => action.key === "comment")?.onPress?.()
    model.find((action) => action.key === "save")?.onPress?.()

    expect(onLike).toHaveBeenCalledWith(true)
    expect(onRepost).toHaveBeenCalledWith(false)
    expect(onComment).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith(true)
  })

  it("formats large counts without hiding zero", () => {
    expect(formatPostActionCount(0)).toBe("0")
    expect(formatPostActionCount(999)).toBe("999")
    expect(formatPostActionCount(12_400)).toBe("12K")
    expect(formatPostActionCount(1_250_000)).toBe("1.3M")
  })

  it("hides zero labels in the compact five-action card row", () => {
    const model = buildPostActionModel({
      postId: "post-empty",
      counts: { likes: 0, reposts: 0, replies: 0, saves: 0 },
      viewer: { liked: false, reposted: false, saved: false },
    })

    expect(model.map((action) => action.countLabel)).toEqual([null, null, null, null, null])
  })

  it("models an accessible repost and quote popover", () => {
    expect(buildPostActionMenuModel(false)).toEqual([
      { key: "repost", label: "Repost" },
      { key: "quote", label: "Quote post" },
    ])
    expect(buildPostActionMenuModel(true)[0]).toEqual({ key: "repost", label: "Undo repost" })
  })

  it("disables decorative motion when requested", () => {
    expect(buildPostActionMotionModel(false)).toEqual({ duration: 280, easing: "ease-out", animated: true })
    expect(buildPostActionMotionModel(true)).toEqual({ duration: 0, easing: "linear", animated: false })
  })

  it("omits only the requested keys and keeps the rest in canonical order", () => {
    const model = buildPostActionModel({ postId: "post-1", counts, viewer }, {}, { omit: ["save"] })

    expect(model.map((action) => action.key)).toEqual(["like", "repost", "comment", "share"])
    expect(model.find((action) => action.key === "save")).toBeUndefined()
    // An empty or absent omit list yields the full five-action array.
    expect(buildPostActionModel({ postId: "post-1", counts, viewer }, {}, { omit: [] }))
      .toEqual(buildPostActionModel({ postId: "post-1", counts, viewer }))
  })

  it("keeps the card density identical and gives the thread its two extra densities", () => {
    expect(postActionLayout("card")).toEqual({
      keys: ["like", "repost", "comment", "save", "share"],
      glyphSize: 19,
      gap: 2,
      justify: "space-between",
      minHeight: 44,
      showCounts: true,
      haloSize: 34,
      target: { minWidth: 44, minHeight: 44 },
    })

    const focal = postActionLayout("focal")
    expect(focal.keys).toEqual(["like", "repost", "comment", "save", "share"])
    // Counts are suppressed on the focal post: the stats row above it already prints them.
    expect(focal).toMatchObject({ showCounts: false, glyphSize: 21, minHeight: 48, haloSize: 38 })

    const reply = postActionLayout("reply")
    expect(reply.keys).toEqual(["like", "repost", "comment", "share"])
    expect(reply).toMatchObject({
      justify: "flex-start",
      // Each 32pt box paints a 28pt halo, so a wider gap leaves the discs adrift and four counted buttons
      // overflow an indented reply on a narrow phone.
      gap: 8,
      minHeight: 32,
      glyphSize: 17,
      showCounts: true,
      haloSize: 28,
      target: { minWidth: 32, minHeight: 32 },
    })
  })
})

/**
 * The halo is a transient disc behind the glyph alone; filling the whole Pressable would swallow the count
 * that lives inside it. These keep the disc inside its tap box and the row's negative margin in sync.
 */
describe("PostActionBar halo geometry", () => {
  const variants: readonly PostActionVariant[] = ["timeline", "card", "focal", "reply"]

  // At or above `target.minWidth` the halo bleeds past its own tap box and adjacent halos read as one
  // continuous block.
  it("keeps every halo strictly smaller than its own tap target", () => {
    for (const variant of variants) {
      const layout = postActionLayout(variant)
      expect(layout.haloSize).toBeLessThan(layout.target.minWidth)
      expect(layout.haloSize).toBeLessThan(layout.target.minHeight)
      // ...and strictly bigger than the glyph, or there is no visible disc around it at all.
      expect(layout.haloSize).toBeGreaterThan(layout.glyphSize)
    }
  })

  it("centres the halo in the tap box on a whole pixel", () => {
    for (const variant of variants) {
      const layout = postActionLayout(variant)
      const inset = postActionHaloInset(layout)
      expect(inset).toBe((layout.target.minWidth - layout.haloSize) / 2)
      expect(inset).toBeGreaterThan(0)
      expect(Number.isInteger(inset)).toBe(true)
    }
  })

  // `PostActionBar.styles.rowTimeline` cancels this exact number with a negative margin so the leading
  // glyph is flush with the body text above it; a hard-coded margin would drift when the target changes.
  it("derives the glyph inset from (target, halo, glyph) so the row margin cannot desync", () => {
    for (const variant of variants) {
      const layout = postActionLayout(variant)
      expect(postActionGlyphInset(layout)).toBe(
        (layout.target.minWidth - layout.haloSize) / 2 + (layout.haloSize - layout.glyphSize) / 2,
      )
    }
    // The shipped timeline value, spelled out so a regression is legible in the diff.
    expect(postActionGlyphInset(postActionLayout("timeline"))).toBe(13)
  })

  // WCAG 2.5.5 / HIG floor. react-native-web drops `hitSlop`, so on web the box IS the target.
  it("clears the 44pt floor everywhere except the one deliberate reply exception", () => {
    for (const variant of ["timeline", "card", "focal"] as const) {
      const { target } = postActionLayout(variant)
      expect(target.minWidth).toBeGreaterThanOrEqual(44)
      expect(target.minHeight).toBeGreaterThanOrEqual(44)
    }
    // `reply` is a compact secondary surface and native reaches 48 through the bar's hitSlop: 8. Pinned so
    // the exception stays a deliberate decision.
    expect(postActionLayout("reply").target).toEqual({ minWidth: 32, minHeight: 32 })
  })

  // like -> coral, repost -> green: the halo intensifies the colour the ACTIVE glyph already turns, it
  // never contradicts it. comment / save / share share sky, the way X gives reply, bookmark and share one
  // blue (`save` already resolves to sky.700 when active).
  it("maps each action to the colour family its own glyph uses", () => {
    expect(postActionHaloFamily("like")).toBe("bloom")
    expect(postActionHaloFamily("repost")).toBe("moss")
    expect(postActionHaloFamily("comment")).toBe("sky")
    expect(postActionHaloFamily("save")).toBe("sky")
    expect(postActionHaloFamily("share")).toBe("sky")
  })

  // Not assertable here: that the two stops PostActionBar looks up per family are real `theme.colors`
  // tokens (bloom/moss/sky .50 for hover, .100 for press) and that hover !== press. The theme imports
  // react-native, which this pure test deliberately does not pull in - that is why the family mapping lives
  // in the model and only the token LOOKUP lives in the component. Verified by reading HALO_TINTS.
  it("names only families the component has tokens for", () => {
    const known = new Set(["bloom", "moss", "sky"])
    for (const key of ["like", "repost", "comment", "save", "share"] as const) {
      expect(known.has(postActionHaloFamily(key))).toBe(true)
    }
  })
})

/**
 * The disc is absolute decoration, so a button's natural width is the glyph's; an in-flow disc makes four
 * counted buttons overflow the narrowest screen's content column. These pin the box's single derived
 * padding and the width it implies.
 */
describe("PostActionBar box geometry", () => {
  const variants: readonly PostActionVariant[] = ["timeline", "card", "focal", "reply"]

  /**
   * This identity is what lets one number cancel both row edges: a box with that much paddingLeft, no
   * paddingRight and `minWidth: target` centres the glyph, so `rowTimeline`, `ThreadFocalPost.actionBar` and
   * `ThreadReplyRow.actionsWrap` each cancel with a single `-postActionGlyphInset(layout)`.
   */
  it("collapses the glyph inset to (target - glyph) / 2, independent of the halo", () => {
    for (const variant of variants) {
      const layout = postActionLayout(variant)
      expect(postActionHaloInset(layout) + postActionHaloOverhang(layout)).toBe(
        postActionGlyphInset(layout),
      )
      expect(postActionGlyphInset(layout)).toBe((layout.target.minWidth - layout.glyphSize) / 2)
      // An uncounted button is therefore symmetric: paddingLeft + glyph + the same again == the target.
      expect(2 * postActionGlyphInset(layout) + layout.glyphSize).toBe(layout.target.minWidth)
      expect(postActionButtonWidth(layout)).toBe(layout.target.minWidth)
    }
  })

  // The number has to start where the disc stops, or the tint paints over its first digits on hover - they
  // are siblings inside one Pressable, so the count cannot hide behind the halo.
  it("starts the count exactly where the halo ends", () => {
    for (const variant of variants) {
      const layout = postActionLayout(variant)
      expect(postActionCountGap(layout)).toBe(postActionHaloOverhang(layout))
      const glyphRight = postActionGlyphInset(layout) + layout.glyphSize
      const haloRight = postActionHaloInset(layout) + layout.haloSize
      expect(glyphRight + postActionCountGap(layout)).toBe(haloRight)
    }
  })

  // Fails if `layout.haloSize` ever leaks into the box's flex basis.
  it("prices a counted button off the GLYPH, never off the disc", () => {
    const timeline = postActionLayout("timeline")
    const count = 26.2 // "1.2K" in Hanken Grotesk Medium 13px
    expect(postActionButtonWidth(timeline, count)).toBe(13 + 18 + 8 + count)
    // `paddingHorizontal: haloInset` around an in-flow 34pt disc, then the row's `gap` before the count,
    // costs 9pt per counted button: 36pt across four, enough to overflow a 375pt screen.
    const inFlow = 2 * postActionHaloInset(timeline) + timeline.haloSize + timeline.gap + count
    expect(inFlow - postActionButtonWidth(timeline, count)).toBe(9)
  })

  // `trailing` costs one extra child (the flexible spacer), hence one extra gap. Getting this wrong would
  // make every fit assertion optimistic by exactly one gap.
  it("charges the trailing action its spacer's gap", () => {
    const timeline = postActionLayout("timeline")
    const card = postActionLayout("card")
    expect(postActionRowWidth(timeline, {})).toBe(5 * 44 + 5 * timeline.gap)
    expect(postActionRowWidth(card, {})).toBe(5 * 44 + 4 * card.gap)
  })

  // Counts are suppressed on the focal post, so a countWidth must not be charged there even if one is
  // passed - the stats row above it prints the numbers.
  it("ignores count widths on a density that renders no counts", () => {
    const focal = postActionLayout("focal")
    expect(focal.showCounts).toBe(false)
    expect(postActionButtonWidth(focal, 40)).toBe(focal.target.minWidth)
  })
})

/**
 * The model above cannot see the markup: if PostActionBar put `paddingHorizontal: haloInset` around an
 * in-flow disc, every arithmetic assertion here and in postCardRhythm.test.ts would still pass while the row
 * overflows at 375pt. Which element carries which style is only checkable against the source.
 */
describe("PostActionBar markup honours the geometry it is modelled on", () => {
  const src = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8")
  const BAR = src("../../primitives/PostActionBar.tsx")

  /** Text between two markers, so a grep can be scoped to one style block or one JSX subtree. */
  const between = (source: string, from: string, to: string): string => {
    const start = source.indexOf(from)
    expect(start, `marker "${from}" is gone - re-scope the guard, do not delete it`).toBeGreaterThan(-1)
    const end = source.indexOf(to, start + from.length)
    expect(end, `marker "${to}" is gone - re-scope the guard, do not delete it`).toBeGreaterThan(-1)
    return source.slice(start, end)
  }

  it("lays the box out around the GLYPH and draws the halo absolutely", () => {
    const box = between(BAR, "function buildBoxStyles", "const BOX_STYLES")
    expect(box).toContain("paddingLeft: postActionGlyphInset(layout)")
    expect(box).toContain("gap: postActionCountGap(layout)")
    expect(box).toContain("position: \"absolute\"")
    // Either would put the 34pt disc back into the flex basis.
    expect(box).not.toContain("paddingHorizontal")
    expect(box).not.toContain("paddingRight")
  })

  it("keeps the CSS transition off the element the Animated transform writes to", () => {
    // The shared `webTransition` lists `opacity, background-color, transform`; on web useNativeDriver is
    // false, so RNW writes an inline transform every frame and a 120ms transform transition low-passes the
    // 280ms pop AND animates the repost's `turn.setValue(0)` reset into a visible counter-rotation.
    expect(BAR).toContain("transitionProperty: \"background-color\"")
    const children = between(BAR, "{(state) => (", "</Pressable>")
    expect(children).toContain("HALO_TRANSITION")
    expect(children).not.toContain("webTransition")
    // The transformed wrapper carries the transform and NOTHING else.
    expect(children).toContain("<Animated.View style={glyphTransform}>")
  })

  it("runs the halo on the HOUSE curve, which one hand-rolled transition is one property short of", () => {
    // `transitionProperty` + `transitionDuration` with no timing function leaves the browser on its `ease`
    // default. These are the most-repeated transition on the home surface, so they use the same constant
    // `webTransition` and `shell/motionCss` emit.
    const halo = between(BAR, "const HALO_TRANSITION", "const RING_FOOTPRINT")
    expect(halo).toContain("transitionTimingFunction: EASE_STANDARD_CSS")
    expect(BAR).toContain("EASE_STANDARD_CSS,")
  })

  it("gives the 44pt hit box the radius its halo owns, so the focus ring is not a square on a circle", () => {
    // `focusRingProps` sits on the Pressable and an outline traces the element it is on, so without the
    // radius here keyboard focus draws a square around the circular halo child. The box paints nothing, so
    // this is invisible to everything except the ring.
    const action = between(BAR, "  action: {", "  disabled: {")
    expect(action).toContain("borderRadius: t.radius.pill")
  })

  it("cancels every action row with the derived inset, on both edges", () => {
    const timeline = between(BAR, "rowTimeline: {", "spacer: {")
    expect(timeline).toContain("marginLeft: -TIMELINE_GLYPH_INSET")
    expect(timeline).toContain("marginRight: -TIMELINE_GLYPH_INSET")
    // The thread's two call sites derive their margins too; hard-coded ones drift inside the paragraph above.
    expect(src("../thread/ThreadFocalPost.tsx"))
      .toContain("marginHorizontal: -postActionGlyphInset(postActionLayout(\"focal\"))")
    expect(src("../thread/ThreadReplyRow.tsx"))
      .toContain("marginLeft: -postActionGlyphInset(postActionLayout(\"reply\"))")
  })

  it("gives the count a shrink path, so an over-constrained row truncates instead of colliding", () => {
    const count = between(BAR, "count: {", "})")
    expect(count).toContain("flexShrink: 1")
    expect(BAR).toContain("numberOfLines={1}")
  })

  /**
   * `surfaceTint` is only dE 3.9 from the sand row, barely a colour at all; the palette stops sit at dE
   * 6.9-15.5, measured in CIE Lab because a WCAG contrast ratio cannot see a hue shift at equal luminance.
   * Asserted here: the stops come from the palette, never the near-white or an invented hex.
   */
  it("tints each halo from the palette, never from the near-white that caused the report", () => {
    const tints = between(BAR, "function haloTints", "const HALO_TRANSITION")
    for (const family of ["bloom", "moss", "sky"] as const) {
      expect(tints).toContain(`hover: { backgroundColor: t.colors.${family}["50"] }`)
      expect(tints).toContain(`press: { backgroundColor: t.colors.${family}["100"] }`)
    }
    expect(tints).not.toContain("surfaceTint")
    expect(tints).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})

describe("PostActionBar opens the repost choice through the house popover", () => {
  const BAR = readFileSync(new URL("../../primitives/PostActionBar.tsx", import.meta.url), "utf8")

  it("measures the repost button itself and anchors the shared menu to it", () => {
    expect(BAR).toContain("usePopoverAnchor(openRepostMenuAt)")
    expect(BAR).toContain('buttonRef={action.key === "repost" ? repostAnchorRef : undefined}')
    expect(BAR).toContain("<PopoverMenu")
    expect(BAR).toContain("anchorRect={repostAnchor}")
    expect(BAR).toContain("items={repostMenuItems}")
    expect(BAR).toContain("onClose={closeRepostMenu}")
  })

  it("still opens CENTRED when the trigger cannot be measured", () => {
    expect(BAR).toContain("if (measureRepostAnchor()) return")
    expect(BAR).toMatch(/setRepostAnchor\(null\)\s+setRepostMenuOpen\(true\)/)
  })

  it("reposts directly when the host gave it nowhere to quote to", () => {
    expect(BAR).toMatch(/if \(!onQuote\) \{\s*repostMutate\(currently\)/)
  })

  it("builds its rows from the shared model with the feed row's own two glyphs", () => {
    expect(BAR).toContain("buildPostActionMenuModel(reposted, {")
    expect(BAR).toContain('repost: "Repeat2"')
    expect(BAR).toContain('quote: "MessageCircle"')
    expect(BAR).toContain('accessibilityLabel={t("post_actions.menu_label")}')
  })

  it("carries no menu presentation of its own", () => {
    expect(BAR).not.toContain("<Modal")
    expect(BAR).not.toContain('"./PostActionMenu"')
    expect(BAR).not.toContain("measureInWindow")
  })
})

describe("a viewer cannot repost their own post, and the row says so", () => {
  const BAR = readFileSync(new URL("../../primitives/PostActionBar.tsx", import.meta.url), "utf8")
  const FOCAL = readFileSync(new URL("../thread/ThreadFocalPost.tsx", import.meta.url), "utf8")

  it("leaves the repost action handler-less while keeping its count", () => {
    const model = buildPostActionModel(
      { postId: "post-mine", counts, viewer },
      { onLike: vi.fn(), onComment: vi.fn(), onSave: vi.fn(), onShare: vi.fn() },
    )
    const repost = model.find((action) => action.key === "repost")
    expect(repost?.onPress).toBeUndefined()
    expect(repost?.countLabel).toBe("8")
    expect(model.map((action) => action.key)).toContain("repost")
  })

  it("withholds the handler on an own post rather than hiding the affordance", () => {
    expect(BAR).toContain("const isOwnPost = authorId != null && viewerId != null && authorId === viewerId")
    expect(BAR).toMatch(/onRepost: isOwnPost\s*\?\s*undefined/)
  })

  it("greys a handler-less action the same way an in-flight one is greyed", () => {
    expect(BAR).toContain("const unavailable = disabled || !action.onPress")
    expect(BAR).toContain("accessibilityState={{ selected: action.active, disabled: unavailable }}")
    expect(BAR).toContain("unavailable ? styles.disabled : null")
    expect(BAR).toContain("webCursor(unavailable)")
    expect(BAR).not.toContain("disabled ? styles.disabled : null")
  })

  it("shows the count under the dimmed glyph, on both platforms", () => {
    expect(BAR).toMatch(/layout\.showCounts && action\.countLabel != null/)
    expect(BAR).toMatch(/disabled: \{\s*opacity: 0\.5,\s*\}/)
  })

  it("carries the same bar on a thread's focal post, so the rule holds there too", () => {
    expect(FOCAL).toContain("<PostActionBar")
    expect(FOCAL).toContain("authorId={repostSubjectAuthorId(post)}")
  })
})
