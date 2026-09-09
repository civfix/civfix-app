import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("./contract-fonts.css", import.meta.url), "utf8")
const fontRoot = new URL("../../public/fonts/", import.meta.url)

const HANKEN_ASSET = 'url("/fonts/HankenGrotesk_Variable.woff2") format("woff2")'

const UI_ALIAS_WEIGHTS = [
  ["HankenGrotesk_400Regular", 400],
  ["HankenGrotesk_500Medium", 500],
  ["HankenGrotesk_600SemiBold", 600],
  ["HankenGrotesk_700Bold", 700],
  ["HankenGrotesk_800ExtraBold", 800],
  ["BricolageGrotesque_400Regular", 400],
  ["BricolageGrotesque_500Medium", 500],
  ["BricolageGrotesque_600SemiBold", 600],
  ["BricolageGrotesque_700Bold", 700],
  ["Manrope_400Regular", 400],
  ["Manrope_500Medium", 500],
  ["Manrope_600SemiBold", 600],
  ["Manrope_700Bold", 700],
  ["Manrope_800ExtraBold", 800],
] as const

function fontFaceDeclarations(family: string): Map<string, string> {
  const block = css
    .match(/@font-face\s*{[^}]+}/g)
    ?.find((candidate) => candidate.includes(`font-family: "${family}"`))

  if (!block) throw new Error(`Missing @font-face for ${family}`)

  return new Map(
    block
      .slice(block.indexOf("{") + 1, -1)
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separator = declaration.indexOf(":")
        return [declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim()]
      }),
  )
}

describe("web font contract", () => {
  it.each(UI_ALIAS_WEIGHTS)("maps %s to explicit Hanken weight %i", (family, weight) => {
    const declarations = fontFaceDeclarations(family)

    expect(declarations.get("font-weight")).toBe(String(weight))
    expect(declarations.get("src")).toBe(HANKEN_ASSET)
  })

  it("pins the vendored Hanken Grotesk bytes and distributes their OFL provenance", () => {
    const font = readFileSync(new URL("HankenGrotesk_Variable.woff2", fontRoot))
    const license = readFileSync(new URL("HankenGrotesk-OFL.txt", fontRoot), "utf8")
    const provenance = readFileSync(new URL("HankenGrotesk-PROVENANCE.md", fontRoot), "utf8")

    expect(createHash("sha256").update(font).digest("hex")).toBe(
      "1f21c6eaa0000f3329cfcfac966b43d5bebf5aa610303e33294ac31bc6f4bb59",
    )
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1")
    expect(provenance).toContain(
      "https://fonts.gstatic.com/s/hankengrotesk/v12/ieVn2YZDLWuGJpnzaiwFXS9tYtpd59CxCis4.woff2",
    )
    expect(provenance).toContain(
      "1f21c6eaa0000f3329cfcfac966b43d5bebf5aa610303e33294ac31bc6f4bb59",
    )
    expect(provenance).toContain(
      "https://github.com/marcologous/hanken-grotesk/tree/1ab416e82130b2d3ddb7710abf7ceabf07156a13",
    )
    expect(provenance).toContain(
      "https://raw.githubusercontent.com/marcologous/hanken-grotesk/1ab416e82130b2d3ddb7710abf7ceabf07156a13/OFL.txt",
    )
  })
})
