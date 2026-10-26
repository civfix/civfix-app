import type { LegalDocumentType } from "@civfix/contract"
import { presentLegalDocument } from "./legalDocument"

export function openLegalDocumentInPlace(type: LegalDocumentType): boolean {
  return presentLegalDocument(type)
}
