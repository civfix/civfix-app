import { describe, it, expect } from "vitest"
import {
  versionedPath,
  API_VERSIONS,
  LATEST_API_VERSION,
} from "../src/client/versioning.js"
import { endpoints } from "../src/client/endpoints.js"

describe("versionedPath", () => {
  it("prefixes a versioned endpoint path with /<version>", () => {
    expect(versionedPath({ version: "v1", path: "/reports" })).toBe("/v1/reports")
    expect(versionedPath({ version: "v1", path: "/reports/:id/follow" })).toBe(
      "/v1/reports/:id/follow",
    )
  })

  it("leaves an unversioned endpoint path untouched", () => {
    expect(versionedPath({ version: "unversioned", path: "/healthz" })).toBe("/healthz")
    expect(versionedPath({ version: "unversioned", path: "/auth/google/start" })).toBe(
      "/auth/google/start",
    )
  })

  it("exposes the supported versions and the latest", () => {
    expect(API_VERSIONS).toEqual(["v1"])
    expect(LATEST_API_VERSION).toBe("v1")
  })
})

describe("endpoint version invariants", () => {
  // The ONLY endpoints that must stay off the version prefix, and exactly why each one must:
  //   /healthz                — infra liveness probe (Caddy, rate-limit allowlist, Docker, deploy gate)
  //   /auth/google/start      — the web button navigates the browser here directly (hardcoded)
  //   /auth/google/callback   — the redirect_uri registered in Google Cloud Console; must stay byte-stable
  //   /auth/apple/start       — the web button navigates the browser here directly (hardcoded), mirroring Google
  //   /auth/apple/callback    — the redirect URI registered with Sign in with Apple; must stay byte-stable
  // Pinning this set guards against a future contract edit silently moving one under /v1 (which would
  // break infra probes or Google/Apple sign-in) or forgetting `version` on a new endpoint.
  const UNVERSIONED: Record<string, string> = {
    health: "/healthz",
    googleStart: "/auth/google/start",
    googleCallback: "/auth/google/callback",
    appleStart: "/auth/apple/start",
    appleCallback: "/auth/apple/callback",
  }

  it("exactly these endpoints are unversioned — no more, no fewer", () => {
    const actual = Object.entries(endpoints)
      .filter(([, ep]) => ep.version === "unversioned")
      .map(([name]) => name)
      .sort()
    expect(actual).toEqual(Object.keys(UNVERSIONED).sort())
  })

  it("each unversioned endpoint keeps its exact stable wire path", () => {
    for (const [name, path] of Object.entries(UNVERSIONED)) {
      const ep = endpoints[name as keyof typeof endpoints]
      expect(ep.version).toBe("unversioned")
      expect(versionedPath(ep)).toBe(path)
    }
  })

  it("every other endpoint is served under /v1", () => {
    for (const [name, ep] of Object.entries(endpoints)) {
      if (name in UNVERSIONED) continue
      expect(ep.version, `${name} must be v1`).toBe("v1")
      expect(versionedPath(ep)).toBe(`/v1${ep.path}`)
    }
  })
})
