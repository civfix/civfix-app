import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("./signup.css", import.meta.url), "utf8")

function rule(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  if (start === -1) return ""
  return source.slice(start, source.indexOf("}", start))
}

function narrowBlock(): string {
  const start = css.indexOf("@media (max-width: 380px)")
  expect(start).toBeGreaterThan(-1)
  return css.slice(start)
}

describe("signup page full-bleed hero", () => {
  it("cancels exactly the shell gutter at every width (no sideways scroll on narrow phones)", () => {
    const hero = rule(css, ".signup-hero")
    const shell = rule(css, ".signup-shell")
    expect(hero).toContain("margin: 0 calc(var(--signup-gutter) * -1)")
    expect(shell).toContain("padding: 0 var(--signup-gutter)")

    const narrowShell = rule(narrowBlock(), ".signup-shell")
    expect(narrowShell).not.toMatch(/padding(-left|-right)?\s*:/)
    expect(narrowShell).toContain("--signup-gutter:")
    expect(rule(narrowBlock(), ".signup-hero")).not.toMatch(/margin\s*:/)
  })
})
