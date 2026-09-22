import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { SOURCE_REPO_URL, sourceLink } from "./source"

const uiExternalUrls = readFileSync(
  fileURLToPath(new URL("../../../../packages/ui/src/primitives/externalUrls.ts", import.meta.url)),
  "utf8",
)

describe("the source link on the server-rendered legal pages", () => {
  it("names the same repository as the shared UI, so the two links can never diverge", () => {
    expect(uiExternalUrls).toContain(`export const SOURCE_REPO_URL = "${SOURCE_REPO_URL}"`)
    expect(sourceLink("abc1234").url).toBe(`${SOURCE_REPO_URL}/tree/abc1234`)
  })

  it("falls back to the repository root and refuses non-sha values", () => {
    expect(sourceLink(undefined)).toEqual({ commit: "", url: SOURCE_REPO_URL })
    for (const bad of ["main", "../x", "abc1234; rm -rf", "g".repeat(40)]) {
      expect(sourceLink(bad), bad).toEqual({ commit: "", url: SOURCE_REPO_URL })
    }
  })
})
