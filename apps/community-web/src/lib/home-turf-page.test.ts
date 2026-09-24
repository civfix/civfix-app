import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { PRODUCTION_HOSTNAMES, STAGING_HOSTNAMES } from "@/lib/site-meta"

const html = readFileSync(new URL("../../public/home-turf/index.html", import.meta.url), "utf8")

const PRODUCTION_ENDPOINT = "https://api.civfix.org/forms/home-turf"
const STAGING_ENDPOINT = "https://api.civfix.dev/forms/home-turf"

/**
 * The static /home-turf page is plain HTML with an inline script (no build step inlines the API URL),
 * so the environment is chosen from the hostname at runtime. Run exactly that part of the script
 * against a stubbed `window.location` and read back the endpoint it would POST to.
 */
function endpointFor(hostname: string): string {
  const match = /var PRODUCTION_HOSTNAMES = [\s\S]*?var ENDPOINT = [^\n]*\n/.exec(html)
  expect(match, "home-turf script no longer derives ENDPOINT from PRODUCTION_HOSTNAMES").not.toBeNull()
  const run = new Function("window", `${match![0]}\nreturn ENDPOINT`) as (w: unknown) => string
  return run({ location: { hostname } })
}

describe("home-turf form endpoint", () => {
  it("posts to the production API only from the production hostnames", () => {
    for (const host of ["civfix.org", "www.civfix.org", "civfix-web.pages.dev"]) {
      expect(endpointFor(host)).toBe(PRODUCTION_ENDPOINT)
    }
  })

  it("posts a staging submission to the staging API, never the production inbox", () => {
    for (const host of ["civfix.dev", "www.civfix.dev", "staging.civfix-web.pages.dev"]) {
      expect(endpointFor(host)).toBe(STAGING_ENDPOINT)
    }
  })

  it("fails closed to the staging API on any host it does not know", () => {
    for (const host of [
      "localhost",
      "3f2a1b.civfix-web.pages.dev",
      "civfix.org.evil.com",
      "evil-civfix.org",
      "CIVFIX.ORG.attacker.net",
    ]) {
      expect(endpointFor(host)).toBe(STAGING_ENDPOINT)
    }
  })

  it("recognises the same hostnames as the rest of the web app", () => {
    for (const host of PRODUCTION_HOSTNAMES) expect(endpointFor(host)).toBe(PRODUCTION_ENDPOINT)
    for (const host of STAGING_HOSTNAMES) expect(endpointFor(host)).toBe(STAGING_ENDPOINT)
    const listed = /var PRODUCTION_HOSTNAMES = (\[[^\]]*\]);/.exec(html)
    expect(JSON.parse(listed![1]!.replace(/'/g, '"'))).toEqual([...PRODUCTION_HOSTNAMES])
  })
})
