import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { STAGING_HOSTNAMES } from "@/lib/site-meta"

const html = readFileSync(new URL("../../public/home-turf/index.html", import.meta.url), "utf8")

/**
 * The static /home-turf page is plain HTML with an inline script (no build step inlines the API URL),
 * so the environment is chosen from the hostname at runtime. Run exactly that part of the script
 * against a stubbed `window.location` and read back the endpoint it would POST to.
 */
function endpointFor(hostname: string): string {
  const match = /var STAGING_HOSTNAMES = [\s\S]*?var ENDPOINT = [^\n]*\n/.exec(html)
  expect(match, "home-turf script no longer derives ENDPOINT from STAGING_HOSTNAMES").not.toBeNull()
  const run = new Function("window", `${match![0]}\nreturn ENDPOINT`) as (w: unknown) => string
  return run({ location: { hostname } })
}

describe("home-turf form endpoint", () => {
  it("posts a staging submission to the staging API, never the production inbox", () => {
    for (const host of ["civfix.dev", "www.civfix.dev", "staging.civfix-web.pages.dev"]) {
      expect(endpointFor(host)).toBe("https://api.civfix.dev/forms/home-turf")
    }
  })

  it("posts to the production API everywhere else", () => {
    for (const host of ["civfix.org", "www.civfix.org", "civfix-web.pages.dev", "civfix.dev.evil.com"]) {
      expect(endpointFor(host)).toBe("https://api.civfix.org/forms/home-turf")
    }
  })

  it("recognises the same staging hostnames as the rest of the web app", () => {
    for (const host of STAGING_HOSTNAMES) {
      expect(endpointFor(host)).toBe("https://api.civfix.dev/forms/home-turf")
    }
  })
})
