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
    // An empty/absent omit list is the historical five-action array, byte for byte.
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
      // 8, not the old 24: 24 was tuned for BARE 32pt boxes. Each box now paints a 28pt press halo, so 24
      // left the discs adrift and four counted buttons overflowed an indented reply on a narrow phone.
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
 * The HALO's geometry contract.
 *
 * The reported defect was "the highlight around the comment/repost/like/save does not look good": a liked /
 * reposted / saved action painted a PERMANENT pale fill on the whole Pressable, and because the count Text
 * lives inside that Pressable the painted shape was a ~52-60 x 40 stadium that swallowed the number. The
 * replacement is a transient circular disc behind the glyph alone. These assertions are what keep it a disc
 * INSIDE its tap box, and keep the row's negative margin in sync with it.
 */
describe("PostActionBar halo geometry", () => {
  const variants: readonly PostActionVariant[] = ["timeline", "card", "focal", "reply"]

  // THE core invariant. At or above `target.minWidth` the halo bleeds past its own tap box and adjacent
  // halos touch, which is exactly how the old fill read as one continuous block.
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
  // glyph is flush with the body text above it. Deriving it is the guard: the row used to hard-code -6 to
  // cancel a 6pt padding, so the 40 -> 44 target change would have silently shifted the whole action row.
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
    // `reply` is a compact SECONDARY surface and native reaches 48 through the bar's hitSlop: 8. A knowing
    // exception, pinned here so it is a decision someone owns rather than a finding in a later audit.
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
 * THE BOX GEOMETRY, which is where the halo redesign leaked into the row's WIDTH.
 *
 * The disc is decoration and is positioned absolutely, so a button's natural width is the GLYPH's - not the
 * halo's. The first cut made the 34pt disc the in-flow content, and four counted buttons then needed ~46pt
 * more than the narrowest screen's content column had. These pin the two facts that keep the row honest:
 * the box's single derived padding, and the width that padding implies.
 */
describe("PostActionBar box geometry", () => {
  const variants: readonly PostActionVariant[] = ["timeline", "card", "focal", "reply"]

  /**
   * THE IDENTITY THAT LETS ONE NUMBER CANCEL BOTH ROW EDGES. haloInset + haloOverhang collapses to
   * (target - glyph) / 2, so a box with that much paddingLEFT, NO paddingRight and `minWidth: target` puts
   * the glyph dead-centre - which is why `rowTimeline`, `ThreadFocalPost.actionBar` and
   * `ThreadReplyRow.actionsWrap` can each cancel with a single `-postActionGlyphInset(layout)`. Add a real
   * paddingRight and the trailing glyph stops being the mirror of the leading one.
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
      // The glyph's right edge to the disc's right edge, measured from the box's left edge.
      const glyphRight = postActionGlyphInset(layout) + layout.glyphSize
      const haloRight = postActionHaloInset(layout) + layout.haloSize
      expect(glyphRight + postActionCountGap(layout)).toBe(haloRight)
    }
  })

  // The regression this replaces, priced. This is the assertion that fails if `layout.haloSize` ever leaks
  // back into the box's flex basis.
  it("prices a counted button off the GLYPH, never off the disc", () => {
    const timeline = postActionLayout("timeline")
    const count = 26.2 // "1.2K" in Hanken Grotesk Medium 13px
    expect(postActionButtonWidth(timeline, count)).toBe(13 + 18 + 8 + count)
    // The shipped-once alternative: `paddingHorizontal: haloInset` around an IN-FLOW 34pt disc, then the
    // row's `gap` again before the count. 48 + count instead of 39 + count, i.e. 9pt per counted button -
    // times the four counted buttons, the 36pt that turned a 17pt overflow at 375pt into 20pt of slack.
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
 * WHAT THE MARKUP HAS TO DO, since the model above cannot see it.
 *
 * `postActionButtonWidth` describes a box with one derived paddingLeft and an ABSOLUTE halo. If PostActionBar
 * goes back to `paddingHorizontal: haloInset` around an in-flow disc, every arithmetic assertion in this file
 * and in postCardRhythm.test.ts keeps passing while the row overflows again at 375pt. Same for the web
 * transform conflict: it is a property of which element carries which style, and no pure value can express
 * it. Source greps, in the house style (shell/__tests__/backAffordance.test.ts, tabBar.test.ts).
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
    // The two that put the 34pt disc back into the flex basis, which is the ~14pt-per-button regression.
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
    // default. These five hit circles are the most-repeated transition on the home surface (20 per
    // four-post feed), so "the whole redesign runs one curve" was true of everything except the elements a
    // reader touches most. Same constant `webTransition` and `shell/motionCss` emit - the three cannot
    // drift, and a bare duration+property pair here is the regression this pins.
    const halo = between(BAR, "const HALO_TRANSITION", "const RING_FOOTPRINT")
    expect(halo).toContain("transitionTimingFunction: EASE_STANDARD_CSS")
    expect(BAR).toContain("EASE_STANDARD_CSS,")
  })

  it("gives the 44pt hit box the radius its halo owns, so the focus ring is not a square on a circle", () => {
    // `focusRingProps` sits on the Pressable, the radius lived on the absolutely-drawn halo CHILD, and an
    // outline traces the element it is on: keyboard focus drew a coral SQUARE around a circular disc.
    // The box paints nothing, so this is invisible to everything except the ring.
    const action = between(BAR, "  action: {", "  disabled: {")
    expect(action).toContain("borderRadius: t.radius.pill")
  })

  it("cancels every action row with the derived inset, on both edges", () => {
    const timeline = between(BAR, "rowTimeline: {", "spacer: {")
    expect(timeline).toContain("marginLeft: -TIMELINE_GLYPH_INSET")
    expect(timeline).toContain("marginRight: -TIMELINE_GLYPH_INSET")
    // The thread's two live call sites, which cancelled the OLD 6pt padding with hard-coded -2 and -6 long
    // after the boxes became 44 and 32 - so the focal bar sat 9.5pt inside the paragraph above it.
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
   * The halo's two stops, and the one colour that must never come back.
   *
   * `surfaceTint` (#F8F1E4) was the single warm near-white given to all five actions, and it is what the
   * reported bug ("the highlight ... does not look good") was actually looking at: dE 3.9 from the sand row,
   * i.e. barely a colour at all, painted across a 60x40 stadium. The replacements sit at dE 6.9-15.5 on the
   * row and 9.4-19.2 on the hovered row, with press stronger than hover in every family - MEASURED in CIE
   * Lab, since a WCAG contrast RATIO cannot see a hue shift at equal luminance and reports these as ~1.0:1.
   * The measurement itself lives in the source comment above HALO_TINTS (the theme pulls react-native, which
   * this pure test will not import); what is assertable here is that the stops are the palette's and not a
   * regression to the near-white or to an invented hex.
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
