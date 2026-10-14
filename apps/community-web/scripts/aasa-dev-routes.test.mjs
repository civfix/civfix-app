import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { DEV_ONLY_ROUTES } from "./postbuild-gates.mjs"

const association = JSON.parse(
  readFileSync(
    join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", ".well-known", "apple-app-site-association"),
    "utf8",
  ),
)

describe("AASA and the dev galleries", () => {
  // The galleries never reach a production export, so an exclude for them only advertises their names.
  it("carries no exclude for a dev-only route", () => {
    const paths = association.applinks.details.flatMap((detail) => detail.components.map((c) => c["/"]))
    for (const route of DEV_ONLY_ROUTES) {
      expect(paths.filter((path) => path.startsWith(`/${route}`))).toEqual([])
    }
  })
})
