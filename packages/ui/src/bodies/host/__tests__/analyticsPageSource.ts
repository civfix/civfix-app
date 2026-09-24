import { readdirSync, readFileSync } from "node:fs"

const SECTIONS = new URL("../analytics/", import.meta.url)

export function analyticsPageSource(): string {
  const sections = readdirSync(SECTIONS)
    .filter((name) => /\.tsx?$/.test(name))
    .sort()
    .map((name) => readFileSync(new URL(name, SECTIONS), "utf8"))
  return [readFileSync(new URL("../EventAnalyticsBody.tsx", import.meta.url), "utf8"), ...sections].join("\n")
}
