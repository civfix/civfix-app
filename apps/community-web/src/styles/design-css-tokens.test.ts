import { readFileSync } from "node:fs"
import { colorSchemes } from "@civfix/shared/tokens"
import type { ColorSchemeName } from "@civfix/shared/tokens"
import { describe, expect, it } from "vitest"
import config from "../../tailwind.config"
import type { SchemeColor } from "../../tailwind.config"

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

const HUES = [
  ["bloom", ["50", "100", "300", "500", "600", "700"]],
  ["moss", ["50", "100", "300", "500", "600", "700"]],
  ["sun", ["50", "100", "300", "500", "600", "700"]],
  ["sky", ["50", "100", "300", "500", "600", "700"]],
  ["lilac", ["50", "500", "600", "700"]],
] as const

function tokenValue(source: Record<string, string>, key: string): string {
  const value = source[key]
  expect(value, key).toBeDefined()
  return (value ?? "").toUpperCase()
}

describe("design.css hue ramps mirror @civfix/shared tokens", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`${scheme} hue ramps match colorSchemes`, () => {
      const block = blockFor(scheme)
      for (const [hue, steps] of HUES) {
        const ramp = colorSchemes[scheme][hue] as Record<string, string>
        for (const step of steps) {
          const cssName = step === "500" ? hue : `${hue}-${step}`
          expect(readVar(block, cssName), cssName).toBe(tokenValue(ramp, step))
        }
      }
    })
  }

  it(`category vars match colorSchemes in both schemes`, () => {
    for (const scheme of ["light", "dark"] as const) {
      const block = blockFor(scheme)
      const category = colorSchemes[scheme].category as Record<string, string>
      const resolveVar = (raw: string): string => {
        const ref = /^VAR\(--([A-Z0-9-]+)\)$/.exec(raw)?.[1]
        if (!ref) return raw
        return readVar(block, ref.toLowerCase())
      }
      for (const name of [
        "trash",
        "recycling",
        "graffiti",
        "hazard",
        "encampment",
        "water",
        "other",
      ]) {
        expect(resolveVar(readVar(block, `cat-${name}`)), name).toBe(tokenValue(category, name))
      }
      expect(resolveVar(readVar(block, "cat-cleanup"))).toBe(
        colorSchemes[scheme].cleanup.toUpperCase(),
      )
    }
  })
})

describe("tailwind neutral colours stay legal without an opacity modifier", () => {
  const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>

  function resolve(path: readonly string[]): SchemeColor {
    let node: unknown = colors
    for (const key of path) node = (node as Record<string, unknown>)[key]
    expect(typeof node, path.join(".")).toBe("function")
    return node as SchemeColor
  }

  const NEUTRAL_UTILITIES = [
    [["paper"], "--paper"],
    [["paper2"], "--paper-2"],
    [["cardflat"], "--card"],
    [["cardTint"], "--card-tint"],
    [["ink", "DEFAULT"], "--ink"],
    [["ink", "2"], "--ink-2"],
    [["ink", "3"], "--ink-3"],
    [["ink", "4"], "--ink-4"],
    [["ink", "5"], "--ink-5"],
  ] as const

  const HUE_UTILITIES = [
    [["bloom", "500"], "--bloom"],
    [["bloom", "50"], "--bloom-50"],
    [["moss", "100"], "--moss-100"],
    [["sun", "700"], "--sun-700"],
    [["sky", "300"], "--sky-300"],
    [["lilac", "600"], "--lilac-600"],
    [["cat", "hazard"], "--cat-hazard"],
    [["cleanup"], "--cat-cleanup"],
  ] as const

  for (const [path, variable] of [...NEUTRAL_UTILITIES, ...HUE_UTILITIES]) {
    it(`${path.join(".")} resolves to a bare var(${variable})`, () => {
      expect(resolve(path)({})).toBe(`var(${variable})`)
    })
  }

  it("keeps the legacy opacity core plugins off so unmodified utilities stay bare", () => {
    for (const plugin of [
      "backgroundOpacity",
      "textOpacity",
      "borderOpacity",
      "divideOpacity",
      "ringOpacity",
      "placeholderOpacity",
    ]) {
      expect((config.corePlugins as Record<string, boolean>)[plugin], plugin).toBe(false)
    }
  })

  it("only reaches for color-mix when a modifier is present", () => {
    expect(resolve(["paper2"])({ opacityValue: "0.6" })).toBe(
      "color-mix(in srgb, var(--paper-2) calc(0.6 * 100%), transparent)",
    )
  })
})
