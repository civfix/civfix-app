import type { LegalDocumentMetaDTO } from "@civfix/contract"

export function LegalUpdateGate(): null {
  throw new Error("not implemented")
}

export interface LegalUpdateScreenProps {
  required: LegalDocumentMetaDTO[]
  notices: LegalDocumentMetaDTO[]
}

export function LegalUpdateScreen(_props: LegalUpdateScreenProps): null {
  throw new Error("not implemented")
}
