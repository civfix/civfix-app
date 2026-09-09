import { describe, expect, it } from "vitest"
import {
  DEFAULT_DEDUCTIBLE_BMF_CODES,
  MNOS_GRACE_BUSINESS_DAYS,
  REVIEW_REQUIRED_BLOCKS_DONATIONS,
  addBusinessDays,
  evaluateEligibility,
  isDonationEligible,
  verdictPermitsDonations,
  type EligibilityEvidence,
} from "../eligibility.js"

const CLEAN: EligibilityEvidence = {
  pub78Listed: true,
  bmfListed: true,
  deductibilityCode: "1",
  autoRevocationListed: false,
  ftbRevoked: false,
  mnosListed: false,
  ofacMatch: false,
  groupExemptionSubordinate: false,
  centralOrgConfirmed: false,
  mnosFirstSeenOn: null,
  asOf: "2026-09-06",
}

function evidence(patch: Partial<EligibilityEvidence>): EligibilityEvidence {
  return { ...CLEAN, ...patch }
}

describe("addBusinessDays", () => {
  it("skips weekends", () => {
    expect(addBusinessDays("2026-09-02", 5)).toBe("2026-09-09")
    expect(addBusinessDays("2026-09-04", 1)).toBe("2026-09-07")
    expect(addBusinessDays("2026-09-05", 1)).toBe("2026-09-07")
    expect(addBusinessDays("2026-09-06", 1)).toBe("2026-09-07")
    expect(addBusinessDays("2026-09-04", 5)).toBe("2026-09-11")
  })

  it("is a no-op at zero and refuses bad input", () => {
    expect(addBusinessDays("2026-09-06", 0)).toBe("2026-09-06")
    expect(() => addBusinessDays("2026-9-6", 1)).toThrow(RangeError)
    expect(() => addBusinessDays("2026-09-06", -1)).toThrow(RangeError)
  })
})

describe("evaluateEligibility", () => {
  it("is eligible on a clean Pub 78 listing", () => {
    const result = evaluateEligibility(CLEAN)
    expect(result.verdict).toBe("eligible")
    expect(result.reasons).toEqual([])
    expect(isDonationEligible(result)).toBe(true)
  })

  it("is eligible on a BMF listing with a deductible code alone", () => {
    expect(DEFAULT_DEDUCTIBLE_BMF_CODES).toEqual(["1"])
    expect(evaluateEligibility(evidence({ pub78Listed: false })).verdict).toBe("eligible")
  })

  it("is unknown when the BMF code is not deductible", () => {
    const result = evaluateEligibility(evidence({ pub78Listed: false, deductibilityCode: "2" }))
    expect(result.verdict).toBe("unknown")
    expect(result.reasons).toEqual(["no_positive_listing", "bmf_not_deductible"])
  })

  it("is unknown with no listing at all", () => {
    const result = evaluateEligibility(
      evidence({ pub78Listed: false, bmfListed: false, deductibilityCode: null }),
    )
    expect(result.verdict).toBe("unknown")
    expect(result.reasons).toEqual(["no_positive_listing"])
  })

  it("accepts a caller-supplied deductible code set", () => {
    const ev = evidence({ pub78Listed: false, deductibilityCode: "4" })
    expect(evaluateEligibility(ev).verdict).toBe("unknown")
    expect(evaluateEligibility(ev, { deductibleCodes: ["1", "4"] }).verdict).toBe("eligible")
  })

  it("keeps a reinstated org eligible despite the auto-revocation list", () => {
    const result = evaluateEligibility(evidence({ autoRevocationListed: true, pub78Listed: true }))
    expect(result.verdict).toBe("eligible")
  })

  it("blocks an auto-revoked org that is not back on Pub 78", () => {
    const result = evaluateEligibility(evidence({ autoRevocationListed: true, pub78Listed: false }))
    expect(result.verdict).toBe("ineligible")
    expect(result.reasons).toContain("irs_auto_revoked")
  })

  it("blocks an FTB-revoked org", () => {
    const result = evaluateEligibility(evidence({ ftbRevoked: true }))
    expect(result.verdict).toBe("ineligible")
    expect(result.reasons).toContain("ftb_revoked")
  })

  it("blocks a group subordinate without central-org confirmation", () => {
    const result = evaluateEligibility(evidence({ groupExemptionSubordinate: true }))
    expect(result.verdict).toBe("ineligible")
    expect(result.reasons).toContain("group_subordinate_unconfirmed")
  })

  it("clears a group subordinate once the central org confirms", () => {
    expect(
      evaluateEligibility(evidence({ groupExemptionSubordinate: true, centralOrgConfirmed: true }))
        .verdict,
    ).toBe("eligible")
  })

  it("grants a five-business-day grace on a fresh MNOS hit", () => {
    expect(MNOS_GRACE_BUSINESS_DAYS).toBe(5)
    const result = evaluateEligibility(
      evidence({ mnosListed: true, mnosFirstSeenOn: "2026-09-02", asOf: "2026-09-08" }),
    )
    expect(result.verdict).toBe("grace")
    expect(result.reasons).toEqual(["ca_ag_mnos_grace"])
    expect(result.graceExpiresOn).toBe("2026-09-09")
    expect(isDonationEligible(result)).toBe(true)
  })

  it("blocks on the day after the grace expires", () => {
    const onExpiry = evaluateEligibility(
      evidence({ mnosListed: true, mnosFirstSeenOn: "2026-09-02", asOf: "2026-09-09" }),
    )
    expect(onExpiry.verdict).toBe("grace")
    const afterExpiry = evaluateEligibility(
      evidence({ mnosListed: true, mnosFirstSeenOn: "2026-09-02", asOf: "2026-09-10" }),
    )
    expect(afterExpiry.verdict).toBe("ineligible")
    expect(afterExpiry.reasons).toContain("ca_ag_mnos")
    expect(isDonationEligible(afterExpiry)).toBe(false)
  })

  it("refuses to grant a grace with no known start date or no evaluation date", () => {
    expect(evaluateEligibility(evidence({ mnosListed: true, mnosFirstSeenOn: null })).verdict).toBe(
      "ineligible",
    )
    expect(
      evaluateEligibility(
        evidence({ mnosListed: true, mnosFirstSeenOn: "2026-09-02", asOf: null }),
      ).verdict,
    ).toBe("ineligible")
  })

  it("routes an OFAC match to review rather than auto-blocking", () => {
    const result = evaluateEligibility(evidence({ ofacMatch: true }))
    expect(result.verdict).toBe("review_required")
    expect(result.reasons).toEqual(["ofac_sdn_match"])
    expect(REVIEW_REQUIRED_BLOCKS_DONATIONS).toBe(false)
    expect(isDonationEligible(result)).toBe(true)
    expect(isDonationEligible(result, { reviewRequiredBlocks: true })).toBe(false)
  })

  it("permits donations only on eligible, grace and (by policy) review_required", () => {
    expect(verdictPermitsDonations("eligible")).toBe(true)
    expect(verdictPermitsDonations("grace")).toBe(true)
    expect(verdictPermitsDonations("review_required")).toBe(true)
    expect(verdictPermitsDonations("review_required", { reviewRequiredBlocks: true })).toBe(false)
    expect(verdictPermitsDonations("unknown")).toBe(false)
    expect(verdictPermitsDonations("ineligible")).toBe(false)
  })

  it("names the remediation when the positive sources were never screened", () => {
    const never = evaluateEligibility(
      evidence({
        pub78Listed: false,
        bmfListed: false,
        deductibilityCode: null,
        pub78Checked: false,
        bmfChecked: false,
      }),
    )
    expect(never.verdict).toBe("unknown")
    expect(never.reasons).toEqual(["positive_sources_not_yet_checked"])

    const screened = evaluateEligibility(
      evidence({
        pub78Listed: false,
        bmfListed: false,
        deductibilityCode: null,
        pub78Checked: true,
        bmfChecked: false,
      }),
    )
    expect(screened.reasons).toEqual(["no_positive_listing"])
  })

  it("lets a hard disqualifier win over an OFAC review", () => {
    const result = evaluateEligibility(evidence({ ofacMatch: true, ftbRevoked: true }))
    expect(result.verdict).toBe("ineligible")
    expect(result.contributionsDeductible).toBe(false)
  })

  it("never lets an OFAC review stand in for a positive listing", () => {
    const unlisted = evaluateEligibility(
      evidence({ ofacMatch: true, pub78Listed: false, bmfListed: false, deductibilityCode: null, pub78Checked: true, bmfChecked: true }),
    )
    expect(unlisted.verdict).toBe("unknown")
    expect(unlisted.reasons).toEqual(["no_positive_listing", "ofac_sdn_match"])
    expect(isDonationEligible(unlisted)).toBe(false)
    expect(unlisted.contributionsDeductible).toBe(false)

    const neverChecked = evaluateEligibility(
      evidence({ ofacMatch: true, pub78Listed: false, bmfListed: false, deductibilityCode: null, pub78Checked: false, bmfChecked: false }),
    )
    expect(neverChecked.verdict).toBe("unknown")
    expect(neverChecked.reasons).toEqual(["positive_sources_not_yet_checked", "ofac_sdn_match"])
    expect(isDonationEligible(neverChecked)).toBe(false)
  })

  it("derives deductibility from the exemption evidence, not from the review flag", () => {
    expect(evaluateEligibility(CLEAN).contributionsDeductible).toBe(true)
    expect(evaluateEligibility(evidence({ ofacMatch: true })).contributionsDeductible).toBe(true)
    expect(
      evaluateEligibility(evidence({ mnosListed: true, mnosFirstSeenOn: "2026-09-02", asOf: "2026-09-08" })).contributionsDeductible,
    ).toBe(true)
    expect(
      evaluateEligibility(evidence({ pub78Listed: false, deductibilityCode: "2" })).contributionsDeductible,
    ).toBe(false)
  })

  it("collects every disqualifying reason", () => {
    const result = evaluateEligibility(
      evidence({
        ftbRevoked: true,
        autoRevocationListed: true,
        pub78Listed: false,
        groupExemptionSubordinate: true,
        mnosListed: true,
      }),
    )
    expect(result.verdict).toBe("ineligible")
    expect(result.reasons).toEqual([
      "ftb_revoked",
      "irs_auto_revoked",
      "group_subordinate_unconfirmed",
      "ca_ag_mnos",
    ])
  })

  it("is deterministic", () => {
    const ev = evidence({ mnosListed: true, mnosFirstSeenOn: "2026-09-02", asOf: "2026-09-08" })
    expect(evaluateEligibility(ev)).toEqual(evaluateEligibility(ev))
  })
})
