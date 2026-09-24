import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const PERSON_DIR = fileURLToPath(new URL("..", import.meta.url))
const BODY = fileURLToPath(new URL("../../PersonDetailBody.tsx", import.meta.url))

/** Every source file another person's profile renders from, so a guard cannot miss a split-out part. */
export function personDetailSourceFiles(): string[] {
  const parts = readdirSync(PERSON_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(PERSON_DIR, entry.name))
    .sort()
  return [BODY, ...parts]
}

export function personDetailSource(): string {
  return personDetailSourceFiles()
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
}

export function personDetailPart(name: string): string {
  return readFileSync(join(PERSON_DIR, name), "utf8")
}
