import type { LegalBlock, LegalDocumentDTO, LegalDocumentType } from "@civfix/contract"

export type ReadableLegalDocument = LegalDocumentDTO & { title: string; blocks: LegalBlock[] }

export function readableLegalDocument(_document: LegalDocumentDTO | null | undefined): ReadableLegalDocument | null {
  throw new Error("not implemented")
}

export function legalDocumentTypeOf(_value: unknown): LegalDocumentType | null {
  throw new Error("not implemented")
}

export function legalDocumentPath(_type: LegalDocumentType): string {
  throw new Error("not implemented")
}

export function legalDocumentUrl(_type: LegalDocumentType): string {
  throw new Error("not implemented")
}

export function legalDocumentTypeOfUrl(_href: string): LegalDocumentType | null {
  throw new Error("not implemented")
}

export type LegalDocumentPresenter = (type: LegalDocumentType) => void

export function setLegalDocumentPresenter(_present: LegalDocumentPresenter | null): void {
  throw new Error("not implemented")
}

export function presentLegalDocument(_type: LegalDocumentType): boolean {
  throw new Error("not implemented")
}
