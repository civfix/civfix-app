import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const PART_DIR = fileURLToPath(new URL("..", import.meta.url))
const CARD = fileURLToPath(new URL("../../ServiceHoursCertificateCard.tsx", import.meta.url))

/** Every source file the transcript card renders from, so a guard cannot miss a split-out part. */
export function certificateCardSourceFiles(): string[] {
  const parts = readdirSync(PART_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(PART_DIR, entry.name))
    .sort()
  return [CARD, ...parts]
}

export function certificateCardSource(): string {
  return certificateCardSourceFiles()
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
}
