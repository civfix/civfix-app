import type { ReadableLegalDocument } from "./legalDocument"

export interface LegalDocumentViewProps {
  document: ReadableLegalDocument
  current: boolean
}

export function LegalDocumentView(_props: LegalDocumentViewProps): never {
  throw new Error("not implemented")
}
