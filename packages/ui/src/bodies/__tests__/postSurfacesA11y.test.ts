/**
 * Accessibility and correctness props on the feed / post surfaces that only exist as JSX (PR 4, C13a).
 * These modules import react-native, which this package's node-environment vitest cannot load, so each
 * assertion is scoped to the exact element and prop it guards (the house pattern, see PostCard.test.ts).
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const code = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")

const between = (source: string, from: string, to: string): string => {
  const start = source.indexOf(from)
  expect(start, `${from} is gone - re-scope the guard, do not delete it`).toBeGreaterThan(-1)
  const end = source.indexOf(to, start + from.length)
  expect(end, `${to} no longer follows ${from}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe("the post row is a pointer convenience, not an accessibility element (APP-A11Y-103/104)", () => {
  const card = code("../PostCard.tsx")
  const row = between(card, "<Pressable\n        onPress={() => openPost(rowPostId)}", "style=")

  it("opts the row out of the accessibility tree on native and out of the tab order on web", () => {
    expect(card).toMatch(
      /export const ROW_A11Y_PROPS: object = IS_WEB \? \{ tabIndex: -1 \} : \{ accessible: false \}/,
    )
    expect(row).toContain("{...ROW_A11Y_PROPS}")
  })

  it("gives the row no role, no label and no key handler, so its controls are reachable and named", () => {
    expect(row).not.toContain("accessibilityRole")
    expect(row).not.toContain("accessibilityLabel")
    expect(row).not.toContain("linkKeyProps")
    expect(row).not.toContain("focusRingProps")
  })

  it("leaves keyboard and screen-reader users the timestamp permalink to open the thread", () => {
    const permalink = between(card, 'accessibilityLabel={t("post_card.permalink_a11y", { time: model.timeLabel })}', "style=")
    expect(permalink).toContain("linkKeyProps(onOpenPost)")
  })

  it("keeps the quote card one actionable button whose label carries its author and text", () => {
    const embed = code("../EmbeddedPost.tsx")
    expect(embed).not.toContain("accessible: false")
    expect(between(embed, "<Pressable", "style=")).toContain("accessibilityLabel={label}")
  })
})

describe("the thread reply row follows the same row contract (APP-A11Y-103/104)", () => {
  const replyRow = code("../thread/ThreadReplyRow.tsx")
  const row = between(replyRow, "<Pressable\n        onPress={openThread}", "style=")

  it("spreads the shared row props and exposes no role, label, focus ring or key handler", () => {
    expect(row).toContain("{...ROW_A11Y_PROPS}")
    expect(row).not.toContain("accessibilityRole")
    expect(row).not.toContain("accessibilityLabel")
    expect(row).not.toContain("focusRingProps")
    expect(row).not.toContain("linkKeyProps")
  })

  it("leaves the reply's Comment action as the keyboard and screen-reader way into the thread", () => {
    expect(replyRow).toContain("onComment={openThread}")
  })

  it("retires the row role export nobody should reach for again", () => {
    expect(code("../PostCard.tsx")).not.toContain("export const ROW_ROLE")
  })
})

describe("a repost's comment and quote target the original (APP-BUG-203)", () => {
  const card = code("../PostCard.tsx")

  it("routes both through the same target as the row and the menu, falling back when it is deleted", () => {
    expect(card).toContain("const actionTargetId = isRepost && embedded && !embedded.deleted ? embedded.id : post.id")
    expect(card).toContain("const onComment = React.useCallback(() => openPost(actionTargetId), [openPost, actionTargetId])")
    expect(card).toContain('push({ kind: "composer", composerMode: "quote", targetPostId: actionTargetId })')
  })

  it("keeps like/save/counts on the wrapper id, which the server resolves to the original", () => {
    expect(between(card, "<PostActionBar", "/>")).toContain("postId={post.id}")
  })
})

describe("loading states have a name (APP-A11Y-107)", () => {
  it("labels the feed's first-load skeletons as one busy progress element", () => {
    const feed = code("../FeedBody.tsx")
    const loading = between(feed, '{state === "loading" ? (', "<FeedSkeleton />")
    expect(loading).toContain('accessibilityRole="progressbar"')
    expect(loading).toContain('accessibilityLabel={t("feed.loading")}')
    expect(loading).toContain("accessibilityState={{ busy: true }}")
  })

  it("labels the thread's replies skeleton instead of hiding it", () => {
    const thread = code("../PostThreadBody.tsx")
    const skeleton = between(thread, "function ThreadRepliesSkeleton()", "{[0, 1, 2]")
    expect(skeleton).not.toContain("no-hide-descendants")
    expect(skeleton).toContain('accessibilityLabel={t("thread.loading_replies")}')
    expect(skeleton).toContain("accessibilityState={{ busy: true }}")
  })
})

describe("screen titles are headings (APP-A11Y-109)", () => {
  it("the composer's centered title", () => {
    expect(code("../PostComposer.tsx")).toContain(
      '<Text accessibilityRole="header" style={styles.headerTitle}>{presentation.title}</Text>',
    )
  })

  it("the thread's compact title, levelled so the two branches stay one page title", () => {
    const thread = code("../PostThreadBody.tsx")
    expect(thread).toMatch(/<Text variant="heading" accessibilityRole="header" \{\.\.\.headingLevel\(1\)\}>\s*\{t\("thread\.title"\)\}/)
  })
})

describe("the feed-share caption counter (APP-A11Y-110, APP-BUG-207)", () => {
  const share = code("../FeedShareBlock.tsx")

  it("announces the same number it shows, translated", () => {
    const counter = between(share, "styles.counter,", "</Text>")
    expect(counter).toContain('accessibilityLabel={tc("caption_remaining_a11y", { count: FEED_CAPTION_MAX - caption.length })}')
    expect(counter).not.toContain("${caption.length} / ${FEED_CAPTION_MAX}")
  })

  it("does not ask RN-web for the native driver, and settles at once under reduced motion", () => {
    const entrance = between(share, "const [enter]", "const readOnly")
    expect(entrance).toContain('useNativeDriver: Platform.OS !== "web"')
    expect(entrance).not.toContain("useNativeDriver: true")
    expect(entrance).toMatch(/if \(reducedMotion\) \{\s*enter\.stopAnimation\(\)\s*enter\.setValue\(1\)/)
  })
})

describe("the composer entrance reads the shared reduced-motion hook (APP-BUG-208)", () => {
  const composer = code("../PostComposer.tsx")

  it("has no module cache or swallowed query of its own", () => {
    expect(composer).not.toContain("reduceMotionCache")
    expect(composer).not.toContain("isReduceMotionEnabled")
    expect(composer).not.toContain(".catch(() => {})")
    expect(between(composer, "function useComposerEntrance()", "return {")).toContain("const reducedMotion = useReducedMotion()")
  })
})

describe("the composer's author row is translated (APP-BUG-209)", () => {
  it("falls back to the catalog's own 'You', never an English literal", () => {
    const composer = code("../PostComposer.tsx")
    expect(composer).not.toContain('"You"')
    expect(composer).toContain('{postAsOrganization?.name ?? profile?.name ?? t("post_as.personal")}')
  })
})

describe("composer controls meet the 44pt target (APP-A11Y-111)", () => {
  it("InlineComposer's add-media, close and Post controls", () => {
    const inline = code("../feed/InlineComposer.tsx")
    expect(inline).toContain("const MIN_TOUCH_TARGET = 44")
    expect(between(inline, "  addMedia: {", "}")).toMatch(/width: MIN_TOUCH_TARGET,\s*height: MIN_TOUCH_TARGET/)
    expect(between(inline, "  close: {", "}")).toMatch(/width: MIN_TOUCH_TARGET,\s*height: MIN_TOUCH_TARGET/)
    expect(between(inline, "  postButton: {", "}")).toContain("minHeight: MIN_TOUCH_TARGET")
  })

  it("PostComposer's add-media control, with the 36pt disc drawn inside", () => {
    const composer = code("../PostComposer.tsx")
    expect(composer).toMatch(/addMedia: \{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET,/)
    expect(composer).toMatch(/addMediaDisc: \{ width: 36, height: 36,/)
  })
})
