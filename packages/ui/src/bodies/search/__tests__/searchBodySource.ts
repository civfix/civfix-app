import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const SEARCH_DIR = fileURLToPath(new URL("..", import.meta.url))
const BODY = fileURLToPath(new URL("../../SearchBody.tsx", import.meta.url))

/** Every source file the search page renders from, so a guard cannot miss a split-out part. */
export function searchBodySourceFiles(): string[] {
  const parts = readdirSync(SEARCH_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(SEARCH_DIR, entry.name))
    .sort()
  return [BODY, ...parts]
}

export function searchBodySource(): string {
  return searchBodySourceFiles()
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
}

export function searchPart(name: string): string {
  return readFileSync(join(SEARCH_DIR, name), "utf8")
}
