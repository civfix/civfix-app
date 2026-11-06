import { readdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import postcss from "postcss"
import type { ChildNode } from "postcss"
import { describe, expect, it } from "vitest"

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url))
const require = createRequire(import.meta.url)

/** Tailwind's own reset and the @font-face list hold no rule that competes with a utility. */
const EXEMPT = new Set(["app/globals.css", "styles/contract-fonts.css"])

/** design.css's iOS focus-zoom floor has to beat react-native-web's unlayered TextInput styles. */
const UNLAYERED_ON_PURPOSE = new Set(["styles/design.css: @media (pointer: coarse)"])

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function resolveImport(from: string, specifier: string): string {
  if (specifier.startsWith("@/")) return join(SRC_DIR, specifier.slice(2))
  if (specifier.startsWith(".")) return resolve(dirname(from), specifier)
  return require.resolve(specifier)
}

/** Every stylesheet a module in src/ imports, as a path relative to src/. */
function importedStylesheets(): string[] {
  const found = new Set<string>()
  for (const file of sourceFiles(SRC_DIR)) {
    for (const match of readFileSync(file, "utf8").matchAll(/^import\s+["']([^"']+\.css)["']/gm)) {
      found.add(relative(SRC_DIR, resolveImport(file, match[1] ?? "")))
    }
  }
  return [...found].sort()
}

interface CssImport {
  readonly from: string
  readonly specifier: string
  readonly params: string
}

/** The `@import`s of `.css` files in the stylesheets src/ imports. */
function cssImports(sheets: readonly string[]): CssImport[] {
  return sheets.flatMap((sheet) => {
    const imports: CssImport[] = []
    postcss.parse(readFileSync(join(SRC_DIR, sheet), "utf8")).walkAtRules("import", (node) => {
      const specifier = /^["']([^"']+)["']/.exec(node.params.trim())?.[1] ?? ""
      if (specifier.endsWith(".css")) imports.push({ from: sheet, specifier, params: node.params })
    })
    return imports
  })
}

function describeNode(node: ChildNode): string {
  if (node.type === "rule") return node.selector
  if (node.type === "atrule") return `@${node.name} ${node.params}`.trim()
  if (node.type === "decl") return node.prop
  return node.type
}

/** What a stylesheet holds outside its one `@layer utilities` block, as `file: selector`. */
function unlayered(sheet: string): string[] {
  const nodes = postcss
    .parse(readFileSync(join(SRC_DIR, sheet), "utf8"))
    .nodes.filter((node) => node.type !== "comment")
  const layers = nodes.filter(
    (node) => node.type === "atrule" && node.name === "layer" && node.params.trim() === "utilities",
  )
  const outside = nodes.filter((node) => !layers.includes(node)).map(describeNode)
  const extraLayers = layers.slice(1).map(() => "a second @layer utilities block")
  return [...outside, ...extraLayers].map((what) => `${sheet}: ${what}`)
}

describe("every stylesheet the app imports sits in Tailwind's layers", () => {
  const sheets = importedStylesheets()

  it("T20: finds the page stylesheets by scanning src/", () => {
    expect(sheets).toEqual([
      "app/e/signup.css",
      "app/globals.css",
      "app/legal/legal.css",
      "app/not-found.css",
      "app/orgs/org-page.css",
      "app/service-record/service-record.css",
      "app/unsubscribe/unsubscribe.css",
      "styles/contract-fonts.css",
      "styles/design.css",
    ])
  })

  it("T20: each holds all of its rules in one @layer utilities block", () => {
    const offenders = sheets
      .filter((sheet) => !EXEMPT.has(sheet))
      .flatMap(unlayered)
      .filter((offender) => !UNLAYERED_ON_PURPOSE.has(offender))
    expect(offenders).toEqual([])
  })

  it("T20: the iOS focus-zoom floor stays outside the layers", () => {
    expect(unlayered("styles/design.css")).toEqual([...UNLAYERED_ON_PURPOSE])
  })

  it("T20: maplibre-gl.css is imported into the base layer", () => {
    const maplibre = cssImports(sheets).filter((entry) =>
      entry.specifier.endsWith("maplibre-gl.css"),
    )
    expect(maplibre.map((entry) => entry.from)).toEqual(["app/globals.css"])
    expect(maplibre[0]?.params).toMatch(/\slayer\(base\)$/)
  })

  it("T20: any other imported stylesheet is layered or holds only theme variables", () => {
    const offenders = cssImports(sheets)
      .filter((entry) => !/\slayer\([\w-]+\)$/.test(entry.params))
      .flatMap((entry) => {
        const path = resolveImport(join(SRC_DIR, entry.from), entry.specifier)
        return postcss
          .parse(readFileSync(path, "utf8"))
          .nodes.filter(
            (node) => node.type !== "comment" && !(node.type === "atrule" && node.name === "theme"),
          )
          .map((node) => `${entry.specifier}: ${describeNode(node)}`)
      })
    expect(offenders).toEqual([])
  })
})
