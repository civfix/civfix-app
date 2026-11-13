import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { colorSchemes } from "@civfix/tokens"
import type { ColorSchemeName } from "@civfix/tokens"
import { beforeAll, describe, expect, it } from "vitest"
import type { CompiledCss } from "./compiled-css"
import { compileGlobals, resolvedDecl } from "./compiled-css"
import { seasonLook } from "@civfix/ui/theme/season"

const CSS = readFileSync(new URL("./design.css", import.meta.url), "utf8")
const GLOBALS = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

/** The built theme export, read through the package's `exports` as globals.css imports it. */
function themeCss(): string {
  let path: string | undefined
  try {
    path = createRequire(import.meta.url).resolve("@civfix/tokens/theme.css")
  } catch {
    path = undefined
  }
  expect(path, "@civfix/tokens/theme.css").toBeDefined()
  return path === undefined ? "" : readFileSync(path, "utf8")
}

function blockFor(scheme: ColorSchemeName): string {
  const start = CSS.indexOf(scheme === "light" ? "\n  :root {" : "\n  :root.dark {")
  expect(start, `${scheme} block`).toBeGreaterThan(-1)
  const end = CSS.indexOf("\n  }", start)
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

describe("design.css neutrals mirror @civfix/tokens", () => {
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

  it("pads every page outside the shell by all four safe areas once, at the body", () => {
    const rule = CSS.match(/body:not\(:has\(\.cf-shell\)\)\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    const body = rule?.[1] ?? ""
    expect(body).toMatch(/height:\s*auto;/)
    expect(body).toMatch(/min-height:\s*100%;/)
    expect(body.replace(/\s+/g, " ")).toContain(
      "padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);",
    )
    expect(CSS.match(/safe-area-inset-bottom/g)).toHaveLength(1)
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

describe("design.css hue ramps mirror @civfix/tokens", () => {
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

function themeVar(name: string): string {
  const match = themeCss().match(new RegExp(`${name}:\\s*([^;]+);`))
  expect(match, `theme.css ${name}`).not.toBeNull()
  return (match?.[1] ?? "").trim()
}

/** One spelling per CSS value: no whitespace, no trailing decimal zeros (Prettier writes 0.2 for 0.20). */
const normalised = (value: string): string =>
  value
    .replace(/\s+/g, "")
    .replace(/(\.\d*?)0+(?!\d)/g, "$1")
    .replace(/\.(?!\d)/g, "")
    .toUpperCase()

describe("design.css token variables equal the @civfix/tokens theme", () => {
  it("T21: the light radius, pin shadow and easing variables match theme.css", () => {
    const block = blockFor("light")
    for (const name of [
      "radius-xs",
      "radius-sm",
      "radius-md",
      "radius-lg",
      "radius-xl",
      "radius-2xl",
      "radius-pill",
      "shadow-pin",
      "ease-out",
      "ease-spring",
      "ease-in-out",
    ]) {
      expect(normalised(readVar(block, name)), name).toBe(normalised(themeVar(`--${name}`)))
    }
  })

  it("T21: the dark pin shadow stays a scheme override", () => {
    expect(normalised(readVar(blockFor("dark"), "shadow-pin"))).toBe(
      normalised("0 6px 10px -2px rgba(244, 121, 108, 0.45), 0 2px 4px rgba(0, 0, 0, 0.5)"),
    )
  })
})

const SCHEME_UTILITIES = [
  ["bg-paper", "background-color", "--paper"],
  ["text-ink-2", "color", "--ink-2"],
  ["border-console-line", "border-color", "--console-line"],
  ["bg-paper2", "background-color", "--paper-2"],
  ["bg-cardflat", "background-color", "--card"],
  ["bg-cardTint", "background-color", "--card-tint"],
  ["text-ink", "color", "--ink"],
  ["text-ink-3", "color", "--ink-3"],
  ["text-ink-4", "color", "--ink-4"],
  ["border-ink-5", "border-color", "--ink-5"],
  ["bg-bloom-500", "background-color", "--bloom"],
  ["bg-bloom-50", "background-color", "--bloom-50"],
  ["bg-moss-100", "background-color", "--moss-100"],
  ["text-sun-700", "color", "--sun-700"],
  ["bg-sky-300", "background-color", "--sky-300"],
  ["text-lilac-600", "color", "--lilac-600"],
  ["text-cat-hazard", "color", "--cat-hazard"],
  ["bg-cleanup", "background-color", "--cat-cleanup"],
  ["bg-console-surface", "background-color", "--console-surface"],
  ["bg-console-surface-alt", "background-color", "--console-surface-alt"],
  ["bg-console-tint", "background-color", "--console-tint"],
  ["bg-console-canvas", "background-color", "--console-canvas"],
  ["border-console-line-strong", "border-color", "--console-line-strong"],
  ["bg-console-accent", "background-color", "--console-accent"],
  ["bg-console-scrim", "background-color", "--console-scrim"],
  ["bg-console-toast-surface", "background-color", "--console-toast-surface"],
  ["text-console-toast-ink", "color", "--console-toast-ink"],
  ["text-console-toast-ink-dim", "color", "--console-toast-ink-dim"],
  ["text-console-ink", "color", "--console-ink"],
  ["text-console-ink-2", "color", "--console-ink-2"],
  ["text-console-ink-3", "color", "--console-ink-3"],
  ["bg-console-bloom-soft", "background-color", "--console-hue-bloom-soft"],
  ["text-console-bloom-strong", "color", "--console-hue-bloom-strong"],
  ["bg-console-moss-soft", "background-color", "--console-hue-moss-soft"],
  ["text-console-moss-strong", "color", "--console-hue-moss-strong"],
  ["bg-console-sun-soft", "background-color", "--console-hue-sun-soft"],
  ["text-console-sun-strong", "color", "--console-hue-sun-strong"],
  ["bg-console-sky-soft", "background-color", "--console-hue-sky-soft"],
  ["text-console-sky-strong", "color", "--console-hue-sky-strong"],
  ["bg-console-lilac-soft", "background-color", "--console-hue-lilac-soft"],
  ["text-console-lilac-strong", "color", "--console-hue-lilac-strong"],
] as const

describe("scheme colour utilities stay legal without an opacity modifier", () => {
  let css: CompiledCss

  beforeAll(async () => {
    css = await compileGlobals(SCHEME_UTILITIES.map(([utility]) => utility))
  }, 60_000)

  for (const [utility, prop, variable] of SCHEME_UTILITIES) {
    it(`T21: ${utility} resolves to a bare var(${variable})`, () => {
      expect(resolvedDecl(css, `.${utility}`, prop)).toBe(`var(${variable})`)
    })
  }
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
  const marker = scheme === "light" ? "\n:root {" : "\n.dark {"
  const start = GLOBALS.indexOf(marker)
  expect(start, `globals.css ${scheme} block`).toBeGreaterThan(-1)
  const end = GLOBALS.indexOf("\n}", start)
  return GLOBALS.slice(start, end)
}

function readTriplet(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`))
  expect(match, name).not.toBeNull()
  return (match?.[1] ?? "").trim()
}

describe("globals.css shadcn surfaces mirror @civfix/tokens in BOTH schemes", () => {
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

type Season = "none" | "christmas"

function ruleBodies(selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return [...CSS.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))].map(
    (m) => m[1] ?? "",
  )
}

/** The custom properties :root ends up with, applied in the order the cascade ranks the blocks. */
function rootVars(scheme: ColorSchemeName, season: Season): Map<string, string> {
  const selectors = [":root", ...(scheme === "dark" ? [":root.dark"] : [])]
  if (season !== "none") {
    selectors.push(`:root[data-season="${season}"]`)
    if (scheme === "dark") selectors.push(`:root.dark[data-season="${season}"]`)
  }
  const vars = new Map<string, string>()
  for (const selector of selectors) {
    for (const body of ruleBodies(selector)) {
      for (const m of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
        vars.set(m[1] as string, (m[2] as string).trim())
      }
    }
  }
  return vars
}

function resolveValue(value: string, vars: Map<string, string>): string {
  const ref = /^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([\s\S]*))?\)$/i.exec(value.trim())
  if (!ref) return value.trim().toUpperCase()
  const name = ref[1] as string
  const own = vars.get(name)
  if (own !== undefined) return resolveValue(own, vars)
  expect(ref[2], `${name} is unset and has no fallback`).toBeDefined()
  return resolveValue(ref[2] ?? "", vars)
}

describe("design.css season blocks", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`T12: the ${scheme} christmas logo and hat variables resolve to seasonLook`, () => {
      const look = seasonLook("christmas")
      expect(look).not.toBeNull()
      const vars = rootVars(scheme, "christmas")
      const letters = look?.wordmark[scheme] ?? []
      expect(letters).toHaveLength(6)
      letters.forEach((hex, i) => {
        expect(resolveValue(`var(--logo-${i + 1})`, vars), `--logo-${i + 1}`).toBe(
          hex.toUpperCase(),
        )
      })
      const hat = look?.hat?.[scheme]
      expect(hat).toBeDefined()
      expect(resolveValue("var(--hat-felt)", vars)).toBe(hat?.felt.toUpperCase())
      expect(resolveValue("var(--hat-trim)", vars)).toBe(hat?.trim.toUpperCase())
      expect(resolveValue("var(--hat-edge)", vars)).toBe(hat?.edge.toUpperCase())
    })

    it(`T13: with no season the ${scheme} letters keep today's colors`, () => {
      const vars = rootVars(scheme, "none")
      const today = ["bloom", "sun-600", "moss", "sky", "lilac", "bloom"]
      today.forEach((name, i) => {
        const [body] = ruleBodies(`.cf-logo .s${i + 1}`)
        const color = /(?:^|[\s;])color:\s*([^;]+);/.exec(body ?? "")?.[1]
        expect(color, `.s${i + 1} color`).toBeDefined()
        const expected = resolveValue(`var(--${name})`, vars)
        expect(expected).toMatch(/^#[0-9A-F]{6}$/)
        expect(resolveValue(color ?? "", vars), `.s${i + 1}`).toBe(expected)
      })
    })
  }
})
