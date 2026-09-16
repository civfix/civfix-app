import type { LegalDocumentType } from "../schemas/common.js"

export interface LegalDocumentVersion {
  type: LegalDocumentType
  version: string
  sha256: string
  effectiveAt: string
  url: string
}

const CURRENT_VERSION = "2026-09-16"
const CURRENT_EFFECTIVE_AT = "2026-09-16T00:00:00.000Z"
const LEGAL_BASE_URL = "https://civfix.org/legal"

const DOCUMENTS: Readonly<Record<LegalDocumentType, LegalDocumentVersion>> = {
  terms: {
    type: "terms",
    version: CURRENT_VERSION,
    sha256: "afa437255814c5fb39e75f7507304b7a2618aa1397bcdbe3d66129385515ca36",
    effectiveAt: CURRENT_EFFECTIVE_AT,
    url: `${LEGAL_BASE_URL}/terms`,
  },
  privacy: {
    type: "privacy",
    version: CURRENT_VERSION,
    sha256: "d3789e993ddee83cb5c556234694a9d0f200e5d99b533eba6ca3ca2053df9417",
    effectiveAt: CURRENT_EFFECTIVE_AT,
    url: `${LEGAL_BASE_URL}/privacy`,
  },
  cookies: {
    type: "cookies",
    version: CURRENT_VERSION,
    sha256: "4a05415bba1ef0301058815ce6d01f98eb593bd18378e7ce52555074da3064c0",
    effectiveAt: CURRENT_EFFECTIVE_AT,
    url: `${LEGAL_BASE_URL}/cookies`,
  },
  subprocessors: {
    type: "subprocessors",
    version: CURRENT_VERSION,
    sha256: "5ab722bb37cc2972ada7521b6dc239bfd85f82691d0e3e2489f5dcac9983a198",
    effectiveAt: CURRENT_EFFECTIVE_AT,
    url: `${LEGAL_BASE_URL}/subprocessors`,
  },
}

export const LEGAL_DOCUMENTS: readonly LegalDocumentVersion[] = Object.freeze(
  (Object.keys(DOCUMENTS) as LegalDocumentType[]).map((type) => Object.freeze(DOCUMENTS[type])),
)

export function legalDocument(type: LegalDocumentType): LegalDocumentVersion {
  const document = DOCUMENTS[type]
  if (document === undefined) throw new RangeError(`unknown legal document type "${type}"`)
  return document
}

export function currentVersion(type: LegalDocumentType): string {
  return legalDocument(type).version
}

export function isCurrent(type: LegalDocumentType, version: string): boolean {
  return legalDocument(type).version === version
}
