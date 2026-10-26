import {
  LegalDocumentTypeSchema,
  type LegalBlock,
  type LegalDocumentDTO,
  type LegalDocumentType,
} from "@civfix/contract"
import { WEB_ORIGIN } from "./externalUrls"

/** A version the API has text for; versions from before DECISIONS §66 have none to show. */
export type ReadableLegalDocument = LegalDocumentDTO & { title: string; blocks: LegalBlock[] }

export function readableLegalDocument(document: LegalDocumentDTO | null | undefined): ReadableLegalDocument | null {
  if (!document || document.title === null || document.blocks === null) return null
  return { ...document, title: document.title, blocks: document.blocks }
}

export function legalDocumentTypeOf(value: unknown): LegalDocumentType | null {
  const parsed = LegalDocumentTypeSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** The site's own page for a document, as the static export serves it. */
export function legalDocumentPath(type: LegalDocumentType): string {
  return `/legal/${type}/`
}

export function legalDocumentUrl(type: LegalDocumentType): string {
  return `${WEB_ORIGIN}/legal/${type}`
}

const LEGAL_DOCUMENT_URL = /^https:\/\/civfix\.org\/legal\/([a-z]+)\/?$/

/** The document a link inside legal text points at, when it is one of civfix.org's own legal pages. */
export function legalDocumentTypeOfUrl(href: string): LegalDocumentType | null {
  const match = LEGAL_DOCUMENT_URL.exec(href)
  return match ? legalDocumentTypeOf(match[1]) : null
}

// Shared surfaces ask for a document; the phone app presents its in-app screen. With no presenter (web),
// a surface links to the site's page as it always has.
export type LegalDocumentPresenter = (type: LegalDocumentType) => void

let presentDocument: LegalDocumentPresenter | null = null

export function setLegalDocumentPresenter(present: LegalDocumentPresenter | null): void {
  presentDocument = present
}

export function presentLegalDocument(type: LegalDocumentType): boolean {
  if (!presentDocument) return false
  presentDocument(type)
  return true
}
