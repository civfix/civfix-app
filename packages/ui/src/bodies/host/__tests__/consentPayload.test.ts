import { describe, expect, it } from "vitest"
import { ConsentSurfaceSchema, EventConsentInputSchema } from "@civfix/contract"
import { EMPTY_CONSENT, consentAccepted, consentPayload, consentVersions } from "../registration/consentModel"
import { REGISTRATION_CONSENT_SURFACE } from "../registration/consentSurface"
import { PRIVACY_0921, TERMS_0921 } from "../../../data/__tests__/legalFixtures"

const VERSIONS = { terms: "2026-09-21", privacy: "2026-09-21" }

describe("consentPayload", () => {
  it("T14: stamps the fetched Terms and Privacy versions", () => {
    const versions = consentVersions([TERMS_0921, PRIVACY_0921])
    expect(versions).not.toBeNull()
    const payload = consentPayload({ terms: true, hostContactOptIn: true, smsOptIn: false }, versions!)
    expect(payload).toEqual({
      termsVersion: "2026-09-21",
      disclosureVersion: "2026-09-21",
      hostContactOptIn: true,
      smsOptIn: false,
      surface: REGISTRATION_CONSENT_SURFACE,
    })
    expect(EventConsentInputSchema.safeParse(payload).success).toBe(true)
  })

  it("ALWAYS carries smsOptIn from state - an express consent is never silently dropped", () => {
    expect(consentPayload({ terms: true, hostContactOptIn: false, smsOptIn: true }, VERSIONS).smsOptIn).toBe(true)
    expect(consentPayload({ terms: true, hostContactOptIn: false, smsOptIn: false }, VERSIONS).smsOptIn).toBe(false)
  })

  it("records identity sharing as an explicit OPT-IN, defaulting to off", () => {
    expect(EMPTY_CONSENT.hostContactOptIn).toBe(false)
    expect(EMPTY_CONSENT.smsOptIn).toBe(false)
    expect(consentPayload(EMPTY_CONSENT, VERSIONS).hostContactOptIn).toBe(false)
  })

  it("records the platform the consent was taken on, from the seam", () => {
    expect(ConsentSurfaceSchema.options).toContain(REGISTRATION_CONSENT_SURFACE)
    expect(consentPayload(EMPTY_CONSENT, VERSIONS).surface).toBe(REGISTRATION_CONSENT_SURFACE)
    expect(consentPayload(EMPTY_CONSENT, VERSIONS, { surface: "onboarding" }).surface).toBe("onboarding")
  })

  it("never sends acceptedAt - the server stamps its own clock", () => {
    expect(Object.keys(consentPayload(EMPTY_CONSENT, VERSIONS))).not.toContain("acceptedAt")
  })

  it("produces a payload the contract accepts", () => {
    expect(
      EventConsentInputSchema.safeParse(
        consentPayload({ terms: true, hostContactOptIn: true, smsOptIn: true }, VERSIONS),
      ).success,
    ).toBe(true)
  })

  it("gates on the terms box alone - the two opt-ins are optional by design", () => {
    expect(consentAccepted(EMPTY_CONSENT)).toBe(false)
    expect(consentAccepted({ terms: true, hostContactOptIn: false, smsOptIn: false })).toBe(true)
  })
})

describe("consentVersions", () => {
  it("T15: prefers an outdated answer's current versions over the fetched ones", () => {
    const current = [{ type: "terms" as const, version: "2026-10-30", sha256: "a".repeat(64) }]
    expect(consentVersions([TERMS_0921, PRIVACY_0921], current)).toEqual({ terms: "2026-10-30", privacy: "2026-09-21" })
    expect(consentVersions([TERMS_0921, PRIVACY_0921])).toEqual({ terms: "2026-09-21", privacy: "2026-09-21" })
    expect(consentVersions([TERMS_0921])).toBeNull()
  })
})
