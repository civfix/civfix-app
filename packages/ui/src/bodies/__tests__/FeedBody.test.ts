import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"
import type { TFunction } from "i18next"
import { tokens } from "@civfix/shared/tokens"
import {
  FEED_ROW_BATCH_MS,
  FEED_ROW_ENTER_MS,
  FEED_ROW_STAGGER_MAX_MS,
  FEED_ROW_STAGGER_MS,
  buildFeedHeaderModel,
  createFeedEntranceTracker,
  feedFooterState,
  feedViewState,
  postDetailViewState,
} from "../feedModel"

const EN: Record<string, string> = {
  "feed.title": "Your Feed",
}

const t = ((key: string) => {
  const resolved = EN[key]
  if (resolved == null) throw new Error(`missing translation: ${key}`)
  return resolved
}) as unknown as TFunction

describe("FeedBody feed model", () => {
  it("titles the root from the catalog and offers a composer only to a signed-in reader", () => {
    expect(buildFeedHeaderModel({ isAuthenticated: true, layout: "compact" }, t)).toEqual({
      title: "Your Feed",
      showComposer: true,
      showInlineComposer: false,
    })
    for (const layout of ["compact", "expanded"] as const) {
      const model = buildFeedHeaderModel({ isAuthenticated: false, layout }, t)
      expect(model.showComposer).toBe(false)
      expect(model.showInlineComposer).toBe(false)
    }
  })

  it("swaps the header glyph for the inline card when the shell is expanded", () => {
    expect(buildFeedHeaderModel({ isAuthenticated: true, layout: "expanded" }, t)).toEqual({
      title: "Your Feed",
      showComposer: false,
      showInlineComposer: true,
    })
  })

  it("uses a 200ms ease-out transition unless reduced motion is enabled", () => {
    expect(FEED_ROW_ENTER_MS).toBe(tokens.motion.dur.d2)
    expect(tokens.motion.dur.d2).toBe(200)
    expect(readFileSync(new URL("../feedModel.ts", import.meta.url), "utf8")).toContain(
      "export const FEED_ROW_ENTER_MS = tokens.motion.dur.d2",
    )
    const feed = readFileSync(new URL("../FeedBody.tsx", import.meta.url), "utf8")
    const timings = feed.match(/duration: FEED_ROW_ENTER_MS,\s*\n\s*easing: Easing\.out\(Easing\.cubic\)/g) ?? []
    expect(timings).toHaveLength(3)
    expect(feed).toMatch(/if \(reduceMotion\) settle\(\)\s*\n\s*else enter\(\)/)
    expect(feed).toMatch(/if \(!plan\.animate \|\| reducedMotion\) \{\s*\n\s*progress\.stopAnimation\(\)\s*\n\s*progress\.setValue\(1\)/)
  })

  it("assembles a whole batch inside the ~350ms 'this list is here' threshold", () => {
    expect(FEED_ROW_STAGGER_MAX_MS + FEED_ROW_ENTER_MS).toBeLessThanOrEqual(350)
  })

  it("derives loading, error, empty, and loaded states without hiding loaded posts", () => {
    expect(feedViewState({ isLoading: true, isError: false, postCount: 0 })).toBe("loading")
    expect(feedViewState({ isLoading: false, isError: true, postCount: 0 })).toBe("error")
    expect(feedViewState({ isLoading: false, isError: false, postCount: 0 })).toBe("empty")
    expect(feedViewState({ isLoading: true, isError: false, postCount: 2 })).toBe("loaded")
  })
})

describe("feed row entrance tracker", () => {
  it("animates a post exactly once, however often virtualization remounts its row", () => {
    const tracker = createFeedEntranceTracker()
    expect(tracker.hasShown("p1")).toBe(false)
    expect(tracker.claim("p1", 1_000)).toEqual({ animate: true, delay: 0 })
    expect(tracker.hasShown("p1")).toBe(true)
    expect(tracker.claim("p1", 9_000)).toEqual({ animate: false, delay: 0 })
  })

  it("staggers rows windowed in the same batch", () => {
    const tracker = createFeedEntranceTracker()
    expect(tracker.claim("p1", 1_000).delay).toBe(0)
    expect(tracker.claim("p2", 1_000).delay).toBe(FEED_ROW_STAGGER_MS)
    expect(tracker.claim("p3", 1_010).delay).toBe(FEED_ROW_STAGGER_MS * 2)
  })

  it("caps the stagger so no row in one batch waits longer than the cap", () => {
    const tracker = createFeedEntranceTracker()
    const delays = Array.from({ length: 12 }, (_, i) => tracker.claim(`p${i}`, 1_000).delay)
    expect(Math.max(...delays)).toBe(FEED_ROW_STAGGER_MAX_MS)
  })

  it("restarts the stagger at zero for a batch windowed later in the scroll", () => {
    const tracker = createFeedEntranceTracker()
    for (let i = 0; i < 8; i++) tracker.claim(`first-${i}`, 1_000)
    expect(tracker.claim("later", 1_000 + FEED_ROW_BATCH_MS + 1).delay).toBe(0)
    expect(tracker.claim("later-2", 1_000 + FEED_ROW_BATCH_MS + 1).delay).toBe(FEED_ROW_STAGGER_MS)
  })
})

describe("the feed header's compose control", () => {
  const FEED_SOURCE = readFileSync(new URL("../FeedBody.tsx", import.meta.url), "utf8")
  const INBOX_SOURCE = readFileSync(new URL("../MessagingListBody.tsx", import.meta.url), "utf8")
  const BUTTON_SOURCE = readFileSync(new URL("../HeaderIconButton.tsx", import.meta.url), "utf8")

  const actionsRow = (src: string) => {
    return sliceBetween(src, "<View style={styles.headerActions}>", "</View>")
  }

  it("is the shared header icon button on both roots, not a bespoke pill on one of them", () => {
    expect(FEED_SOURCE).toContain(
      '<HeaderIconButton icon="Plus" label={composeLabel} onPress={openComposer} />',
    )
    expect(INBOX_SOURCE).toContain('icon="SquarePen"')
    for (const src of [FEED_SOURCE, INBOX_SOURCE]) {
      expect(src).toContain('import { HeaderIconButton } from "./HeaderIconButton"')
    }
    expect(FEED_SOURCE).not.toContain("composeButton")
    expect(FEED_SOURCE).not.toContain("composeLabel:")
    expect(FEED_SOURCE).not.toContain("iconMap.Megaphone")
    expect(INBOX_SOURCE).not.toContain("composeBtn")
  })

  it("keeps the composer's own label behind the glyph", () => {
    expect(FEED_SOURCE).toContain('const composeLabel = useT("nav").t("title.post_composer")')
    expect(INBOX_SOURCE).toContain('label={t("new_menu.a11y")}')
  })

  it("sits immediately LEFT of the profile button, on Home and in the inbox alike", () => {
    const roots: ReadonlyArray<[string, string]> = [
      [FEED_SOURCE, "<HeaderIconButton"],
      [INBOX_SOURCE, "<ComposeButton />"],
    ]
    for (const [src, compose] of roots) {
      const row = actionsRow(src)
      expect(row).toContain(compose)
      expect(row).toContain("<HeaderProfileButton />")
      expect(row.indexOf(compose)).toBeLessThan(row.indexOf("<HeaderProfileButton />"))
    }
  })

  it("draws the one 52pt control the profile button and every other top row use", () => {
    const controls = readFileSync(new URL("../../primitives/headerControls.ts", import.meta.url), "utf8")
    expect(controls).toContain("export const HEADER_CONTROL_SIZE = 52")
    expect(controls).toContain("export const HEADER_GLYPH_SIZE = 26")
    expect(controls).toContain("export const HEADER_AVATAR_SIZE = 52")
    expect(BUTTON_SOURCE).toContain("width: HEADER_CONTROL_SIZE")
    expect(BUTTON_SOURCE).toContain("size={HEADER_GLYPH_SIZE}")
    expect(BUTTON_SOURCE).toContain("backgroundColor: t.glass.sheet.input")
    const profile = readFileSync(new URL("../HeaderProfileButton.tsx", import.meta.url), "utf8")
    expect(profile).toContain("backgroundColor: t.glass.sheet.input")
    expect(profile).toContain("HEADER_BADGED_AVATAR_SIZE : HEADER_AVATAR_SIZE")
    expect(controls).toContain("export const HEADER_BADGED_AVATAR_SIZE = HEADER_AVATAR_SIZE - 6")
    expect(profile).toContain("width: HEADER_CONTROL_SIZE")
    expect(FEED_SOURCE).toContain("minHeight: HEADER_CONTROL_SIZE")
  })
})

describe("the feed's timeline is unfiltered", () => {
  const SRC = readFileSync(new URL("../FeedBody.tsx", import.meta.url), "utf8")
  const MODEL = readFileSync(new URL("../feedModel.ts", import.meta.url), "utf8")

  it("draws no tablist, and asks the hook for the default feed", () => {
    expect(SRC).not.toContain('accessibilityRole="tablist"')
    expect(SRC).not.toContain("FeedFilterChip")
    expect(SRC).not.toContain("styles.filter")
    expect(SRC).toContain("const feed = useHomeFeed()")
  })

  it("leaves no filter model behind for a chip row to be rebuilt from", () => {
    for (const gone of ["FEED_FILTER_OPTIONS", "buildFeedFilterModels", "nextFeedFilter"]) {
      expect(MODEL, `${gone} still exists - the chip row can grow back from it`).not.toContain(gone)
      expect(SRC).not.toContain(gone)
    }
  })

  it("carries no orphaned filter copy in any of the four catalogs", () => {
    for (const locale of ["en", "es", "de", "ko"]) {
      const catalog = JSON.parse(
        readFileSync(new URL(`../../i18n/locales/${locale}/home-feed.json`, import.meta.url), "utf8"),
      ) as { feed: { title: string; filter?: unknown } }
      expect(catalog.feed.filter, `${locale} still ships feed.filter`).toBeUndefined()
      expect(typeof catalog.feed.title).toBe("string")
    }
  })
})

describe("the tab-root title is a heading", () => {
  const SRC = readFileSync(new URL("../FeedBody.tsx", import.meta.url), "utf8")

  it("names itself the way the other five view roots do", () => {
    expect(SRC).toMatch(/<Text style=\{styles\.heading\} accessibilityRole="header">/)
  })
})

describe("the card's timeline has no scrollbar, and a fade instead", () => {
  const SRC = readFileSync(new URL("../FeedBody.tsx", import.meta.url), "utf8")

  it("never asks for a scroll indicator on either surface", () => {
    expect(SRC).toContain("showsVerticalScrollIndicator={false}")
    expect(SRC).not.toContain("scrollbarWidth")
  })

  it("terminates the list with a gradient that cannot itself become a false affordance", () => {
    expect(SRC).toContain("linear-gradient(to bottom")
    expect(SRC).toMatch(/<View pointerEvents="none" style=\{fadeStyle\}/)
    expect(SRC).toMatch(/const fadeStyle = useMemo\(\s*\(\) => \[styles\.scrollFade/)
    expect(SRC).toContain("{ bottom: promoHeight }")
    expect(SRC).toContain(
      '{isExpanded && IS_WEB ? <View pointerEvents="none" style={fadeStyle} /> : null}',
    )
    expect(SRC).not.toContain("if (!isExpanded || !IS_WEB) return list")
  })
})

describe("the new-posts pill overlays the list on every surface", () => {
  const SRC = readFileSync(new URL("../FeedBody.tsx", import.meta.url), "utf8")

  it("hosts the list in the one relative wrapper the pill needs, on both platforms", () => {
    expect(SRC).toContain("<View style={styles.scrollHost}>")
    expect(SRC).toContain("<NewPostsPill count={pendingNewPosts} onPress={showNewPosts} />")
  })

  it("tapping it scrolls to top, refetches the ranked first page, and clears the count", () => {
    expect(SRC).toMatch(
      /const showNewPosts = useCallback\(\(\) => \{\s*useFeedScrollTopStore\.getState\(\)\.requestScrollTop\(\)\s*void refetch\(\)\s*useFeedLiveStore\.getState\(\)\.clearNewPosts\(\)\s*\}, \[refetch\]\)/,
    )
  })

  it("pull-to-refresh also clears the pending count", () => {
    expect(SRC).toMatch(/setRefreshing\(true\)\s*useFeedLiveStore\.getState\(\)\.clearNewPosts\(\)/)
  })

  it("scrolling back to the top clears the pill without a surprise refetch", () => {
    expect(SRC).toContain("onScroll={onListScroll}")
    expect(SRC).toContain("clearsPendingAtOffset(event.nativeEvent.contentOffset.y")
    expect(SRC).not.toMatch(/onListScroll[\s\S]{0,200}?refetch/)
  })

  it("keeps the feed exactly in server rank order, de-duplicated by id only", () => {
    expect(SRC).toContain("dedupeById(feed.data?.pages.flatMap((page) => page.items) ?? [])")
    expect(SRC).not.toMatch(/posts\s*\.\s*sort|\.toSorted\(/)
  })
})

describe("the feed footer after a failed page", () => {
  const loaded = { state: "loaded" as const, isFetchingNextPage: false, isFetchNextPageError: false, hasNextPage: true }

  it("offers a retry when the next page failed, instead of rendering nothing", () => {
    expect(feedFooterState({ ...loaded, isFetchNextPageError: true })).toBe("load-more-failed")
  })

  it("shows the skeleton while a retry is in flight and the caught-up line only at the end", () => {
    expect(feedFooterState({ ...loaded, isFetchNextPageError: true, isFetchingNextPage: true })).toBe("loading-more")
    expect(feedFooterState({ ...loaded, hasNextPage: false })).toBe("caught-up")
    expect(feedFooterState(loaded)).toBe("idle")
    expect(feedFooterState({ ...loaded, state: "loading", isFetchNextPageError: true })).toBe("idle")
  })

  it("wires the retry to the same in-flight-safe pager the list uses", () => {
    const source = readFileSync(new URL("../FeedBody.tsx", import.meta.url), "utf8")
    const footer = sliceBetween(source, "const footer = useMemo(", "const contentStyle")
    expect(footer).toContain('footerState === "load-more-failed"')
    expect(footer).toContain('title={t("feed.load_more_error")}')
    expect(footer).toContain("onAction={loadMore}")
    expect(source).toContain("isFetchNextPageError: feed.isFetchNextPageError")
  })
})

describe("the post detail screen's states", () => {
  it("reads a pending query as loading and only a real failure (or no id) as an error", () => {
    expect(postDetailViewState({ hasId: true, hasData: false, isError: false })).toBe("loading")
    expect(postDetailViewState({ hasId: true, hasData: false, isError: true })).toBe("error")
    expect(postDetailViewState({ hasId: false, hasData: false, isError: false })).toBe("error")
    expect(postDetailViewState({ hasId: true, hasData: true, isError: true })).toBe("ready")
  })

  it("offers a retry on the error", () => {
    const source = readFileSync(new URL("../PostDetailBody.tsx", import.meta.url), "utf8")
    expect(source).toContain("postDetailViewState(")
    expect(source).toContain("onAction={id ? () => void query.refetch() : undefined}")
    expect(source).not.toContain("query.isLoading || query.isError || !query.data")
  })
})
