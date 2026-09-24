import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../..")

const SCAN_ROOTS = [
  "packages/ui/src",
  "apps/community-web/src",
  "apps/community-web/functions",
  "apps/community-mobile/src",
  "apps/community-mobile/app",
]

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]

const BANNED = [/ipLocate\s*\(/, /geojs(?!on)/i]

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

describe("no client asks a third party where the viewer is", () => {
  it("scans every consumer-plane source root", () => {
    const files = scannedFiles().map((file) => relative(repoRoot, file))
    expect(files.filter((rel) => !isTest(rel)).length).toBeGreaterThan(400)
    expect(files).toContain("packages/ui/src/bodies/ReportFlowBody.tsx")
    expect(files).toContain("packages/ui/src/bodies/AddressSearch.tsx")
    expect(files).toContain("packages/ui/src/bodies/CreateCleanupBody.tsx")
    expect(files).toContain("packages/ui/src/data/hooks/location.ts")
  })

  it("calls ipLocate() nowhere and names geojs nowhere", () => {
    const offenders: string[] = []
    for (const file of scannedFiles()) {
      const rel = relative(repoRoot, file)
      if (isTest(rel)) continue
      const code = stripComments(readFileSync(file, "utf8"))
      if (BANNED.some((pattern) => pattern.test(code))) offenders.push(rel)
    }
    expect(offenders).toEqual([])
  })

  it("routes the approximate point through the typed client instead", () => {
    const helper = readFileSync(join(repoRoot, "packages/ui/src/data/fetchApproximateLocation.ts"), "utf8")
    expect(helper).toContain("api.getApproximateLocation({})")
    expect(helper).toContain("queryKeys.approximateLocation")
    for (const rel of [
      "packages/ui/src/bodies/ReportFlowBody.tsx",
      "packages/ui/src/bodies/AddressSearch.tsx",
      "packages/ui/src/data/hooks/location.ts",
    ]) {
      expect(readFileSync(join(repoRoot, rel), "utf8")).toContain("fetchApproximateLocation(api, qc)")
    }
    expect(readFileSync(join(repoRoot, "packages/ui/src/bodies/CreateCleanupBody.tsx"), "utf8")).toContain("useUserLocation()")
  })
})
