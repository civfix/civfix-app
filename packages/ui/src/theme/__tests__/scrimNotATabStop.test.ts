import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const SRC = fileURLToPath(new URL("../../", import.meta.url))
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) {
      if (name !== "__tests__" && name !== "__snapshots__") tsxFiles(abs, out)
    } else if (name.endsWith(".tsx")) {
      out.push(abs.slice(SRC.length))
    }
  }
  return out
}

const SCRIM_STYLE =
  /style=\{(?:styles\.(?:scrim|scrimTouch|backdrop|backdropTouch|backdropWeb|menuBackdrop|confirmBackdrop))\}/

const NATIVE_ONLY = (rel: string) => rel.endsWith(".native.tsx")

function pressables(src: string): string[] {
  const out: string[] = []
  const OPEN = "<Pressable"
  for (let i = src.indexOf(OPEN); i !== -1; i = src.indexOf(OPEN, i + 1)) {
    if (/[A-Za-z0-9_]/.test(src[i + OPEN.length] ?? "")) continue
    let depth = 0
    for (let j = i + OPEN.length; j < src.length; j++) {
      const ch = src[j]
      if (ch === "{") depth++
      else if (ch === "}") depth--
      else if (ch === ">" && depth === 0) {
        if (src[j - 1] === "/") out.push(src.slice(i, j + 1))
        break
      }
    }
  }
  return out
}

const files = tsxFiles(SRC).filter((rel) => !NATIVE_ONLY(rel))

describe("every modal/sheet scrim opts out of the tab order on web", () => {
  const sites: { rel: string; el: string }[] = []
  for (const rel of files) {
    for (const el of pressables(strip(read(rel)))) {
      if (SCRIM_STYLE.test(el)) sites.push({ rel, el })
    }
  }

  it("finds every dismiss-layer Pressable in the package", () => {
    expect(sites.length).toBeGreaterThanOrEqual(10)
    expect(sites.filter((s) => s.rel.endsWith("primitives/AnchoredActionSheet.tsx"))).toHaveLength(2)
  })

  it.each(sites.map((s, i) => [`${s.rel} #${i}`, s] as const))("%s spreads webScrimProps", (_name, site) => {
    expect(site.el).toMatch(/\{\.\.\.webScrimProps\}/)
  })

  it("BrandAboutCard's absoluteFill scrim is covered too", () => {
    const src = strip(read("primitives/BrandAboutCard.tsx"))
    const el = pressables(src).find((e) => /style=\{StyleSheet\.absoluteFill\}/.test(e))
    expect(el).toBeDefined()
    expect(el).toMatch(/\{\.\.\.webScrimProps\}/)
  })

  it("every file that renders a scrim imports the helper", () => {
    for (const rel of new Set(sites.map((s) => s.rel))) {
      expect(strip(read(rel)), rel).toMatch(/webScrimProps/)
    }
  })
})

describe("webScrimProps stays strong enough to actually work", () => {
  const src = strip(read("theme/webAffordances.ts"))
  const decl = /export const webScrimProps[\s\S]*?\n\n/.exec(`${src}\n\n`)?.[0] ?? ""

  it("is web-gated, like every other affordance in the module", () => {
    expect(decl).toMatch(/isWeb\s*\?/)
    expect(decl).toMatch(/:\s*\{\}/)
  })

  it("drops the button role, so RNW renders an unfocusable div rather than a <button>", () => {
    expect(decl).toMatch(/role:\s*"none"/)
  })

  it("emits NO tabindex (tabIndex: null), not tabindex=-1", () => {
    expect(decl).toMatch(/tabIndex:\s*null/)
    expect(decl).not.toMatch(/tabIndex:\s*-1/)
  })

  it("hides the scrim - and only the scrim - from assistive tech", () => {
    expect(decl).toMatch(/"aria-hidden":\s*true/)
    expect(src).not.toMatch(/importantForAccessibility:\s*"no-hide-descendants"/)
  })
})
