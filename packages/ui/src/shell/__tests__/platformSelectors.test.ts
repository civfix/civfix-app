import { readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const PRUNED = new Set([
  "node_modules",
  "__tests__",
  "ios",
  "android",
  ".expo",
  "dist",
  "dist-types",
  "out",
  ".next",
])
const PACKAGE_ROOT = fileURLToPath(new URL("../../../", import.meta.url))
const ROOTS = [
  fileURLToPath(new URL("../../", import.meta.url)),
  fileURLToPath(new URL("../../../../../apps/community-mobile/", import.meta.url)),
]

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (PRUNED.has(entry.name)) return []
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")
      ? [full]
      : []
  })

interface Variant {
  platform: string
  extension: string
  file: string
}

const groups = new Map<string, Variant[]>()
for (const file of ROOTS.flatMap(walk)) {
  const parsed = /^(.*?)(?:\.(native|web|ios|android))?\.(ts|tsx)$/.exec(
    file.slice(file.lastIndexOf("/") + 1),
  )
  if (!parsed) continue
  const key = join(file.slice(0, file.lastIndexOf("/")), parsed[1] ?? "")
  const bucket = groups.get(key)
  const variant = { platform: parsed[2] ?? "", extension: parsed[3] ?? "", file }
  if (bucket) bucket.push(variant)
  else groups.set(key, [variant])
}

const seams = [...groups.entries()]
  .filter(([, variants]) => variants.some((variant) => variant.platform !== ""))
  .map(([key, variants]) => [relative(PACKAGE_ROOT, key), variants] as const)
  .sort(([a], [b]) => a.localeCompare(b))

describe("I7 a platform seam is never shadowed by its own selector", () => {
  it("finds the seams to check", () => {
    expect(seams.length).toBeGreaterThan(20)
  })

  it.each(seams)("%s", (_name, variants) => {
    const platformExtensions = [
      ...new Set(
        variants.filter((variant) => variant.platform !== "").map((variant) => variant.extension),
      ),
    ]
    expect(platformExtensions).toHaveLength(1)
    const selector = variants.find((variant) => variant.platform === "")
    if (!selector) return
    expect(selector.extension).toBe(platformExtensions[0])
  })
})
