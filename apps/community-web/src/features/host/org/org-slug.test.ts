import { OrgSlugSchema } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import { orgSlugProblem, publicOrgPath, slugFromOrgName } from "./org-slug"

describe("slugFromOrgName", () => {
  it("kebab-cases a plain name", () => {
    expect(slugFromOrgName("River Keepers LA")).toBe("river-keepers-la")
  })

  it("folds accents and drops punctuation instead of leaving gaps", () => {
    expect(slugFromOrgName("Café Río · Friends & Neighbors!")).toBe("cafe-rio-friends-neighbors")
  })

  it("never starts or ends with a dash, even after truncation", () => {
    expect(slugFromOrgName("  --hello--  ")).toBe("hello")
    const long = slugFromOrgName("a".repeat(39) + " b" + "c".repeat(20))
    expect(long.length).toBeLessThanOrEqual(40)
    expect(long.endsWith("-")).toBe(false)
    expect(OrgSlugSchema.safeParse(long).success).toBe(true)
  })

  it("produces something OrgSlugSchema accepts for any ordinary name", () => {
    for (const name of ["Mar Vista Cleanup Crew", "3rd Street Coalition", "LA-River_Friends"]) {
      expect(OrgSlugSchema.safeParse(slugFromOrgName(name)).success, name).toBe(true)
    }
  })
})

describe("orgSlugProblem", () => {
  it("names each way a slug can be wrong", () => {
    expect(orgSlugProblem("")).toBe("empty")
    expect(orgSlugProblem("ab")).toBe("short")
    expect(orgSlugProblem("a".repeat(41))).toBe("long")
    expect(orgSlugProblem("Has Space")).toBe("format")
    expect(orgSlugProblem("double--dash")).toBe("format")
    expect(orgSlugProblem("-leading")).toBe("format")
  })

  it("accepts what the contract accepts", () => {
    expect(orgSlugProblem("river-keepers")).toBeNull()
    expect(orgSlugProblem("abc")).toBeNull()
  })
})

describe("publicOrgPath", () => {
  it("is the trailing-slash static-export path", () => {
    expect(publicOrgPath("river-keepers")).toBe("/orgs/river-keepers/")
  })
})
