import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  APPEARANCE_PREFERENCES,
  DEFAULT_APPEARANCE_PREFERENCE,
} from "@civfix/ui/theme/schemes"

import { APPEARANCE_SCRIPT, APPEARANCE_STORAGE_KEY } from "@/lib/appearance-script"

const store = readFileSync(new URL("../store/appearance-store.ts", import.meta.url), "utf8")

interface PaintResult {
  readKey: string | null
  dark: boolean
  colorScheme: string
}

function runScript(stored: string | null, systemDark: boolean): PaintResult {
  let readKey: string | null = null
  let dark = false
  const style = { colorScheme: "" }
  const localStorage = {
    getItem: (key: string) => {
      readKey = key
      return stored
    },
  }
  const window = { matchMedia: () => ({ matches: systemDark }) }
  const document = {
    documentElement: {
      classList: {
        toggle: (name: string, force: boolean) => {
          if (name === "dark") dark = force
        },
      },
      style,
    },
  }
  new Function("localStorage", "window", "document", APPEARANCE_SCRIPT)(localStorage, window, document)
  return { readKey, dark, colorScheme: style.colorScheme }
}

describe("the pre-paint appearance script", () => {
  it("reads the contract's shipped default, so the fixture is not guessing", () => {
    expect(DEFAULT_APPEARANCE_PREFERENCE).toBeTruthy()
  })

  it("reads the key the store writes", () => {
    expect(runScript(null, false).readKey).toBe(APPEARANCE_STORAGE_KEY)
  })

  it("falls back to the same preference the store does, so the first paint never flips", () => {
    for (const systemDark of [false, true]) {
      const asDefault = runScript(DEFAULT_APPEARANCE_PREFERENCE, systemDark)
      expect(runScript(null, systemDark)).toEqual(asDefault)
      expect(runScript("bogus", systemDark)).toEqual(asDefault)
    }
  })

  it("paints every stored preference as the scheme it names", () => {
    for (const preference of APPEARANCE_PREFERENCES) {
      for (const systemDark of [false, true]) {
        const expectedDark = preference === "dark" || (preference === "system" && systemDark)
        expect(runScript(preference, systemDark)).toMatchObject({
          dark: expectedDark,
          colorScheme: expectedDark ? "dark" : "light",
        })
      }
    }
  })

  it("leaves the store with no default literal of its own to drift from", () => {
    expect(store).toContain('DEFAULT_APPEARANCE_PREFERENCE,\n  isAppearancePreference,')
    expect(store).toContain('from "@civfix/ui/theme"')
    expect(store).not.toMatch(/AppearancePreference = "(system|light|dark)"/)
  })
})
