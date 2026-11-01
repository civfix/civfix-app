/**
 * Below the phone's system notice the screens read a top inset of 0 (SystemNoticeFrame). These pin the two
 * exceptions to every place they apply, so a new modal or window-sized layout cannot silently lose the inset.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const SRC = fileURLToPath(new URL("../../", import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

const files = sources(SRC).map((path) => ({
  name: relative(SRC, path),
  text: readFileSync(path, "utf8"),
}))

describe("full-window surfaces below the notice", () => {
  it("opens every RN Modal through FullWindowModal", () => {
    const direct = files
      .filter(({ name }) => name !== "primitives/FullWindowModal.tsx")
      .filter(({ text }) => /import \{[^}]*\bModal\b[^}]*\} from "react-native"/.test(text))
      .map(({ name }) => name)
    expect(direct).toEqual([])
  })

  it("reads the device's insets in every component that hosts one", () => {
    const hosts = files.filter(({ text }) => text.includes("<FullWindowModal"))
    expect(hosts.length).toBeGreaterThan(0)
    for (const { name, text } of hosts) {
      const reads =
        text.match(/(?:React\.)?useContext\(SafeAreaInsetsContext\)|useSafeAreaInsets\(\)/g) ?? []
      const wrapped =
        text.match(
          /useFullWindowInsets\((?:React\.)?useContext\(SafeAreaInsetsContext\)\)|useFullWindowInsets\(useSafeAreaInsets\(\)\)/g,
        ) ?? []
      expect(wrapped.length, name).toBe(reads.length)
    }
  })
})

describe("window-sized layouts below the notice", () => {
  it("sizes the phone sheet from the window less the notice", () => {
    const shell = readFileSync(join(SRC, "shell/CompactShell.native.tsx"), "utf8")
    expect(shell).toContain("const height = useShellWindowHeight()")
    expect(shell).not.toContain("useWindowDimensions")
  })
})
