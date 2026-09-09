import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8")

const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const BODIES = {
  "PostDetailBody.tsx": { source: code(read("../PostDetailBody.tsx")), container: "ScrollView" },
  "SavedPostsBody.tsx": { source: code(read("../SavedPostsBody.tsx")), container: "FlatList" },
}

describe("the post surfaces own their scroll", () => {
  for (const [name, { source, container }] of Object.entries(BODIES)) {
    it(`${name} takes its ${container} from useScrollHost`, () => {
      expect(source).toMatch(/import \{ useScrollHost \} from "\.\.\/shell\/ScrollHost"/)
      expect(source).toMatch(new RegExp(`const \\{ ${container} \\} = useScrollHost\\(\\)`))
    })

    it(`${name} does not reach past the seam to react-native's own scrollables`, () => {
      const rnImport = /import \{([^}]*)\} from "react-native"/.exec(source)?.[1] ?? ""
      expect(rnImport).not.toMatch(/\bScrollView\b/)
      expect(rnImport).not.toMatch(/\bFlatList\b/)
    })

    it(`${name} splits flex between the container and its content`, () => {
      expect(source).toMatch(/style=\{styles\.root\}/)
      expect(source).toMatch(/contentContainerStyle=\{styles\.content\}/)
      expect(/\broot:\s*\{([^{}]*)\}/.exec(source)?.[1]).toMatch(/flex: 1/)
      expect(/\bcontent:\s*\{([^{}]*)\}/.exec(source)?.[1]).toMatch(/flexGrow: 1/)
    })
  }

  it("keeps PostDetailBody's tail inside its ScrollView", () => {
    const source = BODIES["PostDetailBody.tsx"].source
    const open = source.indexOf("<ScrollView")
    const close = source.lastIndexOf("</ScrollView>")
    expect(open, "PostDetailBody renders no ScrollView").toBeGreaterThan(-1)
    expect(close, "PostDetailBody closes no ScrollView").toBeGreaterThan(open)
    const at = source.indexOf("styles.threadButton")
    expect(at, "PostDetailBody renders no styles.threadButton").toBeGreaterThan(-1)
    expect(at, "PostDetailBody: the tail sits outside the scroll container").toBeLessThan(close)
    expect(at, "PostDetailBody: the tail sits above the scroll container").toBeGreaterThan(open)
  })

  it("hands SavedPostsBody's pager to the list as its footer", () => {
    const source = BODIES["SavedPostsBody.tsx"].source
    expect(source).toMatch(/const footer = hasNextPage \?/)
    expect(source).toMatch(/style=\{styles\.more\}/)
    expect(source).toMatch(/ListFooterComponent=\{footer\}/)
  })

  it("pages SavedPostsBody on end-reached with an in-flight-safe pager", () => {
    const source = BODIES["SavedPostsBody.tsx"].source
    expect(source).toMatch(/onEndReached=\{loadMore\}/)
    expect(source).toMatch(/if \(hasNextPage && !isFetchingNextPage\) void fetchNextPage\(\)/)
    expect(source).toMatch(/disabled=\{isFetchingNextPage\}/)
    expect(source).toMatch(/accessibilityState=\{\{ disabled: isFetchingNextPage \}\}/)
    expect(source).toMatch(/accessibilityRole="button"/)
  })

  it("has no non-scrolling branch left", () => {
    for (const [name, { source }] of Object.entries(BODIES)) {
      expect(source, `${name} still renders a plain View root`).not.toMatch(
        /<View\s+style=\{styles\.root\}/,
      )
    }
  })
})
