import type { EventConsentInput } from "@civfix/shared"
import { currentVersion } from "@civfix/shared/legal"
import { REGISTRATION_CONSENT_SURFACE } from "./consentSurface"

export interface ConsentState {
  terms: boolean
  hostContactOptIn: boolean
  smsOptIn: boolean
}

export const EMPTY_CONSENT: ConsentState = {
  terms: false,
  hostContactOptIn: false,
  smsOptIn: false,
}

export function consentPayload(
  state: ConsentState,
  options: { surface?: EventConsentInput["surface"] } = {},
): EventConsentInput {
  return {
    termsVersion: currentVersion("terms"),
    disclosureVersion: currentVersion("privacy"),
    hostContactOptIn: state.hostContactOptIn,
    smsOptIn: state.smsOptIn,
    surface: options.surface ?? REGISTRATION_CONSENT_SURFACE,
  }
}

export function consentAccepted(state: ConsentState): boolean {
  return state.terms
}
