import type { LegalDocumentType } from "@civfix/contract"
import { legalDocumentPath } from "./legalDocument"

/** A link between legal documents stays on this site, in the same tab, whatever origin it is served from. */
export function openLegalDocumentInPlace(type: LegalDocumentType): boolean {
  window.location.assign(legalDocumentPath(type))
  return true
}
