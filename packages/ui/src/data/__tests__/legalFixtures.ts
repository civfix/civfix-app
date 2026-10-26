import { AppError, ErrorCode, type LegalDocumentDTO, type LegalDocumentType } from "@civfix/contract"

function legalDocument(type: LegalDocumentType, version: string, sha256: string): LegalDocumentDTO {
  return {
    type,
    version,
    effectiveAt: `${version}T00:00:00.000Z`,
    url: `https://civfix.org/legal/${type}`,
    title: null,
    summary: null,
    material: null,
    sha256,
    blocks: null,
  }
}

export const TERMS_0921 = legalDocument(
  "terms",
  "2026-09-21",
  "52fe3908a8d7aa4427239a7555a2d7b2346d7a2b9730dfb539ecd157f6195772",
)
export const PRIVACY_0921 = legalDocument(
  "privacy",
  "2026-09-21",
  "e7bb3df8d1bae0ebf3dac45021beb1f260c3035f2bf3cabd0201e2586eb2f127",
)
export const COOKIES_0916 = legalDocument(
  "cookies",
  "2026-09-16",
  "4a05415bba1ef0301058815ce6d01f98eb593bd18378e7ce52555074da3064c0",
)
export const SUBPROCESSORS_0916 = legalDocument(
  "subprocessors",
  "2026-09-16",
  "5ab722bb37cc2972ada7521b6dc239bfd85f82691d0e3e2489f5dcac9983a198",
)
export const TERMS_0916 = legalDocument(
  "terms",
  "2026-09-16",
  "afa437255814c5fb39e75f7507304b7a2618aa1397bcdbe3d66129385515ca36",
)

export const DOCUMENTS = [TERMS_0921, PRIVACY_0921, COOKIES_0916, SUBPROCESSORS_0916]

export const OUTDATED_DETAILS = {
  reason: "legal_version_outdated",
  current: [
    { type: "terms", version: "2026-10-30", sha256: "a".repeat(64) },
    { type: "privacy", version: "2026-10-30", sha256: "b".repeat(64) },
  ],
} as const

export function outdatedConflict(): AppError {
  return new AppError(ErrorCode.CONFLICT, "outdated", { details: { ...OUTDATED_DETAILS } })
}
