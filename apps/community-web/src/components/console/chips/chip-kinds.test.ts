import { CHIP_HUE_NAMES, chipHuePairs, contrastRatio, MIN_CHIP_RATIO } from "@civfix/shared/chip-contrast"
import { colorSchemes } from "@civfix/shared/tokens"
import type { ColorSchemeName } from "@civfix/shared/tokens"
import { describe, expect, it } from "vitest"

import {
  CHIP_HUE_CLASSES,
  CHIP_HUE_OUTLINE_CLASSES,
  CHIP_KINDS,
  UNKNOWN_CHIP_ENTRY,
  chipEntry,
} from "./chip-kinds"
import type { ChipHue, ChipKindEntry } from "./chip-kinds"

const SCHEMES: readonly ColorSchemeName[] = ["light", "dark"]

const entries: Array<{ kind: string; value: string; entry: ChipKindEntry }> = Object.entries(
  CHIP_KINDS,
).flatMap(([kind, family]) =>
  Object.entries(family as Record<string, ChipKindEntry>).map(([value, entry]) => ({
    kind,
    value,
    entry,
  })),
)

function pairFor(hue: ChipHue, scheme: ColorSchemeName): { text: string; bg: string } {
  const c = colorSchemes[scheme]
  if (hue === "neutral") return { text: c.neutral.ink2, bg: c.neutral.paper2 }
  if (hue === "muted") return { text: c.neutral.ink2, bg: c.neutral.cardTint }
  return { text: c.chipInk[hue], bg: c[hue]["50"] }
}

describe("console chip registry", () => {
  it("gives every value an icon and a label key so colour is never the only signal", () => {
    expect(entries.length).toBeGreaterThan(0)
    for (const { kind, value, entry } of entries) {
      expect(entry.icon, `${kind}.${value} icon`).toBeTruthy()
      expect(entry.labelKey, `${kind}.${value} labelKey`).toMatch(/^[a-z-]+:[A-Za-z0-9_.]+$/)
    }
  })

  it("clears WCAG AA in BOTH schemes for every hue a chip can take", () => {
    for (const scheme of SCHEMES) {
      for (const { kind, value, entry } of entries) {
        const pair = pairFor(entry.hue, scheme)
        const bg = entry.outline ? colorSchemes[scheme].neutral.card : pair.bg
        const ratio = contrastRatio(pair.text, bg)
        expect(
          ratio,
          `${scheme} ${kind}.${value} (${entry.hue}${entry.outline ? " outline" : ""}) = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(MIN_CHIP_RATIO)
      }
    }
  })

  it("agrees with the shared contrast fixture for every branded hue", () => {
    for (const scheme of SCHEMES) {
      for (const fixture of chipHuePairs(scheme)) {
        const pair = pairFor(fixture.name, scheme)
        expect(pair.text.toUpperCase(), `${scheme} ${fixture.name} text`).toBe(
          fixture.text.toUpperCase(),
        )
        expect(pair.bg.toUpperCase(), `${scheme} ${fixture.name} bg`).toBe(
          fixture.bg.toUpperCase(),
        )
      }
    }
  })

  it("has a Tailwind class pair for every hue the registry uses", () => {
    const used = new Set(entries.map((entry) => entry.entry.hue))
    for (const hue of used) {
      expect(CHIP_HUE_CLASSES[hue], hue).toBeTruthy()
      expect(CHIP_HUE_OUTLINE_CLASSES[hue], hue).toBeTruthy()
    }
    for (const hue of CHIP_HUE_NAMES) {
      expect(CHIP_HUE_CLASSES[hue as ChipHue], hue).toContain(`bg-console-${hue}-soft`)
      expect(CHIP_HUE_CLASSES[hue as ChipHue], hue).toContain(`text-console-${hue}-strong`)
    }
  })

  it("degrades to a neutral chip for a value a newer backend introduced, never throwing", () => {
    const entry = chipEntry("delivery-status", "some_future_status" as never)
    expect(entry).toBe(UNKNOWN_CHIP_ENTRY)
    expect(entry.icon).toBeTruthy()
    expect(entry.labelKey).toBe("")
  })

  it("never renders two states of one family identically", () => {
    for (const [kind, family] of Object.entries(CHIP_KINDS)) {
      const seen = new Map<string, string>()
      for (const [value, entry] of Object.entries(family as Record<string, ChipKindEntry>)) {
        const signature = `${entry.hue}|${entry.icon.displayName ?? entry.icon.name}`
        const previous = seen.get(signature)
        expect(previous, `${kind}.${value} duplicates ${kind}.${previous}`).toBeUndefined()
        seen.set(signature, value)
      }
    }
  })
})
