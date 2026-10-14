import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const hook = strip(read("../useRefreshControlProps.ts"))

describe("useRefreshControlProps is the one pull-to-refresh palette", () => {
  it("draws the indicator in the theme's ink, which flips dark-on-light and light-on-dark", () => {
    expect(hook).toContain("tintColor: th.colors.text")
    expect(hook).toContain("colors: [th.colors.text]")
  })

  it("avoids the low-contrast accent and textMuted pair", () => {
    expect(hook).not.toContain("th.colors.accent")
    expect(hook).not.toContain("th.colors.textMuted")
  })

  it("backs Android's indicator bubble with the themed surface, so light ink is never lost on it", () => {
    expect(hook).toContain("progressBackgroundColor: th.colors.surface")
  })

  it("memoizes on the theme, the one value that changes when the scheme flips", () => {
    expect(hook).toMatch(/return useMemo\(\s*\(\) => \(\{/)
    expect(hook).toContain("[th],")
  })

  it("reads the scheme at render time instead of importing a frozen theme", () => {
    expect(hook).toContain('import { useTheme } from "../theme"')
    expect(hook).not.toMatch(/import \{[^}]*\bthemes?\b[^}]*\} from "\.\.\/theme"/)
  })

  it("hardcodes no colour", () => {
    expect(hook).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(hook).not.toMatch(/\brgba?\(/)
  })

  it("is typed off RefreshControl's own props, so a rename in react-native breaks the build", () => {
    expect(hook).toContain('import type { RefreshControlProps } from "react-native"')
    expect(hook).toContain(
      'Pick<RefreshControlProps, "tintColor" | "colors" | "progressBackgroundColor">',
    )
  })
})
