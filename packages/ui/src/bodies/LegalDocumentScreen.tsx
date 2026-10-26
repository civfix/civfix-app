import type { LegalDocumentType } from "@civfix/contract"

export interface LegalDocumentScreenProps {
  type: LegalDocumentType
  onBack: () => void
}

export function LegalDocumentScreen(_props: LegalDocumentScreenProps): never {
  throw new Error("not implemented")
}
