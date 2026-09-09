import { describe, expect, it } from "vitest"

import { orgSlugFromPath } from "./org-page-slug"

describe("orgSlugFromPath", () => {
  it("reads a slug from the live URL, with or without the trailing slash", () => {
    expect(orgSlugFromPath("/orgs/river-keepers/")).toEqual({ kind: "slug", slug: "river-keepers" })
    expect(orgSlugFromPath("/orgs/river-keepers")).toEqual({ kind: "slug", slug: "river-keepers" })
  })

  it("treats the export placeholder and a bare prefix as no slug", () => {
    expect(orgSlugFromPath("/orgs/_/")).toEqual({ kind: "none" })
    expect(orgSlugFromPath("/orgs/")).toEqual({ kind: "none" })
    expect(orgSlugFromPath("/people/ada/")).toEqual({ kind: "none" })
    expect(orgSlugFromPath(null)).toEqual({ kind: "none" })
  })

  it("rejects anything OrgSlugSchema would reject", () => {
    expect(orgSlugFromPath("/orgs/ab/")).toEqual({ kind: "invalid", raw: "ab" })
    expect(orgSlugFromPath("/orgs/Has%20Space/")).toEqual({ kind: "invalid", raw: "Has Space" })
    expect(orgSlugFromPath("/orgs/%E0%A4%A/").kind).toBe("invalid")
  })

  it("normalizes case the way the contract does", () => {
    expect(orgSlugFromPath("/orgs/River-Keepers/")).toEqual({ kind: "slug", slug: "river-keepers" })
  })
})
