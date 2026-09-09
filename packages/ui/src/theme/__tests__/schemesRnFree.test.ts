import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { COLOR_SCHEMES, colorSchemes, resolveSchemeName } from "../schemes"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const schemes = strip(read("../schemes.ts"))
const importSpecifiers = [...schemes.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1])

describe("theme/schemes is the RN-free scheme surface", () => {
  it("imports neither react-native nor react", () => {
    for (const specifier of importSpecifiers) {
      expect(specifier, specifier).not.toMatch(/^react(-native)?($|\/|-)/)
      expect(specifier, specifier).not.toBe("react-dom")
    }
  })

  it("reads its palettes straight from the framework-free token package", () => {
    expect(importSpecifiers).toContain("@civfix/shared/tokens")
    expect(new Set(importSpecifiers).size).toBe(1)
  })

  it("is published as its own subpath so a DOM-only consumer can import it", () => {
    const pkg = JSON.parse(read("../../../package.json")) as {
      exports: Record<string, { types?: string; default?: string }>
    }
    const entry = pkg.exports["./theme/schemes"]
    expect(entry?.default).toBe("./src/theme/schemes.ts")
    expect(entry?.types).toBe("./dist-types/theme/schemes.d.ts")
  })

  it("re-exports the palettes so the subpath is a complete scheme surface", () => {
    for (const scheme of COLOR_SCHEMES) {
      expect(colorSchemes[scheme].neutral.ink).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe("resolveSchemeName", () => {
  it("passes through the two real scheme names", () => {
    expect(resolveSchemeName("light")).toBe("light")
    expect(resolveSchemeName("dark")).toBe("dark")
  })

  it("falls back to light for anything else", () => {
    for (const input of [null, undefined, "", "Dark", "system", 0, {}]) {
      expect(resolveSchemeName(input)).toBe("light")
    }
  })
})
