import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { sourceLink } from "@civfix/ui/helpers"
import { SOURCE } from "./source"

const uiExternalUrls = readFileSync(
  fileURLToPath(new URL("../../../../packages/ui/src/primitives/externalUrls.ts", import.meta.url)),
  "utf8",
)

describe("the source link on the server-rendered legal pages", () => {
  it("is the shared UI's own source-link rule, so the two links can never diverge", () => {
    expect(uiExternalUrls).toContain('SOURCE_REPO_URL, sourceLink } from "../helpers"')
    expect(SOURCE).toEqual(sourceLink(process.env.NEXT_PUBLIC_COMMIT_SHA))
  })
})
