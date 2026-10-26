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

export function consentVersions(
  _documents: readonly LegalVersionRef[] | undefined,
  _current?: readonly LegalVersionRef[] | null,
): ConsentVersions | null {
  throw new Error("not implemented")
}

export function consentPayload(
  _state: ConsentState,
  _versions: ConsentVersions,
  _options: { surface?: EventConsentInput["surface"] } = {},
): EventConsentInput {
  void REGISTRATION_CONSENT_SURFACE
  throw new Error("not implemented")
}

export function consentAccepted(state: ConsentState): boolean {
  return state.terms
}
