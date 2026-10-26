import type { LegalBlock, LegalDocumentDTO, LegalDocumentType } from "@civfix/contract"

const TITLES: Record<LegalDocumentType, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  cookies: "Cookies & Storage",
  subprocessors: "Sub-processors",
}

export function legalDoc(
  type: LegalDocumentType,
  version: string,
  overrides: Partial<LegalDocumentDTO> = {},
): LegalDocumentDTO {
  return {
    type,
    version,
    effectiveAt: `${version}T00:00:00.000Z`,
    url: `https://civfix.org/legal/${type}`,
    title: TITLES[type],
    summary: null,
    material: true,
    sha256: "c".repeat(64),
    blocks: [
      { kind: "heading", level: 2, text: `1. About the ${TITLES[type]}` },
      { kind: "paragraph", text: `The ${TITLES[type]} text, version ${version}.` },
    ] satisfies LegalBlock[],
    ...overrides,
  }
}

export const CURRENT_VERSION = "2026-10-30"

export const CURRENT_DOCUMENTS: LegalDocumentDTO[] = (
  ["terms", "privacy", "cookies", "subprocessors"] as const
).map((type) => legalDoc(type, CURRENT_VERSION))
