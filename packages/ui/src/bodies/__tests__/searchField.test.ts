import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
import { searchBodySource } from "../search/__tests__/searchBodySource"

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const body = searchBodySource()
const bodyCode = strip(body)
const shell = strip(read("../../shell/ExpandedShell.tsx"))
const rail = strip(read("../../shell/Rail.tsx"))
const tabBar = strip(read("../../shell/TabBar.shared.tsx"))

describe("where the field lives", () => {
  it("renders ABOVE the surface switch, so focusing it cannot unmount it", () => {
    expect(bodyCode).toMatch(/if \(!expanded\) return surface/)
    expect(bodyCode).toContain("<ExpandedSearchHeader />")
    expect(bodyCode).toMatch(/function ExpandedSearchHeader\(\)[\s\S]*?<ExpandedSearchField \/>/)
    for (const surface of ["RecentlySearched", "Discovery", "SearchResting"]) {
      const fn = bodyCode.match(new RegExp(`function ${surface}\\([\\s\\S]*?\\n}`))?.[0]
      expect(fn, `${surface} must still be a top-level function of the search surface`).toBeTruthy()
      expect(fn, `${surface} must not host the field`).not.toContain("ExpandedSearchField")
    }
  })

  it("draws ONE title: Discovery yields its large-title row to the head in expanded", () => {
    expect(bodyCode).toContain("{expanded ? null : (")
    expect(bodyCode).toMatch(/function Discovery\(\{ expanded \}/)
  })

  it("is gated on the layout mode, not on a width literal", () => {
    expect(bodyCode).toContain('useLayoutMode() === "expanded"')
  })
})

describe("the field owns no state", () => {
  it("reads and writes the SHARED query, so the three surfaces stay in step with what is typed", () => {
    expect(bodyCode).toMatch(/function ExpandedSearchField\(\)[\s\S]*?useNavStore\(\(s\) => s\.query\)/)
    expect(bodyCode).toContain("useNavStore((s) => s.setQuery)")
  })

  it("publishes the docked bar's own pinned rule, and clears it on unmount", () => {
    expect(bodyCode).toContain("useSearchBarStore((s) => s.setPinned)")
    expect(bodyCode).toMatch(/const pinned = focused \|\| query\.trim\(\)\.length > 0/)
    expect(bodyCode).toMatch(/useEffect\(\(\) => \(\) => setPinned\(false\), \[setPinned\]\)/)
  })

  it("writes recents through the ONE commit helper - never a keystroke debounce", () => {
    expect(bodyCode).not.toContain("RECENT_WRITE_DELAY_MS")
    expect(bodyCode).toMatch(/function commitSearchRecent\(query: string\): void/)
    expect(bodyCode.match(/useSearchRecentStore\.getState\(\)\.record\(/g)?.length).toBe(1)
  })

  it("commits on submit, on opening a result, and on leaving a non-empty field", () => {
    expect(bodyCode).toContain("onSubmitEditing={() => commitSearchRecent(query)}")
    expect(bodyCode).toMatch(/const unpinned = wasPinnedRef\.current && !pinned/)
    expect(bodyCode).toMatch(/state\.stack\.length > prev\.stack\.length\) commitRef\.current\(prev\.query\)/)
  })

  it("commits the SHARED pending input, not a private last-non-empty ref", () => {
    expect(bodyCode).toContain("trackSearchInput(query)")
    expect(bodyCode).toContain("commitRef.current(pendingSearchInput())")
    expect(bodyCode).not.toContain("typedRef")
  })

  it("tracks the input in an EFFECT, never during render - the write leaves the component", () => {
    expect(bodyCode).toMatch(
      /function useRecordSearchOnCommit\(query: string, pinned: boolean\): void \{\s*useEffect\(\(\) => \{\s*trackSearchInput\(query\)\s*\}, \[query\]\)/,
    )
    expect(bodyCode.match(/trackSearchInput\(/g)?.length).toBe(1)
  })

  it("declares that effect FIRST, so it flushes before the unpin commit reads the pending input", () => {
    expect(bodyCode.indexOf("trackSearchInput(query)")).toBeLessThan(
      bodyCode.indexOf("commitRef.current(pendingSearchInput())"),
    )
  })

  it("drops the pending input on unmount, so a later focus+blur cannot re-record a stale search", () => {
    expect(bodyCode).toContain("useEffect(() => () => discardSearchInput(), [])")
  })

  it("an explicit clear discards the pending input, so the blur that follows records nothing", () => {
    expect(bodyCode).toMatch(/const clearQuery = useCallback\(\(\) => \{\s*discardSearchInput\(\)\s*setQuery\(""\)/)
    expect(bodyCode).toContain('searchFieldEscape(query) === "clear") clearQuery()')
    expect(bodyCode).toContain("onPress={clearQuery}")
    expect(bodyCode).not.toContain('onPress={() => setQuery("")}')
  })

  it("the docked bar's clear discards it too - it drives the same pinned commit", () => {
    expect(tabBar).toMatch(/onClear: \(\) => \{\s*discardSearchInput\(\)\s*setQuery\(""\)/)
    expect(tabBar).toContain('import { discardSearchInput } from "../bodies/searchRecentStore"')
  })
})

describe("the Escape ladder's field half", () => {
  it("goes through the pure model, on the ONE key prop rn-web actually forwards", () => {
    expect(bodyCode).toContain('searchFieldEscape(query) === "clear"')
    expect(bodyCode).toContain("onKeyPress")
    expect(bodyCode).not.toContain("onKeyDown")
    expect(bodyCode).toContain('web.key !== "Escape"')
  })
})

describe("the entry points that focus it", () => {
  it("the shell mounts the ONE key listener", () => {
    expect(shell).toContain("useShellKeys()")
  })

  it("the rail's orb arms the focus request, guarded on the re-tap rule", () => {
    expect(rail).toContain("requestSearchFocus")
    expect(rail).toContain("searchPressOpensSearch(view, stackLength)")
  })

  it("the field consumes the request on a clock that outlives the card's body swap", () => {
    expect(bodyCode).toContain("FOCUS_REQUEST_HOLD_MS")
    expect(bodyCode).toContain("setTimeout(consumeSearchFocus, FOCUS_REQUEST_HOLD_MS)")
    expect(bodyCode).toMatch(
      /FOCUS_REQUEST_HOLD_MS =\s*motion\.bodyPush\.duration \+ motion\.bodyExit\.duration/,
    )
  })
})

describe("the field's material", () => {
  it("keeps the docked pill on the shared list-field recipe and takes no new i18n key", () => {
    expect(bodyCode).toContain("const MIN_TOUCH_TARGET = 44")
    expect(bodyCode).toMatch(
      /gap: 9,\s*\n\s*minHeight: MIN_TOUCH_TARGET,\s*\n\s*paddingHorizontal: 12,\s*\n\s*borderRadius: t\.radius\.md/,
    )
    expect(bodyCode).toContain("backgroundColor: t.colors.surface")
    expect(bodyCode).toContain('searchModeFor("search", null).placeholder')
    expect(bodyCode).toContain('tSearch("a11y.clear")')
  })

  it("uses the on-sand border rule, lightened at web's unavoidable 1px", () => {
    expect(bodyCode).toContain("wash(t.colors.borderStrong, 0.45, t)")
  })
})
