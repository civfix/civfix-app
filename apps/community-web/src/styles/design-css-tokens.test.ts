import { readFileSync } from "node:fs"
import { colorSchemes } from "@civfix/shared/tokens"
import type { ColorSchemeName } from "@civfix/shared/tokens"
import { describe, expect, it } from "vitest"

const CSS = readFileSync(new URL("./design.css", import.meta.url), "utf8")

function blockFor(scheme: ColorSchemeName): string {
  const start = CSS.indexOf(scheme === "light" ? "\n:root {" : "\n:root.dark {")
  expect(start, `${scheme} block`).toBeGreaterThan(-1)
  const end = CSS.indexOf("\n}", start)
  return CSS.slice(start, end)
}

function readVar(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`))
  expect(match, name).not.toBeNull()
  return (match?.[1] ?? "").trim().toUpperCase()
}

const NEUTRALS = [
  ["paper", "paper"],
  ["paper-2", "paper2"],
  ["card", "card"],
  ["card-tint", "cardTint"],
  ["ink", "ink"],
  ["ink-2", "ink2"],
  ["ink-3", "ink3"],
  ["ink-4", "ink4"],
  ["ink-5", "ink5"],
] as const

describe("design.css neutrals mirror @civfix/shared tokens", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`${scheme} surfaces and ink ramp match colorSchemes`, () => {
      const block = blockFor(scheme)
      const neutral = colorSchemes[scheme].neutral
      for (const [cssName, tokenName] of NEUTRALS) {
        expect(readVar(block, cssName), cssName).toBe(neutral[tokenName].toUpperCase())
      }
    })
  }

  it("paints the shell and the boot splash from the same variable", () => {
    expect(CSS).toMatch(/\.cf-shell\s*\{[^}]*background:\s*var\(--paper\)/)
  })
})
