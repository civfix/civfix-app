import type { LegalDocumentType } from "@civfix/contract"

export interface LegalDocumentBodyProps {
  type: LegalDocumentType
  version?: string | undefined
}

export function LegalDocumentBody(_props: LegalDocumentBodyProps): never {
  throw new Error("not implemented")
}
