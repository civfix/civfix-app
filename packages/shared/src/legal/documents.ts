import type { LegalDocumentType } from "../schemas/common.js"

export interface LegalDocumentVersion {
  type: LegalDocumentType
  version: string
  sha256: string
  effectiveAt: string
  url: string
}

const CURRENT_VERSION = "2026-09-06"
const CURRENT_EFFECTIVE_AT = "2026-09-06T00:00:00.000Z"
const LEGAL_BASE_URL = "https://civfix.org/legal"

const DOCUMENTS: Readonly<Record<LegalDocumentType, LegalDocumentVersion>> = {
  terms: {
    type: "terms",
    version: CURRENT_VERSION,
    sha256: "4a4fcfac1a8d4ced63c4c033feb14df58a2db74632bdca37865fd5ab299a485e",
    effectiveAt: CURRENT_EFFECTIVE_AT,
    url: `${LEGAL_BASE_URL}/terms`,
  },
  privacy: {
    type: "privacy",
    version: CURRENT_VERSION,
    sha256: "91ba84fdeae76ed663b8711473e6c7b4ac5ae424925a663ea4383d4fe763b9dc",
    effectiveAt: CURRENT_EFFECTIVE_AT,
    url: `${LEGAL_BASE_URL}/privacy`,
  },
  cookies: {
    type: "cookies",
    version: CURRENT_VERSION,
    sha256: "a45a5d61d54b22c60e7de8ea2a76fc58ed48c26cfdcbd73c5a9e02f5fb9a30ed",
    effectiveAt: CURRENT_EFFECTIVE_AT,
    url: `${LEGAL_BASE_URL}/cookies`,
  },
  subprocessors: {
    type: "subprocessors",
    version: CURRENT_VERSION,
    sha256: "e3debad19253777755713b14ed4f1e853737e7e755b722d16f622fb0641c56a9",
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
