import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { colorSchemes, shadowSchemes } from "@civfix/shared/tokens"
import type { ColorSchemeName } from "@civfix/shared/tokens"
import { describe, expect, it } from "vitest"

const CSS = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
)

function blockFor(scheme: ColorSchemeName): string {
  const start = CSS.indexOf(scheme === "light" ? "  :root {" : "  .dark {")
  expect(start, `${scheme} block`).toBeGreaterThan(-1)
  const end = CSS.indexOf("\n  }", start)
  return CSS.slice(start, end)
}

function readVar(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`))
  expect(match, name).not.toBeNull()
  return (match?.[1] ?? "").trim()
}

const HUES = ["bloom", "moss", "sun", "sky", "lilac"] as const

describe("--console-* variables track @civfix/shared tokens", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`${scheme} surfaces, ink ramp and hue pairs match colorSchemes`, () => {
      const block = blockFor(scheme)
      const c = colorSchemes[scheme]
      expect(readVar(block, "console-canvas").toUpperCase()).toBe(c.neutral.paper.toUpperCase())
      expect(readVar(block, "console-surface").toUpperCase()).toBe(c.neutral.card.toUpperCase())
      expect(readVar(block, "console-surface-alt").toUpperCase()).toBe(
        c.neutral.paper2.toUpperCase(),
      )
      expect(readVar(block, "console-tint").toUpperCase()).toBe(c.neutral.cardTint.toUpperCase())
      expect(readVar(block, "console-line").toUpperCase()).toBe(c.neutral.ink5.toUpperCase())
      expect(readVar(block, "console-line-strong").toUpperCase()).toBe(
        c.neutral.ink4.toUpperCase(),
      )
      expect(readVar(block, "console-ink").toUpperCase()).toBe(c.neutral.ink.toUpperCase())
      expect(readVar(block, "console-ink-2").toUpperCase()).toBe(c.neutral.ink2.toUpperCase())
      expect(readVar(block, "console-ink-3").toUpperCase()).toBe(c.neutral.ink3.toUpperCase())
      expect(readVar(block, "console-accent").toUpperCase()).toBe(c.bloom["500"].toUpperCase())
      expect(readVar(block, "console-toast-surface").toUpperCase()).toBe(
        (scheme === "light" ? c.neutral.ink : c.neutral.cardTint).toUpperCase(),
      )
      expect(readVar(block, "console-toast-ink").toUpperCase()).toBe(
        (scheme === "light" ? c.neutral.paper : c.neutral.ink).toUpperCase(),
      )
      expect(readVar(block, "console-toast-ink-dim").toUpperCase()).toBe(
        (scheme === "light" ? c.neutral.ink3 : c.neutral.ink2).toUpperCase(),
      )
      for (const hue of HUES) {
        expect(readVar(block, `console-hue-${hue}-soft`).toUpperCase()).toBe(
          c[hue]["50"].toUpperCase(),
        )
        expect(readVar(block, `console-hue-${hue}-strong`).toUpperCase()).toBe(
          c.chipInk[hue].toUpperCase(),
        )
      }
    })

    it(`${scheme} scrim is a translucent overlay, never an opaque colour`, () => {
      const scrim = readVar(blockFor(scheme), "console-scrim")
      expect(scrim).toMatch(/^rgba\(/)
      const alpha = Number(scrim.replace(/^.*,\s*([0-9.]+)\)$/, "$1"))
      expect(alpha).toBeGreaterThan(0)
      expect(alpha).toBeLessThan(1)
    })

    it(`${scheme} elevation matches shadowSchemes`, () => {
      const block = blockFor(scheme)
      const s = shadowSchemes[scheme]
      expect(readVar(block, "console-shadow-1")).toBe(s.s1)
      expect(readVar(block, "console-shadow-2")).toBe(s.s2)
      expect(readVar(block, "console-shadow-3")).toBe(s.s3)
      expect(readVar(block, "console-shadow-4")).toBe(s.s4)
      expect(readVar(block, "console-shadow-ring")).toBe(s.ring)
    })
  }
})
