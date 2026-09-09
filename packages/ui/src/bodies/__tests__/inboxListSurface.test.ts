import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const inbox = strip(read("../MessagingListBody.tsx"))
const feed = strip(read("../FeedBody.tsx"))
const reports = strip(read("../ReportsBody.tsx"))
const postCard = strip(read("../PostCard.tsx"))

const rowStyle = (): string => {
  const from = inbox.indexOf("\n  row: {")
  expect(from, "the row style must still be findable").toBeGreaterThan(-1)
  return inbox.slice(from, inbox.indexOf("\n  },", from))
}

describe("the thread row is flat, not a card", () => {
  it("carries no card chrome at all: no surface fill, radius, border, shadow or row margin", () => {
    const row = rowStyle()
    expect(row).toContain("backgroundColor: t.colors.bg")
    for (const dead of [
      "t.colors.surface",
      "borderRadius",
      "borderWidth",
      "borderColor",
      "t.shadows",
      "marginBottom",
    ]) {
      expect(row, `${dead} is card chrome - the row is flat now`).not.toContain(dead)
    }
  })

  it("leaves NO dead card styles behind in the sheet", () => {
    expect(inbox).not.toContain("t.radius.lg")
    expect(inbox).not.toContain("t.shadows.s1")
    expect(inbox).not.toContain('t.space["2"] + 2')
  })

  it("spends the list's gutter INSIDE the row, so the rows are edge-to-edge", () => {
    expect(inbox).toMatch(/const ROW_GUTTER = theme\.space\["4"\]/)
    expect(rowStyle()).toContain("paddingHorizontal: ROW_GUTTER")
    expect(inbox).not.toMatch(/content: \{[^}]*paddingHorizontal/)
    expect(feed).toContain('paddingHorizontal: POST_SURFACE === "flat" ? 0 : 14')
  })

  it("is TALLER than the card was, with the 48pt avatar centred in it", () => {
    const min = Number(/const ROW_MIN_HEIGHT = ([0-9.]+)/.exec(inbox)?.[1])
    const avatar = Number(/const ROW_AVATAR = ([0-9.]+)/.exec(inbox)?.[1])
    expect(avatar).toBe(48)
    expect(min).toBeGreaterThanOrEqual(76)
    expect(min).toBeLessThanOrEqual(84)
    expect(min).toBeGreaterThan(72)
    const row = rowStyle()
    expect(row).toContain("minHeight: ROW_MIN_HEIGHT")
    expect(row).toContain("paddingVertical: ROW_PADDING_V")
    expect(row).toContain('alignItems: "center"')
    expect(inbox).toMatch(/const ROW_PADDING_V = theme\.space\["3"\] \+ 2/)
    expect(inbox).toMatch(/const ROW_GAP = theme\.space\["3"\]/)
    expect(row).toContain("gap: ROW_GAP")
  })

  it("keeps the row's TAP COLUMN one Pressable, with its a11y name and the house focus ring", () => {
    expect(inbox).toContain("{...focusRingProps}")
    expect(inbox).toContain('accessibilityRole="button"')
    expect(inbox).toContain('t("row.a11y_unread", { title: thread.title, count: thread.unread })')
    expect((inbox.match(/<Pressable/g) ?? []).length).toBe(4)
    expect(inbox).toMatch(/menuHost: \{\s*position: "absolute"/)
    expect(inbox).toMatch(/menuSlot: \{\s*width: ROW_MENU_SLOT/)
  })

  it("pulls the keyboard ring INSIDE the row, or a full-bleed row clips it at both edges", () => {
    expect(inbox).toMatch(/const WEB_ROW_FOCUS_INSET: ViewStyle = IS_WEB/)
    expect(inbox).toContain("outlineOffset: -(FOCUS_RING_WIDTH + FOCUS_RING_OFFSET)")
    expect(inbox).toContain("WEB_ROW_FOCUS_INSET,")
    expect(postCard).toContain("outlineOffset: -RING_FOOTPRINT")
  })

  it("resolves the empty-state fill's magic number into a named constant", () => {
    expect(inbox).toMatch(/const EMPTY_FILL_MIN_HEIGHT = 300/)
    expect(inbox).toContain("minHeight: EMPTY_FILL_MIN_HEIGHT")
  })
})

describe("the separator", () => {
  it("is a FlatList separator, hoisted so it never remounts the list", () => {
    expect(inbox).toContain("ItemSeparatorComponent={ThreadSeparator}")
    expect(inbox).toMatch(/function ThreadSeparator\(\) \{\s*const styles = useStyles\(\)\s*return <View style=\{styles\.separator\} \/>/)
    expect(inbox).not.toMatch(/<View style=\{styles\.separator\} \/>\s*<\/Pressable>/)
  })

  it("starts where the row's TEXT starts, not at the screen edge", () => {
    expect(inbox).toMatch(/const SEPARATOR_INSET = ROW_GUTTER \+ ROW_AVATAR \+ ROW_GAP/)
    expect(inbox).toMatch(/separator: \{\s*marginLeft: SEPARATOR_INSET/)
  })

  it("draws the package's ONE hairline recipe, split by platform exactly as PostCard's is", () => {
    expect(inbox).toContain("height: IS_WEB ? 1 : StyleSheet.hairlineWidth")
    expect(inbox).toContain(
      "backgroundColor: IS_WEB ? wash(t.colors.borderStrong, 0.45, t) : t.colors.borderStrong",
    )
    expect(postCard).toMatch(/separator: Platform\.OS === "web"/)
  })
})

describe("read and unread are distinguishable at a glance", () => {
  it("splits the TITLE by weight only, keeping both states at full ink", () => {
    expect(inbox).toMatch(/title: \{[\s\S]{0,200}?fontFamily: t\.fontFamily\.bodySemiBold/)
    expect(inbox).toMatch(/title: \{[\s\S]{0,200}?color: t\.colors\.text,/)
    expect(inbox).toMatch(/titleUnread: \{\s*fontFamily: t\.fontFamily\.bodyBold,\s*\}/)
    expect(inbox).toContain("[styles.title, unread ? styles.titleUnread : null]")
    expect(inbox).not.toMatch(/titleRead|title: \{[\s\S]{0,200}?color: t\.colors\.text(Muted|Subtle)/)
  })

  it("splits the PREVIEW by weight AND ink, and the read state is the quieter grey", () => {
    expect(inbox).toMatch(/last: \{[\s\S]{0,240}?fontFamily: t\.fontFamily\.bodyRegular/)
    expect(inbox).toMatch(/last: \{[\s\S]{0,240}?color: t\.colors\.textSubtle/)
    expect(inbox).toMatch(
      /lastUnread: \{\s*fontFamily: t\.fontFamily\.bodySemiBold,\s*color: t\.colors\.text,\s*\}/,
    )
    expect(inbox).not.toMatch(/last: \{[\s\S]{0,240}?color: t\.colors\.textMuted/)
  })

  it("keeps the coral pill and the timestamp exactly where they were", () => {
    expect(inbox).toMatch(/unread: \{[\s\S]{0,240}?backgroundColor: t\.colors\.brand\.bloom/)
    expect(inbox).toContain('thread.unread > 99 ? "99+" : thread.unread')
    expect(inbox).toMatch(/ago: \{[\s\S]{0,200}?color: t\.colors\.textSubtle/)
  })

  it("still ANNOUNCES the unread count - the visual split is not the accessible one", () => {
    expect(inbox).toContain("const unread = thread.unread > 0")
    expect(inbox).toMatch(/unread\s*\?\s*t\("row\.a11y_unread"/)
  })
})

describe("the preview is truncated ONCE, by the layout", () => {
  it("keeps no character slice and no literal ellipsis in the source", () => {
    expect(inbox).not.toContain("slice(0, 42)")
    expect(inbox).not.toMatch(/body\.length > \d+/)
    expect(inbox).not.toContain('"..."')
    expect(inbox).not.toContain("clipped")
  })

  it("hands the Text the whole body and lets numberOfLines do the ellipsizing", () => {
    expect(inbox).toMatch(
      /function previewText\(thread: MessageThreadDTO, t: TFn\): string \{\s*const body = thread\.last\?\.trim\(\)\s*if \(!body\) return t\("preview\.new_conversation"\)\s*return thread\.lastFromMe \? t\("preview\.from_me", \{ text: body \}\) : body\s*\}/,
    )
    expect(inbox).toMatch(/\{previewText\(thread, t\)\}/)
    expect(inbox).toMatch(/style=\{\[styles\.last, unread \? styles\.lastUnread : null\]\} numberOfLines=\{1\}/)
  })
})

describe("pull-to-refresh", () => {
  it("is FeedBody's control, prop for prop, on the inbox's own refetch", () => {
    for (const src of [feed, inbox]) {
      expect(src).toContain("tintColor={th.colors.textMuted}")
      expect(src).toContain("colors={refreshColors}")
      expect(src).toContain("const refreshColors = useMemo(() => [th.colors.accent], [th])")
    }
    expect(inbox).toMatch(
      /const onRefresh = useCallback\(\(\) => \{\s*setRefreshing\(true\)\s*void Promise\.resolve\(refetch\(\)\)\.finally\(\(\) => setRefreshing\(false\)\)\s*\}, \[refetch\]\)/,
    )
  })

  it("hands the list a MEMOIZED element, not a fresh one per keystroke in the search field", () => {
    expect(inbox).toMatch(/const refresh = useMemo\(\s*\(\) => \(\s*<RefreshControl/)
    expect(inbox).toContain("[refreshing, onRefresh")
    expect(inbox).toContain("refreshControl={isAuthenticated ? refresh : undefined}")
  })
})

describe("the inbox search field", () => {
  it("is ReportsBody's field: same shape, same focus recipe, same clear chip", () => {
    for (const src of [reports, inbox]) {
      expect(src).toContain("<Icon icon={iconMap.Search} size={16} color={th.colors.textSubtle} />")
      expect(src).toContain("style={[styles.searchInput, webInputReset]}")
      expect(src).toContain('returnKeyType="search"')
      expect(src).toContain("onFocus={() => setFocused(true)}")
      expect(src).toContain("onBlur={() => setFocused(false)}")
      expect(src).toContain("focused ? styles.searchFieldFocused : null")
      expect(src).toContain('accessibilityLabel={t("search.clear_a11y")}')
    }
    expect(inbox).toMatch(
      /searchFieldFocused:\s*Platform\.OS === "web"\s*\?\s*\(\{ boxShadow: tokens\.shadow\.ring, borderColor: t\.colors\.accent \}/,
    )
  })

  it("sits UNDER the title, inside the same inset, and only once there is something to filter", () => {
    const header = inbox.match(/ListHeaderComponent=\{[\s\S]*?\n {6}\}/)?.[0]
    expect(header, "the ListHeaderComponent block must still be findable").toBeTruthy()
    expect(header!.indexOf("<InboxHeader")).toBeLessThan(header!.indexOf("<InboxSearchField"))
    expect(header!).toContain("<View style={styles.headerInset} onTouchStart={dismissSwipe}>")
    expect(inbox).toContain("const showSearch = isAuthenticated && threads.length > 0")
  })

  it("takes every one of its strings from the catalog", () => {
    for (const key of ["search.placeholder", "search.a11y", "search.clear_a11y", "empty.no_match.title"]) {
      expect(inbox).toContain(key)
    }
  })

  it("keeps a tap on a row working while the keyboard is up", () => {
    expect(inbox).toContain('keyboardShouldPersistTaps="handled"')
  })
})

describe("the filter narrows LOADED threads, and never asks the server", () => {
  it("filters BEFORE the list, so virtualization sees the narrowed array", () => {
    expect(inbox).toMatch(
      /const visible = useMemo\(\s*\(\) => \(filtering \? threads\.filter\(\(thread\) => matchesThreadQuery\(thread, q\)\) : threads\),\s*\[threads, filtering, q\],\s*\)/,
    )
    expect(inbox).toContain("data={visible}")
    expect(inbox).toContain('import { matchesThreadQuery } from "./messagesListModel"')
    expect(inbox).not.toMatch(/useThreads\([^)]+\)/)
  })

  it("stops paginating while filtering - ReportsBody's rule, for the same reason", () => {
    expect(inbox).toMatch(
      /const onEndReached = useCallback\(\(\) => \{\s*if \(filtering\) return/,
    )
    expect(reports).toMatch(/if \(filtering\) return/)
    expect(inbox).toContain("!filtering && query.isFetchingNextPage")
  })

  it("shows the no-match state only when a filter is what emptied the list", () => {
    const from = inbox.indexOf("const emptyContent")
    const to = inbox.indexOf("return (\n    <FlatList")
    expect(from, "the emptyContent block must still be findable").toBeGreaterThan(-1)
    expect(to).toBeGreaterThan(from)
    const empty = inbox.slice(from, to)
    expect(empty).toContain("query.isError")
    expect(empty).toContain("if (filtering)")
    expect(empty.indexOf("query.isError")).toBeLessThan(empty.indexOf("if (filtering)"))
    expect(empty.indexOf("if (filtering)")).toBeLessThan(empty.indexOf('t("empty.title")'))
    expect(empty).toContain('t("empty.no_match.body", { query: search.trim() })')
    expect(empty).toContain("icon={iconMap.Search}")
  })

  it("an emptied field is not a filter: the whole list comes back", () => {
    expect(inbox).toContain("const q = search.trim().toLowerCase()")
    expect(inbox).toContain("const filtering = q.length > 0")
  })
})
