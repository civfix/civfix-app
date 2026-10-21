/**
 * Filing a report needs an account: no client in this repo may file one through the anonymous endpoint.
 * The claim flow for reports filed that way before stays (`/claim`), and so does the endpoint itself.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../..")

const SKIPPED_DIRS = new Set(["node_modules", "dist", ".next", "out"])

// Spelled in two parts so this file does not match its own scan.
const ANON_CREATE = ["anon", "CreateReport"].join("")

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

describe("no anonymous report create", () => {
  it("T3: no file under apps/ or packages/ mentions the anonymous create", () => {
    const files = [...walk(join(repoRoot, "apps"), []), ...walk(join(repoRoot, "packages"), [])]
    expect(files.map((file) => relative(repoRoot, file))).toContain(
      "apps/community-web/src/components/providers.tsx",
    )
    const hits = files
      .filter((file) => readFileSync(file, "utf8").includes(ANON_CREATE))
      .map((file) => relative(repoRoot, file))
    expect(hits).toEqual([])
  })
})
