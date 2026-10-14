import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const DETAIL_DIR = fileURLToPath(new URL("..", import.meta.url))
const BODY = fileURLToPath(new URL("../../ReportDetailBody.tsx", import.meta.url))

/** Every source file the report detail surface renders from, so a guard cannot miss a split-out part. */
export function reportDetailSourceFiles(): string[] {
  const parts = readdirSync(DETAIL_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(DETAIL_DIR, entry.name))
    .sort()
  return [BODY, ...parts]
}

export function reportDetailSource(): string {
  return reportDetailSourceFiles()
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
}
