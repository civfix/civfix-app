import { readFileSync } from "node:fs"
import { colorSchemes, tokens } from "@civfix/shared/tokens"
import type { ColorSchemeName } from "@civfix/shared/tokens"
import { describe, expect, it } from "vitest"
import config from "../../tailwind.config"
import type { SchemeColor } from "../../tailwind.config"

const CSS = readFileSync(new URL("./design.css", import.meta.url), "utf8")
const GLOBALS = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

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

  it("keeps the shell clear of a landscape notch by consuming the side safe areas at the frame", () => {
    expect(CSS).toMatch(/\.cf-shell\s*\{[^}]*left:\s*env\(safe-area-inset-left, 0px\)/)
    expect(CSS).toMatch(/\.cf-shell\s*\{[^}]*right:\s*env\(safe-area-inset-right, 0px\)/)
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

  const CONSOLE_UTILITIES = [
    [["console", "surface"], "--console-surface"],
    [["console", "surface-alt"], "--console-surface-alt"],
    [["console", "tint"], "--console-tint"],
    [["console", "canvas"], "--console-canvas"],
    [["console", "line"], "--console-line"],
    [["console", "line-strong"], "--console-line-strong"],
    [["console", "accent"], "--console-accent"],
    [["console", "scrim"], "--console-scrim"],
    [["console", "toast-surface"], "--console-toast-surface"],
    [["console", "toast-ink"], "--console-toast-ink"],
    [["console", "toast-ink-dim"], "--console-toast-ink-dim"],
    [["console", "ink", "DEFAULT"], "--console-ink"],
    [["console", "ink", "2"], "--console-ink-2"],
    [["console", "ink", "3"], "--console-ink-3"],
    [["console", "bloom", "soft"], "--console-hue-bloom-soft"],
    [["console", "bloom", "strong"], "--console-hue-bloom-strong"],
    [["console", "moss", "soft"], "--console-hue-moss-soft"],
    [["console", "moss", "strong"], "--console-hue-moss-strong"],
    [["console", "sun", "soft"], "--console-hue-sun-soft"],
    [["console", "sun", "strong"], "--console-hue-sun-strong"],
    [["console", "sky", "soft"], "--console-hue-sky-soft"],
    [["console", "sky", "strong"], "--console-hue-sky-strong"],
    [["console", "lilac", "soft"], "--console-hue-lilac-soft"],
    [["console", "lilac", "strong"], "--console-hue-lilac-strong"],
  ] as const

  for (const [path, variable] of CONSOLE_UTILITIES) {
    it(`${path.join(".")} answers an opacity modifier instead of emitting nothing`, () => {
      expect(resolve(path)({})).toBe(`var(${variable})`)
      expect(resolve(path)({ opacityValue: "0.4" })).toBe(
        `color-mix(in srgb, var(${variable}) calc(0.4 * 100%), transparent)`,
      )
    })
  }

  it("carries a time unit on every duration step, so the utility is legal CSS", () => {
    const durations = (config.theme?.extend?.transitionDuration ?? {}) as Record<string, string>
    expect(Object.keys(durations)).toEqual(["d1", "d2", "d3", "d4"])
    for (const [step, value] of Object.entries(durations)) {
      expect(value, step).toMatch(/^\d+ms$/)
    }
    expect(durations.d1).toBe(`${tokens.motion.dur.d1}ms`)
    expect(durations.d4).toBe(`${tokens.motion.dur.d4}ms`)
  })
})

function hslToHex(triplet: string): string {
  const [h, s, l] = triplet.split(/\s+/).map((part) => Number.parseFloat(part))
  const sat = (s ?? 0) / 100
  const lig = (l ?? 0) / 100
  const k = (n: number): number => (n + (h ?? 0) / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number): number => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const channel = (x: number): string =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase()
  return `#${channel(f(0))}${channel(f(8))}${channel(f(4))}`
}

function shadcnBlock(scheme: ColorSchemeName): string {
  const marker = scheme === "light" ? "\n  :root {" : "\n  .dark {"
  const start = GLOBALS.indexOf(marker)
  expect(start, `globals.css ${scheme} block`).toBeGreaterThan(-1)
  const end = GLOBALS.indexOf("\n  }", start)
  return GLOBALS.slice(start, end)
}

function readTriplet(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`))
  expect(match, name).not.toBeNull()
  return (match?.[1] ?? "").trim()
}

describe("globals.css shadcn surfaces mirror @civfix/shared tokens in BOTH schemes", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`${scheme} fills match colorSchemes`, () => {
      const block = shadcnBlock(scheme)
      const c = colorSchemes[scheme]
      const expected: ReadonlyArray<readonly [string, string]> = [
        ["background", c.neutral.paper],
        ["foreground", c.neutral.ink],
        ["shadcn-card", c.neutral.card],
        ["shadcn-card-foreground", c.neutral.ink],
        ["popover", c.neutral.card],
        ["popover-foreground", c.neutral.ink],
        ["primary", c.bloom["500"]],
        ["secondary", c.neutral.paper2],
        ["secondary-foreground", c.neutral.ink],
        ["muted", c.neutral.paper2],
        ["muted-foreground", c.neutral.ink3],
        ["shadcn-accent", c.sun["500"]],
        ["destructive", c.bloom["600"]],
        ["shadcn-border", c.neutral.ink5],
        ["input", c.neutral.ink5],
      ]
      for (const [name, hex] of expected) {
        expect(hslToHex(readTriplet(block, name)), name).toBe(hex.toUpperCase())
      }
    })
  }

  it("paints the light focus ring and the light primary in the SAME coral", () => {
    const block = shadcnBlock("light")
    const coral = colorSchemes.light.bloom["500"].toUpperCase()
    expect(hslToHex(readTriplet(block, "primary"))).toBe(coral)
    expect(hslToHex(readTriplet(block, "ring"))).toBe(coral)
  })

  it("paints the dark focus ring in the dark ring token", () => {
    const block = shadcnBlock("dark")
    expect(hslToHex(readTriplet(block, "ring"))).toBe(colorSchemes.dark.bloom["600"].toUpperCase())
  })
})

describe("the shadcn theme and the ported handoff palette never share a variable name", () => {
  function rootNames(source: string): Set<string> {
    return new Set([...source.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1] as string))
  }

  it("a shared name would make Tailwind emit hsl(<flat hex>) and drop the declaration", () => {
    const shared = [...rootNames(GLOBALS)].filter((name) => rootNames(CSS).has(name))
    expect(shared).toEqual([])
  })
})
