import { describe, expect, it } from "vitest"
import { currentVersion } from "@civfix/shared/legal"
import { ConsentSurfaceSchema, EventConsentInputSchema } from "@civfix/shared"
import { EMPTY_CONSENT, consentAccepted, consentPayload } from "../registration/consentModel"
import { REGISTRATION_CONSENT_SURFACE } from "../registration/consentSurface"

describe("consentPayload", () => {
  it("stamps the versions the SERVER validates against", () => {
    const payload = consentPayload({ terms: true, hostContactOptIn: true, smsOptIn: false })
    expect(payload.termsVersion).toBe(currentVersion("terms"))
    expect(payload.disclosureVersion).toBe(currentVersion("privacy"))
  })

  it("ALWAYS carries smsOptIn from state - an express consent is never silently dropped", () => {
    expect(consentPayload({ terms: true, hostContactOptIn: false, smsOptIn: true }).smsOptIn).toBe(true)
    expect(consentPayload({ terms: true, hostContactOptIn: false, smsOptIn: false }).smsOptIn).toBe(false)
  })

  it("records identity sharing as an explicit OPT-IN, defaulting to off", () => {
    expect(EMPTY_CONSENT.hostContactOptIn).toBe(false)
    expect(EMPTY_CONSENT.smsOptIn).toBe(false)
    expect(consentPayload(EMPTY_CONSENT).hostContactOptIn).toBe(false)
  })

  it("records the platform the consent was taken on, from the seam", () => {
    expect(ConsentSurfaceSchema.options).toContain(REGISTRATION_CONSENT_SURFACE)
    expect(consentPayload(EMPTY_CONSENT).surface).toBe(REGISTRATION_CONSENT_SURFACE)
    expect(consentPayload(EMPTY_CONSENT, { surface: "onboarding" }).surface).toBe("onboarding")
  })

  it("never sends acceptedAt - the server stamps its own clock", () => {
    expect(Object.keys(consentPayload(EMPTY_CONSENT))).not.toContain("acceptedAt")
  })

  it("produces a payload the contract accepts", () => {
    expect(
      EventConsentInputSchema.safeParse(
        consentPayload({ terms: true, hostContactOptIn: true, smsOptIn: true }),
      ).success,
    ).toBe(true)
  })

  it("gates on the terms box alone - the two opt-ins are optional by design", () => {
    expect(consentAccepted(EMPTY_CONSENT)).toBe(false)
    expect(consentAccepted({ terms: true, hostContactOptIn: false, smsOptIn: false })).toBe(true)
  })
})
