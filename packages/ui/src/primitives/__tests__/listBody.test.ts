import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { shouldLoadMoreOnEndReached } from "../useListEndReached"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const field = strip(read("../ListSearchField.tsx"))
const empty = strip(read("../ListBodyEmpty.tsx"))
const styles = strip(read("../listBodyStyles.ts"))
const index = strip(read("../index.ts"))

const LIST_BODIES = [
  "ConnectionsBody",
  "ReportsBody",
  "MessagingListBody",
  "SocialBody",
  "EventsBody",
  "BlockedAccountsBody",
  "ClusterReportsBody",
] as const
const body = (name: string): string => strip(read(`../../bodies/${name}.tsx`))

const styleBlock = (src: string, name: string): string => {
  const found = new RegExp(`\\n  ${name}:\\s*(?:\\{([\\s\\S]*?)\\n  \\},|([^\\n]*),)`).exec(src)
  if (!found) throw new Error(`style "${name}" not found`)
  return found[1] ?? found[2] ?? ""
}

describe("useListEndReached: one end-of-list paging rule", () => {
  it("loads the next page when there is one and none is in flight", () => {
    expect(shouldLoadMoreOnEndReached({ hasNextPage: true, isFetchingNextPage: false }, false)).toBe(true)
  })

  it("holds still while a page is in flight or none is left", () => {
    expect(shouldLoadMoreOnEndReached({ hasNextPage: true, isFetchingNextPage: true }, false)).toBe(false)
    expect(shouldLoadMoreOnEndReached({ hasNextPage: false, isFetchingNextPage: false }, false)).toBe(false)
  })

  it("never pages from the end of a filtered list, which would pull every page", () => {
    expect(shouldLoadMoreOnEndReached({ hasNextPage: true, isFetchingNextPage: false }, true)).toBe(false)
  })

  it.each(["ConnectionsBody", "ReportsBody", "MessagingListBody"])(
    "%s pages through it with its filter",
    (name) => {
      expect(body(name)).toContain("const onEndReached = useListEndReached(query, filtering)")
    },
  )

  it("BlockedAccountsBody pages through it with no filter", () => {
    expect(body("BlockedAccountsBody")).toContain("const onEndReached = useListEndReached(query)")
  })
})

describe("ListSearchField is the one in-list search field", () => {
  it("takes its copy from the caller, so each list keeps its own catalog keys", () => {
    expect(field).toContain("placeholder={placeholder}")
    expect(field).toContain("accessibilityLabel={a11yLabel}")
    expect(field).toContain("accessibilityLabel={clearA11yLabel}")
  })

  it("clears the query from either clear target", () => {
    expect((field.match(/onPress=\{\(\) => onChangeText\(""\)\}/g) ?? []).length).toBe(2)
  })

  it("keeps the house field geometry and the 22pt clear disc", () => {
    expect(styleBlock(field, "searchField")).toContain("minHeight: MIN_TOUCH_TARGET")
    expect(styleBlock(field, "searchField")).toContain('marginTop: t.space["2"]')
    expect(field).toContain("const CLEAR_BTN_SIZE = 22")
    expect(styleBlock(field, "clearTarget")).toContain("marginRight: -CLEAR_BTN_HIT_SLOP")
  })

  it.each([
    ["ConnectionsBody", "slop", "none"],
    ["SocialBody", "slop", "none"],
    ["MessagingListBody", "slop", "none"],
    ["ReportsBody", "box", null],
    ["EventsBody", "box", null],
  ] as const)("%s keeps its own clear target (%s) and capitalisation", (name, target, capitalize) => {
    const src = body(name)
    expect(src).toContain("<ListSearchField")
    expect(src.includes('clearTarget="slop"')).toBe(target === "slop")
    expect(src.includes('autoCapitalize="none"')).toBe(capitalize === "none")
  })

  it("the inbox field alone sits flush under its header", () => {
    expect(body("MessagingListBody")).toContain("style={SEARCH_FIELD_FLUSH}")
    expect(body("MessagingListBody")).toContain("const SEARCH_FIELD_FLUSH = { marginTop: 0 }")
  })
})

describe("ListBodyEmpty draws the list states one way", () => {
  it("draws the error state as the neutral cloud at the house size", () => {
    const error = empty.slice(empty.indexOf('phase === "error"'), empty.indexOf('phase === "noMatch"'))
    expect(error).toContain('variant="detail"')
    expect(error).toContain('tone="neutral"')
    expect(error).toContain("icon={iconMap.CloudOff}")
    expect(error).toContain("iconColor={th.colors.textSubtle}")
    expect(error).toContain("iconSize={ERROR_ICON_SIZE}")
    expect(empty).toContain("const ERROR_ICON_SIZE = 30")
  })

  it("loads with the caller's skeleton rows, or the detail spinner when it has none", () => {
    expect(empty).toContain("<LoadingState skeleton={skeleton} rows={skeletonRows} />")
    expect(empty).toContain('<LoadingState variant="detail" />')
  })

  it("draws no-match with the search glyph and the empty state with the caller's icon", () => {
    const noMatch = empty.slice(empty.indexOf('phase === "noMatch"'), empty.indexOf('phase === "empty"'))
    expect(noMatch).toContain("icon={iconMap.Search}")
    expect(empty).toContain("icon={copies.empty.icon}")
  })

  it.each(["ConnectionsBody", "ReportsBody", "MessagingListBody", "BlockedAccountsBody", "ClusterReportsBody"])(
    "%s renders its list states through it",
    (name) => {
      expect(body(name)).toContain("<ListBodyEmpty")
      expect(body(name)).not.toContain("iconMap.CloudOff")
    },
  )
})

describe("listBodyStyles is the one list scaffold", () => {
  it("holds the list, its padded content and its empty fill", () => {
    expect(styleBlock(styles, "list")).toContain("flex: 1")
    expect(styleBlock(styles, "listContent")).toContain("paddingTop: 0")
    expect(styleBlock(styles, "listContentInset")).toContain('paddingTop: t.space["2"]')
    expect(styleBlock(styles, "listEmpty")).toContain("flexGrow: 1")
    expect(styleBlock(styles, "footerCentered")).toContain('alignItems: "center"')
  })

  it.each(LIST_BODIES)("%s takes its list scaffold from it", (name) => {
    const src = body(name)
    expect(src).toContain("useListBodyStyles()")
    expect(src).toContain("style={listStyles.list}")
    expect(src).not.toMatch(/\n {2}listEmpty: \{/)
  })

  it("is exported with the rest of the list primitives", () => {
    for (const name of ["ListSearchField", "ListBodyEmpty", "useListBodyStyles", "useListEndReached"]) {
      expect(index).toContain(name)
    }
  })
})
