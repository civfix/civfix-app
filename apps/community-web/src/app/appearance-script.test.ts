import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const uiDir = dirname(require.resolve("@civfix/ui/package.json"))

const schemes = readFileSync(join(uiDir, "src/theme/schemes.ts"), "utf8")
const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8")
const store = readFileSync(new URL("../store/appearance-store.ts", import.meta.url), "utf8")

const DEFAULT_APPEARANCE_PREFERENCE = /DEFAULT_APPEARANCE_PREFERENCE[^=]*= "([a-z]+)"/.exec(
  schemes,
)?.[1]

describe("the pre-paint appearance script", () => {
  it("reads the contract's shipped default, so the fixture is not guessing", () => {
    expect(DEFAULT_APPEARANCE_PREFERENCE).toBeTruthy()
  })

  it("falls back to the same preference the store does, so the first paint never flips", () => {
    const fallback = /\)s="([a-z]+)";/.exec(layout)?.[1]
    expect(fallback).toBe(DEFAULT_APPEARANCE_PREFERENCE)
  })

  it("leaves the store with no default literal of its own to drift from", () => {
    expect(store).toContain('DEFAULT_APPEARANCE_PREFERENCE,\n  isAppearancePreference,')
    expect(store).toContain('from "@civfix/ui/theme"')
    expect(store).not.toMatch(/AppearancePreference = "(system|light|dark)"/)
  })
})
