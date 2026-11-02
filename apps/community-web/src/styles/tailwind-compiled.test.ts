import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { tokens } from "@civfix/tokens"
import { beforeAll, describe, expect, it } from "vitest"
import type { CompiledCss, CompiledRule } from "./compiled-css"
import { compileGlobals, resolvedDecl, resolveTheme, rulesFor } from "./compiled-css"
import { Z_LAYERS } from "./z-layers"

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url))

function read(relative: string): string {
  return readFileSync(join(SRC_DIR, relative), "utf8")
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : []
  })
}

/** The arbitrary-value classes that read a spacing token, as written in each file. */
function tokenArbitraryClasses(relative: string, utility: string): string[] {
  const pattern = new RegExp(`(?<![\\w-])${utility}-\\[[^\\]\\s"]*token-\\d+[^\\]\\s"]*\\]`, "g")
  return [...read(relative).matchAll(pattern)].map((match) => match[0])
}

const T17_CLASSES = {
  top: tokenArbitraryClasses("components/console/overlay/overlay.tsx", "top"),
  bottom: tokenArbitraryClasses("components/console/overlay/overlay.tsx", "bottom"),
  maxW: tokenArbitraryClasses("components/console/table/bulk-bar.tsx", "max-w"),
  w: tokenArbitraryClasses("components/console/overlay/toast.tsx", "w"),
}

const Z_KEYS = Object.keys(Z_LAYERS) as (keyof typeof Z_LAYERS)[]

const CANDIDATES = [
  "rounded-xs",
  "rounded-sm",
  "rounded-md",
  "rounded",
  ...Z_KEYS.map((key) => `z-${key}`),
  "duration-d1",
  "duration-d2",
  "duration-d3",
  "duration-d4",
  "ease-out",
  "animate-in",
  "hover:bg-transparent",
  "border",
  "container",
  "bg-paper",
  "text-ink-2",
  "border-console-line",
  "bg-primary",
  "border-border",
  "ring-ring",
  "bg-paper/95",
  "font-mono",
  "font-display",
  "font-body",
  "font-sans",
  "fade-in",
  "zoom-in-95",
  "slide-in-from-bottom",
  "slide-in-from-bottom-2",
  "slide-in-from-bottom-4",
  "slide-in-from-right",
  "focus-visible:outline-hidden",
  "bg-linear-to-l",
  "bg-linear-to-r",
  "backdrop-blur-xs",
  "backdrop-blur-sm",
  ...Object.values(T17_CLASSES).flat(),
]

let css: CompiledCss

beforeAll(async () => {
  css = await compileGlobals(CANDIDATES)
}, 60_000)

function unescapeSelector(selector: string): string {
  return selector
    .replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/\\(.)/g, "$1")
}

/** The rules a class generates outside any at-rule, matched on the unescaped selector. */
function classRules(className: string): CompiledRule[] {
  return css.rules.filter(
    (rule) => rule.atRules.length === 0 && unescapeSelector(rule.selector) === `.${className}`,
  )
}

function classDecl(className: string, prop: string): string | undefined {
  const values = classRules(className).flatMap((rule) => {
    const value = rule.decls.get(prop)
    return value === undefined ? [] : [resolveTheme(css, value)]
  })
  return values.at(-1)
}

/** Drops `@theme { … }` and `@theme inline { … }` blocks, where Tailwind's own theme variables live. */
function withoutThemeBlocks(source: string): string {
  return source.replace(/@theme\b[^{;]*\{[^}]*\}/g, "")
}

/** Multiplies out `calc(<n> * <length>)`, the form Tailwind 4 writes spacing steps in. */
function evaluateCalc(value: string): string {
  return value.replace(
    /calc\(\s*(-?[\d.]+)\s*\*\s*(-?[\d.]+)(rem|px|%)\s*\)/g,
    (_, factor: string, amount: string, unit: string) =>
      `${String(Number(factor) * Number(amount))}${unit}`,
  )
}

const compact = (value: string | undefined): string | undefined => value?.replace(/\s+/g, "")

function baseRules(): CompiledRule[] {
  return css.rules.filter((rule) => rule.layer === "base" && rule.atRules.length === 0)
}

function selectorList(rule: CompiledRule): string[] {
  return rule.selector.split(/,(?![^(]*\))/).map((part) => part.trim().replaceAll("'", '"'))
}

describe("Tailwind 4 compiles today's utilities", () => {
  it("T6: rounded-xs, rounded-sm, rounded-md and bare rounded keep their radii", () => {
    expect(resolvedDecl(css, ".rounded-xs", "border-radius")).toBe("6px")
    expect(resolvedDecl(css, ".rounded-sm", "border-radius")).toBe("10px")
    expect(resolvedDecl(css, ".rounded-md", "border-radius")).toBe("14px")
    expect(resolvedDecl(css, ".rounded", "border-radius")).toBe("0.25rem")
  })

  it("T7: one z-<layer> utility per Z_LAYERS key, at its value", () => {
    for (const key of Z_KEYS) {
      const rules = rulesFor(css, `.z-${key}`)
      expect(rules, `z-${key}`).toHaveLength(1)
      expect(rules[0]?.decls.get("z-index"), `z-${key}`).toBe(String(Z_LAYERS[key]))
    }
  })

  it("T8: duration-d1..d4 set the transition duration and the --tw-duration animate-in reads", () => {
    for (const step of ["d1", "d2", "d3", "d4"] as const) {
      const expected = `${String(tokens.motion.dur[step])}ms`
      expect(resolvedDecl(css, `.duration-${step}`, "transition-duration"), step).toBe(expected)
      expect(resolvedDecl(css, `.duration-${step}`, "--tw-duration"), step).toBe(expected)
    }
    expect(resolvedDecl(css, ".animate-in", "animation")).toContain("var(--tw-duration")
  })

  it("T9: ease-out sets the timing function and the --tw-ease animate-in reads", () => {
    expect(resolvedDecl(css, ".ease-out", "transition-timing-function")).toBe(
      "cubic-bezier(0.22,1,0.36,1)",
    )
    expect(resolvedDecl(css, ".ease-out", "--tw-ease")).toBe("cubic-bezier(0.22,1,0.36,1)")
  })

  it("T10: buttons keep the pointer cursor and disabled controls the default one, in that order", () => {
    const rules = baseRules()
    const pointer = rules.findIndex(
      (rule) =>
        rule.decls.get("cursor") === "pointer" &&
        selectorList(rule).includes("button") &&
        selectorList(rule).includes('[role="button"]'),
    )
    const disabled = rules.findIndex(
      (rule) => rule.decls.get("cursor") === "default" && selectorList(rule).includes(":disabled"),
    )
    expect(pointer, "button, [role=button] { cursor: pointer }").toBeGreaterThan(-1)
    expect(disabled, ":disabled { cursor: default }").toBeGreaterThan(pointer)
  })

  it("T11: hover: applies on any :hover, not only inside a hover media query", () => {
    const rules = rulesFor(css, ".hover\\:bg-transparent:hover")
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      expect(rule.atRules.map((at) => at.replace(/\s+/g, ""))).not.toContain("media(hover:hover)")
    }
  })

  it("T12: unclassed borders keep today's colours, and .border is 1px solid", () => {
    const rules = baseRules()
    const gray = rules.findIndex(
      (rule) =>
        rule.decls.get("border-color") === "#e5e7eb" &&
        selectorList(rule).includes("::before") &&
        selectorList(rule).includes("::after"),
    )
    const themed = rules.findIndex(
      (rule) =>
        selectorList(rule).includes("*") &&
        resolveTheme(css, rule.decls.get("border-color") ?? "") === "hsl(var(--shadcn-border))",
    )
    expect(gray, "::before, ::after { border-color: #e5e7eb }").toBeGreaterThan(-1)
    expect(themed, "* { border-color: hsl(var(--shadcn-border)) }").toBeGreaterThan(gray)
    expect(resolvedDecl(css, ".border", "border-width")).toBe("1px")
    expect(resolvedDecl(css, ".border", "border-style")).toBe("solid")
  })

  it("T13: input and textarea placeholders stay opaque gray", () => {
    const placeholder = baseRules().find(
      (rule) =>
        selectorList(rule).includes("input::placeholder") &&
        selectorList(rule).includes("textarea::placeholder") &&
        rule.decls.has("color"),
    )
    expect(placeholder?.decls.get("color")).toBe("#9ca3af")
    expect(placeholder?.decls.get("opacity")).toBe("1")
  })

  it("keeps Tailwind 3's text-field look on search inputs", () => {
    const search = baseRules().find((rule) => selectorList(rule).includes('[type="search"]'))
    expect(search?.decls.get("-webkit-appearance")).toBe("textfield")
    expect(search?.decls.get("outline-offset")).toBe("-2px")
  })

  it("T14: container is centred, padded by space[4] and capped at each breakpoint", () => {
    const decl = (prop: string): string | undefined => resolvedDecl(css, ".container", prop)
    expect(decl("width")).toBe("100%")
    const padding = `${String(tokens.space["4"])}px`
    expect([decl("margin-inline") ?? decl("margin-left"), decl("margin-right") ?? "auto"]).toEqual([
      "auto",
      "auto",
    ])
    expect([
      decl("padding-inline") ?? decl("padding-left"),
      decl("padding-inline") ?? decl("padding-right"),
    ]).toEqual([padding, padding])

    const caps = new Map<number, string>()
    for (const rule of rulesFor(css, ".container")) {
      const media = rule.atRules.at(-1) ?? ""
      const width = /(?:min-width:\s*|width\s*>=\s*)(\d+)px/.exec(media)?.[1]
      const cap = rule.decls.get("max-width")
      if (width !== undefined && cap !== undefined) caps.set(Number(width), resolveTheme(css, cap))
    }
    expect(Object.fromEntries(caps)).toEqual({
      640: "640px",
      768: "768px",
      1024: "1024px",
      1280: "1280px",
      1536: "1536px",
    })
  })

  it("T15: colour utilities read the scheme variables, shadcn ones through hsl()", () => {
    expect(resolvedDecl(css, ".bg-paper", "background-color")).toBe("var(--paper)")
    expect(resolvedDecl(css, ".text-ink-2", "color")).toBe("var(--ink-2)")
    expect(resolvedDecl(css, ".border-console-line", "border-color")).toBe("var(--console-line)")
    expect(resolvedDecl(css, ".bg-primary", "background-color")).toBe("hsl(var(--primary))")
    expect(resolvedDecl(css, ".border-border", "border-color")).toBe("hsl(var(--shadcn-border))")
    expect(resolvedDecl(css, ".ring-ring", "--tw-ring-color")).toBe("hsl(var(--ring))")
    const paper95 = rulesFor(css, ".bg-paper\\/95").flatMap((rule) => {
      const value = rule.decls.get("background-color")
      return value === undefined ? [] : [resolveTheme(css, value)]
    })
    expect(paper95).toContain("color-mix(in oklab, var(--paper) 95%, transparent)")

    const designVars = new Set(
      [...read("styles/design.css").matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] ?? ""),
    )
    const wrapped = css.rules
      .filter((rule) => rule.layer === "utilities")
      .flatMap((rule) =>
        [...rule.decls.values()].flatMap((value) =>
          [...resolveTheme(css, value).matchAll(/hsl\(var\((--[a-z0-9-]+)\)/g)]
            .map((m) => m[1] ?? "")
            .filter((name) => designVars.has(name))
            .map((name) => `${rule.selector}: ${name}`),
        ),
      )
    expect(wrapped).toEqual([])
  })

  it("T16: font utilities read the self-hosted faces, and --font-mono no longer holds a raw name", () => {
    expect(resolvedDecl(css, ".font-mono", "font-family")).toBe(
      "var(--font-mono-face), ui-monospace, SFMono-Regular, monospace",
    )
    expect(resolvedDecl(css, ".font-display", "font-family")).toBe(
      "var(--font-display), ui-sans-serif, system-ui, sans-serif",
    )
    expect(resolvedDecl(css, ".font-body", "font-family")).toBe(
      "var(--font-body), ui-sans-serif, system-ui, sans-serif",
    )
    expect(resolvedDecl(css, ".font-sans", "font-family")).toBe(
      "var(--font-body), ui-sans-serif, system-ui, sans-serif",
    )
    expect(read("app/globals.css")).toMatch(/--font-mono-face:\s*"JetBrainsMono_400Regular";/)
    const declaring = sourceFiles(SRC_DIR).filter((file) =>
      /--font-mono\s*:/.test(withoutThemeBlocks(readFileSync(file, "utf8"))),
    )
    expect(declaring).toEqual([])
  })

  it("T17: the spacing-token arbitrary values resolve to today's lengths", () => {
    expect(T17_CLASSES.top.length).toBeGreaterThan(0)
    expect(T17_CLASSES.bottom.length).toBeGreaterThan(0)
    expect(T17_CLASSES.maxW.length).toBeGreaterThan(0)
    expect(T17_CLASSES.w.length).toBeGreaterThan(0)
    for (const cls of T17_CLASSES.top) {
      expect(compact(classDecl(cls, "top")), cls).toBe("calc(100%+4px)")
    }
    for (const cls of T17_CLASSES.bottom) {
      expect(compact(classDecl(cls, "bottom")), cls).toBe("calc(100%+4px)")
    }
    for (const cls of T17_CLASSES.maxW) {
      expect(compact(classDecl(cls, "max-width")), cls).toBe("calc(100vw-32px)")
    }
    for (const cls of T17_CLASSES.w) {
      expect(compact(classDecl(cls, "width")), cls).toBe("min(360px,calc(100vw-32px))")
    }
  })

  it("T18: the enter animations start from today's offsets", () => {
    const enter = (cls: string, prop: string): string | undefined => {
      const value = resolvedDecl(css, `.${cls}`, prop)
      return value === undefined ? undefined : evaluateCalc(value)
    }
    expect(enter("fade-in", "--tw-enter-opacity")).toBe("0")
    expect([".95", "0.95", "95%"]).toContain(enter("zoom-in-95", "--tw-enter-scale"))
    expect(enter("slide-in-from-bottom", "--tw-enter-translate-y")).toBe("100%")
    expect(enter("slide-in-from-bottom-2", "--tw-enter-translate-y")).toBe("0.5rem")
    expect(enter("slide-in-from-bottom-4", "--tw-enter-translate-y")).toBe("1rem")
    expect(enter("slide-in-from-right", "--tw-enter-translate-x")).toBe("100%")
  })

  it("T19: the renamed classes are in the source and compile, and no rounded-* was renamed", () => {
    const sources = sourceFiles(SRC_DIR)
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")
    expect(sources.match(/focus-visible:outline-none\b/g) ?? []).toEqual([])
    expect((sources.match(/focus-visible:outline-hidden\b/g) ?? []).length).toBe(57)
    expect(rulesFor(css, ".focus-visible\\:outline-hidden:focus-visible").length).toBeGreaterThan(0)

    const dataTable = read("components/console/table/data-table.tsx")
    expect(dataTable).not.toMatch(/bg-gradient-to-[lr]\b/)
    expect(dataTable).toMatch(/\bbg-linear-to-l\b/)
    expect(dataTable).toMatch(/\bbg-linear-to-r\b/)
    expect(resolvedDecl(css, ".bg-linear-to-l", "--tw-gradient-position")).toMatch(/^to left/)
    expect(resolvedDecl(css, ".bg-linear-to-r", "--tw-gradient-position")).toMatch(/^to right/)

    expect(read("components/detail-shell.tsx")).toMatch(/\bbackdrop-blur-xs\b/)
    expect(read("features/host/layout/topbar.tsx")).toMatch(/\bbackdrop-blur-sm\b/)
    expect(resolvedDecl(css, ".backdrop-blur-xs", "--tw-backdrop-blur")).toBe("blur(4px)")
    expect(resolvedDecl(css, ".backdrop-blur-sm", "--tw-backdrop-blur")).toBe("blur(8px)")
  })
})
