import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  aasaExcludeOrder,
  DEV_ONLY_ROUTES,
  leakedDevRoutes,
  missingAasaExcludes,
  REQUIRED_AASA_EXCLUDES,
  spaFallbackGaps,
} from "./postbuild-gates.mjs"
import { pageExtensionsFor } from "../next.config.mjs"

const appDir = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const publicDir = join(appDir, "public")

const redirects = readFileSync(join(publicDir, "_redirects"), "utf8")
const association = JSON.parse(
  readFileSync(join(publicDir, ".well-known", "apple-app-site-association"), "utf8"),
)

describe("SPA-fallback completeness gate", () => {
  it("passes for the committed _redirects and the routes that ship a placeholder shell", () => {
    const shipped = ["pin", "cleanups", "people", "messages", "groups", "channels", "post", "compose", "leaderboard", "service-record", "manage", "e", "orgs"]
    expect(spaFallbackGaps(shipped, redirects)).toEqual([])
  })

  it("names a shell with no rule, which would 404 every deep link under it", () => {
    expect(spaFallbackGaps(["pin", "campaigns"], redirects)).toEqual(["campaigns"])
  })

  it("does not accept a protective /<route>/ rule as a deep-link fallback", () => {
    const onlyProtective = "/orgs/   /__spa/orgs/   200\n"
    expect(spaFallbackGaps(["orgs"], onlyProtective)).toEqual(["orgs"])
  })

  it("ignores comments", () => {
    expect(spaFallbackGaps(["orgs"], "# /orgs/*   /orgs/_/   200\n")).toEqual(["orgs"])
  })
})

describe("AASA gate", () => {
  it("requires exactly the web-only paths that must never open the app", () => {
    expect(REQUIRED_AASA_EXCLUDES).toEqual([
      "/legal/*",
      "/service-record/*",
      "/guest*",
      "/claim*",
      "/manage*",
      "/e/*",
      "/unsubscribe*",
    ])
  })

  it("passes for the committed association file", () => {
    expect(missingAasaExcludes(association, REQUIRED_AASA_EXCLUDES)).toEqual([])
    expect(aasaExcludeOrder(association).ok).toBe(true)
  })

  it("names a missing exclude", () => {
    expect(missingAasaExcludes(association, ["/nope*"])).toEqual(["/nope*"])
  })

  it("fails when an exclude sits AFTER the catch-all, where iOS never reaches it", () => {
    const broken = {
      applinks: {
        details: [
          {
            components: [{ "/": "/*" }, { "/": "/nope/*", exclude: true }],
          },
        ],
      },
    }
    const verdict = aasaExcludeOrder(broken)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toContain("exclude-after-catch-all")
    expect(verdict.lateExcludes).toEqual(["/nope/*"])
  })

  it("fails when there is no catch-all at all", () => {
    expect(aasaExcludeOrder({ applinks: { details: [{ components: [] }] } }).ok).toBe(false)
    expect(aasaExcludeOrder({}).reason).toBe("no-components")
  })

  it("checks EVERY appID entry, not just the first", () => {
    const association = {
      applinks: {
        details: [
          { components: [{ "/": "/nope/*", exclude: true }, { "/": "/*" }] },
          { components: [{ "/": "/*" }, { "/": "/nope/*", exclude: true }] },
        ],
      },
    }
    const verdict = aasaExcludeOrder(association)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toContain("details[1]")
    expect(missingAasaExcludes(association, ["/manage*"])).toEqual(["/manage*"])
  })
})

describe("dev-only gallery routes", () => {
  it("flags a gallery that reached the export, as a directory or a flat html file", () => {
    expect(leakedDevRoutes(["index.html", "bodies", "map", "skeleton.html", "_next"])).toEqual([
      "bodies",
      "skeleton",
    ])
    expect(leakedDevRoutes(["index.html", "map", "legal"])).toEqual([])
  })

  it("are routes only under the dev server, never in a production build", () => {
    expect(pageExtensionsFor("phase-development-server")).toContain("dev.tsx")
    expect(pageExtensionsFor("phase-production-build")).not.toContain("dev.tsx")
  })

  it("exist only as page.dev.tsx / layout.dev.tsx so a production export cannot pick them up", () => {
    for (const route of DEV_ONLY_ROUTES) {
      const dir = join(appDir, "src", "app", route)
      expect(existsSync(join(dir, "page.dev.tsx")), route).toBe(true)
      for (const ext of pageExtensionsFor("phase-production-build")) {
        expect(existsSync(join(dir, `page.${ext}`)), `${route}/page.${ext}`).toBe(false)
        expect(existsSync(join(dir, `layout.${ext}`)), `${route}/layout.${ext}`).toBe(false)
      }
    }
  })
})
