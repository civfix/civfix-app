import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const FLOW_DIR = fileURLToPath(new URL("..", import.meta.url))
const BODY = fileURLToPath(new URL("../../ReportFlowBody.tsx", import.meta.url))

/**
 * Every source file the report wizard renders from, body first, so a guard cannot miss a split-out part and
 * a first-occurrence anchor still lands in the body's own JSX.
 */
export function reportFlowSourceFiles(): string[] {
  const parts = readdirSync(FLOW_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(FLOW_DIR, entry.name))
    .sort()
  return [BODY, ...parts]
}

export function reportFlowSource(): string {
  return reportFlowSourceFiles()
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
}

export function reportFlowPart(name: string): string {
  return readFileSync(join(FLOW_DIR, name), "utf8")
}
