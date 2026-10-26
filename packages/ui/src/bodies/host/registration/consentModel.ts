import type { EventConsentInput, LegalDocumentType } from "@civfix/contract"
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

export interface ConsentVersions {
  terms: string
  privacy: string
}

export interface LegalVersionRef {
  type: LegalDocumentType
  version: string
}

/**
 * The Terms and Privacy versions a consent sends: the ones an outdated answer named, else the fetched ones.
 * Null until both are known.
 */
export function consentVersions(
  documents: readonly LegalVersionRef[] | undefined,
  current?: readonly LegalVersionRef[] | null,
): ConsentVersions | null {
  const versionOf = (type: LegalDocumentType) =>
    (current?.find((entry) => entry.type === type) ?? documents?.find((entry) => entry.type === type))?.version
  const terms = versionOf("terms")
  const privacy = versionOf("privacy")
  return terms === undefined || privacy === undefined ? null : { terms, privacy }
}

export function consentPayload(
  state: ConsentState,
  versions: ConsentVersions,
  options: { surface?: EventConsentInput["surface"] } = {},
): EventConsentInput {
  return {
    termsVersion: versions.terms,
    disclosureVersion: versions.privacy,
    hostContactOptIn: state.hostContactOptIn,
    smsOptIn: state.smsOptIn,
    surface: options.surface ?? REGISTRATION_CONSENT_SURFACE,
  }
}

export function consentAccepted(state: ConsentState): boolean {
  return state.terms
}
