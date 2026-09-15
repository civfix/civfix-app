import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../..")

const SCAN_ROOTS = [
  "packages/ui/src",
  "packages/shared/src",
  "apps/community-web/src",
  "apps/community-web/functions",
  "apps/community-mobile/src",
  "apps/community-mobile/app",
]

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]

const BANNED = ["39.8283", "-98.5795", "98.5795"]

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "dist-types") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, out)
      continue
    }
    if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full)
  }
  return out
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
}

function isTest(rel: string): boolean {
  return rel.includes("__tests__") || /\.test\.[cm]?[jt]sx?$/.test(rel)
}

function scannedFiles(): string[] {
  const files: string[] = []
  for (const root of SCAN_ROOTS) {
    const dir = join(repoRoot, root)
    try {
      if (!statSync(dir).isDirectory()) continue
    } catch {
      continue
    }
    walk(dir, files)
  }
  return files
}

describe("the geographic centre of the contiguous US is gone and stays gone", () => {
  it("scans the whole consumer plane", () => {
    const files = scannedFiles().map((file) => relative(repoRoot, file))
    expect(files.filter((rel) => !isTest(rel)).length).toBeGreaterThan(500)
    expect(files).toContain("packages/ui/src/map/Map.web.tsx")
    expect(files).toContain("packages/ui/src/map/Map.native.tsx")
    expect(files).toContain("apps/community-mobile/src/config.ts")
    expect(files).toContain("apps/community-web/src/lib/locate.ts")
  })

  it("contains no 39.8283 / -98.5795 coordinate in any source file", () => {
    const offenders: string[] = []
    for (const file of scannedFiles()) {
      const rel = relative(repoRoot, file)
      if (isTest(rel)) continue
      const code = stripComments(readFileSync(file, "utf8"))
      if (BANNED.some((needle) => code.includes(needle))) offenders.push(rel)
    }
    expect(offenders).toEqual([])
  })
})
